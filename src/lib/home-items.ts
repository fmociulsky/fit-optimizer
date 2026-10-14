import type { Equipment } from "./types";
import type { PlanMove } from "./gym-machines";

export type HomeCategory = "Pesas" | "Bandas" | "Soporte" | "Casa" | "Cardio";

export interface HomeItem {
  id: string;
  name: string;
  hint: string;
  category: HomeCategory;
  photo: string;
}

export const HOME_CATEGORIES: HomeCategory[] = [
  "Pesas",
  "Bandas",
  "Soporte",
  "Casa",
  "Cardio",
];

export const HOME_ITEMS: HomeItem[] = [
  { id: "dumbbells", name: "Mancuernas", hint: "Un par o más, aunque no pesen mucho", category: "Pesas", photo: "/home/dumbbells.jpg" },
  { id: "kettlebells", name: "Kettlebell", hint: "Una o varias pesas rusas", category: "Pesas", photo: "/home/kettlebells.jpg" },
  { id: "barbell", name: "Barra y discos", hint: "Si tienes espacio y platos", category: "Pesas", photo: "/home/barbell.jpg" },
  { id: "bands", name: "Bandas elásticas", hint: "Largas, de distintos grosores", category: "Bandas", photo: "/home/bands.jpg" },
  { id: "mini_bands", name: "Mini bandas", hint: "Las de tobillo y glúteo", category: "Bandas", photo: "/home/mini_bands.jpg" },
  { id: "bench", name: "Banco", hint: "Plano o regulable", category: "Soporte", photo: "/home/bench.jpg" },
  { id: "box", name: "Cajón o step", hint: "También vale un taburete estable", category: "Soporte", photo: "/home/box.jpg" },
  { id: "chair", name: "Silla estable", hint: "Sin ruedas: fondos, apoyo, sentarse", category: "Soporte", photo: "/home/chair.jpg" },
  { id: "pullup_bar", name: "Barra de dominadas", hint: "La de puerta vale", category: "Soporte", photo: "/home/pullup_bar.jpg" },
  { id: "trx", name: "TRX o anillas", hint: "Ancladas a puerta o techo", category: "Soporte", photo: "/home/trx.jpg" },
  { id: "mats", name: "Colchoneta", hint: "Suelo, core y movilidad", category: "Casa", photo: "/home/mats.jpg" },
  { id: "backpack", name: "Mochila o maleta", hint: "Para cargar y pasear", category: "Casa", photo: "/home/backpack.jpg" },
  { id: "wall", name: "Pared libre", hint: "Isométricos y pike push-up", category: "Casa", photo: "/home/wall.jpg" },
  { id: "jump_rope", name: "Cuerda de saltar", hint: "Cardio corto en poco espacio", category: "Cardio", photo: "/home/jump_rope.jpg" },
  { id: "bike", name: "Bici estática", hint: "Si la tienes en casa", category: "Cardio", photo: "/home/bike.jpg" },
];

export const TYPICAL_HOME_DUMBBELL_IDS = [
  "dumbbells",
  "mats",
  "chair",
  "backpack",
];

export const TYPICAL_HOME_BODYWEIGHT_IDS = [
  "mats",
  "chair",
  "bands",
  "wall",
];

const HOME_MOVE_OPTIONS: Record<PlanMove, { itemId: string; name: string }[]> = {
  squat: [
    { itemId: "dumbbells", name: "Sentadilla goblet" },
    { itemId: "kettlebells", name: "Sentadilla goblet" },
    { itemId: "barbell", name: "Sentadilla con barra" },
    { itemId: "box", name: "Sentadilla al cajón" },
    { itemId: "chair", name: "Sentadilla a la silla" },
    { itemId: "bands", name: "Sentadilla con banda" },
    { itemId: "wall", name: "Sentadilla isométrica en pared" },
  ],
  hinge: [
    { itemId: "dumbbells", name: "Peso muerto rumano con mancuernas" },
    { itemId: "kettlebells", name: "Peso muerto rumano con kettlebell" },
    { itemId: "barbell", name: "Peso muerto rumano con barra" },
    { itemId: "backpack", name: "Peso muerto rumano con mochila" },
    { itemId: "bands", name: "Good morning con banda" },
    { itemId: "mats", name: "Good morning a peso corporal / puente" },
  ],
  lunge: [
    { itemId: "dumbbells", name: "Zancada inversa" },
    { itemId: "kettlebells", name: "Zancada inversa" },
    { itemId: "box", name: "Step-up en cajón" },
    { itemId: "chair", name: "Step-up a silla baja" },
    { itemId: "bands", name: "Zancada inversa" },
  ],
  press: [
    { itemId: "bench", name: "Press banca con mancuernas" },
    { itemId: "dumbbells", name: "Press de suelo o banco con mancuernas" },
    { itemId: "bands", name: "Press de pecho con banda" },
    { itemId: "chair", name: "Flexiones con manos en silla" },
    { itemId: "wall", name: "Flexiones en pared o pike" },
    { itemId: "mats", name: "Flexiones elevadas o de rodillas" },
  ],
  row: [
    { itemId: "dumbbells", name: "Remo con mancuerna" },
    { itemId: "kettlebells", name: "Remo con kettlebell" },
    { itemId: "trx", name: "Remo invertido en TRX o anillas" },
    { itemId: "bands", name: "Remo con banda" },
    { itemId: "backpack", name: "Remo con mochila" },
    { itemId: "chair", name: "Remo invertido en mesa o silla" },
  ],
  pull: [
    { itemId: "pullup_bar", name: "Dominada asistida o negativa" },
    { itemId: "trx", name: "Jalón en TRX" },
    { itemId: "bands", name: "Jalón con banda" },
    { itemId: "dumbbells", name: "Remo con mancuerna a dos manos" },
    { itemId: "mats", name: "Superman + bandas de jalón" },
  ],
  ohp: [
    { itemId: "dumbbells", name: "Press militar con mancuernas" },
    { itemId: "kettlebells", name: "Press militar con kettlebell" },
    { itemId: "bands", name: "Press militar con banda" },
    { itemId: "wall", name: "Pike push-up en pared" },
    { itemId: "chair", name: "Pike push-up con pies en silla" },
  ],
  core: [
    { itemId: "mats", name: "Plancha" },
    { itemId: "bands", name: "Pallof press con banda" },
    { itemId: "mini_bands", name: "Plancha" },
    { itemId: "chair", name: "Plancha con manos en silla" },
  ],
  carry: [
    { itemId: "dumbbells", name: "Paseo del granjero" },
    { itemId: "kettlebells", name: "Paseo del granjero" },
    { itemId: "backpack", name: "Marcha con maleta o mochila" },
    { itemId: "bands", name: "Marcha con maleta o mochila" },
  ],
  glute: [
    { itemId: "bench", name: "Hip thrust" },
    { itemId: "dumbbells", name: "Puente de glúteos con peso" },
    { itemId: "kettlebells", name: "Puente de glúteos con peso" },
    { itemId: "mini_bands", name: "Puente de glúteos con mini banda" },
    { itemId: "mats", name: "Puente de glúteos a una pierna" },
  ],
  push_iso: [
    { itemId: "dumbbells", name: "Press francés con mancuerna" },
    { itemId: "chair", name: "Fondos en silla" },
    { itemId: "bands", name: "Extensión de tríceps con banda" },
    { itemId: "bench", name: "Fondos en banco" },
  ],
  pull_iso: [
    { itemId: "dumbbells", name: "Pájaro (rear delt) con mancuernas" },
    { itemId: "bands", name: "Face pull con banda" },
    { itemId: "mini_bands", name: "Face pull con banda" },
    { itemId: "trx", name: "Face pull en TRX" },
  ],
  cond: [
    { itemId: "jump_rope", name: "Cuerda a ritmo hablando" },
    { itemId: "bike", name: "Bicicleta estática" },
    { itemId: "bands", name: "Circuito de bodyweight 40/20" },
    { itemId: "mats", name: "Circuito 40/20 (sentadilla, flexión, plancha)" },
  ],
  bike: [
    { itemId: "bike", name: "Bicicleta estática" },
    { itemId: "jump_rope", name: "Cuerda continua suave" },
    { itemId: "box", name: "Step-ups al ritmo" },
    { itemId: "chair", name: "Step-ups al ritmo" },
  ],
  walk: [
    { itemId: "bike", name: "Bicicleta estática" },
    { itemId: "backpack", name: "Caminata rápida exterior" },
    { itemId: "mats", name: "Caminata rápida" },
  ],
  mobility: [
    { itemId: "mats", name: "Movilidad de cadera y torácica" },
    { itemId: "bands", name: "Movilidad de cadera y torácica" },
    { itemId: "chair", name: "Movilidad de cadera sentado" },
  ],
  balance: [
    { itemId: "dumbbells", name: "Peso muerto a una pierna" },
    { itemId: "kettlebells", name: "Peso muerto a una pierna" },
    { itemId: "box", name: "Step-up a una pierna" },
    { itemId: "mats", name: "Peso muerto a una pierna" },
  ],
};

type HomeTraining = "full_gym" | "home_dumbbells" | "bodyweight";

const FALLBACK: Record<HomeTraining, Record<PlanMove, string>> = {
  full_gym: {
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

export function typicalHomeItems(equipment: Equipment) {
  if (equipment === "home_dumbbells") return [...TYPICAL_HOME_DUMBBELL_IDS];
  if (equipment === "bodyweight") return [...TYPICAL_HOME_BODYWEIGHT_IDS];
  return [];
}

export function seedHomeItems(
  equipment: Equipment,
  current?: string[] | null
) {
  if (equipment === "full_gym" || equipment === "coach" || equipment === "pilates") {
    return [];
  }
  if (current?.length) {
    if (equipment === "home_dumbbells" && !current.includes("dumbbells")) {
      return [...current, "dumbbells"];
    }
    return current;
  }
  return typicalHomeItems(equipment);
}

export function pickHomeExercise(
  itemIds: string[] | undefined,
  key: PlanMove,
  equipment: Equipment
): { name: string; notes?: string } {
  if (equipment === "coach") {
    return { name: "Pendiente del profesor" };
  }
  if (equipment === "pilates") {
    return { name: "Cien modificado" };
  }
  const fallback = FALLBACK[equipment];
  if (!itemIds?.length) {
    return { name: fallback[key] };
  }
  const selected = new Set(itemIds);
  const match = HOME_MOVE_OPTIONS[key].find((option) =>
    selected.has(option.itemId)
  );
  if (match) return { name: match.name };
  return {
    name: fallback[key],
    notes: "Sin ese material: usamos una variante con lo que sí hay.",
  };
}

export function homeItemNames(ids?: string[] | null) {
  if (!ids?.length) return [];
  const selected = new Set(ids);
  return HOME_ITEMS.filter((item) => selected.has(item.id)).map(
    (item) => item.name
  );
}
