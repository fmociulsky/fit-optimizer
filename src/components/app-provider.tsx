"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { applyCheckIn } from "@/lib/adjust";
import { EQUIPMENT_LABEL, FOCUS_AREA_LABEL } from "@/lib/labels";
import { generatePlan } from "@/lib/plan";
import { removeSession, sessionOnDate, splitForDate, upsertSession } from "@/lib/schedule";
import { isoDate, withComputedAge } from "@/lib/metrics";
import { bindStorageUser, clearState, loadState, saveState } from "@/lib/storage";
import { loadUserRecord, saveUserRecord } from "@/lib/user-state";
import {
  chooseRole as saveAccountRole,
  linkProfessionalByCode,
  loadAccount,
  submitCoachRequest,
} from "@/lib/account";
import {
  loadDemoProfessionalAccount,
  logoutDemoProfessional,
} from "@/lib/session";
import { buildWeeklyMenu } from "@/lib/weekly-menu";
import type {
  Account,
  AccountRole,
  Adjustment,
  AppState,
  CheckIn,
  FocusArea,
  Goal,
  MealSlot,
  MindPrefs,
  NutritionPrefs,
  OnboardingDraft,
  Profile,
} from "@/lib/types";

const listeners = new Set<() => void>();
let cache: AppState | null | undefined;
let draftCache: OnboardingDraft | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let persistChain = Promise.resolve();

function emit() {
  listeners.forEach((listener) => listener());
}

function currentRecord() {
  return {
    state: cache ?? null,
    draft: draftCache,
  };
}

function enqueuePersist() {
  persistChain = persistChain
    .catch(() => undefined)
    .then(() => saveUserRecord(currentRecord()));
  return persistChain;
}

function persistRemote(immediate = false) {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  const run = () => {
    void enqueuePersist().catch(() => {
      toast.error("No se pudo guardar en la base de datos.", { id: "db-save" });
    });
  };
  if (immediate) {
    run();
    return;
  }
  persistTimer = setTimeout(run, 400);
}

async function persistNow() {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  await enqueuePersist();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function reloadFromStorage() {
  cache = undefined;
  emit();
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

function write(next: AppState | null, persist = true) {
  cache = next;
  if (next) saveState(next);
  else clearState();
  emit();
  if (persist) persistRemote();
}

function clientMountedSubscribe() {
  return () => {};
}

function zonesLabel(areas?: FocusArea[] | null) {
  if (!areas?.length || areas.includes("full_body")) {
    return FOCUS_AREA_LABEL.full_body;
  }
  return areas
    .filter((area) => area !== "full_body")
    .map((area) => FOCUS_AREA_LABEL[area])
    .join(", ");
}

type Store = {
  ready: boolean;
  state: AppState | null;
  draft: OnboardingDraft | null;
  account: Account | null;
  saveDraft: (draft: OnboardingDraft) => void;
  chooseRole: (role: AccountRole) => Promise<Account>;
  linkProfessional: (code: string) => Promise<Account>;
  startPlan: (profile: Profile, goal: Goal) => Promise<AppState>;
  rebuildPlan: (profile: Profile, goal: Goal) => Promise<AppState>;
  logSession: (dayId: string, rpe: number, date?: Date) => void;
  unlogSession: (dayId: string, date?: Date) => void;
  toggleExercise: (
    dayId: string,
    exerciseName: string,
    allNames: string[],
    date?: Date
  ) => void;
  submitCheckIn: (input: Omit<CheckIn, "id" | "date">) => CheckIn;
  acceptNutritionGuide: () => void;
  acceptPlanGuide: () => void;
  saveNutritionMenu: (prefs: NutritionPrefs) => void;
  acceptMindGuide: () => void;
  saveMindPrefs: (prefs: MindPrefs) => void;
  logMindPractice: (practiceId: string) => void;
  logMeal: (slot: MealSlot) => void;
  requestCoachPlan: () => Promise<void>;
  enterDemoProfessional: (account: Account) => void;
  logoutDemo: () => Promise<void>;
  reset: () => void;
};

const Ctx = createContext<Store | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded, userId } = useAuth();
  const [remoteReady, setRemoteReady] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  const mounted = useSyncExternalStore(
    clientMountedSubscribe,
    () => true,
    () => false
  );
  const stored = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const ready = mounted && isLoaded && remoteReady;
  const state = ready ? stored : null;
  const draft = ready ? draftCache : null;

  useEffect(() => {
    if (!isLoaded) return;
    bindStorageUser(userId ?? null);
    if (!userId) {
      let cancelled = false;
      void (async () => {
        const demoAccount = await loadDemoProfessionalAccount().catch(() => null);
        if (cancelled) return;
        if (demoAccount) {
          bindStorageUser(demoAccount.userId);
          setAccount(demoAccount);
          try {
            const remote = await loadUserRecord();
            if (cancelled) return;
            draftCache = remote.draft;
            if (remote.state) write(remote.state, false);
            else {
              cache = null;
              emit();
            }
          } catch {
            if (cancelled) return;
            cache = null;
            draftCache = null;
            emit();
          }
          setRemoteReady(true);
          return;
        }
        cache = null;
        draftCache = null;
        setAccount(null);
        bindStorageUser(null);
        emit();
        setRemoteReady(true);
      })();
      return () => {
        cancelled = true;
      };
    }
    let cancelled = false;
    setRemoteReady(false);
    void (async () => {
      try {
        const [remote, acc] = await Promise.all([
          loadUserRecord(),
          loadAccount().catch(() => null),
        ]);
        if (cancelled) return;
        setAccount(acc);
        draftCache = remote.draft;
        if (remote.state) {
          write(remote.state, false);
        } else {
          const local = loadState();
          cache = local;
          if (local) saveState(local);
          else clearState();
          emit();
          if (local || draftCache) {
            try {
              await persistNow();
            } catch {
              toast.error("No se pudo subir tu plan a la base de datos.", {
                id: "db-save",
              });
            }
          }
        }
      } catch {
        if (cancelled) return;
        reloadFromStorage();
        toast.error(
          "No se pudo cargar desde la base de datos. Usamos una copia local si hay.",
          { id: "db-load" }
        );
      } finally {
        if (!cancelled) setRemoteReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, userId]);

  useEffect(() => {
    function flush() {
      if (!persistTimer) return;
      clearTimeout(persistTimer);
      persistTimer = null;
      void enqueuePersist().catch(() => undefined);
    }
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, []);

  const saveDraft = useCallback((nextDraft: OnboardingDraft) => {
    draftCache = nextDraft;
    emit();
    persistRemote(true);
  }, []);

  const chooseRole = useCallback(async (role: AccountRole) => {
    const next = await saveAccountRole(role);
    setAccount(next);
    return next;
  }, []);

  const linkProfessional = useCallback(async (code: string) => {
    const next = await linkProfessionalByCode(code);
    setAccount(next);
    return next;
  }, []);

  const startPlan = useCallback(async (profile: Profile, goal: Goal) => {
    const nextProfile = withComputedAge(profile);
    const next: AppState = {
      profile: nextProfile,
      goal,
      plan: generatePlan(nextProfile, goal),
      checkIns: [],
      sessions: [],
      planAcceptedAt: new Date().toISOString(),
    };
    draftCache = null;
    write(next, false);
    await persistNow();
    if (nextProfile.equipment === "coach") {
      try {
        await submitCoachRequest();
        const requested = {
          ...next,
          coachPlanRequestedAt: new Date().toISOString(),
        };
        write(requested, false);
        await persistNow();
        return requested;
      } catch {
        return next;
      }
    }
    return next;
  }, []);

  const rebuildPlan = useCallback(async (profile: Profile, goal: Goal) => {
    const prev = getSnapshot();
    if (!prev) return startPlan(profile, goal);
    profile = withComputedAge(profile);

    const previousMachines = prev.profile.gymMachines ?? [];
    const nextMachines = profile.gymMachines ?? [];
    const previousHome = prev.profile.homeItems ?? [];
    const nextHome = profile.homeItems ?? [];
    const previousPilates = prev.profile.pilatesItems ?? [];
    const nextPilates = profile.pilatesItems ?? [];
    const changes: string[] = [];
    if (prev.profile.equipment !== profile.equipment) {
      changes.push(
        `Material: de ${EQUIPMENT_LABEL[prev.profile.equipment]} a ${EQUIPMENT_LABEL[profile.equipment]}.`
      );
    }
    if (
      profile.equipment === "full_gym" &&
      previousMachines.slice().sort().join() !== nextMachines.slice().sort().join()
    ) {
      changes.push(
        `Máquinas del gimnasio: ${nextMachines.length} seleccionadas.`
      );
    }
    if (
      profile.equipment !== "full_gym" &&
      profile.equipment !== "coach" &&
      profile.equipment !== "pilates" &&
      previousHome.slice().sort().join() !== nextHome.slice().sort().join()
    ) {
      changes.push(
        `Material de casa: ${nextHome.length} elementos seleccionados.`
      );
    }
    if (
      profile.equipment === "pilates" &&
      previousPilates.slice().sort().join() !== nextPilates.slice().sort().join()
    ) {
      changes.push(
        `Material de pilates: ${nextPilates.length} elementos seleccionados.`
      );
    }
    if (prev.goal.type !== goal.type || prev.goal.horizon !== goal.horizon) {
      changes.push("Objetivo u horizonte actualizados.");
    }
    const prevFocus = (prev.goal.focusAreas ?? ["full_body"]).slice().sort().join();
    const nextFocus = (goal.focusAreas ?? ["full_body"]).slice().sort().join();
    if (prevFocus !== nextFocus) {
      changes.push(`Zonas: ${zonesLabel(goal.focusAreas)}.`);
    }
    if (!changes.length) {
      changes.push("Plan rearmado con los datos actuales.");
    }

    const adjustment: Adjustment = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      reason: "Reconfiguración del material y del contexto",
      changes,
    };
    const plan = generatePlan(profile, goal, prev.plan);
    plan.adjustments = [...prev.plan.adjustments, adjustment];

    const next: AppState = {
      profile,
      goal,
      plan,
      checkIns: prev.checkIns,
      sessions: prev.sessions,
      nutritionAcceptedAt: prev.nutritionAcceptedAt,
      planAcceptedAt: prev.planAcceptedAt ?? new Date().toISOString(),
      nutritionPrefs: prev.nutritionPrefs,
      weeklyMenu: prev.nutritionPrefs
        ? buildWeeklyMenu({
            profile,
            goal,
            plan,
            prefs: prev.nutritionPrefs,
            weightKg: prev.checkIns.at(-1)?.weightKg ?? profile.weightKg,
          })
        : undefined,
      mindAcceptedAt: prev.mindAcceptedAt,
      mindPrefs: prev.mindPrefs,
      mindLogs: prev.mindLogs,
      mealLogs: prev.mealLogs,
      coachPlanRequestedAt:
        profile.equipment === "coach"
          ? prev.profile.equipment === "coach"
            ? prev.coachPlanRequestedAt
            : undefined
          : undefined,
    };
    draftCache = null;
    write(next, false);
    await persistNow();
    if (profile.equipment === "coach") {
      try {
        await submitCoachRequest();
        const requested = {
          ...next,
          coachPlanRequestedAt:
            next.coachPlanRequestedAt ?? new Date().toISOString(),
        };
        write(requested, false);
        await persistNow();
        return requested;
      } catch {
        return next;
      }
    }
    return next;
  }, [startPlan]);

  const logSession = useCallback((dayId: string, rpe: number, date = new Date()) => {
    const prev = getSnapshot();
    if (!prev) return;
    const workout =
      splitForDate(prev, date).find((day) => day.id === dayId) ??
      prev.plan.weeklySplit.find((day) => day.id === dayId);
    const names = workout?.exercises.map((exercise) => exercise.name);
    write({
      ...prev,
      sessions: upsertSession(prev, dayId, date, {
        rpe,
        exercisesDone: names,
      }),
    });
  }, []);

  const unlogSession = useCallback((dayId: string, date = new Date()) => {
    const prev = getSnapshot();
    if (!prev) return;
    write({ ...prev, sessions: removeSession(prev, dayId, date) });
  }, []);

  const toggleExercise = useCallback(
    (dayId: string, exerciseName: string, allNames: string[], date = new Date()) => {
      const prev = getSnapshot();
      if (!prev) return;
      const existing = sessionOnDate(prev, dayId, date);
      const done = new Set(
        existing?.exercisesDone ?? (existing ? allNames : [])
      );
      if (done.has(exerciseName)) done.delete(exerciseName);
      else done.add(exerciseName);
      if (done.size === 0) {
        write({ ...prev, sessions: removeSession(prev, dayId, date) });
        return;
      }
      write({
        ...prev,
        sessions: upsertSession(prev, dayId, date, {
          rpe: existing?.rpe ?? 7,
          exercisesDone: [...done],
        }),
      });
    },
    []
  );

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

  const acceptNutritionGuide = useCallback(() => {
    const prev = getSnapshot();
    if (!prev || prev.nutritionAcceptedAt) return;
    write({ ...prev, nutritionAcceptedAt: new Date().toISOString() });
  }, []);

  const acceptPlanGuide = useCallback(() => {
    const prev = getSnapshot();
    if (!prev || prev.planAcceptedAt) return;
    write({ ...prev, planAcceptedAt: new Date().toISOString() });
  }, []);

  const saveNutritionMenu = useCallback((prefs: NutritionPrefs) => {
    const prev = getSnapshot();
    if (!prev) return;
    write({
      ...prev,
      nutritionPrefs: prefs,
      weeklyMenu: buildWeeklyMenu({
        profile: prev.profile,
        goal: prev.goal,
        plan: prev.plan,
        prefs,
        weightKg: prev.checkIns.at(-1)?.weightKg ?? prev.profile.weightKg,
      }),
    });
  }, []);

  const acceptMindGuide = useCallback(() => {
    const prev = getSnapshot();
    if (!prev || prev.mindAcceptedAt) return;
    write({ ...prev, mindAcceptedAt: new Date().toISOString() });
  }, []);

  const saveMindPrefs = useCallback((prefs: MindPrefs) => {
    const prev = getSnapshot();
    if (!prev) return;
    write({ ...prev, mindPrefs: prefs });
  }, []);

  const logMindPractice = useCallback((practiceId: string) => {
    const prev = getSnapshot();
    if (!prev) return;
    const stamp = isoDate();
    const already = (prev.mindLogs ?? []).some(
      (log) => log.practiceId === practiceId && isoDate(new Date(log.date)) === stamp
    );
    if (already) return;
    write({
      ...prev,
      mindLogs: [
        ...(prev.mindLogs ?? []),
        { id: crypto.randomUUID(), date: new Date().toISOString(), practiceId },
      ],
    });
  }, []);

  const logMeal = useCallback((slot: MealSlot) => {
    const prev = getSnapshot();
    if (!prev) return;
    const stamp = isoDate();
    const already = (prev.mealLogs ?? []).some(
      (log) => log.slot === slot && isoDate(new Date(log.date)) === stamp
    );
    if (already) return;
    write({
      ...prev,
      mealLogs: [
        ...(prev.mealLogs ?? []),
        { id: crypto.randomUUID(), date: new Date().toISOString(), slot },
      ],
    });
  }, []);

  const requestCoachPlan = useCallback(async () => {
    const prev = getSnapshot();
    if (!prev || prev.profile.equipment !== "coach") return;
    await submitCoachRequest();
    if (prev.coachPlanRequestedAt) return;
    write({ ...prev, coachPlanRequestedAt: new Date().toISOString() });
  }, []);

  const enterDemoProfessional = useCallback((next: Account) => {
    bindStorageUser(next.userId);
    cache = null;
    draftCache = null;
    setAccount(next);
    emit();
    setRemoteReady(true);
  }, []);

  const logoutDemo = useCallback(async () => {
    await logoutDemoProfessional();
    bindStorageUser(null);
    cache = null;
    draftCache = null;
    setAccount(null);
    emit();
    setRemoteReady(true);
  }, []);

  const reset = useCallback(() => {
    draftCache = null;
    write(null, false);
    void persistNow().catch(() => {
      toast.error("No se pudo borrar en la base de datos.", { id: "db-save" });
    });
  }, []);

  const value = useMemo(
    () => ({
      ready,
      state,
      draft,
      account,
      saveDraft,
      chooseRole,
      linkProfessional,
      startPlan,
      rebuildPlan,
      logSession,
      unlogSession,
      toggleExercise,
      submitCheckIn,
      acceptNutritionGuide,
      acceptPlanGuide,
      saveNutritionMenu,
      acceptMindGuide,
      saveMindPrefs,
      logMindPractice,
      logMeal,
      requestCoachPlan,
      enterDemoProfessional,
      logoutDemo,
      reset,
    }),
    [
      ready,
      state,
      draft,
      account,
      saveDraft,
      chooseRole,
      linkProfessional,
      startPlan,
      rebuildPlan,
      logSession,
      unlogSession,
      toggleExercise,
      submitCheckIn,
      acceptNutritionGuide,
      acceptPlanGuide,
      saveNutritionMenu,
      acceptMindGuide,
      saveMindPrefs,
      logMindPractice,
      logMeal,
      requestCoachPlan,
      enterDemoProfessional,
      logoutDemo,
      reset,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAppStore debe usarse dentro de AppProvider");
  return ctx;
}
