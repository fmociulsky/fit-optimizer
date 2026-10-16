export type Sex = "female" | "male" | "other";
export type Experience = "beginner" | "intermediate" | "advanced";
export type Horizon = "short" | "medium" | "long";
export type GoalType =
  | "fat_loss"
  | "muscle_gain"
  | "strength"
  | "endurance"
  | "health";
export type Equipment =
  | "full_gym"
  | "home_dumbbells"
  | "bodyweight"
  | "pilates"
  | "coach";
export type Intensity = "low" | "moderate" | "high";
export type FocusArea =
  | "full_body"
  | "legs"
  | "glutes"
  | "chest"
  | "back"
  | "shoulders"
  | "arms"
  | "core"
  | "cardio";

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
  birthDate?: string;
  age: number;
  sex: Sex;
  weightKg: number;
  heightCm: number;
  medicalFlags: MedicalFlag[];
  medicalNotes: string;
  experience: Experience;
  equipment: Equipment;
  gymMachines?: string[];
  homeItems?: string[];
  pilatesItems?: string[];
  weekdays: number[];
  sessionMinutes: number;
}

export interface Goal {
  horizon: Horizon;
  type: GoalType;
  targetWeightKg: number | null;
  notes: string;
  focusAreas?: FocusArea[];
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

export interface PlanSlice {
  effectiveFrom: string;
  weeklySplit: WorkoutDay[];
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
  coachNutrition?: string[];
  loadedBy?: {
    userId: string;
    name: string;
  };
  weeklyFocus: string;
  adjustments: Adjustment[];
  effectiveFrom?: string;
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
  exercisesDone?: string[];
}

export interface NutritionPrefs {
  restrictions: FoodRestriction[];
  dislikes: FoodDislike[];
  notes: string;
}

export interface WeeklyMenuMeal {
  slot: MealSlot;
  title: string;
  items: string[];
  note?: string;
}

export interface WeeklyMenuDay {
  weekday: number;
  trainingName: string | null;
  trainingIntensity: Intensity | null;
  note: string;
  meals: WeeklyMenuMeal[];
}

export interface WeeklyMenu {
  generatedAt: string;
  summary: string;
  rationale: string[];
  days: WeeklyMenuDay[];
  groceries: { group: string; items: string[] }[];
}

export type MealSlot = "breakfast" | "lunch" | "snack" | "dinner";

export type FoodRestriction =
  | "none"
  | "dairy"
  | "gluten"
  | "egg"
  | "fish"
  | "shellfish"
  | "nuts"
  | "peanuts"
  | "soy"
  | "legumes";

export type FoodDislike =
  | "chicken"
  | "red_meat"
  | "pork"
  | "fish"
  | "egg"
  | "dairy"
  | "legumes"
  | "nuts"
  | "oats"
  | "spicy";

export type MindFocus =
  | "sleep"
  | "stress"
  | "focus"
  | "consistency"
  | "body";

export interface MindPrefs {
  focuses: MindFocus[];
  notes: string;
}

export interface MindLog {
  id: string;
  date: string;
  practiceId: string;
}

export interface MealLog {
  id: string;
  date: string;
  slot: MealSlot;
}

export interface AppState {
  profile: Profile;
  goal: Goal;
  plan: Plan;
  checkIns: CheckIn[];
  sessions: CompletedSession[];
  nutritionAcceptedAt?: string;
  planAcceptedAt?: string;
  nutritionPrefs?: NutritionPrefs;
  weeklyMenu?: WeeklyMenu;
  mindAcceptedAt?: string;
  mindPrefs?: MindPrefs;
  mindLogs?: MindLog[];
  mealLogs?: MealLog[];
  coachPlanRequestedAt?: string;
  planHistory?: PlanSlice[];
}

export interface OnboardingDraft {
  profile: Profile;
  goal: Goal;
}

export interface PersistedUser {
  state: AppState | null;
  draft: OnboardingDraft | null;
}

export type AccountRole = "client" | "professional" | "studio";
export type StudioMemberRole = "owner" | "teacher" | "client";

/** Estado de cuenta / pago del alumno en el estudio. */
export type ClientPaymentStatus =
  | "current"
  | "overdue"
  | "paused"
  | "trial"
  | "comp";

/** Plan de facturación del alumno. */
export type ClientBillingPlan = "monthly" | "quarterly" | "annual";

export type CoachRequestStatus = "pending" | "loaded";

export interface Account {
  userId: string;
  role: AccountRole;
  name: string;
  username: string | null;
  code: string | null;
  linkedProfessionalId: string | null;
  linkedProfessionalCode: string | null;
  studioRole: StudioMemberRole | null;
}

export type StudioKind = "pilates" | "gym";
export type StudioInviteRole = "teacher" | "client";

export function normalizeStudioKinds(
  raw: unknown,
  fallbackKind?: string
): StudioKind[] {
  const allowed: StudioKind[] = ["pilates", "gym"];
  if (Array.isArray(raw)) {
    const kinds = allowed.filter((kind) => raw.includes(kind));
    if (kinds.length) return kinds;
  }
  if (fallbackKind === "gym") return ["gym"];
  return ["pilates"];
}

export function studioHasKind(kinds: StudioKind[], kind: StudioKind) {
  return kinds.includes(kind);
}

export function parseClientActivities(
  raw: unknown,
  studioKinds: StudioKind[]
): StudioKind[] {
  const allowed = studioKinds.length ? studioKinds : (["gym"] as StudioKind[]);
  const picked = Array.isArray(raw)
    ? allowed.filter((kind) => raw.includes(kind))
    : [];
  const unique: StudioKind[] = [];
  for (const kind of picked) {
    if (!unique.includes(kind)) unique.push(kind);
  }
  if (!unique.length) {
    throw new Error("Elegí si hace gimnasio, pilates o ambos.");
  }
  return unique;
}

export function memberActivities(
  raw: unknown,
  studioKinds: StudioKind[]
): StudioKind[] {
  try {
    return parseClientActivities(raw, studioKinds);
  } catch {
    return studioKinds.length ? [...studioKinds] : ["gym"];
  }
}

export interface StudioDayHours {
  weekday: number;
  openFrom: string;
  openTo: string;
  gymCapacity?: number;
  pilatesCapacity?: number;
}

export interface StudioHours {
  dayHours: StudioDayHours[];
}

export interface Studio {
  id: string;
  ownerUserId: string;
  name: string;
  kinds: StudioKind[];
  code: string;
  pilatesItems: string[];
  gymMachines: string[];
  dayHours: StudioDayHours[];
  address: string;
  phone: string;
  capacityPerSlot: number;
}
