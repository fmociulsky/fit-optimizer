"use server";

import { cookies } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import { and, eq, or } from "drizzle-orm";
import { getDb } from "@/db";
import {
  accounts,
  coachRequests,
  studioMemberships,
  studioTeacherShifts,
  studios,
  userStates,
} from "@/db/schema";
import { defaultDraftProfile } from "@/lib/metrics";
import { generatePlan } from "@/lib/plan";
import { verifyPassword } from "@/lib/password";
import { createProfessionalCode } from "@/lib/roles";
import { resolveInternalUserIdFromClerk } from "@/lib/clerk-account";
import type { Account, AppState, StudioMemberRole } from "@/lib/types";

const DEMO_PROFESSIONAL_ID = "demo-professional";
const DEMO_PROFESSIONAL_CODE = "ENF-123456";
const DEMO_CLIENT_ID = "demo-client";
const DEMO_STUDIO_ID = "demo-studio";
const DEMO_STUDIO_CODE = "EST-123456";
const DEMO_HEMA_STUDIO_ID = "demo-studio-hema";
const DEMO_HEMA_STUDIO_CODE = "EST-HEMA01";
const PRO_COOKIE = "enforma-demo-pro";
const USER_COOKIE = "enforma-demo-user";
const STUDIO_COOKIE = "enforma-demo-studio";

async function ensureDemoClient(professionalUserId: string) {
  const db = getDb();
  const [existingState] = await db
    .select()
    .from(userStates)
    .where(eq(userStates.userId, DEMO_CLIENT_ID))
    .limit(1);
  if (existingState) {
    await ensureDemoStudioClient();
    return;
  }

  const now = new Date();
  const profile = {
    ...defaultDraftProfile(),
    name: "Alumno de prueba",
    birthDate: "1994-03-12",
    equipment: "coach" as const,
    gymMachines: undefined,
    medicalFlags: ["none" as const],
    medicalNotes: "",
  };
  const goal = {
    horizon: "medium" as const,
    type: "health" as const,
    targetWeightKg: null,
    notes: "",
    focusAreas: ["full_body" as const],
  };
  const state: AppState = {
    profile,
    goal,
    plan: generatePlan(profile, goal),
    checkIns: [],
    sessions: [],
    planAcceptedAt: now.toISOString(),
    coachPlanRequestedAt: now.toISOString(),
  };

  await db
    .insert(accounts)
    .values({
      userId: DEMO_CLIENT_ID,
      role: "client",
      name: "Alumno de prueba",
      code: null,
      linkedProfessionalId: professionalUserId,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: accounts.userId,
      set: {
        role: "client",
        name: "Alumno de prueba",
        linkedProfessionalId: professionalUserId,
        updatedAt: now,
      },
    });

  await db
    .insert(userStates)
    .values({
      userId: DEMO_CLIENT_ID,
      payload: { state, draft: null },
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: userStates.userId,
      set: {
        payload: { state, draft: null },
        updatedAt: now,
      },
    });

  await db
    .insert(coachRequests)
    .values({
      clientUserId: DEMO_CLIENT_ID,
      professionalUserId,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: coachRequests.clientUserId,
      set: {
        professionalUserId,
        status: "pending",
        updatedAt: now,
      },
    });

  await ensureDemoStudioClient();
}

async function ensureDemoStudioClient() {
  const db = getDb();
  const [already] = await db
    .select({ id: studioMemberships.id })
    .from(studioMemberships)
    .where(eq(studioMemberships.userId, DEMO_CLIENT_ID))
    .limit(1);
  if (already) return;
  const studio = await findDemoStudio();
  if (!studio) return;
  await db.insert(studioMemberships).values({
    id: crypto.randomUUID(),
    studioId: studio.id,
    userId: DEMO_CLIENT_ID,
    role: "client",
    sessionsPerWeek: 2,
    assignedTeacherUserId: null,
    displayName: "Alumno de prueba",
    createdAt: new Date(),
  });
}

export async function ensureDemoTeacherAssignment() {
  const studio = await findDemoStudio();
  if (!studio) return;
  const db = getDb();
  await db
    .delete(studioTeacherShifts)
    .where(eq(studioTeacherShifts.teacherUserId, DEMO_PROFESSIONAL_ID));
  await db
    .delete(studioMemberships)
    .where(
      and(
        eq(studioMemberships.studioId, studio.id),
        eq(studioMemberships.userId, DEMO_PROFESSIONAL_ID),
        eq(studioMemberships.role, "teacher")
      )
    );
  await db
    .update(studioMemberships)
    .set({ assignedTeacherUserId: null })
    .where(eq(studioMemberships.assignedTeacherUserId, DEMO_PROFESSIONAL_ID));
  await db
    .update(accounts)
    .set({ username: null, updatedAt: new Date() })
    .where(
      and(eq(accounts.userId, DEMO_PROFESSIONAL_ID), eq(accounts.username, "hema"))
    );
}

async function findDemoStudio() {
  const db = getDb();
  const [owned] = await db
    .select()
    .from(studios)
    .where(eq(studios.ownerUserId, DEMO_STUDIO_ID))
    .limit(1);
  if (owned) return owned;
  const [legacy] = await db
    .select()
    .from(studios)
    .where(eq(studios.ownerUserId, DEMO_PROFESSIONAL_ID))
    .limit(1);
  return legacy ?? null;
}

async function demoStudioRole(userId: string): Promise<StudioMemberRole | null> {
  try {
    const [member] = await getDb()
      .select({ role: studioMemberships.role })
      .from(studioMemberships)
      .where(eq(studioMemberships.userId, userId))
      .limit(1);
    return member?.role ?? null;
  } catch {
    return null;
  }
}

export async function getDemoProfessionalUserId() {
  const jar = await cookies();
  const value = jar.get(PRO_COOKIE)?.value;
  if (!value) return null;
  if (value === "1") return DEMO_PROFESSIONAL_ID;
  return value;
}

export async function getDemoClientUserId() {
  const jar = await cookies();
  const value = jar.get(USER_COOKIE)?.value;
  if (!value) return null;
  if (value === "1") return DEMO_CLIENT_ID;
  return value;
}

export async function getDemoStudioUserId() {
  const jar = await cookies();
  const value = jar.get(STUDIO_COOKIE)?.value;
  if (!value) return null;
  if (value === "1" || value === DEMO_STUDIO_ID) return DEMO_STUDIO_ID;
  if (value === "hema" || value === DEMO_HEMA_STUDIO_ID) {
    return DEMO_HEMA_STUDIO_ID;
  }
  return null;
}

export async function getSessionUserId() {
  const demoPro = await getDemoProfessionalUserId();
  if (demoPro) return demoPro;
  const demoClient = await getDemoClientUserId();
  if (demoClient) return demoClient;
  const demoStudio = await getDemoStudioUserId();
  if (demoStudio) return demoStudio;
  const { userId } = await auth();
  if (!userId) return null;
  return (await resolveInternalUserIdFromClerk(userId)) ?? userId;
}

async function ensureDemoProfessionalAccount(): Promise<Account> {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, DEMO_PROFESSIONAL_ID))
    .limit(1);
  if (existing?.role === "professional" && existing.code) {
    if (existing.username === "hema") {
      await db
        .update(accounts)
        .set({ username: null, updatedAt: new Date() })
        .where(eq(accounts.userId, DEMO_PROFESSIONAL_ID));
    }
    await ensureDemoClient(existing.userId);
    await ensureDemoTeacherAssignment();
    return {
      userId: existing.userId,
      role: "professional",
      name: existing.name || "Profesor interno",
      username: null,
      code: existing.code,
      linkedProfessionalId: null,
      linkedProfessionalCode: null,
      studioRole: await demoStudioRole(existing.userId),
    };
  }

  let code = existing?.code || DEMO_PROFESSIONAL_CODE;
  const [taken] = await db
    .select({ userId: accounts.userId })
    .from(accounts)
    .where(eq(accounts.code, code))
    .limit(1);
  if (taken && taken.userId !== DEMO_PROFESSIONAL_ID) {
    code = createProfessionalCode();
  }

  const now = new Date();
  await db
    .insert(accounts)
    .values({
      userId: DEMO_PROFESSIONAL_ID,
      role: "professional",
      name: "Profesor interno",
      username: null,
      code,
      linkedProfessionalId: null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: accounts.userId,
      set: {
        role: "professional",
        name: "Profesor interno",
        username: null,
        code,
        linkedProfessionalId: null,
        updatedAt: now,
      },
    });

  await ensureDemoClient(DEMO_PROFESSIONAL_ID);
  await ensureDemoTeacherAssignment();
  return {
    userId: DEMO_PROFESSIONAL_ID,
    role: "professional",
    name: "Profesor interno",
    username: null,
    code,
    linkedProfessionalId: null,
    linkedProfessionalCode: null,
    studioRole: await demoStudioRole(DEMO_PROFESSIONAL_ID),
  };
}

async function ensureDemoStudio2222Account(): Promise<Account> {
  const db = getDb();
  const now = new Date();
  const [existingAccount] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, DEMO_STUDIO_ID))
    .limit(1);
  if (!existingAccount) {
    await db.insert(accounts).values({
      userId: DEMO_STUDIO_ID,
      role: "studio",
      name: "2222",
      username: "2222",
      code: DEMO_STUDIO_CODE,
      linkedProfessionalId: null,
      createdAt: now,
      updatedAt: now,
    });
  } else {
    await db
      .update(accounts)
      .set({
        role: "studio",
        name: "2222",
        username: "2222",
        updatedAt: now,
      })
      .where(eq(accounts.userId, DEMO_STUDIO_ID));
  }

  const owned = await db
    .select()
    .from(studios)
    .where(eq(studios.ownerUserId, DEMO_STUDIO_ID));
  if (owned.length) {
    const [ownerMember] = await db
      .select({ id: studioMemberships.id })
      .from(studioMemberships)
      .where(eq(studioMemberships.userId, DEMO_STUDIO_ID))
      .limit(1);
    if (!ownerMember) {
      await db.insert(studioMemberships).values({
        id: crypto.randomUUID(),
        studioId: owned[0].id,
        userId: DEMO_STUDIO_ID,
        role: "owner",
        displayName: "2222",
        createdAt: now,
      });
    }
  }

  return {
    userId: DEMO_STUDIO_ID,
    role: "studio",
    name: "2222",
    username: "2222",
    code: DEMO_STUDIO_CODE,
    linkedProfessionalId: null,
    linkedProfessionalCode: null,
    studioRole: "owner",
  };
}

async function ensureDemoHemaStudioAccount(): Promise<Account> {
  const db = getDb();
  const now = new Date();

  // Liberar el username hema si todavía está en la cuenta 2222.
  await db
    .update(accounts)
    .set({ username: "2222", name: "2222", updatedAt: now })
    .where(
      and(eq(accounts.userId, DEMO_STUDIO_ID), eq(accounts.username, "hema"))
    );

  const [existingAccount] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, DEMO_HEMA_STUDIO_ID))
    .limit(1);
  if (!existingAccount) {
    await db.insert(accounts).values({
      userId: DEMO_HEMA_STUDIO_ID,
      role: "studio",
      name: "hema",
      username: "hema",
      code: DEMO_HEMA_STUDIO_CODE,
      linkedProfessionalId: null,
      createdAt: now,
      updatedAt: now,
    });
  } else {
    await db
      .update(accounts)
      .set({
        role: "studio",
        name: "hema",
        username: "hema",
        updatedAt: now,
      })
      .where(eq(accounts.userId, DEMO_HEMA_STUDIO_ID));
  }

  return {
    userId: DEMO_HEMA_STUDIO_ID,
    role: "studio",
    name: "hema",
    username: "hema",
    code: DEMO_HEMA_STUDIO_CODE,
    linkedProfessionalId: null,
    linkedProfessionalCode: null,
    studioRole: "owner",
  };
}

async function ensureDemoStudioAccount(): Promise<Account> {
  const studioUserId = await getDemoStudioUserId();
  if (studioUserId === DEMO_HEMA_STUDIO_ID) {
    return ensureDemoHemaStudioAccount();
  }
  return ensureDemoStudio2222Account();
}

async function ensureDemoClientAccount(): Promise<Account> {
  await ensureDemoProfessionalAccount();
  await ensureDemoStudioAccount();
  return {
    userId: DEMO_CLIENT_ID,
    role: "client",
    name: "Alumno de prueba",
    username: "1111",
    code: null,
    linkedProfessionalId: DEMO_PROFESSIONAL_ID,
    linkedProfessionalCode: DEMO_PROFESSIONAL_CODE,
    studioRole: await demoStudioRole(DEMO_CLIENT_ID),
  };
}

export async function loadDemoProfessionalAccount() {
  return loadDemoAccount();
}

async function loadLocalProfessionalAccount(userId: string): Promise<Account | null> {
  if (userId === DEMO_PROFESSIONAL_ID) return ensureDemoProfessionalAccount();
  const [row] = await getDb()
    .select()
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .limit(1);
  if (!row || row.role !== "professional") return null;
  return {
    userId: row.userId,
    role: "professional",
    name: row.name || "Profesor",
    username: row.username,
    code: row.code,
    linkedProfessionalId: null,
    linkedProfessionalCode: null,
    studioRole: await demoStudioRole(row.userId),
  };
}

async function loadLocalClientAccount(userId: string): Promise<Account | null> {
  if (userId === DEMO_CLIENT_ID) return ensureDemoClientAccount();
  const [row] = await getDb()
    .select()
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .limit(1);
  if (!row || row.role !== "client") return null;
  return {
    userId: row.userId,
    role: "client",
    name: row.name || "Alumno",
    username: row.username,
    code: row.code,
    linkedProfessionalId: row.linkedProfessionalId,
    linkedProfessionalCode: null,
    studioRole: await demoStudioRole(row.userId),
  };
}

export async function loadDemoAccount() {
  const professionalId = await getDemoProfessionalUserId();
  if (professionalId) return loadLocalProfessionalAccount(professionalId);
  const clientId = await getDemoClientUserId();
  if (clientId) return loadLocalClientAccount(clientId);
  if (await getDemoStudioUserId()) return ensureDemoStudioAccount();
  return null;
}

const DEMO_COOKIE = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};

export async function loginDemoProfessional(username: string, password: string) {
  const normalized = username.trim().toLowerCase();
  const [row] = await getDb()
    .select()
    .from(accounts)
    .where(eq(accounts.username, normalized))
    .limit(1);
  if (
    !row ||
    row.role !== "professional" ||
    !row.passwordHash ||
    !(await verifyPassword(password, row.passwordHash))
  ) {
    throw new Error("Usuario o contraseña incorrectos.");
  }
  const account: Account = {
    userId: row.userId,
    role: "professional",
    name: row.name || "Profesor",
    username: row.username,
    code: row.code,
    linkedProfessionalId: null,
    linkedProfessionalCode: null,
    studioRole: await demoStudioRole(row.userId),
  };
  const jar = await cookies();
  jar.delete(USER_COOKIE);
  jar.delete(STUDIO_COOKIE);
  jar.set(PRO_COOKIE, account.userId, DEMO_COOKIE);
  return account;
}

export async function loginDemoClient(username: string, password: string) {
  const identifier = username.trim().toLowerCase();
  let account: Account;
  if (identifier === "1111" && password === "1111") {
    account = await ensureDemoClientAccount();
  } else {
    const [row] = await getDb()
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.role, "client"),
          or(eq(accounts.username, identifier), eq(accounts.email, identifier))
        )
      )
      .limit(1);
    if (!row?.passwordHash) return null;
    if (!(await verifyPassword(password, row.passwordHash))) {
      throw new Error("Usuario o contraseña incorrectos.");
    }
    account = {
      userId: row.userId,
      role: "client",
      name: row.name || "Alumno",
      username: row.username,
      code: row.code,
      linkedProfessionalId: row.linkedProfessionalId,
      linkedProfessionalCode: null,
      studioRole: await demoStudioRole(row.userId),
    };
  }
  const jar = await cookies();
  jar.delete(PRO_COOKIE);
  jar.delete(STUDIO_COOKIE);
  jar.set(
    USER_COOKIE,
    account.userId === DEMO_CLIENT_ID ? "1" : account.userId,
    DEMO_COOKIE
  );
  return account;
}

export async function loginDemoStudio(username: string, password: string) {
  const normalized = username.trim().toLowerCase();
  const jar = await cookies();
  jar.delete(PRO_COOKIE);
  jar.delete(USER_COOKIE);

  if (normalized === "hema" && password === "123456") {
    jar.set(STUDIO_COOKIE, DEMO_HEMA_STUDIO_ID, DEMO_COOKIE);
    return ensureDemoHemaStudioAccount();
  }
  if (normalized === "2222" && password === "1234") {
    jar.set(STUDIO_COOKIE, "1", DEMO_COOKIE);
    return ensureDemoStudio2222Account();
  }
  throw new Error("Usuario o contraseña incorrectos.");
}

export async function logoutDemoProfessional() {
  const jar = await cookies();
  jar.delete(PRO_COOKIE);
  jar.delete(USER_COOKIE);
  jar.delete(STUDIO_COOKIE);
}
