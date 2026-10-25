"use server";

import { and, asc, desc, eq, gte, inArray, isNull, lte, ne } from "drizzle-orm";
import { getDb } from "@/db";
import {
  accounts,
  coachRequests,
  gymTeachers,
  studioAbsences,
  studioInvites,
  studioMemberships,
  studioPayments,
  studioReservations,
  studioShiftRequests,
  studioTeacherShifts,
  studios,
  userStates,
  type ProposedTeacherShift,
} from "@/db/schema";
import {
  dayKindCapacity,
  defaultDayHours,
  hourCovers,
  hourSlots,
  hoursForWeekday,
  normalizeCupo,
  normalizeDayHours,
  occupancyForActivities,
  parseHour,
} from "@/lib/hours";
import {
  createInviteCode,
  createProfessionalCode,
  createStudioCode,
  normalizeJoinCode,
} from "@/lib/roles";
import {
  hashPassword,
  parsePassword,
  parseUsername,
  TEST_ACCOUNT_PASSWORD,
  usernameFromEmail,
  verifyPassword,
} from "@/lib/password";
import { WEEKDAYS } from "@/lib/labels";
import { getSessionUserId } from "@/lib/session";
import { planHasExercises } from "@/lib/coach";
import {
  clientAccountAlert,
  clientBillingPlanLabel,
  parseClientBillingPlan,
  renewBillingPeriod,
  serviceEndsFromStart,
  shiftYmd,
  todayBillingYmd,
  type ClientAccountAlert,
} from "@/lib/client-account";
import {
  memberActivities,
  normalizeStudioKinds,
  parseClientActivities,
  studioHasKind,
  type AppState,
  type ClientBillingPlan,
  type ClientPaymentStatus,
  type Sex,
  type Studio,
  type StudioDayHours,
  type StudioInviteRole,
  type StudioKind,
  type StudioMemberRole,
} from "@/lib/types";

export type { ClientAccountAlert };

async function requireUserId() {
  const userId = await getSessionUserId();
  if (!userId) throw new Error("No hay sesión");
  return userId;
}

function uid() {
  return crypto.randomUUID();
}

function toStudio(row: typeof studios.$inferSelect): Studio {
  const kinds = normalizeStudioKinds(row.kinds, row.kind);
  const dayHours = normalizeDayHours(
    row.dayHours,
    defaultDayHours(
      row.openWeekdays ?? [1, 2, 3, 4, 5, 6],
      row.openFrom,
      row.openTo
    )
  );
  return {
    id: row.id,
    ownerUserId: row.ownerUserId,
    name: row.name,
    kinds,
    code: row.code,
    pilatesItems: row.pilatesItems ?? [],
    gymMachines: row.gymMachines ?? [],
    dayHours,
    address: row.address ?? "",
    phone: row.phone ?? "",
    capacityPerSlot: normalizeCupo(row.capacityPerSlot) ?? 8,
  };
}

function primaryKind(kinds: StudioKind[]): StudioKind {
  return kinds.includes("pilates") ? "pilates" : "gym";
}

function resolveClientActivities(
  raw: unknown,
  studioKinds: StudioKind[]
): StudioKind[] {
  if (studioKinds.length === 1) return studioKinds;
  return parseClientActivities(raw, studioKinds);
}

function mirroredHours(dayHours: StudioDayHours[]) {
  const first = dayHours[0];
  return {
    openWeekdays: dayHours.map((item) => item.weekday),
    openFrom: first?.openFrom ?? "08:00",
    openTo: first?.openTo ?? "21:00",
    capacityPerSlot: Math.max(
      dayKindCapacity(first, "gym"),
      dayKindCapacity(first, "pilates")
    ),
  };
}

async function uniquePrefixedCode(kind: "studio" | "teacher" | "client") {
  const db = getDb();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code =
      kind === "studio" ? createStudioCode() : createInviteCode(kind);
    if (kind === "studio") {
      const [existing] = await db
        .select({ id: studios.id })
        .from(studios)
        .where(eq(studios.code, code))
        .limit(1);
      if (!existing) return code;
    } else {
      const [existing] = await db
        .select({ code: studioInvites.code })
        .from(studioInvites)
        .where(eq(studioInvites.code, code))
        .limit(1);
      if (!existing) return code;
    }
  }
  throw new Error("No se pudo crear un código");
}

async function uniqueProfessionalAccountCode() {
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

async function uniqueClientAccountCode() {
  const db = getDb();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = createInviteCode("client");
    const [inAccounts] = await db
      .select({ userId: accounts.userId })
      .from(accounts)
      .where(eq(accounts.code, code))
      .limit(1);
    const [inInvites] = await db
      .select({ code: studioInvites.code })
      .from(studioInvites)
      .where(eq(studioInvites.code, code))
      .limit(1);
    if (!inAccounts && !inInvites) return code;
  }
  throw new Error("No se pudo crear un código");
}

function parsePhone(raw: string) {
  const phone = raw.trim();
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 6) throw new Error("Pon un teléfono válido.");
  return phone;
}

function parseOptionalPhone(raw: string, label: string) {
  const phone = raw.trim();
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 6) throw new Error(`Pon un ${label} válido.`);
  return phone;
}

function parseProfilePhoto(raw: string) {
  const value = raw.trim();
  if (!value) return "";
  if (!/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(value)) {
    throw new Error("La foto tiene que ser JPG, PNG o WebP.");
  }
  if (value.length > 180_000) {
    throw new Error("La foto es demasiado grande. Probá con otra más chica.");
  }
  return value;
}

function parseEmail(raw: string) {
  const email = raw.trim().toLowerCase();
  if (email.length > 120) throw new Error("El email es demasiado largo.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Pon un email válido.");
  }
  return email;
}

function parseBirthDate(raw: string) {
  const value = raw.trim();
  if (!value) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Pon una fecha de nacimiento válida.");
  }
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Pon una fecha de nacimiento válida.");
  }
  const year = date.getFullYear();
  const today = new Date();
  if (year < 1920 || date > today) {
    throw new Error("Pon una fecha de nacimiento válida.");
  }
  return value;
}

function parseOptionalYmd(raw: string, label: string) {
  const value = raw.trim();
  if (!value) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Pon una fecha válida en ${label}.`);
  }
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Pon una fecha válida en ${label}.`);
  }
  return value;
}

function parsePaymentStatus(raw: string): ClientPaymentStatus {
  if (
    raw === "current" ||
    raw === "overdue" ||
    raw === "paused" ||
    raw === "trial" ||
    raw === "comp"
  ) {
    return raw;
  }
  throw new Error("Elegí un estado de cuenta.");
}

function parseFeeAmount(raw: number | null | undefined) {
  if (raw === null || raw === undefined || Number.isNaN(raw)) return null;
  const n = Math.round(raw);
  if (n < 0) throw new Error("El monto no puede ser negativo.");
  if (n > 99_999_999) throw new Error("El monto es demasiado alto.");
  return n;
}

async function createTeacherAccount(input: {
  displayName: string;
  username: string;
  password: string;
}) {
  const username = parseUsername(input.username);
  const db = getDb();
  const [taken] = await db
    .select({ userId: accounts.userId })
    .from(accounts)
    .where(eq(accounts.username, username))
    .limit(1);
  if (taken) throw new Error("Ese usuario ya está en uso.");
  const userId = uid();
  const now = new Date();
  await db.insert(accounts).values({
    userId,
    role: "professional",
    name: input.displayName,
    username,
    passwordHash: await hashPassword(TEST_ACCOUNT_PASSWORD),
    code: await uniqueProfessionalAccountCode(),
    linkedProfessionalId: null,
    createdAt: now,
    updatedAt: now,
  });
  return { userId, username };
}

async function uniqueClientUsername(email: string) {
  const db = getDb();
  const base = usernameFromEmail(email);
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const username =
      attempt === 0 ? base : `${base.slice(0, 28)}${attempt + 1}`.slice(0, 32);
    const [taken] = await db
      .select({ userId: accounts.userId })
      .from(accounts)
      .where(eq(accounts.username, username))
      .limit(1);
    if (!taken) return username;
  }
  return `${base.slice(0, 16)}${uid().replace(/-/g, "").slice(0, 10)}`.slice(
    0,
    32
  );
}

async function createClientAccount(input: { displayName: string; email: string }) {
  const db = getDb();
  const [taken] = await db
    .select({ userId: accounts.userId })
    .from(accounts)
    .where(eq(accounts.email, input.email))
    .limit(1);
  if (taken) throw new Error("Ese email ya está en uso.");
  const userId = uid();
  const username = await uniqueClientUsername(input.email);
  const now = new Date();
  await db.insert(accounts).values({
    userId,
    role: "client",
    name: input.displayName,
    email: input.email,
    username,
    passwordHash: await hashPassword(TEST_ACCOUNT_PASSWORD),
    code: await uniqueClientAccountCode(),
    linkedProfessionalId: null,
    createdAt: now,
    updatedAt: now,
  });
  return { userId, username };
}

async function requireOwnedGym() {
  const userId = await requireUserId();
  const db = getDb();
  const [account] = await db
    .select({ role: accounts.role })
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .limit(1);
  if (account?.role !== "studio") {
    throw new Error("Solo el gimnasio puede hacer eso.");
  }
  const rows = await db
    .select()
    .from(studios)
    .where(eq(studios.ownerUserId, userId));
  return { userId, branches: rows.map(toStudio) };
}

async function upsertGymTeacher(input: {
  ownerUserId: string;
  userId: string;
  displayName: string;
  phone: string;
  sex?: Sex;
}) {
  const sex = input.sex ?? "other";
  await getDb()
    .insert(gymTeachers)
    .values({
      id: uid(),
      ownerUserId: input.ownerUserId,
      userId: input.userId,
      displayName: input.displayName,
      phone: input.phone,
      sex,
      createdAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [gymTeachers.ownerUserId, gymTeachers.userId],
      set: {
        displayName: input.displayName,
        phone: input.phone,
        ...(input.sex ? { sex: input.sex } : {}),
      },
    });
}

async function stripTeacherFromStudio(studioId: string, teacherUserId: string) {
  const db = getDb();
  await db
    .update(studioMemberships)
    .set({ assignedTeacherUserId: null })
    .where(
      and(
        eq(studioMemberships.studioId, studioId),
        eq(studioMemberships.assignedTeacherUserId, teacherUserId)
      )
    );
  await db
    .update(studioInvites)
    .set({ assignedTeacherUserId: null })
    .where(
      and(
        eq(studioInvites.studioId, studioId),
        eq(studioInvites.assignedTeacherUserId, teacherUserId)
      )
    );
  await db
    .delete(studioReservations)
    .where(
      and(
        eq(studioReservations.studioId, studioId),
        eq(studioReservations.teacherUserId, teacherUserId)
      )
    );
  await db
    .delete(studioTeacherShifts)
    .where(
      and(
        eq(studioTeacherShifts.studioId, studioId),
        eq(studioTeacherShifts.teacherUserId, teacherUserId)
      )
    );
  await db
    .delete(studioMemberships)
    .where(
      and(
        eq(studioMemberships.studioId, studioId),
        eq(studioMemberships.userId, teacherUserId),
        eq(studioMemberships.role, "teacher")
      )
    );
}

async function membershipsFor(userId: string) {
  return getDb()
    .select()
    .from(studioMemberships)
    .where(eq(studioMemberships.userId, userId));
}

async function membershipFor(
  userId: string,
  role?: StudioMemberRole
) {
  const rows = await membershipsFor(userId);
  if (role) return rows.find((item) => item.role === role) ?? null;
  return rows[0] ?? null;
}

async function teacherMembershipFor(userId: string, studioId: string) {
  const [row] = await getDb()
    .select()
    .from(studioMemberships)
    .where(
      and(
        eq(studioMemberships.userId, userId),
        eq(studioMemberships.studioId, studioId),
        eq(studioMemberships.role, "teacher")
      )
    )
    .limit(1);
  return row ?? null;
}

async function requireStudioOwner(studioId?: string) {
  const userId = await requireUserId();
  const db = getDb();
  if (studioId) {
    const [studio] = await db
      .select()
      .from(studios)
      .where(and(eq(studios.id, studioId), eq(studios.ownerUserId, userId)))
      .limit(1);
    if (!studio) throw new Error("No hay una sucursal a tu nombre.");
    return { userId, studio: toStudio(studio) };
  }
  const [studio] = await db
    .select()
    .from(studios)
    .where(eq(studios.ownerUserId, userId))
    .limit(1);
  if (!studio) throw new Error("No hay un gimnasio a tu nombre.");
  return { userId, studio: toStudio(studio) };
}

export type StudioBranchInput = {
  name: string;
  kinds: StudioKind[];
  address: string;
  phone: string;
  dayHours: StudioDayHours[];
  pilatesItems?: string[];
  gymMachines?: string[];
};

function stringIds(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((item): item is string => typeof item === "string"))];
}

function parseBranchInput(input: StudioBranchInput) {
  const name = input.name.trim();
  if (name.length < 2) throw new Error("Ponle un nombre a la sucursal.");
  const kinds = normalizeStudioKinds(input.kinds);
  if (!kinds.length) {
    throw new Error("Elige gimnasio, pilates o ambos.");
  }
  const dayHours = normalizeDayHours(input.dayHours, []);
  if (dayHours.length < 1) {
    throw new Error("Elige al menos un día abierto, con su franja.");
  }
  return {
    name,
    kinds,
    address: input.address.trim(),
    phone: input.phone.trim(),
    dayHours,
    pilatesItems: kinds.includes("pilates") ? stringIds(input.pilatesItems) : [],
    gymMachines: kinds.includes("gym") ? stringIds(input.gymMachines) : [],
  };
}

export type StudioBranchSummary = {
  studio: Studio;
  teacherCount: number;
  clientCount: number;
};

export async function listOwnedBranches(): Promise<StudioBranchSummary[]> {
  const userId = await requireUserId();
  const db = getDb();
  const rows = await db
    .select()
    .from(studios)
    .where(eq(studios.ownerUserId, userId))
    .orderBy(desc(studios.createdAt));
  const summaries: StudioBranchSummary[] = [];
  for (const row of rows) {
    const members = await db
      .select({
        role: studioMemberships.role,
        userId: studioMemberships.userId,
      })
      .from(studioMemberships)
      .where(eq(studioMemberships.studioId, row.id));
    const invites = await db
      .select({ role: studioInvites.role })
      .from(studioInvites)
      .where(
        and(eq(studioInvites.studioId, row.id), isNull(studioInvites.usedByUserId))
      );
    const teacherCount =
      members.filter((item) => item.role === "teacher").length +
      invites.filter((item) => item.role === "teacher").length;
    const clientCount =
      members.filter((item) => item.role === "client").length +
      invites.filter((item) => item.role === "client").length;
    summaries.push({
      studio: toStudio(row),
      teacherCount,
      clientCount,
    });
  }
  return summaries;
}

export type NextHourPerson = {
  userId: string;
  name: string;
  phone: string;
  /** Avisó que no asiste ese día (el cupo queda libre). */
  absent?: boolean;
};

export type NextHourTeacherGroup = NextHourPerson & {
  students: NextHourPerson[];
};

export type DayAgendaSlot = {
  slotStart: string;
  teachers: NextHourTeacherGroup[];
  unassignedStudents: NextHourPerson[];
};

export type DayAgenda = {
  weekday: number;
  openFrom: string | null;
  openTo: string | null;
  slots: DayAgendaSlot[];
};

function personFromMember(
  userId: string,
  members: Map<string, (typeof studioMemberships.$inferSelect)>,
  fallback: string
): NextHourPerson {
  const member = members.get(userId);
  return {
    userId,
    name: member?.displayName || fallback,
    phone: member?.phone ?? "",
  };
}

function attendanceForSlot(input: {
  weekday: number;
  slotStart: string;
  members: Map<string, (typeof studioMemberships.$inferSelect)>;
  shifts: (typeof studioTeacherShifts.$inferSelect)[];
  reservations: (typeof studioReservations.$inferSelect)[];
  absentClientIds: Set<string>;
}): Omit<DayAgendaSlot, "slotStart"> {
  const teacherIds = new Set<string>();
  for (const shift of input.shifts) {
    if (
      shift.weekday === input.weekday &&
      hourCovers(shift.startHour, shift.endHour, input.slotStart)
    ) {
      teacherIds.add(shift.teacherUserId);
    }
  }
  const slotReservations = input.reservations.filter(
    (item) => item.slotStart === input.slotStart
  );
  for (const row of slotReservations) {
    if (row.teacherUserId) teacherIds.add(row.teacherUserId);
  }
  const studentsByTeacher = new Map<string, NextHourPerson[]>();
  const unassignedStudents: NextHourPerson[] = [];
  for (const row of slotReservations) {
    const student: NextHourPerson = {
      ...personFromMember(row.clientUserId, input.members, "Alumno"),
      absent: input.absentClientIds.has(row.clientUserId),
    };
    if (!row.teacherUserId) {
      unassignedStudents.push(student);
      continue;
    }
    const list = studentsByTeacher.get(row.teacherUserId) ?? [];
    list.push(student);
    studentsByTeacher.set(row.teacherUserId, list);
  }
  const sortStudents = (list: NextHourPerson[]) =>
    list.sort((a, b) => {
      if (!!a.absent !== !!b.absent) return a.absent ? 1 : -1;
      return a.name.localeCompare(b.name, "es");
    });
  const teachers: NextHourTeacherGroup[] = [...teacherIds]
    .map((userId) => {
      const students = sortStudents(studentsByTeacher.get(userId) ?? []);
      return {
        ...personFromMember(userId, input.members, "Profesor"),
        students,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
  sortStudents(unassignedStudents);
  return { teachers, unassignedStudents };
}

export async function loadDayAgenda(
  studioId: string,
  weekday: number,
  dateYmd?: string
): Promise<DayAgenda> {
  const { studio } = await requireStudioOwner(studioId);
  const day = Math.round(weekday);
  if (day < 0 || day > 6) throw new Error("Ese día no es válido.");
  const hours = hoursForWeekday(studio.dayHours, day);
  const absentOn =
    dateYmd && /^\d{4}-\d{2}-\d{2}$/.test(dateYmd.trim())
      ? dateYmd.trim()
      : "";
  const db = getDb();
  const [members, shifts, reservations, absences] = await Promise.all([
    db
      .select()
      .from(studioMemberships)
      .where(eq(studioMemberships.studioId, studio.id)),
    db
      .select()
      .from(studioTeacherShifts)
      .where(eq(studioTeacherShifts.studioId, studio.id)),
    db
      .select()
      .from(studioReservations)
      .where(
        and(
          eq(studioReservations.studioId, studio.id),
          eq(studioReservations.weekday, day)
        )
      ),
    absentOn
      ? db
          .select({ clientUserId: studioAbsences.clientUserId })
          .from(studioAbsences)
          .where(
            and(
              eq(studioAbsences.studioId, studio.id),
              eq(studioAbsences.absentOn, absentOn)
            )
          )
      : Promise.resolve([] as { clientUserId: string }[]),
  ]);
  const memberById = new Map(members.map((item) => [item.userId, item]));
  const absentClientIds = new Set(absences.map((item) => item.clientUserId));
  const slots = hours
    ? hourSlots(hours.openFrom, hours.openTo).map((slotStart) => ({
        slotStart,
        ...attendanceForSlot({
          weekday: day,
          slotStart,
          members: memberById,
          shifts,
          reservations,
          absentClientIds,
        }),
      }))
    : [];
  return {
    weekday: day,
    openFrom: hours?.openFrom ?? null,
    openTo: hours?.openTo ?? null,
    slots,
  };
}

export type OwnedBranchQuota = {
  used: number;
  max: number;
  canAdd: boolean;
};

/** Cupo de sucursales del contrato del gimnasio logueado. */
export async function getOwnedBranchQuota(): Promise<OwnedBranchQuota> {
  const userId = await requireUserId();
  const db = getDb();
  const [account] = await db
    .select({
      role: accounts.role,
      maxBranches: accounts.maxBranches,
    })
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .limit(1);
  if (account?.role !== "studio") {
    throw new Error("Solo un gimnasio puede gestionar sucursales.");
  }
  const rows = await db
    .select({ id: studios.id })
    .from(studios)
    .where(eq(studios.ownerUserId, userId));
  const max = Math.max(1, account.maxBranches ?? 1);
  const used = rows.length;
  return { used, max, canAdd: used < max };
}

export async function createStudioBranch(input: StudioBranchInput) {
  const userId = await requireUserId();
  const parsed = parseBranchInput(input);
  const db = getDb();
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .limit(1);
  if (account?.role !== "studio") {
    throw new Error("Solo un gimnasio puede dar de alta sucursales.");
  }
  const existing = await db
    .select({ id: studios.id })
    .from(studios)
    .where(eq(studios.ownerUserId, userId));
  const maxBranches = Math.max(1, account.maxBranches ?? 1);
  if (existing.length >= maxBranches) {
    throw new Error(
      `Tu contrato permite hasta ${maxBranches} sucursal${
        maxBranches === 1 ? "" : "es"
      }. Pedile a Enforma ampliar el plan.`
    );
  }
  const now = new Date();
  const id = uid();
  const row = {
    id,
    ownerUserId: userId,
    name: parsed.name,
    kinds: parsed.kinds,
    kind: primaryKind(parsed.kinds),
    code: await uniquePrefixedCode("studio"),
    pilatesItems: parsed.pilatesItems,
    gymMachines: parsed.gymMachines,
    dayHours: parsed.dayHours,
    address: parsed.address,
    phone: parsed.phone,
    ...mirroredHours(parsed.dayHours),
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(studios).values(row);
  const [ownerMember] = await db
    .select({ id: studioMemberships.id })
    .from(studioMemberships)
    .where(eq(studioMemberships.userId, userId))
    .limit(1);
  if (!ownerMember) {
    await db.insert(studioMemberships).values({
      id: uid(),
      studioId: id,
      userId,
      role: "owner",
      displayName: parsed.name,
      createdAt: now,
    });
  }
  return toStudio(row);
}

export async function saveStudioBranch(
  studioId: string,
  input: StudioBranchInput
) {
  const { studio } = await requireStudioOwner(studioId);
  const parsed = parseBranchInput(input);
  await getDb()
    .update(studios)
    .set({
      name: parsed.name,
      kinds: parsed.kinds,
      kind: primaryKind(parsed.kinds),
      address: parsed.address,
      phone: parsed.phone,
      dayHours: parsed.dayHours,
      pilatesItems: parsed.pilatesItems,
      gymMachines: parsed.gymMachines,
      ...mirroredHours(parsed.dayHours),
      updatedAt: new Date(),
    })
    .where(eq(studios.id, studio.id));
  return loadStudioDashboard(studio.id);
}

export async function deleteStudioBranch(studioId: string) {
  const { studio } = await requireStudioOwner(studioId);
  const db = getDb();
  await db
    .delete(studioReservations)
    .where(eq(studioReservations.studioId, studio.id));
  await db
    .delete(studioTeacherShifts)
    .where(eq(studioTeacherShifts.studioId, studio.id));
  await db
    .delete(studioInvites)
    .where(eq(studioInvites.studioId, studio.id));
  await db
    .delete(studioMemberships)
    .where(eq(studioMemberships.studioId, studio.id));
  await db.delete(studios).where(eq(studios.id, studio.id));
}

export async function loadMyStudio(): Promise<{
  studio: Studio;
  role: StudioMemberRole;
  branchNames: string[];
} | null> {
  const userId = await requireUserId();
  const members = await membershipsFor(userId);
  if (!members.length) {
    const [owned] = await getDb()
      .select()
      .from(studios)
      .where(eq(studios.ownerUserId, userId))
      .limit(1);
    if (!owned) return null;
    return {
      studio: toStudio(owned),
      role: "owner",
      branchNames: [owned.name],
    };
  }
  const studioIds = [...new Set(members.map((item) => item.studioId))];
  const rows = await getDb()
    .select()
    .from(studios)
    .where(inArray(studios.id, studioIds));
  const first = rows.find((item) => item.id === members[0].studioId) ?? rows[0];
  if (!first) return null;
  return {
    studio: toStudio(first),
    role: members[0].role,
    branchNames: rows.map((item) => item.name),
  };
}

export async function saveStudioEquipment(
  studioId: string,
  input: {
    pilatesItems: string[];
    gymMachines: string[];
  }
) {
  const { studio } = await requireStudioOwner(studioId);
  await getDb()
    .update(studios)
    .set({
      pilatesItems: input.pilatesItems,
      gymMachines: input.gymMachines,
      updatedAt: new Date(),
    })
    .where(eq(studios.id, studio.id));
  return loadStudioDashboard(studio.id);
}

export type StudioPerson = {
  userId: string | null;
  displayName: string;
  phone: string;
  email: string;
  username: string;
  birthDate: string;
  emergencyName: string;
  emergencyPhone: string;
  activities: StudioKind[];
  role: StudioMemberRole | StudioInviteRole;
  sessionsPerWeek: number | null;
  assignedTeacherUserId: string | null;
  assignedTeacherName: string | null;
  active: boolean;
  hasPlan: boolean;
  planName: string;
  feeAmount: number | null;
  serviceEndsOn: string;
  lastPaidOn: string;
  code?: string;
  pending: boolean;
};

export type StudioShift = {
  id: string;
  teacherUserId: string;
  weekday: number;
  startHour: string;
  endHour: string;
  capacityPerSlot: number;
};

export type StudioSlotTeacher = {
  userId: string;
  name: string;
  taken: number;
  capacity: number;
};

export type StudioSlotView = {
  weekday: number;
  slotStart: string;
  taken: number;
  capacity: number;
  gymTaken: number;
  gymCapacity: number;
  pilatesTaken: number;
  pilatesCapacity: number;
  teachers: StudioSlotTeacher[];
};

export type StudioReservationView = {
  id: string;
  clientUserId: string;
  clientName: string;
  weekday: number;
  slotStart: string;
  teacherUserId: string | null;
  teacherName: string | null;
};

export type StudioDashboard = {
  studio: Studio;
  people: StudioPerson[];
  shifts: StudioShift[];
  occupancy: StudioSlotView[];
  reservations: StudioReservationView[];
};

export async function loadStudioDashboard(
  studioId: string
): Promise<StudioDashboard> {
  const { studio } = await requireStudioOwner(studioId);
  return loadStudioBundle(studio);
}

async function loadStudioBundle(studio: Studio): Promise<StudioDashboard> {
  const db = getDb();
  const members = await db
    .select()
    .from(studioMemberships)
    .where(eq(studioMemberships.studioId, studio.id));
  const invites = await db
    .select()
    .from(studioInvites)
    .where(
      and(eq(studioInvites.studioId, studio.id), isNull(studioInvites.usedByUserId))
    );
  const shifts = await db
    .select()
    .from(studioTeacherShifts)
    .where(eq(studioTeacherShifts.studioId, studio.id));
  const reservations = await db
    .select()
    .from(studioReservations)
    .where(eq(studioReservations.studioId, studio.id));

  const nameById = new Map(
    members.map((item) => [item.userId, item.displayName] as const)
  );
  const teacherMembers = members.filter((item) => item.role === "teacher");
  const teacherIds = teacherMembers.map((item) => item.userId);
  const rosterRows = teacherIds.length
    ? await db
        .select({
          userId: gymTeachers.userId,
          active: gymTeachers.active,
        })
        .from(gymTeachers)
        .where(
          and(
            eq(gymTeachers.ownerUserId, studio.ownerUserId),
            inArray(gymTeachers.userId, teacherIds)
          )
        )
    : [];
  const activeByTeacher = new Map(
    rosterRows.map((item) => [item.userId, item.active] as const)
  );
  const teachers = teacherMembers.filter(
    (item) => activeByTeacher.get(item.userId) !== false
  );
  const teacherNameById = new Map(
    teacherMembers.map((item) => [item.userId, item.displayName] as const)
  );

  const memberIds = members.map((item) => item.userId);
  const usernameById = new Map<string, string>();
  if (memberIds.length) {
    const accountRows = await db
      .select({
        userId: accounts.userId,
        username: accounts.username,
      })
      .from(accounts)
      .where(inArray(accounts.userId, memberIds));
    for (const row of accountRows) {
      usernameById.set(row.userId, row.username ?? "");
    }
  }

  const clientMemberIds = members
    .filter((item) => item.role === "client")
    .map((item) => item.userId);
  const clientStates = clientMemberIds.length
    ? await db
        .select({ userId: userStates.userId, payload: userStates.payload })
        .from(userStates)
        .where(inArray(userStates.userId, clientMemberIds))
    : [];
  const planByUser = new Map(
    clientStates.map(
      (row) => [row.userId, hasPlanFromPayload(row.payload)] as const
    )
  );

  const people: StudioPerson[] = [
    ...members
      .filter((item) => item.role !== "owner")
      .map((item) => ({
        userId: item.userId,
        displayName: item.displayName,
        phone: item.phone ?? "",
        email: item.email ?? "",
        username: usernameById.get(item.userId) ?? "",
        birthDate: item.birthDate ?? "",
        emergencyName:
          item.role === "client" ? (item.emergencyName ?? "") : "",
        emergencyPhone:
          item.role === "client" ? (item.emergencyPhone ?? "") : "",
        activities: memberActivities(item.activities, studio.kinds),
        role: item.role,
        sessionsPerWeek: item.sessionsPerWeek,
        assignedTeacherUserId: item.assignedTeacherUserId ?? null,
        assignedTeacherName: item.assignedTeacherUserId
          ? (teacherNameById.get(item.assignedTeacherUserId) ?? null)
          : null,
        active:
          item.role === "teacher"
            ? activeByTeacher.get(item.userId) !== false
            : true,
        hasPlan:
          item.role === "client"
            ? (planByUser.get(item.userId) ?? false)
            : false,
        planName: item.role === "client" ? (item.planName ?? "") : "",
        feeAmount: item.role === "client" ? (item.feeAmount ?? null) : null,
        serviceEndsOn:
          item.role === "client" ? (item.serviceEndsOn ?? "") : "",
        lastPaidOn: item.role === "client" ? (item.lastPaidOn ?? "") : "",
        pending: false,
      })),
    ...invites.map((item) => ({
      userId: null as string | null,
      displayName: item.displayName,
      phone: item.phone ?? "",
      email: "",
      username: "",
      birthDate: "",
      emergencyName: "",
      emergencyPhone: "",
      activities: memberActivities(null, studio.kinds),
      role: item.role,
      sessionsPerWeek: item.sessionsPerWeek,
      assignedTeacherUserId: item.assignedTeacherUserId ?? null,
      assignedTeacherName: item.assignedTeacherUserId
        ? (teacherNameById.get(item.assignedTeacherUserId) ?? null)
        : null,
      active: true,
      hasPlan: false,
      planName: "",
      feeAmount: null as number | null,
      serviceEndsOn: "",
      lastPaidOn: "",
      code: item.code,
      pending: true,
    })),
  ];

  const occupancy = buildOccupancy(
    studio,
    shifts,
    reservations,
    teachers.map((item) => ({
      userId: item.userId,
      displayName: item.displayName,
    })),
    new Map(
      members
        .filter((item) => item.role === "client")
        .map(
          (item) =>
            [item.userId, memberActivities(item.activities, studio.kinds)] as const
        )
    )
  );

  return {
    studio,
    people,
    shifts: shifts.map((item) => ({
      id: item.id,
      teacherUserId: item.teacherUserId,
      weekday: item.weekday,
      startHour: item.startHour,
      endHour: item.endHour,
      capacityPerSlot: normalizeCupo(item.capacityPerSlot) ?? 8,
    })),
    occupancy,
    reservations: reservations.map((item) => ({
      id: item.id,
      clientUserId: item.clientUserId,
      clientName: nameById.get(item.clientUserId) ?? "Cliente",
      weekday: item.weekday,
      slotStart: item.slotStart,
      teacherUserId: item.teacherUserId,
      teacherName: item.teacherUserId
        ? (nameById.get(item.teacherUserId) ?? null)
        : null,
    })),
  };
}

function buildOccupancy(
  studio: Studio,
  shifts: (typeof studioTeacherShifts.$inferSelect)[],
  reservations: (typeof studioReservations.$inferSelect)[],
  teachers: { userId: string; displayName: string }[],
  activitiesByClient: Map<string, StudioKind[]>
): StudioSlotView[] {
  const occupancy: StudioSlotView[] = [];
  const gymCapacity = (day: StudioDayHours) =>
    studioHasKind(studio.kinds, "gym") ? dayKindCapacity(day, "gym") : 0;
  const pilatesCapacity = (day: StudioDayHours) =>
    studioHasKind(studio.kinds, "pilates")
      ? dayKindCapacity(day, "pilates")
      : 0;
  for (const day of studio.dayHours) {
    for (const slotStart of hourSlots(day.openFrom, day.openTo)) {
      const coveringShifts = shifts.filter(
        (shift) =>
          shift.weekday === day.weekday &&
          hourCovers(shift.startHour, shift.endHour, slotStart)
      );
      const coveringTeachers: StudioSlotTeacher[] = [];
      for (const shift of coveringShifts) {
        const teacher = teachers.find(
          (item) => item.userId === shift.teacherUserId
        );
        if (!teacher) continue;
        const capacity = normalizeCupo(shift.capacityPerSlot) ?? 0;
        const taken = reservations.filter(
          (item) =>
            item.teacherUserId === shift.teacherUserId &&
            item.weekday === day.weekday &&
            item.slotStart === slotStart
        ).length;
        coveringTeachers.push({
          userId: teacher.userId,
          name: teacher.displayName,
          taken,
          capacity,
        });
      }
      const slotReservations = reservations.filter(
        (item) => item.weekday === day.weekday && item.slotStart === slotStart
      );
      let gymTaken = 0;
      let pilatesTaken = 0;
      for (const item of slotReservations) {
        const activities =
          activitiesByClient.get(item.clientUserId) ?? studio.kinds;
        if (activities.includes("gym")) gymTaken += 1;
        if (activities.includes("pilates")) pilatesTaken += 1;
      }
      const gymCap = gymCapacity(day);
      const pilatesCap = pilatesCapacity(day);
      occupancy.push({
        weekday: day.weekday,
        slotStart,
        taken: slotReservations.length,
        capacity: gymCap || pilatesCap || studio.capacityPerSlot,
        gymTaken,
        gymCapacity: gymCap,
        pilatesTaken,
        pilatesCapacity: pilatesCap,
        teachers: coveringTeachers,
      });
    }
  }
  return occupancy;
}

function reservationRowsForPicks(input: {
  studio: Studio;
  occupancy: StudioSlotView[];
  existing: { clientUserId: string; weekday: number; slotStart: string }[];
  clientUserId: string;
  teacherId: string;
  allowed: number;
  activities: StudioKind[];
  picks: { weekday: number; slotStart: string }[];
  requireExact?: boolean;
}) {
  const picks = input.picks;
  if (input.requireExact && picks.length !== input.allowed) {
    throw new Error(
      input.allowed === 1
        ? "Elegí el día y horario por defecto."
        : `Elegí ${input.allowed} días y horarios por defecto.`
    );
  }
  if (picks.length > input.allowed) {
    throw new Error(`Te tocan ${input.allowed} veces por semana.`);
  }
  const days = new Set(picks.map((item) => item.weekday));
  if (days.size !== picks.length) {
    throw new Error("Un turno por día.");
  }

  return picks.map((pick) => {
    const day = hoursForWeekday(input.studio.dayHours, pick.weekday);
    if (!day) {
      throw new Error("Ese día el gimnasio está cerrado.");
    }
    if (!hourSlots(day.openFrom, day.openTo).includes(pick.slotStart)) {
      throw new Error("Esa hora no está en la franja de ese día.");
    }
    const cell = input.occupancy.find(
      (item) => item.weekday === pick.weekday && item.slotStart === pick.slotStart
    );
    if (!cell?.teachers.length) {
      throw new Error(
        `No hay profesor en ese horario (${pick.slotStart}).`
      );
    }
    const mineHere = input.existing.some(
      (item) =>
        item.clientUserId === input.clientUserId &&
        item.weekday === pick.weekday &&
        item.slotStart === pick.slotStart
    );
    const counts = cell
      ? occupancyForActivities(cell, input.activities, {
          inDb: mineHere,
          selected: true,
        })
      : { full: true, display: "" };
    if (counts.full && !mineHere) {
      throw new Error(`Sin cupo a las ${pick.slotStart}.`);
    }
    return {
      id: uid(),
      studioId: input.studio.id,
      clientUserId: input.clientUserId,
      weekday: pick.weekday,
      slotStart: pick.slotStart,
      teacherUserId: input.teacherId,
      createdAt: new Date(),
    };
  });
}

export async function createStudioInvite(input: {
  studioId: string;
  role: StudioInviteRole;
  displayName: string;
  sessionsPerWeek?: number;
  teacherUserId?: string;
}) {
  const { studio } = await requireStudioOwner(input.studioId);
  const displayName = input.displayName.trim();
  if (displayName.length < 2) throw new Error("Pon el nombre de la persona.");
  let sessionsPerWeek = input.sessionsPerWeek ?? null;
  let assignedTeacherUserId: string | null = null;
  if (input.role === "client") {
    const n = Math.round(sessionsPerWeek ?? 0);
    if (n < 1 || n > 6) throw new Error("Las veces por semana van de 1 a 6.");
    sessionsPerWeek = n;
    assignedTeacherUserId = await requireStudioTeacher(
      studio.id,
      input.teacherUserId
    );
  } else {
    sessionsPerWeek = null;
  }
  const code = await uniquePrefixedCode(input.role);
  await getDb().insert(studioInvites).values({
    code,
    studioId: studio.id,
    role: input.role,
    sessionsPerWeek,
    assignedTeacherUserId,
    displayName,
    createdAt: new Date(),
  });
  const dashboard = await loadStudioDashboard(studio.id);
  return { code, ...dashboard };
}

function parseBillingPlan(raw: string): ClientBillingPlan {
  const plan = parseClientBillingPlan(raw);
  if (!plan) throw new Error("Elegí un plan de pago: mensual, trimestral o anual.");
  return plan;
}

export async function createStudioClient(input: {
  studioId: string;
  displayName: string;
  phone: string;
  email: string;
  birthDate?: string;
  activities: StudioKind[];
  sessionsPerWeek: number;
  teacherUserId: string;
  picks: { weekday: number; slotStart: string }[];
  billingPlan: ClientBillingPlan;
  serviceStartsOn: string;
  feeAmount: number;
}) {
  const { studio } = await requireStudioOwner(input.studioId);
  const displayName = input.displayName.trim();
  if (displayName.length < 2) throw new Error("Pon el nombre del alumno.");
  const phone = parsePhone(input.phone);
  const email = parseEmail(input.email);
  const birthDate = parseBirthDate(input.birthDate ?? "");
  const activities = resolveClientActivities(input.activities, studio.kinds);
  const sessionsPerWeek = Math.round(input.sessionsPerWeek);
  if (sessionsPerWeek < 1 || sessionsPerWeek > 6) {
    throw new Error("Las veces por semana van de 1 a 6.");
  }
  const billingPlan = parseBillingPlan(input.billingPlan);
  const feeAmount = parseFeeAmount(input.feeAmount);
  if (feeAmount === null || feeAmount <= 0) {
    throw new Error("Pon el valor del plan de pago.");
  }
  const serviceStartsOn = parseOptionalYmd(
    input.serviceStartsOn,
    "día de inicio"
  );
  if (!serviceStartsOn) throw new Error("Pon el día de inicio del plan.");
  const serviceEndsOn = serviceEndsFromStart(serviceStartsOn, billingPlan);
  const teacherUserId = await requireStudioTeacher(
    studio.id,
    input.teacherUserId
  );
  const bundle = await loadStudioBundle(studio);
  const pendingId = "__new__";
  const reservationRows = reservationRowsForPicks({
    studio,
    occupancy: bundle.occupancy,
    existing: bundle.reservations,
    clientUserId: pendingId,
    teacherId: teacherUserId,
    allowed: sessionsPerWeek,
    activities,
    picks: input.picks,
    requireExact: true,
  });
  const { userId } = await createClientAccount({ displayName, email });
  await getDb().insert(studioMemberships).values({
    id: uid(),
    studioId: studio.id,
    userId,
    role: "client",
    sessionsPerWeek,
    assignedTeacherUserId: teacherUserId,
    displayName,
    phone,
    email,
    birthDate,
    activities,
    paymentStatus: "current",
    planName: billingPlan,
    feeAmount,
    lastPaidOn: serviceStartsOn,
    serviceEndsOn,
    createdAt: new Date(),
  });
  await recordStudioPayment({
    studioId: studio.id,
    clientUserId: userId,
    amount: feeAmount,
    paidOn: serviceStartsOn,
    planName: billingPlan,
    note: "Alta",
  });
  if (reservationRows.length) {
    await getDb().insert(studioReservations).values(
      reservationRows.map((row) => ({
        ...row,
        clientUserId: userId,
      }))
    );
  }
  return loadStudioDashboard(studio.id);
}

export async function updateStudioClient(input: {
  studioId: string;
  clientUserId: string;
  displayName: string;
  phone: string;
  email: string;
  birthDate?: string;
  activities: StudioKind[];
  sessionsPerWeek: number;
  teacherUserId: string;
  picks: { weekday: number; slotStart: string }[];
}) {
  const { studio } = await requireStudioOwner(input.studioId);
  const clientUserId = input.clientUserId.trim();
  const displayName = input.displayName.trim();
  if (displayName.length < 2) throw new Error("Pon el nombre del alumno.");
  const phone = parsePhone(input.phone);
  const email = parseEmail(input.email);
  const birthDate = parseBirthDate(input.birthDate ?? "");
  const activities = resolveClientActivities(input.activities, studio.kinds);
  const sessionsPerWeek = Math.round(input.sessionsPerWeek);
  if (sessionsPerWeek < 1 || sessionsPerWeek > 6) {
    throw new Error("Las veces por semana van de 1 a 6.");
  }
  const teacherUserId = await requireStudioTeacher(
    studio.id,
    input.teacherUserId
  );
  const db = getDb();
  const [member] = await db
    .select()
    .from(studioMemberships)
    .where(
      and(
        eq(studioMemberships.studioId, studio.id),
        eq(studioMemberships.userId, clientUserId),
        eq(studioMemberships.role, "client")
      )
    )
    .limit(1);
  if (!member) throw new Error("Ese alumno no está en esta sucursal.");
  const [emailTaken] = await db
    .select({ userId: accounts.userId })
    .from(accounts)
    .where(and(eq(accounts.email, email), ne(accounts.userId, clientUserId)))
    .limit(1);
  if (emailTaken) throw new Error("Ese email ya está en uso.");
  const bundle = await loadStudioBundle(studio);
  const reservationRows = reservationRowsForPicks({
    studio,
    occupancy: bundle.occupancy,
    existing: bundle.reservations,
    clientUserId,
    teacherId: teacherUserId,
    allowed: sessionsPerWeek,
    activities,
    picks: input.picks,
    requireExact: true,
  });
  await db
    .update(studioMemberships)
    .set({
      displayName,
      phone,
      email,
      birthDate,
      activities,
      sessionsPerWeek,
      assignedTeacherUserId: teacherUserId,
    })
    .where(eq(studioMemberships.id, member.id));
  const [currentAccount] = await db
    .select({ username: accounts.username })
    .from(accounts)
    .where(eq(accounts.userId, clientUserId))
    .limit(1);
  await db
    .update(accounts)
    .set({
      name: displayName,
      email,
      username: currentAccount?.username || (await uniqueClientUsername(email)),
      updatedAt: new Date(),
    })
    .where(eq(accounts.userId, clientUserId));
  await db
    .delete(studioReservations)
    .where(
      and(
        eq(studioReservations.studioId, studio.id),
        eq(studioReservations.clientUserId, clientUserId)
      )
    );
  if (reservationRows.length) {
    await db.insert(studioReservations).values(reservationRows);
  }
  return loadStudioDashboard(studio.id);
}

export async function deleteStudioClient(input: {
  studioId: string;
  clientUserId?: string | null;
  inviteCode?: string;
}) {
  const { studio } = await requireStudioOwner(input.studioId);
  const db = getDb();
  if (input.inviteCode) {
    await db
      .delete(studioInvites)
      .where(
        and(
          eq(studioInvites.studioId, studio.id),
          eq(studioInvites.code, input.inviteCode),
          eq(studioInvites.role, "client"),
          isNull(studioInvites.usedByUserId)
        )
      );
    return loadStudioDashboard(studio.id);
  }
  const clientUserId = input.clientUserId?.trim() ?? "";
  if (!clientUserId) throw new Error("Falta el alumno.");
  const [member] = await db
    .select()
    .from(studioMemberships)
    .where(
      and(
        eq(studioMemberships.studioId, studio.id),
        eq(studioMemberships.userId, clientUserId),
        eq(studioMemberships.role, "client")
      )
    )
    .limit(1);
  if (!member) throw new Error("Ese alumno no está en esta sucursal.");
  await db
    .delete(studioReservations)
    .where(
      and(
        eq(studioReservations.studioId, studio.id),
        eq(studioReservations.clientUserId, clientUserId)
      )
    );
  await db
    .delete(studioMemberships)
    .where(eq(studioMemberships.id, member.id));
  if (clientUserId !== "demo-client") {
    const remaining = await db
      .select({ id: studioMemberships.id })
      .from(studioMemberships)
      .where(eq(studioMemberships.userId, clientUserId))
      .limit(1);
    if (!remaining.length) {
      await db
        .delete(userStates)
        .where(eq(userStates.userId, clientUserId));
      await db
        .delete(coachRequests)
        .where(eq(coachRequests.clientUserId, clientUserId));
      await db
        .delete(accounts)
        .where(
          and(eq(accounts.userId, clientUserId), eq(accounts.role, "client"))
        );
    }
  }
  return loadStudioDashboard(studio.id);
}

export type GymClientSummary = {
  userId: string;
  displayName: string;
  phone: string;
  email: string;
  username: string;
  birthDate: string;
  emergencyName: string;
  emergencyPhone: string;
  activities: StudioKind[];
  sessionsPerWeek: number | null;
  studioId: string;
  studioName: string;
  assignedTeacherUserId: string | null;
  teacherName: string | null;
  hasPlan: boolean;
  planName: string;
  feeAmount: number | null;
  serviceEndsOn: string;
  lastPaidOn: string;
  reservations: { weekday: number; slotStart: string }[];
};

function hasPlanFromPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") return false;
  const obj = payload as { state?: AppState };
  const state =
    obj.state?.profile && obj.state.plan
      ? obj.state
      : (payload as AppState).profile && (payload as AppState).plan
        ? (payload as AppState)
        : null;
  return planHasExercises(state);
}

export async function listGymClients(): Promise<GymClientSummary[]> {
  const { branches } = await requireOwnedGym();
  if (!branches.length) return [];
  const studioIds = branches.map((item) => item.id);
  const db = getDb();
  const members = await db
    .select()
    .from(studioMemberships)
    .where(
      and(
        inArray(studioMemberships.studioId, studioIds),
        eq(studioMemberships.role, "client")
      )
    );
  if (!members.length) return [];
  const teachers = await db
    .select()
    .from(studioMemberships)
    .where(
      and(
        inArray(studioMemberships.studioId, studioIds),
        eq(studioMemberships.role, "teacher")
      )
    );
  const reservations = await db
    .select()
    .from(studioReservations)
    .where(
      and(
        inArray(studioReservations.studioId, studioIds),
        inArray(
          studioReservations.clientUserId,
          members.map((item) => item.userId)
        )
      )
    );
  const teacherNameByKey = new Map(
    teachers.map(
      (item) => [`${item.studioId}:${item.userId}`, item.displayName] as const
    )
  );
  const studioNameById = new Map(branches.map((item) => [item.id, item.name]));
  const accountRows = await db
    .select({
      userId: accounts.userId,
      username: accounts.username,
    })
    .from(accounts)
    .where(inArray(accounts.userId, members.map((item) => item.userId)));
  const usernameById = new Map(
    accountRows.map((item) => [item.userId, item.username ?? ""] as const)
  );
  const clientIds = [...new Set(members.map((item) => item.userId))];
  const states = await db
    .select({ userId: userStates.userId, payload: userStates.payload })
    .from(userStates)
    .where(inArray(userStates.userId, clientIds));
  const planByUser = new Map(
    states.map((row) => [row.userId, hasPlanFromPayload(row.payload)] as const)
  );
  return members
    .map((item) => ({
      userId: item.userId,
      displayName: item.displayName,
      phone: item.phone ?? "",
      email: item.email ?? "",
      username: usernameById.get(item.userId) ?? "",
      birthDate: item.birthDate ?? "",
      emergencyName: item.emergencyName ?? "",
      emergencyPhone: item.emergencyPhone ?? "",
      activities: memberActivities(
        item.activities,
        branches.find((branch) => branch.id === item.studioId)?.kinds ?? ["gym"]
      ),
      sessionsPerWeek: item.sessionsPerWeek,
      studioId: item.studioId,
      studioName: studioNameById.get(item.studioId) ?? "Sucursal",
      assignedTeacherUserId: item.assignedTeacherUserId ?? null,
      teacherName: item.assignedTeacherUserId
        ? (teacherNameByKey.get(
            `${item.studioId}:${item.assignedTeacherUserId}`
          ) ?? null)
        : null,
      hasPlan: planByUser.get(item.userId) ?? false,
      planName: item.planName ?? "",
      feeAmount: item.feeAmount ?? null,
      serviceEndsOn: item.serviceEndsOn ?? "",
      lastPaidOn: item.lastPaidOn ?? "",
      reservations: reservations
        .filter(
          (row) =>
            row.studioId === item.studioId && row.clientUserId === item.userId
        )
        .map((row) => ({ weekday: row.weekday, slotStart: row.slotStart }))
        .sort(
          (a, b) =>
            a.weekday - b.weekday || a.slotStart.localeCompare(b.slotStart)
        ),
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "es"));
}

export type GymClientAccount = {
  userId: string;
  displayName: string;
  email: string;
  phone: string;
  studioId: string;
  studioName: string;
  teacherName: string | null;
  paymentStatus: ClientPaymentStatus;
  serviceEndsOn: string;
  lastPaidOn: string;
  planName: string;
  feeAmount: number | null;
  billingNotes: string;
  alert: ClientAccountAlert;
};

export async function listGymClientAccounts(): Promise<GymClientAccount[]> {
  const { branches } = await requireOwnedGym();
  if (!branches.length) return [];
  const studioIds = branches.map((item) => item.id);
  const db = getDb();
  const members = await db
    .select()
    .from(studioMemberships)
    .where(
      and(
        inArray(studioMemberships.studioId, studioIds),
        eq(studioMemberships.role, "client")
      )
    );
  if (!members.length) return [];
  const teachers = await db
    .select()
    .from(studioMemberships)
    .where(
      and(
        inArray(studioMemberships.studioId, studioIds),
        eq(studioMemberships.role, "teacher")
      )
    );
  const teacherNameByKey = new Map(
    teachers.map(
      (item) => [`${item.studioId}:${item.userId}`, item.displayName] as const
    )
  );
  const studioNameById = new Map(branches.map((item) => [item.id, item.name]));
  return members
    .map((item) => {
      const paymentStatus =
        item.paymentStatus === "current" ||
        item.paymentStatus === "overdue" ||
        item.paymentStatus === "paused" ||
        item.paymentStatus === "trial" ||
        item.paymentStatus === "comp"
          ? item.paymentStatus
          : ("current" as const);
      const serviceEndsOn = item.serviceEndsOn ?? "";
      return {
        userId: item.userId,
        displayName: item.displayName,
        email: item.email ?? "",
        phone: item.phone ?? "",
        studioId: item.studioId,
        studioName: studioNameById.get(item.studioId) ?? "Sucursal",
        teacherName: item.assignedTeacherUserId
          ? (teacherNameByKey.get(
              `${item.studioId}:${item.assignedTeacherUserId}`
            ) ?? null)
          : null,
        paymentStatus,
        serviceEndsOn,
        lastPaidOn: item.lastPaidOn ?? "",
        planName: item.planName ?? "",
        feeAmount: item.feeAmount ?? null,
        billingNotes: item.billingNotes ?? "",
        alert: clientAccountAlert(paymentStatus, serviceEndsOn),
      };
    })
    .sort((a, b) => {
      const rank = (row: GymClientAccount) => {
        if (row.paymentStatus === "overdue" || row.alert === "expired") return 0;
        if (row.alert === "due_soon") return 1;
        if (row.paymentStatus === "paused") return 2;
        return 3;
      };
      return (
        rank(a) - rank(b) ||
        a.displayName.localeCompare(b.displayName, "es")
      );
    });
}

async function loadOwnedClientMember(studioId: string, clientUserId: string) {
  const { studio } = await requireStudioOwner(studioId);
  const [member] = await getDb()
    .select()
    .from(studioMemberships)
    .where(
      and(
        eq(studioMemberships.studioId, studio.id),
        eq(studioMemberships.userId, clientUserId.trim()),
        eq(studioMemberships.role, "client")
      )
    )
    .limit(1);
  if (!member) throw new Error("Ese alumno no está en esta sucursal.");
  return { studio, member };
}

async function recordStudioPayment(input: {
  studioId: string;
  clientUserId: string;
  amount: number;
  paidOn: string;
  planName?: string;
  note?: string;
}) {
  if (!input.amount || input.amount <= 0) return;
  const paidOn = parseOptionalYmd(input.paidOn, "pago");
  if (!paidOn) return;
  await getDb().insert(studioPayments).values({
    id: uid(),
    studioId: input.studioId,
    clientUserId: input.clientUserId,
    amount: Math.round(input.amount),
    paidOn,
    planName: (input.planName ?? "").trim().slice(0, 80),
    note: (input.note ?? "").trim().slice(0, 200),
    createdAt: new Date(),
  });
}

export async function updateGymClientAccount(input: {
  studioId: string;
  clientUserId: string;
  paymentStatus: ClientPaymentStatus;
  serviceEndsOn: string;
  lastPaidOn: string;
  planName: string;
  feeAmount: number | null;
  billingNotes: string;
}) {
  const { studio, member } = await loadOwnedClientMember(
    input.studioId,
    input.clientUserId
  );
  const paymentStatus = parsePaymentStatus(input.paymentStatus);
  const serviceEndsOn = parseOptionalYmd(input.serviceEndsOn, "vencimiento");
  const lastPaidOn = parseOptionalYmd(input.lastPaidOn, "último pago");
  const planName = input.planName.trim().slice(0, 80);
  const feeAmount = parseFeeAmount(input.feeAmount);
  const billingNotes = input.billingNotes.trim().slice(0, 500);
  await getDb()
    .update(studioMemberships)
    .set({
      paymentStatus,
      serviceEndsOn,
      lastPaidOn,
      planName,
      feeAmount,
      billingNotes,
    })
    .where(eq(studioMemberships.id, member.id));
  const rows = await listGymClientAccounts();
  return rows.find(
    (item) => item.userId === member.userId && item.studioId === studio.id
  )!;
}

/** Marca el plan como pagado y corre el vencimiento según mensual/trimestral/anual. */
export async function markGymClientPaid(input: {
  studioId: string;
  clientUserId: string;
}) {
  const { studio, member } = await loadOwnedClientMember(
    input.studioId,
    input.clientUserId
  );
  const plan =
    parseClientBillingPlan(member.planName) ??
    ("monthly" as ClientBillingPlan);
  const renewed = renewBillingPeriod({
    serviceEndsOn: member.serviceEndsOn ?? "",
    plan,
  });
  const amount = member.feeAmount ?? 0;
  await getDb()
    .update(studioMemberships)
    .set({
      paymentStatus: renewed.paymentStatus,
      lastPaidOn: renewed.lastPaidOn,
      serviceEndsOn: renewed.serviceEndsOn,
      planName: plan,
    })
    .where(eq(studioMemberships.id, member.id));
  await recordStudioPayment({
    studioId: studio.id,
    clientUserId: member.userId,
    amount,
    paidOn: renewed.lastPaidOn,
    planName: plan,
    note: "Renovación",
  });
  const rows = await listGymClientAccounts();
  return rows.find(
    (item) => item.userId === member.userId && item.studioId === studio.id
  )!;
}

/**
 * Rellena planes y fechas de ejemplo.
 * La primera vez (sin notas "Simulado") marca varios vencidos este mes.
 * Después solo completa alumnos nuevos sin plan.
 * El estudio hema (demo) no recibe datos simulados.
 */
export async function seedGymClientBillingSamples(force = false) {
  const { userId, branches } = await requireOwnedGym();
  if (userId === "demo-studio-hema") return { updated: 0 };
  if (!branches.length) return { updated: 0 };
  const studioIds = branches.map((item) => item.id);
  const db = getDb();
  const members = await db
    .select()
    .from(studioMemberships)
    .where(
      and(
        inArray(studioMemberships.studioId, studioIds),
        eq(studioMemberships.role, "client")
      )
    );
  if (!members.length) return { updated: 0 };
  const today = todayBillingYmd();
  const anySimulated = members.some((item) =>
    (item.billingNotes ?? "").startsWith("Simulado")
  );
  const applyAll = force || !anySimulated;
  const samples: {
    plan: ClientBillingPlan;
    fee: number;
    lastPaidOn: string;
    serviceEndsOn: string;
    paymentStatus: ClientPaymentStatus;
    notes: string;
  }[] = [
    {
      plan: "monthly",
      fee: 45_000,
      lastPaidOn: shiftYmd(today, -40),
      serviceEndsOn: shiftYmd(today, -8),
      paymentStatus: "overdue",
      notes: "Simulado: vencido este mes",
    },
    {
      plan: "monthly",
      fee: 45_000,
      lastPaidOn: shiftYmd(today, -35),
      serviceEndsOn: shiftYmd(today, -2),
      paymentStatus: "overdue",
      notes: "Simulado: vencido hace pocos días",
    },
    {
      plan: "monthly",
      fee: 48_000,
      lastPaidOn: shiftYmd(today, -27),
      serviceEndsOn: shiftYmd(today, 3),
      paymentStatus: "current",
      notes: "Simulado: por vencer",
    },
    {
      plan: "quarterly",
      fee: 120_000,
      lastPaidOn: shiftYmd(today, -50),
      serviceEndsOn: shiftYmd(today, 40),
      paymentStatus: "current",
      notes: "Simulado: trimestral al día",
    },
    {
      plan: "annual",
      fee: 420_000,
      lastPaidOn: shiftYmd(today, -120),
      serviceEndsOn: shiftYmd(today, 245),
      paymentStatus: "current",
      notes: "Simulado: anual al día",
    },
  ];

  let updated = 0;
  const refreshed = applyAll
    ? members
    : await db
        .select()
        .from(studioMemberships)
        .where(
          and(
            inArray(studioMemberships.studioId, studioIds),
            eq(studioMemberships.role, "client")
          )
        );
  for (let i = 0; i < members.length; i += 1) {
    const member = members[i]!;
    const hasBilling =
      Boolean(member.planName?.trim()) || Boolean(member.serviceEndsOn?.trim());
    if (!applyAll && hasBilling) continue;
    const sample = samples[i % samples.length]!;
    await db
      .update(studioMemberships)
      .set({
        planName: sample.plan,
        feeAmount: sample.fee,
        lastPaidOn: sample.lastPaidOn,
        serviceEndsOn: sample.serviceEndsOn,
        paymentStatus: sample.paymentStatus,
        billingNotes: sample.notes,
      })
      .where(eq(studioMemberships.id, member.id));
    updated += 1;
  }

  const [paymentCount] = await db
    .select({ id: studioPayments.id })
    .from(studioPayments)
    .where(inArray(studioPayments.studioId, studioIds))
    .limit(1);
  if (!paymentCount || applyAll) {
    if (applyAll) {
      // Evita duplicar cobros simulados al forzar de nuevo.
      const simulated = await db
        .select({ id: studioPayments.id })
        .from(studioPayments)
        .where(
          and(
            inArray(studioPayments.studioId, studioIds),
            eq(studioPayments.note, "Simulado")
          )
        );
      for (const row of simulated) {
        await db.delete(studioPayments).where(eq(studioPayments.id, row.id));
      }
    }
    const latestMembers =
      updated > 0
        ? await db
            .select()
            .from(studioMemberships)
            .where(
              and(
                inArray(studioMemberships.studioId, studioIds),
                eq(studioMemberships.role, "client")
              )
            )
        : refreshed;
    for (let i = 0; i < latestMembers.length; i += 1) {
      const member = latestMembers[i]!;
      if (!member.feeAmount || !member.lastPaidOn) continue;
      const plan =
        parseClientBillingPlan(member.planName) ??
        ("monthly" as ClientBillingPlan);
      const paymentDates = [member.lastPaidOn];
      if (plan === "monthly") {
        paymentDates.push(shiftYmd(member.lastPaidOn, -31));
        paymentDates.push(shiftYmd(member.lastPaidOn, -62));
      } else if (plan === "quarterly") {
        paymentDates.push(shiftYmd(member.lastPaidOn, -90));
      }
      for (const paidOn of paymentDates) {
        await recordStudioPayment({
          studioId: member.studioId,
          clientUserId: member.userId,
          amount: member.feeAmount,
          paidOn,
          planName: plan,
          note: "Simulado",
        });
      }
    }
  }
  return { updated };
}

function monthKeyFromYmd(ymd: string) {
  return ymd.slice(0, 7);
}

function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  const date = new Date(y, m - 1, 1);
  return new Intl.DateTimeFormat("es-AR", {
    month: "short",
    year: "numeric",
  }).format(date);
}

/** Claves YYYY-MM de los últimos n meses, el más actual primero. */
function lastNMonthKeys(n: number) {
  const keys: string[] = [];
  const now = new Date();
  for (let i = 0; i < n; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    keys.push(`${y}-${m}`);
  }
  return keys;
}

export type GymRevenueMonth = {
  key: string;
  label: string;
  total: number;
  payments: number;
  /** Alumnos con alta hasta el cierre de ese mes. */
  clients: number;
};

export type GymRevenueStats = {
  studioId: string | null;
  months: GymRevenueMonth[];
  total: number;
  paymentCount: number;
  clientCount: number;
  branches: { id: string; name: string }[];
  pendingTotal: number;
};

/** Ingresos por mes a partir de los cobros registrados, filtrable por sucursal. */
export async function loadGymRevenueStats(
  studioId?: string | null
): Promise<GymRevenueStats> {
  const { branches } = await requireOwnedGym();
  const branchList = branches.map((item) => ({
    id: item.id,
    name: item.name,
  }));
  if (!branchList.length) {
    return {
      studioId: null,
      months: [],
      total: 0,
      paymentCount: 0,
      clientCount: 0,
      branches: [],
      pendingTotal: 0,
    };
  }
  const selected =
    studioId && branchList.some((item) => item.id === studioId)
      ? studioId
      : null;
  const studioIds = selected
    ? [selected]
    : branchList.map((item) => item.id);
  const db = getDb();
  const rows = await db
    .select({
      amount: studioPayments.amount,
      paidOn: studioPayments.paidOn,
    })
    .from(studioPayments)
    .where(inArray(studioPayments.studioId, studioIds));

  let paymentRows = rows;

  const members = await db
    .select()
    .from(studioMemberships)
    .where(
      and(
        inArray(studioMemberships.studioId, studioIds),
        eq(studioMemberships.role, "client")
      )
    );

  // Si no hay cobros todavía, arma uno por alumno con fee + lastPaidOn.
  if (!paymentRows.length) {
    for (const member of members) {
      if (!member.feeAmount || !member.lastPaidOn) continue;
      await recordStudioPayment({
        studioId: member.studioId,
        clientUserId: member.userId,
        amount: member.feeAmount,
        paidOn: member.lastPaidOn,
        planName: member.planName ?? "",
        note: "Importado",
      });
    }
    paymentRows = await db
      .select({
        amount: studioPayments.amount,
        paidOn: studioPayments.paidOn,
      })
      .from(studioPayments)
      .where(inArray(studioPayments.studioId, studioIds));
  }

  const keys = lastNMonthKeys(12);
  const byMonth = new Map(keys.map((key) => [key, { total: 0, payments: 0 }]));
  let total = 0;
  let paymentCount = 0;
  for (const row of paymentRows) {
    const key = monthKeyFromYmd(row.paidOn);
    const bucket = byMonth.get(key);
    if (!bucket) continue;
    bucket.total += row.amount;
    bucket.payments += 1;
    total += row.amount;
    paymentCount += 1;
  }

  const today = todayBillingYmd();
  const thisMonthKey = today.slice(0, 7);
  const monthEnd = (() => {
    const [y, m] = thisMonthKey.split("-").map(Number);
    const last = new Date(y!, m!, 0);
    return `${y}-${String(m).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
  })();

  const pendingTotal = members.reduce((sum, member) => {
    if (member.paymentStatus === "paused" || member.paymentStatus === "comp") {
      return sum;
    }
    const ends = (member.serviceEndsOn ?? "").trim();
    const pending =
      member.paymentStatus === "overdue" ||
      (Boolean(ends) &&
        (ends < today ||
          (ends >= `${thisMonthKey}-01` && ends <= monthEnd)));
    if (!pending) return sum;
    return sum + (member.feeAmount ?? 0);
  }, 0);

  return {
    studioId: selected,
    months: keys.map((key) => {
      const bucket = byMonth.get(key)!;
      const [y, m] = key.split("-").map(Number);
      const monthClose = new Date(y!, m!, 0, 23, 59, 59, 999);
      const clients = members.filter(
        (member) => member.createdAt.getTime() <= monthClose.getTime()
      ).length;
      return {
        key,
        label: monthLabel(key),
        total: bucket.total,
        payments: bucket.payments,
        clients,
      };
    }),
    total,
    paymentCount,
    clientCount: members.length,
    branches: branchList,
    pendingTotal,
  };
}

export async function createStudioTeacher(input: {
  studioId: string;
  displayName: string;
  phone: string;
  username: string;
  password: string;
  sex: Sex;
}) {
  const { studio } = await requireStudioOwner(input.studioId);
  const displayName = input.displayName.trim();
  if (displayName.length < 2) throw new Error("Pon el nombre del profesor.");
  const phone = parsePhone(input.phone);
  const sex = parseTeacherSex(input.sex);
  const { userId } = await createTeacherAccount({
    displayName,
    username: input.username,
    password: input.password,
  });
  await getDb().insert(studioMemberships).values({
    id: uid(),
    studioId: studio.id,
    userId,
    role: "teacher",
    displayName,
    phone,
    createdAt: new Date(),
  });
  await upsertGymTeacher({
    ownerUserId: studio.ownerUserId,
    userId,
    displayName,
    phone,
    sex,
  });
  return loadStudioDashboard(studio.id);
}

export type GymTeacherSummary = {
  userId: string;
  displayName: string;
  phone: string;
  username: string;
  sex: Sex;
  active: boolean;
  branches: { studioId: string; name: string }[];
};

export type GymTeacherBranch = {
  studioId: string;
  name: string;
  dayHours: StudioDayHours[];
  shifts: TeacherShiftInput[];
};

export type GymTeacherClient = {
  userId: string;
  displayName: string;
  email: string;
  studioId: string;
  studioName: string;
  assignedTeacherUserId: string | null;
  assignedTeacherName: string | null;
};

export type GymTeacherDetail = {
  userId: string;
  displayName: string;
  phone: string;
  username: string;
  sex: Sex;
  active: boolean;
  assigned: GymTeacherBranch[];
  available: { studioId: string; name: string; dayHours: StudioDayHours[] }[];
  clients: GymTeacherClient[];
};

async function teacherMembersInBranches(branchIds: string[]) {
  if (!branchIds.length) return [];
  return getDb()
    .select()
    .from(studioMemberships)
    .where(
      and(
        inArray(studioMemberships.studioId, branchIds),
        eq(studioMemberships.role, "teacher")
      )
    );
}

async function loadGymTeacherDetail(
  ownerUserId: string,
  branches: Studio[],
  teacherUserId: string
): Promise<GymTeacherDetail> {
  const db = getDb();
  const [roster] = await db
    .select()
    .from(gymTeachers)
    .where(
      and(
        eq(gymTeachers.ownerUserId, ownerUserId),
        eq(gymTeachers.userId, teacherUserId)
      )
    )
    .limit(1);
  const teacherMembers = await teacherMembersInBranches(
    branches.map((item) => item.id)
  );
  const members = teacherMembers.filter((item) => item.userId === teacherUserId);
  if (!roster && !members.length) {
    throw new Error("Ese profesor no está en el gimnasio.");
  }
  const displayName = roster?.displayName || members[0]?.displayName || "Profesor";
  const phone = roster?.phone || members[0]?.phone || "";
  if (!roster) {
    await upsertGymTeacher({
      ownerUserId,
      userId: teacherUserId,
      displayName,
      phone,
    });
  }
  const assignedIds = new Set(members.map((item) => item.studioId));
  const shifts = assignedIds.size
    ? await db
        .select()
        .from(studioTeacherShifts)
        .where(
          and(
            eq(studioTeacherShifts.teacherUserId, teacherUserId),
            inArray(studioTeacherShifts.studioId, [...assignedIds])
          )
        )
    : [];
  const assigned = branches
    .filter((branch) => assignedIds.has(branch.id))
    .map((branch) => ({
      studioId: branch.id,
      name: branch.name,
      dayHours: branch.dayHours,
      shifts: shifts
        .filter((item) => item.studioId === branch.id)
        .map((item) => ({
          weekday: item.weekday,
          startHour: item.startHour,
          endHour: item.endHour,
          capacityPerSlot: item.capacityPerSlot,
        })),
    }));
  const available = branches
    .filter((branch) => !assignedIds.has(branch.id))
    .map((branch) => ({
      studioId: branch.id,
      name: branch.name,
      dayHours: branch.dayHours,
    }));
  const [account] = await db
    .select({ username: accounts.username })
    .from(accounts)
    .where(eq(accounts.userId, teacherUserId))
    .limit(1);
  const teacherNameByKey = new Map(
    teacherMembers.map(
      (item) => [`${item.studioId}:${item.userId}`, item.displayName] as const
    )
  );
  const studioNameById = new Map(branches.map((item) => [item.id, item.name]));
  const clientRows = assignedIds.size
    ? await db
        .select()
        .from(studioMemberships)
        .where(
          and(
            inArray(studioMemberships.studioId, [...assignedIds]),
            eq(studioMemberships.role, "client")
          )
        )
    : [];
  const clients: GymTeacherClient[] = clientRows
    .map((item) => ({
      userId: item.userId,
      displayName: item.displayName,
      email: item.email ?? "",
      studioId: item.studioId,
      studioName: studioNameById.get(item.studioId) ?? "Sucursal",
      assignedTeacherUserId: item.assignedTeacherUserId ?? null,
      assignedTeacherName: item.assignedTeacherUserId
        ? (teacherNameByKey.get(
            `${item.studioId}:${item.assignedTeacherUserId}`
          ) ?? null)
        : null,
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "es"));
  return {
    userId: teacherUserId,
    displayName,
    phone,
    username: account?.username ?? "",
    sex: roster?.sex ?? "other",
    active: roster?.active ?? true,
    assigned,
    available,
    clients,
  };
}

export async function listGymTeachers(): Promise<GymTeacherSummary[]> {
  const { userId, branches } = await requireOwnedGym();
  const db = getDb();
  const roster = await db
    .select()
    .from(gymTeachers)
    .where(eq(gymTeachers.ownerUserId, userId));
  const members = await teacherMembersInBranches(branches.map((item) => item.id));
  const known = new Set(roster.map((item) => item.userId));
  for (const member of members) {
    if (known.has(member.userId)) continue;
    await upsertGymTeacher({
      ownerUserId: userId,
      userId: member.userId,
      displayName: member.displayName,
      phone: member.phone ?? "",
    });
    known.add(member.userId);
  }
  const rows =
    roster.length === known.size
      ? roster
      : await db
          .select()
          .from(gymTeachers)
          .where(eq(gymTeachers.ownerUserId, userId));
  const nameByBranch = new Map(branches.map((item) => [item.id, item.name]));
  const branchesByTeacher = new Map<string, { studioId: string; name: string }[]>();
  for (const member of members) {
    const name = nameByBranch.get(member.studioId);
    if (!name) continue;
    const current = branchesByTeacher.get(member.userId) ?? [];
    if (!current.some((item) => item.studioId === member.studioId)) {
      current.push({ studioId: member.studioId, name });
    }
    branchesByTeacher.set(member.userId, current);
  }
  const teacherIds = rows.map((item) => item.userId);
  const accountRows = teacherIds.length
    ? await db
        .select({ userId: accounts.userId, username: accounts.username })
        .from(accounts)
        .where(inArray(accounts.userId, teacherIds))
    : [];
  const usernameById = new Map(
    accountRows.map((item) => [item.userId, item.username ?? ""])
  );
  return rows
    .map((item) => ({
      userId: item.userId,
      displayName: item.displayName,
      phone: item.phone ?? "",
      username: usernameById.get(item.userId) ?? "",
      sex: item.sex ?? "other",
      active: item.active ?? true,
      branches: branchesByTeacher.get(item.userId) ?? [],
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "es"));
}

export async function loadGymTeacher(teacherUserId: string) {
  const { userId, branches } = await requireOwnedGym();
  return loadGymTeacherDetail(userId, branches, teacherUserId.trim());
}

function parseTeacherSex(raw: string | undefined): Sex {
  if (raw === "female" || raw === "male" || raw === "other") return raw;
  throw new Error("Elegí el género del profesor.");
}

export async function createGymTeacher(input: {
  displayName: string;
  phone: string;
  username: string;
  password: string;
  sex: Sex;
}) {
  const { userId: ownerUserId, branches } = await requireOwnedGym();
  const displayName = input.displayName.trim();
  if (displayName.length < 2) throw new Error("Pon el nombre del profesor.");
  const phone = parsePhone(input.phone);
  const sex = parseTeacherSex(input.sex);
  const { userId: teacherUserId } = await createTeacherAccount({
    displayName,
    username: input.username,
    password: input.password,
  });
  await upsertGymTeacher({
    ownerUserId,
    userId: teacherUserId,
    displayName,
    phone,
    sex,
  });
  return loadGymTeacherDetail(ownerUserId, branches, teacherUserId);
}

export async function updateGymTeacher(input: {
  teacherUserId: string;
  displayName?: string;
  phone?: string;
  sex?: Sex;
}) {
  const { userId: ownerUserId, branches } = await requireOwnedGym();
  const detail = await loadGymTeacherDetail(
    ownerUserId,
    branches,
    input.teacherUserId.trim()
  );
  const displayName =
    input.displayName !== undefined
      ? input.displayName.trim()
      : detail.displayName;
  if (displayName.length < 2) throw new Error("Pon el nombre del profesor.");
  const phone =
    input.phone !== undefined ? parsePhone(input.phone) : detail.phone;
  const sex =
    input.sex !== undefined ? parseTeacherSex(input.sex) : detail.sex;
  await upsertGymTeacher({
    ownerUserId,
    userId: detail.userId,
    displayName,
    phone,
    sex,
  });
  return loadGymTeacherDetail(ownerUserId, branches, detail.userId);
}

export async function assignGymTeacher(input: {
  teacherUserId: string;
  studioId: string;
  shifts: TeacherShiftInput[];
}) {
  const { userId, branches } = await requireOwnedGym();
  const teacherUserId = input.teacherUserId.trim();
  const studio = branches.find((item) => item.id === input.studioId);
  if (!studio) throw new Error("Esa sucursal no es de este gimnasio.");
  const detail = await loadGymTeacherDetail(userId, branches, teacherUserId);
  if (detail.assigned.some((item) => item.studioId === studio.id)) {
    throw new Error("Ese profesor ya está en esta sucursal.");
  }
  await getDb().insert(studioMemberships).values({
    id: uid(),
    studioId: studio.id,
    userId: teacherUserId,
    role: "teacher",
    displayName: detail.displayName,
    phone: detail.phone,
    createdAt: new Date(),
  });
  await persistTeacherShifts(studio, teacherUserId, input.shifts);
  return loadGymTeacherDetail(userId, branches, teacherUserId);
}

export async function unassignGymTeacher(input: {
  teacherUserId: string;
  studioId: string;
}) {
  const { userId, branches } = await requireOwnedGym();
  const teacherUserId = input.teacherUserId.trim();
  const studio = branches.find((item) => item.id === input.studioId);
  if (!studio) throw new Error("Esa sucursal no es de este gimnasio.");
  await loadGymTeacherDetail(userId, branches, teacherUserId);
  await stripTeacherFromStudio(studio.id, teacherUserId);
  return loadGymTeacherDetail(userId, branches, teacherUserId);
}

export async function saveGymTeacherShifts(input: {
  teacherUserId: string;
  studioId: string;
  shifts: TeacherShiftInput[];
}) {
  const { userId, branches } = await requireOwnedGym();
  const teacherUserId = input.teacherUserId.trim();
  const studio = branches.find((item) => item.id === input.studioId);
  if (!studio) throw new Error("Esa sucursal no es de este gimnasio.");
  const detail = await loadGymTeacherDetail(userId, branches, teacherUserId);
  if (!detail.assigned.some((item) => item.studioId === studio.id)) {
    throw new Error("Ese profesor no está en esa sucursal.");
  }
  await persistTeacherShifts(studio, teacherUserId, input.shifts);
  return loadGymTeacherDetail(userId, branches, teacherUserId);
}

export async function deleteGymTeacher(teacherUserId: string) {
  const { userId, branches } = await requireOwnedGym();
  const id = teacherUserId.trim();
  await loadGymTeacherDetail(userId, branches, id);
  for (const branch of branches) {
    await stripTeacherFromStudio(branch.id, id);
  }
  await getDb()
    .delete(gymTeachers)
    .where(and(eq(gymTeachers.ownerUserId, userId), eq(gymTeachers.userId, id)));
}

export type AssignableTeacher = {
  userId: string;
  displayName: string;
  phone: string;
  branchNames: string[];
};

export async function listAssignableTeachers(
  studioId: string
): Promise<AssignableTeacher[]> {
  const { userId, studio } = await requireStudioOwner(studioId);
  const db = getDb();
  const branches = await db
    .select()
    .from(studios)
    .where(eq(studios.ownerUserId, userId));
  const branchIds = branches.map((item) => item.id);
  if (!branchIds.length) return [];
  const roster = await db
    .select()
    .from(gymTeachers)
    .where(eq(gymTeachers.ownerUserId, userId));
  const members = await db
    .select()
    .from(studioMemberships)
    .where(
      and(
        inArray(studioMemberships.studioId, branchIds),
        eq(studioMemberships.role, "teacher")
      )
    );
  const here = new Set(
    members
      .filter((item) => item.studioId === studio.id)
      .map((item) => item.userId)
  );
  const nameByBranch = new Map(branches.map((item) => [item.id, item.name]));
  const byUser = new Map<string, AssignableTeacher>();
  for (const teacher of roster) {
    if (here.has(teacher.userId)) continue;
    byUser.set(teacher.userId, {
      userId: teacher.userId,
      displayName: teacher.displayName,
      phone: teacher.phone ?? "",
      branchNames: [],
    });
  }
  for (const member of members) {
    if (here.has(member.userId)) continue;
    const branchName = nameByBranch.get(member.studioId) ?? "";
    const current = byUser.get(member.userId);
    if (current) {
      if (branchName && !current.branchNames.includes(branchName)) {
        current.branchNames.push(branchName);
      }
    } else {
      byUser.set(member.userId, {
        userId: member.userId,
        displayName: member.displayName,
        phone: member.phone ?? "",
        branchNames: branchName ? [branchName] : [],
      });
    }
  }
  return [...byUser.values()].sort((a, b) =>
    a.displayName.localeCompare(b.displayName, "es")
  );
}

export async function assignTeacherToBranch(input: {
  studioId: string;
  teacherUserId: string;
}) {
  const { userId, studio } = await requireStudioOwner(input.studioId);
  const teacherUserId = input.teacherUserId.trim();
  if (!teacherUserId) throw new Error("Elige un profesor.");
  const already = await teacherMembershipFor(teacherUserId, studio.id);
  if (already) throw new Error("Ese profesor ya está en esta sucursal.");
  const db = getDb();
  const branches = await db
    .select({ id: studios.id })
    .from(studios)
    .where(eq(studios.ownerUserId, userId));
  const [source] = await db
    .select()
    .from(studioMemberships)
    .where(
      and(
        eq(studioMemberships.userId, teacherUserId),
        eq(studioMemberships.role, "teacher"),
        inArray(
          studioMemberships.studioId,
          branches.map((item) => item.id)
        )
      )
    )
    .limit(1);
  const [roster] = await db
    .select()
    .from(gymTeachers)
    .where(
      and(
        eq(gymTeachers.ownerUserId, userId),
        eq(gymTeachers.userId, teacherUserId)
      )
    )
    .limit(1);
  const displayName = source?.displayName || roster?.displayName || "";
  const phone = source?.phone || roster?.phone || "";
  if (!displayName) {
    throw new Error("Ese profesor no es de este gimnasio.");
  }
  await db.insert(studioMemberships).values({
    id: uid(),
    studioId: studio.id,
    userId: teacherUserId,
    role: "teacher",
    displayName,
    phone,
    createdAt: new Date(),
  });
  await upsertGymTeacher({
    ownerUserId: userId,
    userId: teacherUserId,
    displayName,
    phone,
  });
  return loadStudioDashboard(studio.id);
}

export async function unassignTeacherFromBranch(input: {
  studioId: string;
  teacherUserId: string;
}) {
  const { studio } = await requireStudioOwner(input.studioId);
  const teacherUserId = input.teacherUserId.trim();
  if (!teacherUserId) throw new Error("Elegí un profesor.");
  const already = await teacherMembershipFor(teacherUserId, studio.id);
  if (!already) throw new Error("Ese profesor no está en esta sucursal.");
  await stripTeacherFromStudio(studio.id, teacherUserId);
  return loadStudioDashboard(studio.id);
}

async function requireStudioTeacher(studioId: string, teacherUserId?: string) {
  const id = teacherUserId?.trim() ?? "";
  if (!id) throw new Error("Asigna un profesor al alumno.");
  const db = getDb();
  const [teacher] = await db
    .select()
    .from(studioMemberships)
    .where(
      and(
        eq(studioMemberships.studioId, studioId),
        eq(studioMemberships.userId, id),
        eq(studioMemberships.role, "teacher")
      )
    )
    .limit(1);
  if (!teacher) throw new Error("Ese profesor no está en el gimnasio.");
  const [studio] = await db
    .select({ ownerUserId: studios.ownerUserId })
    .from(studios)
    .where(eq(studios.id, studioId))
    .limit(1);
  if (studio?.ownerUserId) {
    const [roster] = await db
      .select({ active: gymTeachers.active })
      .from(gymTeachers)
      .where(
        and(
          eq(gymTeachers.ownerUserId, studio.ownerUserId),
          eq(gymTeachers.userId, id)
        )
      )
      .limit(1);
    if (roster && !roster.active) {
      throw new Error("Ese profesor está desactivado.");
    }
  }
  return teacher.userId;
}

export async function setGymTeacherActive(input: {
  teacherUserId: string;
  active: boolean;
}) {
  const { userId, branches } = await requireOwnedGym();
  const teacherUserId = input.teacherUserId.trim();
  await loadGymTeacherDetail(userId, branches, teacherUserId);
  await getDb()
    .update(gymTeachers)
    .set({ active: input.active })
    .where(
      and(
        eq(gymTeachers.ownerUserId, userId),
        eq(gymTeachers.userId, teacherUserId)
      )
    );
  return loadGymTeacherDetail(userId, branches, teacherUserId);
}

export async function assignStudioClient(input: {
  studioId: string;
  clientUserId?: string | null;
  inviteCode?: string;
  teacherUserId: string;
}) {
  const { studio } = await requireStudioOwner(input.studioId);
  const teacherUserId = await requireStudioTeacher(
    studio.id,
    input.teacherUserId
  );
  const db = getDb();

  if (input.inviteCode) {
    const [invite] = await db
      .select()
      .from(studioInvites)
      .where(
        and(
          eq(studioInvites.studioId, studio.id),
          eq(studioInvites.code, input.inviteCode),
          eq(studioInvites.role, "client")
        )
      )
      .limit(1);
    if (!invite || invite.usedByUserId) {
      throw new Error("Esa invitación ya no está.");
    }
    await db
      .update(studioInvites)
      .set({ assignedTeacherUserId: teacherUserId })
      .where(eq(studioInvites.code, invite.code));
    return loadStudioDashboard(studio.id);
  }

  const clientUserId = input.clientUserId?.trim() ?? "";
  if (!clientUserId) throw new Error("Falta el alumno.");
  const [client] = await db
    .select()
    .from(studioMemberships)
    .where(
      and(
        eq(studioMemberships.studioId, studio.id),
        eq(studioMemberships.userId, clientUserId),
        eq(studioMemberships.role, "client")
      )
    )
    .limit(1);
  if (!client) throw new Error("Ese alumno no está en el gimnasio.");

  const teacherChanged = client.assignedTeacherUserId !== teacherUserId;
  await db
    .update(studioMemberships)
    .set({ assignedTeacherUserId: teacherUserId })
    .where(eq(studioMemberships.id, client.id));
  if (teacherChanged) {
    await db
      .delete(studioReservations)
      .where(
        and(
          eq(studioReservations.studioId, studio.id),
          eq(studioReservations.clientUserId, clientUserId)
        )
      );
  }
  return loadStudioDashboard(studio.id);
}

export async function unassignStudioClient(input: {
  studioId: string;
  clientUserId?: string | null;
  inviteCode?: string;
}) {
  const { studio } = await requireStudioOwner(input.studioId);
  const db = getDb();

  if (input.inviteCode) {
    const [invite] = await db
      .select()
      .from(studioInvites)
      .where(
        and(
          eq(studioInvites.studioId, studio.id),
          eq(studioInvites.code, input.inviteCode),
          eq(studioInvites.role, "client")
        )
      )
      .limit(1);
    if (!invite || invite.usedByUserId) {
      throw new Error("Esa invitación ya no está.");
    }
    await db
      .update(studioInvites)
      .set({ assignedTeacherUserId: null })
      .where(eq(studioInvites.code, invite.code));
    return loadStudioDashboard(studio.id);
  }

  const clientUserId = input.clientUserId?.trim() ?? "";
  if (!clientUserId) throw new Error("Falta el alumno.");
  const [client] = await db
    .select()
    .from(studioMemberships)
    .where(
      and(
        eq(studioMemberships.studioId, studio.id),
        eq(studioMemberships.userId, clientUserId),
        eq(studioMemberships.role, "client")
      )
    )
    .limit(1);
  if (!client) throw new Error("Ese alumno no está en el gimnasio.");

  await db
    .update(studioMemberships)
    .set({ assignedTeacherUserId: null })
    .where(eq(studioMemberships.id, client.id));
  await db
    .delete(studioReservations)
    .where(
      and(
        eq(studioReservations.studioId, studio.id),
        eq(studioReservations.clientUserId, clientUserId)
      )
    );
  return loadStudioDashboard(studio.id);
}

export type TeacherShiftInput = {
  weekday: number;
  startHour: string;
  endHour: string;
  capacityPerSlot?: number;
};

async function persistTeacherShifts(
  studio: Studio,
  teacherUserId: string,
  shifts: TeacherShiftInput[]
) {
  const rows = shifts.map((shift) => {
    const day = hoursForWeekday(studio.dayHours, shift.weekday);
    if (!day) {
      throw new Error("Ese día el gimnasio está cerrado.");
    }
    const studioSlots = hourSlots(day.openFrom, day.openTo);
    const shiftSlots = hourSlots(shift.startHour, shift.endHour);
    if (!shiftSlots.length) {
      throw new Error("Revisa la franja del profesor.");
    }
    if (shiftSlots.some((slot) => !studioSlots.includes(slot))) {
      throw new Error(
        "El horario del profesor tiene que estar dentro de la apertura de ese día."
      );
    }
    return {
      id: uid(),
      studioId: studio.id,
      teacherUserId,
      weekday: shift.weekday,
      startHour: shift.startHour,
      endHour: shift.endHour,
      capacityPerSlot: 8,
    };
  });

  const db = getDb();
  await db
    .delete(studioTeacherShifts)
    .where(
      and(
        eq(studioTeacherShifts.studioId, studio.id),
        eq(studioTeacherShifts.teacherUserId, teacherUserId)
      )
    );
  if (rows.length) {
    await db.insert(studioTeacherShifts).values(rows);
  }
}

export async function saveTeacherShifts(
  studioId: string,
  teacherUserId: string,
  shifts: TeacherShiftInput[]
) {
  const { studio } = await requireStudioOwner(studioId);
  const [teacher] = await getDb()
    .select()
    .from(studioMemberships)
    .where(
      and(
        eq(studioMemberships.studioId, studio.id),
        eq(studioMemberships.userId, teacherUserId),
        eq(studioMemberships.role, "teacher")
      )
    )
    .limit(1);
  if (!teacher) throw new Error("Ese profesor no está en el gimnasio.");
  const proposed = normalizeProposedShifts(studio, shifts);
  await assertNoOrphanStudentSlots(studio.id, teacherUserId, proposed);
  await persistTeacherShifts(studio, teacherUserId, proposed);
  await cancelPendingShiftRequests(studio.id, teacherUserId);
  return loadStudioDashboard(studio.id);
}

function normalizeProposedShifts(
  studio: Studio,
  shifts: TeacherShiftInput[]
): ProposedTeacherShift[] {
  return shifts.map((shift) => {
    const day = hoursForWeekday(studio.dayHours, shift.weekday);
    if (!day) {
      throw new Error("Ese día el gimnasio está cerrado.");
    }
    const studioSlots = hourSlots(day.openFrom, day.openTo);
    const shiftSlots = hourSlots(shift.startHour, shift.endHour);
    if (!shiftSlots.length) {
      throw new Error("Revisa la franja del profesor.");
    }
    if (shiftSlots.some((slot) => !studioSlots.includes(slot))) {
      throw new Error(
        "El horario del profesor tiene que estar dentro de la apertura de ese día."
      );
    }
    return {
      weekday: shift.weekday,
      startHour: shift.startHour,
      endHour: shift.endHour,
      capacityPerSlot: 8,
    };
  });
}

function slotKeysFromShifts(
  shifts: { weekday: number; startHour: string; endHour: string }[]
) {
  const keys = new Set<string>();
  for (const shift of shifts) {
    for (const slotStart of hourSlots(shift.startHour, shift.endHour)) {
      keys.add(`${shift.weekday}|${slotStart}`);
    }
  }
  return keys;
}

function formatSlotKey(key: string) {
  const [weekdayRaw, slotStart] = key.split("|");
  const weekday = Number(weekdayRaw);
  const day =
    WEEKDAYS.find((item) => item.id === weekday)?.full ?? `Día ${weekday}`;
  return `${day} ${slotStart}`;
}

/**
 * Bloquea un cambio que deja franjas con alumnos anotados y sin ningún
 * otro profesor cubriéndolas.
 */
async function assertNoOrphanStudentSlots(
  studioId: string,
  teacherUserId: string,
  proposedShifts: ProposedTeacherShift[]
) {
  const db = getDb();
  const [currentShifts, otherShifts, reservations] = await Promise.all([
    db
      .select()
      .from(studioTeacherShifts)
      .where(
        and(
          eq(studioTeacherShifts.studioId, studioId),
          eq(studioTeacherShifts.teacherUserId, teacherUserId)
        )
      ),
    db
      .select()
      .from(studioTeacherShifts)
      .where(
        and(
          eq(studioTeacherShifts.studioId, studioId),
          ne(studioTeacherShifts.teacherUserId, teacherUserId)
        )
      ),
    db
      .select({
        weekday: studioReservations.weekday,
        slotStart: studioReservations.slotStart,
      })
      .from(studioReservations)
      .where(eq(studioReservations.studioId, studioId)),
  ]);

  const currentKeys = slotKeysFromShifts(currentShifts);
  const proposedKeys = slotKeysFromShifts(proposedShifts);
  const otherKeys = slotKeysFromShifts(otherShifts);
  const studentKeys = new Set(
    reservations.map((item) => `${item.weekday}|${item.slotStart}`)
  );

  const orphaned: string[] = [];
  for (const key of currentKeys) {
    if (proposedKeys.has(key)) continue;
    if (!studentKeys.has(key)) continue;
    if (otherKeys.has(key)) continue;
    orphaned.push(formatSlotKey(key));
  }

  if (!orphaned.length) return;
  throw new Error(
    orphaned.length === 1
      ? `No se puede dejar ${orphaned[0]}: hay alumnos anotados y no queda otro profesor.`
      : `No se pueden dejar estos horarios: hay alumnos anotados y no queda otro profesor (${orphaned.join(", ")}).`
  );
}

async function cancelPendingShiftRequests(
  studioId: string,
  teacherUserId: string
) {
  await getDb()
    .update(studioShiftRequests)
    .set({ status: "rejected", resolvedAt: new Date() })
    .where(
      and(
        eq(studioShiftRequests.studioId, studioId),
        eq(studioShiftRequests.teacherUserId, teacherUserId),
        eq(studioShiftRequests.status, "pending")
      )
    );
}

/** El profesor pide un cambio; el estudio tiene que aprobarlo. */
export async function requestOwnTeacherShifts(
  studioId: string,
  shifts: TeacherShiftInput[]
) {
  const userId = await requireUserId();
  const member = await teacherMembershipFor(userId, studioId);
  if (!member) {
    throw new Error("No eres profesor de esa sucursal.");
  }
  const [studioRow] = await getDb()
    .select()
    .from(studios)
    .where(eq(studios.id, studioId))
    .limit(1);
  if (!studioRow) throw new Error("El gimnasio ya no está.");
  const studio = toStudio(studioRow);
  const proposedShifts = normalizeProposedShifts(studio, shifts);
  await assertNoOrphanStudentSlots(studio.id, userId, proposedShifts);
  const db = getDb();
  await cancelPendingShiftRequests(studio.id, userId);
  await db.insert(studioShiftRequests).values({
    id: uid(),
    studioId: studio.id,
    teacherUserId: userId,
    proposedShifts,
    status: "pending",
    createdAt: new Date(),
    resolvedAt: null,
  });
  return loadTeacherStudioHours();
}

/** @deprecated Prefer requestOwnTeacherShifts — el profesor ya no guarda directo. */
export async function saveOwnTeacherShifts(
  studioId: string,
  shifts: TeacherShiftInput[]
) {
  return requestOwnTeacherShifts(studioId, shifts);
}

/** El profesor cancela su pedido pendiente y vuelve al horario vigente. */
export async function cancelOwnTeacherShiftRequest(studioId: string) {
  const userId = await requireUserId();
  const member = await teacherMembershipFor(userId, studioId);
  if (!member) {
    throw new Error("No eres profesor de esa sucursal.");
  }
  await cancelPendingShiftRequests(studioId, userId);
  return loadTeacherStudioHours();
}

export type StudioShiftRequestView = {
  id: string;
  studioId: string;
  studioName: string;
  teacherUserId: string;
  teacherName: string;
  proposedShifts: ProposedTeacherShift[];
  currentShifts: ProposedTeacherShift[];
  createdAt: string;
};

export async function listPendingShiftRequests(): Promise<
  StudioShiftRequestView[]
> {
  const { branches } = await requireOwnedGym();
  if (!branches.length) return [];
  const studioIds = branches.map((item) => item.id);
  const studioNameById = new Map(branches.map((item) => [item.id, item.name]));
  const db = getDb();
  const pending = await db
    .select()
    .from(studioShiftRequests)
    .where(
      and(
        inArray(studioShiftRequests.studioId, studioIds),
        eq(studioShiftRequests.status, "pending")
      )
    )
    .orderBy(desc(studioShiftRequests.createdAt));
  if (!pending.length) return [];
  const teacherIds = [...new Set(pending.map((item) => item.teacherUserId))];
  const members = await db
    .select()
    .from(studioMemberships)
    .where(
      and(
        inArray(studioMemberships.studioId, studioIds),
        inArray(studioMemberships.userId, teacherIds),
        eq(studioMemberships.role, "teacher")
      )
    );
  const nameByKey = new Map(
    members.map(
      (item) => [`${item.studioId}:${item.userId}`, item.displayName] as const
    )
  );
  const currentShifts = await db
    .select()
    .from(studioTeacherShifts)
    .where(
      and(
        inArray(studioTeacherShifts.studioId, studioIds),
        inArray(studioTeacherShifts.teacherUserId, teacherIds)
      )
    );
  return pending.map((row) => ({
    id: row.id,
    studioId: row.studioId,
    studioName: studioNameById.get(row.studioId) ?? "Sucursal",
    teacherUserId: row.teacherUserId,
    teacherName:
      nameByKey.get(`${row.studioId}:${row.teacherUserId}`) || "Profesor",
    proposedShifts: row.proposedShifts ?? [],
    currentShifts: currentShifts
      .filter(
        (item) =>
          item.studioId === row.studioId &&
          item.teacherUserId === row.teacherUserId
      )
      .map((item) => ({
        weekday: item.weekday,
        startHour: item.startHour,
        endHour: item.endHour,
        capacityPerSlot: normalizeCupo(item.capacityPerSlot) ?? 8,
      })),
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function resolveShiftRequest(
  requestId: string,
  decision: "approved" | "rejected"
) {
  const { branches } = await requireOwnedGym();
  const studioIds = new Set(branches.map((item) => item.id));
  const db = getDb();
  const [row] = await db
    .select()
    .from(studioShiftRequests)
    .where(eq(studioShiftRequests.id, requestId.trim()))
    .limit(1);
  if (!row || row.status !== "pending" || !studioIds.has(row.studioId)) {
    throw new Error("Esa solicitud ya no está pendiente.");
  }
  if (decision === "approved") {
    const studio = branches.find((item) => item.id === row.studioId);
    if (!studio) throw new Error("La sucursal ya no está.");
    const proposed = row.proposedShifts ?? [];
    await assertNoOrphanStudentSlots(studio.id, row.teacherUserId, proposed);
    await persistTeacherShifts(studio, row.teacherUserId, proposed);
  }
  await db
    .update(studioShiftRequests)
    .set({ status: decision, resolvedAt: new Date() })
    .where(eq(studioShiftRequests.id, row.id));
  return listPendingShiftRequests();
}

export async function redeemStudioInvite(rawCode: string) {
  const userId = await requireUserId();
  const code = normalizeJoinCode(rawCode);
  if (!code) throw new Error("Ese código no vale.");
  const db = getDb();
  const existing = await membershipsFor(userId);

  const [invite] = await db
    .select()
    .from(studioInvites)
    .where(eq(studioInvites.code, code))
    .limit(1);
  if (!invite || invite.usedByUserId) {
    throw new Error("Ese código no existe o ya se usó.");
  }
  if (existing.some((item) => item.studioId === invite.studioId)) {
    throw new Error("Ya estás en esta sucursal.");
  }
  if (invite.role === "client" && existing.length) {
    throw new Error("Ya estás en un gimnasio.");
  }
  if (invite.role === "teacher") {
    if (existing.some((item) => item.role === "client" || item.role === "owner")) {
      throw new Error("Esa cuenta no puede entrar como profesor.");
    }
    const teacherMemberships = existing.filter((item) => item.role === "teacher");
    if (teacherMemberships.length) {
      const [inviteStudio] = await db
        .select()
        .from(studios)
        .where(eq(studios.id, invite.studioId))
        .limit(1);
      const otherIds = teacherMemberships.map((item) => item.studioId);
      const others = await db
        .select()
        .from(studios)
        .where(inArray(studios.id, otherIds));
      if (
        !inviteStudio ||
        others.some((item) => item.ownerUserId !== inviteStudio.ownerUserId)
      ) {
        throw new Error("Ese código es de otro gimnasio.");
      }
    }
  }

  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .limit(1);
  const now = new Date();
  const nextRole = invite.role === "teacher" ? "professional" : "client";
  const name =
    invite.displayName ||
    account?.name ||
    (invite.role === "teacher" ? "Profesor" : "Cliente");

  await db
    .insert(accounts)
    .values({
      userId,
      role: nextRole,
      name,
      code: account?.code ?? null,
      linkedProfessionalId: account?.linkedProfessionalId ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: accounts.userId,
      set: {
        role: nextRole,
        name: account?.name || name,
        updatedAt: now,
      },
    });

  await db.insert(studioMemberships).values({
    id: uid(),
    studioId: invite.studioId,
    userId,
    role: invite.role,
    sessionsPerWeek: invite.sessionsPerWeek,
    assignedTeacherUserId: invite.assignedTeacherUserId,
    displayName: name,
    phone: invite.phone ?? "",
    createdAt: now,
  });
  await db
    .update(studioInvites)
    .set({ usedByUserId: userId })
    .where(eq(studioInvites.code, invite.code));

  const [studio] = await db
    .select()
    .from(studios)
    .where(eq(studios.id, invite.studioId))
    .limit(1);

  return {
    role: nextRole,
    studioName: studio?.name ?? "Estudio",
    memberRole: invite.role,
  };
}

export async function loadClientBooking() {
  const userId = await requireUserId();
  const member = await membershipFor(userId, "client");
  if (!member || member.role !== "client") return null;
  const [studioRow] = await getDb()
    .select()
    .from(studios)
    .where(eq(studios.id, member.studioId))
    .limit(1);
  if (!studioRow) return null;
  const studio = toStudio(studioRow);
  const bundle = await loadStudioBundle(studio);
  const teacherId = member.assignedTeacherUserId;
  const teacher = teacherId
    ? bundle.people.find(
        (item) => item.role === "teacher" && item.userId === teacherId
      )
    : null;
  return {
    studio: bundle.studio,
    sessionsPerWeek: member.sessionsPerWeek ?? 1,
    activities: memberActivities(member.activities, studio.kinds),
    teacher: teacher
      ? { userId: teacher.userId as string, name: teacher.displayName }
      : teacherId
        ? { userId: teacherId, name: "Profesor" }
        : null,
    occupancy: bundle.occupancy,
    mine: bundle.reservations.filter((item) => item.clientUserId === userId),
  };
}

export type ClientTodayHome = {
  studioName: string;
  today: {
    slotStart: string;
    teacherName: string | null;
    absent: boolean;
  } | null;
  next: {
    weekday: number;
    slotStart: string;
    teacherName: string | null;
  } | null;
};

/** Resumen del día para el home del alumno de gimnasio. */
export async function loadClientTodayHome(): Promise<ClientTodayHome | null> {
  const booking = await loadClientBooking();
  if (!booking) return null;
  const userId = await requireUserId();
  const teacherNameById = new Map<string, string>();
  if (booking.teacher) {
    teacherNameById.set(booking.teacher.userId, booking.teacher.name);
  }
  for (const row of booking.mine) {
    if (row.teacherUserId && row.teacherName) {
      teacherNameById.set(row.teacherUserId, row.teacherName);
    }
  }
  const resolveTeacher = (teacherUserId: string | null) => {
    if (teacherUserId && teacherNameById.has(teacherUserId)) {
      return teacherNameById.get(teacherUserId) ?? null;
    }
    return booking.teacher?.name ?? null;
  };
  const todayYmd = todayBillingYmd();
  const todayWeekday = new Date(`${todayYmd}T12:00:00`).getDay();
  const todayRows = booking.mine
    .filter((item) => item.weekday === todayWeekday)
    .sort((a, b) => a.slotStart.localeCompare(b.slotStart));
  const [absence] = todayRows[0]
    ? await getDb()
        .select({ id: studioAbsences.id })
        .from(studioAbsences)
        .where(
          and(
            eq(studioAbsences.studioId, booking.studio.id),
            eq(studioAbsences.clientUserId, userId),
            eq(studioAbsences.absentOn, todayYmd)
          )
        )
        .limit(1)
    : [null];
  const today = todayRows[0]
    ? {
        slotStart: todayRows[0].slotStart,
        teacherName: resolveTeacher(todayRows[0].teacherUserId),
        absent: Boolean(absence),
      }
    : null;

  let next: ClientTodayHome["next"] = null;
  if (!today) {
    const upcoming = [...booking.mine].sort((a, b) => {
      const aDelta = (a.weekday - todayWeekday + 7) % 7 || 7;
      const bDelta = (b.weekday - todayWeekday + 7) % 7 || 7;
      return aDelta - bDelta || a.slotStart.localeCompare(b.slotStart);
    });
    const row = upcoming[0];
    if (row) {
      next = {
        weekday: row.weekday,
        slotStart: row.slotStart,
        teacherName: resolveTeacher(row.teacherUserId),
      };
    }
  }

  return {
    studioName: booking.studio.name,
    today,
    next,
  };
}

/** El alumno avisa que hoy no asiste y libera el cupo de ese día. */
export async function markClientAbsenceToday() {
  const booking = await loadClientBooking();
  if (!booking) throw new Error("No hay un gimnasio vinculado.");
  const userId = await requireUserId();
  const todayYmd = todayBillingYmd();
  const todayWeekday = new Date(`${todayYmd}T12:00:00`).getDay();
  const todayRow = booking.mine
    .filter((item) => item.weekday === todayWeekday)
    .sort((a, b) => a.slotStart.localeCompare(b.slotStart))[0];
  if (!todayRow) {
    throw new Error("Hoy no tenés clase para avisar.");
  }
  const db = getDb();
  const [existing] = await db
    .select({ id: studioAbsences.id })
    .from(studioAbsences)
    .where(
      and(
        eq(studioAbsences.studioId, booking.studio.id),
        eq(studioAbsences.clientUserId, userId),
        eq(studioAbsences.absentOn, todayYmd)
      )
    )
    .limit(1);
  if (!existing) {
    await db.insert(studioAbsences).values({
      id: uid(),
      studioId: booking.studio.id,
      clientUserId: userId,
      absentOn: todayYmd,
      weekday: todayWeekday,
      slotStart: todayRow.slotStart,
    });
  }
  return loadClientTodayHome();
}

/** Cancela el aviso de ausencia de hoy. */
export async function cancelClientAbsenceToday() {
  const booking = await loadClientBooking();
  if (!booking) throw new Error("No hay un gimnasio vinculado.");
  const userId = await requireUserId();
  const todayYmd = todayBillingYmd();
  await getDb()
    .delete(studioAbsences)
    .where(
      and(
        eq(studioAbsences.studioId, booking.studio.id),
        eq(studioAbsences.clientUserId, userId),
        eq(studioAbsences.absentOn, todayYmd)
      )
    );
  return loadClientTodayHome();
}

export type StudioAbsenceView = {
  id: string;
  studioId: string;
  studioName: string;
  clientUserId: string;
  clientName: string;
  absentOn: string;
  weekday: number;
  slotStart: string;
  teacherUserId: string | null;
  teacherName: string | null;
};

async function absenceViewsForStudios(
  studioIds: string[],
  fromYmd: string,
  toYmd: string
): Promise<StudioAbsenceView[]> {
  if (!studioIds.length) return [];
  const db = getDb();
  const [rows, members, studioRows, reservations] = await Promise.all([
    db
      .select()
      .from(studioAbsences)
      .where(
        and(
          inArray(studioAbsences.studioId, studioIds),
          gte(studioAbsences.absentOn, fromYmd),
          lte(studioAbsences.absentOn, toYmd)
        )
      )
      .orderBy(asc(studioAbsences.absentOn), asc(studioAbsences.slotStart)),
    db
      .select()
      .from(studioMemberships)
      .where(inArray(studioMemberships.studioId, studioIds)),
    db
      .select({ id: studios.id, name: studios.name })
      .from(studios)
      .where(inArray(studios.id, studioIds)),
    db
      .select()
      .from(studioReservations)
      .where(inArray(studioReservations.studioId, studioIds)),
  ]);
  if (!rows.length) return [];
  const nameByMember = new Map(
    members.map(
      (item) => [`${item.studioId}:${item.userId}`, item.displayName] as const
    )
  );
  const assignedTeacherByClient = new Map(
    members
      .filter((item) => item.role === "client" && item.assignedTeacherUserId)
      .map(
        (item) =>
          [
            `${item.studioId}:${item.userId}`,
            item.assignedTeacherUserId as string,
          ] as const
      )
  );
  const studioNameById = new Map(studioRows.map((item) => [item.id, item.name]));
  return rows.map((row) => {
    const reservation = reservations.find(
      (item) =>
        item.studioId === row.studioId &&
        item.clientUserId === row.clientUserId &&
        item.weekday === row.weekday &&
        item.slotStart === row.slotStart
    );
    const teacherUserId =
      reservation?.teacherUserId ??
      assignedTeacherByClient.get(`${row.studioId}:${row.clientUserId}`) ??
      null;
    return {
      id: row.id,
      studioId: row.studioId,
      studioName: studioNameById.get(row.studioId) ?? "Sucursal",
      clientUserId: row.clientUserId,
      clientName:
        nameByMember.get(`${row.studioId}:${row.clientUserId}`) ?? "Alumno",
      absentOn: row.absentOn,
      weekday: row.weekday,
      slotStart: row.slotStart,
      teacherUserId,
      teacherName: teacherUserId
        ? (nameByMember.get(`${row.studioId}:${teacherUserId}`) ?? "Profesor")
        : null,
    };
  });
}

/** Ausencias recientes y próximas de una sucursal. */
export async function listStudioAbsences(
  studioId: string
): Promise<StudioAbsenceView[]> {
  await requireStudioOwner(studioId);
  const today = todayBillingYmd();
  return absenceViewsForStudios(
    [studioId],
    shiftYmd(today, -7),
    shiftYmd(today, 21)
  );
}

/** Ausencias de alumnos del profesor (hoy y próximos días). */
export async function listTeacherClientAbsences(): Promise<
  StudioAbsenceView[]
> {
  const userId = await requireUserId();
  const members = (await membershipsFor(userId)).filter(
    (item) => item.role === "teacher"
  );
  if (!members.length) return [];
  const studioIds = members.map((item) => item.studioId);
  const today = todayBillingYmd();
  const db = getDb();
  const [rows, assigned] = await Promise.all([
    absenceViewsForStudios(studioIds, today, shiftYmd(today, 14)),
    db
      .select({
        studioId: studioMemberships.studioId,
        userId: studioMemberships.userId,
      })
      .from(studioMemberships)
      .where(
        and(
          inArray(studioMemberships.studioId, studioIds),
          eq(studioMemberships.role, "client"),
          eq(studioMemberships.assignedTeacherUserId, userId)
        )
      ),
  ]);
  const assignedKeys = new Set(
    assigned.map((item) => `${item.studioId}:${item.userId}`)
  );
  return rows.filter(
    (row) =>
      row.teacherUserId === userId ||
      assignedKeys.has(`${row.studioId}:${row.clientUserId}`)
  );
}

export type ClientBillingHome = {
  planName: string;
  planLabel: string;
  feeAmount: number | null;
  serviceEndsOn: string;
  paymentStatus: ClientPaymentStatus;
  alert: ClientAccountAlert;
};

/** Estado de cuota para el home del alumno de gimnasio. */
export async function loadClientBillingHome(): Promise<ClientBillingHome | null> {
  const userId = await requireUserId();
  const member = await membershipFor(userId, "client");
  if (!member || member.role !== "client") return null;
  const paymentStatus: ClientPaymentStatus =
    member.paymentStatus === "current" ||
    member.paymentStatus === "overdue" ||
    member.paymentStatus === "paused" ||
    member.paymentStatus === "trial" ||
    member.paymentStatus === "comp"
      ? member.paymentStatus
      : "current";
  const serviceEndsOn = member.serviceEndsOn ?? "";
  const planName = member.planName ?? "";
  return {
    planName,
    planLabel: clientBillingPlanLabel(planName),
    feeAmount: member.feeAmount ?? null,
    serviceEndsOn,
    paymentStatus,
    alert: clientAccountAlert(paymentStatus, serviceEndsOn),
  };
}

export type ClientProfile = {
  displayName: string;
  phone: string;
  email: string;
  username: string;
  birthDate: string;
  photoData: string;
  emergencyName: string;
  emergencyPhone: string;
  activities: StudioKind[];
  studioName: string;
};

export type AssignedTeacher = {
  name: string;
  sex: Sex;
};

export async function loadAssignedTeacher(): Promise<AssignedTeacher | null> {
  const userId = await requireUserId();
  const member = await membershipFor(userId, "client");
  if (!member || member.role !== "client" || !member.assignedTeacherUserId) {
    return null;
  }
  const [teacher] = await getDb()
    .select({ displayName: studioMemberships.displayName })
    .from(studioMemberships)
    .where(
      and(
        eq(studioMemberships.studioId, member.studioId),
        eq(studioMemberships.userId, member.assignedTeacherUserId),
        eq(studioMemberships.role, "teacher")
      )
    )
    .limit(1);
  const name = teacher?.displayName.trim();
  if (!name) return null;
  const [studio] = await getDb()
    .select({ ownerUserId: studios.ownerUserId })
    .from(studios)
    .where(eq(studios.id, member.studioId))
    .limit(1);
  let sex: Sex = "other";
  if (studio?.ownerUserId) {
    const [roster] = await getDb()
      .select({ sex: gymTeachers.sex })
      .from(gymTeachers)
      .where(
        and(
          eq(gymTeachers.ownerUserId, studio.ownerUserId),
          eq(gymTeachers.userId, member.assignedTeacherUserId)
        )
      )
      .limit(1);
    if (roster?.sex === "female" || roster?.sex === "male" || roster?.sex === "other") {
      sex = roster.sex;
    }
  }
  return { name, sex };
}

/** @deprecated Use loadAssignedTeacher */
export async function loadAssignedTeacherName(): Promise<string | null> {
  const teacher = await loadAssignedTeacher();
  return teacher?.name ?? null;
}

export async function loadClientProfile(): Promise<ClientProfile | null> {
  const userId = await requireUserId();
  const member = await membershipFor(userId, "client");
  if (!member || member.role !== "client") return null;
  const [studioRow] = await getDb()
    .select({ name: studios.name, kinds: studios.kinds, kind: studios.kind })
    .from(studios)
    .where(eq(studios.id, member.studioId))
    .limit(1);
  const [account] = await getDb()
    .select({
      email: accounts.email,
      username: accounts.username,
    })
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .limit(1);
  const kinds = normalizeStudioKinds(studioRow?.kinds, studioRow?.kind);
  return {
    displayName: member.displayName,
    phone: member.phone ?? "",
    email: member.email || account?.email || "",
    username: account?.username ?? "",
    birthDate: member.birthDate ?? "",
    photoData: member.photoData ?? "",
    emergencyName: member.emergencyName ?? "",
    emergencyPhone: member.emergencyPhone ?? "",
    activities: memberActivities(member.activities, kinds),
    studioName: studioRow?.name ?? "Sucursal",
  };
}

export async function saveClientProfile(input: {
  displayName: string;
  phone: string;
  email: string;
  birthDate: string;
  photoData: string;
  emergencyName: string;
  emergencyPhone: string;
}) {
  const userId = await requireUserId();
  const member = await membershipFor(userId, "client");
  if (!member || member.role !== "client") {
    throw new Error("No hay un alumno con esta cuenta.");
  }
  const displayName = input.displayName.trim();
  if (displayName.length < 2) throw new Error("Pon tu nombre.");
  const phone = parsePhone(input.phone);
  const email = parseEmail(input.email);
  const birthDate = parseBirthDate(input.birthDate);
  const photoData = parseProfilePhoto(input.photoData);
  const emergencyName = input.emergencyName.trim().slice(0, 80);
  const emergencyPhone = parseOptionalPhone(
    input.emergencyPhone,
    "teléfono de emergencia"
  );
  if (emergencyName && !emergencyPhone) {
    throw new Error("Pon el teléfono del contacto de emergencia.");
  }
  if (emergencyPhone && !emergencyName) {
    throw new Error("Pon el nombre del contacto de emergencia.");
  }
  const db = getDb();
  const [emailTaken] = await db
    .select({ userId: accounts.userId })
    .from(accounts)
    .where(and(eq(accounts.email, email), ne(accounts.userId, userId)))
    .limit(1);
  if (emailTaken) throw new Error("Ese email ya está en uso.");
  await db
    .update(studioMemberships)
    .set({
      displayName,
      phone,
      email,
      birthDate,
      photoData,
      emergencyName,
      emergencyPhone,
    })
    .where(eq(studioMemberships.id, member.id));
  const [currentAccount] = await db
    .select({ username: accounts.username })
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .limit(1);
  await db
    .update(accounts)
    .set({
      name: displayName,
      email,
      username: currentAccount?.username || (await uniqueClientUsername(email)),
      updatedAt: new Date(),
    })
    .where(eq(accounts.userId, userId));
  return loadClientProfile();
}

async function changeAccountPasswordForRole(
  role: "client" | "teacher" | "studio",
  input: { currentPassword: string; newPassword: string }
) {
  const userId = await requireUserId();
  const db = getDb();
  if (role === "client") {
    const member = await membershipFor(userId, "client");
    if (!member || member.role !== "client") {
      throw new Error("No hay un alumno con esta cuenta.");
    }
  } else if (role === "teacher") {
    const member = await membershipFor(userId, "teacher");
    if (!member || member.role !== "teacher") {
      throw new Error("No hay un profesor con esta cuenta.");
    }
  } else {
    const [accountRole] = await db
      .select({ role: accounts.role })
      .from(accounts)
      .where(eq(accounts.userId, userId))
      .limit(1);
    if (accountRole?.role !== "studio") {
      throw new Error("No hay un gimnasio con esta cuenta.");
    }
  }
  const [account] = await db
    .select({ passwordHash: accounts.passwordHash })
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .limit(1);
  if (!account?.passwordHash) {
    throw new Error("Esta cuenta no tiene contraseña para cambiar.");
  }
  const current = input.currentPassword;
  if (!(await verifyPassword(current, account.passwordHash))) {
    throw new Error("La contraseña actual no es correcta.");
  }
  const next = parsePassword(input.newPassword);
  if (current === next) {
    throw new Error("La nueva contraseña tiene que ser distinta.");
  }
  await db
    .update(accounts)
    .set({
      passwordHash: await hashPassword(next),
      updatedAt: new Date(),
    })
    .where(eq(accounts.userId, userId));
  return { ok: true as const };
}

/** Cambia la contraseña del alumno desde Datos (pide la actual). */
export async function changeClientPassword(input: {
  currentPassword: string;
  newPassword: string;
}) {
  return changeAccountPasswordForRole("client", input);
}

/** Cambia la contraseña del profesor desde Datos (pide la actual). */
export async function changeTeacherPassword(input: {
  currentPassword: string;
  newPassword: string;
}) {
  return changeAccountPasswordForRole("teacher", input);
}

/** Cambia la contraseña del gimnasio desde Datos (pide la actual). */
export async function changeStudioPassword(input: {
  currentPassword: string;
  newPassword: string;
}) {
  return changeAccountPasswordForRole("studio", input);
}

export type StudioOwnerProfile = {
  displayName: string;
  username: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  logoData: string;
};

export async function loadStudioOwnerProfile(): Promise<StudioOwnerProfile | null> {
  const userId = await requireUserId();
  const [account] = await getDb()
    .select({
      role: accounts.role,
      name: accounts.name,
      username: accounts.username,
      contactName: accounts.contactName,
      contactPhone: accounts.contactPhone,
      contactEmail: accounts.contactEmail,
      logoData: accounts.logoData,
    })
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .limit(1);
  if (!account || account.role !== "studio") return null;
  return {
    displayName: account.name?.trim() || "Gimnasio",
    username: account.username ?? "",
    contactName: account.contactName ?? "",
    contactPhone: account.contactPhone ?? "",
    contactEmail: account.contactEmail ?? "",
    logoData: account.logoData ?? "",
  };
}

/** Actualiza nombre, logo y datos del contacto del estudio. */
export async function saveStudioOwnerProfile(input: {
  displayName: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  logoData?: string;
}): Promise<StudioOwnerProfile | null> {
  const userId = await requireUserId();
  const db = getDb();
  const [account] = await db
    .select({ role: accounts.role })
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .limit(1);
  if (!account || account.role !== "studio") {
    throw new Error("Solo el gimnasio puede editar estos datos.");
  }
  const displayName = input.displayName.trim();
  if (displayName.length < 2) throw new Error("Pon el nombre del gimnasio.");
  if (displayName.length > 80) throw new Error("El nombre es demasiado largo.");
  const contactName = input.contactName.trim().slice(0, 80);
  if (contactName.length < 2) {
    throw new Error("Pon el nombre del contacto.");
  }
  const contactPhone = input.contactPhone.trim();
  const phoneDigits = contactPhone.replace(/\D/g, "");
  if (phoneDigits.length < 6) {
    throw new Error("Pon un teléfono de contacto válido.");
  }
  const contactEmail = (input.contactEmail ?? "").trim().toLowerCase();
  if (
    contactEmail &&
    (contactEmail.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail))
  ) {
    throw new Error("Pon un email de contacto válido.");
  }
  const logoData = parseProfilePhoto(input.logoData ?? "");
  await db
    .update(accounts)
    .set({
      name: displayName,
      contactName,
      contactPhone,
      contactEmail,
      logoData,
      updatedAt: new Date(),
    })
    .where(eq(accounts.userId, userId));
  return loadStudioOwnerProfile();
}

export type TeacherProfile = {
  displayName: string;
  phone: string;
  email: string;
  username: string;
  photoData: string;
};

export async function loadTeacherProfile(): Promise<TeacherProfile | null> {
  const userId = await requireUserId();
  const members = (await membershipsFor(userId)).filter(
    (item) => item.role === "teacher"
  );
  if (!members.length) return null;
  const [account] = await getDb()
    .select({
      name: accounts.name,
      email: accounts.email,
      username: accounts.username,
    })
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .limit(1);
  const withPhoto = members.find((item) => item.photoData?.trim()) ?? members[0];
  return {
    displayName:
      withPhoto.displayName.trim() || account?.name?.trim() || "Profesor",
    phone: withPhoto.phone ?? "",
    email: withPhoto.email || account?.email || "",
    username: account?.username ?? "",
    photoData: withPhoto.photoData ?? "",
  };
}

export async function saveTeacherProfile(input: {
  displayName: string;
  phone: string;
  email: string;
  photoData: string;
}) {
  const userId = await requireUserId();
  const members = (await membershipsFor(userId)).filter(
    (item) => item.role === "teacher"
  );
  if (!members.length) {
    throw new Error("No hay un profesor con esta cuenta.");
  }
  const displayName = input.displayName.trim();
  if (displayName.length < 2) throw new Error("Pon tu nombre.");
  const phone = parseOptionalPhone(input.phone, "teléfono");
  if (!phone) throw new Error("Pon un teléfono válido.");
  const email = parseEmail(input.email);
  const photoData = parseProfilePhoto(input.photoData);
  const db = getDb();
  const [emailTaken] = await db
    .select({ userId: accounts.userId })
    .from(accounts)
    .where(and(eq(accounts.email, email), ne(accounts.userId, userId)))
    .limit(1);
  if (emailTaken) throw new Error("Ese email ya está en uso.");
  const memberIds = members.map((item) => item.id);
  await db
    .update(studioMemberships)
    .set({
      displayName,
      phone,
      email,
      photoData,
    })
    .where(inArray(studioMemberships.id, memberIds));
  await db
    .update(gymTeachers)
    .set({
      displayName,
      phone,
    })
    .where(eq(gymTeachers.userId, userId));
  const [currentAccount] = await db
    .select({ username: accounts.username })
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .limit(1);
  await db
    .update(accounts)
    .set({
      name: displayName,
      email,
      username: currentAccount?.username || (await uniqueClientUsername(email)),
      updatedAt: new Date(),
    })
    .where(eq(accounts.userId, userId));
  return loadTeacherProfile();
}

export type TeacherAssignedClient = {
  userId: string;
  displayName: string;
  email: string;
  phone: string;
  studioId: string;
  studioName: string;
  sessionsPerWeek: number | null;
  reservations: { weekday: number; slotStart: string }[];
  hasPlan: boolean;
};

export async function listAssignedTeacherClients(): Promise<
  TeacherAssignedClient[]
> {
  const userId = await requireUserId();
  const members = (await membershipsFor(userId)).filter(
    (item) => item.role === "teacher"
  );
  if (!members.length) return [];
  const studioIds = members.map((item) => item.studioId);
  const db = getDb();
  const clients = await db
    .select()
    .from(studioMemberships)
    .where(
      and(
        inArray(studioMemberships.studioId, studioIds),
        eq(studioMemberships.role, "client"),
        eq(studioMemberships.assignedTeacherUserId, userId)
      )
    );
  if (!clients.length) return [];
  const studioRows = await db
    .select({ id: studios.id, name: studios.name })
    .from(studios)
    .where(inArray(studios.id, studioIds));
  const nameByStudio = new Map(studioRows.map((item) => [item.id, item.name]));
  const clientIds = [...new Set(clients.map((item) => item.userId))];
  const reservations = await db
    .select()
    .from(studioReservations)
    .where(
      and(
        inArray(studioReservations.studioId, studioIds),
        inArray(studioReservations.clientUserId, clientIds)
      )
    );
  const states = await db
    .select({ userId: userStates.userId, payload: userStates.payload })
    .from(userStates)
    .where(inArray(userStates.userId, clientIds));
  const planByUser = new Map(
    states.map((row) => {
      const payload = row.payload as { state?: AppState } | AppState | null;
      const state =
        payload && typeof payload === "object" && "plan" in payload && !("state" in payload)
          ? (payload as AppState)
          : (payload as { state?: AppState } | null)?.state ?? null;
      return [row.userId, planHasExercises(state)] as const;
    })
  );
  return clients
    .map((item) => ({
      userId: item.userId,
      displayName: item.displayName,
      email: item.email ?? "",
      phone: item.phone ?? "",
      studioId: item.studioId,
      studioName: nameByStudio.get(item.studioId) ?? "Sucursal",
      sessionsPerWeek: item.sessionsPerWeek,
      hasPlan: planByUser.get(item.userId) ?? false,
      reservations: reservations
        .filter(
          (row) =>
            row.studioId === item.studioId && row.clientUserId === item.userId
        )
        .map((row) => ({ weekday: row.weekday, slotStart: row.slotStart }))
        .sort(
          (a, b) =>
            a.weekday - b.weekday || a.slotStart.localeCompare(b.slotStart)
        ),
    }))
    .sort(
      (a, b) =>
        a.studioName.localeCompare(b.studioName, "es") ||
        a.displayName.localeCompare(b.displayName, "es")
    );
}

export type TeacherStudioHours = {
  studio: Studio;
  shifts: StudioShift[];
  reservations: (typeof studioReservations.$inferSelect)[];
  pendingRequest: {
    id: string;
    proposedShifts: ProposedTeacherShift[];
    createdAt: string;
  } | null;
};

export async function loadTeacherStudioHours(): Promise<TeacherStudioHours[]> {
  const userId = await requireUserId();
  const members = (await membershipsFor(userId)).filter(
    (item) => item.role === "teacher"
  );
  if (!members.length) return [];
  const studioIds = members.map((item) => item.studioId);
  const studioRows = await getDb()
    .select()
    .from(studios)
    .where(inArray(studios.id, studioIds));
  const allShifts = await getDb()
    .select()
    .from(studioTeacherShifts)
    .where(
      and(
        inArray(studioTeacherShifts.studioId, studioIds),
        eq(studioTeacherShifts.teacherUserId, userId)
      )
    );
  const allReservations = await getDb()
    .select()
    .from(studioReservations)
    .where(
      and(
        inArray(studioReservations.studioId, studioIds),
        eq(studioReservations.teacherUserId, userId)
      )
    );
  const pendingRows = await getDb()
    .select()
    .from(studioShiftRequests)
    .where(
      and(
        inArray(studioShiftRequests.studioId, studioIds),
        eq(studioShiftRequests.teacherUserId, userId),
        eq(studioShiftRequests.status, "pending")
      )
    );
  return studioRows.map((row) => {
    const studio = toStudio(row);
    const pending = pendingRows.find((item) => item.studioId === studio.id);
    return {
      studio,
      shifts: allShifts
        .filter((item) => item.studioId === studio.id)
        .map((item) => ({
          id: item.id,
          teacherUserId: item.teacherUserId,
          weekday: item.weekday,
          startHour: item.startHour,
          endHour: item.endHour,
          capacityPerSlot: normalizeCupo(item.capacityPerSlot) ?? 8,
        })),
      reservations: allReservations.filter(
        (item) => item.studioId === studio.id
      ),
      pendingRequest: pending
        ? {
            id: pending.id,
            proposedShifts: pending.proposedShifts ?? [],
            createdAt: pending.createdAt.toISOString(),
          }
        : null,
    };
  });
}

export async function saveClientReservations(
  picks: { weekday: number; slotStart: string }[]
) {
  const userId = await requireUserId();
  const member = await membershipFor(userId, "client");
  if (!member || member.role !== "client") {
    throw new Error("No tienes un cupo de alumno en un gimnasio.");
  }
  const allowed = member.sessionsPerWeek ?? 1;
  const teacherId = member.assignedTeacherUserId;
  if (!teacherId) {
    throw new Error("El gimnasio todavía no te asignó un profesor.");
  }

  const [studioRow] = await getDb()
    .select()
    .from(studios)
    .where(eq(studios.id, member.studioId))
    .limit(1);
  if (!studioRow) throw new Error("El gimnasio ya no está.");
  const studio = toStudio(studioRow);
  const bundle = await loadStudioBundle(studio);
  const rows = reservationRowsForPicks({
    studio,
    occupancy: bundle.occupancy,
    existing: bundle.reservations,
    clientUserId: userId,
    teacherId,
    allowed,
    activities: memberActivities(member.activities, studio.kinds),
    picks,
  });

  const db = getDb();
  await db
    .delete(studioReservations)
    .where(
      and(
        eq(studioReservations.studioId, studio.id),
        eq(studioReservations.clientUserId, userId)
      )
    );
  if (rows.length) {
    await db.insert(studioReservations).values(rows);
  }
  return loadClientBooking();
}
