"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
import { applyCheckIn } from "@/lib/adjust";
import { generatePlan } from "@/lib/plan";
import { markSession } from "@/lib/schedule";
import { clearState, loadState, saveState } from "@/lib/storage";
import type { AppState, CheckIn, Goal, Profile } from "@/lib/types";

const listeners = new Set<() => void>();
let cache: AppState | null | undefined;

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  if (cache === undefined) {
    cache = loadState();
  }
  return cache;
}

function getServerSnapshot(): AppState | null {
  return null;
}

function write(next: AppState | null) {
  cache = next;
  if (next) saveState(next);
  else clearState();
  emit();
}

function clientMountedSubscribe() {
  return () => {};
}

type Store = {
  ready: boolean;
  state: AppState | null;
  startPlan: (profile: Profile, goal: Goal) => AppState;
  logSession: (dayId: string, rpe: number) => void;
  submitCheckIn: (input: Omit<CheckIn, "id" | "date">) => CheckIn;
  reset: () => void;
};

const Ctx = createContext<Store | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const mounted = useSyncExternalStore(
    clientMountedSubscribe,
    () => true,
    () => false
  );
  const stored = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const state = mounted ? stored : null;

  const startPlan = useCallback((profile: Profile, goal: Goal) => {
    const next: AppState = {
      profile,
      goal,
      plan: generatePlan(profile, goal),
      checkIns: [],
      sessions: [],
    };
    write(next);
    return next;
  }, []);

  const logSession = useCallback((dayId: string, rpe: number) => {
    const prev = getSnapshot();
    if (!prev) return;
    const session = markSession(prev, dayId, rpe);
    write({ ...prev, sessions: [...prev.sessions, session] });
  }, []);

  const submitCheckIn = useCallback((input: Omit<CheckIn, "id" | "date">) => {
    const checkIn: CheckIn = {
      ...input,
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
    };
    const prev = getSnapshot();
    if (!prev) return checkIn;
    const { plan } = applyCheckIn(prev, checkIn);
    write({
      ...prev,
      profile: { ...prev.profile, weightKg: checkIn.weightKg },
      plan,
      checkIns: [...prev.checkIns, checkIn],
    });
    return checkIn;
  }, []);

  const reset = useCallback(() => {
    write(null);
  }, []);

  const value = useMemo(
    () => ({
      ready: mounted,
      state,
      startPlan,
      logSession,
      submitCheckIn,
      reset,
    }),
    [mounted, state, startPlan, logSession, submitCheckIn, reset]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAppStore debe usarse dentro de AppProvider");
  return ctx;
}
