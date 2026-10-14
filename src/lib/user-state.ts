"use server";

import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { userStates } from "@/db/schema";
import { getSessionUserId } from "@/lib/session";
import type { AppState, OnboardingDraft, PersistedUser } from "@/lib/types";

function isAppState(value: unknown): value is AppState {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return "profile" in obj && "goal" in obj && "plan" in obj;
}

function parsePayload(raw: unknown): PersistedUser {
  if (!raw || typeof raw !== "object") {
    return { state: null, draft: null };
  }
  if (isAppState(raw)) {
    return { state: raw, draft: null };
  }
  const obj = raw as Partial<PersistedUser>;
  return {
    state: obj.state && isAppState(obj.state) ? obj.state : null,
    draft: obj.draft ?? null,
  };
}

async function requireUserId() {
  const userId = await getSessionUserId();
  if (!userId) throw new Error("No hay sesión");
  return userId;
}

export async function loadUserRecord(): Promise<PersistedUser> {
  const userId = await requireUserId();
  const [row] = await getDb()
    .select()
    .from(userStates)
    .where(eq(userStates.userId, userId))
    .limit(1);
  return parsePayload(row?.payload);
}

export async function saveUserRecord(record: PersistedUser) {
  const userId = await requireUserId();
  const db = getDb();
  if (!record.state && !record.draft) {
    await db.delete(userStates).where(eq(userStates.userId, userId));
    return;
  }
  const payload: PersistedUser = {
    state: record.state,
    draft: record.draft,
  };
  await db
    .insert(userStates)
    .values({
      userId,
      payload,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: userStates.userId,
      set: { payload, updatedAt: new Date() },
    });
}

export async function loadUserState(): Promise<AppState | null> {
  const record = await loadUserRecord();
  return record.state;
}

export async function saveUserState(state: AppState | null) {
  const current = await loadUserRecord();
  await saveUserRecord({ state, draft: current.draft });
}
