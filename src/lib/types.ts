export type Sex = "female" | "male" | "other";
export type Experience = "beginner" | "intermediate" | "advanced";
export type Horizon = "short" | "medium" | "long";
export type GoalType =
  | "fat_loss"
  | "muscle_gain"
  | "strength"
  | "endurance"
  | "health";
export type Equipment = "full_gym" | "home_dumbbells" | "bodyweight";
export type Intensity = "low" | "moderate" | "high";

export type MedicalFlag =
  | "none"
  | "hypertension"
  | "diabetes"
  | "back_pain"
  | "knee_hip"
  | "asthma"
  | "cardiac"
  | "recent_injury"
  | "pregnancy";

export interface Profile {
  name: string;
  age: number;
  sex: Sex;
  weightKg: number;
  heightCm: number;
  medicalFlags: MedicalFlag[];
  medicalNotes: string;
  experience: Experience;
  equipment: Equipment;
  weekdays: number[];
  sessionMinutes: number;
}

export interface Goal {
  horizon: Horizon;
  type: GoalType;
  targetWeightKg: number | null;
  notes: string;
}

export interface Exercise {
  name: string;
  sets: number;
  reps: string;
  restSec: number;
  notes?: string;
}

export interface WorkoutDay {
  id: string;
  weekday: number;
  name: string;
  focus: string;
  durationMin: number;
  intensity: Intensity;
  exercises: Exercise[];
  warmup: string;
  cooldown: string;
}

export interface Adjustment {
  id: string;
  date: string;
  reason: string;
  changes: string[];
}

export interface Plan {
  id: string;
  createdAt: string;
  startWeightKg: number;
  version: number;
  durationWeeks: number;
  weeklySplit: WorkoutDay[];
  rationale: string[];
  warnings: string[];
  nutritionHints: string[];
  weeklyFocus: string;
  adjustments: Adjustment[];
}

export interface CheckIn {
  id: string;
  date: string;
  weightKg: number;
  energy: number;
  sleep: number;
  sessionsCompleted: number;
  pain: string;
  notes: string;
}

export interface CompletedSession {
  id: string;
  date: string;
  dayId: string;
  rpe: number;
}

export interface AppState {
  profile: Profile;
  goal: Goal;
  plan: Plan;
  checkIns: CheckIn[];
  sessions: CompletedSession[];
}

export interface OnboardingDraft {
  profile: Profile;
  goal: Goal;
}
