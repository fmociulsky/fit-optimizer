import type { AppState, CompletedSession, WorkoutDay } from "./types";
import { isoDate, jsWeekday } from "./metrics";

export function todayWorkout(state: AppState, date = new Date()): WorkoutDay | null {
  const weekday = jsWeekday(date);
  return state.plan.weeklySplit.find((day) => day.weekday === weekday) ?? null;
}

export function sessionOnDate(state: AppState, dayId: string, date = new Date()) {
  const stamp = isoDate(date);
  return state.sessions.find(
    (s) => s.dayId === dayId && isoDate(new Date(s.date)) === stamp
  );
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

export function weekGrid(state: AppState) {
  return [1, 2, 3, 4, 5, 6, 0].map((weekday) => ({
    weekday,
    workout: state.plan.weeklySplit.find((d) => d.weekday === weekday) ?? null,
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
