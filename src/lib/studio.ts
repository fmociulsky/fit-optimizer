"use server";

import { and, asc, desc, eq, gt, gte, inArray, isNull, lte, ne } from "drizzle-orm";
import { getDb } from "@/db";
import {
  accounts,
  coachRequests,
  gymTeachers,
  studioAbsences,
  studioInvites,
  studioMemberships,
  studioMonthTurns,
  studioPayments,
  studioReservations,
  studioShiftRequests,
  studioTeacherLeaves,
  studioTeacherShifts,
  studioWaitlist,
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
  classSlotPassed,
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
  mondayOfYmd,
  shiftYmd,
  todayBillingYmd,
  turnGridBounds,
  type ClientAccountAlert,
} from "@/lib/client-account";
import {
  cancellationOutcome,
  classStart,
  parseMaxCancels,
  parseNoticeHours,
} from "@/lib/credits";
import {
  isInMonthTurnWindow,
  monthTurnBounds,
  syncFixedMonthTurns,
} from "@/lib/month-turns";
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
  type TurnPlan,
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

function monthsBetween(from: string, to: string) {
  const months: string[] = [];
  let year = Number(from.slice(0, 4));
  let month = Number(from.slice(5, 7));
  const end = to.slice(0, 7);
  if (!year || !month) return months;
  while (months.length < 8) {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    months.push(key);
    if (key >= end) break;
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

function parseTurnPlan(raw: unknown): TurnPlan {
  if (raw === "fixed" || raw === "week" || raw === "month") return raw;
  return "month";
}

/** Un recupero fuera de la semana o del mes se descuenta de un crédito que sí exista. */
function settleCreditBuckets(buckets: Record<string, number>) {
  const keys = Object.keys(buckets).sort();
  let debt = 0;
  for (const key of keys) {
    const value = buckets[key] ?? 0;
    if (value < 0) {
      debt += -value;
      buckets[key] = 0;
    }
  }
  for (const key of keys) {
    if (debt === 0) break;
    const value = buckets[key] ?? 0;
    if (value <= 0) continue;
    const take = Math.min(value, debt);
    buckets[key] = value - take;
    debt -= take;
  }
  const last = keys[keys.length - 1];
  if (debt > 0 && last) {
    buckets[last] = (buckets[last] ?? 0) - debt;
  }
}

function recoveryCreditCount(
  turnPlan: TurnPlan,
  credits: { ymd: string; outcome?: "credit" | "notice" }[],
  spends: { ymd: string }[],
  today = todayBillingYmd()
) {
  if (turnPlan === "fixed") {
    const absenceDays = [...new Set(credits.map((item) => item.ymd))];
    const absenceSet = new Set(absenceDays);
    const freeFuture = absenceDays.filter(
      (ymd) => ymd > today && !spends.some((spend) => spend.ymd === ymd)
    );
    const extraSpends = spends.filter((spend) => !absenceSet.has(spend.ymd)).length;
    return Math.max(0, freeFuture.length - extraSpends);
  }
  const buckets: Record<string, number> = {};
  const keyOf = (ymd: string) =>
    turnPlan === "week" ? mondayOfYmd(ymd) : ymd.slice(0, 7);
  for (const item of credits) {
    if (item.outcome && item.outcome !== "credit") continue;
    const key = keyOf(item.ymd);
    buckets[key] = (buckets[key] ?? 0) + 1;
  }
  for (const item of spends) {
    const key = keyOf(item.ymd);
    buckets[key] = (buckets[key] ?? 0) - 1;
  }
  settleCreditBuckets(buckets);
  return Object.values(buckets).reduce(
    (sum, value) => sum + Math.max(0, value),
    0
  );
}

function weeksBetween(from: string, to: string) {
  const weeks: string[] = [];
  let cursor = mondayOfYmd(from);
  const end = mondayOfYmd(to);
  while (cursor <= end && weeks.length < 12) {
    weeks.push(cursor);
    cursor = shiftYmd(cursor, 7);
  }
  return weeks;
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
    cancelNoticeHours: parseNoticeHours(row.cancelNoticeHours),
    maxCancelsPerMonth: parseMaxCancels(row.maxCancelsPerMonth),
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
  cancelNoticeHours?: number;
  maxCancelsPerMonth?: number;
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
    cancelNoticeHours: parseNoticeHours(input.cancelNoticeHours),
    maxCancelsPerMonth: parseMaxCancels(input.maxCancelsPerMonth),
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
  /** Plan de turnos del alumno. */
  turnPlan?: TurnPlan;
};

export type NextHourTeacherGroup = NextHourPerson & {
  students: NextHourPerson[];
};

export type DayAgendaSlot = {
  slotStart: string;
  teachers: NextHourTeacherGroup[];
  unassignedStudents: NextHourPerson[];
  /** Lugares libres para las actividades de la sucursal. */
  free?: number;
  /** Ocupación visible, por ejemplo "Ocupación: 2 / 4". */
  occupancy?: string;
  /** Alumnos en lista de espera, en el orden en que se anotaron. */
  waiting?: NextHourPerson[];
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
    turnPlan:
      member?.role === "client" ? parseTurnPlan(member.turnPlan) : undefined,
  };
}

/** Profesor en licencia → reemplazo, para un día concreto de la sucursal. */
async function teacherLeaveRemapForDay(studioId: string, occursOn: string) {
  const [studio] = await getDb()
    .select({ ownerUserId: studios.ownerUserId })
    .from(studios)
    .where(eq(studios.id, studioId))
    .limit(1);
  if (!studio) return new Map<string, string>();
  const rows = await getDb()
    .select({
      teacherUserId: studioTeacherLeaves.teacherUserId,
      replacementTeacherUserId: studioTeacherLeaves.replacementTeacherUserId,
    })
    .from(studioTeacherLeaves)
    .where(
      and(
        eq(studioTeacherLeaves.ownerUserId, studio.ownerUserId),
        eq(studioTeacherLeaves.status, "approved"),
        lte(studioTeacherLeaves.startsOn, occursOn),
        gte(studioTeacherLeaves.endsOn, occursOn)
      )
    );
  const remap = new Map<string, string>();
  for (const row of rows) {
    if (row.replacementTeacherUserId) {
      remap.set(row.teacherUserId, row.replacementTeacherUserId);
    }
  }
  return remap;
}

/** Remplazos por licencia en un rango: clave `${occursOn}|${teacherUserId}`. */
async function teacherLeaveRemapByDay(
  studioId: string,
  fromYmd: string,
  toYmd: string
) {
  const [studio] = await getDb()
    .select({ ownerUserId: studios.ownerUserId })
    .from(studios)
    .where(eq(studios.id, studioId))
    .limit(1);
  if (!studio) return new Map<string, string>();
  const rows = await getDb()
    .select({
      teacherUserId: studioTeacherLeaves.teacherUserId,
      replacementTeacherUserId: studioTeacherLeaves.replacementTeacherUserId,
      startsOn: studioTeacherLeaves.startsOn,
      endsOn: studioTeacherLeaves.endsOn,
    })
    .from(studioTeacherLeaves)
    .where(
      and(
        eq(studioTeacherLeaves.ownerUserId, studio.ownerUserId),
        eq(studioTeacherLeaves.status, "approved"),
        lte(studioTeacherLeaves.startsOn, toYmd),
        gte(studioTeacherLeaves.endsOn, fromYmd)
      )
    );
  const remap = new Map<string, string>();
  for (const row of rows) {
    if (!row.replacementTeacherUserId) continue;
    let cursor = row.startsOn < fromYmd ? fromYmd : row.startsOn;
    const last = row.endsOn > toYmd ? toYmd : row.endsOn;
    while (cursor <= last) {
      remap.set(`${cursor}|${row.teacherUserId}`, row.replacementTeacherUserId);
      cursor = shiftYmd(cursor, 1);
    }
  }
  return remap;
}

function attendanceForSlot(input: {
  weekday: number;
  slotStart: string;
  members: Map<string, (typeof studioMemberships.$inferSelect)>;
  shifts: (typeof studioTeacherShifts.$inferSelect)[];
  rows: {
    clientUserId: string;
    teacherUserId: string | null;
    slotStart: string;
    absent: boolean;
  }[];
  /** Profesor en licencia → reemplazo aprobado ese día. */
  teacherRemap?: Map<string, string>;
}): Omit<DayAgendaSlot, "slotStart"> {
  const remap = (userId: string) =>
    input.teacherRemap?.get(userId) ?? userId;
  const teacherIds = new Set<string>();
  for (const shift of input.shifts) {
    if (
      shift.weekday === input.weekday &&
      hourCovers(shift.startHour, shift.endHour, input.slotStart)
    ) {
      teacherIds.add(remap(shift.teacherUserId));
    }
  }
  const slotRows = input.rows.filter((item) => item.slotStart === input.slotStart);
  for (const row of slotRows) {
    if (row.teacherUserId) teacherIds.add(remap(row.teacherUserId));
  }
  const studentsByTeacher = new Map<string, NextHourPerson[]>();
  const unassignedStudents: NextHourPerson[] = [];
  for (const row of slotRows) {
    const student: NextHourPerson = {
      ...personFromMember(row.clientUserId, input.members, "Alumno"),
      absent: row.absent,
    };
    if (!row.teacherUserId) {
      unassignedStudents.push(student);
      continue;
    }
    const teacherId = remap(row.teacherUserId);
    const list = studentsByTeacher.get(teacherId) ?? [];
    list.push(student);
    studentsByTeacher.set(teacherId, list);
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
  const useMonthTurns = Boolean(absentOn) && isInMonthTurnWindow(absentOn);
  if (useMonthTurns) {
    await syncFixedMonthTurns(studio.id);
    await fillWaitlist(studio.id);
  }
  const db = getDb();
  const [members, shifts, reservations, absences, turns] = await Promise.all([
    db
      .select()
      .from(studioMemberships)
      .where(eq(studioMemberships.studioId, studio.id)),
    db
      .select()
      .from(studioTeacherShifts)
      .where(eq(studioTeacherShifts.studioId, studio.id)),
    useMonthTurns
      ? Promise.resolve([] as (typeof studioReservations.$inferSelect)[])
      : db
          .select()
          .from(studioReservations)
          .where(
            and(
              eq(studioReservations.studioId, studio.id),
              eq(studioReservations.weekday, day)
            )
          ),
    useMonthTurns || !absentOn
      ? Promise.resolve([] as { clientUserId: string }[])
      : db
          .select({ clientUserId: studioAbsences.clientUserId })
          .from(studioAbsences)
          .where(
            and(
              eq(studioAbsences.studioId, studio.id),
              eq(studioAbsences.absentOn, absentOn)
            )
          ),
    useMonthTurns
      ? db
          .select()
          .from(studioMonthTurns)
          .where(
            and(
              eq(studioMonthTurns.studioId, studio.id),
              eq(studioMonthTurns.occursOn, absentOn)
            )
          )
      : Promise.resolve([] as (typeof studioMonthTurns.$inferSelect)[]),
  ]);
  const memberById = new Map(members.map((item) => [item.userId, item]));
  const absentClientIds = new Set(absences.map((item) => item.clientUserId));
  const teacherRemap = absentOn
    ? await teacherLeaveRemapForDay(studio.id, absentOn)
    : new Map<string, string>();
  const rows = useMonthTurns
    ? turns.map((item) => ({
        clientUserId: item.clientUserId,
        teacherUserId: item.teacherUserId,
        slotStart: item.slotStart,
        absent: item.status === "absent",
      }))
    : reservations.map((item) => ({
        clientUserId: item.clientUserId,
        teacherUserId: item.teacherUserId,
        slotStart: item.slotStart,
        absent: absentClientIds.has(item.clientUserId),
      }));
  const slots = hours
    ? hourSlots(hours.openFrom, hours.openTo).map((slotStart) => ({
        slotStart,
        ...attendanceForSlot({
          weekday: day,
          slotStart,
          members: memberById,
          shifts,
          rows,
          teacherRemap,
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

export type WeekAgendaDay = {
  occursOn: string;
  weekday: number;
  slots: DayAgendaSlot[];
};

export type RecoverableStudent = {
  userId: string;
  name: string;
  turnPlan: TurnPlan;
  credits: number;
};

function roomForRows(
  studio: Studio,
  hours: StudioDayHours,
  rows: { clientUserId: string; absent: boolean }[],
  activitiesByClient: Map<string, StudioKind[]>
) {
  let gymTaken = 0;
  let pilatesTaken = 0;
  for (const row of rows) {
    if (row.absent) continue;
    const activities =
      activitiesByClient.get(row.clientUserId) ?? studio.kinds;
    if (activities.includes("gym")) gymTaken += 1;
    if (activities.includes("pilates")) pilatesTaken += 1;
  }
  const parts: { taken: number; capacity: number }[] = [];
  if (studioHasKind(studio.kinds, "gym")) {
    parts.push({ taken: gymTaken, capacity: dayKindCapacity(hours, "gym") });
  }
  if (studioHasKind(studio.kinds, "pilates")) {
    parts.push({
      taken: pilatesTaken,
      capacity: dayKindCapacity(hours, "pilates"),
    });
  }
  const free =
    parts.length === 0
      ? 0
      : Math.min(
          ...parts.map((part) => Math.max(0, part.capacity - part.taken))
        );
  return {
    free,
    occupancy: occupancyText(parts),
  };
}

function occupancyText(parts: { taken: number; capacity: number }[]) {
  return `Ocupación: ${parts
    .map((part) => `${part.taken} / ${part.capacity}`)
    .join(" · ")}`;
}

async function releaseExpiredWaitlist(studioId: string) {
  await getDb()
    .delete(studioWaitlist)
    .where(
      and(
        eq(studioWaitlist.studioId, studioId),
        lte(studioWaitlist.occursOn, todayBillingYmd())
      )
    );
}

/**
 * Si hay lugar, asigna el turno al primero de la lista que pueda tomarlo.
 * Quien no entra por su actividad sigue en la fila.
 */
export async function fillWaitlist(
  studioId: string,
  only?: { occursOn: string; slotStart: string }
) {
  const today = todayBillingYmd();
  const db = getDb();
  await releaseExpiredWaitlist(studioId);
  const filters = [
    eq(studioWaitlist.studioId, studioId),
    gte(studioWaitlist.occursOn, today),
  ];
  if (only) {
    filters.push(eq(studioWaitlist.occursOn, only.occursOn));
    filters.push(eq(studioWaitlist.slotStart, only.slotStart));
  }
  const queued = await db
    .select()
    .from(studioWaitlist)
    .where(and(...filters))
    .orderBy(asc(studioWaitlist.createdAt));
  if (!queued.length) return;

  const [studioRow] = await db
    .select()
    .from(studios)
    .where(eq(studios.id, studioId))
    .limit(1);
  if (!studioRow) return;
  const studio = toStudio(studioRow);
  const [shifts, members] = await Promise.all([
    db
      .select()
      .from(studioTeacherShifts)
      .where(eq(studioTeacherShifts.studioId, studioId)),
    db
      .select()
      .from(studioMemberships)
      .where(eq(studioMemberships.studioId, studioId)),
  ]);
  const memberById = new Map(members.map((item) => [item.userId, item]));
  const activitiesByClient = new Map(
    members
      .filter((item) => item.role === "client")
      .map(
        (item) =>
          [item.userId, memberActivities(item.activities, studio.kinds)] as const
      )
  );
  const slots = new Map<string, (typeof queued)[number][]>();
  for (const entry of queued) {
    const key = `${entry.occursOn}|${entry.slotStart}`;
    const list = slots.get(key) ?? [];
    list.push(entry);
    slots.set(key, list);
  }

  for (const [key, entries] of slots) {
    const [occursOn, slotStart] = key.split("|");
    const weekday = new Date(`${occursOn}T12:00:00`).getDay();
    const hours = hoursForWeekday(studio.dayHours, weekday);
    if (!hours) continue;
    const covering = shifts.filter(
      (shift) =>
        shift.weekday === weekday &&
        hourCovers(shift.startHour, shift.endHour, slotStart)
    );
    if (!covering.length) continue;
    const gymCapacity = studioHasKind(studio.kinds, "gym")
      ? dayKindCapacity(hours, "gym")
      : 0;
    const pilatesCapacity = studioHasKind(studio.kinds, "pilates")
      ? dayKindCapacity(hours, "pilates")
      : 0;

    for (const entry of entries) {
      const member = memberById.get(entry.clientUserId);
      if (!member || member.role !== "client") {
        await db
          .delete(studioWaitlist)
          .where(eq(studioWaitlist.id, entry.id));
        continue;
      }
      if (member.paymentStatus === "paused") {
        await db
          .delete(studioWaitlist)
          .where(eq(studioWaitlist.id, entry.id));
        continue;
      }
      if (parseTurnPlan(member.turnPlan) === "fixed") {
        const [moved] = await db
          .select({ id: studioMonthTurns.id })
          .from(studioMonthTurns)
          .where(
            and(
              eq(studioMonthTurns.studioId, studioId),
              eq(studioMonthTurns.clientUserId, entry.clientUserId),
              eq(studioMonthTurns.occursOn, occursOn),
              eq(studioMonthTurns.source, "recovery"),
              eq(studioMonthTurns.status, "scheduled")
            )
          )
          .limit(1);
        if (moved) {
          await db
            .delete(studioWaitlist)
            .where(eq(studioWaitlist.id, entry.id));
          continue;
        }
      }
      const scheduled = await db
        .select({
          clientUserId: studioMonthTurns.clientUserId,
        })
        .from(studioMonthTurns)
        .where(
          and(
            eq(studioMonthTurns.studioId, studioId),
            eq(studioMonthTurns.occursOn, occursOn),
            eq(studioMonthTurns.slotStart, slotStart),
            eq(studioMonthTurns.status, "scheduled")
          )
        );
      if (scheduled.some((item) => item.clientUserId === entry.clientUserId)) {
        await db
          .delete(studioWaitlist)
          .where(eq(studioWaitlist.id, entry.id));
        continue;
      }
      let gymTaken = 0;
      let pilatesTaken = 0;
      for (const turn of scheduled) {
        const activities =
          activitiesByClient.get(turn.clientUserId) ?? studio.kinds;
        if (activities.includes("gym")) gymTaken += 1;
        if (activities.includes("pilates")) pilatesTaken += 1;
      }
      const mine = activitiesByClient.get(entry.clientUserId) ?? studio.kinds;
      const full = occupancyForActivities(
        { gymTaken, gymCapacity, pilatesTaken, pilatesCapacity },
        mine
      ).full;
      if (full) continue;
      const chosen =
        covering.find(
          (shift) => shift.teacherUserId === member.assignedTeacherUserId
        ) ?? covering[0];
      const [ownTurn] = await db
        .select({
          id: studioMonthTurns.id,
          status: studioMonthTurns.status,
        })
        .from(studioMonthTurns)
        .where(
          and(
            eq(studioMonthTurns.studioId, studioId),
            eq(studioMonthTurns.clientUserId, entry.clientUserId),
            eq(studioMonthTurns.occursOn, occursOn),
            eq(studioMonthTurns.slotStart, slotStart)
          )
        )
        .limit(1);
      if (ownTurn?.status === "scheduled") {
        await db
          .delete(studioWaitlist)
          .where(eq(studioWaitlist.id, entry.id));
        continue;
      }
      if (ownTurn) {
        await db
          .update(studioMonthTurns)
          .set({
            status: "scheduled",
            source: "recovery",
            teacherUserId: chosen.teacherUserId,
            weekday,
          })
          .where(eq(studioMonthTurns.id, ownTurn.id));
      } else {
        await db.insert(studioMonthTurns).values({
          id: uid(),
          studioId,
          clientUserId: entry.clientUserId,
          occursOn,
          weekday,
          slotStart,
          teacherUserId: chosen.teacherUserId,
          source: "recovery",
          status: "scheduled",
        });
      }
      if (parseTurnPlan(member.turnPlan) === "fixed") {
        await db
          .delete(studioWaitlist)
          .where(
            and(
              eq(studioWaitlist.studioId, studioId),
              eq(studioWaitlist.clientUserId, entry.clientUserId),
              eq(studioWaitlist.occursOn, occursOn)
            )
          );
      } else {
        await db.delete(studioWaitlist).where(eq(studioWaitlist.id, entry.id));
      }
    }
  }
}

/** Agenda de una semana, de lunes a domingo, con los turnos fechados. */
export async function loadWeekAgenda(studioId: string, weekStart?: string) {
  const { studio } = await requireStudioOwner(studioId);
  const bounds = turnGridBounds();
  const raw = weekStart?.trim() ?? "";
  const monday = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? mondayOfYmd(raw)
    : mondayOfYmd(bounds.today);
  const sunday = shiftYmd(monday, 6);
  await syncFixedMonthTurns(studio.id);
  await fillWaitlist(studio.id);
  const db = getDb();
  const today = bounds.today;
  const [members, shifts, turns, reservations, absences, waitRows, creditAbsences, recoveryTurns, heldWaits] =
    await Promise.all([
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
      .from(studioMonthTurns)
      .where(
        and(
          eq(studioMonthTurns.studioId, studio.id),
          gte(studioMonthTurns.occursOn, monday),
          lte(studioMonthTurns.occursOn, sunday)
        )
      ),
    db
      .select()
      .from(studioReservations)
      .where(eq(studioReservations.studioId, studio.id)),
    db
      .select({
        clientUserId: studioAbsences.clientUserId,
        absentOn: studioAbsences.absentOn,
      })
      .from(studioAbsences)
      .where(
        and(
          eq(studioAbsences.studioId, studio.id),
          gte(studioAbsences.absentOn, monday),
          lte(studioAbsences.absentOn, sunday)
        )
      ),
    db
      .select({
        clientUserId: studioWaitlist.clientUserId,
        occursOn: studioWaitlist.occursOn,
        slotStart: studioWaitlist.slotStart,
      })
      .from(studioWaitlist)
      .where(
        and(
          eq(studioWaitlist.studioId, studio.id),
          gte(studioWaitlist.occursOn, monday),
          lte(studioWaitlist.occursOn, sunday)
        )
      )
      .orderBy(asc(studioWaitlist.createdAt)),
    db
      .select({
        clientUserId: studioAbsences.clientUserId,
        absentOn: studioAbsences.absentOn,
        outcome: studioAbsences.outcome,
      })
      .from(studioAbsences)
      .where(eq(studioAbsences.studioId, studio.id)),
    db
      .select({
        clientUserId: studioMonthTurns.clientUserId,
        occursOn: studioMonthTurns.occursOn,
      })
      .from(studioMonthTurns)
      .where(
        and(
          eq(studioMonthTurns.studioId, studio.id),
          eq(studioMonthTurns.source, "recovery"),
          eq(studioMonthTurns.status, "scheduled")
        )
      ),
    db
      .select({
        clientUserId: studioWaitlist.clientUserId,
        occursOn: studioWaitlist.occursOn,
      })
      .from(studioWaitlist)
      .where(
        and(
          eq(studioWaitlist.studioId, studio.id),
          gt(studioWaitlist.occursOn, today)
        )
      ),
  ]);
  const memberById = new Map(members.map((item) => [item.userId, item]));
  const activitiesByClient = new Map(
    members
      .filter((item) => item.role === "client")
      .map(
        (item) =>
          [item.userId, memberActivities(item.activities, studio.kinds)] as const
      )
  );
  const remapsByDay = await teacherLeaveRemapByDay(studio.id, monday, sunday);
  const days: WeekAgendaDay[] = Array.from({ length: 7 }, (_, index) => {
    const occursOn = shiftYmd(monday, index);
    const weekday = new Date(`${occursOn}T12:00:00`).getDay();
    const hours = hoursForWeekday(studio.dayHours, weekday);
    const useMonth = isInMonthTurnWindow(occursOn, bounds.today);
    const absentIds = new Set(
      absences
        .filter((item) => item.absentOn === occursOn)
        .map((item) => item.clientUserId)
    );
    const teacherRemap = new Map<string, string>();
    for (const [key, replacement] of remapsByDay) {
      if (key.startsWith(`${occursOn}|`)) {
        teacherRemap.set(key.slice(occursOn.length + 1), replacement);
      }
    }
    const rows = useMonth
      ? turns
          .filter((item) => item.occursOn === occursOn)
          .map((item) => ({
            clientUserId: item.clientUserId,
            teacherUserId: item.teacherUserId,
            slotStart: item.slotStart,
            absent: item.status === "absent",
          }))
      : reservations
          .filter((item) => item.weekday === weekday)
          .map((item) => ({
            clientUserId: item.clientUserId,
            teacherUserId: item.teacherUserId,
            slotStart: item.slotStart,
            absent: absentIds.has(item.clientUserId),
          }));
    const slots = hours
      ? hourSlots(hours.openFrom, hours.openTo).map((slotStart) => {
          const slotRows = rows.filter((item) => item.slotStart === slotStart);
          return {
            slotStart,
            ...attendanceForSlot({
              weekday,
              slotStart,
              members: memberById,
              shifts,
              rows,
              teacherRemap,
            }),
            ...roomForRows(studio, hours, slotRows, activitiesByClient),
            waiting: waitRows
              .filter(
                (item) =>
                  item.occursOn === occursOn && item.slotStart === slotStart
              )
              .map((item) =>
                personFromMember(item.clientUserId, memberById, "Alumno")
              ),
          };
        })
      : [];
    return { occursOn, weekday, slots };
  });
  const creditsByClient = new Map<
    string,
    { ymd: string; outcome: "credit" | "notice" }[]
  >();
  const spendsByClient = new Map<string, { ymd: string }[]>();
  for (const item of creditAbsences) {
    const list = creditsByClient.get(item.clientUserId) ?? [];
    list.push({ ymd: item.absentOn, outcome: item.outcome });
    creditsByClient.set(item.clientUserId, list);
  }
  for (const item of [...recoveryTurns, ...heldWaits]) {
    const list = spendsByClient.get(item.clientUserId) ?? [];
    list.push({ ymd: item.occursOn });
    spendsByClient.set(item.clientUserId, list);
  }
  const recoverable: RecoverableStudent[] = members
    .filter((item) => item.role === "client")
    .map((item) => {
      const turnPlan = parseTurnPlan(item.turnPlan);
      return {
        userId: item.userId,
        name: item.displayName || "Alumno",
        turnPlan,
        credits: recoveryCreditCount(
          turnPlan,
          creditsByClient.get(item.userId) ?? [],
          spendsByClient.get(item.userId) ?? []
        ),
      };
    })
    .filter((item) => item.credits > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
  return {
    name: studio.name,
    today: bounds.today,
    from: mondayOfYmd(bounds.from),
    to: bounds.to,
    weekStart: monday,
    days,
    recoverable,
  };
}

/** El estudio anula el turno de un alumno y libera el cupo. */
export async function annulStudentTurn(
  studioId: string,
  clientUserId: string,
  occursOn: string,
  slotStart: string
) {
  const { studio } = await requireStudioOwner(studioId);
  const ymd = occursOn.trim();
  const hour = slotStart.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    throw new Error("Esa fecha no es válida.");
  }
  if (!/^\d{2}:\d{2}$/.test(hour)) {
    throw new Error("Ese horario no es válido.");
  }
  const today = todayBillingYmd();
  if (ymd < today) throw new Error("Esa clase ya pasó.");
  await syncFixedMonthTurns(studio.id, clientUserId);
  const db = getDb();
  const [turn] = await db
    .select()
    .from(studioMonthTurns)
    .where(
      and(
        eq(studioMonthTurns.studioId, studio.id),
        eq(studioMonthTurns.clientUserId, clientUserId),
        eq(studioMonthTurns.occursOn, ymd),
        eq(studioMonthTurns.slotStart, hour),
        eq(studioMonthTurns.status, "scheduled")
      )
    )
    .limit(1);
  if (!turn) throw new Error("Ese alumno no tiene turno en ese horario.");
  if (turn.source === "recovery") {
    await db
      .delete(studioMonthTurns)
      .where(eq(studioMonthTurns.id, turn.id));
    await fillWaitlist(studio.id, { occursOn: ymd, slotStart: hour });
    return loadWeekAgenda(studio.id, mondayOfYmd(ymd));
  }
  const prior = await db
    .select({
      outcome: studioAbsences.outcome,
      absentOn: studioAbsences.absentOn,
    })
    .from(studioAbsences)
    .where(
      and(
        eq(studioAbsences.studioId, studio.id),
        eq(studioAbsences.clientUserId, clientUserId)
      )
    );
  if (!prior.some((item) => item.absentOn === ymd)) {
    const usedThisMonth = prior.filter(
      (item) =>
        item.outcome === "credit" && item.absentOn.startsWith(ymd.slice(0, 7))
    ).length;
    await db.insert(studioAbsences).values({
      id: uid(),
      studioId: studio.id,
      clientUserId,
      absentOn: ymd,
      weekday: turn.weekday,
      slotStart: hour,
      outcome: cancellationOutcome({
        classAt: classStart(ymd, hour),
        now: new Date(),
        noticeHours: studio.cancelNoticeHours,
        usedThisMonth,
        maxPerMonth: studio.maxCancelsPerMonth,
      }),
    });
  }
  await db
    .update(studioMonthTurns)
    .set({ status: "absent" })
    .where(eq(studioMonthTurns.id, turn.id));
  await fillWaitlist(studio.id, { occursOn: ymd, slotStart: hour });
  return loadWeekAgenda(studio.id, mondayOfYmd(ymd));
}

/** El estudio saca a un alumno de la lista de espera. El crédito vuelve a quedar libre. */
export async function removeStudentFromWaitlist(
  studioId: string,
  clientUserId: string,
  occursOn: string,
  slotStart: string
) {
  const { studio } = await requireStudioOwner(studioId);
  const ymd = occursOn.trim();
  const hour = slotStart.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    throw new Error("Esa fecha no es válida.");
  }
  if (!/^\d{2}:\d{2}$/.test(hour)) {
    throw new Error("Ese horario no es válido.");
  }
  const db = getDb();
  const [row] = await db
    .select({ id: studioWaitlist.id })
    .from(studioWaitlist)
    .where(
      and(
        eq(studioWaitlist.studioId, studio.id),
        eq(studioWaitlist.clientUserId, clientUserId),
        eq(studioWaitlist.occursOn, ymd),
        eq(studioWaitlist.slotStart, hour)
      )
    )
    .limit(1);
  if (!row) throw new Error("Ese alumno no está en la lista de espera.");
  await db.delete(studioWaitlist).where(eq(studioWaitlist.id, row.id));
  return loadWeekAgenda(studio.id, mondayOfYmd(ymd));
}

/** El estudio anota a un alumno con crédito: en el turno si hay lugar, si no en la espera. */
export async function enrollStudentWithCredit(
  studioId: string,
  clientUserId: string,
  occursOn: string,
  slotStart: string
) {
  const { studio } = await requireStudioOwner(studioId);
  const ymd = occursOn.trim();
  const hour = slotStart.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    throw new Error("Esa fecha no es válida.");
  }
  if (!/^\d{2}:\d{2}$/.test(hour)) {
    throw new Error("Ese horario no es válido.");
  }
  const today = todayBillingYmd();
  if (ymd < today) throw new Error("Esa clase ya pasó.");
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
  if (!member) throw new Error("Ese alumno no es de esta sucursal.");
  if (member.paymentStatus === "paused") {
    throw new Error("Esa cuenta está suspendida.");
  }
  const [absences, recoveries, waits, existingRows] = await Promise.all([
    db
      .select({
        absentOn: studioAbsences.absentOn,
        outcome: studioAbsences.outcome,
      })
      .from(studioAbsences)
      .where(
        and(
          eq(studioAbsences.studioId, studio.id),
          eq(studioAbsences.clientUserId, clientUserId)
        )
      ),
    db
      .select({ occursOn: studioMonthTurns.occursOn })
      .from(studioMonthTurns)
      .where(
        and(
          eq(studioMonthTurns.studioId, studio.id),
          eq(studioMonthTurns.clientUserId, clientUserId),
          eq(studioMonthTurns.source, "recovery"),
          eq(studioMonthTurns.status, "scheduled")
        )
      ),
    db
      .select({
        id: studioWaitlist.id,
        occursOn: studioWaitlist.occursOn,
        slotStart: studioWaitlist.slotStart,
      })
      .from(studioWaitlist)
      .where(
        and(
          eq(studioWaitlist.studioId, studio.id),
          eq(studioWaitlist.clientUserId, clientUserId),
          gt(studioWaitlist.occursOn, today)
        )
      ),
    db
      .select({
        id: studioMonthTurns.id,
        status: studioMonthTurns.status,
      })
      .from(studioMonthTurns)
      .where(
        and(
          eq(studioMonthTurns.studioId, studio.id),
          eq(studioMonthTurns.clientUserId, clientUserId),
          eq(studioMonthTurns.occursOn, ymd),
          eq(studioMonthTurns.slotStart, hour)
        )
      )
      .limit(1),
  ]);
  const credits = recoveryCreditCount(
    parseTurnPlan(member.turnPlan),
    absences.map((item) => ({ ymd: item.absentOn, outcome: item.outcome })),
    [
      ...recoveries.map((item) => ({ ymd: item.occursOn })),
      ...waits.map((item) => ({ ymd: item.occursOn })),
    ]
  );
  if (credits < 1) {
    throw new Error("Ese alumno no tiene créditos para recuperar.");
  }
  const existing = existingRows[0];
  if (existing?.status === "scheduled") {
    throw new Error("Ya está anotado en ese horario.");
  }
  if (waits.some((item) => item.occursOn === ymd && item.slotStart === hour)) {
    throw new Error("Ya está en la lista de espera.");
  }
  const weekday = new Date(`${ymd}T12:00:00`).getDay();
  const hours = hoursForWeekday(studio.dayHours, weekday);
  if (!hours) throw new Error("La sucursal está cerrada ese día.");
  const [shifts, scheduled] = await Promise.all([
    db
      .select()
      .from(studioTeacherShifts)
      .where(eq(studioTeacherShifts.studioId, studio.id)),
    db
      .select({ clientUserId: studioMonthTurns.clientUserId })
      .from(studioMonthTurns)
      .where(
        and(
          eq(studioMonthTurns.studioId, studio.id),
          eq(studioMonthTurns.occursOn, ymd),
          eq(studioMonthTurns.slotStart, hour),
          eq(studioMonthTurns.status, "scheduled")
        )
      ),
  ]);
  const covering = shifts.filter(
    (shift) =>
      shift.weekday === weekday &&
      hourCovers(shift.startHour, shift.endHour, hour)
  );
  if (!covering.length) throw new Error("No hay profesor en ese horario.");
  const people = await db
    .select({
      userId: studioMemberships.userId,
      activities: studioMemberships.activities,
    })
    .from(studioMemberships)
    .where(eq(studioMemberships.studioId, studio.id));
  const activitiesByClient = new Map(
    people.map(
      (item) =>
        [item.userId, memberActivities(item.activities, studio.kinds)] as const
    )
  );
  let gymTaken = 0;
  let pilatesTaken = 0;
  for (const turn of scheduled) {
    const activities = activitiesByClient.get(turn.clientUserId) ?? studio.kinds;
    if (activities.includes("gym")) gymTaken += 1;
    if (activities.includes("pilates")) pilatesTaken += 1;
  }
  const mine = activitiesByClient.get(clientUserId) ?? studio.kinds;
  const full = occupancyForActivities(
    {
      gymTaken,
      gymCapacity: studioHasKind(studio.kinds, "gym")
        ? dayKindCapacity(hours, "gym")
        : 0,
      pilatesTaken,
      pilatesCapacity: studioHasKind(studio.kinds, "pilates")
        ? dayKindCapacity(hours, "pilates")
        : 0,
    },
    mine
  ).full;
  if (!full) {
    const chosen =
      covering.find(
        (shift) => shift.teacherUserId === member.assignedTeacherUserId
      ) ?? covering[0];
    if (!chosen) throw new Error("No hay profesor en ese horario.");
    if (existing) {
      await db
        .update(studioMonthTurns)
        .set({
          status: "scheduled",
          source: "recovery",
          teacherUserId: chosen.teacherUserId,
          weekday,
        })
        .where(eq(studioMonthTurns.id, existing.id));
    } else {
      await db.insert(studioMonthTurns).values({
        id: uid(),
        studioId: studio.id,
        clientUserId,
        occursOn: ymd,
        weekday,
        slotStart: hour,
        teacherUserId: chosen.teacherUserId,
        source: "recovery",
        status: "scheduled",
      });
    }
    await fillWaitlist(studio.id, { occursOn: ymd, slotStart: hour });
    return loadWeekAgenda(studio.id, mondayOfYmd(ymd));
  }
  await db.insert(studioWaitlist).values({
    id: uid(),
    studioId: studio.id,
    clientUserId,
    occursOn: ymd,
    weekday,
    slotStart: hour,
  });
  await fillWaitlist(studio.id, { occursOn: ymd, slotStart: hour });
  return loadWeekAgenda(studio.id, mondayOfYmd(ymd));
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
    cancelNoticeHours: parsed.cancelNoticeHours,
    maxCancelsPerMonth: parsed.maxCancelsPerMonth,
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
      cancelNoticeHours: parsed.cancelNoticeHours,
      maxCancelsPerMonth: parsed.maxCancelsPerMonth,
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
    .delete(studioMonthTurns)
    .where(eq(studioMonthTurns.studioId, studio.id));
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
  turnPlan: TurnPlan;
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
        turnPlan: item.role === "client" ? parseTurnPlan(item.turnPlan) : "month",
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
      turnPlan: "month" as TurnPlan,
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
  turnPlan: TurnPlan;
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
  const turnPlan = parseTurnPlan(input.turnPlan);
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
    turnPlan,
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
  turnPlan: TurnPlan;
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
  const turnPlan = parseTurnPlan(input.turnPlan);
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
      turnPlan,
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
    .delete(studioMonthTurns)
    .where(
      and(
        eq(studioMonthTurns.studioId, studio.id),
        eq(studioMonthTurns.clientUserId, clientUserId)
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
  turnPlan: TurnPlan;
  studioId: string;
  studioName: string;
  assignedTeacherUserId: string | null;
  teacherName: string | null;
  hasPlan: boolean;
  planName: string;
  feeAmount: number | null;
  serviceEndsOn: string;
  lastPaidOn: string;
  paymentStatus: ClientPaymentStatus;
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
      turnPlan: parseTurnPlan(item.turnPlan),
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
      paymentStatus:
        item.paymentStatus === "current" ||
        item.paymentStatus === "overdue" ||
        item.paymentStatus === "paused" ||
        item.paymentStatus === "trial" ||
        item.paymentStatus === "comp"
          ? item.paymentStatus
          : "current",
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
  /** El alumno avisó que pagó y falta confirmar. */
  paymentClaimed: boolean;
  paymentClaimedAt: string | null;
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
        paymentClaimed: Boolean(item.paymentClaimedAt),
        paymentClaimedAt: item.paymentClaimedAt
          ? item.paymentClaimedAt.toISOString()
          : null,
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
        if (row.paymentClaimed) return 0;
        if (row.paymentStatus === "overdue" || row.alert === "expired") return 1;
        if (row.alert === "due_soon") return 2;
        if (row.paymentStatus === "paused") return 3;
        return 4;
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

/**
 * Libera turnos futuros del alumno y asigna el primero de la lista de espera
 * en cada horario liberado. No borra la plantilla semanal.
 */
async function releaseClientFutureTurns(
  studioId: string,
  clientUserId: string
) {
  const today = todayBillingYmd();
  const db = getDb();
  const turns = await db
    .select({
      id: studioMonthTurns.id,
      occursOn: studioMonthTurns.occursOn,
      slotStart: studioMonthTurns.slotStart,
    })
    .from(studioMonthTurns)
    .where(
      and(
        eq(studioMonthTurns.studioId, studioId),
        eq(studioMonthTurns.clientUserId, clientUserId),
        gte(studioMonthTurns.occursOn, today),
        eq(studioMonthTurns.status, "scheduled")
      )
    );
  const slots = [
    ...new Map(
      turns.map((item) => [
        `${item.occursOn}|${item.slotStart}`,
        { occursOn: item.occursOn, slotStart: item.slotStart },
      ])
    ).values(),
  ];
  if (turns.length) {
    await db
      .delete(studioMonthTurns)
      .where(
        inArray(
          studioMonthTurns.id,
          turns.map((item) => item.id)
        )
      );
  }
  await db
    .delete(studioWaitlist)
    .where(
      and(
        eq(studioWaitlist.studioId, studioId),
        eq(studioWaitlist.clientUserId, clientUserId),
        gte(studioWaitlist.occursOn, today)
      )
    );
  for (const slot of slots) {
    await fillWaitlist(studioId, slot);
  }
  return slots.length;
}

/** Suspende al alumno: libera turnos y pasa el primero de la lista de espera. */
export async function suspendStudioClient(input: {
  studioId: string;
  clientUserId: string;
}) {
  const { studio, member } = await loadOwnedClientMember(
    input.studioId,
    input.clientUserId
  );
  if (member.paymentStatus === "paused") {
    throw new Error("Esa cuenta ya está suspendida.");
  }
  await getDb()
    .update(studioMemberships)
    .set({
      paymentStatus: "paused",
      paymentClaimedAt: null,
    })
    .where(eq(studioMemberships.id, member.id));
  const freed = await releaseClientFutureTurns(studio.id, member.userId);
  return { freedSlots: freed };
}

/** Reactiva una cuenta suspendida y vuelve a armar los turnos fijos. */
export async function reactivateStudioClient(input: {
  studioId: string;
  clientUserId: string;
}) {
  const { studio, member } = await loadOwnedClientMember(
    input.studioId,
    input.clientUserId
  );
  if (member.paymentStatus !== "paused") {
    throw new Error("Esa cuenta no está suspendida.");
  }
  await getDb()
    .update(studioMemberships)
    .set({ paymentStatus: "current" })
    .where(eq(studioMemberships.id, member.id));
  await syncFixedMonthTurns(studio.id, member.userId);
  return { ok: true as const };
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
  const wasPaused = member.paymentStatus === "paused";
  await getDb()
    .update(studioMemberships)
    .set({
      paymentStatus,
      serviceEndsOn,
      lastPaidOn,
      planName,
      feeAmount,
      billingNotes,
      ...(paymentStatus === "current" ||
      paymentStatus === "paused" ||
      paymentStatus === "comp"
        ? { paymentClaimedAt: null }
        : {}),
    })
    .where(eq(studioMemberships.id, member.id));
  if (paymentStatus === "paused" && !wasPaused) {
    await releaseClientFutureTurns(studio.id, member.userId);
  } else if (wasPaused && paymentStatus !== "paused") {
    await syncFixedMonthTurns(studio.id, member.userId);
  }
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
      paymentClaimedAt: null,
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

/** El estudio rechaza el aviso de pago: el alumno vuelve a ver el mensaje en rojo. */
export async function rejectGymClientPaymentClaim(input: {
  studioId: string;
  clientUserId: string;
}) {
  const { studio, member } = await loadOwnedClientMember(
    input.studioId,
    input.clientUserId
  );
  if (!member.paymentClaimedAt) {
    throw new Error("Ese alumno no avisó un pago pendiente.");
  }
  await getDb()
    .update(studioMemberships)
    .set({ paymentClaimedAt: null })
    .where(eq(studioMemberships.id, member.id));
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

export type TeacherLeaveView = {
  id: string;
  teacherUserId: string;
  teacherName: string;
  startsOn: string;
  endsOn: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  replacementTeacherUserId: string | null;
  replacementTeacherName: string | null;
  note: string;
  createdAt: string;
};

export type LeaveReplacementOption = {
  userId: string;
  displayName: string;
};

async function teacherGymOwnerId(teacherUserId: string) {
  const db = getDb();
  const [gymRow] = await db
    .select({ ownerUserId: gymTeachers.ownerUserId })
    .from(gymTeachers)
    .where(eq(gymTeachers.userId, teacherUserId))
    .limit(1);
  if (gymRow) return gymRow.ownerUserId;
  const members = await membershipsFor(teacherUserId);
  const teacherStudios = members.filter((item) => item.role === "teacher");
  if (!teacherStudios.length) return null;
  const [studio] = await db
    .select({ ownerUserId: studios.ownerUserId })
    .from(studios)
    .where(eq(studios.id, teacherStudios[0].studioId))
    .limit(1);
  return studio?.ownerUserId ?? null;
}

async function teacherLeaveViews(
  rows: (typeof studioTeacherLeaves.$inferSelect)[]
): Promise<TeacherLeaveView[]> {
  if (!rows.length) return [];
  const teacherIds = [
    ...new Set(
      rows.flatMap((item) =>
        [item.teacherUserId, item.replacementTeacherUserId].filter(
          (id): id is string => Boolean(id)
        )
      )
    ),
  ];
  const gymRows = await getDb()
    .select({
      userId: gymTeachers.userId,
      displayName: gymTeachers.displayName,
      ownerUserId: gymTeachers.ownerUserId,
    })
    .from(gymTeachers)
    .where(inArray(gymTeachers.userId, teacherIds));
  const nameByUser = new Map(
    gymRows.map((item) => [item.userId, item.displayName] as const)
  );
  return rows.map((row) => ({
    id: row.id,
    teacherUserId: row.teacherUserId,
    teacherName: nameByUser.get(row.teacherUserId) || "Profesor",
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    status: row.status,
    replacementTeacherUserId: row.replacementTeacherUserId,
    replacementTeacherName: row.replacementTeacherUserId
      ? nameByUser.get(row.replacementTeacherUserId) || "Profesor"
      : null,
    note: row.note ?? "",
    createdAt: row.createdAt.toISOString(),
  }));
}

/** El profesor pide una licencia (desde–hasta). */
export async function requestTeacherLeave(input: {
  startsOn: string;
  endsOn: string;
  note?: string;
}) {
  const userId = await requireUserId();
  const startsOn = input.startsOn.trim();
  const endsOn = input.endsOn.trim();
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(startsOn) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(endsOn)
  ) {
    throw new Error("Esas fechas no son válidas.");
  }
  if (endsOn < startsOn) {
    throw new Error("La fecha hasta no puede ser anterior al desde.");
  }
  const today = todayBillingYmd();
  if (endsOn < today) throw new Error("Ese período ya pasó.");
  if (startsOn < today) {
    throw new Error("La licencia tiene que empezar hoy o después.");
  }
  let days = 0;
  for (let cursor = startsOn; cursor <= endsOn; cursor = shiftYmd(cursor, 1)) {
    days += 1;
    if (days > 90) throw new Error("La licencia no puede superar 90 días.");
  }
  const ownerUserId = await teacherGymOwnerId(userId);
  if (!ownerUserId) {
    throw new Error("No estás vinculado a un gimnasio.");
  }
  const note = (input.note ?? "").trim().slice(0, 200);
  const db = getDb();
  const overlapping = await db
    .select({ id: studioTeacherLeaves.id })
    .from(studioTeacherLeaves)
    .where(
      and(
        eq(studioTeacherLeaves.ownerUserId, ownerUserId),
        eq(studioTeacherLeaves.teacherUserId, userId),
        inArray(studioTeacherLeaves.status, ["pending", "approved"]),
        lte(studioTeacherLeaves.startsOn, endsOn),
        gte(studioTeacherLeaves.endsOn, startsOn)
      )
    )
    .limit(1);
  if (overlapping.length) {
    throw new Error("Ya tenés una licencia que se solapa con esas fechas.");
  }
  await db.insert(studioTeacherLeaves).values({
    id: uid(),
    ownerUserId,
    teacherUserId: userId,
    startsOn,
    endsOn,
    status: "pending",
    note,
  });
  return listOwnTeacherLeaves();
}

/** El profesor cancela una licencia todavía pendiente. */
export async function cancelTeacherLeave(leaveId: string) {
  const userId = await requireUserId();
  const db = getDb();
  const [row] = await db
    .select()
    .from(studioTeacherLeaves)
    .where(eq(studioTeacherLeaves.id, leaveId.trim()))
    .limit(1);
  if (!row || row.teacherUserId !== userId) {
    throw new Error("No encontré esa licencia.");
  }
  if (row.status !== "pending") {
    throw new Error("Esa licencia ya no se puede cancelar.");
  }
  await db
    .update(studioTeacherLeaves)
    .set({ status: "cancelled", resolvedAt: new Date() })
    .where(eq(studioTeacherLeaves.id, row.id));
  return listOwnTeacherLeaves();
}

/** Licencias del profesor logueado (pendientes y próximas confirmadas). */
export async function listOwnTeacherLeaves(): Promise<TeacherLeaveView[]> {
  const userId = await requireUserId();
  const today = todayBillingYmd();
  const rows = await getDb()
    .select()
    .from(studioTeacherLeaves)
    .where(
      and(
        eq(studioTeacherLeaves.teacherUserId, userId),
        gte(studioTeacherLeaves.endsOn, today),
        inArray(studioTeacherLeaves.status, ["pending", "approved"])
      )
    )
    .orderBy(asc(studioTeacherLeaves.startsOn));
  return teacherLeaveViews(rows);
}

/** Licencias pendientes para el estudio. */
export async function listPendingTeacherLeaves(): Promise<TeacherLeaveView[]> {
  const { userId } = await requireOwnedGym();
  const today = todayBillingYmd();
  const rows = await getDb()
    .select()
    .from(studioTeacherLeaves)
    .where(
      and(
        eq(studioTeacherLeaves.ownerUserId, userId),
        eq(studioTeacherLeaves.status, "pending"),
        gte(studioTeacherLeaves.endsOn, today)
      )
    )
    .orderBy(asc(studioTeacherLeaves.startsOn));
  return teacherLeaveViews(rows);
}

/** Otros profesores del gimnasio que pueden cubrir la licencia. */
export async function listLeaveReplacementTeachers(
  absentTeacherUserId: string
): Promise<LeaveReplacementOption[]> {
  const { userId } = await requireOwnedGym();
  const rows = await getDb()
    .select({
      userId: gymTeachers.userId,
      displayName: gymTeachers.displayName,
    })
    .from(gymTeachers)
    .where(
      and(
        eq(gymTeachers.ownerUserId, userId),
        eq(gymTeachers.active, true),
        ne(gymTeachers.userId, absentTeacherUserId.trim())
      )
    );
  return rows
    .map((item) => ({
      userId: item.userId,
      displayName: item.displayName || "Profesor",
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "es"));
}

/** El estudio confirma o rechaza la licencia; si aprueba, elige reemplazo. */
export async function resolveTeacherLeave(input: {
  leaveId: string;
  decision: "approved" | "rejected";
  replacementTeacherUserId?: string | null;
}) {
  const { userId, branches } = await requireOwnedGym();
  const db = getDb();
  const [row] = await db
    .select()
    .from(studioTeacherLeaves)
    .where(eq(studioTeacherLeaves.id, input.leaveId.trim()))
    .limit(1);
  if (!row || row.status !== "pending" || row.ownerUserId !== userId) {
    throw new Error("Esa licencia ya no está pendiente.");
  }
  if (input.decision === "rejected") {
    await db
      .update(studioTeacherLeaves)
      .set({
        status: "rejected",
        resolvedAt: new Date(),
        replacementTeacherUserId: null,
      })
      .where(eq(studioTeacherLeaves.id, row.id));
    return listPendingTeacherLeaves();
  }
  const replacementId = (input.replacementTeacherUserId ?? "").trim();
  if (!replacementId) {
    throw new Error("Elegí un profesor de reemplazo.");
  }
  if (replacementId === row.teacherUserId) {
    throw new Error("El reemplazo tiene que ser otro profesor.");
  }
  const [replacement] = await db
    .select({ id: gymTeachers.id })
    .from(gymTeachers)
    .where(
      and(
        eq(gymTeachers.ownerUserId, userId),
        eq(gymTeachers.userId, replacementId),
        eq(gymTeachers.active, true)
      )
    )
    .limit(1);
  if (!replacement) {
    throw new Error("Ese profesor no está en el gimnasio.");
  }
  const studioIds = branches.map((item) => item.id);
  await Promise.all(studioIds.map((id) => syncFixedMonthTurns(id)));
  if (studioIds.length) {
    await db
      .update(studioMonthTurns)
      .set({ teacherUserId: replacementId })
      .where(
        and(
          inArray(studioMonthTurns.studioId, studioIds),
          eq(studioMonthTurns.teacherUserId, row.teacherUserId),
          gte(studioMonthTurns.occursOn, row.startsOn),
          lte(studioMonthTurns.occursOn, row.endsOn)
        )
      );
  }
  await db
    .update(studioTeacherLeaves)
    .set({
      status: "approved",
      replacementTeacherUserId: replacementId,
      resolvedAt: new Date(),
    })
    .where(eq(studioTeacherLeaves.id, row.id));
  return listPendingTeacherLeaves();
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

export type ClientMonthTurn = {
  id: string;
  occursOn: string;
  weekday: number;
  slotStart: string;
  teacherName: string | null;
  status: "scheduled" | "absent";
  source: "fixed" | "recovery";
  outcome: "credit" | "notice" | null;
};

export type RecoverySlot = {
  slotStart: string;
  full: boolean;
  bookable: boolean;
  /** Clase propia todavía vigente en ese horario. */
  mine: boolean;
  /** Reservado. Un aviso propio no bloquea anotarse ni la lista de espera. */
  held: boolean;
  /** El alumno ya está en la lista de espera de ese horario. */
  waiting: boolean;
  open: boolean;
  /** Lugares libres para las actividades del alumno. */
  free: number;
  /** Ocupación visible, por ejemplo "5/8". */
  occupancy: string;
  /** Profesores que cubren ese horario. */
  teachers: string;
};

export type RecoveryDay = {
  occursOn: string;
  slots: RecoverySlot[];
};

export type ClientCreditState = {
  /** Suma de los créditos que todavía se pueden usar, mes por mes. */
  balance: number;
  noticeHours: number;
  maxPerMonth: number;
  /** Ausencias del mes en curso, con o sin crédito. */
  usedThisMonth: number;
  /** Ausencias de cada mes de la clase, con o sin crédito. */
  usedByMonth: Record<string, number>;
  /** Créditos libres de cada mes. No se arrastran al mes siguiente. */
  creditsByMonth: Record<string, number>;
  /** Créditos libres de cada semana, con clave el lunes. */
  creditsByWeek: Record<string, number>;
  /** Cancelaciones que todavía puede hacer en cada mes de la clase. */
  cancelsLeftByMonth: Record<string, number>;
  /** Meses de la agenda, de más viejo a más nuevo. */
  months: string[];
  /** Semanas de la agenda, con el lunes de cada una. */
  weeks: string[];
  turnPlan: TurnPlan;
};

function recoveryDaysFor(input: {
  studio: Studio;
  shifts: { teacherUserId: string; weekday: number; startHour: string; endHour: string }[];
  activities: StudioKind[];
  from: string;
  to: string;
  assignedTeacherId?: string | null;
  teacherNames: Map<string, string>;
  turns: {
    clientUserId: string;
    occursOn: string;
    slotStart: string;
    status: string;
  }[];
  mine: { occursOn: string; slotStart: string; status: string }[];
  activitiesByClient: Map<string, StudioKind[]>;
  waiting: Set<string>;
}): RecoveryDay[] {
  const days: RecoveryDay[] = [];
  let cursor = input.from;
  while (cursor <= input.to && days.length < 120) {
    const weekday = new Date(`${cursor}T12:00:00`).getDay();
    const hours = hoursForWeekday(input.studio.dayHours, weekday);
    if (hours) {
      const slots = hourSlots(hours.openFrom, hours.openTo).map((slotStart) => {
        const covering = input.shifts.some(
          (shift) =>
            shift.weekday === weekday &&
            hourCovers(shift.startHour, shift.endHour, slotStart)
        );
        const scheduled = input.turns.filter(
          (item) =>
            item.occursOn === cursor &&
            item.slotStart === slotStart &&
            item.status === "scheduled"
        );
        let gymTaken = 0;
        let pilatesTaken = 0;
        for (const item of scheduled) {
          const activities =
            input.activitiesByClient.get(item.clientUserId) ?? input.studio.kinds;
          if (activities.includes("gym")) gymTaken += 1;
          if (activities.includes("pilates")) pilatesTaken += 1;
        }
        const gymCapacity = studioHasKind(input.studio.kinds, "gym")
          ? dayKindCapacity(hours, "gym")
          : 0;
        const pilatesCapacity = studioHasKind(input.studio.kinds, "pilates")
          ? dayKindCapacity(hours, "pilates")
          : 0;
        const counts = occupancyForActivities(
          { gymTaken, gymCapacity, pilatesTaken, pilatesCapacity },
          input.activities
        );
        const parts: { taken: number; capacity: number }[] = [];
        if (input.activities.includes("gym")) {
          parts.push({ taken: gymTaken, capacity: gymCapacity });
        }
        if (input.activities.includes("pilates")) {
          parts.push({ taken: pilatesTaken, capacity: pilatesCapacity });
        }
        const free =
          parts.length === 0
            ? 0
            : Math.min(
                ...parts.map((part) =>
                  Math.max(0, part.capacity - part.taken)
                )
              );
        const teacherIds = [
          ...new Set(
            input.shifts
              .filter(
                (shift) =>
                  shift.weekday === weekday &&
                  hourCovers(shift.startHour, shift.endHour, slotStart)
              )
              .map((shift) => shift.teacherUserId)
          ),
        ].sort((a, b) => {
          if (input.assignedTeacherId) {
            if (a === input.assignedTeacherId) return -1;
            if (b === input.assignedTeacherId) return 1;
          }
          return (input.teacherNames.get(a) ?? "").localeCompare(
            input.teacherNames.get(b) ?? "",
            "es"
          );
        });
        const own = input.mine.filter(
          (item) => item.occursOn === cursor && item.slotStart === slotStart
        );
        const mine = own.some((item) => item.status === "scheduled");
        const held = false;
        return {
          slotStart,
          full: counts.full,
          mine,
          held,
          waiting: input.waiting.has(`${cursor}|${slotStart}`),
          open: covering,
          bookable: covering && !counts.full && !held,
          free,
          occupancy: occupancyText(parts),
          teachers: teacherIds
            .map((id) => input.teacherNames.get(id))
            .filter((name): name is string => Boolean(name))
            .join(" · "),
        };
      });
      if (slots.some((item) => item.bookable || item.full || item.mine || item.waiting)) {
        days.push({ occursOn: cursor, slots });
      }
    }
    cursor = shiftYmd(cursor, 1);
  }
  return days;
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
  await syncFixedMonthTurns(studio.id, userId);
  await fillWaitlist(studio.id);
  const { from, to } = monthTurnBounds();
  const db = getDb();
  const [turnRows, absenceRows, studioTurns, recoveryRows, waitRows] = await Promise.all([
    db
      .select()
      .from(studioMonthTurns)
      .where(
        and(
          eq(studioMonthTurns.studioId, studio.id),
          eq(studioMonthTurns.clientUserId, userId),
          gte(studioMonthTurns.occursOn, from),
          lte(studioMonthTurns.occursOn, to)
        )
      )
      .orderBy(asc(studioMonthTurns.occursOn), asc(studioMonthTurns.slotStart)),
    db
      .select()
      .from(studioAbsences)
      .where(
        and(
          eq(studioAbsences.studioId, studio.id),
          eq(studioAbsences.clientUserId, userId)
        )
      ),
    db
      .select({
        clientUserId: studioMonthTurns.clientUserId,
        occursOn: studioMonthTurns.occursOn,
        slotStart: studioMonthTurns.slotStart,
        status: studioMonthTurns.status,
      })
      .from(studioMonthTurns)
      .where(
        and(
          eq(studioMonthTurns.studioId, studio.id),
          gte(studioMonthTurns.occursOn, from),
          lte(studioMonthTurns.occursOn, to)
        )
      ),
    db
      .select({ occursOn: studioMonthTurns.occursOn })
      .from(studioMonthTurns)
      .where(
        and(
          eq(studioMonthTurns.studioId, studio.id),
          eq(studioMonthTurns.clientUserId, userId),
          eq(studioMonthTurns.source, "recovery")
        )
      ),
    db
      .select({
        occursOn: studioWaitlist.occursOn,
        slotStart: studioWaitlist.slotStart,
      })
      .from(studioWaitlist)
      .where(
        and(
          eq(studioWaitlist.studioId, studio.id),
          eq(studioWaitlist.clientUserId, userId),
          gt(studioWaitlist.occursOn, todayBillingYmd())
        )
      ),
  ]);
  const nameById = new Map(
    bundle.people.flatMap((item) =>
      item.userId ? [[item.userId, item.displayName] as const] : []
    )
  );
  const teacherName = teacher?.displayName ?? null;
  const activities = memberActivities(member.activities, studio.kinds);
  const today = todayBillingYmd();
  const outcomeByDay = new Map(
    absenceRows.map((item) => [item.absentOn, item.outcome] as const)
  );
  const creditAbsences = absenceRows.filter((item) => item.outcome === "credit");
  const months = monthsBetween(from, to);
  const creditsByMonth: Record<string, number> = {};
  const usedByMonth: Record<string, number> = {};
  const cancelsLeftByMonth: Record<string, number> = {};
  for (const month of months) {
    creditsByMonth[month] = 0;
    usedByMonth[month] = 0;
    cancelsLeftByMonth[month] = studio.maxCancelsPerMonth;
  }
  for (const item of creditAbsences) {
    const month = item.absentOn.slice(0, 7);
    creditsByMonth[month] = (creditsByMonth[month] ?? 0) + 1;
  }
  for (const item of recoveryRows) {
    const month = item.occursOn.slice(0, 7);
    creditsByMonth[month] = (creditsByMonth[month] ?? 0) - 1;
  }
  for (const item of waitRows) {
    const month = item.occursOn.slice(0, 7);
    creditsByMonth[month] = (creditsByMonth[month] ?? 0) - 1;
  }
  for (const item of absenceRows) {
    const month = item.absentOn.slice(0, 7);
    usedByMonth[month] = (usedByMonth[month] ?? 0) + 1;
  }
  for (const month of new Set([...months, ...Object.keys(usedByMonth)])) {
    cancelsLeftByMonth[month] = Math.max(
      0,
      studio.maxCancelsPerMonth - (usedByMonth[month] ?? 0)
    );
  }
  const usedThisMonth = usedByMonth[today.slice(0, 7)] ?? 0;
  const turnPlan = parseTurnPlan(member.turnPlan);
  const weeks = weeksBetween(from, to);
  const creditsByWeek: Record<string, number> = {};
  for (const week of weeks) creditsByWeek[week] = 0;
  if (turnPlan === "week") {
    for (const item of creditAbsences) {
      const week = mondayOfYmd(item.absentOn);
      creditsByWeek[week] = (creditsByWeek[week] ?? 0) + 1;
    }
    for (const item of recoveryRows) {
      const week = mondayOfYmd(item.occursOn);
      creditsByWeek[week] = (creditsByWeek[week] ?? 0) - 1;
    }
    for (const item of waitRows) {
      const week = mondayOfYmd(item.occursOn);
      creditsByWeek[week] = (creditsByWeek[week] ?? 0) - 1;
    }
    settleCreditBuckets(creditsByWeek);
  } else if (turnPlan === "month") {
    settleCreditBuckets(creditsByMonth);
  }
  const balance =
    turnPlan === "fixed"
      ? 0
      : turnPlan === "week"
        ? Object.values(creditsByWeek).reduce(
            (sum, value) => sum + Math.max(0, value),
            0
          )
        : Object.values(creditsByMonth).reduce(
            (sum, value) => sum + Math.max(0, value),
            0
          );
  const activitiesByClient = new Map(
    bundle.people.flatMap((item) =>
      item.role === "client" && item.userId
        ? [[item.userId, item.activities] as const]
        : []
    )
  );
  const paymentStatus: ClientPaymentStatus =
    member.paymentStatus === "current" ||
    member.paymentStatus === "overdue" ||
    member.paymentStatus === "paused" ||
    member.paymentStatus === "trial" ||
    member.paymentStatus === "comp"
      ? member.paymentStatus
      : "current";
  return {
    studio: bundle.studio,
    sessionsPerWeek: member.sessionsPerWeek ?? 1,
    turnPlan,
    paymentStatus,
    activities,
    teacher: teacher
      ? { userId: teacher.userId as string, name: teacher.displayName }
      : teacherId
        ? { userId: teacherId, name: "Profesor" }
        : null,
    occupancy: bundle.occupancy,
    today,
    credits: {
      balance,
      noticeHours: studio.cancelNoticeHours,
      maxPerMonth: studio.maxCancelsPerMonth,
      usedThisMonth,
      usedByMonth,
      creditsByMonth,
      creditsByWeek,
      cancelsLeftByMonth,
      months,
      weeks,
      turnPlan,
    } satisfies ClientCreditState,
    recoveryDays: recoveryDaysFor({
      studio,
      shifts: bundle.shifts,
      activities,
      from,
      to,
      assignedTeacherId: teacher?.userId ?? teacherId,
      teacherNames: nameById,
      turns: studioTurns,
      mine: turnRows.map((item) => ({
        occursOn: item.occursOn,
        slotStart: item.slotStart,
        status: item.status,
      })),
      activitiesByClient,
      waiting: new Set(
        waitRows.map((item) => `${item.occursOn}|${item.slotStart}`)
      ),
    }),
    mine: bundle.reservations.filter((item) => item.clientUserId === userId),
    monthTurns: turnRows.map((item) => ({
      id: item.id,
      occursOn: item.occursOn,
      weekday: item.weekday,
      slotStart: item.slotStart,
      teacherName: item.teacherUserId
        ? (nameById.get(item.teacherUserId) ?? teacherName)
        : teacherName,
      status: item.status,
      source: item.source,
      outcome:
        item.source === "fixed" ? (outcomeByDay.get(item.occursOn) ?? null) : null,
    })),
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
    occursOn: string;
    weekday: number;
    slotStart: string;
    teacherName: string | null;
    absent: boolean;
  } | null;
};

function todayHomeFromBooking(
  booking: NonNullable<Awaited<ReturnType<typeof loadClientBooking>>>
): ClientTodayHome {
  const todayYmd = booking.today;
  const now = new Date();
  const upcoming = [...booking.monthTurns]
    .filter((item) => !classSlotPassed(item.occursOn, item.slotStart, now))
    .sort(
      (a, b) =>
        a.occursOn.localeCompare(b.occursOn) ||
        a.slotStart.localeCompare(b.slotStart)
    );
  const nextTurn = upcoming[0] ?? null;
  const todayTurn = nextTurn?.occursOn === todayYmd ? nextTurn : null;
  const laterTurn = todayTurn ? null : nextTurn;
  return {
    studioName: booking.studio.name,
    today: todayTurn
      ? {
          slotStart: todayTurn.slotStart,
          teacherName: todayTurn.teacherName,
          absent: todayTurn.status === "absent",
        }
      : null,
    next: laterTurn
      ? {
          occursOn: laterTurn.occursOn,
          weekday: laterTurn.weekday,
          slotStart: laterTurn.slotStart,
          teacherName: laterTurn.teacherName,
          absent: laterTurn.status === "absent",
        }
      : null,
  };
}

/** Resumen del día para el home del alumno de gimnasio. */
export async function loadClientTodayHome(): Promise<ClientTodayHome | null> {
  const booking = await loadClientBooking();
  if (!booking) return null;
  return todayHomeFromBooking(booking);
}

/**
 * El alumno avisa, o retira el aviso, de una clase de hoy o de un día que
 * todavía no llegó. La clase ya pasada no se puede avisar.
 */
export async function setClientAbsence(occursOn: string, absent: boolean) {
  const ymd = occursOn.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    throw new Error("Esa fecha no es válida.");
  }
  const booking = await loadClientBooking();
  if (!booking) throw new Error("No hay un gimnasio vinculado.");
  if (ymd < booking.today) throw new Error("Esa clase ya pasó.");
  const turn = booking.monthTurns.find(
    (item) => item.source === "fixed" && item.occursOn === ymd
  );
  if (!turn) throw new Error("Ese día no tenés una clase fija.");
  if (classSlotPassed(ymd, turn.slotStart)) {
    throw new Error("Esa clase ya pasó.");
  }
  const userId = await requireUserId();
  const db = getDb();
  if (absent) {
    if (turn.status === "absent") return booking;
    const month = ymd.slice(0, 7);
    const prior = await db
      .select({
        outcome: studioAbsences.outcome,
        absentOn: studioAbsences.absentOn,
      })
      .from(studioAbsences)
      .where(
        and(
          eq(studioAbsences.studioId, booking.studio.id),
          eq(studioAbsences.clientUserId, userId)
        )
      );
    const cancelsThisMonth = prior.filter((item) =>
      item.absentOn.startsWith(month)
    ).length;
    if (cancelsThisMonth >= booking.studio.maxCancelsPerMonth) {
      throw new Error("Ya no te quedan cancelaciones este mes.");
    }
    const usedThisMonth = prior.filter(
      (item) => item.outcome === "credit" && item.absentOn.startsWith(month)
    ).length;
    const outcome =
      booking.turnPlan === "fixed"
        ? "notice"
        : cancellationOutcome({
            classAt: classStart(ymd, turn.slotStart),
            now: new Date(),
            noticeHours: booking.studio.cancelNoticeHours,
            usedThisMonth,
            maxPerMonth: booking.studio.maxCancelsPerMonth,
          });
    await db.insert(studioAbsences).values({
      id: uid(),
      studioId: booking.studio.id,
      clientUserId: userId,
      absentOn: ymd,
      weekday: turn.weekday,
      slotStart: turn.slotStart,
      outcome,
    });
  } else {
    if (turn.status !== "absent") return booking;
    if (turn.outcome === "credit") {
      const month = ymd.slice(0, 7);
      const available =
        booking.turnPlan === "week"
          ? (booking.credits.creditsByWeek[mondayOfYmd(ymd)] ?? 0)
          : (booking.credits.creditsByMonth[month] ?? 0);
      if (available < 1) {
        throw new Error(
          "Ya usaste ese crédito. Soltá la clase que tomaste antes de retirar el aviso."
        );
      }
    }
    if (await slotIsFullFor(booking.studio.id, userId, ymd, turn.slotStart)) {
      throw new Error("Ese horario ya lo tomó otra persona.");
    }
    await db
      .delete(studioAbsences)
      .where(
        and(
          eq(studioAbsences.studioId, booking.studio.id),
          eq(studioAbsences.clientUserId, userId),
          eq(studioAbsences.absentOn, ymd)
        )
      );
  }
  return loadClientBooking();
}

/** Un día fijo anulado habilita un solo horario de ese mismo día. */
async function assertFixedDayMove(
  studioId: string,
  userId: string,
  ymd: string
) {
  const db = getDb();
  const [absence] = await db
    .select({ id: studioAbsences.id })
    .from(studioAbsences)
    .where(
      and(
        eq(studioAbsences.studioId, studioId),
        eq(studioAbsences.clientUserId, userId),
        eq(studioAbsences.absentOn, ymd)
      )
    )
    .limit(1);
  if (!absence) {
    throw new Error("Con días fijos solo podés anotarte el día que anulaste.");
  }
  const [recovery] = await db
    .select({ id: studioMonthTurns.id })
    .from(studioMonthTurns)
    .where(
      and(
        eq(studioMonthTurns.studioId, studioId),
        eq(studioMonthTurns.clientUserId, userId),
        eq(studioMonthTurns.occursOn, ymd),
        eq(studioMonthTurns.source, "recovery"),
        eq(studioMonthTurns.status, "scheduled")
      )
    )
    .limit(1);
  if (recovery) throw new Error("Ya te anotaste ese día.");
}

/** Gasta un crédito en un horario libre de un día concreto. */
export async function bookRecoveryTurn(occursOn: string, slotStart: string) {
  const ymd = occursOn.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    throw new Error("Esa fecha no es válida.");
  }
  const booking = await loadClientBooking();
  if (!booking) throw new Error("No hay un gimnasio vinculado.");
  const userId = await requireUserId();
  if (booking.turnPlan === "fixed") {
    await assertFixedDayMove(booking.studio.id, userId, ymd);
  } else {
    const creditKey =
      booking.turnPlan === "week" ? mondayOfYmd(ymd) : ymd.slice(0, 7);
    const available =
      booking.turnPlan === "week"
        ? (booking.credits.creditsByWeek[creditKey] ?? 0)
        : (booking.credits.creditsByMonth[creditKey] ?? 0);
    if (available < 1) {
      throw new Error(
        booking.turnPlan === "week"
          ? "No tenés un crédito de esa semana."
          : "No tenés créditos de ese mes."
      );
    }
  }
  if (ymd <= booking.today) {
    throw new Error("Elegí un día posterior a hoy.");
  }
  const day = booking.recoveryDays.find((item) => item.occursOn === ymd);
  const slot = day?.slots.find((item) => item.slotStart === slotStart);
  if (!slot) throw new Error("Ese horario no existe.");
  if (slot.mine) {
    throw new Error("Ese horario ya es tuyo ese día.");
  }
  if (!slot.open) throw new Error("No hay profesor en ese horario.");
  if (!slot.bookable) throw new Error("Ese horario está lleno.");
  const weekday = new Date(`${ymd}T12:00:00`).getDay();
  const shifts = await getDb()
    .select()
    .from(studioTeacherShifts)
    .where(eq(studioTeacherShifts.studioId, booking.studio.id));
  const covering = shifts.filter(
    (shift) =>
      shift.weekday === weekday &&
      hourCovers(shift.startHour, shift.endHour, slotStart)
  );
  const chosen =
    covering.find((shift) => shift.teacherUserId === booking.teacher?.userId) ??
    covering[0];
  if (!chosen) throw new Error("No hay profesor en ese horario.");
  const db = getDb();
  const [existing] = await db
    .select({
      id: studioMonthTurns.id,
      status: studioMonthTurns.status,
    })
    .from(studioMonthTurns)
    .where(
      and(
        eq(studioMonthTurns.studioId, booking.studio.id),
        eq(studioMonthTurns.clientUserId, userId),
        eq(studioMonthTurns.occursOn, ymd),
        eq(studioMonthTurns.slotStart, slotStart)
      )
    )
    .limit(1);
  if (existing?.status === "scheduled") {
    throw new Error("Ese horario ya es tuyo ese día.");
  }
  if (existing) {
    await db
      .update(studioMonthTurns)
      .set({
        status: "scheduled",
        source: "recovery",
        teacherUserId: chosen.teacherUserId,
        weekday,
      })
      .where(eq(studioMonthTurns.id, existing.id));
  } else {
    await db.insert(studioMonthTurns).values({
      id: uid(),
      studioId: booking.studio.id,
      clientUserId: userId,
      occursOn: ymd,
      weekday,
      slotStart,
      teacherUserId: chosen.teacherUserId,
      source: "recovery",
      status: "scheduled",
    });
  }
  await db
    .delete(studioWaitlist)
    .where(
      and(
        eq(studioWaitlist.studioId, booking.studio.id),
        eq(studioWaitlist.clientUserId, userId),
        eq(studioWaitlist.occursOn, ymd),
        ...(booking.turnPlan === "fixed"
          ? []
          : [eq(studioWaitlist.slotStart, slotStart)])
      )
    );
  return loadClientBooking();
}

/** Reserva un crédito en la lista de un horario lleno. */
export async function joinWaitlist(occursOn: string, slotStart: string) {
  const ymd = occursOn.trim();
  const hour = slotStart.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    throw new Error("Esa fecha no es válida.");
  }
  const booking = await loadClientBooking();
  if (!booking) throw new Error("No hay un gimnasio vinculado.");
  if (booking.paymentStatus === "paused") {
    throw new Error("Tu cuenta está suspendida. Consultá en recepción.");
  }
  const userId = await requireUserId();
  if (booking.turnPlan === "fixed") {
    await assertFixedDayMove(booking.studio.id, userId, ymd);
    const [waitingDay] = await getDb()
      .select({ id: studioWaitlist.id })
      .from(studioWaitlist)
      .where(
        and(
          eq(studioWaitlist.studioId, booking.studio.id),
          eq(studioWaitlist.clientUserId, userId),
          eq(studioWaitlist.occursOn, ymd)
        )
      )
      .limit(1);
    if (waitingDay) {
      throw new Error("Ya estás en la lista de espera ese día.");
    }
  } else {
    const creditKey =
      booking.turnPlan === "week" ? mondayOfYmd(ymd) : ymd.slice(0, 7);
    const available =
      booking.turnPlan === "week"
        ? (booking.credits.creditsByWeek[creditKey] ?? 0)
        : (booking.credits.creditsByMonth[creditKey] ?? 0);
    if (available < 1) {
      throw new Error(
        booking.turnPlan === "week"
          ? "No tenés un crédito de esa semana para la lista."
          : "No tenés créditos de ese mes para anotarte en la lista."
      );
    }
  }
  if (ymd <= booking.today) {
    throw new Error("Elegí un día posterior a hoy.");
  }
  const day = booking.recoveryDays.find((item) => item.occursOn === ymd);
  const slot = day?.slots.find((item) => item.slotStart === hour);
  if (!slot) throw new Error("Ese horario no existe.");
  if (slot.mine) {
    throw new Error("Ese horario ya es tuyo ese día.");
  }
  if (slot.waiting) throw new Error("Ya estás en la lista de espera.");
  if (!slot.open) throw new Error("No hay profesor en ese horario.");
  if (!slot.full) throw new Error("Hay lugar: anotáte directo.");
  await getDb().insert(studioWaitlist).values({
    id: uid(),
    studioId: booking.studio.id,
    clientUserId: userId,
    occursOn: ymd,
    weekday: new Date(`${ymd}T12:00:00`).getDay(),
    slotStart: hour,
  });
  await fillWaitlist(booking.studio.id, { occursOn: ymd, slotStart: hour });
  return loadClientBooking();
}

/** Sale de la lista y devuelve el crédito reservado. */
export async function leaveWaitlist(occursOn: string, slotStart: string) {
  const ymd = occursOn.trim();
  const hour = slotStart.trim();
  const userId = await requireUserId();
  const member = await membershipFor(userId, "client");
  if (!member) throw new Error("No hay un gimnasio vinculado.");
  await getDb()
    .delete(studioWaitlist)
    .where(
      and(
        eq(studioWaitlist.studioId, member.studioId),
        eq(studioWaitlist.clientUserId, userId),
        eq(studioWaitlist.occursOn, ymd),
        eq(studioWaitlist.slotStart, hour)
      )
    );
  return loadClientBooking();
}

async function slotIsFullFor(
  studioId: string,
  clientUserId: string,
  occursOn: string,
  slotStart: string
) {
  const db = getDb();
  const [studioRow] = await db
    .select()
    .from(studios)
    .where(eq(studios.id, studioId))
    .limit(1);
  if (!studioRow) return false;
  const studio = toStudio(studioRow);
  const weekday = new Date(`${occursOn}T12:00:00`).getDay();
  const hours = hoursForWeekday(studio.dayHours, weekday);
  if (!hours) return false;
  const [members, scheduled] = await Promise.all([
    db
      .select()
      .from(studioMemberships)
      .where(eq(studioMemberships.studioId, studioId)),
    db
      .select({ clientUserId: studioMonthTurns.clientUserId })
      .from(studioMonthTurns)
      .where(
        and(
          eq(studioMonthTurns.studioId, studioId),
          eq(studioMonthTurns.occursOn, occursOn),
          eq(studioMonthTurns.slotStart, slotStart),
          eq(studioMonthTurns.status, "scheduled")
        )
      ),
  ]);
  const activitiesByClient = new Map(
    members
      .filter((item) => item.role === "client")
      .map(
        (item) =>
          [item.userId, memberActivities(item.activities, studio.kinds)] as const
      )
  );
  let gymTaken = 0;
  let pilatesTaken = 0;
  for (const turn of scheduled) {
    if (turn.clientUserId === clientUserId) continue;
    const activities = activitiesByClient.get(turn.clientUserId) ?? studio.kinds;
    if (activities.includes("gym")) gymTaken += 1;
    if (activities.includes("pilates")) pilatesTaken += 1;
  }
  const mine = activitiesByClient.get(clientUserId) ?? studio.kinds;
  const gymCapacity = studioHasKind(studio.kinds, "gym")
    ? dayKindCapacity(hours, "gym")
    : 0;
  const pilatesCapacity = studioHasKind(studio.kinds, "pilates")
    ? dayKindCapacity(hours, "pilates")
    : 0;
  return occupancyForActivities(
    { gymTaken, gymCapacity, pilatesTaken, pilatesCapacity },
    mine
  ).full;
}

/** Devuelve el crédito de una clase tomada, si todavía no pasó. */
export async function cancelRecoveryTurn(turnId: string) {
  const booking = await loadClientBooking();
  if (!booking) throw new Error("No hay un gimnasio vinculado.");
  const turn = booking.monthTurns.find((item) => item.id === turnId);
  if (!turn || turn.source !== "recovery") {
    throw new Error("Esa clase no es un recupero.");
  }
  if (turn.occursOn < booking.today || classSlotPassed(turn.occursOn, turn.slotStart)) {
    throw new Error("Esa clase ya pasó.");
  }
  const userId = await requireUserId();
  await getDb()
    .delete(studioMonthTurns)
    .where(
      and(
        eq(studioMonthTurns.id, turnId),
        eq(studioMonthTurns.clientUserId, userId),
        eq(studioMonthTurns.source, "recovery")
      )
    );
  return loadClientBooking();
}

/** El alumno avisa que hoy no asiste y libera el cupo de ese día. */
export async function markClientAbsenceToday() {
  const booking = await setClientAbsence(todayBillingYmd(), true);
  if (!booking) throw new Error("No hay un gimnasio vinculado.");
  return todayHomeFromBooking(booking);
}

/** Cancela el aviso de ausencia de hoy. */
export async function cancelClientAbsenceToday() {
  const booking = await setClientAbsence(todayBillingYmd(), false);
  if (!booking) throw new Error("No hay un gimnasio vinculado.");
  return todayHomeFromBooking(booking);
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
  outcome: "credit" | "notice";
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
      outcome: row.outcome,
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

export type GymAbsenceRankingRow = {
  userId: string;
  displayName: string;
  studioId: string;
  studioName: string;
  teacherName: string | null;
  /** Veces que el profesor marcó que no asistió este mes. */
  absenceCount: number;
  dates: string[];
};

/** Alumnos con al menos una inasistencia marcada por el profesor este mes. */
export async function listGymAbsenceRanking(
  studioId?: string | null
): Promise<{
  month: string;
  monthLabel: string;
  rows: GymAbsenceRankingRow[];
  studios: { id: string; name: string }[];
}> {
  const { branches } = await requireOwnedGym();
  const studios = branches.map((item) => ({
    id: item.id,
    name: item.name,
  }));
  if (!branches.length) {
    const today = todayBillingYmd();
    return {
      month: today.slice(0, 7),
      monthLabel: "",
      rows: [],
      studios: [],
    };
  }
  const filterId = studioId?.trim() || "";
  const studioIds = filterId
    ? branches.filter((item) => item.id === filterId).map((item) => item.id)
    : branches.map((item) => item.id);
  if (!studioIds.length) {
    throw new Error("Esa sucursal no es tuya.");
  }
  const today = todayBillingYmd();
  const month = today.slice(0, 7);
  const fromYmd = `${month}-01`;
  let monthEnd = `${month}-28`;
  for (let day = 28; day <= 31; day += 1) {
    const candidate = `${month}-${String(day).padStart(2, "0")}`;
    if (candidate.slice(0, 7) !== month) break;
    monthEnd = candidate;
  }
  const db = getDb();
  const [turns, members] = await Promise.all([
    db
      .select()
      .from(studioMonthTurns)
      .where(
        and(
          inArray(studioMonthTurns.studioId, studioIds),
          gte(studioMonthTurns.occursOn, fromYmd),
          lte(studioMonthTurns.occursOn, monthEnd),
          eq(studioMonthTurns.attendance, "absent")
        )
      ),
    db
      .select()
      .from(studioMemberships)
      .where(inArray(studioMemberships.studioId, studioIds)),
  ]);
  const nameByMember = new Map(
    members.map(
      (item) => [`${item.studioId}:${item.userId}`, item.displayName] as const
    )
  );
  const studioNameById = new Map(studios.map((item) => [item.id, item.name]));
  const byClient = new Map<string, GymAbsenceRankingRow>();
  for (const turn of turns) {
    const key = `${turn.studioId}:${turn.clientUserId}`;
    const teacherName = turn.teacherUserId
      ? nameByMember.get(`${turn.studioId}:${turn.teacherUserId}`) ?? null
      : null;
    const current = byClient.get(key);
    if (current) {
      if (!current.dates.includes(turn.occursOn)) {
        current.dates.push(turn.occursOn);
        current.absenceCount = current.dates.length;
      }
      if (!current.teacherName && teacherName) {
        current.teacherName = teacherName;
      }
      continue;
    }
    byClient.set(key, {
      userId: turn.clientUserId,
      displayName:
        nameByMember.get(`${turn.studioId}:${turn.clientUserId}`) ?? "Alumno",
      studioId: turn.studioId,
      studioName: studioNameById.get(turn.studioId) ?? "Sucursal",
      teacherName,
      absenceCount: 1,
      dates: [turn.occursOn],
    });
  }
  const rows = [...byClient.values()]
    .map((item) => ({
      ...item,
      dates: [...item.dates].sort(),
    }))
    .sort(
      (a, b) =>
        b.absenceCount - a.absenceCount ||
        a.displayName.localeCompare(b.displayName, "es")
    );
  const monthLabel = new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${month}-15T12:00:00`));
  return {
    month,
    monthLabel: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
    rows,
    studios,
  };
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
  /** Avisó que pagó y el estudio todavía no lo confirmó. */
  paymentClaimed: boolean;
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
    paymentClaimed: Boolean(member.paymentClaimedAt),
  };
}

/** El alumno avisa que ya pagó la cuota vencida. */
export async function claimClientPayment() {
  const userId = await requireUserId();
  const member = await membershipFor(userId, "client");
  if (!member || member.role !== "client") {
    throw new Error("No hay un gimnasio vinculado.");
  }
  const paymentStatus: ClientPaymentStatus =
    member.paymentStatus === "current" ||
    member.paymentStatus === "overdue" ||
    member.paymentStatus === "paused" ||
    member.paymentStatus === "trial" ||
    member.paymentStatus === "comp"
      ? member.paymentStatus
      : "current";
  const alert = clientAccountAlert(
    paymentStatus,
    member.serviceEndsOn ?? ""
  );
  if (paymentStatus !== "overdue" && alert !== "expired") {
    throw new Error("Tu cuota no figura vencida.");
  }
  if (member.paymentClaimedAt) {
    return loadClientBillingHome();
  }
  await getDb()
    .update(studioMemberships)
    .set({ paymentClaimedAt: new Date() })
    .where(eq(studioMemberships.id, member.id));
  return loadClientBillingHome();
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

export type TeacherSlotAttendance = "present" | "absent";

export type TeacherDaySlotStudent = {
  userId: string;
  displayName: string;
  turnId: string | null;
  /** El alumno avisó que no asiste. */
  clientAbsent: boolean;
  /** Asistencia marcada por el profesor (solo turnos pasados). */
  attendance: TeacherSlotAttendance | null;
};

export type TeacherDaySlot = {
  studioId: string;
  studioName: string;
  slotStart: string;
  students: TeacherDaySlotStudent[];
};

export type TeacherDayAgenda = {
  occursOn: string;
  weekday: number;
  slots: TeacherDaySlot[];
};

/** Turnos por hora del día para el profesor (según sus turnos de sucursal). */
export async function loadTeacherDayAgenda(
  occursOn: string
): Promise<TeacherDayAgenda> {
  const ymd = occursOn.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    throw new Error("Esa fecha no es válida.");
  }
  const weekday = new Date(`${ymd}T12:00:00`).getDay();
  const userId = await requireUserId();
  const members = (await membershipsFor(userId)).filter(
    (item) => item.role === "teacher"
  );
  if (!members.length) {
    return { occursOn: ymd, weekday, slots: [] };
  }
  const studioIds = members.map((item) => item.studioId);
  const useMonthTurns = isInMonthTurnWindow(ymd);
  if (useMonthTurns) {
    await Promise.all(studioIds.map((id) => syncFixedMonthTurns(id)));
  }
  const db = getDb();
  const ownerIds = [
    ...new Set(
      (
        await db
          .select({ ownerUserId: studios.ownerUserId })
          .from(studios)
          .where(inArray(studios.id, studioIds))
      ).map((item) => item.ownerUserId)
    ),
  ];
  const [studioRows, ownShifts, dayLeaves, assignedClients, reservations, turns] =
    await Promise.all([
      db.select().from(studios).where(inArray(studios.id, studioIds)),
      db
        .select()
        .from(studioTeacherShifts)
        .where(
          and(
            inArray(studioTeacherShifts.studioId, studioIds),
            eq(studioTeacherShifts.teacherUserId, userId),
            eq(studioTeacherShifts.weekday, weekday)
          )
        ),
      ownerIds.length
        ? db
            .select({
              ownerUserId: studioTeacherLeaves.ownerUserId,
              teacherUserId: studioTeacherLeaves.teacherUserId,
              replacementTeacherUserId:
                studioTeacherLeaves.replacementTeacherUserId,
            })
            .from(studioTeacherLeaves)
            .where(
              and(
                inArray(studioTeacherLeaves.ownerUserId, ownerIds),
                eq(studioTeacherLeaves.status, "approved"),
                lte(studioTeacherLeaves.startsOn, ymd),
                gte(studioTeacherLeaves.endsOn, ymd)
              )
            )
        : Promise.resolve(
            [] as {
              ownerUserId: string;
              teacherUserId: string;
              replacementTeacherUserId: string | null;
            }[]
          ),
      db
        .select({
          studioId: studioMemberships.studioId,
          userId: studioMemberships.userId,
          displayName: studioMemberships.displayName,
        })
        .from(studioMemberships)
        .where(
          and(
            inArray(studioMemberships.studioId, studioIds),
            eq(studioMemberships.role, "client"),
            eq(studioMemberships.assignedTeacherUserId, userId)
          )
        ),
      useMonthTurns
        ? Promise.resolve([] as (typeof studioReservations.$inferSelect)[])
        : db
            .select()
            .from(studioReservations)
            .where(
              and(
                inArray(studioReservations.studioId, studioIds),
                eq(studioReservations.weekday, weekday)
              )
            ),
      useMonthTurns
        ? db
            .select()
            .from(studioMonthTurns)
            .where(
              and(
                inArray(studioMonthTurns.studioId, studioIds),
                eq(studioMonthTurns.occursOn, ymd)
              )
            )
        : Promise.resolve([] as (typeof studioMonthTurns.$inferSelect)[]),
    ]);
  const ownerByStudio = new Map(
    studioRows.map((item) => [item.id, item.ownerUserId] as const)
  );
  const onLeaveStudioIds = new Set(
    studioIds.filter((studioId) => {
      const ownerId = ownerByStudio.get(studioId);
      return dayLeaves.some(
        (leave) =>
          leave.teacherUserId === userId && leave.ownerUserId === ownerId
      );
    })
  );
  const coveringForByStudio = new Map<string, Set<string>>();
  for (const leave of dayLeaves) {
    if (leave.replacementTeacherUserId !== userId) continue;
    for (const studioId of studioIds) {
      if (ownerByStudio.get(studioId) !== leave.ownerUserId) continue;
      const set = coveringForByStudio.get(studioId) ?? new Set<string>();
      set.add(leave.teacherUserId);
      coveringForByStudio.set(studioId, set);
    }
  }
  const coverTeacherIds = [
    ...new Set([...coveringForByStudio.values()].flatMap((set) => [...set])),
  ];
  const coverShifts =
    coverTeacherIds.length === 0
      ? ([] as (typeof studioTeacherShifts.$inferSelect)[])
      : await db
          .select()
          .from(studioTeacherShifts)
          .where(
            and(
              inArray(studioTeacherShifts.studioId, studioIds),
              inArray(studioTeacherShifts.teacherUserId, coverTeacherIds),
              eq(studioTeacherShifts.weekday, weekday)
            )
          );
  const shifts = [
    ...ownShifts.filter((shift) => !onLeaveStudioIds.has(shift.studioId)),
    ...coverShifts.filter((shift) =>
      coveringForByStudio.get(shift.studioId)?.has(shift.teacherUserId)
    ),
  ];
  const nameByStudio = new Map(
    studioRows.map((item) => [item.id, item.name] as const)
  );
  const assignedByStudio = new Map<string, Set<string>>();
  const nameByClient = new Map<string, string>();
  for (const client of assignedClients) {
    const set = assignedByStudio.get(client.studioId) ?? new Set<string>();
    set.add(client.userId);
    assignedByStudio.set(client.studioId, set);
    nameByClient.set(`${client.studioId}:${client.userId}`, client.displayName);
  }
  for (const turn of turns) {
    if (!nameByClient.has(`${turn.studioId}:${turn.clientUserId}`)) {
      nameByClient.set(
        `${turn.studioId}:${turn.clientUserId}`,
        "Alumno"
      );
    }
  }
  if (turns.length || !useMonthTurns) {
    const extraIds = [
      ...new Set(
        [
          ...turns.map((item) => item.clientUserId),
          ...reservations.map((item) => item.clientUserId),
        ].filter(
          (id) =>
            ![...nameByClient.keys()].some((key) => key.endsWith(`:${id}`))
        )
      ),
    ];
    if (extraIds.length) {
      const extraMembers = await db
        .select({
          studioId: studioMemberships.studioId,
          userId: studioMemberships.userId,
          displayName: studioMemberships.displayName,
        })
        .from(studioMemberships)
        .where(
          and(
            inArray(studioMemberships.studioId, studioIds),
            inArray(studioMemberships.userId, extraIds),
            eq(studioMemberships.role, "client")
          )
        );
      for (const item of extraMembers) {
        nameByClient.set(
          `${item.studioId}:${item.userId}`,
          item.displayName || "Alumno"
        );
      }
    }
  }

  type RawStudent = {
    userId: string;
    displayName: string;
    turnId: string | null;
    clientAbsent: boolean;
    attendance: TeacherSlotAttendance | null;
    teacherUserId: string | null;
  };

  const studentsByKey = new Map<string, RawStudent[]>();
  const pushStudent = (
    studioId: string,
    slotStart: string,
    student: RawStudent
  ) => {
    if (onLeaveStudioIds.has(studioId)) return;
    const assigned = assignedByStudio.get(studioId);
    const coveringFor = coveringForByStudio.get(studioId);
    const mine =
      student.teacherUserId === userId ||
      Boolean(
        student.teacherUserId && coveringFor?.has(student.teacherUserId)
      ) ||
      Boolean(assigned?.has(student.userId));
    if (!mine) return;
    const key = `${studioId}:${slotStart}`;
    const list = studentsByKey.get(key) ?? [];
    if (list.some((item) => item.userId === student.userId)) return;
    list.push(student);
    studentsByKey.set(key, list);
  };

  if (useMonthTurns) {
    for (const turn of turns) {
      const attendance =
        turn.attendance === "present" || turn.attendance === "absent"
          ? turn.attendance
          : null;
      pushStudent(turn.studioId, turn.slotStart, {
        userId: turn.clientUserId,
        displayName:
          nameByClient.get(`${turn.studioId}:${turn.clientUserId}`) ??
          "Alumno",
        turnId: turn.id,
        clientAbsent: turn.status === "absent",
        attendance,
        teacherUserId: turn.teacherUserId,
      });
    }
  } else {
    const absences = await db
      .select({
        studioId: studioAbsences.studioId,
        clientUserId: studioAbsences.clientUserId,
      })
      .from(studioAbsences)
      .where(
        and(
          inArray(studioAbsences.studioId, studioIds),
          eq(studioAbsences.absentOn, ymd)
        )
      );
    const absentKeys = new Set(
      absences.map((item) => `${item.studioId}:${item.clientUserId}`)
    );
    for (const row of reservations) {
      pushStudent(row.studioId, row.slotStart, {
        userId: row.clientUserId,
        displayName:
          nameByClient.get(`${row.studioId}:${row.clientUserId}`) ?? "Alumno",
        turnId: null,
        clientAbsent: absentKeys.has(`${row.studioId}:${row.clientUserId}`),
        attendance: null,
        teacherUserId: row.teacherUserId,
      });
    }
  }

  const slots: TeacherDaySlot[] = [];
  for (const shift of shifts) {
    const hours = hourSlots(shift.startHour, shift.endHour);
    for (const slotStart of hours) {
      const students = (studentsByKey.get(`${shift.studioId}:${slotStart}`) ?? [])
        .map((item) => ({
          userId: item.userId,
          displayName: item.displayName,
          turnId: item.turnId,
          clientAbsent: item.clientAbsent,
          attendance: item.attendance,
        }))
        .sort((a, b) => {
          if (a.clientAbsent !== b.clientAbsent) return a.clientAbsent ? 1 : -1;
          return a.displayName.localeCompare(b.displayName, "es");
        });
      slots.push({
        studioId: shift.studioId,
        studioName: nameByStudio.get(shift.studioId) ?? "Sucursal",
        slotStart,
        students,
      });
    }
  }
  slots.sort(
    (a, b) =>
      a.slotStart.localeCompare(b.slotStart) ||
      a.studioName.localeCompare(b.studioName, "es")
  );
  return { occursOn: ymd, weekday, slots };
}

/** El profesor marca asistencia de un alumno en un turno ya pasado. */
export async function markTeacherStudentAttendance(input: {
  studioId: string;
  clientUserId: string;
  occursOn: string;
  slotStart: string;
  attendance: TeacherSlotAttendance;
}) {
  const ymd = input.occursOn.trim();
  const hour = input.slotStart.trim();
  const clientUserId = input.clientUserId.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    throw new Error("Esa fecha no es válida.");
  }
  if (parseHour(hour) == null) {
    throw new Error("Ese horario no es válido.");
  }
  if (input.attendance !== "present" && input.attendance !== "absent") {
    throw new Error("Indicá si vino o no.");
  }
  if (!classSlotPassed(ymd, hour)) {
    throw new Error("Todavía podés marcar asistencia cuando termine la clase.");
  }
  const userId = await requireUserId();
  const members = (await membershipsFor(userId)).filter(
    (item) => item.role === "teacher" && item.studioId === input.studioId
  );
  if (!members.length) {
    throw new Error("No das clases en esa sucursal.");
  }
  if (!isInMonthTurnWindow(ymd)) {
    throw new Error("Ese día ya no está en la agenda de turnos.");
  }
  await syncFixedMonthTurns(input.studioId, clientUserId);
  const db = getDb();
  const [turn] = await db
    .select()
    .from(studioMonthTurns)
    .where(
      and(
        eq(studioMonthTurns.studioId, input.studioId),
        eq(studioMonthTurns.clientUserId, clientUserId),
        eq(studioMonthTurns.occursOn, ymd),
        eq(studioMonthTurns.slotStart, hour)
      )
    )
    .limit(1);
  if (!turn) {
    throw new Error("Ese alumno no tenía turno en ese horario.");
  }
  const [assigned] = await db
    .select({ id: studioMemberships.id })
    .from(studioMemberships)
    .where(
      and(
        eq(studioMemberships.studioId, input.studioId),
        eq(studioMemberships.userId, clientUserId),
        eq(studioMemberships.role, "client"),
        eq(studioMemberships.assignedTeacherUserId, userId)
      )
    )
    .limit(1);
  if (turn.teacherUserId !== userId && !assigned) {
    throw new Error("Ese alumno no está en tu lista.");
  }
  await db
    .update(studioMonthTurns)
    .set({ attendance: input.attendance })
    .where(eq(studioMonthTurns.id, turn.id));
  return {
    turnId: turn.id,
    attendance: input.attendance,
  };
}

export async function saveClientReservations(
  picks: { weekday: number; slotStart: string }[]
) {
  const userId = await requireUserId();
  const member = await membershipFor(userId, "client");
  if (!member || member.role !== "client") {
    throw new Error("No tienes un cupo de alumno en un gimnasio.");
  }
  if (member.paymentStatus === "paused") {
    throw new Error("Tu cuenta está suspendida. Consultá en recepción.");
  }
  const turnPlan = parseTurnPlan(member.turnPlan);
  if (turnPlan === "fixed") {
    throw new Error(
      "Con días fijos no podés cambiar los horarios. Pedile al gimnasio."
    );
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
    requireExact: true,
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
  await syncFixedMonthTurns(studio.id, userId);
  return loadClientBooking();
}
