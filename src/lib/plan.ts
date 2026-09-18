import type {
  Equipment,
  Exercise,
  Goal,
  Intensity,
  MedicalFlag,
  Plan,
  Profile,
  WorkoutDay,
} from "./types";
import { ageBand, calcBmi, horizonWeeks } from "./metrics";
import { GOAL_LABEL, HORIZON_LABEL } from "./labels";

function uid() {
  return crypto.randomUUID();
}

function hasFlag(flags: MedicalFlag[], flag: MedicalFlag) {
  return flags.includes(flag) && !flags.includes("none");
}

function capIntensity(profile: Profile, preferred: Intensity): Intensity {
  const band = ageBand(profile.age);
  const conservative =
    hasFlag(profile.medicalFlags, "cardiac") ||
    hasFlag(profile.medicalFlags, "pregnancy") ||
    hasFlag(profile.medicalFlags, "recent_injury") ||
    hasFlag(profile.medicalFlags, "hypertension") ||
    band === "senior";

  if (conservative) {
    return preferred === "high" ? "moderate" : "low";
  }
  if (band === "mature" && preferred === "high") return "moderate";
  if (profile.experience === "beginner" && preferred === "high") return "moderate";
  return preferred;
}

function restFor(intensity: Intensity, extra = 0) {
  const base = intensity === "high" ? 120 : intensity === "moderate" ? 75 : 60;
  return base + extra;
}

function repsFor(goal: Goal, intensity: Intensity) {
  if (goal.type === "strength") {
    return intensity === "high" ? "4–6" : "5–8";
  }
  if (goal.type === "endurance" || goal.type === "fat_loss") {
    return "10–15";
  }
  if (goal.type === "health") return "8–12";
  return intensity === "high" ? "6–10" : "8–12";
}

function setsFor(profile: Profile, compound: boolean) {
  if (profile.experience === "beginner") return compound ? 3 : 2;
  if (profile.experience === "advanced") return compound ? 4 : 3;
  return 3;
}

type MoveKey =
  | "squat"
  | "hinge"
  | "lunge"
  | "press"
  | "row"
  | "pull"
  | "ohp"
  | "core"
  | "carry"
  | "glute"
  | "push_iso"
  | "pull_iso"
  | "cond"
  | "bike"
  | "walk"
  | "mobility"
  | "balance";

const MOVES: Record<Equipment, Record<MoveKey, string>> = {
  full_gym: {
    squat: "Sentadilla goblet o en máquina",
    hinge: "Peso muerto rumano con barra o mancuernas",
    lunge: "Zancada inversa",
    press: "Press banca con mancuernas",
    row: "Remo con mancuerna a una mano",
    pull: "Jalón al pecho o dominada asistida",
    ohp: "Press militar sentado",
    core: "Plancha con respiración controlada",
    carry: "Paseo del granjero",
    glute: "Hip thrust",
    push_iso: "Extensión de tríceps en polea",
    pull_iso: "Face pull",
    cond: "Intervalos suaves en elíptica",
    bike: "Bicicleta estática",
    walk: "Caminata inclinada",
    mobility: "Movilidad de cadera y torácica",
    balance: "Peso muerto a una pierna asistido",
  },
  home_dumbbells: {
    squat: "Sentadilla goblet",
    hinge: "Peso muerto rumano con mancuernas",
    lunge: "Zancada inversa",
    press: "Press de suelo o banco con mancuernas",
    row: "Remo con mancuerna",
    pull: "Remo invertido en mesa o bandas",
    ohp: "Press militar con mancuernas",
    core: "Plancha",
    carry: "Paseo del granjero",
    glute: "Puente de glúteos con peso",
    push_iso: "Press francés con mancuerna",
    pull_iso: "Pájaro (rear delt) con mancuernas",
    cond: "Circuito de bodyweight 40/20",
    bike: "Marcha en el sitio o saltos suaves",
    walk: "Caminata rápida exterior",
    mobility: "Movilidad de cadera y torácica",
    balance: "Peso muerto a una pierna",
  },
  bodyweight: {
    squat: "Sentadilla al cajón o al aire",
    hinge: "Good morning a peso corporal / puente",
    lunge: "Zancada inversa",
    press: "Flexiones elevadas o de rodillas",
    row: "Remo invertido o bandas",
    pull: "Superman + bandas de jalón",
    ohp: "Pike push-up o press con banda",
    core: "Plancha",
    carry: "Marcha con maleta o mochila",
    glute: "Puente de glúteos a una pierna",
    push_iso: "Fondos en silla",
    pull_iso: "Face pull con banda",
    cond: "Circuito 40/20 (sentadilla, flexión, plancha)",
    bike: "Step-ups al ritmo",
    walk: "Caminata rápida",
    mobility: "Movilidad de cadera y torácica",
    balance: "Peso muerto a una pierna",
  },
};

function swapForFlags(
  profile: Profile,
  key: MoveKey,
  name: string
): { name: string; notes?: string } {
  const flags = profile.medicalFlags;
  if (hasFlag(flags, "back_pain") && (key === "hinge" || key === "squat")) {
    return {
      name: key === "hinge" ? "Puente de glúteos / hip thrust ligero" : "Sentadilla a cajón controlada",
      notes: "Sin flexión lumbar cargada. Para si hay pinchazo.",
    };
  }
  if (hasFlag(flags, "knee_hip") && (key === "squat" || key === "lunge")) {
    return {
      name: key === "lunge" ? "Step-up bajo controlado" : "Sentadilla a cajón o prensa rango cómodo",
      notes: "Rango que no moleste. Sin rebotes.",
    };
  }
  if (hasFlag(flags, "cardiac") && (key === "cond" || key === "bike")) {
    return {
      name: "Caminata cómoda hablando",
      notes: "Mantén una intensidad en la que puedas hablar.",
    };
  }
  if (hasFlag(flags, "pregnancy") && key === "core") {
    return {
      name: "Respiración diafragmática + bird-dog",
      notes: "Evita crunch y planchas largas si hay diástasis o molestia.",
    };
  }
  if (hasFlag(flags, "hypertension") && key === "core") {
    return {
      name: "Bird-dog y dead bug",
      notes: "Sin aguantar la respiración.",
    };
  }
  return { name };
}

function ex(
  profile: Profile,
  goal: Goal,
  intensity: Intensity,
  key: MoveKey,
  extraNotes?: string,
  compound = true
): Exercise {
  const catalog = MOVES[profile.equipment][key];
  const swapped = swapForFlags(profile, key, catalog);
  const extraRest =
    hasFlag(profile.medicalFlags, "hypertension") ||
    hasFlag(profile.medicalFlags, "cardiac")
      ? 20
      : 0;
  const notes = [swapped.notes, extraNotes].filter(Boolean).join(" ");
  return {
    name: swapped.name,
    sets: setsFor(profile, compound),
    reps: key === "core" ? "20–40 s" : key === "carry" ? "30–40 m" : repsFor(goal, intensity),
    restSec: restFor(intensity, extraRest),
    notes: notes || undefined,
  };
}

function condBlock(profile: Profile, minutes: number): Exercise {
  const cardiac = hasFlag(profile.medicalFlags, "cardiac");
  const asthma = hasFlag(profile.medicalFlags, "asthma");
  const name = cardiac
    ? "Caminata cómoda"
    : asthma
      ? "Ciclismo o caminata continua"
      : MOVES[profile.equipment].walk;
  return {
    name,
    sets: 1,
    reps: `${minutes} min`,
    restSec: 0,
    notes: cardiac
      ? "Sin picos de esfuerzo. Puedes hablar en todo momento."
      : asthma
        ? "Calienta extra y evita intervalos a tope."
        : "Ritmo en el que respiras fuerte pero controlas.",
  };
}

function warmup(profile: Profile) {
  const parts = [
    "5 minutos de marcha o bici suave",
    "círculos de hombros",
    "movilidad de cadera",
  ];
  if (hasFlag(profile.medicalFlags, "asthma") || hasFlag(profile.medicalFlags, "cardiac")) {
    parts[0] = "8–10 minutos de calentamiento muy gradual";
  }
  if (hasFlag(profile.medicalFlags, "knee_hip")) {
    parts.push("extensiones de rodilla sin carga y puentes");
  }
  if (hasFlag(profile.medicalFlags, "back_pain")) {
    parts.push("gato-camello y respiración 90/90");
  }
  return parts.join(", ") + ".";
}

function cooldown() {
  return "3–5 minutos de caminata y estiramientos suaves de cadera, pecho y dorsal. Sin rebotes.";
}

function day(
  weekday: number,
  name: string,
  focus: string,
  intensity: Intensity,
  durationMin: number,
  exercises: Exercise[],
  profile: Profile
): WorkoutDay {
  return {
    id: uid(),
    weekday,
    name,
    focus,
    durationMin,
    intensity,
    exercises,
    warmup: warmup(profile),
    cooldown: cooldown(),
  };
}

function trimToMinutes(exercises: Exercise[], minutes: number) {
  const budget = minutes <= 30 ? 4 : minutes <= 45 ? 6 : minutes <= 60 ? 7 : 8;
  return exercises.slice(0, budget);
}

function templates(
  profile: Profile,
  goal: Goal,
  intensity: Intensity
): Omit<WorkoutDay, "id" | "weekday">[] {
  const minutes = profile.sessionMinutes;
  const condMin =
    goal.type === "fat_loss" || goal.type === "endurance"
      ? Math.min(20, Math.max(8, Math.round(minutes * 0.25)))
      : Math.min(12, Math.max(6, Math.round(minutes * 0.15)));

  const strengthA = trimToMinutes(
    [
      ex(profile, goal, intensity, "squat"),
      ex(profile, goal, intensity, "press"),
      ex(profile, goal, intensity, "row"),
      ex(profile, goal, intensity, "glute", undefined, false),
      ex(profile, goal, intensity, "core", undefined, false),
      condBlock(profile, condMin),
    ],
    minutes
  );

  const strengthB = trimToMinutes(
    [
      ex(profile, goal, intensity, "hinge"),
      ex(profile, goal, intensity, "ohp"),
      ex(profile, goal, intensity, "pull"),
      ex(profile, goal, intensity, "lunge"),
      ex(profile, goal, intensity, "carry", undefined, false),
      condBlock(profile, condMin),
    ],
    minutes
  );

  const upper = trimToMinutes(
    [
      ex(profile, goal, intensity, "press"),
      ex(profile, goal, intensity, "row"),
      ex(profile, goal, intensity, "ohp"),
      ex(profile, goal, intensity, "pull"),
      ex(profile, goal, intensity, "push_iso", undefined, false),
      ex(profile, goal, intensity, "pull_iso", undefined, false),
      ex(profile, goal, intensity, "core", undefined, false),
    ],
    minutes
  );

  const lower = trimToMinutes(
    [
      ex(profile, goal, intensity, "squat"),
      ex(profile, goal, intensity, "hinge"),
      ex(profile, goal, intensity, "lunge"),
      ex(profile, goal, intensity, "glute"),
      ex(profile, goal, intensity, "balance", undefined, false),
      ex(profile, goal, intensity, "core", undefined, false),
      condBlock(profile, condMin),
    ],
    minutes
  );

  const cardio = trimToMinutes(
    [
      condBlock(profile, Math.max(18, minutes - 12)),
      ex(profile, goal, intensity, "core", undefined, false),
      ex(profile, goal, "low" as Intensity, "mobility", undefined, false),
    ],
    minutes
  );

  const mobility = [
    ex(profile, goal, "low", "mobility"),
    ex(profile, goal, "low", "balance"),
    ex(profile, goal, "low", "core"),
    ex(profile, goal, "low", "walk"),
  ];

  const count = profile.weekdays.length;

  if (goal.type === "endurance") {
    if (count <= 3) {
      return [
        { name: "Fuerza + base", focus: "Cuerpo completo y caminata", intensity, durationMin: minutes, exercises: strengthA, warmup: warmup(profile), cooldown: cooldown() },
        { name: "Cardio controlado", focus: "Capacidad aeróbica", intensity: capIntensity(profile, "moderate"), durationMin: minutes, exercises: cardio, warmup: warmup(profile), cooldown: cooldown() },
        { name: "Fuerza B + base", focus: "Tirón, empujón y cadera", intensity, durationMin: minutes, exercises: strengthB, warmup: warmup(profile), cooldown: cooldown() },
      ];
    }
    return [
      { name: "Fuerza A", focus: "Empuje y sentadilla", intensity, durationMin: minutes, exercises: strengthA, warmup: warmup(profile), cooldown: cooldown() },
      { name: "Cardio 1", focus: "Zona cómoda", intensity: "moderate", durationMin: minutes, exercises: cardio, warmup: warmup(profile), cooldown: cooldown() },
      { name: "Fuerza B", focus: "Tirón y bisagra", intensity, durationMin: minutes, exercises: strengthB, warmup: warmup(profile), cooldown: cooldown() },
      { name: "Cardio 2", focus: "Volumen aeróbico", intensity: "low", durationMin: minutes, exercises: cardio, warmup: warmup(profile), cooldown: cooldown() },
      { name: "Movilidad", focus: "Recuperación activa", intensity: "low", durationMin: Math.min(40, minutes), exercises: mobility, warmup: warmup(profile), cooldown: cooldown() },
    ];
  }

  if (goal.type === "strength" && count >= 4) {
    return [
      { name: "Tren superior fuerza", focus: "Press y remo", intensity, durationMin: minutes, exercises: upper, warmup: warmup(profile), cooldown: cooldown() },
      { name: "Tren inferior fuerza", focus: "Sentadilla y bisagra", intensity, durationMin: minutes, exercises: lower, warmup: warmup(profile), cooldown: cooldown() },
      { name: "Tren superior volumen", focus: "Empuje y tirón extra", intensity: capIntensity(profile, "moderate"), durationMin: minutes, exercises: upper, warmup: warmup(profile), cooldown: cooldown() },
      { name: "Tren inferior volumen", focus: "Piernas y core", intensity: capIntensity(profile, "moderate"), durationMin: minutes, exercises: lower, warmup: warmup(profile), cooldown: cooldown() },
      { name: "Acondicionamiento", focus: "Salud cardíaca", intensity: "low", durationMin: minutes, exercises: cardio, warmup: warmup(profile), cooldown: cooldown() },
    ];
  }

  if (count <= 3) {
    return [
      { name: "Cuerpo completo A", focus: "Sentadilla, press y remo", intensity, durationMin: minutes, exercises: strengthA, warmup: warmup(profile), cooldown: cooldown() },
      { name: "Cuerpo completo B", focus: "Bisagra, dominantes de tirón", intensity, durationMin: minutes, exercises: strengthB, warmup: warmup(profile), cooldown: cooldown() },
      { name: "Cuerpo completo C", focus: "Unilateral, core y base", intensity: capIntensity(profile, "moderate"), durationMin: minutes, exercises: trimToMinutes([
        ex(profile, goal, intensity, "lunge"),
        ex(profile, goal, intensity, "press"),
        ex(profile, goal, intensity, "row"),
        ex(profile, goal, intensity, "glute"),
        ex(profile, goal, intensity, "core", undefined, false),
        condBlock(profile, condMin),
      ], minutes), warmup: warmup(profile), cooldown: cooldown() },
    ];
  }

  return [
    { name: "Tren superior A", focus: "Press y remo", intensity, durationMin: minutes, exercises: upper, warmup: warmup(profile), cooldown: cooldown() },
    { name: "Tren inferior A", focus: "Sentadilla y glúteo", intensity, durationMin: minutes, exercises: lower, warmup: warmup(profile), cooldown: cooldown() },
    { name: "Tren superior B", focus: "Empuje vertical y tirón", intensity, durationMin: minutes, exercises: upper, warmup: warmup(profile), cooldown: cooldown() },
    { name: "Tren inferior B", focus: "Bisagra y unilateral", intensity, durationMin: minutes, exercises: lower, warmup: warmup(profile), cooldown: cooldown() },
    { name: "Acondicionamiento + core", focus: "Condición y movilidad", intensity: "moderate", durationMin: minutes, exercises: cardio, warmup: warmup(profile), cooldown: cooldown() },
    { name: "Cuerpo completo ligero", focus: "Técnica y calidad", intensity: "low", durationMin: minutes, exercises: strengthA, warmup: warmup(profile), cooldown: cooldown() },
  ];
}

function warningsFor(profile: Profile, goal: Goal): string[] {
  const w: string[] = [
    "Esto es un plan de entrenamiento orientativo, no un diagnóstico ni una prescripción médica.",
  ];
  if (hasFlag(profile.medicalFlags, "cardiac")) {
    w.push("Con antecedente cardíaco, pide autorización médica antes de entrenar. Nada de esfuerzos máximos ni aguantar la respiración.");
  }
  if (hasFlag(profile.medicalFlags, "hypertension")) {
    w.push("Hipertensión: evita la maniobra de Valsalva, trabaja a un esfuerzo 6–7/10 y prioriza descansos completos.");
  }
  if (hasFlag(profile.medicalFlags, "diabetes")) {
    w.push("Si tienes diabetes, lleva algo de hidratos rápidos y controla glucosa según te haya indicado tu equipo médico.");
  }
  if (hasFlag(profile.medicalFlags, "back_pain")) {
    w.push("Espalda: prioriza cadera y core estable. Si aparece dolor que baja por la pierna o se irradia, para.");
  }
  if (hasFlag(profile.medicalFlags, "knee_hip")) {
    w.push("Rodilla/cadera: usa el rango cómodo. El dolor agudo no es “parte del proceso”.");
  }
  if (hasFlag(profile.medicalFlags, "asthma")) {
    w.push("Asma: calienta más, evita picos y ten a mano tu medicación habitual.");
  }
  if (hasFlag(profile.medicalFlags, "pregnancy")) {
    w.push("Embarazo/postparto: este plan es conservador a propósito. Un suelo pélvico o matrona debe validarlo.");
  }
  if (hasFlag(profile.medicalFlags, "recent_injury")) {
    w.push("Lesión reciente: bajamos volumen. Si un gesto reproduce el dolor de la lesión, sustitúyelo.");
  }
  if (profile.age >= 60) {
    w.push("A partir de los 60 el plan prioriza equilibrio, máquinas o variantes estables y recuperación.");
  }
  if (goal.type === "fat_loss") {
    w.push("Bajar más de ~0,5–1% del peso a la semana suele ser demasiado rápido y cuesta recuperarlo.");
  }
  if (profile.medicalNotes.trim()) {
    w.push(`Anotaste: “${profile.medicalNotes.trim()}”. El plan no puede interpretarlo clínicamente; úsalo como recordatorio para ti y tu profesional.`);
  }
  return w;
}

function nutrition(profile: Profile, goal: Goal): string[] {
  const hints: string[] = [];
  const bmi = calcBmi(profile.weightKg, goal.targetWeightKg ?? profile.weightKg);
  if (goal.type === "fat_loss") {
    hints.push("Come suficiente proteína (orientación: 1,6–2,2 g/kg de peso objetivo) y un déficit pequeño, no un recorte agresivo.");
    hints.push("Prioriza verdura, fruta, legumbres y agua. El entrenamiento no compensa un déficit caótico.");
  } else if (goal.type === "muscle_gain") {
    hints.push("Un superávit ligero (200–300 kcal) y proteína alta funcionan mejor que “comer de todo”.");
    hints.push("Duerme 7–9 h. Sin sueño el músculo no se construye aunque entrenes bien.");
  } else if (goal.type === "strength") {
    hints.push("No hace falta comer como un powerlifter. Mantén proteína alta y carbohidratos alrededor de las sesiones.");
  } else if (goal.type === "endurance") {
    hints.push("No entrenes cardio largo en ayunas si te marea. Un pequeño snack previo suele ayudar.");
  } else {
    hints.push("Patrón simple: proteína en cada comida, verdura, y consistencia antes que dietas con nombre.");
  }
  if (hasFlag(profile.medicalFlags, "diabetes") || hasFlag(profile.medicalFlags, "hypertension")) {
    hints.push("Cualquier cambio de dieta con hipertensión o diabetes debe alinearse con tu tratamiento médico.");
  }
  if (goal.targetWeightKg) {
    const delta = goal.targetWeightKg - profile.weightKg;
    hints.push(
      delta < 0
        ? `Objetivo de peso: ${goal.targetWeightKg} kg (${Math.abs(delta).toFixed(1)} kg menos). Ritmo realista, no carrera.`
        : `Objetivo de peso: ${goal.targetWeightKg} kg (${delta.toFixed(1)} kg más). Sube despacio para no acumular solo grasa.`
    );
  }
  void bmi;
  return hints;
}

function rationale(profile: Profile, goal: Goal, intensity: Intensity): string[] {
  const band = ageBand(profile.age);
  const days = profile.weekdays.length;
  const items = [
    `${profile.age} años, ${profile.weightKg} kg y ${profile.heightCm} cm. IMC ≈ ${calcBmi(profile.weightKg, profile.heightCm).toFixed(1)}. El volumen se ajusta a eso, no a un plan genérico.`,
    `Objetivo ${GOAL_LABEL[goal.type].toLowerCase()} a ${HORIZON_LABEL[goal.horizon].toLowerCase()} (${horizonWeeks(goal.horizon)} semanas) con ${days} días y sesiones de ${profile.sessionMinutes} min.`,
    profile.experience === "beginner"
      ? "Como empiezas, priorizamos técnica, cuerpo completo y una intensidad que puedas repetir."
      : "Ya tienes base: hay más especificidad (superior/inferior o fuerza + cardio) y progresión semanal.",
  ];
  if (band === "senior" || band === "mature") {
    items.push("Más edad = más recuperación. Por eso hay más descanso entre series y menos picos de intensidad.");
  }
  if (profile.medicalFlags.some((f) => f !== "none")) {
    items.push("Tus antecedentes cambian ejercicios (variantes más estables) y bajan el techo de esfuerzo.");
  }
  items.push(
    intensity === "low"
      ? "La intensidad sale conservadora a propósito: primero adherencia y seguridad."
      : "La intensidad permite progresar si duermes y llegas a las sesiones."
  );
  return items;
}

function weeklyFocus(profile: Profile, goal: Goal) {
  if (goal.horizon === "short") {
    return goal.type === "fat_loss"
      ? "Estas 6 semanas: no fallar días. El déficit es pequeño y el plan es repetible."
      : "Estas 6 semanas: calidad de cada serie y constancia. No busques milagros, busca ritmo.";
  }
  if (goal.horizon === "medium") {
    return "Bloque de 16 semanas: las primeras 2 son de toma de contacto; luego sube carga o repeticiones cuando las 2 últimas series se sientan claras.";
  }
  return "Largo plazo: las primeras 8 semanas son base. Si un día sales fatal, haces la sesión suave y no la cancelas.";
}

export function generatePlan(profile: Profile, goal: Goal): Plan {
  const preferred: Intensity =
    goal.type === "strength" && profile.experience !== "beginner"
      ? "high"
      : goal.type === "health"
        ? "moderate"
        : profile.experience === "advanced"
          ? "high"
          : "moderate";
  const intensity = capIntensity(profile, preferred);
  const catalog = templates(profile, goal, intensity);
  const split = profile.weekdays.map((weekday, index) => {
    const template = catalog[index % catalog.length];
    return day(
      weekday,
      template.name,
      template.focus,
      capIntensity(profile, template.intensity),
      template.durationMin,
      template.exercises,
      profile
    );
  });

  return {
    id: uid(),
    createdAt: new Date().toISOString(),
    startWeightKg: profile.weightKg,
    version: 1,
    durationWeeks: horizonWeeks(goal.horizon),
    weeklySplit: split,
    rationale: rationale(profile, goal, intensity),
    warnings: warningsFor(profile, goal),
    nutritionHints: nutrition(profile, goal),
    weeklyFocus: weeklyFocus(profile, goal),
    adjustments: [],
  };
}
