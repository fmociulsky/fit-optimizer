"use server";

import { and, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { getDb } from "@/db";
import {
  accounts,
  coachRequests,
  gymTeachers,
  studioInvites,
  studioMemberships,
  studioReservations,
  studioTeacherShifts,
  studios,
  userStates,
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
  parseUsername,
  usernameFromEmail,
} from "@/lib/password";
import { getSessionUserId } from "@/lib/session";
import { planHasExercises } from "@/lib/coach";
import {
  memberActivities,
  normalizeStudioKinds,
  parseClientActivities,
  studioHasKind,
  type AppState,
  type Studio,
  type StudioDayHours,
  type StudioInviteRole,
  type StudioKind,
  type StudioMemberRole,
} from "@/lib/types";

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
    passwordHash: await hashPassword("1234"),
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
    passwordHash: await hashPassword("1234"),
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
}) {
  await getDb()
    .insert(gymTeachers)
    .values({
      id: uid(),
      ownerUserId: input.ownerUserId,
      userId: input.userId,
      displayName: input.displayName,
      phone: input.phone,
      createdAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [gymTeachers.ownerUserId, gymTeachers.userId],
      set: {
        displayName: input.displayName,
        phone: input.phone,
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
    const student = personFromMember(row.clientUserId, input.members, "Alumno");
    if (!row.teacherUserId) {
      unassignedStudents.push(student);
      continue;
    }
    const list = studentsByTeacher.get(row.teacherUserId) ?? [];
    list.push(student);
    studentsByTeacher.set(row.teacherUserId, list);
  }
  const teachers: NextHourTeacherGroup[] = [...teacherIds]
    .map((userId) => {
      const students = (studentsByTeacher.get(userId) ?? []).sort((a, b) =>
        a.name.localeCompare(b.name, "es")
      );
      return {
        ...personFromMember(userId, input.members, "Profesor"),
        students,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
  unassignedStudents.sort((a, b) => a.name.localeCompare(b.name, "es"));
  return { teachers, unassignedStudents };
}

export async function loadDayAgenda(
  studioId: string,
  weekday: number
): Promise<DayAgenda> {
  const { studio } = await requireStudioOwner(studioId);
  const day = Math.round(weekday);
  if (day < 0 || day > 6) throw new Error("Ese día no es válido.");
  const hours = hoursForWeekday(studio.dayHours, day);
  const db = getDb();
  const [members, shifts, reservations] = await Promise.all([
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
  ]);
  const memberById = new Map(members.map((item) => [item.userId, item]));
  const slots = hours
    ? hourSlots(hours.openFrom, hours.openTo).map((slotStart) => ({
        slotStart,
        ...attendanceForSlot({
          weekday: day,
          slotStart,
          members: memberById,
          shifts,
          reservations,
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
  activities: StudioKind[];
  role: StudioMemberRole | StudioInviteRole;
  sessionsPerWeek: number | null;
  assignedTeacherUserId: string | null;
  assignedTeacherName: string | null;
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
  const teachers = members.filter((item) => item.role === "teacher");
  const teacherNameById = new Map(
    teachers.map((item) => [item.userId, item.displayName] as const)
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
        activities: memberActivities(item.activities, studio.kinds),
        role: item.role,
        sessionsPerWeek: item.sessionsPerWeek,
        assignedTeacherUserId: item.assignedTeacherUserId ?? null,
        assignedTeacherName: item.assignedTeacherUserId
          ? (teacherNameById.get(item.assignedTeacherUserId) ?? null)
          : null,
        pending: false,
      })),
    ...invites.map((item) => ({
      userId: null as string | null,
      displayName: item.displayName,
      phone: item.phone ?? "",
      email: "",
      username: "",
      birthDate: "",
      activities: memberActivities(null, studio.kinds),
      role: item.role,
      sessionsPerWeek: item.sessionsPerWeek,
      assignedTeacherUserId: item.assignedTeacherUserId ?? null,
      assignedTeacherName: item.assignedTeacherUserId
        ? (teacherNameById.get(item.assignedTeacherUserId) ?? null)
        : null,
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
    createdAt: new Date(),
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
  activities: StudioKind[];
  sessionsPerWeek: number | null;
  studioId: string;
  studioName: string;
  assignedTeacherUserId: string | null;
  teacherName: string | null;
  reservations: { weekday: number; slotStart: string }[];
};

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
  return members
    .map((item) => ({
      userId: item.userId,
      displayName: item.displayName,
      phone: item.phone ?? "",
      email: item.email ?? "",
      username: usernameById.get(item.userId) ?? "",
      birthDate: item.birthDate ?? "",
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

export async function createStudioTeacher(input: {
  studioId: string;
  displayName: string;
  phone: string;
  username: string;
  password: string;
}) {
  const { studio } = await requireStudioOwner(input.studioId);
  const displayName = input.displayName.trim();
  if (displayName.length < 2) throw new Error("Pon el nombre del profesor.");
  const phone = parsePhone(input.phone);
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
  });
  return loadStudioDashboard(studio.id);
}

export type GymTeacherSummary = {
  userId: string;
  displayName: string;
  phone: string;
  username: string;
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
      branches: branchesByTeacher.get(item.userId) ?? [],
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "es"));
}

export async function loadGymTeacher(teacherUserId: string) {
  const { userId, branches } = await requireOwnedGym();
  return loadGymTeacherDetail(userId, branches, teacherUserId.trim());
}

export async function createGymTeacher(input: {
  displayName: string;
  phone: string;
  username: string;
  password: string;
}) {
  const { userId: ownerUserId, branches } = await requireOwnedGym();
  const displayName = input.displayName.trim();
  if (displayName.length < 2) throw new Error("Pon el nombre del profesor.");
  const phone = parsePhone(input.phone);
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
  });
  return loadGymTeacherDetail(ownerUserId, branches, teacherUserId);
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
  const [teacher] = await getDb()
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
  return teacher.userId;
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
  await persistTeacherShifts(studio, teacherUserId, shifts);
  return loadStudioDashboard(studio.id);
}

export async function saveOwnTeacherShifts(
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
  await persistTeacherShifts(toStudio(studioRow), userId, shifts);
  return loadTeacherStudioHours();
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

export type ClientProfile = {
  displayName: string;
  phone: string;
  email: string;
  username: string;
  birthDate: string;
  activities: StudioKind[];
  studioName: string;
};

export async function loadAssignedTeacherName(): Promise<string | null> {
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
  return name || null;
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
    activities: memberActivities(member.activities, kinds),
    studioName: studioRow?.name ?? "Sucursal",
  };
}

export async function saveClientProfile(input: {
  displayName: string;
  phone: string;
  email: string;
  birthDate: string;
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
  return studioRows.map((row) => {
    const studio = toStudio(row);
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
