import type {
  Equipment,
  Experience,
  GoalType,
  Horizon,
  Intensity,
  MedicalFlag,
  Sex,
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

export const SEX_LABEL: Record<Sex, string> = {
  female: "Mujer",
  male: "Hombre",
  other: "Otro / prefiero no decir",
};

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
  full_gym: "Gimnasio completo",
  home_dumbbells: "Casa: mancuernas y poco más",
  bodyweight: "Peso corporal / bandas",
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
