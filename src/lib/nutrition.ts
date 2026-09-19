import { GOAL_LABEL } from "./labels";
import { calcBmi, profileAge } from "./metrics";
import type { Goal, GoalType, MedicalFlag, Profile } from "./types";

export const NUTRITION_PROFESSIONAL_WARNING =
  "Debes consultar a un nutricionista o dietista-nutricionista profesional. Esta sección es una guía orientativa, no un plan clínico ni una prescripción.";

export const NUTRITION_ACCEPTANCE_TEXT =
  "He leído el aviso. Acepto usar esta información como guía, bajo mi responsabilidad, y sé que debo contrastarla con un profesional de la nutrición o de la salud.";

export type NutritionMeal = {
  name: string;
  items: string[];
  note?: string;
};

export type NutritionGuide = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  calorieNote: string;
  proteinNote: string;
  summary: string;
  principles: string[];
  meals: NutritionMeal[];
  training: { title: string; text: string }[];
  groceries: { group: string; items: string[] }[];
  medical: string[];
  disclaimer: string;
};

function hasFlag(flags: MedicalFlag[], flag: MedicalFlag) {
  return flags.includes(flag) && !flags.includes("none");
}

function roundTo(value: number, step: number) {
  return Math.round(value / step) * step;
}

function bmrKcal(profile: Profile, weightKg: number) {
  const base = 10 * weightKg + 6.25 * profile.heightCm - 5 * profileAge(profile);
  if (profile.sex === "male") return base + 5;
  if (profile.sex === "female") return base - 161;
  return base - 78;
}

function activityFactor(profile: Profile) {
  const days = profile.weekdays.length;
  const longSession = profile.sessionMinutes >= 60 ? 0.04 : 0;
  if (days <= 2) return 1.35 + longSession;
  if (days === 3) return 1.48 + longSession;
  if (days === 4) return 1.55 + longSession;
  if (days === 5) return 1.62 + longSession;
  return 1.7 + longSession;
}

function calorieFloor(profile: Profile) {
  if (hasFlag(profile.medicalFlags, "pregnancy")) return 1800;
  if (profile.sex === "female") return 1400;
  if (profile.sex === "male") return 1600;
  return 1500;
}

function proteinPerKg(goal: GoalType) {
  if (goal === "fat_loss") return 1.8;
  if (goal === "muscle_gain") return 1.8;
  if (goal === "strength") return 1.7;
  if (goal === "endurance") return 1.6;
  return 1.5;
}

function calorieShift(goal: GoalType, tdee: number, profile: Profile) {
  const pregnant = hasFlag(profile.medicalFlags, "pregnancy");
  if (pregnant) {
    return {
      kcal: roundTo(tdee + 150, 50),
      note: "Con embarazo o postparto reciente no recortamos calorías. Esta cifra es de mantenimiento con un margen pequeño; tu profesional manda.",
    };
  }
  if (goal === "fat_loss") {
    const raw = tdee - 350;
    const kcal = Math.max(calorieFloor(profile), roundTo(raw, 50));
    return {
      kcal,
      note:
        kcal > raw
          ? "El déficit que salía era agresivo para tu talla. Lo dejamos en un suelo seguro: bajar despacio vale más que un recorte que no puedes repetir."
          : "Déficit pequeño (~350 kcal). Si en dos check-ins el peso no se mueve, recortamos un poco más. Si te agotas, subimos comida, no bajamos sueño.",
    };
  }
  if (goal === "muscle_gain") {
    return {
      kcal: roundTo(tdee + 250, 50),
      note: "Superávit ligero (~250 kcal). Comer “de todo” sin tope suele ser más grasa que músculo.",
    };
  }
  if (goal === "strength") {
    return {
      kcal: roundTo(tdee + 100, 50),
      note: "Casi mantenimiento, con un margen para rendir con cargas. La fuerza pide proteína y carbohidratos alrededor de las series, no un atracón.",
    };
  }
  if (goal === "endurance") {
    return {
      kcal: roundTo(tdee + 150, 50),
      note: "Un poco por encima del gasto para aguantar el cardio. Si entrenas en ayunas y te mareas, deja de hacerlo.",
    };
  }
  return {
    kcal: roundTo(tdee, 50),
    note: "Mantenimiento. El objetivo es que puedas repetir el patrón, no clavar un número cada día.",
  };
}

export function buildNutritionGuide(
  profile: Profile,
  goal: Goal,
  weightKg = profile.weightKg
): NutritionGuide {
  const tdee = bmrKcal(profile, weightKg) * activityFactor(profile);
  const { kcal, note: calorieNote } = calorieShift(goal.type, tdee, profile);
  const proteinG = Math.max(80, roundTo(proteinPerKg(goal.type) * weightKg, 5));
  const fatG = Math.max(45, roundTo(0.8 * weightKg, 5));
  const carbKcal = Math.max(0, kcal - proteinG * 4 - fatG * 9);
  const carbsG = Math.max(80, roundTo(carbKcal / 4, 5));
  const bmi = calcBmi(weightKg, profile.heightCm);
  const extraCarbs = goal.type === "endurance" || goal.type === "muscle_gain";

  const principles = [
    "Proteína en cada comida (huevos, yogur, pollo, pescado, tofu, legumbres).",
    extraCarbs
      ? "Carbohidratos alrededor del entrenamiento: arroz, patata, avena, fruta. Ahí rinden, no a las 23:40."
      : "Verdura en el plato principal. El volumen de comida llena sin inflar calorías.",
    "Agua a lo largo del día. Si orinas muy oscuro, no es “definición”: es que bebes poco.",
    "Cocina simple y repetible. Tres platos que te gusten ganan a una dieta con nombre.",
    profileAge(profile) >= 50
      ? "A partir de los 50 la proteína no es un extra: es lo que sostiene músculo y recuperación."
      : "Duerme 7–9 h. Sin sueño el plan de comida se deshace aunque cuadren las kcal.",
  ];

  if (goal.targetWeightKg) {
    const delta = goal.targetWeightKg - weightKg;
    principles.push(
      delta < 0
        ? `Objetivo ${goal.targetWeightKg} kg (${Math.abs(delta).toFixed(1)} kg menos). Ritmo realista: 0,3–0,6 kg por semana, no una carrera.`
        : `Objetivo ${goal.targetWeightKg} kg (${delta.toFixed(1)} kg más). Sube despacio para no acumular solo grasa.`
    );
  }

  const meals: NutritionMeal[] =
    goal.type === "fat_loss"
      ? [
          {
            name: "Desayuno",
            items: [
              "Yogur griego o 2 huevos",
              "Fruta o un puñado de avena",
              "Café o té, sin convertirlos en postre",
            ],
          },
          {
            name: "Comida",
            items: [
              "Palma de proteína (pollo, pescado, tofu, lentejas)",
              "Medio plato de verdura",
              "Puño de arroz, patata o pan integral",
            ],
            note: "Si sales a comer fuera: mismo dibujo. Pide la salsa aparte.",
          },
          {
            name: "Merienda (si hay hambre o entrenas tarde)",
            items: ["Yogur, fruta o un puñado de frutos secos", "Agua"],
          },
          {
            name: "Cena",
            items: [
              "Otra palma de proteína",
              "Verdura generosa",
              "Carbohidrato más corto que en la comida, salvo que entrenes por la noche",
            ],
          },
        ]
      : [
          {
            name: "Desayuno",
            items: [
              "Avena o pan integral",
              "Huevos, yogur o queso fresco",
              "Fruta y un chorro de aceite de oliva o frutos secos",
            ],
          },
          {
            name: "Comida",
            items: [
              "Palma y media de proteína",
              "Puño o puño y medio de arroz, pasta o patata",
              "Verdura y aceite de oliva",
            ],
          },
          {
            name: "Merienda",
            items: extraCarbs
              ? ["Plátano o tostada + yogur", "Si entrenas en 60–90 min, esto es el combustible"]
              : ["Yogur, fruta o un puñado de frutos secos"],
          },
          {
            name: "Cena",
            items: [
              "Proteína otra vez",
              "Verdura",
              "Carbohidrato según cómo hayas entrenado: más si fue duro, menos si fue descanso",
            ],
          },
        ];

  const training = [
    {
      title: "Antes de entrenar",
      text:
        goal.type === "endurance"
          ? "Un pequeño snack 45–90 min antes (plátano, yogur, tostada). El cardio largo en ayunas no es un mérito si te marea."
          : "No hace falta un ritual. Si han pasado más de 3–4 h sin comer, un yogur o fruta basta. Entrena con cabeza, no vacío.",
    },
    {
      title: "Después",
      text: `En las 2 h siguientes: proteína (${Math.round(proteinG / 4)} g orientativos) y un carbohidrato. El batido no es obligatorio si hay comida de verdad.`,
    },
    {
      title: "Días de descanso",
      text:
        goal.type === "fat_loss"
          ? "Misma proteína, un poco menos de arroz o pan. El descanso no es premio para desmontar el déficit."
          : "No recortes a lo loco. Recuperar es parte del plan: come, duerme, camina.",
    },
  ];

  const groceries = [
    {
      group: "Proteína",
      items: [
        "Huevos",
        "Yogur natural o griego",
        "Pollo o pavo",
        "Pescado o atún al natural",
        "Legumbres (lentejas, garbanzos)",
        "Tofu o soja texturizada",
      ],
    },
    {
      group: "Carbohidratos",
      items: ["Avena", "Arroz", "Patata o boniato", "Pan integral", "Fruta de temporada"],
    },
    {
      group: "Verdura y grasa",
      items: [
        "Lo que esté barato y te guste (brócoli, ensalada, calabacín, tomate)",
        "Aceite de oliva",
        "Un puñado de frutos secos",
      ],
    },
  ];

  const medical: string[] = [];
  if (hasFlag(profile.medicalFlags, "diabetes")) {
    medical.push(
      "Con diabetes, los horarios y el tipo de carbohidrato tienen que alinearse con tu tratamiento. Esta guía no sustituye a tu equipo médico."
    );
  }
  if (hasFlag(profile.medicalFlags, "hypertension")) {
    medical.push(
      "Hipertensión: menos ultraprocesados y sal de más. El déficit agresivo no es un atajo clínico."
    );
  }
  if (hasFlag(profile.medicalFlags, "cardiac")) {
    medical.push(
      "Antecedente cardíaco: cualquier cambio de dieta o peso, con tu cardiólogo o médico de referencia."
    );
  }
  if (hasFlag(profile.medicalFlags, "pregnancy")) {
    medical.push(
      "Embarazo o postparto: no es momento de dietas de recorte. Prioriza proteína, hierro, hidratos y lo que te indique tu profesional."
    );
  }
  if (bmi < 18.5 && goal.type === "fat_loss") {
    medical.push(
      "Tu IMC está en rango bajo y el objetivo es perder grasa. Conviene revisar el objetivo con un profesional antes de recortar más comida."
    );
  }

  return {
    calories: kcal,
    proteinG,
    carbsG,
    fatG,
    calorieNote,
    proteinNote: `Unos ${proteinG} g de proteína al día (${proteinPerKg(goal.type).toString().replace(".", ",")} g/kg). Reparte en 3–4 tomas, no en un filete a las 22:00.`,
    summary: `${GOAL_LABEL[goal.type]} · ${profile.weekdays.length} días de entreno · ${profile.sessionMinutes} min. Orientación, no prescripción.`,
    principles,
    meals,
    training,
    groceries,
    medical,
    disclaimer:
      "Al usar esta guía aceptas que es orientativa y que no sustituye a un nutricionista profesional ni a tu médico. Si hay patología, medicación, embarazo, alergias o un IMC extremo, consulta antes de cambiar cómo comes.",
  };
}

export function nutritionHints(
  profile: Profile,
  goal: Goal,
  weightKg = profile.weightKg
) {
  const guide = buildNutritionGuide(profile, goal, weightKg);
  const hints = [guide.proteinNote, guide.calorieNote];
  if (goal.type === "health") {
    hints.push("Patrón simple: proteína en cada comida, verdura, y consistencia antes que dietas con nombre.");
  }
  hints.push(...guide.medical);
  if (goal.targetWeightKg) {
    const delta = goal.targetWeightKg - weightKg;
    hints.push(
      delta < 0
        ? `Objetivo de peso: ${goal.targetWeightKg} kg (${Math.abs(delta).toFixed(1)} kg menos). Ritmo realista, no carrera.`
        : `Objetivo de peso: ${goal.targetWeightKg} kg (${delta.toFixed(1)} kg más). Sube despacio para no acumular solo grasa.`
    );
  }
  return hints.slice(0, 5);
}
