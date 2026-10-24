"use server";

import { and, eq, inArray } from "drizzle-orm";
import { clerkClient } from "@clerk/nextjs/server";
import { getDb } from "@/db";
import {
  accounts,
  coachRequests,
  studioMemberships,
  studioReservations,
  studios,
  userStates,
} from "@/db/schema";
import {
  coachPlanMetricsError,
  defaultCoachLedProfile,
  defaultCoachLedState,
  DEFAULT_COACH_GOAL,
  planHasExercises,
} from "@/lib/coach";
import { suggestedWeekdays } from "@/lib/metrics";
import { branchTrainingPlaces, generatePlan, type TrainingPlace } from "@/lib/plan";
import {
  createProfessionalCode,
  normalizeProfessionalCode,
} from "@/lib/roles";
import { replacePlanSplit } from "@/lib/schedule";
import {
  ensureDemoTeacherAssignment,
  getSessionUserId,
  logoutDemoProfessional,
} from "@/lib/session";
import { gymServiceAccessError } from "@/lib/studio-service";
import {
  memberActivities,
  normalizeStudioKinds,
  type Account,
  type AccountRole,
  type AppState,
  type Goal,
  type GoalType,
  type MedicalFlag,
  type Profile,
  type StudioKind,
  type StudioMemberRole,
  type WorkoutDay,
} from "@/lib/types";

async function requireUserId() {
  const userId = await getSessionUserId();
  if (!userId) throw new Error("No hay sesión");
  return userId;
}

async function clerkName(userId: string) {
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const full = user.fullName?.trim();
    if (full) return full;
    return [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  } catch {
    return "";
  }
}

async function toAccount(
  row: typeof accounts.$inferSelect
): Promise<Account> {
  let linkedProfessionalCode: string | null = null;
  if (row.linkedProfessionalId) {
    const [pro] = await getDb()
      .select({ code: accounts.code })
      .from(accounts)
      .where(eq(accounts.userId, row.linkedProfessionalId))
      .limit(1);
    linkedProfessionalCode = pro?.code ?? null;
  }
  let studioRole: StudioMemberRole | null = null;
  try {
    const [member] = await getDb()
      .select({ role: studioMemberships.role })
      .from(studioMemberships)
      .where(eq(studioMemberships.userId, row.userId))
      .limit(1);
    studioRole = member?.role ?? null;
  } catch {
    studioRole = null;
  }
  return {
    userId: row.userId,
    role: row.role,
    name: row.name,
    username: row.username,
    code: row.code,
    linkedProfessionalId: row.linkedProfessionalId,
    linkedProfessionalCode,
    studioRole,
  };
}

export async function loadAccount(): Promise<Account | null> {
  const userId = await requireUserId();
  if (userId === "demo-professional") {
    await ensureDemoTeacherAssignment();
  }
  const [row] = await getDb()
    .select()
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .limit(1);
  if (!row) return null;
  if (
    row.role === "studio" ||
    row.role === "professional" ||
    row.role === "client"
  ) {
    const blocked = await gymServiceAccessError(userId);
    if (blocked) {
      await logoutDemoProfessional();
      return null;
    }
  }
  return toAccount(row);
}

async function uniqueCode() {
  const db = getDb();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = createProfessionalCode();
    const [existing] = await db
      .select({ userId: accounts.userId })
      .from(accounts)
      .where(eq(accounts.code, code))
      .limit(1);
    if (!existing) return code;
  }
  throw new Error("No se pudo crear un código");
}

export async function chooseRole(role: AccountRole): Promise<Account> {
  if (role === "admin") {
    throw new Error("Ese rol no se elige desde acá.");
  }
  const userId = await requireUserId();
  const db = getDb();
  const [current] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .limit(1);
  const name = current?.name || (await clerkName(userId));
  const code =
    role === "professional"
      ? current?.code || (await uniqueCode())
      : current?.code ?? null;
  const linkedProfessionalId =
    role === "professional" ? null : current?.linkedProfessionalId ?? null;
  const now = new Date();
  await db
    .insert(accounts)
    .values({
      userId,
      role,
      name,
      code,
      linkedProfessionalId,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: accounts.userId,
      set: {
        role,
        name,
        code,
        linkedProfessionalId,
        updatedAt: now,
      },
    });
  try {
    const client = await clerkClient();
    await client.users.updateUserMetadata(userId, {
      publicMetadata: { enformaRole: role },
    });
  } catch {
    /* Neon is the source of truth */
  }
  const [row] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .limit(1);
  if (!row) throw new Error("No se pudo guardar el rol");
  return toAccount(row);
}

export async function linkProfessionalByCode(rawCode: string): Promise<Account> {
  const userId = await requireUserId();
  const code = normalizeProfessionalCode(rawCode);
  if (!code) throw new Error("Escribe el código de tu profesor.");
  const db = getDb();
  const [self] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .limit(1);
  if (self?.role === "professional") {
    throw new Error("Una cuenta de profesor no se vincula a otro profesor.");
  }
  const [pro] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.code, code), eq(accounts.role, "professional")))
    .limit(1);
  if (!pro) throw new Error("No encontramos ese código.");
  if (pro.userId === userId) {
    throw new Error("Ese código es tuyo. Pídele el suyo a tu profesor.");
  }
  const now = new Date();
  const name = self?.name || (await clerkName(userId));
  await db
    .insert(accounts)
    .values({
      userId,
      role: "client",
      name,
      code: self?.code ?? null,
      linkedProfessionalId: pro.userId,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: accounts.userId,
      set: {
        role: "client",
        linkedProfessionalId: pro.userId,
        updatedAt: now,
      },
    });
  const [row] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .limit(1);
  if (!row) throw new Error("No se pudo vincular");
  return toAccount(row);
}

export async function submitCoachRequest() {
  const userId = await requireUserId();
  const db = getDb();
  const [self] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .limit(1);
  if (!self?.linkedProfessionalId) {
    throw new Error("Primero indica el código de tu profesor.");
  }
  const now = new Date();
  await db
    .insert(coachRequests)
    .values({
      clientUserId: userId,
      professionalUserId: self.linkedProfessionalId,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: coachRequests.clientUserId,
      set: {
        professionalUserId: self.linkedProfessionalId,
        status: "pending",
        updatedAt: now,
      },
    });
}

export type CoachClientSummary = {
  clientUserId: string;
  name: string;
  goalLabel: string;
  days: number;
  requestedAt: string | null;
  pending: boolean;
};

function parseState(payload: unknown): AppState | null {
  if (!payload || typeof payload !== "object") return null;
  const obj = payload as { state?: AppState };
  if (obj.state?.profile && obj.state.plan) return obj.state;
  const raw = payload as AppState;
  if (raw.profile && raw.plan) return raw;
  return null;
}

export async function listCoachClients(): Promise<CoachClientSummary[]> {
  const userId = await requireUserId();
  const db = getDb();
  const [self] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .limit(1);
  if (self?.role !== "professional") throw new Error("No eres profesor");

  const linked = await db
    .select()
    .from(accounts)
    .where(eq(accounts.linkedProfessionalId, userId));
  if (!linked.length) return [];

  const ids = linked.map((row) => row.userId);
  const states = await db
    .select()
    .from(userStates)
    .where(inArray(userStates.userId, ids));
  const requests = await db
    .select()
    .from(coachRequests)
    .where(eq(coachRequests.professionalUserId, userId));
  const stateById = new Map(states.map((row) => [row.userId, parseState(row.payload)]));
  const requestById = new Map(requests.map((row) => [row.clientUserId, row]));

  return linked
    .map((row) => {
      const state = stateById.get(row.userId);
      const request = requestById.get(row.userId);
      return {
        clientUserId: row.userId,
        name: state?.profile.name || row.name || "Alumno",
        goalLabel: state?.goal.type ?? "",
        days: state?.profile.weekdays.length ?? 0,
        requestedAt: request?.updatedAt?.toISOString() ?? state?.coachPlanRequestedAt ?? null,
        pending:
          request?.status === "pending" ||
          Boolean(state && state.plan.weeklySplit.length === 0),
      };
    })
    .filter((item) => stateById.has(item.clientUserId))
    .sort((a, b) => Number(b.pending) - Number(a.pending));
}

export type CoachBranchEquipment = {
  studioNames: string[];
  gymMachines: string[];
  pilatesItems: string[];
};

export type CoachClientDetail = {
  clientUserId: string;
  profile: Profile;
  goal: Goal;
  weeklySplit: WorkoutDay[];
  trainingWeekdays: number[];
  hasPlan: boolean;
  requestedAt: string | null;
  branch: CoachBranchEquipment;
};

export type CoachPlanInput = {
  weeklySplit: WorkoutDay[];
  weightKg: number;
  heightCm: number;
  goalType: GoalType;
  place: TrainingPlace;
  medicalFlags: MedicalFlag[];
  medicalNotes: string;
};

function branchEquipment(
  memberships: { studioId: string; activities: StudioKind[] | null }[],
  studioRows: {
    id: string;
    name: string;
    kinds: StudioKind[] | null;
    kind: string | null;
    gymMachines: string[] | null;
    pilatesItems: string[] | null;
  }[]
): CoachBranchEquipment {
  const gym = new Set<string>();
  const pilates = new Set<string>();
  const studioNames: string[] = [];
  for (const studio of studioRows) {
    if (studio.name.trim()) studioNames.push(studio.name.trim());
    const member = memberships.find((item) => item.studioId === studio.id);
    const kinds = normalizeStudioKinds(studio.kinds, studio.kind ?? undefined);
    const activities = memberActivities(member?.activities, kinds);
    if (activities.includes("gym")) {
      for (const id of studio.gymMachines ?? []) gym.add(id);
    }
    if (activities.includes("pilates")) {
      for (const id of studio.pilatesItems ?? []) pilates.add(id);
    }
  }
  return {
    studioNames,
    gymMachines: [...gym],
    pilatesItems: [...pilates],
  };
}

function uniqueWeekdays(days: number[]) {
  return [
    ...new Set(
      days.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    ),
  ].sort((a, b) => a - b);
}

async function requireTeacherClient(teacherUserId: string, clientUserId: string) {
  const db = getDb();
  const [self] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, teacherUserId))
    .limit(1);
  if (self?.role !== "professional") throw new Error("No eres profesor");
  const [client] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, clientUserId))
    .limit(1);
  const memberships = await db
    .select()
    .from(studioMemberships)
    .where(
      and(
        eq(studioMemberships.userId, clientUserId),
        eq(studioMemberships.role, "client"),
        eq(studioMemberships.assignedTeacherUserId, teacherUserId)
      )
    );
  const linked = client?.linkedProfessionalId === teacherUserId;
  if (!client || (!linked && !memberships.length)) {
    throw new Error("Ese alumno no está asignado a ti.");
  }
  return { client, memberships };
}

async function coachClientContext(teacherUserId: string, clientUserId: string) {
  const { client, memberships } = await requireTeacherClient(
    teacherUserId,
    clientUserId
  );
  const db = getDb();
  const studioIds = [...new Set(memberships.map((item) => item.studioId))];
  const studioRows = studioIds.length
    ? await db
        .select({
          id: studios.id,
          name: studios.name,
          kinds: studios.kinds,
          kind: studios.kind,
          gymMachines: studios.gymMachines,
          pilatesItems: studios.pilatesItems,
        })
        .from(studios)
        .where(inArray(studios.id, studioIds))
    : [];
  const reservationRows = studioIds.length
    ? await db
        .select({
          weekday: studioReservations.weekday,
        })
        .from(studioReservations)
        .where(
          and(
            eq(studioReservations.clientUserId, clientUserId),
            inArray(studioReservations.studioId, studioIds)
          )
        )
    : [];
  const attendanceWeekdays = uniqueWeekdays(
    reservationRows.map((item) => item.weekday)
  );
  const sessionsPerWeek = memberships.find(
    (item) => item.sessionsPerWeek != null
  )?.sessionsPerWeek;
  const fallbackWeekdays = suggestedWeekdays(
    sessionsPerWeek && sessionsPerWeek > 0 ? sessionsPerWeek : 3
  );
  const branch = branchEquipment(memberships, studioRows);
  const gymMachines = branch.gymMachines;
  const pilatesItems = branch.pilatesItems;
  const displayName =
    memberships.find((item) => item.displayName.trim())?.displayName.trim() ||
    client.name ||
    "Alumno";
  const birthDate =
    memberships.find((item) => item.birthDate?.trim())?.birthDate ?? "";
  const [row] = await db
    .select()
    .from(userStates)
    .where(eq(userStates.userId, clientUserId))
    .limit(1);
  const existing = parseState(row?.payload);
  const seedProfile = defaultCoachLedProfile({
    name: existing?.profile.name || displayName,
    birthDate: existing?.profile.birthDate || birthDate,
    weekdays:
      existing?.profile.weekdays.length
        ? existing.profile.weekdays
        : attendanceWeekdays.length
          ? attendanceWeekdays
          : fallbackWeekdays,
    sessionMinutes: existing?.profile.sessionMinutes ?? 45,
    gymMachines,
    pilatesItems,
  });
  const state = existing ?? defaultCoachLedState(seedProfile, DEFAULT_COACH_GOAL);
  const trainingWeekdays = uniqueWeekdays([
    ...state.plan.weeklySplit.map((day) => day.weekday),
    ...state.profile.weekdays,
    ...attendanceWeekdays,
  ]);
  return {
    state: {
      ...state,
      profile: {
        ...state.profile,
        name: state.profile.name || displayName,
        weekdays: trainingWeekdays.length
          ? trainingWeekdays
          : seedProfile.weekdays,
      },
    },
    trainingWeekdays: trainingWeekdays.length
      ? trainingWeekdays
      : seedProfile.weekdays,
    branch,
  };
}

export async function loadCoachClient(
  clientUserId: string
): Promise<CoachClientDetail> {
  const userId = await requireUserId();
  const { state, trainingWeekdays, branch } = await coachClientContext(
    userId,
    clientUserId
  );
  const [request] = await getDb()
    .select()
    .from(coachRequests)
    .where(eq(coachRequests.clientUserId, clientUserId))
    .limit(1);
  return {
    clientUserId,
    profile: state.profile,
    goal: state.goal,
    weeklySplit: state.plan.weeklySplit,
    trainingWeekdays,
    hasPlan: planHasExercises(state),
    requestedAt:
      request?.updatedAt?.toISOString() ?? state.coachPlanRequestedAt ?? null,
    branch,
  };
}

export type StudioClientPlanDetail = {
  clientUserId: string;
  displayName: string;
  teacherName: string | null;
  studioNames: string[];
  emergencyName: string;
  emergencyPhone: string;
  profile: Profile;
  goal: Goal;
  weeklySplit: WorkoutDay[];
  hasPlan: boolean;
  loadedByName: string | null;
};

/** Plan de entrenamiento de un alumno, solo lectura para el estudio. */
export async function loadStudioClientPlan(
  clientUserId: string
): Promise<StudioClientPlanDetail> {
  const ownerId = await requireUserId();
  const db = getDb();
  const owned = await db
    .select({ id: studios.id, name: studios.name })
    .from(studios)
    .where(eq(studios.ownerUserId, ownerId));
  if (!owned.length) {
    throw new Error("No hay un gimnasio a tu nombre.");
  }
  const studioIds = owned.map((item) => item.id);
  const memberships = await db
    .select()
    .from(studioMemberships)
    .where(
      and(
        eq(studioMemberships.userId, clientUserId),
        eq(studioMemberships.role, "client"),
        inArray(studioMemberships.studioId, studioIds)
      )
    );
  if (!memberships.length) {
    throw new Error("Ese alumno no está en tu gimnasio.");
  }
  const [account] = await db
    .select({ name: accounts.name })
    .from(accounts)
    .where(eq(accounts.userId, clientUserId))
    .limit(1);
  const displayName =
    memberships.find((item) => item.displayName.trim())?.displayName.trim() ||
    account?.name?.trim() ||
    "Alumno";
  const teacherIds = [
    ...new Set(
      memberships
        .map((item) => item.assignedTeacherUserId)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  let teacherName: string | null = null;
  if (teacherIds.length) {
    const teachers = await db
      .select({
        userId: studioMemberships.userId,
        displayName: studioMemberships.displayName,
      })
      .from(studioMemberships)
      .where(
        and(
          inArray(studioMemberships.userId, teacherIds),
          eq(studioMemberships.role, "teacher"),
          inArray(studioMemberships.studioId, studioIds)
        )
      );
    teacherName =
      teachers.find((item) => item.displayName.trim())?.displayName.trim() ||
      null;
    if (!teacherName) {
      const [teacherAccount] = await db
        .select({ name: accounts.name })
        .from(accounts)
        .where(eq(accounts.userId, teacherIds[0]!))
        .limit(1);
      teacherName = teacherAccount?.name?.trim() || null;
    }
  }
  const [row] = await db
    .select()
    .from(userStates)
    .where(eq(userStates.userId, clientUserId))
    .limit(1);
  const state = parseState(row?.payload);
  const studioNames = owned
    .filter((studio) =>
      memberships.some((member) => member.studioId === studio.id)
    )
    .map((studio) => studio.name)
    .filter(Boolean);
  const withEmergency =
    memberships.find(
      (item) => item.emergencyName?.trim() || item.emergencyPhone?.trim()
    ) ?? memberships[0];
  const emergencyName = withEmergency?.emergencyName?.trim() ?? "";
  const emergencyPhone = withEmergency?.emergencyPhone?.trim() ?? "";
  if (!state) {
    return {
      clientUserId,
      displayName,
      teacherName,
      studioNames,
      emergencyName,
      emergencyPhone,
      profile: defaultCoachLedProfile({ name: displayName }),
      goal: DEFAULT_COACH_GOAL,
      weeklySplit: [],
      hasPlan: false,
      loadedByName: null,
    };
  }
  return {
    clientUserId,
    displayName: state.profile.name.trim() || displayName,
    teacherName,
    studioNames,
    emergencyName,
    emergencyPhone,
    profile: state.profile,
    goal: state.goal,
    weeklySplit: state.plan.weeklySplit,
    hasPlan: planHasExercises(state),
    loadedByName: state.plan.loadedBy?.name?.trim() || null,
  };
}

async function teacherDisplayName(userId: string) {
  const db = getDb();
  const [member] = await db
    .select({ displayName: studioMemberships.displayName })
    .from(studioMemberships)
    .where(
      and(
        eq(studioMemberships.userId, userId),
        eq(studioMemberships.role, "teacher")
      )
    )
    .limit(1);
  const fromMember = member?.displayName.trim();
  if (fromMember) return fromMember;
  const [account] = await db
    .select({ name: accounts.name })
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .limit(1);
  return account?.name.trim() || "Profesor";
}

export async function saveCoachClientPlan(
  clientUserId: string,
  input: CoachPlanInput
) {
  const userId = await requireUserId();
  const { state, branch } = await coachClientContext(userId, clientUserId);
  const metricsError = coachPlanMetricsError(input);
  if (metricsError) throw new Error(metricsError);
  const places = branchTrainingPlaces(branch);
  if (!places.includes(input.place)) {
    throw new Error(
      places.length
        ? "El plan tiene que usar los equipos de la sucursal."
        : branch.studioNames.length
          ? "La sucursal no tiene equipos cargados."
          : "Este alumno no está en una sucursal."
    );
  }
  const days = input.weeklySplit.filter((day) =>
    day.exercises.some((exercise) => exercise.name.trim())
  );
  if (!days.length) throw new Error("Añade al menos un ejercicio.");
  const teacherName = await teacherDisplayName(userId);
  const now = new Date();
  const goal: Goal = { ...state.goal, type: input.goalType };
  const profile: Profile = {
    ...state.profile,
    weightKg: input.weightKg,
    heightCm: input.heightCm,
    medicalFlags: input.medicalFlags,
    medicalNotes: input.medicalNotes.trim(),
    equipment: "coach",
    gymMachines: branch.gymMachines,
    pilatesItems: branch.pilatesItems,
    homeItems: [],
    weekdays: uniqueWeekdays(days.map((day) => day.weekday)),
  };
  const drafted = generatePlan(
    {
      ...profile,
      equipment: input.place,
      gymMachines: input.place === "full_gym" ? branch.gymMachines : [],
      pilatesItems: input.place === "pilates" ? branch.pilatesItems : [],
    },
    goal
  );
  const replaced = replacePlanSplit({ ...state, profile, goal }, days, now);
  const next: AppState = {
    ...state,
    goal,
    profile,
    planAcceptedAt: state.planAcceptedAt ?? now.toISOString(),
    planHistory: replaced.planHistory,
    plan: {
      ...replaced.plan,
      startWeightKg: input.weightKg,
      version: state.plan.version + 1,
      durationWeeks: drafted.durationWeeks,
      rationale: drafted.rationale,
      warnings: drafted.warnings,
      nutritionHints: state.plan.coachNutrition ?? [],
      coachNutrition: state.plan.coachNutrition,
      loadedBy: { userId, name: teacherName },
      weeklyFocus: drafted.weeklyFocus,
      adjustments: [
        ...state.plan.adjustments,
        {
          id: crypto.randomUUID(),
          date: now.toISOString(),
          reason: "Plan cargado por el profesor",
          changes: [
            planHasExercises(state)
              ? "El alumno ve este plan desde hoy. Los días anteriores se quedan con el plan de entonces."
              : `${days.length} sesión${days.length === 1 ? "" : "es"} escritas por tu profesor.`,
          ],
        },
      ],
    },
  };
  await getDb()
    .insert(userStates)
    .values({
      userId: clientUserId,
      payload: { state: next, draft: null },
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: userStates.userId,
      set: {
        payload: { state: next, draft: null },
        updatedAt: now,
      },
    });
  await getDb()
    .insert(coachRequests)
    .values({
      clientUserId,
      professionalUserId: userId,
      status: "loaded",
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: coachRequests.clientUserId,
      set: {
        professionalUserId: userId,
        status: "loaded",
        updatedAt: now,
      },
    });
}
