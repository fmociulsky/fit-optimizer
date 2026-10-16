import type {
  ClientPaymentStatus,
  Equipment,
  Experience,
  FocusArea,
  GoalType,
  Horizon,
  Intensity,
  MedicalFlag,
  Sex,
  StudioDayHours,
  StudioKind,
} from "./types";

export const WEEKDAYS: { id: number; short: string; full: string }[] = [
  { id: 1, short: "Lun", full: "Lunes" },
  { id: 2, short: "Mar", full: "Martes" },
  { id: 3, short: "Mié", full: "Miércoles" },
  { id: 4, short: "Jue", full: "Jueves" },
  { id: 5, short: "Vie", full: "Viernes" },
  { id: 6, short: "Sáb", full: "Sábado" },
  { id: 0, short: "Dom", full: "Domingo" },
];

export function studioKindsLabel(kinds: StudioKind[]) {
  const gym = kinds.includes("gym");
  const pilates = kinds.includes("pilates");
  if (gym && pilates) return "Gimnasio y pilates";
  if (gym) return "Gimnasio";
  return "Pilates";
}

export function activityShortLabel(kinds: StudioKind[]) {
  const gym = kinds.includes("gym");
  const pilates = kinds.includes("pilates");
  if (gym && pilates) return "Ambos";
  if (gym) return "Gimnasio";
  return "Pilates";
}

export function studioHoursSummary(dayHours: StudioDayHours[]) {
  if (!dayHours.length) return "Sin días abiertos";
  const days = WEEKDAYS.filter((day) =>
    dayHours.some((item) => item.weekday === day.id)
  )
    .map((day) => day.short)
    .join(" · ");
  const first = dayHours[0];
  const same = dayHours.every(
    (item) => item.openFrom === first.openFrom && item.openTo === first.openTo
  );
  return same ? `${days} · ${first.openFrom}–${first.openTo}` : days;
}

export const SEX_LABEL: Record<Sex, string> = {
  female: "Mujer",
  male: "Hombre",
  other: "Otro / prefiero no decir",
};

export const CLIENT_PAYMENT_STATUS_LABEL: Record<ClientPaymentStatus, string> = {
  current: "Al día",
  overdue: "Deuda",
  paused: "Pausado",
  trial: "Prueba",
  comp: "Cortesía",
};

/** Rol gramatical según el sexo del profesor. */
export function teacherRoleWord(sex?: Sex | null) {
  return sex === "female" ? "profesora" : "profesor";
}

export const EXPERIENCE_LABEL: Record<Experience, string> = {
  beginner: "Principiante",
  intermediate: "Intermedio",
  advanced: "Avanzado",
};

export const EXPERIENCE_HINT: Record<Experience, string> = {
  beginner: "Menos de un año entrenando con cierta constancia",
  intermediate: "Ya manejas la técnica básica y puedes progresar cargas",
  advanced: "Varios años, buena técnica y recuperación conocida",
};

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  full_gym: "Gimnasio",
  home_dumbbells: "Casa",
  bodyweight: "Casa, sin pesas",
  pilates: "Pilates",
  coach: "Mi profesor",
};

export const EQUIPMENT_HINT: Record<Equipment, string> = {
  full_gym: "Luego marcas las máquinas que hay de verdad",
  home_dumbbells: "Luego marcas mancuernas, banco, bandas o lo que tengas",
  bodyweight: "Luego marcas silla, colchoneta, bandas, pared…",
  pilates: "Luego marcas colchoneta, reformer, aro o lo que uses en sala",
  coach: "El gimnasio te asigna quién te entrena",
};

export const HORIZON_LABEL: Record<Horizon, string> = {
  short: "Corto plazo",
  medium: "Mediano plazo",
  long: "Largo plazo",
};

export const HORIZON_HINT: Record<Horizon, string> = {
  short: "6 semanas · un empujón concreto",
  medium: "16 semanas · un bloque con margen",
  long: "36 semanas · construir de verdad",
};

export const GOAL_LABEL: Record<GoalType, string> = {
  fat_loss: "Perder grasa",
  muscle_gain: "Ganar músculo",
  strength: "Ganar fuerza",
  endurance: "Mejorar resistencia",
  health: "Salud y constancia",
};

export const FOCUS_AREA_LABEL: Record<FocusArea, string> = {
  full_body: "Cuerpo completo",
  legs: "Piernas",
  glutes: "Glúteos",
  chest: "Pecho",
  back: "Espalda",
  shoulders: "Hombros",
  arms: "Brazos",
  core: "Core",
  cardio: "Cardio",
};

export const FOCUS_AREA_HINT: Record<FocusArea, string> = {
  full_body: "Sin priorizar una zona: el plan reparte el trabajo",
  legs: "Cuádriceps, isquios y trabajo de rodilla",
  glutes: "Puente, hip thrust y bisagra de cadera",
  chest: "Empujes horizontales",
  back: "Remo y jalón",
  shoulders: "Press vertical y deltoides",
  arms: "Bíceps y tríceps",
  core: "Plancha, antirotación y estabilidad",
  cardio: "Cinta, bici o intervalos suaves",
};

export const FOCUS_ZONE_OPTIONS: Exclude<FocusArea, "full_body">[] = [
  "legs",
  "glutes",
  "chest",
  "back",
  "shoulders",
  "arms",
  "core",
  "cardio",
];

export const GOAL_HINT: Record<GoalType, string> = {
  fat_loss: "Mantener músculo mientras bajas peso con calma",
  muscle_gain: "Hipertrofia con progresión de volumen",
  strength: "Patrones básicos y cargas manejables",
  endurance: "Capacidad aeróbica sin dejar la fuerza",
  health: "Moverte mejor, dormir mejor, aguantar el año",
};

export const MEDICAL_LABEL: Record<MedicalFlag, string> = {
  none: "Ninguno que condicione el entrenamiento",
  hypertension: "Hipertensión",
  diabetes: "Diabetes",
  back_pain: "Dolor de espalda",
  knee_hip: "Molestias de rodilla o cadera",
  asthma: "Asma",
  cardiac: "Antecedente cardíaco",
  recent_injury: "Lesión reciente",
  pregnancy: "Embarazo o postparto reciente",
};

export const INTENSITY_LABEL: Record<Intensity, string> = {
  low: "Suave",
  moderate: "Moderada",
  high: "Alta",
};

export function weekdayName(id: number) {
  return WEEKDAYS.find((d) => d.id === id)?.full ?? "Día";
}

export function weekdayShort(id: number) {
  return WEEKDAYS.find((d) => d.id === id)?.short ?? "—";
}
