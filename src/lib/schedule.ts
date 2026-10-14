import type { AppState, CompletedSession, PlanSlice, WorkoutDay } from "./types";
import { isoDate, jsWeekday, toLocalYmd } from "./metrics";

export function cloneWorkoutDays(days: WorkoutDay[]): WorkoutDay[] {
  return days.map((day) => ({
    ...day,
    exercises: day.exercises.map((exercise) => ({ ...exercise })),
  }));
}

function currentSplitStart(state: AppState) {
  if (state.plan.effectiveFrom) return state.plan.effectiveFrom;
  const loaded = [...state.plan.adjustments]
    .reverse()
    .find((item) => item.reason === "Plan cargado por el profesor");
  if (loaded) return toLocalYmd(new Date(loaded.date));
  return toLocalYmd(new Date(state.plan.createdAt));
}

export function splitForDate(state: AppState, date: Date): WorkoutDay[] {
  const stamp = toLocalYmd(date);
  const history = state.planHistory ?? [];
  if (!state.plan.effectiveFrom && history.length === 0) {
    return state.plan.weeklySplit;
  }
  const from = currentSplitStart(state);
  if (stamp >= from) return state.plan.weeklySplit;
  const slice = history
    .filter((item) => item.effectiveFrom <= stamp)
    .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))
    .at(-1);
  return slice?.weeklySplit ?? [];
}

export function workoutOnDate(
  state: AppState,
  date = new Date()
): WorkoutDay | null {
  const weekday = jsWeekday(date);
  return splitForDate(state, date).find((day) => day.weekday === weekday) ?? null;
}

export function isHistoricalPlanDate(state: AppState, date: Date) {
  const history = state.planHistory ?? [];
  if (!state.plan.effectiveFrom && history.length === 0) return false;
  return toLocalYmd(date) < currentSplitStart(state);
}

export function replacePlanSplit(
  state: AppState,
  days: WorkoutDay[],
  at = new Date()
): { plan: AppState["plan"]; planHistory: PlanSlice[] } {
  const today = toLocalYmd(at);
  const prev = state.plan.weeklySplit;
  const prevFrom = currentSplitStart(state);
  let history = [...(state.planHistory ?? [])];
  if (prev.length && prevFrom < today) {
    const slice: PlanSlice = {
      effectiveFrom: prevFrom,
      weeklySplit: cloneWorkoutDays(prev),
    };
    const index = history.findIndex((item) => item.effectiveFrom === prevFrom);
    if (index >= 0) history[index] = slice;
    else history.push(slice);
  }
  return {
    planHistory: history,
    plan: {
      ...state.plan,
      weeklySplit: cloneWorkoutDays(days),
      effectiveFrom: today,
    },
  };
}

export function todayWorkout(state: AppState, date = new Date()): WorkoutDay | null {
  return workoutOnDate(state, date);
}

export function sessionOnDate(state: AppState, dayId: string, date = new Date()) {
  const stamp = isoDate(date);
  const exact = state.sessions.find(
    (s) => s.dayId === dayId && isoDate(new Date(s.date)) === stamp
  );
  if (exact) return exact;
  const sameDay = state.sessions.filter(
    (s) => isoDate(new Date(s.date)) === stamp
  );
  return sameDay.length === 1 ? sameDay[0] : undefined;
}

export function startOfMonday(date = new Date()) {
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export function dateForWeekday(weekday: number, date = new Date()) {
  const monday = startOfMonday(date);
  const offset = weekday === 0 ? 6 : weekday - 1;
  const result = new Date(monday);
  result.setDate(monday.getDate() + offset);
  return result;
}

export function sessionsThisWeek(state: AppState, date = new Date()) {
  const monday = startOfMonday(date);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 7);
  return state.sessions.filter((s) => {
    const t = new Date(s.date).getTime();
    return t >= monday.getTime() && t < sunday.getTime();
  });
}

export function weekGrid(state: AppState, date = new Date()) {
  return [1, 2, 3, 4, 5, 6, 0].map((weekday) => ({
    weekday,
    date: dateForWeekday(weekday, date),
    workout: state.plan.weeklySplit.find((day) => day.weekday === weekday) ?? null,
  }));
}

export function markSession(
  dayId: string,
  rpe: number,
  date = new Date(),
  exercisesDone?: string[]
): CompletedSession {
  return {
    id: crypto.randomUUID(),
    date: isoDate(date),
    dayId,
    rpe,
    exercisesDone,
  };
}

export function upsertSession(
  state: AppState,
  dayId: string,
  date: Date,
  patch: { rpe?: number; exercisesDone?: string[] }
): CompletedSession[] {
  const existing = sessionOnDate(state, dayId, date);
  if (existing) {
    return state.sessions.map((session) =>
      session.id === existing.id
        ? {
            ...session,
            rpe: patch.rpe ?? session.rpe,
            exercisesDone: patch.exercisesDone ?? session.exercisesDone,
          }
        : session
    );
  }
  return [
    ...state.sessions,
    markSession(dayId, patch.rpe ?? 7, date, patch.exercisesDone),
  ];
}

export function removeSession(state: AppState, dayId: string, date: Date) {
  const existing = sessionOnDate(state, dayId, date);
  if (!existing) return state.sessions;
  return state.sessions.filter((session) => session.id !== existing.id);
}
