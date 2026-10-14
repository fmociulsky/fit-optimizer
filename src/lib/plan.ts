import type {
  Equipment,
  Exercise,
  FocusArea,
  Goal,
  Intensity,
  MedicalFlag,
  Plan,
  Profile,
  WorkoutDay,
} from "./types";
import { gymMachineNames, listGymStations, pickGymExercise, TYPICAL_GYM_MACHINE_IDS, type PlanMove, type StationWork } from "./gym-machines";
import { homeItemNames, pickHomeExercise, seedHomeItems } from "./home-items";
import {
  listPilatesWork,
  pilatesItemNames,
  pickPilatesMove,
  seedPilatesItems,
  toPilatesExercise,
  TYPICAL_PILATES_IDS,
} from "./pilates";
import { ageBand, calcBmi, horizonWeeks, profileAge } from "./metrics";
import { nutritionHints } from "./nutrition";
import { GOAL_LABEL, HORIZON_LABEL, FOCUS_AREA_LABEL } from "./labels";

function uid() {
  return crypto.randomUUID();
}

function fullBodyFocus(areas?: FocusArea[] | null) {
  return !areas?.length || areas.includes("full_body");
}

function zonesText(areas?: FocusArea[] | null) {
  if (fullBodyFocus(areas)) return FOCUS_AREA_LABEL.full_body;
  return areas!
    .filter((area) => area !== "full_body")
    .map((area) => FOCUS_AREA_LABEL[area])
    .join(", ");
}

function hasFlag(flags: MedicalFlag[], flag: MedicalFlag) {
  return flags.includes(flag) && !flags.includes("none");
}

function capIntensity(profile: Profile, preferred: Intensity): Intensity {
  const band = ageBand(profileAge(profile));
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

type MoveKey = PlanMove;

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
  const picked =
    profile.equipment === "full_gym"
      ? pickGymExercise(profile.gymMachines, key)
      : profile.equipment === "pilates"
        ? pickPilatesMove(profile.pilatesItems, key)
        : pickHomeExercise(profile.homeItems, key, profile.equipment);
  const swapped = swapForFlags(profile, key, picked.name);
  const extraRest =
    hasFlag(profile.medicalFlags, "hypertension") ||
    hasFlag(profile.medicalFlags, "cardiac")
      ? 20
      : 0;
  const notes = [picked.notes, swapped.notes, extraNotes]
    .filter(Boolean)
    .join(" ");
  return {
    name: swapped.name,
    sets: setsFor(profile, compound),
    reps: key === "core" ? "20–40 s" : key === "carry" ? "30–40 m" : repsFor(goal, intensity),
    restSec: restFor(intensity, extraRest),
    notes: notes || undefined,
  };
}

function condBlock(profile: Profile, minutes: number, machineName?: string): Exercise {
  const cardiac = hasFlag(profile.medicalFlags, "cardiac");
  const asthma = hasFlag(profile.medicalFlags, "asthma");
  const name = cardiac
    ? "Caminata cómoda"
    : asthma
      ? "Ciclismo o caminata continua"
      : machineName
        ? machineName
        : profile.equipment === "full_gym"
          ? pickGymExercise(profile.gymMachines, "walk").name
          : profile.equipment === "pilates"
            ? pickPilatesMove(profile.pilatesItems, "walk").name
            : pickHomeExercise(profile.homeItems, "walk", profile.equipment).name;
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
  if (profile.equipment === "pilates") {
    const parts = [
      "1 minuto de respiración costal",
      "reloj pélvico",
      "gato-camello",
      "círculos de hombros",
    ];
    if (hasFlag(profile.medicalFlags, "asthma") || hasFlag(profile.medicalFlags, "cardiac")) {
      parts[0] = "2 minutos de respiración muy gradual, sentada o de pie";
    }
    if (hasFlag(profile.medicalFlags, "knee_hip")) {
      parts.push("círculos de tobillo y puentes suaves");
    }
    if (hasFlag(profile.medicalFlags, "back_pain")) {
      parts.push("gato-camello extra corto, sin forzar la extensión");
    }
    return parts.join(", ") + ".";
  }
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

function cooldown(profile?: Profile) {
  if (profile?.equipment === "pilates") {
    return "Sirena o child pose, estiramiento de flexores de cadera y 1 minuto de respiración lenta. Sin rebotes.";
  }
  return "3–5 minutos de caminata y estiramientos suaves de cadera, pecho y dorsal. Sin rebotes.";
}

function day(
  weekday: number,
  name: string,
  focus: string,
  intensity: Intensity,
  durationMin: number,
  exercises: Exercise[],
  profile: Profile,
  previous?: Plan | null
): WorkoutDay {
  return {
    id:
      previous?.weeklySplit.find((item) => item.weekday === weekday)?.id ?? uid(),
    weekday,
    name,
    focus,
    durationMin,
    intensity,
    exercises,
    warmup: warmup(profile),
    cooldown: cooldown(profile),
  };
}

function trimToMinutes(exercises: Exercise[], minutes: number) {
  const budget = minutes <= 30 ? 4 : minutes <= 45 ? 6 : minutes <= 60 ? 7 : 8;
  return exercises.slice(0, budget);
}

const AREA_MOVES: Record<Exclude<FocusArea, "full_body">, PlanMove[]> = {
  legs: ["squat", "lunge", "hinge"],
  glutes: ["glute", "hinge", "lunge"],
  chest: ["press", "push_iso"],
  back: ["row", "pull"],
  shoulders: ["ohp", "pull_iso"],
  arms: ["push_iso", "pull_iso"],
  core: ["core", "carry"],
  cardio: ["walk", "cond"],
};

const LOWER_AREAS: Exclude<FocusArea, "full_body">[] = ["legs", "glutes"];
const UPPER_AREAS: Exclude<FocusArea, "full_body">[] = [
  "chest",
  "back",
  "shoulders",
  "arms",
];
const MOVE_RANK: PlanMove[] = [
  "squat",
  "hinge",
  "lunge",
  "press",
  "row",
  "pull",
  "ohp",
  "glute",
  "push_iso",
  "pull_iso",
  "core",
  "carry",
  "balance",
  "cond",
  "walk",
  "bike",
  "mobility",
];

function selectedZones(goal: Goal): Exclude<FocusArea, "full_body">[] {
  return (goal.focusAreas ?? []).filter(
    (area): area is Exclude<FocusArea, "full_body"> => area !== "full_body"
  );
}

function uniqueMoves(areas: Exclude<FocusArea, "full_body">[]): PlanMove[] {
  const seen = new Set<PlanMove>();
  const moves: PlanMove[] = [];
  for (const area of areas) {
    for (const move of AREA_MOVES[area]) {
      if (!seen.has(move)) {
        seen.add(move);
        moves.push(move);
      }
    }
  }
  return moves;
}

function rankMoves(moves: PlanMove[]): PlanMove[] {
  return [...moves].sort(
    (a, b) =>
      (MOVE_RANK.indexOf(a) === -1 ? 99 : MOVE_RANK.indexOf(a)) -
      (MOVE_RANK.indexOf(b) === -1 ? 99 : MOVE_RANK.indexOf(b))
  );
}

function rotateMoves(moves: PlanMove[], offset: number): PlanMove[] {
  if (moves.length <= 1) return moves;
  const n = offset % moves.length;
  return [...moves.slice(n), ...moves.slice(0, n)];
}

function areaLabel(areas: Exclude<FocusArea, "full_body">[]) {
  return areas.map((area) => FOCUS_AREA_LABEL[area]).join(" y ");
}

function isIsolation(key: PlanMove) {
  return ["push_iso", "pull_iso", "core", "carry", "balance", "mobility"].includes(
    key
  );
}

function exercisesFromMoves(
  profile: Profile,
  goal: Goal,
  intensity: Intensity,
  moves: PlanMove[],
  condMin: number,
  minutes: number
): Exercise[] {
  const list: Exercise[] = [];
  for (const key of moves) {
    if (key === "walk" || key === "cond" || key === "bike") {
      list.push(condBlock(profile, condMin));
      continue;
    }
    list.push(ex(profile, goal, intensity, key, undefined, !isIsolation(key)));
  }
  const onlyCardio = moves.every(
    (key) => key === "walk" || key === "cond" || key === "bike" || key === "mobility"
  );
  if (!onlyCardio && !moves.includes("core")) {
    list.push(ex(profile, goal, intensity, "core", undefined, false));
  }
  return trimToMinutes(list, minutes);
}

function focusedTemplates(
  profile: Profile,
  goal: Goal,
  intensity: Intensity,
  condMin: number
): Omit<WorkoutDay, "id" | "weekday">[] {
  const minutes = profile.sessionMinutes;
  const zones = selectedZones(goal);
  const lower = zones.filter((area) => LOWER_AREAS.includes(area));
  const upper = zones.filter((area) => UPPER_AREAS.includes(area));
  const hasCore = zones.includes("core");
  const hasCardio = zones.includes("cardio");

  const shell = (
    name: string,
    focus: string,
    sessionIntensity: Intensity,
    exercises: Exercise[],
    durationMin = minutes
  ): Omit<WorkoutDay, "id" | "weekday"> => ({
    name,
    focus,
    intensity: sessionIntensity,
    durationMin,
    exercises,
    warmup: warmup(profile),
    cooldown: cooldown(profile),
  });

  const strengthDay = (
    subset: Exclude<FocusArea, "full_body">[],
    name: string,
    offset: number,
    sessionIntensity: Intensity
  ) => {
    const source = subset.length
      ? subset
      : zones.filter((area) => area !== "cardio");
    let moves = rankMoves(uniqueMoves(source.length ? source : zones));
    if (hasCore && !moves.includes("core")) moves = [...moves, "core"];
    moves = rotateMoves(moves, offset);
    return shell(
      name,
      `Prioridad: ${areaLabel(source.length ? source : zones)}`,
      sessionIntensity,
      exercisesFromMoves(profile, goal, sessionIntensity, moves, condMin, minutes)
    );
  };

  const cardioDay = (name: string, sessionIntensity: Intensity) =>
    shell(
      name,
      "Capacidad aeróbica alineada con tu enfoque",
      sessionIntensity,
      trimToMinutes(
        [
          condBlock(profile, Math.max(18, minutes - 12)),
          ex(profile, goal, sessionIntensity, "core", undefined, false),
          ex(profile, goal, "low", "mobility", undefined, false),
        ],
        minutes
      )
    );

  if (zones.length === 1 && hasCardio) {
    return [
      cardioDay("Cardio A", capIntensity(profile, "moderate")),
      cardioDay("Cardio B", "low"),
      shell(
        "Cardio + core",
        "Aerobico suave y estabilidad",
        "low",
        trimToMinutes(
          [
            condBlock(profile, Math.max(14, minutes - 16)),
            ex(profile, goal, "low", "core", undefined, false),
            ex(profile, goal, "low", "walk"),
          ],
          minutes
        )
      ),
    ];
  }

  const days: Omit<WorkoutDay, "id" | "weekday">[] = [];

  if (upper.length && lower.length) {
    days.push(strengthDay(lower, `Enfoque ${areaLabel(lower)}`, 0, intensity));
    days.push(strengthDay(upper, `Enfoque ${areaLabel(upper)}`, 0, intensity));
    days.push(
      strengthDay(
        lower,
        `${areaLabel(lower)} · variante`,
        2,
        capIntensity(profile, "moderate")
      )
    );
    days.push(
      strengthDay(
        upper,
        `${areaLabel(upper)} · variante`,
        2,
        capIntensity(profile, "moderate")
      )
    );
  } else if (lower.length || upper.length) {
    const subset = lower.length ? lower : upper;
    const withCore = hasCore && !subset.includes("core") ? [...subset, "core" as const] : subset;
    days.push(strengthDay(subset, `Enfoque ${areaLabel(subset)} A`, 0, intensity));
    days.push(strengthDay(subset, `Enfoque ${areaLabel(subset)} B`, 2, intensity));
    days.push(
      strengthDay(
        withCore,
        `Enfoque ${areaLabel(subset)} C`,
        1,
        capIntensity(profile, "moderate")
      )
    );
  } else if (hasCore) {
    days.push(strengthDay(["core"], "Core y estabilidad A", 0, intensity));
    days.push(
      strengthDay(["core"], "Core y estabilidad B", 1, capIntensity(profile, "moderate"))
    );
  }

  if (hasCardio) {
    days.push(cardioDay("Cardio de zonas", capIntensity(profile, "moderate")));
  }

  if (!days.length) {
    days.push(strengthDay(zones, "Enfoque personalizado", 0, intensity));
  }

  return days;
}

function rotateList<T>(items: T[], offset: number): T[] {
  if (items.length <= 1) return items;
  const n = offset % items.length;
  return [...items.slice(n), ...items.slice(0, n)];
}

function fromStation(
  profile: Profile,
  goal: Goal,
  intensity: Intensity,
  work: StationWork,
  condMin: number
): Exercise {
  if (work.cardio) return condBlock(profile, condMin, work.name);
  const swapped = swapForFlags(profile, work.move, work.name);
  const extraRest =
    hasFlag(profile.medicalFlags, "hypertension") ||
    hasFlag(profile.medicalFlags, "cardiac")
      ? 20
      : 0;
  const notes = swapped.notes;
  return {
    name: swapped.name,
    sets: setsFor(profile, work.compound),
    reps:
      work.move === "core"
        ? "20–40 s"
        : work.move === "carry"
          ? "30–40 m"
          : repsFor(goal, intensity),
    restSec: restFor(intensity, extraRest),
    notes: notes || undefined,
  };
}

function gymTemplates(
  profile: Profile,
  goal: Goal,
  intensity: Intensity,
  condMin: number
): Omit<WorkoutDay, "id" | "weekday">[] | null {
  const minutes = profile.sessionMinutes;
  const zones = fullBodyFocus(goal.focusAreas) ? null : selectedZones(goal);
  const stations = listGymStations(profile.gymMachines, zones);
  if (!stations.length) return null;

  const strength = stations.filter((item) => !item.cardio);
  const cardio = stations.filter((item) => item.cardio);
  const lower = strength.filter((item) =>
    item.areas.some((area) => area === "legs" || area === "glutes")
  );
  const upper = strength.filter((item) =>
    item.areas.some((area) =>
      area === "chest" || area === "back" || area === "shoulders" || area === "arms"
    )
  );
  const core = strength.filter((item) => item.move === "core");

  const shell = (
    name: string,
    focus: string,
    sessionIntensity: Intensity,
    exercises: Exercise[]
  ): Omit<WorkoutDay, "id" | "weekday"> => ({
    name,
    focus,
    intensity: sessionIntensity,
    durationMin: minutes,
    exercises,
    warmup: warmup(profile),
    cooldown: cooldown(profile),
  });

  const dayFrom = (
    pool: StationWork[],
    name: string,
    offset: number,
    sessionIntensity: Intensity
  ) => {
    const ranked = [
      ...rotateList(pool.filter((item) => item.compound), offset),
      ...rotateList(pool.filter((item) => !item.compound), offset),
    ];
    const budget = minutes <= 30 ? 4 : minutes <= 45 ? 6 : minutes <= 60 ? 7 : 8;
    const strengthSlots = Math.max(3, budget - (cardio.length ? 1 : 0));
    const chosen: StationWork[] = [];
    for (const item of ranked) {
      if (chosen.length >= strengthSlots) break;
      if (!chosen.some((entry) => entry.machineId === item.machineId)) {
        chosen.push(item);
      }
    }
    if (!chosen.some((item) => item.move === "core") && core.length) {
      const extra = core.find(
        (item) => !chosen.some((entry) => entry.machineId === item.machineId)
      );
      if (extra) {
        if (chosen.length >= strengthSlots) chosen.pop();
        chosen.push(extra);
      }
    }
    const exercises = chosen.map((item) =>
      fromStation(profile, goal, sessionIntensity, item, condMin)
    );
    if (cardio.length && exercises.length < budget) {
      const card = cardio[offset % cardio.length];
      exercises.push(condBlock(profile, condMin, card.name));
    }
    const used = chosen.map((item) => item.name).slice(0, 4).join(", ");
    return shell(
      name,
      used ? `Con: ${used}` : "Sesión con las máquinas que marcaste",
      sessionIntensity,
      trimToMinutes(exercises, minutes)
    );
  };

  const days: Omit<WorkoutDay, "id" | "weekday">[] = [];
  const moderate = capIntensity(profile, "moderate");

  if (lower.length && upper.length) {
    days.push(dayFrom(lower, "Máquinas · tren inferior", 0, intensity));
    days.push(dayFrom(upper, "Máquinas · tren superior", 0, intensity));
    if (lower.length > 3) {
      days.push(dayFrom(lower, "Máquinas · inferior variante", 2, moderate));
    }
    if (upper.length > 3) {
      days.push(dayFrom(upper, "Máquinas · superior variante", 2, moderate));
    }
  } else if (lower.length || upper.length) {
    const pool = lower.length ? lower : upper;
    const tag = lower.length ? "inferior" : "superior";
    days.push(dayFrom(pool, `Máquinas · ${tag} A`, 0, intensity));
    days.push(dayFrom(pool, `Máquinas · ${tag} B`, Math.ceil(pool.length / 2), intensity));
    days.push(dayFrom(pool, `Máquinas · ${tag} C`, 1, moderate));
  } else if (strength.length) {
    days.push(dayFrom(strength, "Máquinas A", 0, intensity));
    days.push(dayFrom(strength, "Máquinas B", 2, intensity));
  }

  if (cardio.length && (!days.length || zones?.includes("cardio"))) {
    days.push(
      shell(
        "Cardio en máquinas",
        `Con: ${cardio.map((item) => item.name).slice(0, 4).join(", ")}`,
        moderate,
        trimToMinutes(
          [
            ...cardio.map((item) => condBlock(profile, Math.max(12, condMin + 4), item.name)),
            ...core
              .slice(0, 1)
              .map((item) => fromStation(profile, goal, "low", item, condMin)),
          ],
          minutes
        )
      )
    );
  } else if (cardio.length && days.length >= 1 && profile.weekdays.length >= 4) {
    days.push(
      shell(
        "Cardio en máquinas",
        `Con: ${cardio.map((item) => item.name).slice(0, 4).join(", ")}`,
        "low",
        trimToMinutes(
          cardio.map((item) =>
            condBlock(profile, Math.max(14, minutes - 16), item.name)
          ),
          minutes
        )
      )
    );
  }

  return days.length ? days : null;
}

function swapPilatesWork(
  profile: Profile,
  work: ReturnType<typeof listPilatesWork>[number]
) {
  if (
    hasFlag(profile.medicalFlags, "pregnancy") &&
    (/cien|tijeras|long stretch|single leg stretch/i.test(work.name) ||
      work.role === "core")
  ) {
    return {
      ...work,
      name: "Bird-dog + respiración diafragmática",
      reps: "8–10 por lado",
      notes: "Evita el cien clásico y el decúbito supino prolongado.",
    };
  }
  if (
    hasFlag(profile.medicalFlags, "back_pain") &&
    /roll up|cien|round back|long stretch|tijeras/i.test(work.name)
  ) {
    return {
      ...work,
      name: "Puente de hombros corto + bird-dog",
      reps: "8–10",
      notes: "Sin flexión lumbar cargada. Para si hay pinchazo.",
    };
  }
  if (hasFlag(profile.medicalFlags, "hypertension") && /cien/i.test(work.name)) {
    return {
      ...work,
      name: "Plancha pilates con respiración continua",
      reps: "20–30 s",
      notes: "Sin aguantar el aire ni bombear la cabeza.",
    };
  }
  if (
    hasFlag(profile.medicalFlags, "knee_hip") &&
    /footwork|scooter|step-up|standing pump/i.test(work.name)
  ) {
    return {
      ...work,
      name: "Puente de hombros en rango cómodo",
      reps: "8–10",
      notes: "Rango que no moleste rodilla o cadera. Sin rebotes.",
    };
  }
  return work;
}

function pilatesTemplates(
  profile: Profile,
  goal: Goal,
  intensity: Intensity
): Omit<WorkoutDay, "id" | "weekday">[] | null {
  const minutes = profile.sessionMinutes;
  const sessionIntensity: Intensity = intensity === "high" ? "moderate" : intensity;
  const zones = fullBodyFocus(goal.focusAreas) ? null : selectedZones(goal);
  const pool = listPilatesWork(profile.pilatesItems, zones);
  if (!pool.length) return null;

  const shell = (
    name: string,
    focus: string,
    sessionIntensity: Intensity,
    exercises: Exercise[]
  ): Omit<WorkoutDay, "id" | "weekday"> => ({
    name,
    focus,
    intensity: sessionIntensity,
    durationMin: minutes,
    exercises,
    warmup: warmup(profile),
    cooldown: cooldown(profile),
  });

  const fromRoles = (
    roles: Array<ReturnType<typeof listPilatesWork>[number]["role"]>,
    name: string,
    focus: string,
    offset: number
  ) => {
    const ranked = [
      ...rotateList(
        pool.filter((item) => roles.includes(item.role)),
        offset
      ),
      ...rotateList(
        pool.filter((item) => item.role === "core" && !roles.includes("core")),
        offset
      ),
      ...rotateList(pool, offset + 1),
    ];
    const budget = minutes <= 30 ? 4 : minutes <= 45 ? 6 : minutes <= 60 ? 7 : 8;
    const chosen: typeof pool = [];
    for (const item of ranked) {
      if (chosen.length >= budget) break;
      if (!chosen.some((entry) => entry.name === item.name)) {
        chosen.push(item);
      }
    }
    const used = chosen.slice(0, 3).map((item) => item.name).join(", ");
    return shell(
      name,
      used ? `Con: ${used}` : focus,
      sessionIntensity,
      trimToMinutes(
        chosen.map((item) =>
          toPilatesExercise(profile, sessionIntensity, swapPilatesWork(profile, item))
        ),
        minutes
      )
    );
  };

  const days: Omit<WorkoutDay, "id" | "weekday">[] = [
    fromRoles(["core", "spine"], "Pilates · powerhouse", "Centro y respiración", 0),
  ];
  if (pool.some((item) => item.role === "lower")) {
    days.push(
      fromRoles(
        ["lower"],
        "Pilates · cadera y glúteo",
        "Pelvis, glúteo y control de pierna",
        0
      )
    );
  }
  if (pool.some((item) => item.role === "spine")) {
    days.push(
      fromRoles(["spine", "core"], "Pilates · columna", "Articulación y movilidad", 1)
    );
  }
  if (pool.some((item) => item.role === "upper")) {
    days.push(
      fromRoles(
        ["upper"],
        "Pilates · tren superior",
        "Espalda, hombros y brazos",
        0
      )
    );
  }
  days.push(
    fromRoles(
      ["core", "lower", "upper", "spine", "balance"],
      "Pilates · cuerpo completo",
      "Flujo de todo el centro",
      2
    )
  );
  if (pool.some((item) => item.role === "balance") && profile.weekdays.length >= 5) {
    days.push(
      fromRoles(["balance", "spine"], "Pilates · equilibrio", "Estabilidad y control", 0)
    );
  }
  return days;
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

  if (profile.equipment === "pilates") {
    const pilatesDays = pilatesTemplates(profile, goal, intensity);
    if (pilatesDays?.length) return pilatesDays;
  }

  if (profile.equipment === "full_gym") {
    const gymDays = gymTemplates(profile, goal, intensity, condMin);
    if (gymDays?.length) return gymDays;
  }

  if (!fullBodyFocus(goal.focusAreas)) {
    return focusedTemplates(profile, goal, intensity, condMin);
  }

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
        { name: "Fuerza + base", focus: "Cuerpo completo y caminata", intensity, durationMin: minutes, exercises: strengthA, warmup: warmup(profile), cooldown: cooldown(profile) },
        { name: "Cardio controlado", focus: "Capacidad aeróbica", intensity: capIntensity(profile, "moderate"), durationMin: minutes, exercises: cardio, warmup: warmup(profile), cooldown: cooldown(profile) },
        { name: "Fuerza B + base", focus: "Tirón, empujón y cadera", intensity, durationMin: minutes, exercises: strengthB, warmup: warmup(profile), cooldown: cooldown(profile) },
      ];
    }
    return [
      { name: "Fuerza A", focus: "Empuje y sentadilla", intensity, durationMin: minutes, exercises: strengthA, warmup: warmup(profile), cooldown: cooldown(profile) },
      { name: "Cardio 1", focus: "Zona cómoda", intensity: "moderate", durationMin: minutes, exercises: cardio, warmup: warmup(profile), cooldown: cooldown(profile) },
      { name: "Fuerza B", focus: "Tirón y bisagra", intensity, durationMin: minutes, exercises: strengthB, warmup: warmup(profile), cooldown: cooldown(profile) },
      { name: "Cardio 2", focus: "Volumen aeróbico", intensity: "low", durationMin: minutes, exercises: cardio, warmup: warmup(profile), cooldown: cooldown(profile) },
      { name: "Movilidad", focus: "Recuperación activa", intensity: "low", durationMin: Math.min(40, minutes), exercises: mobility, warmup: warmup(profile), cooldown: cooldown(profile) },
    ];
  }

  if (goal.type === "strength" && count >= 4) {
    return [
      { name: "Tren superior fuerza", focus: "Press y remo", intensity, durationMin: minutes, exercises: upper, warmup: warmup(profile), cooldown: cooldown(profile) },
      { name: "Tren inferior fuerza", focus: "Sentadilla y bisagra", intensity, durationMin: minutes, exercises: lower, warmup: warmup(profile), cooldown: cooldown(profile) },
      { name: "Tren superior volumen", focus: "Empuje y tirón extra", intensity: capIntensity(profile, "moderate"), durationMin: minutes, exercises: upper, warmup: warmup(profile), cooldown: cooldown(profile) },
      { name: "Tren inferior volumen", focus: "Piernas y core", intensity: capIntensity(profile, "moderate"), durationMin: minutes, exercises: lower, warmup: warmup(profile), cooldown: cooldown(profile) },
      { name: "Acondicionamiento", focus: "Salud cardíaca", intensity: "low", durationMin: minutes, exercises: cardio, warmup: warmup(profile), cooldown: cooldown(profile) },
    ];
  }

  if (count <= 3) {
    return [
      { name: "Cuerpo completo A", focus: "Sentadilla, press y remo", intensity, durationMin: minutes, exercises: strengthA, warmup: warmup(profile), cooldown: cooldown(profile) },
      { name: "Cuerpo completo B", focus: "Bisagra, dominantes de tirón", intensity, durationMin: minutes, exercises: strengthB, warmup: warmup(profile), cooldown: cooldown(profile) },
      { name: "Cuerpo completo C", focus: "Unilateral, core y base", intensity: capIntensity(profile, "moderate"), durationMin: minutes, exercises: trimToMinutes([
        ex(profile, goal, intensity, "lunge"),
        ex(profile, goal, intensity, "press"),
        ex(profile, goal, intensity, "row"),
        ex(profile, goal, intensity, "glute"),
        ex(profile, goal, intensity, "core", undefined, false),
        condBlock(profile, condMin),
      ], minutes), warmup: warmup(profile), cooldown: cooldown(profile) },
    ];
  }

  return [
    { name: "Tren superior A", focus: "Press y remo", intensity, durationMin: minutes, exercises: upper, warmup: warmup(profile), cooldown: cooldown(profile) },
    { name: "Tren inferior A", focus: "Sentadilla y glúteo", intensity, durationMin: minutes, exercises: lower, warmup: warmup(profile), cooldown: cooldown(profile) },
    { name: "Tren superior B", focus: "Empuje vertical y tirón", intensity, durationMin: minutes, exercises: upper, warmup: warmup(profile), cooldown: cooldown(profile) },
    { name: "Tren inferior B", focus: "Bisagra y unilateral", intensity, durationMin: minutes, exercises: lower, warmup: warmup(profile), cooldown: cooldown(profile) },
    { name: "Acondicionamiento + core", focus: "Condición y movilidad", intensity: "moderate", durationMin: minutes, exercises: cardio, warmup: warmup(profile), cooldown: cooldown(profile) },
    { name: "Cuerpo completo ligero", focus: "Técnica y calidad", intensity: "low", durationMin: minutes, exercises: strengthA, warmup: warmup(profile), cooldown: cooldown(profile) },
  ];
}

function warningsFor(profile: Profile, goal: Goal): string[] {
  const w: string[] = [
    "Esto es un plan de entrenamiento orientativo. Debe ir asistido por un profesional de la salud o del ejercicio: no es un diagnóstico ni una prescripción médica.",
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
  if (profile.equipment === "pilates") {
    w.push("En pilates manda la calidad del gesto. Si hay pinchazo en lumbar o cuello, para y acorta el rango. Reformer y cadillac conviene hacerlos con alguien que te haya enseñado el aparato.");
  }
  if (hasFlag(profile.medicalFlags, "recent_injury")) {
    w.push("Lesión reciente: bajamos volumen. Si un gesto reproduce el dolor de la lesión, sustitúyelo.");
  }
  if (profileAge(profile) >= 60) {
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

function rationale(profile: Profile, goal: Goal, intensity: Intensity): string[] {
  const age = profileAge(profile);
  const band = ageBand(age);
  const days = profile.weekdays.length;
  const items = [
    `${age} años, ${profile.weightKg} kg y ${profile.heightCm} cm. IMC ≈ ${calcBmi(profile.weightKg, profile.heightCm).toFixed(1)}. El volumen se ajusta a eso, no a un plan genérico.`,
    `Objetivo ${GOAL_LABEL[goal.type].toLowerCase()} a ${HORIZON_LABEL[goal.horizon].toLowerCase()} (${horizonWeeks(goal.horizon)} semanas) con ${days} días y sesiones de ${profile.sessionMinutes} min.`,
    fullBodyFocus(goal.focusAreas)
      ? profile.experience === "beginner"
        ? "Como empiezas, priorizamos técnica, cuerpo completo y una intensidad que puedas repetir."
        : "Ya tienes base: hay más especificidad (superior/inferior o fuerza + cardio) y progresión semanal."
      : `El volumen se concentra en ${zonesText(goal.focusAreas).toLowerCase()}. El resto entra como apoyo, no como protagonista.`,
  ];
  if (band === "senior" || band === "mature") {
    items.push("Más edad = más recuperación. Por eso hay más descanso entre series y menos picos de intensidad.");
  }
  if (profile.equipment === "full_gym") {
    const machines = gymMachineNames(profile.gymMachines);
    items.push(
      machines.length
        ? `El gimnasio se arma con lo que marcaste (${machines.slice(0, 8).join(", ")}${machines.length > 8 ? "…" : ""}). Si falta una máquina, hay variante.`
        : "Marcaste gimnasio pero ninguna máquina: usamos variantes de peso corporal hasta que reconfigures."
    );
  } else if (profile.equipment === "pilates") {
    const studio = pilatesItemNames(profile.pilatesItems);
    items.push(
      studio.length
        ? `El pilates se arma con lo que marcaste (${studio.join(", ")}). El centro (powerhouse) entra en cada sesión.`
        : "Marcaste pilates: el plan sale de colchoneta hasta que indiques reformer, aro u otro aparato."
    );
  } else {
    const itemsAtHome = homeItemNames(profile.homeItems);
    items.push(
      itemsAtHome.length
        ? `En casa se arma con lo que marcaste (${itemsAtHome.slice(0, 8).join(", ")}${itemsAtHome.length > 8 ? "…" : ""}). Si falta un patrón, hay variante.`
        : profile.equipment === "home_dumbbells"
          ? "Material de casa: mancuernas y poco más. Los empujes y tirones se adaptan a eso."
          : "Sin pesas: el plan usa peso corporal, cajón, bandas o lo que haya en casa."
    );
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
  if (profile.equipment === "pilates") {
    return fullBodyFocus(goal.focusAreas)
      ? "Pilates: el centro manda. Calidad del gesto y respiración, no carga máxima."
      : `Pilates con foco en ${zonesText(goal.focusAreas).toLowerCase()}. El centro sigue en cada ejercicio.`;
  }
  if (!fullBodyFocus(goal.focusAreas)) {
    return `Este bloque prioriza ${zonesText(goal.focusAreas).toLowerCase()}. Si un día no puedes esa zona, haces la sesión suave, no la saltas.`;
  }
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

export function generatePlan(
  profile: Profile,
  goal: Goal,
  previous?: Plan | null
): Plan {
  const preferred: Intensity =
    profile.equipment === "pilates"
      ? "moderate"
      : goal.type === "strength" && profile.experience !== "beginner"
      ? "high"
      : goal.type === "health"
        ? "moderate"
        : profile.experience === "advanced"
          ? "high"
          : "moderate";
  const intensity = capIntensity(profile, preferred);

  if (profile.equipment === "coach") {
    return {
      id: previous?.id ?? uid(),
      createdAt: previous?.createdAt ?? new Date().toISOString(),
      startWeightKg: previous?.startWeightKg ?? profile.weightKg,
      version: previous ? previous.version + 1 : 1,
      durationWeeks: horizonWeeks(goal.horizon),
      weeklySplit: [],
      rationale: [
        `Objetivo ${GOAL_LABEL[goal.type].toLowerCase()} a ${HORIZON_LABEL[goal.horizon].toLowerCase()} (${horizonWeeks(goal.horizon)} semanas). El entrenamiento lo arma tu profesor, no Enforma.`,
        `Marcaste ${profile.weekdays.length} días y sesiones de ${profile.sessionMinutes} min: eso es tu disponibilidad, para que quien te entrena sepa encajar el plan.`,
        fullBodyFocus(goal.focusAreas)
          ? "Las zonas y el objetivo quedan anotados para tu profesor."
          : `Pediste foco en ${zonesText(goal.focusAreas).toLowerCase()}. Tu profesor decide cómo cargarlo.`,
        "El plan físico aparece cuando tu profesor lo cargue.",
      ],
      warnings: warningsFor(profile, goal),
      nutritionHints: nutritionHints(profile, goal),
      weeklyFocus:
        "El entrenamiento lo carga tu profesor.",
      adjustments: previous?.adjustments ?? [],
    };
  }

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
      profile,
      previous
    );
  });

  return {
    id: previous?.id ?? uid(),
    createdAt: previous?.createdAt ?? new Date().toISOString(),
    startWeightKg: previous?.startWeightKg ?? profile.weightKg,
    version: previous ? previous.version + 1 : 1,
    durationWeeks: horizonWeeks(goal.horizon),
    weeklySplit: split,
    rationale: rationale(profile, goal, intensity),
    warnings: warningsFor(profile, goal),
    nutritionHints: nutritionHints(profile, goal),
    weeklyFocus: weeklyFocus(profile, goal),
    adjustments: previous?.adjustments ?? [],
  };
}

export type TrainingPlace = Exclude<Equipment, "coach">;

export function branchTrainingPlaces(branch: {
  gymMachines: string[];
  pilatesItems: string[];
}): TrainingPlace[] {
  const places: TrainingPlace[] = [];
  if (branch.gymMachines.length) places.push("full_gym");
  if (branch.pilatesItems.length) places.push("pilates");
  return places;
}

export function generateWeeklySplit(
  profile: Profile,
  goal: Goal,
  place: TrainingPlace,
  branchEquipment?: { gymMachines: string[]; pilatesItems: string[] }
): WorkoutDay[] {
  const locked = Boolean(branchEquipment);
  const gymMachines = locked
    ? branchEquipment!.gymMachines
    : profile.gymMachines?.length
      ? profile.gymMachines
      : [...TYPICAL_GYM_MACHINE_IDS];
  const pilatesItems = locked
    ? branchEquipment!.pilatesItems
    : profile.pilatesItems?.length
      ? profile.pilatesItems
      : [...TYPICAL_PILATES_IDS];
  const trainingProfile: Profile = {
    ...profile,
    equipment: place,
    gymMachines: place === "full_gym" ? gymMachines : profile.gymMachines,
    homeItems:
      place === "full_gym" || place === "pilates"
        ? []
        : seedHomeItems(place, profile.homeItems),
    pilatesItems: place === "pilates" ? pilatesItems : profile.pilatesItems,
  };
  return generatePlan(trainingProfile, goal).weeklySplit;
}
