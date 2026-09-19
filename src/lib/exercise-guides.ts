import type { Sex } from "@/lib/types";

export type Point = { x: number; y: number };

export type Support = "none" | "box" | "bench" | "step" | "floor";
export type Weight = "none" | "db" | "bar" | "cable";

export interface SidePose {
  head: Point;
  shoulder: Point;
  hip: Point;
  knee: Point;
  ankle: Point;
  toe: Point;
  elbow: Point;
  wrist: Point;
  kneeB?: Point;
  ankleB?: Point;
  toeB?: Point;
  elbowB?: Point;
  wristB?: Point;
  support?: Support;
  weight?: Weight;
}

export interface ExercisePhase {
  title: string;
  cue: string;
  pose: SidePose;
}

export interface ExerciseGuide {
  id: string;
  summary: string;
  setup: string;
  breathe: string;
  avoid: string[];
  phases: ExercisePhase[];
  video?: string;
  poster?: string;
}

export type GuidePhotoSex = "male" | "female";

export function guidePhotoSex(sex?: Sex | null): GuidePhotoSex {
  return sex === "female" ? "female" : "male";
}

function mediaFor(id: string, sex: GuidePhotoSex) {
  return {
    video: `/exercises/${sex}/${id}.mp4`,
    poster: `/exercises/${sex}/${id}-0.jpg`,
  };
}

function p(x: number, y: number): Point {
  return { x, y };
}

const STAND: SidePose = {
  head: p(42, 20),
  shoulder: p(40, 36),
  hip: p(40, 64),
  knee: p(41, 92),
  ankle: p(40, 118),
  toe: p(52, 120),
  elbow: p(50, 50),
  wrist: p(48, 40),
  weight: "db",
};

function pose(base: SidePose, patch: Partial<SidePose>): SidePose {
  return { ...base, ...patch };
}

function createGuides(): Record<string, ExerciseGuide> {
  return {
  squat: {
    id: "squat",
    summary:
      "Siéntate entre los talones con el pecho alto. El goblet (mancuerna al pecho) te ayuda a no caer hacia delante.",
    setup: "Pies a la altura de los hombros, puntas un poco hacia fuera. La mancuerna o el lastre van pegados al pecho.",
    breathe: "Aire al bajar. Suelta al subir. No aguantes la respiración.",
    avoid: ["Rodillas que se meten hacia dentro", "Talones que se despegan", "Redondear la lumbar"],
    phases: [
      {
        title: "Inicio",
        cue: "Costillas abajo, mirada al frente, peso en medio del pie.",
        pose: pose(STAND, {
          elbow: p(48, 48),
          wrist: p(44, 38),
        }),
      },
      {
        title: "Bajada",
        cue: "Caderas atrás y abajo a la vez. Rodillas siguen la línea del pie.",
        pose: {
          head: p(44, 32),
          shoulder: p(42, 48),
          hip: p(38, 78),
          knee: p(50, 96),
          ankle: p(40, 118),
          toe: p(52, 120),
          elbow: p(50, 60),
          wrist: p(46, 50),
          weight: "db",
        },
      },
      {
        title: "Fondo",
        cue: "Baja hasta muslo paralelo o al cajón. Empuja el suelo y vuelve sin rebotar.",
        pose: {
          head: p(46, 40),
          shoulder: p(43, 56),
          hip: p(36, 90),
          knee: p(54, 100),
          ankle: p(40, 118),
          toe: p(52, 120),
          elbow: p(51, 68),
          wrist: p(47, 58),
          weight: "db",
        },
      },
    ],
  },
  squat_box: {
    id: "squat_box",
    summary:
      "Te sientas a un cajón o banco y te levantas. El rango queda limitado: menos estrés en rodilla y lumbar.",
    setup: "Cajón a una altura en la que bajes sin dolor. Toca y súbete; no te dejes caer.",
    breathe: "Aire al bajar. Suelta al empujar hacia arriba.",
    avoid: ["Plumear contra el cajón", "Rodillas hacia dentro", "Empujar solo con las puntas"],
    phases: [
      {
        title: "Inicio",
        cue: "Pies firmes, pecho abierto. El cajón queda justo detrás.",
        pose: pose(STAND, { support: "box", elbow: p(48, 48), wrist: p(44, 38) }),
      },
      {
        title: "Hacia el cajón",
        cue: "Caderas atrás. Controla los últimos centímetros.",
        pose: {
          head: p(44, 34),
          shoulder: p(42, 50),
          hip: p(40, 82),
          knee: p(50, 98),
          ankle: p(40, 118),
          toe: p(52, 120),
          elbow: p(50, 62),
          wrist: p(46, 52),
          support: "box",
          weight: "db",
        },
      },
      {
        title: "Toque y subida",
        cue: "Toca el cajón con el glúteo y empuja el suelo para volver.",
        pose: {
          head: p(46, 42),
          shoulder: p(44, 58),
          hip: p(42, 92),
          knee: p(52, 102),
          ankle: p(40, 118),
          toe: p(52, 120),
          elbow: p(51, 70),
          wrist: p(47, 60),
          support: "box",
          weight: "db",
        },
      },
    ],
  },
  hinge: {
    id: "hinge",
    summary:
      "La cadera se echa atrás como si cerraras una puerta con el glúteo. La barra o las mancuernas bajan pegadas a la pierna.",
    setup: "Pies bajo cadera. Ligera flexión de rodilla y ya no se mueve. Espalda larga.",
    breathe: "Aire antes de bajar. Suelta al estirar cadera arriba.",
    avoid: ["Redondear la espalda", "Doblar demasiado la rodilla (se vuelve sentadilla)", "Alejar el peso de las piernas"],
    phases: [
      {
        title: "Inicio",
        cue: "Hombros sobre caderas. El peso cuelga a lo largo de los muslos.",
        pose: {
          head: p(42, 20),
          shoulder: p(40, 36),
          hip: p(40, 64),
          knee: p(42, 92),
          ankle: p(40, 118),
          toe: p(52, 120),
          elbow: p(48, 58),
          wrist: p(48, 78),
          weight: "bar",
        },
      },
      {
        title: "Bisagra",
        cue: "Cadera atrás, tibia quieta, tronco largo. El peso baja hasta la rodilla o un poco más.",
        pose: {
          head: p(58, 38),
          shoulder: p(52, 48),
          hip: p(38, 70),
          knee: p(44, 94),
          ankle: p(40, 118),
          toe: p(52, 120),
          elbow: p(56, 72),
          wrist: p(54, 90),
          weight: "bar",
        },
      },
      {
        title: "Cierre",
        cue: "Empuja el suelo y estira la cadera. Glúteo aprieta arriba, sin hiperextender la lumbar.",
        pose: {
          head: p(42, 20),
          shoulder: p(40, 36),
          hip: p(40, 64),
          knee: p(42, 92),
          ankle: p(40, 118),
          toe: p(52, 120),
          elbow: p(48, 58),
          wrist: p(48, 78),
          weight: "bar",
        },
      },
    ],
  },
  glute_bridge: {
    id: "glute_bridge",
    summary:
      "Tumbado, empujas la cadera hacia el techo. Es la bisagra más amable con la espalda baja.",
    setup: "Boca arriba, pies cerca del glúteo, brazos a los lados. Costillas abajo.",
    breathe: "Aire abajo. Suelta al subir la cadera.",
    avoid: ["Pasarte de arco lumbar", "Empujar con el cuello", "Abrir las rodillas sin control"],
    phases: [
      {
        title: "Inicio",
        cue: "Lumbar en contacto suave con el suelo. Talones firmes.",
        pose: FLOOR_LIE,
      },
      {
        title: "Empuje",
        cue: "Talones al suelo, cadera arriba hasta alinear hombro-cadera-rodilla.",
        pose: BRIDGE_UP,
      },
      {
        title: "Pausa y baja",
        cue: "Aprieta 1 segundo arriba y baja vértebra a vértebra.",
        pose: BRIDGE_MID,
      },
    ],
  },
  hip_thrust: {
    id: "hip_thrust",
    summary:
      "Como el puente, pero con la espalda alta apoyada en un banco. Más rango para el glúteo.",
    setup: "Omoplatos en el banco, pies al ancho de cadera. La barra o mancuerna va sobre el pliegue de la cadera.",
    breathe: "Aire abajo. Suelta al extender la cadera.",
    avoid: ["Mirar al techo con el cuello quebrado", "Empujar con la lumbar", "Pies demasiado lejos"],
    phases: [
      {
        title: "Inicio",
        cue: "Barbilla metida. Cadera baja, cerca del suelo.",
        pose: THRUST_DOWN,
      },
      {
        title: "Subida",
        cue: "Empuja el suelo con los talones. Costillas hacia la cadera.",
        pose: THRUST_MID,
      },
      {
        title: "Arriba",
        cue: "Cadera a la altura del banco. Pausa y baja controlado.",
        pose: THRUST_UP,
      },
    ],
  },
  lunge: {
    id: "lunge",
    summary:
      "Un paso atrás y bajas en tijera. La zancada inversa suele sentar mejor a la rodilla delantera.",
    setup: "Pies bajo cadera. El paso atrás es lo bastante largo para que ambas rodillas queden cerca de 90°.",
    breathe: "Aire al bajar. Suelta al volver.",
    avoid: ["Rodilla delantera por dentro", "Golpear la rodilla de atrás contra el suelo", "Tronco que se derrumba"],
    phases: [
      {
        title: "Inicio",
        cue: "Alto, peso en el pie delantero.",
        pose: pose(STAND, { weight: "db", elbow: p(42, 64), wrist: p(42, 84) }),
      },
      {
        title: "Paso atrás",
        cue: "El pie de atrás toca con la punta. El delantero sigue plano.",
        pose: {
          head: p(42, 22),
          shoulder: p(40, 38),
          hip: p(40, 66),
          knee: p(50, 92),
          ankle: p(54, 118),
          toe: p(64, 120),
          kneeB: p(28, 96),
          ankleB: p(22, 118),
          toeB: p(14, 120),
          elbow: p(42, 66),
          wrist: p(42, 86),
          weight: "db",
        },
      },
      {
        title: "Fondo",
        cue: "Baja en vertical. Empuja el suelo con el pie delantero para volver.",
        pose: {
          head: p(42, 32),
          shoulder: p(40, 48),
          hip: p(40, 80),
          knee: p(52, 98),
          ankle: p(54, 118),
          toe: p(64, 120),
          kneeB: p(26, 104),
          ankleB: p(20, 118),
          toeB: p(12, 120),
          elbow: p(42, 72),
          wrist: p(42, 90),
          weight: "db",
        },
      },
    ],
  },
  step_up: {
    id: "step_up",
    summary:
      "Subes a un escalón bajo con una pierna. Menos estrés que la zancada si la rodilla protesta.",
    setup: "Escalón de 10–20 cm. Todo el pie delantero encima, no solo la punta.",
    breathe: "Aire abajo. Suelta al subir.",
    avoid: ["Impulsarte con el pie de atrás", "Rodilla que se va hacia dentro", "Subir de un brinco"],
    phases: [
      {
        title: "Apoyo",
        cue: "Planta el pie en el escalón. El tronco queda alto.",
        pose: {
          head: p(44, 18),
          shoulder: p(42, 34),
          hip: p(42, 62),
          knee: p(50, 82),
          ankle: p(52, 100),
          toe: p(62, 102),
          kneeB: p(34, 92),
          ankleB: p(32, 118),
          toeB: p(42, 120),
          elbow: p(42, 62),
          wrist: p(42, 82),
          support: "step",
          weight: "db",
        },
      },
      {
        title: "Subida",
        cue: "Empuja el escalón con el talón de arriba hasta estirar la cadera.",
        pose: {
          head: p(48, 10),
          shoulder: p(46, 26),
          hip: p(46, 52),
          knee: p(48, 78),
          ankle: p(46, 100),
          toe: p(58, 102),
          kneeB: p(40, 70),
          ankleB: p(38, 92),
          toeB: p(48, 94),
          elbow: p(46, 54),
          wrist: p(46, 74),
          support: "step",
          weight: "db",
        },
      },
      {
        title: "Arriba y baja",
        cue: "Pausa un segundo y baja con el mismo control, pie de atrás primero.",
        pose: pose(STAND, {
          support: "step",
          elbow: p(42, 64),
          wrist: p(42, 84),
          weight: "db",
          hip: p(46, 50),
          knee: p(47, 78),
          ankle: p(46, 100),
          toe: p(58, 102),
          head: p(48, 8),
          shoulder: p(46, 24),
        }),
      },
    ],
  },
  press: {
    id: "press",
    summary:
      "Tumbado, empujas las mancuernas hacia el techo. Escápulas quietas, como si las clavases en el banco.",
    setup: "Cabeza, hombros y cadera en el banco. Pies en el suelo. Mancuernas a la altura del pecho.",
    breathe: "Aire al bajar. Suelta al empujar.",
    avoid: ["Arquear la lumbar de más", "Chocar las mancuernas arriba", "Codos a 90° de apertura (demasiado abiertos)"],
    phases: [
      {
        title: "Inicio",
        cue: "Brazos estirados sobre el pecho, muñecas encima del codo.",
        pose: PRESS_UP,
      },
      {
        title: "Bajada",
        cue: "Codos a unos 45° del tronco. Las mancuernas bajan hacia el pecho.",
        pose: PRESS_MID,
      },
      {
        title: "Pecho y empujón",
        cue: "Toca la zona del pecho y empuja el techo, no las paredes.",
        pose: PRESS_DOWN,
      },
    ],
  },
  pushup: {
    id: "pushup",
    summary:
      "Una plancha que empuja. Manos bajo hombros; el cuerpo se mueve en bloque, de cabeza a talón.",
    setup: "Manos al ancho de hombros. Si es duro, eleva las manos en un banco o baja a rodillas.",
    breathe: "Aire al bajar. Suelta al empujar.",
    avoid: ["Cadera que se hunde", "Codos pegados a las orejas", "Solo bajar la cabeza"],
    phases: [
      {
        title: "Plancha",
        cue: "Glúteo suave, pelvis neutra. Mirada un poco por delante de las manos.",
        pose: PUSH_UP,
      },
      {
        title: "Bajada",
        cue: "Codos a 45°. Pecho hacia el suelo, no la cadera.",
        pose: PUSH_MID,
      },
      {
        title: "Fondo",
        cue: "Pecho cerca del suelo y empuja el suelo lejos de ti.",
        pose: PUSH_DOWN,
      },
    ],
  },
  row: {
    id: "row",
    summary:
      "Tiras del peso hacia la cadera. El codo pasa pegado al cuerpo; el hombro no se encoge hacia la oreja.",
    setup: "Una mano y una rodilla en el banco, o bisagra de pie. La espalda queda paralela al suelo.",
    breathe: "Aire con el brazo largo. Suelta al tirar.",
    avoid: ["Girar el tronco", "Encoger el trapecio", "Tirar con la muñeca y no con el codo"],
    phases: [
      {
        title: "Brazo largo",
        cue: "Omóplato estable. El peso cuelga, hombro lejos de la oreja.",
        pose: ROW_HANG,
      },
      {
        title: "Tirón",
        cue: "Codo hacia el bolsillo de atrás. Pecho quieto.",
        pose: ROW_MID,
      },
      {
        title: "Codo atrás",
        cue: "Pausa un segundo con la mancuerna junto a la cadera y baja en 2 tiempos.",
        pose: ROW_TOP,
      },
    ],
  },
  inverted_row: {
    id: "inverted_row",
    summary:
      "Tiras de tu cuerpo hacia una mesa o barra. Cuanto más horizontal, más difícil.",
    setup: "Cuerpo en línea. Agarre un poco más ancho que los hombros.",
    breathe: "Aire abajo. Suelta al tirar.",
    avoid: ["Dejar caer la cadera", "Encoger el cuello", "Tirones cortos que no llegan al pecho"],
    phases: [
      {
        title: "Colgado",
        cue: "Cuerpo rígido, talones al suelo, brazos largos.",
        pose: INV_HANG,
      },
      {
        title: "Tirón",
        cue: "Pecho hacia la barra. Codos rozan el costado.",
        pose: INV_MID,
      },
      {
        title: "Pecho arriba",
        cue: "Toca la barra con el pecho y baja sin romper la línea.",
        pose: INV_TOP,
      },
    ],
  },
  pull: {
    id: "pull",
    summary:
      "Tiras de un jalón hacia la parte alta del pecho. Piensa en bajar los codos, no en flexionar los brazos.",
    setup: "Agarre un poco más ancho que hombros. Pecho alto, ligera inclinación atrás.",
    breathe: "Aire arriba. Suelta al bajar la barra.",
    avoid: ["Tirar detrás de la nuca", "Balancear el tronco", "Encoger trapecios"],
    phases: [
      {
        title: "Arriba",
        cue: "Brazos largos, costillas abajo, mirada al frente.",
        pose: PULL_TOP,
      },
      {
        title: "Codos abajo",
        cue: "Inicia con los omóplatos. Los codos bajan hacia las caderas.",
        pose: PULL_MID,
      },
      {
        title: "Al pecho",
        cue: "La barra llega al pecho alto. Suelta en 2 tiempos hacia arriba.",
        pose: PULL_DOWN,
      },
    ],
  },
  ohp: {
    id: "ohp",
    summary:
      "Empujas el peso por encima de la cabeza. Costillas abajo para no convertir esto en un arco lumbar.",
    setup: "Sentado o de pie. Mancuernas a la altura de las orejas, codos un poco por delante.",
    breathe: "Aire abajo. Suelta al empujar.",
    avoid: ["Abrir las costillas", "Empujar la cabeza hacia delante", "Codos demasiado atrás"],
    phases: [
      {
        title: "Rack",
        cue: "Mancuernas junto a las orejas. Glúteo y abdomen firmes.",
        pose: {
          head: p(42, 22),
          shoulder: p(40, 40),
          hip: p(40, 70),
          knee: p(46, 96),
          ankle: p(40, 118),
          toe: p(52, 120),
          elbow: p(50, 56),
          wrist: p(48, 28),
          support: "bench",
          weight: "db",
        },
      },
      {
        title: "Empuje",
        cue: "Cabeza un poco atrás para que las mancuernas pasen, luego vuelve.",
        pose: {
          head: p(42, 20),
          shoulder: p(40, 38),
          hip: p(40, 70),
          knee: p(46, 96),
          ankle: p(40, 118),
          toe: p(52, 120),
          elbow: p(46, 28),
          wrist: p(44, 10),
          support: "bench",
          weight: "db",
        },
      },
      {
        title: "Arriba",
        cue: "Bíceps cerca de las orejas. Baja el peso a la misma trayectoria.",
        pose: {
          head: p(42, 22),
          shoulder: p(40, 40),
          hip: p(40, 70),
          knee: p(46, 96),
          ankle: p(40, 118),
          toe: p(52, 120),
          elbow: p(42, 18),
          wrist: p(42, 4),
          support: "bench",
          weight: "db",
        },
      },
    ],
  },
  plank: {
    id: "plank",
    summary:
      "Una línea de hombros a talones. No es aguantar hasta temblar: es respirar mientras el tronco no se mueve.",
    setup: "Codos bajo hombros o manos. Pelvis en punto medio: ni culo al techo ni cadera al suelo.",
    breathe: "Respiración continua. Si aguantas el aire, estás haciendo fuerza de más.",
    avoid: ["Cadera caída", "Hombros en las orejas", "Contener la respiración"],
    phases: [
      {
        title: "Apoyo",
        cue: "Antebrazos y puntas de los pies. Empuja el suelo con los codos.",
        pose: PLANK,
      },
      {
        title: "Cierre",
        cue: "Glúteo suave, pubis un poco hacia las costillas.",
        pose: PLANK,
      },
      {
        title: "Respiración",
        cue: "Inhala 3 segundos, exhala 3. Si la cadera cae, para.",
        pose: PLANK,
      },
    ],
  },
  bird_dog: {
    id: "bird_dog",
    summary:
      "A cuatro patas, estiras un brazo y la pierna contraria. El objetivo es no girar la cadera.",
    setup: "Manos bajo hombros, rodillas bajo caderas. Espalda larga.",
    breathe: "Respiración suelta. Nada de bloquear el aire.",
    avoid: ["Subir la pierna más allá de la cadera", "Hundir la lumbar", "Girar el tronco"],
    phases: [
      {
        title: "Cuadrupedia",
        cue: "Peso repartido. Mirada al suelo, cuello largo.",
        pose: BIRD_START,
      },
      {
        title: "Estirar",
        cue: "Brazo al frente, pierna atrás. Cadera a la misma altura.",
        pose: BIRD_REACH,
      },
      {
        title: "Vuelta",
        cue: "Vuelve sin tocar de más y cambia de lado.",
        pose: BIRD_START,
      },
    ],
  },
  carry: {
    id: "carry",
    summary:
      "Caminar con peso en las manos. Hombros bajos, pasos cortos, maletas que no te desequilibran.",
    setup: "Mancuernas o maletas a los lados. Costillas abajo, mirada al frente.",
    breathe: "Respira normal. Si no puedes hablar, el peso es demasiado.",
    avoid: ["Inclinarte a un lado", "Encoger trapecios", "Pasos largos y ruidosos"],
    phases: [
      {
        title: "Agarre",
        cue: "Peso muerto corto: coge las mancuernas con espalda larga.",
        pose: {
          head: p(48, 32),
          shoulder: p(44, 46),
          hip: p(40, 70),
          knee: p(46, 94),
          ankle: p(40, 118),
          toe: p(52, 120),
          elbow: p(48, 72),
          wrist: p(48, 92),
          weight: "db",
        },
      },
      {
        title: "Alto",
        cue: "Estira cadera y rodilla. Hombros lejos de las orejas.",
        pose: pose(STAND, { elbow: p(42, 64), wrist: p(42, 86), weight: "db" }),
      },
      {
        title: "Marcha",
        cue: "Pasos cortos. El peso no debe balancearte.",
        pose: {
          head: p(42, 20),
          shoulder: p(40, 36),
          hip: p(40, 64),
          knee: p(50, 88),
          ankle: p(52, 112),
          toe: p(62, 114),
          kneeB: p(32, 96),
          ankleB: p(28, 118),
          toeB: p(20, 120),
          elbow: p(42, 64),
          wrist: p(42, 86),
          weight: "db",
        },
      },
    ],
  },
  push_iso: {
    id: "push_iso",
    summary:
      "Extiendes el codo contra polea, mancuerna o fondos en silla. El hombro se queda quieto; trabaja el tríceps.",
    setup: "Codos pegados al cuerpo. Pecho alto. En silla, manos al borde y glúteo cerca del asiento.",
    breathe: "Aire al flexionar. Suelta al estirar.",
    avoid: ["Abrir los codos", "Encoger el cuello", "Mover el hombro en vez del codo"],
    phases: [
      {
        title: "Flexión",
        cue: "Codos fijos. Antebrazos cerca del bíceps.",
        pose: {
          head: p(42, 20),
          shoulder: p(40, 36),
          hip: p(40, 64),
          knee: p(41, 92),
          ankle: p(40, 118),
          toe: p(52, 120),
          elbow: p(48, 44),
          wrist: p(40, 52),
          weight: "cable",
        },
      },
      {
        title: "Extensión",
        cue: "Estira el codo sin bloquear de golpe.",
        pose: {
          head: p(42, 20),
          shoulder: p(40, 36),
          hip: p(40, 64),
          knee: p(41, 92),
          ankle: p(40, 118),
          toe: p(52, 120),
          elbow: p(48, 46),
          wrist: p(50, 68),
          weight: "cable",
        },
      },
      {
        title: "Cierre",
        cue: "Aprieta un segundo abajo y vuelve en 2 tiempos.",
        pose: {
          head: p(42, 20),
          shoulder: p(40, 36),
          hip: p(40, 64),
          knee: p(41, 92),
          ankle: p(40, 118),
          toe: p(52, 120),
          elbow: p(48, 48),
          wrist: p(52, 78),
          weight: "cable",
        },
      },
    ],
  },
  pull_iso: {
    id: "pull_iso",
    summary:
      "Tiras de una cuerda o mancuernas hacia la cara, abriendo los omóplatos. Es el antídoto del hombro encogido.",
    setup: "Cuerda a la altura de la cara o mancuernas en bisagra ligera. Pulgares hacia atrás al final.",
    breathe: "Aire con brazos largos. Suelta al tirar.",
    avoid: ["Encoger el cuello", "Archivar lumbar", "Tirar solo de la mano"],
    phases: [
      {
        title: "Brazos largos",
        cue: "Hombros abajo. La cuerda o las mancuernas delante.",
        pose: {
          head: p(46, 24),
          shoulder: p(42, 38),
          hip: p(38, 66),
          knee: p(42, 92),
          ankle: p(40, 118),
          toe: p(52, 120),
          elbow: p(58, 48),
          wrist: p(70, 44),
          weight: "cable",
        },
      },
      {
        title: "Tirón",
        cue: "Codos altos, a la altura de los hombros.",
        pose: {
          head: p(46, 24),
          shoulder: p(42, 38),
          hip: p(38, 66),
          knee: p(42, 92),
          ankle: p(40, 118),
          toe: p(52, 120),
          elbow: p(58, 36),
          wrist: p(62, 28),
          weight: "cable",
        },
      },
      {
        title: "A la cara",
        cue: "La cuerda se abre junto a las orejas. Pausa y suelta lento.",
        pose: {
          head: p(46, 24),
          shoulder: p(42, 38),
          hip: p(38, 66),
          knee: p(42, 92),
          ankle: p(40, 118),
          toe: p(52, 120),
          elbow: p(54, 32),
          wrist: p(50, 22),
          weight: "cable",
        },
      },
    ],
  },
  walk: {
    id: "walk",
    summary:
      "Caminar de verdad: talón, planta, punta. En cinta, una inclinación suave vale más que una velocidad loca.",
    setup: "Postura alta, brazos sueltos. Si es inclinada, 4–8% y un ritmo en el que aún hablas.",
    breathe: "Nariz o boca, da igual: regular. Si no puedes decir una frase, baja el ritmo.",
    avoid: ["Agarrarte a la cinta y echarte atrás", "Pasos que arrastran", "Inclinación máxima desde el minuto 1"],
    phases: [
      {
        title: "Talón",
        cue: "El pie de delante aterriza de talón, debajo de la cadera.",
        pose: WALK_1,
      },
      {
        title: "Apoyo",
        cue: "Peso en el medio del pie. Cadera alta.",
        pose: WALK_2,
      },
      {
        title: "Impulso",
        cue: "Empujas con la punta de atrás y el otro pie adelanta.",
        pose: WALK_3,
      },
    ],
  },
  bike: {
    id: "bike",
    summary:
      "Pedaleo circular, no a golpes. El sillín a una altura en la que la rodilla quede casi estirada abajo.",
    setup: "Sillín a la altura de la cadera de pie. Manos suaves en el manillar, no colgado de él.",
    breathe: "Ritmo constante. En intervalos suaves, el duro dura poco y el fácil recupera de verdad.",
    avoid: ["Sillín demasiado bajo", "Hombros en las orejas", "Solo empujar, nunca tirar del pedal"],
    phases: [
      {
        title: "Punto alto",
        cue: "La rodilla sube sin tocar el pecho.",
        pose: BIKE_1,
      },
      {
        title: "Empuje",
        cue: "Pisas hacia delante y abajo, pie relajado.",
        pose: BIKE_2,
      },
      {
        title: "Punto bajo",
        cue: "Piernas casi larga. La otra ya está subiendo.",
        pose: BIKE_3,
      },
    ],
  },
  cond: {
    id: "cond",
    summary:
      "Trabajo de capacidad: elíptica, circuito 40/20 o marcha en el sitio. El pulso sube, la técnica no se rompe.",
    setup: "40 segundos de trabajo, 20 de respiro, o un ritmo continuo que puedas sostener.",
    breathe: "Por la boca si hace falta, pero sin picos. Tienes que poder decir dos palabras.",
    avoid: ["Sprint all-out si hay antecedente cardíaco o asma", "Perder la postura al cansarte", "Saltar si las rodillas protestan"],
    phases: [
      {
        title: "Postura",
        cue: "Alto, abdomen cerrado, brazos ayudan.",
        pose: pose(STAND, { weight: "none", elbow: p(52, 44), wrist: p(58, 32) }),
      },
      {
        title: "Trabajo",
        cue: "Rodilla arriba o zancada corta. El tronco no se desmorona.",
        pose: {
          head: p(42, 18),
          shoulder: p(40, 34),
          hip: p(40, 62),
          knee: p(52, 78),
          ankle: p(50, 100),
          toe: p(58, 102),
          kneeB: p(30, 94),
          ankleB: p(28, 118),
          toeB: p(18, 120),
          elbow: p(56, 40),
          wrist: p(62, 26),
          weight: "none",
        },
      },
      {
        title: "Respiro",
        cue: "20 segundos más altos, menos rango. Vuelve cuando el aire entra.",
        pose: pose(STAND, { weight: "none", elbow: p(46, 58), wrist: p(48, 74) }),
      },
    ],
  },
  mobility: {
    id: "mobility",
    summary:
      "Cadera y tórax se mueven para que sentadilla y press no compensen. Lento, con respiración, sin rebotes.",
    setup: "Suelo o rodillas. Si hay lumbar sensible, prioriza gato-camello y 90/90.",
    breathe: "Exhala al llegar al rango. El aire abre más que el tirón.",
    avoid: ["Rebotar", "Forzar la rodilla", "Aguantar en un pinchazo"],
    phases: [
      {
        title: "Gato",
        cue: "A cuatro patas, redondea la espalda y mira al ombligo.",
        pose: CAT,
      },
      {
        title: "Camello",
        cue: "Deja caer el pecho, mirada adelante, cuello largo.",
        pose: COW,
      },
      {
        title: "Tórax",
        cue: "Una mano detrás de la cabeza y abres el codo al techo.",
        pose: THORACIC,
      },
    ],
  },
  balance: {
    id: "balance",
    summary:
      "Peso muerto a una pierna: bisagra y equilibrio. La pierna de atrás es un contrapeso, no un adorno.",
    setup: "Apoyo firme. Rodilla de la pierna de suelo un poco flexionada. Manos al peso o a una silla.",
    breathe: "Aire al bajar el tronco. Suelta al volver.",
    avoid: ["Girar la cadera al techo", "Redondear la espalda", "Bloquear la rodilla de apoyo"],
    phases: [
      {
        title: "Apoyo",
        cue: "Todo el peso en un pie. La otra punta apenas toca.",
        pose: {
          head: p(42, 20),
          shoulder: p(40, 36),
          hip: p(40, 64),
          knee: p(42, 92),
          ankle: p(40, 118),
          toe: p(52, 120),
          kneeB: p(38, 88),
          ankleB: p(36, 112),
          toeB: p(34, 114),
          elbow: p(50, 58),
          wrist: p(52, 76),
          weight: "db",
        },
      },
      {
        title: "Bisagra",
        cue: "Tronco adelante, pierna atrás a la misma altura. Cadera cuadrada.",
        pose: {
          head: p(58, 42),
          shoulder: p(50, 50),
          hip: p(40, 68),
          knee: p(44, 94),
          ankle: p(40, 118),
          toe: p(52, 120),
          kneeB: p(28, 62),
          ankleB: p(16, 52),
          toeB: p(8, 48),
          elbow: p(56, 70),
          wrist: p(58, 88),
          weight: "db",
        },
      },
      {
        title: "Cierre",
        cue: "Vuelve empujando el suelo. La cadera se cubre, no se tuerce.",
        pose: pose(STAND, { elbow: p(50, 58), wrist: p(52, 76), weight: "db" }),
      },
    ],
  },
  };
}

const FLOOR_LIE: SidePose = {
  head: p(18, 86),
  shoulder: p(30, 90),
  hip: p(52, 92),
  knee: p(66, 78),
  ankle: p(70, 60),
  toe: p(74, 54),
  elbow: p(32, 102),
  wrist: p(28, 112),
  support: "floor",
  weight: "none",
};

const BRIDGE_MID: SidePose = {
  head: p(18, 84),
  shoulder: p(30, 86),
  hip: p(52, 78),
  knee: p(66, 78),
  ankle: p(70, 92),
  toe: p(78, 94),
  elbow: p(32, 100),
  wrist: p(28, 110),
  support: "floor",
  weight: "none",
};

const BRIDGE_UP: SidePose = {
  head: p(18, 82),
  shoulder: p(30, 84),
  hip: p(52, 64),
  knee: p(66, 80),
  ankle: p(70, 94),
  toe: p(78, 96),
  elbow: p(32, 100),
  wrist: p(28, 110),
  support: "floor",
  weight: "none",
};

const THRUST_DOWN: SidePose = {
  head: p(28, 62),
  shoulder: p(36, 58),
  hip: p(58, 88),
  knee: p(70, 80),
  ankle: p(74, 96),
  toe: p(82, 98),
  elbow: p(40, 70),
  wrist: p(52, 78),
  support: "bench",
  weight: "bar",
};

const THRUST_MID: SidePose = {
  head: p(28, 58),
  shoulder: p(36, 54),
  hip: p(58, 74),
  knee: p(70, 80),
  ankle: p(74, 96),
  toe: p(82, 98),
  elbow: p(40, 66),
  wrist: p(54, 70),
  support: "bench",
  weight: "bar",
};

const THRUST_UP: SidePose = {
  head: p(28, 54),
  shoulder: p(36, 50),
  hip: p(58, 52),
  knee: p(70, 78),
  ankle: p(74, 96),
  toe: p(82, 98),
  elbow: p(40, 60),
  wrist: p(54, 56),
  support: "bench",
  weight: "bar",
};

const PRESS_UP: SidePose = {
  head: p(22, 62),
  shoulder: p(34, 64),
  hip: p(56, 66),
  knee: p(68, 78),
  ankle: p(70, 94),
  toe: p(78, 96),
  elbow: p(36, 42),
  wrist: p(36, 24),
  support: "bench",
  weight: "db",
};

const PRESS_MID: SidePose = {
  head: p(22, 62),
  shoulder: p(34, 64),
  hip: p(56, 66),
  knee: p(68, 78),
  ankle: p(70, 94),
  toe: p(78, 96),
  elbow: p(22, 52),
  wrist: p(18, 38),
  support: "bench",
  weight: "db",
};

const PRESS_DOWN: SidePose = {
  head: p(22, 62),
  shoulder: p(34, 64),
  hip: p(56, 66),
  knee: p(68, 78),
  ankle: p(70, 94),
  toe: p(78, 96),
  elbow: p(20, 70),
  wrist: p(18, 58),
  support: "bench",
  weight: "db",
};

const PUSH_UP: SidePose = {
  head: p(18, 70),
  shoulder: p(30, 68),
  hip: p(54, 70),
  knee: p(68, 72),
  ankle: p(80, 74),
  toe: p(88, 72),
  elbow: p(28, 82),
  wrist: p(22, 92),
  support: "floor",
  weight: "none",
};

const PUSH_MID: SidePose = {
  head: p(18, 78),
  shoulder: p(30, 76),
  hip: p(54, 78),
  knee: p(68, 80),
  ankle: p(80, 80),
  toe: p(88, 78),
  elbow: p(24, 86),
  wrist: p(20, 94),
  support: "floor",
  weight: "none",
};

const PUSH_DOWN: SidePose = {
  head: p(18, 86),
  shoulder: p(30, 84),
  hip: p(54, 86),
  knee: p(68, 86),
  ankle: p(80, 84),
  toe: p(88, 82),
  elbow: p(22, 90),
  wrist: p(18, 96),
  support: "floor",
  weight: "none",
};

const ROW_HANG: SidePose = {
  head: p(58, 42),
  shoulder: p(50, 50),
  hip: p(36, 62),
  knee: p(48, 86),
  ankle: p(42, 118),
  toe: p(54, 120),
  kneeB: p(28, 78),
  ankleB: p(24, 70),
  toeB: p(32, 68),
  elbow: p(62, 68),
  wrist: p(64, 86),
  support: "bench",
  weight: "db",
};

const ROW_MID: SidePose = {
  ...ROW_HANG,
  elbow: p(56, 58),
  wrist: p(52, 70),
};

const ROW_TOP: SidePose = {
  ...ROW_HANG,
  elbow: p(48, 52),
  wrist: p(42, 60),
};

const INV_HANG: SidePose = {
  head: p(22, 78),
  shoulder: p(34, 72),
  hip: p(58, 76),
  knee: p(72, 80),
  ankle: p(84, 86),
  toe: p(92, 88),
  elbow: p(32, 60),
  wrist: p(30, 48),
  support: "none",
  weight: "bar",
};

const INV_MID: SidePose = {
  ...INV_HANG,
  head: p(24, 68),
  shoulder: p(36, 62),
  hip: p(58, 70),
  elbow: p(38, 54),
  wrist: p(32, 46),
};

const INV_TOP: SidePose = {
  ...INV_HANG,
  head: p(26, 58),
  shoulder: p(38, 52),
  hip: p(58, 64),
  elbow: p(42, 48),
  wrist: p(34, 44),
};

const PULL_TOP: SidePose = {
  head: p(44, 36),
  shoulder: p(42, 50),
  hip: p(42, 78),
  knee: p(48, 100),
  ankle: p(42, 118),
  toe: p(54, 120),
  elbow: p(56, 28),
  wrist: p(58, 12),
  support: "bench",
  weight: "cable",
};

const PULL_MID: SidePose = {
  ...PULL_TOP,
  elbow: p(54, 40),
  wrist: p(52, 24),
};

const PULL_DOWN: SidePose = {
  ...PULL_TOP,
  elbow: p(50, 52),
  wrist: p(46, 40),
};

const PLANK: SidePose = {
  head: p(18, 74),
  shoulder: p(32, 72),
  hip: p(56, 74),
  knee: p(70, 76),
  ankle: p(82, 78),
  toe: p(90, 76),
  elbow: p(30, 86),
  wrist: p(22, 90),
  support: "floor",
  weight: "none",
};

const BIRD_START: SidePose = {
  head: p(24, 62),
  shoulder: p(34, 70),
  hip: p(54, 70),
  knee: p(56, 90),
  ankle: p(54, 108),
  toe: p(64, 110),
  elbow: p(32, 88),
  wrist: p(24, 102),
  support: "floor",
  weight: "none",
};

const BIRD_REACH: SidePose = {
  head: p(18, 58),
  shoulder: p(34, 68),
  hip: p(54, 68),
  knee: p(70, 62),
  ankle: p(82, 58),
  toe: p(90, 56),
  kneeB: p(56, 90),
  ankleB: p(54, 108),
  toeB: p(64, 110),
  elbow: p(22, 60),
  wrist: p(10, 56),
  elbowB: p(32, 88),
  wristB: p(24, 102),
  support: "floor",
  weight: "none",
};

const WALK_1: SidePose = {
  head: p(42, 20),
  shoulder: p(40, 36),
  hip: p(40, 64),
  knee: p(54, 90),
  ankle: p(58, 118),
  toe: p(68, 120),
  kneeB: p(28, 92),
  ankleB: p(22, 110),
  toeB: p(14, 108),
  elbow: p(54, 48),
  wrist: p(62, 40),
  elbowB: p(30, 52),
  wristB: p(24, 64),
  weight: "none",
};

const WALK_2: SidePose = {
  head: p(42, 20),
  shoulder: p(40, 36),
  hip: p(40, 64),
  knee: p(44, 92),
  ankle: p(42, 118),
  toe: p(54, 120),
  kneeB: p(32, 88),
  ankleB: p(26, 108),
  toeB: p(18, 110),
  elbow: p(50, 50),
  wrist: p(56, 44),
  weight: "none",
};

const WALK_3: SidePose = {
  head: p(42, 20),
  shoulder: p(40, 36),
  hip: p(40, 64),
  knee: p(34, 86),
  ankle: p(24, 108),
  toe: p(16, 106),
  kneeB: p(52, 90),
  ankleB: p(56, 118),
  toeB: p(66, 120),
  elbow: p(28, 50),
  wrist: p(22, 62),
  elbowB: p(54, 46),
  wristB: p(62, 36),
  weight: "none",
};

const BIKE_1: SidePose = {
  head: p(50, 28),
  shoulder: p(44, 42),
  hip: p(40, 70),
  knee: p(58, 62),
  ankle: p(62, 78),
  toe: p(70, 80),
  kneeB: p(48, 88),
  ankleB: p(52, 104),
  toeB: p(60, 106),
  elbow: p(56, 54),
  wrist: p(66, 50),
  support: "bench",
  weight: "none",
};

const BIKE_2: SidePose = {
  ...BIKE_1,
  knee: p(56, 78),
  ankle: p(60, 94),
  toe: p(68, 96),
  kneeB: p(50, 70),
  ankleB: p(54, 86),
  toeB: p(62, 88),
};

const BIKE_3: SidePose = {
  ...BIKE_1,
  knee: p(48, 90),
  ankle: p(52, 108),
  toe: p(60, 110),
  kneeB: p(58, 64),
  ankleB: p(62, 80),
  toeB: p(70, 82),
};

const CAT: SidePose = {
  head: p(22, 78),
  shoulder: p(34, 68),
  hip: p(56, 66),
  knee: p(58, 88),
  ankle: p(56, 108),
  toe: p(66, 110),
  elbow: p(32, 86),
  wrist: p(24, 100),
  support: "floor",
  weight: "none",
};

const COW: SidePose = {
  head: p(20, 58),
  shoulder: p(34, 70),
  hip: p(56, 72),
  knee: p(58, 90),
  ankle: p(56, 108),
  toe: p(66, 110),
  elbow: p(32, 88),
  wrist: p(24, 102),
  support: "floor",
  weight: "none",
};

const THORACIC: SidePose = {
  head: p(28, 50),
  shoulder: p(36, 66),
  hip: p(56, 70),
  knee: p(58, 90),
  ankle: p(56, 108),
  toe: p(66, 110),
  elbow: p(48, 44),
  wrist: p(42, 36),
  elbowB: p(32, 88),
  wristB: p(24, 102),
  support: "floor",
  weight: "none",
};

const GUIDES = createGuides();

const RULES: [RegExp, string][] = [
  [/bird-?dog|dead bug|diafragm/i, "bird_dog"],
  [/step-?up/i, "step_up"],
  [/hack squat|smith/i, "squat"],
  [/prensa/i, "squat_box"],
  [/caj[oó]n/i, "squat_box"],
  [/extensi[oó]n de cu[aá]driceps/i, "squat"],
  [/curl femoral|abductor|aductor/i, "glute_bridge"],
  [/hip thrust/i, "hip_thrust"],
  [/puente/i, "glute_bridge"],
  [/good morning|banco romano|hiperextensi/i, "hinge"],
  [/flexi[oó]n|push-?up|pike/i, "pushup"],
  [/fondo/i, "push_iso"],
  [/invertido|superman/i, "inverted_row"],
  [/sentadilla/i, "squat"],
  [/zancada/i, "lunge"],
  [/peso muerto a una|una pierna/i, "balance"],
  [/rumano|peso muerto/i, "hinge"],
  [/peck|mariposa|cruces en polea|aperturas/i, "press"],
  [/press de suelo|press banca|press de/i, "press"],
  [/militar|ohp/i, "ohp"],
  [/jal[oó]n|dominada/i, "pull"],
  [/face pull|p[aá]jaro|rear delt/i, "pull_iso"],
  [/remo sentado|remo en polea/i, "row"],
  [/remo/i, "row"],
  [/curl de b[ií]ceps|scott/i, "pull_iso"],
  [/tr[ií]ceps|press franc[eé]s|polea/i, "push_iso"],
  [/plancha|pallof|crunch/i, "plank"],
  [/granjero|maleta|mochila|paseo/i, "carry"],
  [/el[ií]ptica|escaladora|remoerg|circuito|40\/20|saltos|marcha en el sitio/i, "cond"],
  [/bici|ciclismo/i, "bike"],
  [/caminata|walk|cinta/i, "walk"],
  [/movilidad|gato/i, "mobility"],
];

const GENERIC: ExerciseGuide = {
  id: "generic",
  summary: "Muévete con control, rango cómodo y una respiración que no se corte.",
  setup: "Empieza con menos carga de la que crees. La última repetición debe ser limpia.",
  breathe: "No aguantes el aire. Si hay molestia aguda, para.",
  avoid: ["Tirones", "Dolor que cambia el gesto", "Perder la postura al cansarte"],
  phases: GUIDES.squat.phases.map((phase, i) => ({
    ...phase,
    pose: { ...phase.pose, weight: "none" },
    title: ["Inicio", "Recorrido", "Cierre"][i],
  })),
};

export function getExerciseGuide(name: string, sex?: Sex | null): ExerciseGuide {
  const folder = guidePhotoSex(sex);
  for (const [pattern, id] of RULES) {
    if (pattern.test(name) && GUIDES[id]) {
      const guide = GUIDES[id];
      return { ...guide, ...mediaFor(id, folder) };
    }
  }
  return { ...GENERIC, ...mediaFor("generic", folder) };
}
