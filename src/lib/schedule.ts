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

export function sessionsThisWeek(state: AppState, date = new Date()) {
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);
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
  state: AppState,
  dayId: string,
  rpe: number
): CompletedSession {
  return {
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
    dayId,
    rpe,
  };
}
