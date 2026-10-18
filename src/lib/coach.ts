import { TYPICAL_GYM_MACHINE_IDS } from "./gym-machines";
import { defaultDraftProfile, withComputedAge } from "./metrics";
import { TYPICAL_PILATES_IDS } from "./pilates";
import { generatePlan } from "./plan";
import type { AppState, Equipment, Goal, GoalType, MedicalFlag, Profile } from "./types";

export function isCoachLed(
  profile: Pick<Profile, "equipment"> | Equipment | null | undefined
) {
  if (!profile) return false;
  if (typeof profile === "string") return profile === "coach";
  return profile.equipment === "coach";
}

export function planHasExercises(state: AppState | null | undefined) {
  return Boolean(
    state?.plan.weeklySplit.some((day) =>
      day.exercises.some((exercise) => exercise.name.trim())
    )
  );
}

export function isCoachPlanPending(state: AppState | null | undefined) {
  return Boolean(state && isCoachLed(state.profile) && !planHasExercises(state));
}

export const DEFAULT_COACH_GOAL: Goal = {
  horizon: "medium",
  type: "health",
  targetWeightKg: null,
  notes: "",
  focusAreas: ["full_body"],
};

export function defaultCoachLedProfile(input: {
  name: string;
  birthDate?: string;
  weekdays?: number[];
  sessionMinutes?: number;
  gymMachines?: string[];
  pilatesItems?: string[];
}): Profile {
  const base = defaultDraftProfile();
  return withComputedAge({
    ...base,
    name: input.name,
    birthDate: input.birthDate || base.birthDate,
    equipment: "coach",
    gymMachines: input.gymMachines?.length
      ? input.gymMachines
      : [...TYPICAL_GYM_MACHINE_IDS],
    pilatesItems: input.pilatesItems?.length
      ? input.pilatesItems
      : [...TYPICAL_PILATES_IDS],
    weekdays: input.weekdays?.length ? input.weekdays : [1, 3, 5],
    sessionMinutes: input.sessionMinutes ?? 45,
  });
}

export function defaultCoachLedState(profile: Profile, goal: Goal = DEFAULT_COACH_GOAL): AppState {
  const now = new Date().toISOString();
  return {
    profile,
    goal,
    plan: generatePlan(profile, goal),
    checkIns: [],
    sessions: [],
    planAcceptedAt: now,
  };
}

export const COACH_PLAN_REQUEST_TITLE =
  "Solicitar plan de entrenamiento al profesor";

const GOAL_TYPES: GoalType[] = [
  "fat_loss",
  "muscle_gain",
  "strength",
  "endurance",
  "health",
];

const MEDICAL_FLAGS: MedicalFlag[] = [
  "none",
  "hypertension",
  "diabetes",
  "back_pain",
  "knee_hip",
  "asthma",
  "cardiac",
  "recent_injury",
  "pregnancy",
];

export function coachPlanMetricsError(input: {
  weightKg: number;
  heightCm: number;
  goalType: string;
  medicalFlags: string[];
  medicalNotes: string;
}) {
  if (!Number.isFinite(input.weightKg) || input.weightKg < 40 || input.weightKg > 220) {
    return "Indica el peso del alumno, entre 40 y 220 kg.";
  }
  if (!Number.isFinite(input.heightCm) || input.heightCm < 140 || input.heightCm > 220) {
    return "Indica la altura del alumno, entre 140 y 220 cm.";
  }
  if (!GOAL_TYPES.includes(input.goalType as GoalType)) {
    return "Elige el objetivo del alumno.";
  }
  if (
    !input.medicalFlags.length ||
    input.medicalFlags.some((flag) => !MEDICAL_FLAGS.includes(flag as MedicalFlag))
  ) {
    return "Marca al menos un detalle de salud, aunque sea “ninguno”.";
  }
  if (input.medicalFlags.includes("none") && input.medicalFlags.length > 1) {
    return "Si no condiciona el entrenamiento, no marques otros antecedentes.";
  }
  if (input.medicalNotes.length > 600) {
    return "Las notas de salud son demasiado largas.";
  }
  return null;
}
