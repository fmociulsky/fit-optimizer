import type { PlanMove } from "./gym-machines";
import type { Exercise, FocusArea, Intensity, Profile } from "./types";

export type PilatesCategory = "Suelo" | "Aparatos" | "Accesorios";
export type PilatesRole = "core" | "lower" | "upper" | "spine" | "balance";
type BodyZone = Exclude<FocusArea, "full_body">;

export interface PilatesItem {
  id: string;
  name: string;
  hint: string;
  category: PilatesCategory;
  photo: string;
}

export interface PilatesWork {
  name: string;
  itemId: string;
  role: PilatesRole;
  areas: BodyZone[];
  reps: string;
  notes: string;
}

export const PILATES_CATEGORIES: PilatesCategory[] = [
  "Suelo",
  "Aparatos",
  "Accesorios",
];

export const PILATES_ITEMS: PilatesItem[] = [
  {
    id: "mat",
    name: "Colchoneta",
    hint: "Suelo: cien, puentes, laterales",
    category: "Suelo",
    photo: "/pilates/mat.jpg",
  },
  {
    id: "reformer",
    name: "Reformer",
    hint: "Carro, muelles, footbar y cintas",
    category: "Aparatos",
    photo: "/pilates/reformer.jpg",
  },
  {
    id: "cadillac",
    name: "Cadillac / torre",
    hint: "Camilla con muelles y barra roll down",
    category: "Aparatos",
    photo: "/pilates/cadillac.jpg",
  },
  {
    id: "chair",
    name: "Silla Wunda",
    hint: "Pedal con muelles, no una silla de casa",
    category: "Aparatos",
    photo: "/pilates/chair.jpg",
  },
  {
    id: "barrel",
    name: "Barril",
    hint: "Spine corrector o ladder barrel",
    category: "Aparatos",
    photo: "/pilates/barrel.jpg",
  },
  {
    id: "box",
    name: "Cajón de reformer",
    hint: "Short box: round back, flat back",
    category: "Aparatos",
    photo: "/pilates/box.jpg",
  },
  {
    id: "circle",
    name: "Aro",
    hint: "Magic circle: muslo, brazos, tobillo",
    category: "Accesorios",
    photo: "/pilates/circle.jpg",
  },
  {
    id: "ball",
    name: "Pelota",
    hint: "Soft ball: sacro, rodillas, plancha",
    category: "Accesorios",
    photo: "/pilates/ball.jpg",
  },
  {
    id: "roller",
    name: "Rodillo",
    hint: "Movilidad torácica y puentes",
    category: "Accesorios",
    photo: "/pilates/roller.jpg",
  },
  {
    id: "bands",
    name: "Bandas",
    hint: "Largas, para brazos y piernas",
    category: "Accesorios",
    photo: "/pilates/bands.jpg",
  },
];

export const TYPICAL_PILATES_IDS = ["mat", "circle", "ball"];

export const PILATES_WORK: PilatesWork[] = [
  { name: "Cien modificado", itemId: "mat", role: "core", areas: ["core"], reps: "10 respiraciones", notes: "Cabeza apoyada si el cuello cansa. Piernas a 90° si la lumbar se despega." },
  { name: "Curl up / roll up corto", itemId: "mat", role: "spine", areas: ["core", "back"], reps: "6–8", notes: "Vértebra a vértebra. Para si tira el cuello o la lumbar." },
  { name: "Single leg stretch", itemId: "mat", role: "core", areas: ["core"], reps: "8–10 por lado", notes: "Ombligo adentro, lumbar quieta. Cambio de pierna sin balanceo." },
  { name: "Tijeras controladas", itemId: "mat", role: "core", areas: ["core"], reps: "8–10 por lado", notes: "Rango que no mueva la pelvis. Rodilla un poco flexionada si hace falta." },
  { name: "Puente de hombros", itemId: "mat", role: "lower", areas: ["glutes", "core"], reps: "8–10", notes: "Sube vértebra a vértebra. Costillas abajo arriba del puente." },
  { name: "Círculos de pierna", itemId: "mat", role: "lower", areas: ["legs", "core"], reps: "6–8 por lado", notes: "Cadera anclada. Círculo pequeño y limpio." },
  { name: "Swan preparación", itemId: "mat", role: "upper", areas: ["back", "shoulders"], reps: "6–8", notes: "Pubis al suelo, cuello largo. No empujes con los hombros a las orejas." },
  { name: "Natación", itemId: "mat", role: "upper", areas: ["back", "glutes"], reps: "20–30 s", notes: "Extensiones cortas y rítmicas. Frente al suelo, no mirar al frente." },
  { name: "Patada lateral", itemId: "mat", role: "lower", areas: ["glutes", "legs"], reps: "8–10 por lado", notes: "Cuerpo en una línea. El tronco no rueda al patear." },
  { name: "Spine stretch", itemId: "mat", role: "spine", areas: ["back", "core"], reps: "6–8", notes: "Flexión desde la cabeza, pelvis pesada. Vuelve empilando." },
  { name: "Sirena", itemId: "mat", role: "spine", areas: ["back", "core"], reps: "5–6 por lado", notes: "Isquion anclado. El lado que se estira no se encoge el hombro." },
  { name: "Bird-dog pilates", itemId: "mat", role: "balance", areas: ["core", "back"], reps: "8–10 por lado", notes: "Cuadrupedia estable. Brazo y pierna a la altura de la espalda, no más alto." },
  { name: "Plancha pilates", itemId: "mat", role: "core", areas: ["core", "shoulders"], reps: "20–40 s", notes: "Talón atrás, pubis a costillas. Rodillas al suelo si tiembla el centro." },
  { name: "Clamshell", itemId: "mat", role: "lower", areas: ["glutes"], reps: "10–12 por lado", notes: "Talones juntos, pelvis quieta. El movimiento sale de la cadera." },

  { name: "Footwork en reformer", itemId: "reformer", role: "lower", areas: ["legs", "glutes"], reps: "10–12", notes: "Talón estable, rodillas alineadas al segundo dedo. Centro activo al recoger." },
  { name: "Pies en cintas · círculos", itemId: "reformer", role: "lower", areas: ["legs", "core"], reps: "6–8 por sentido", notes: "Pelvis quieta. Círculo del tamaño que no mueva el carro de más." },
  { name: "Cien en reformer", itemId: "reformer", role: "core", areas: ["core"], reps: "10 respiraciones", notes: "Si el cuello cansa, cabeza abajo. Piernas altas si la lumbar protesta." },
  { name: "Elephant", itemId: "reformer", role: "spine", areas: ["core", "back"], reps: "8–10", notes: "Caderas altas, talones pesados. El carro se mueve desde el centro, no desde los hombros." },
  { name: "Knee stretches", itemId: "reformer", role: "core", areas: ["core", "glutes"], reps: "8–10", notes: "Rodillas al hombro del carro. Ombligo adentro al empujar y al recoger." },
  { name: "Long stretch", itemId: "reformer", role: "upper", areas: ["shoulders", "core"], reps: "6–8", notes: "Plancha sobre el carro. No dejes caer la lumbar." },
  { name: "Pulling straps", itemId: "reformer", role: "upper", areas: ["back", "arms"], reps: "8–10", notes: "Pecho abierto, cuello largo. Tira con omóplatos, no con trapecio." },
  { name: "Stomach massage", itemId: "reformer", role: "core", areas: ["core", "legs"], reps: "8–10", notes: "Caderas pesadas, pecho alto. El carro se mueve desde el centro." },
  { name: "Scooter", itemId: "reformer", role: "lower", areas: ["glutes", "legs"], reps: "8–10 por lado", notes: "Pie de apoyo estable. El carro se mueve sin torcer la cadera." },

  { name: "Roll down bar", itemId: "cadillac", role: "spine", areas: ["back", "core"], reps: "6–8", notes: "Baja vértebra a vértebra. El muelle ayuda; no te cuelgues de los hombros." },
  { name: "Leg springs", itemId: "cadillac", role: "lower", areas: ["legs", "glutes", "core"], reps: "8–10", notes: "Pelvis anclada. El rango es el que no arquea la lumbar." },
  { name: "Arm springs sentado", itemId: "cadillac", role: "upper", areas: ["shoulders", "arms", "back"], reps: "8–10", notes: "Costillas abajo. Empuja o tira sin encoger el cuello." },
  { name: "Push through", itemId: "cadillac", role: "spine", areas: ["back", "core"], reps: "6–8", notes: "Flexión y extensión de columna con control. Sin rebotes." },

  { name: "Footwork en silla Wunda", itemId: "chair", role: "lower", areas: ["legs", "glutes"], reps: "10–12", notes: "Baja el pedal sin perder el centro. Rodillas alineadas." },
  { name: "Standing pump", itemId: "chair", role: "lower", areas: ["legs", "glutes", "core"], reps: "8–10", notes: "Pie al pedal, torso alto. No dejes que la pelvis se vaya adelante." },
  { name: "Pike en silla Wunda", itemId: "chair", role: "core", areas: ["core", "shoulders"], reps: "6–8", notes: "Caderas altas, hombros lejos de las orejas." },
  { name: "Washer woman", itemId: "chair", role: "upper", areas: ["arms", "shoulders", "core"], reps: "8–10", notes: "Codos cerca del cuerpo. El pecho no se hunde al empujar el pedal." },
  { name: "Teaser en silla", itemId: "chair", role: "core", areas: ["core"], reps: "4–6", notes: "Sube desde el centro. Si el cuello tira, quédate en un teaser corto." },

  { name: "Swan en barril", itemId: "barrel", role: "upper", areas: ["back", "shoulders"], reps: "6–8", notes: "Pubis anclado, cuello largo. Extiende sin comprimir la lumbar." },
  { name: "Side sit-ups en barril", itemId: "barrel", role: "core", areas: ["core"], reps: "6–8 por lado", notes: "Cadera pesada sobre el barril. Sube desde el costado, no desde el cuello." },
  { name: "Stretch de cadera en barril", itemId: "barrel", role: "spine", areas: ["legs", "glutes"], reps: "5 respiraciones por lado", notes: "Rango cómodo. La pelvis no se tuerce." },
  { name: "Extensión de columna en barril", itemId: "barrel", role: "spine", areas: ["back", "core"], reps: "6–8", notes: "Abre el pecho sobre la curva. Vuelve empilando." },

  { name: "Short box · round back", itemId: "box", role: "spine", areas: ["core", "back"], reps: "6–8", notes: "Sentada alta, flexión vértebra a vértebra. Para si hay pinchazo lumbar." },
  { name: "Short box · flat back", itemId: "box", role: "spine", areas: ["core", "back"], reps: "6–8", notes: "Espalda larga, bisagra de cadera. Costillas abajo." },
  { name: "Mermaid en cajón", itemId: "box", role: "spine", areas: ["back", "core"], reps: "5–6 por lado", notes: "Isquion anclado. Estira el costado sin encoger el hombro." },
  { name: "Side sit-ups en cajón", itemId: "box", role: "core", areas: ["core"], reps: "6–8 por lado", notes: "Cadera pesada. El movimiento sale del costado, no del cuello." },

  { name: "Squeeze de aductores con aro", itemId: "circle", role: "lower", areas: ["legs", "core"], reps: "10–12", notes: "Presión suave y constante. Pelvis quieta." },
  { name: "Press de brazos con aro", itemId: "circle", role: "upper", areas: ["chest", "arms"], reps: "8–10", notes: "Costillas abajo. No encoger el cuello al apretar." },
  { name: "Press de tobillos con aro", itemId: "circle", role: "lower", areas: ["legs", "glutes"], reps: "10 por lado", notes: "Aro entre tobillos o muslos. Centro activo." },

  { name: "Puente con pelota", itemId: "ball", role: "lower", areas: ["glutes", "core"], reps: "8–10", notes: "Pelota bajo sacro o entre rodillas. Sube sin empujar la lumbar." },
  { name: "Plancha con pelota", itemId: "ball", role: "core", areas: ["core", "shoulders"], reps: "20–30 s", notes: "Pelota bajo manos o muslos. Menos rango si tiembla." },
  { name: "Roll down con pelota", itemId: "ball", role: "spine", areas: ["back", "core"], reps: "6–8", notes: "La pelota guía la flexión. Vuelve empilando." },

  { name: "Movilidad torácica en rodillo", itemId: "roller", role: "spine", areas: ["back", "shoulders"], reps: "6–8", notes: "Cadera pesada, mentón recogido. Corto y cómodo." },
  { name: "Puente con rodillo", itemId: "roller", role: "lower", areas: ["glutes", "core"], reps: "8–10", notes: "Pies o sacro sobre el rodillo. Pelvis nivelada." },

  { name: "Chest expansion con banda", itemId: "bands", role: "upper", areas: ["shoulders", "back"], reps: "8–10", notes: "Brazos largos atrás, pecho abierto. El cuello no se adelanta." },
  { name: "Rowing back con banda", itemId: "bands", role: "upper", areas: ["back", "arms"], reps: "8–10", notes: "Codos rozan el costado. Omóplatos hacia los bolsillos." },
  { name: "Cien con banda en pies", itemId: "bands", role: "core", areas: ["core"], reps: "10 respiraciones", notes: "Banda alrededor de los pies. Cabeza apoyada si el cuello cansa." },
  { name: "Side kick con banda", itemId: "bands", role: "lower", areas: ["glutes", "legs"], reps: "8–10 por lado", notes: "El tronco no rueda. La banda da tensión, no tira de la lumbar." },
];

const MOVE_FALLBACK: Record<PlanMove, string> = {
  squat: "Puente de hombros",
  hinge: "Puente de hombros",
  lunge: "Patada lateral",
  press: "Swan preparación",
  row: "Rowing back con banda",
  pull: "Natación",
  ohp: "Chest expansion con banda",
  core: "Cien modificado",
  carry: "Marcha con control de centro",
  glute: "Clamshell",
  push_iso: "Press de brazos con aro",
  pull_iso: "Pulling straps",
  cond: "Flow de mat: puente, patada y plancha",
  bike: "Patada lateral",
  walk: "Caminata con control de centro",
  mobility: "Spine stretch",
  balance: "Bird-dog pilates",
};

const MOVE_ROLE: Partial<Record<PlanMove, PilatesRole>> = {
  squat: "lower",
  hinge: "lower",
  lunge: "lower",
  press: "upper",
  row: "upper",
  pull: "upper",
  ohp: "upper",
  core: "core",
  glute: "lower",
  push_iso: "upper",
  pull_iso: "upper",
  mobility: "spine",
  balance: "balance",
  cond: "core",
  bike: "lower",
  walk: "balance",
  carry: "core",
};

export function typicalPilatesItems() {
  return [...TYPICAL_PILATES_IDS];
}

export function seedPilatesItems(
  equipment: Profile["equipment"],
  current?: string[] | null
) {
  if (equipment !== "pilates") return current ?? [];
  const known = new Set(PILATES_ITEMS.map((item) => item.id));
  const cleaned = (current ?? []).filter((id) => known.has(id));
  if (cleaned.length) {
    return cleaned.includes("mat") ? cleaned : ["mat", ...cleaned];
  }
  return typicalPilatesItems();
}

export function pilatesItemNames(ids?: string[] | null) {
  if (!ids?.length) return [];
  const selected = new Set(ids);
  return PILATES_ITEMS.filter((item) => selected.has(item.id)).map(
    (item) => item.name
  );
}

export function listPilatesWork(
  itemIds: string[] | undefined,
  zones?: BodyZone[] | null
): PilatesWork[] {
  const selected = new Set(itemIds?.length ? itemIds : TYPICAL_PILATES_IDS);
  const pool = PILATES_WORK.filter((item) => selected.has(item.itemId));
  const source = pool.length ? pool : PILATES_WORK.filter((item) => item.itemId === "mat");
  if (!zones?.length) return source;
  const matched = source.filter(
    (item) =>
      item.areas.some((area) => zones.includes(area)) || item.role === "core"
  );
  return matched.length ? matched : source;
}

export function pickPilatesMove(
  itemIds: string[] | undefined,
  key: PlanMove
): { name: string; notes?: string } {
  const role = MOVE_ROLE[key];
  const pool = listPilatesWork(itemIds);
  const match = role ? pool.find((item) => item.role === role) : undefined;
  if (match) return { name: match.name, notes: match.notes };
  return { name: MOVE_FALLBACK[key] };
}

export function pilatesRest(intensity: Intensity) {
  return intensity === "low" ? 20 : 30;
}

export function toPilatesExercise(
  profile: Profile,
  intensity: Intensity,
  work: PilatesWork
): Exercise {
  const sets =
    profile.experience === "beginner" ? 2 : profile.experience === "advanced" ? 3 : 2;
  return {
    name: work.name,
    sets,
    reps: work.reps,
    restSec: pilatesRest(intensity),
    notes: work.notes,
  };
}
