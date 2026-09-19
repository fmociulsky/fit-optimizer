import { TYPICAL_GYM_MACHINE_IDS } from "./gym-machines";
import type { AppState, Horizon, Profile } from "./types";

export function calcBmi(weightKg: number, heightCm: number) {
  if (heightCm <= 0) return 0;
  const meters = heightCm / 100;
  return weightKg / (meters * meters);
}

export function bmiCategory(bmi: number) {
  if (bmi < 18.5) return "Bajo peso";
  if (bmi < 25) return "Rango habitual";
  if (bmi < 30) return "Sobrepeso";
  return "Obesidad";
}

export function horizonWeeks(horizon: Horizon) {
  if (horizon === "short") return 6;
  if (horizon === "medium") return 16;
  return 36;
}

export function ageBand(age: number) {
  if (age < 30) return "young" as const;
  if (age < 45) return "adult" as const;
  if (age < 60) return "mature" as const;
  return "senior" as const;
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

export function toLocalYmd(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function parseLocalYmd(ymd?: string | null) {
  if (!ymd) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function ageFromBirthDate(ymd: string, on = new Date()) {
  const birth = parseLocalYmd(ymd);
  if (!birth) return NaN;
  let age = on.getFullYear() - birth.getFullYear();
  const monthDiff = on.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && on.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

export function birthDateFromAge(age: number, on = new Date()) {
  return toLocalYmd(new Date(on.getFullYear() - age, on.getMonth(), on.getDate()));
}

export function profileAge(profile: Pick<Profile, "age" | "birthDate">, on = new Date()) {
  if (profile.birthDate) {
    const age = ageFromBirthDate(profile.birthDate, on);
    if (Number.isFinite(age) && age >= 0) return age;
  }
  return profile.age;
}

export function withComputedAge(profile: Profile, on = new Date()): Profile {
  const birthDate =
    profile.birthDate && parseLocalYmd(profile.birthDate)
      ? profile.birthDate
      : birthDateFromAge(profile.age, on);
  return { ...profile, birthDate, age: profileAge({ ...profile, birthDate }, on) };
}

export function birthDateBounds(on = new Date()) {
  return {
    min: toLocalYmd(new Date(on.getFullYear() - 85, on.getMonth(), on.getDate())),
    max: toLocalYmd(new Date(on.getFullYear() - 16, on.getMonth(), on.getDate())),
  };
}

export function daysElapsed(fromIso: string, to = new Date()) {
  const start = new Date(fromIso);
  start.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000));
}

export function currentWeek(state: AppState) {
  const elapsed = daysElapsed(state.plan.createdAt);
  return Math.min(state.plan.durationWeeks, Math.floor(elapsed / 7) + 1);
}

export function planProgress(state: AppState) {
  const elapsed = daysElapsed(state.plan.createdAt);
  const totalDays = state.plan.durationWeeks * 7;
  return Math.min(100, Math.round((elapsed / totalDays) * 100));
}

export function lastCheckInDate(state: AppState) {
  return state.checkIns.at(-1)?.date ?? state.plan.createdAt;
}

export function checkInDue(state: AppState, now = new Date()) {
  return daysElapsed(lastCheckInDate(state), now) >= 7;
}

export function daysUntilCheckIn(state: AppState, now = new Date()) {
  return Math.max(0, 7 - daysElapsed(lastCheckInDate(state), now));
}

export function isoDate(date = new Date()) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy.toISOString();
}

export function formatDate(iso: string) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}

export function jsWeekday(date = new Date()) {
  return date.getDay();
}

export function currentWeight(state: AppState) {
  return state.checkIns.at(-1)?.weightKg ?? state.profile.weightKg;
}

export function suggestedWeekdays(count: number) {
  if (count <= 2) return [2, 5];
  if (count === 3) return [1, 3, 5];
  if (count === 4) return [1, 2, 4, 5];
  if (count === 5) return [1, 2, 3, 4, 5];
  return [1, 2, 3, 4, 5, 6];
}

export function defaultDraftProfile(): Profile {
  return {
    name: "",
    birthDate: "",
    age: 32,
    sex: "female",
    weightKg: 70,
    heightCm: 168,
    medicalFlags: [],
    medicalNotes: "",
    experience: "beginner",
    equipment: "full_gym",
    gymMachines: [...TYPICAL_GYM_MACHINE_IDS],
    weekdays: [1, 3, 5],
    sessionMinutes: 45,
  };
}
