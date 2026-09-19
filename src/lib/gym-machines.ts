import type { FocusArea } from "./types";

export type GymCategory =
  | "Libre"
  | "Piernas"
  | "Empuje"
  | "Tirón"
  | "Core"
  | "Cardio";

export type BodyZone = Exclude<FocusArea, "full_body">;

export type PlanMove =
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

export interface GymMachine {
  id: string;
  name: string;
  hint: string;
  category: GymCategory;
  photo: string;
  exercise: string;
  move: PlanMove;
  areas: BodyZone[];
  compound: boolean;
  role: "station" | "tool";
}

export interface StationWork {
  machineId: string;
  name: string;
  move: PlanMove;
  compound: boolean;
  cardio: boolean;
  areas: BodyZone[];
}

export const GYM_CATEGORIES: GymCategory[] = [
  "Libre",
  "Piernas",
  "Empuje",
  "Tirón",
  "Core",
  "Cardio",
];

export const GYM_MACHINES: GymMachine[] = [
  { id: "dumbbells", name: "Mancuernas", hint: "Parejas de varios pesos", category: "Libre", photo: "/machines/dumbbells.jpg", exercise: "Trabajo con mancuernas", move: "press", areas: ["chest", "shoulders", "arms"], compound: true, role: "tool" },
  { id: "barbell", name: "Barras y discos", hint: "Barra olímpica o estándar", category: "Libre", photo: "/machines/barbell.jpg", exercise: "Trabajo con barra", move: "squat", areas: ["legs", "back"], compound: true, role: "tool" },
  { id: "kettlebells", name: "Kettlebells", hint: "Pesas rusas", category: "Libre", photo: "/machines/kettlebells.jpg", exercise: "Peso muerto rumano con kettlebell", move: "hinge", areas: ["glutes", "legs"], compound: true, role: "tool" },
  { id: "bench", name: "Banco plano", hint: "Press y apoyo", category: "Libre", photo: "/machines/bench.jpg", exercise: "Press banca", move: "press", areas: ["chest"], compound: true, role: "tool" },
  { id: "adjustable_bench", name: "Banco regulable", hint: "Inclinado y declinado", category: "Libre", photo: "/machines/adjustable_bench.jpg", exercise: "Press inclinado", move: "press", areas: ["chest", "shoulders"], compound: true, role: "tool" },
  { id: "squat_rack", name: "Rack / jaula", hint: "Sentadilla y press", category: "Libre", photo: "/machines/squat_rack.jpg", exercise: "Sentadilla en rack", move: "squat", areas: ["legs", "glutes"], compound: true, role: "station" },
  { id: "box", name: "Cajón / step", hint: "Step-ups y sentadilla a cajón", category: "Libre", photo: "/machines/box.jpg", exercise: "Step-up en cajón", move: "lunge", areas: ["legs", "glutes"], compound: true, role: "station" },
  { id: "mats", name: "Colchonetas", hint: "Suelo, core y movilidad", category: "Libre", photo: "/machines/mats.jpg", exercise: "Plancha en colchoneta", move: "core", areas: ["core"], compound: false, role: "tool" },
  { id: "functional", name: "TRX / anillas / estación", hint: "Remo invertido y dominadas", category: "Libre", photo: "/machines/functional.jpg", exercise: "Remo invertido en TRX o anillas", move: "row", areas: ["back", "arms"], compound: true, role: "station" },
  { id: "farmers", name: "Asas de granjero", hint: "Paseos cargados", category: "Libre", photo: "/machines/farmers.jpg", exercise: "Paseo del granjero", move: "carry", areas: ["core", "shoulders"], compound: true, role: "station" },

  { id: "smith", name: "Máquina Smith", hint: "Barra guiada", category: "Piernas", photo: "/machines/smith.jpg", exercise: "Sentadilla en Smith", move: "squat", areas: ["legs", "glutes"], compound: true, role: "station" },
  { id: "leg_press", name: "Prensa de piernas", hint: "Empuje de tren inferior", category: "Piernas", photo: "/machines/leg_press.jpg", exercise: "Prensa de piernas", move: "squat", areas: ["legs", "glutes"], compound: true, role: "station" },
  { id: "hack_squat", name: "Hack squat", hint: "Sentadilla guiada", category: "Piernas", photo: "/machines/hack_squat.jpg", exercise: "Hack squat", move: "squat", areas: ["legs"], compound: true, role: "station" },
  { id: "leg_extension", name: "Extensión de cuádriceps", hint: "Aislamiento de rodilla", category: "Piernas", photo: "/machines/leg_extension.jpg", exercise: "Extensión de cuádriceps", move: "squat", areas: ["legs"], compound: false, role: "station" },
  { id: "leg_curl", name: "Curl femoral", hint: "Isquios en máquina", category: "Piernas", photo: "/machines/leg_curl.jpg", exercise: "Curl femoral en máquina", move: "hinge", areas: ["legs", "glutes"], compound: false, role: "station" },
  { id: "hip_abductor", name: "Abductores", hint: "Glúteo medio", category: "Piernas", photo: "/machines/hip_abductor.jpg", exercise: "Abductores en máquina", move: "glute", areas: ["glutes"], compound: false, role: "station" },
  { id: "hip_adductor", name: "Aductores", hint: "Cara interna del muslo", category: "Piernas", photo: "/machines/hip_adductor.jpg", exercise: "Aductores en máquina", move: "glute", areas: ["legs"], compound: false, role: "station" },
  { id: "calf_raise", name: "Gemelos en máquina", hint: "Elevación de talones", category: "Piernas", photo: "/machines/calf_raise.jpg", exercise: "Gemelos en máquina", move: "squat", areas: ["legs"], compound: false, role: "station" },
  { id: "hip_thrust", name: "Banco de hip thrust", hint: "Glúteo con barra", category: "Piernas", photo: "/machines/hip_thrust.jpg", exercise: "Hip thrust en banco", move: "glute", areas: ["glutes"], compound: true, role: "station" },

  { id: "chest_press", name: "Press de pecho en máquina", hint: "Empuje sentado", category: "Empuje", photo: "/machines/chest_press.jpg", exercise: "Press de pecho en máquina", move: "press", areas: ["chest"], compound: true, role: "station" },
  { id: "pec_deck", name: "Peck deck / mariposa", hint: "Aperturas de pecho", category: "Empuje", photo: "/machines/pec_deck.jpg", exercise: "Aperturas en peck deck", move: "press", areas: ["chest"], compound: false, role: "station" },
  { id: "cable_crossover", name: "Cruces en polea", hint: "Poleas altas de pecho", category: "Empuje", photo: "/machines/cable_crossover.jpg", exercise: "Cruces en polea", move: "press", areas: ["chest"], compound: false, role: "station" },
  { id: "shoulder_press", name: "Press de hombro en máquina", hint: "Empuje vertical guiado", category: "Empuje", photo: "/machines/shoulder_press.jpg", exercise: "Press de hombro en máquina", move: "ohp", areas: ["shoulders"], compound: true, role: "station" },
  { id: "triceps_pushdown", name: "Polea de tríceps", hint: "Extensiones y fondos", category: "Empuje", photo: "/machines/triceps_pushdown.jpg", exercise: "Extensión de tríceps en polea", move: "push_iso", areas: ["arms"], compound: false, role: "station" },
  { id: "assisted_dip", name: "Fondos asistidos", hint: "Máquina de dips", category: "Empuje", photo: "/machines/assisted_dip.jpg", exercise: "Fondos asistidos", move: "push_iso", areas: ["chest", "arms"], compound: true, role: "station" },

  { id: "lat_pulldown", name: "Jalón al pecho", hint: "Dorsal en polea", category: "Tirón", photo: "/machines/lat_pulldown.jpg", exercise: "Jalón al pecho", move: "pull", areas: ["back"], compound: true, role: "station" },
  { id: "seated_row", name: "Remo sentado", hint: "Polea baja o palanca", category: "Tirón", photo: "/machines/seated_row.jpg", exercise: "Remo sentado", move: "row", areas: ["back"], compound: true, role: "station" },
  { id: "pullup_bar", name: "Barra de dominadas", hint: "Con o sin asistencia", category: "Tirón", photo: "/machines/pullup_bar.jpg", exercise: "Dominada asistida o negativa", move: "pull", areas: ["back", "arms"], compound: true, role: "station" },
  { id: "cable_tower", name: "Torre de poleas", hint: "Face pull y jalones", category: "Tirón", photo: "/machines/cable_tower.jpg", exercise: "Face pull en torre de poleas", move: "pull_iso", areas: ["back", "shoulders"], compound: false, role: "station" },
  { id: "preacher", name: "Banco Scott", hint: "Curl de bíceps apoyado", category: "Tirón", photo: "/machines/preacher.jpg", exercise: "Curl en banco Scott", move: "pull_iso", areas: ["arms"], compound: false, role: "station" },

  { id: "hyperextension", name: "Banco romano", hint: "Extensión de lumbar", category: "Core", photo: "/machines/hyperextension.jpg", exercise: "Extensión de lumbar en banco romano", move: "hinge", areas: ["back", "core", "glutes"], compound: true, role: "station" },
  { id: "ab_crunch", name: "Crunch en máquina", hint: "Abdominal guiado", category: "Core", photo: "/machines/ab_crunch.jpg", exercise: "Crunch en máquina", move: "core", areas: ["core"], compound: false, role: "station" },

  { id: "treadmill", name: "Cinta de correr", hint: "Caminata o inclinada", category: "Cardio", photo: "/machines/treadmill.jpg", exercise: "Caminata inclinada en cinta", move: "walk", areas: ["cardio", "legs"], compound: false, role: "station" },
  { id: "bike", name: "Bici estática", hint: "Pedaleo continuo", category: "Cardio", photo: "/machines/bike.jpg", exercise: "Bicicleta estática", move: "bike", areas: ["cardio", "legs"], compound: false, role: "station" },
  { id: "elliptical", name: "Elíptica", hint: "Bajo impacto", category: "Cardio", photo: "/machines/elliptical.jpg", exercise: "Elíptica a ritmo hablando", move: "cond", areas: ["cardio"], compound: false, role: "station" },
  { id: "rower", name: "Remoergómetro", hint: "Cardio de tirón", category: "Cardio", photo: "/machines/rower.jpg", exercise: "Remoergómetro", move: "cond", areas: ["cardio", "back"], compound: false, role: "station" },
  { id: "stair", name: "Escaladora", hint: "Step-mill o stepper", category: "Cardio", photo: "/machines/stair.jpg", exercise: "Escaladora a ritmo hablando", move: "cond", areas: ["cardio", "legs"], compound: false, role: "station" },
];

export const TYPICAL_GYM_MACHINE_IDS: string[] = [
  "dumbbells",
  "barbell",
  "bench",
  "squat_rack",
  "cable_tower",
  "lat_pulldown",
  "seated_row",
  "leg_press",
  "treadmill",
  "bike",
  "mats",
];

const MOVE_OPTIONS: Record<PlanMove, { machineId: string; name: string }[]> = {
  squat: [
    { machineId: "leg_press", name: "Prensa de piernas" },
    { machineId: "hack_squat", name: "Hack squat" },
    { machineId: "smith", name: "Sentadilla en Smith" },
    { machineId: "squat_rack", name: "Sentadilla goblet o con barra" },
    { machineId: "barbell", name: "Sentadilla goblet o con barra" },
    { machineId: "dumbbells", name: "Sentadilla goblet" },
    { machineId: "box", name: "Sentadilla a cajón" },
    { machineId: "leg_extension", name: "Extensión de cuádriceps" },
  ],
  hinge: [
    { machineId: "barbell", name: "Peso muerto rumano con barra" },
    { machineId: "dumbbells", name: "Peso muerto rumano con mancuernas" },
    { machineId: "kettlebells", name: "Peso muerto rumano con kettlebell" },
    { machineId: "leg_curl", name: "Curl femoral tumbado" },
    { machineId: "hyperextension", name: "Extensión de lumbar en banco romano" },
    { machineId: "smith", name: "Peso muerto rumano en Smith" },
  ],
  lunge: [
    { machineId: "dumbbells", name: "Zancada inversa" },
    { machineId: "smith", name: "Zancada inversa en Smith" },
    { machineId: "box", name: "Step-up bajo controlado" },
    { machineId: "barbell", name: "Zancada inversa" },
  ],
  press: [
    { machineId: "chest_press", name: "Press de pecho en máquina" },
    { machineId: "dumbbells", name: "Press banca con mancuernas" },
    { machineId: "bench", name: "Press banca con mancuernas" },
    { machineId: "adjustable_bench", name: "Press inclinado con mancuernas" },
    { machineId: "smith", name: "Press banca en Smith" },
    { machineId: "pec_deck", name: "Aperturas en peck deck" },
    { machineId: "cable_crossover", name: "Cruces en polea" },
  ],
  row: [
    { machineId: "seated_row", name: "Remo sentado" },
    { machineId: "cable_tower", name: "Remo en polea baja" },
    { machineId: "dumbbells", name: "Remo con mancuerna a una mano" },
    { machineId: "barbell", name: "Remo con barra" },
    { machineId: "functional", name: "Remo invertido" },
    { machineId: "bench", name: "Remo con mancuerna a una mano" },
  ],
  pull: [
    { machineId: "lat_pulldown", name: "Jalón al pecho" },
    { machineId: "pullup_bar", name: "Dominada asistida o negativa" },
    { machineId: "cable_tower", name: "Jalón al pecho" },
    { machineId: "functional", name: "Remo invertido o jalón con TRX" },
    { machineId: "seated_row", name: "Remo sentado agarre ancho" },
  ],
  ohp: [
    { machineId: "shoulder_press", name: "Press de hombro en máquina" },
    { machineId: "dumbbells", name: "Press militar sentado" },
    { machineId: "adjustable_bench", name: "Press militar sentado" },
    { machineId: "smith", name: "Press militar en Smith" },
    { machineId: "squat_rack", name: "Press militar con barra" },
  ],
  core: [
    { machineId: "mats", name: "Plancha con respiración controlada" },
    { machineId: "ab_crunch", name: "Crunch en máquina, rango cómodo" },
    { machineId: "cable_tower", name: "Pallof press en polea" },
    { machineId: "functional", name: "Plancha y bird-dog" },
  ],
  carry: [
    { machineId: "farmers", name: "Paseo del granjero" },
    { machineId: "dumbbells", name: "Paseo del granjero" },
    { machineId: "kettlebells", name: "Paseo del granjero" },
    { machineId: "barbell", name: "Paseo con barra en trapecio" },
  ],
  glute: [
    { machineId: "hip_thrust", name: "Hip thrust" },
    { machineId: "hip_abductor", name: "Abductores en máquina" },
    { machineId: "smith", name: "Hip thrust en Smith" },
    { machineId: "dumbbells", name: "Puente de glúteos con peso" },
    { machineId: "mats", name: "Puente de glúteos" },
    { machineId: "bench", name: "Hip thrust en banco" },
  ],
  push_iso: [
    { machineId: "triceps_pushdown", name: "Extensión de tríceps en polea" },
    { machineId: "cable_tower", name: "Extensión de tríceps en polea" },
    { machineId: "assisted_dip", name: "Fondos asistidos" },
    { machineId: "dumbbells", name: "Press francés con mancuerna" },
  ],
  pull_iso: [
    { machineId: "cable_tower", name: "Face pull" },
    { machineId: "cable_crossover", name: "Face pull" },
    { machineId: "preacher", name: "Curl en banco Scott" },
    { machineId: "dumbbells", name: "Pájaro (rear delt) con mancuernas" },
  ],
  cond: [
    { machineId: "elliptical", name: "Intervalos suaves en elíptica" },
    { machineId: "rower", name: "Remoergómetro suave" },
    { machineId: "stair", name: "Escaladora a ritmo hablando" },
    { machineId: "bike", name: "Bicicleta estática" },
    { machineId: "treadmill", name: "Caminata inclinada" },
  ],
  bike: [
    { machineId: "bike", name: "Bicicleta estática" },
    { machineId: "elliptical", name: "Elíptica continua" },
    { machineId: "rower", name: "Remoergómetro continuo" },
    { machineId: "treadmill", name: "Caminata continua" },
  ],
  walk: [
    { machineId: "treadmill", name: "Caminata inclinada" },
    { machineId: "elliptical", name: "Elíptica suave" },
    { machineId: "bike", name: "Bicicleta estática" },
    { machineId: "stair", name: "Escaladora suave" },
  ],
  mobility: [
    { machineId: "mats", name: "Movilidad de cadera y torácica" },
    { machineId: "functional", name: "Movilidad de cadera y torácica" },
  ],
  balance: [
    { machineId: "dumbbells", name: "Peso muerto a una pierna asistido" },
    { machineId: "kettlebells", name: "Peso muerto a una pierna asistido" },
    { machineId: "box", name: "Step-up a una pierna" },
    { machineId: "mats", name: "Peso muerto a una pierna" },
  ],
};

const BODYWEIGHT_FALLBACK: Record<PlanMove, string> = {
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
};

export function allGymMachineIds() {
  return GYM_MACHINES.map((machine) => machine.id);
}

export function machinesByCategory(category: GymCategory) {
  return GYM_MACHINES.filter((machine) => machine.category === category);
}

export function selectedGymMachineSet(ids?: string[] | null) {
  if (!ids) return new Set(allGymMachineIds());
  return new Set(ids);
}

export function pickGymExercise(
  machineIds: string[] | undefined,
  key: PlanMove
): { name: string; notes?: string } {
  const selected = selectedGymMachineSet(machineIds);
  const match = MOVE_OPTIONS[key].find((option) => selected.has(option.machineId));
  if (match) return { name: match.name };
  return {
    name: BODYWEIGHT_FALLBACK[key],
    notes: "Sin esa máquina: usamos una variante con lo que sí hay.",
  };
}

export function listGymStations(
  machineIds: string[] | undefined,
  zones?: BodyZone[] | null
): StationWork[] {
  const selected = selectedGymMachineSet(machineIds);
  const restrict = Boolean(zones?.length);
  return GYM_MACHINES.filter(
    (machine) => machine.role === "station" && selected.has(machine.id)
  )
    .filter(
      (machine) =>
        !restrict || machine.areas.some((area) => zones!.includes(area))
    )
    .map((machine) => ({
      machineId: machine.id,
      name: machine.exercise,
      move: machine.move,
      compound: machine.compound,
      cardio: machine.category === "Cardio",
      areas: machine.areas,
    }));
}

export function gymMachineNames(ids?: string[] | null) {
  const selected = selectedGymMachineSet(ids);
  return GYM_MACHINES.filter((machine) => selected.has(machine.id)).map(
    (machine) => machine.name
  );
}
