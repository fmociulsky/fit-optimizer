import { GOAL_LABEL, weekdayName } from "./labels";
import { ageBand, profileAge } from "./metrics";
import type {
  CheckIn,
  Goal,
  Intensity,
  MedicalFlag,
  MindFocus,
  MindPrefs,
  Plan,
  Profile,
} from "./types";

export const MIND_PROFESSIONAL_WARNING =
  "Esto no es psicoterapia ni un tratamiento de salud mental. Es un hábito de atención, como el entreno: una guía, no un diagnóstico.";

export const MIND_WARNING_DETAIL =
  "Si hay ansiedad intensa, depresión, insomnio que no te deja, o te sientes en crisis, habla con un profesional. En urgencia, pide ayuda inmediata (en España, 024 o emergencias).";

export const MIND_ACCEPTANCE_TEXT =
  "He leído el aviso. Acepto usar estas prácticas como guía, bajo mi responsabilidad, y sé que no sustituyen a un profesional de la salud mental.";

export const MIND_FOCUS_OPTIONS: { id: MindFocus; label: string; hint: string }[] = [
  { id: "sleep", label: "Dormir mejor", hint: "Misma hora de cama y menos pantallas por la noche" },
  { id: "stress", label: "Bajar el estrés", hint: "Algo concreto a lo que volver cuando vas acelerado" },
  { id: "focus", label: "Atención en el entreno", hint: "Estar en la serie, no en el móvil" },
  { id: "consistency", label: "Constancia", hint: "Si un día no sale el plan entero, hacer un mínimo y no desaparecer" },
  { id: "body", label: "Relación con el cuerpo", hint: "Notar fatiga o tensión, no repetir “estoy gordo” o “no valgo”" },
];

export type MindPractice = {
  id: string;
  title: string;
  minutes: number;
  when: string;
  what: string;
  setup: string[];
  steps: string[];
  ifStuck: { ifThis: string; then: string }[];
  doneWhen: string;
  why: string;
};

export type MindDay = {
  weekday: number;
  trainingName: string | null;
  note: string;
  practices: MindPractice[];
};

export type MindGuide = {
  summary: string;
  principles: string[];
  todayNote: string;
  today: MindPractice[];
  week: MindDay[];
  medical: string[];
};

function hasFlag(flags: MedicalFlag[], flag: MedicalFlag) {
  return flags.includes(flag) && !flags.includes("none");
}

function wants(prefs: MindPrefs, focus: MindFocus) {
  return !prefs.focuses.length || prefs.focuses.includes(focus);
}

function conservativeBreath(profile: Profile) {
  return (
    hasFlag(profile.medicalFlags, "cardiac") ||
    hasFlag(profile.medicalFlags, "hypertension") ||
    hasFlag(profile.medicalFlags, "asthma") ||
    hasFlag(profile.medicalFlags, "pregnancy")
  );
}

function seatedBias(profile: Profile) {
  return (
    profileAge(profile) >= 60 ||
    hasFlag(profile.medicalFlags, "knee_hip") ||
    hasFlag(profile.medicalFlags, "back_pain") ||
    hasFlag(profile.medicalFlags, "pregnancy")
  );
}

function breathPractice(profile: Profile): MindPractice {
  const easy = conservativeBreath(profile);
  if (easy) {
    return {
      id: "breath-easy",
      title: "Respirar más lento (contar 4 y 6)",
      minutes: 3,
      when: "Justo al terminar de entrenar, o en cualquier momento si te notas nervioso, acelerado o con el corazón a mil.",
      what: "Es solo contar mientras respiras: 4 al inspirar, 6 al soltar. No hay que “vaciar la mente”. El objetivo es que el cuerpo note que no hay prisa.",
      setup: [
        "Siéntate en una silla, con la espalda apoyada y los pies en el suelo. Si estás de pie, párate quieto y suelta los hombros.",
        "Pon un temporizador de 3 minutos en el móvil (puedes dejar la pantalla hacia abajo).",
        "Cierra la boca. Vas a respirar por la nariz si puedes. Si estás congestionado, la boca vale.",
      ],
      steps: [
        "Inspira por la nariz mientras cuentas despacio: 1, 2, 3, 4. El pecho y la tripa se hinchan un poco. No fuerces como si hincharas un globo.",
        "Sin parar con el aire dentro, suelta el aire por la nariz o la boca contando: 1, 2, 3, 4, 5, 6. Que salga más lento de lo que entró.",
        "Eso es una ronda. Haz 8 o 10 rondas, o hasta que suene el temporizador.",
        "Si te despistas (pasará), no empieces de cero con bronca. En la siguiente respiración vuelves a contar.",
      ],
      ifStuck: [
        {
          ifThis: "Te mareas, te falta el aire o te sientes raro",
          then: "Para. Respira normal. Esto no se aguanta “a ver si se me pasa”.",
        },
        {
          ifThis: "No sabes si cuentas bien",
          then: "Da igual el ritmo perfecto. Que el aire de salida dure un poco más que el de entrada.",
        },
      ],
      doneWhen: "Han pasado ~3 minutos o has hecho unas 8–10 respiraciones lentas. Te levantas y sigues el día.",
      why: "Cuando estás tenso, la respiración se hace corta y rápida. Alargar el aire de salida le dice al cuerpo que puede bajar el ritmo. No es magia: es un freno que puedes repetir.",
    };
  }
  return {
    id: "breath-box",
    title: "Respirar en cuatro tiempos",
    minutes: 3,
    when: "Justo al terminar de entrenar, o si te notas acelerado a media tarde.",
    what: "Respiras como un cuadrado: inspirar, una pausa corta, soltar, otra pausa corta. Cada lado dura lo mismo. Si las pausas te ponen tenso, las quitas (eso también vale).",
    setup: [
      "Siéntate o quédate de pie, quieto. Hombros lejos de las orejas.",
      "Temporizador de 3 minutos. No hace falta música ni app especial.",
    ],
    steps: [
      "Inspira por la nariz contando 4 (un número por segundo, más o menos).",
      "Quédate con el aire 2 segundos. Suave, no como si bucearas. La cara y el cuello no se ponen duros.",
      "Suelta el aire contando 4.",
      "Quédate vacío 2 segundos (sin forzar el “no hay aire”).",
      "Repite ese ciclo hasta que suene el temporizador.",
    ],
    ifStuck: [
      {
        ifThis: "Aguantar el aire te pone nervioso o te sube la tensión",
        then: "Quita las pausas. Inspira en 4 y suelta en 6, sin parar. Eso es suficiente.",
      },
      {
        ifThis: "Te mareas",
        then: "Para y respira normal. No “aguantes un poco más”.",
      },
    ],
    doneWhen: "Han pasado 2–3 minutos. No busques un subidón: con haber respirado más despacio, ya está.",
    why: "Contar te da algo concreto a lo que volver cuando la cabeza se va a otra cosa. Es un freno, no un trance.",
  };
}

function sitPractice(profile: Profile): MindPractice {
  const age = profileAge(profile);
  const minutes = age >= 60 ? 5 : age < 30 ? 4 : 6;
  const posture = seatedBias(profile)
    ? "Siéntate en una silla con respaldo. Pies apoyados en el suelo, manos en los muslos. No hace falta cruzar las piernas ni sentarte en el suelo."
    : "Siéntate en una silla, o en un cojín en el suelo si te resulta cómodo. La espalda está derecha pero no rígida: como si un hilo te subiera la coronilla, sin sacar pecho de más.";
  return {
    id: "sit",
    title: `Estar quieto ${minutes} minutos`,
    minutes,
    when: "Por la mañana, o al volver del entreno, antes de meterte en el sofá o el móvil.",
    what: "Te sientas, pones un temporizador y no haces nada más. No es “dejar la mente en blanco” (eso casi nadie lo consigue). Es notar que estás aquí, y cuando te vayas a otra cosa, volver.",
    setup: [
      posture,
      `Pon un temporizador de ${minutes} minutos. El móvil en silencio, pantalla hacia abajo.`,
      "Elige: ojos cerrados, o abiertos mirando un punto en el suelo a un metro. No mires gente ni la tele.",
    ],
    steps: [
      "Empieza el temporizador. Nota tres cosas: el contacto del culo con la silla, los pies en el suelo, el aire que entra por la nariz.",
      "Elige una sensación a la que volver (como el punto de una sentadilla): el aire en la nariz, o la tripa que sube y baja. Quédate ahí. No hace falta respirar de una forma especial.",
      "En algún momento vas a pensar en la cena, en una bronca, en el entreno. Eso es normal. No es que “lo estés haciendo mal”.",
      "Cuando te des cuenta de que te has ido, nómbralo por dentro: “pensando”. Y vuelve al aire. Sin bronca, como cuando vuelves a la serie después de un descanso.",
      "Si te pica, te pica. Si tragas saliva, tragas. No te conviertas en estatua. Solo no te levantes hasta que suene el timer.",
    ],
    ifStuck: [
      {
        ifThis: "Esto es aburrido y quiero parar al minuto",
        then: "El aburrimiento forma parte. Quédate hasta que suene. Si hace falta, baja a 3 minutos la próxima vez, pero acaba el timer de hoy.",
      },
      {
        ifThis: "Me entro de sueño",
        then: "Abre los ojos y mira un punto en el suelo. O hazlo de pie, apoyado en la pared.",
      },
      {
        ifThis: "La cabeza no para ni un segundo",
        then: "No tiene que parar. El ejercicio es darte cuenta y volver, una y otra vez. Eso ya es haberlo hecho.",
      },
    ],
    doneWhen: `Suena el temporizador. Abre los ojos, muévete un poco, bebe agua y pasa a lo siguiente. No hace falta puntuar si “meditaste bien”.`,
    why: "El “músculo” no es quedarte zen. Es volver. Cada vez que te das cuenta de que estabas en las nubes y regresas al aire, has hecho una repetición.",
  };
}

function bodyPractice(profile: Profile): MindPractice {
  const floorOk = !seatedBias(profile);
  return {
    id: "body-scan",
    title: floorOk ? "Notar el cuerpo, de los pies a la cabeza" : "Notar el cuerpo, sentado",
    minutes: 6,
    when: "Después de entrenar (cuando aún sientes las piernas o los brazos) o por la noche en la cama, si no te duermes en seguida.",
    what: "Vas recorriendo el cuerpo por partes, como pasando lista: pies, pantorrillas, rodillas… hasta la cara. En cada zona solo preguntas: ¿qué hay? Tensión, calor, nada, molestia. No hay que relajar a la fuerza ni “enviar luz”.",
    setup: [
      floorOk
        ? "Túmbate boca arriba en la cama o en una esterilla. Si la zona lumbar molesta, dobla las rodillas y planta los pies. Brazos a los lados."
        : "Siéntate en una silla. Pies en el suelo. Manos sobre los muslos. No te tumbes si te cuesta luego levantarte.",
      "Temporizador de 6 minutos. Ropa cómoda. Si tienes frío, una manta.",
    ],
    steps: [
      "Cierra los ojos o deja la mirada baja. Haz dos respiraciones normales.",
      "Empieza por los pies. ¿Notas calcetines, el suelo, hormigueo, nada? Quédate 10–15 segundos. No hace falta que “pasen cosas”.",
      "Sube despacio: pantorrillas, rodillas, muslos, caderas, tripa, pecho, manos, brazos, hombros, cuello, cara. En cada zona, la misma pregunta: ¿qué siento aquí, ahora?",
      "Si aparece una zona que duele por el entreno (agujetas, fatiga), solo nómbrala: “cansancio”, “presión”. No estires ni masajees en este rato.",
      "Si aparece el dolor de una lesión conocida y se parece al de siempre, no lo persigas. Di “molestia”, salta esa zona y sigue.",
      "Al final, nota el cuerpo entero un momento. Tres respiraciones un poco más largas. Abre los ojos y siéntate antes de levantarte.",
    ],
    ifStuck: [
      {
        ifThis: "No siento nada en muchas zonas",
        then: "Eso también es información. Di “nada” y pasa a la siguiente. No hay que inventar sensaciones.",
      },
      {
        ifThis: "Empiezo a juzgarme (“qué barriga”, “qué flojo”)",
        then: "Ese es un pensamiento, no un dato. Vuelve a la sensación física: temperatura, contacto, peso.",
      },
      {
        ifThis: "El dolor de la lesión se dispara",
        then: "Para. Siéntate. Haz solo la respiración lenta. Y si se parece a tu lesión, coméntalo con tu profesional.",
      },
    ],
    doneWhen: "Has llegado a la cara o ha sonado el timer. Te sientas un segundo y te levantas sin prisa.",
    why: "El cuerpo manda señales (calor, tensión, fatiga). Las frases del tipo “estoy gordo”, “estoy roto” o “no valgo” no son señales: son opiniones. Esta práctica entrena a distinguir las dos.",
  };
}

function preLiftPractice(): MindPractice {
  return {
    id: "pre-lift",
    title: "Una frase antes de la primera serie dura",
    minutes: 1,
    when: "En el gimnasio o en casa, cuando ya has calentado y vas a empezar el ejercicio más importante del día (sentadilla, press, peso muerto, lo que toque).",
    what: "Eliges una sola frase corta que te recuerde cómo quieres moverte, la dices por dentro, y empiezas. No es un discurso motivacional ni un vídeo. Es un recordatorio de técnica.",
    setup: [
      "Deja el móvil en la taquilla, en la mochila o boca abajo, lejos de las manos.",
      "Elige la frase según el ejercicio. Ejemplos: “rodillas hacia afuera” en sentadilla, “costillas abajo” en un press, “empujo el suelo” en un peso muerto, “exhalo al empujar”. Una sola.",
    ],
    steps: [
      "Ponte delante de la barra, las mancuernas o la máquina. Aún no cargas el movimiento.",
      "Di la frase en voz baja o por dentro. Una vez.",
      "Inspira por la nariz, suelta un poco de aire. Los hombros bajan.",
      "Haz la primera serie. Si entre series te pica el móvil, no. La frase otra vez, y la siguiente serie.",
    ],
    ifStuck: [
      {
        ifThis: "No se me ocurre ninguna frase",
        then: "Usa esta: “despacio en la bajada”. Sirve para casi todo.",
      },
      {
        ifThis: "Se me olvida a la tercera serie",
        then: "Normal. Vuelves a decirla. El ejercicio es acordarte, no ser un robot.",
      },
    ],
    doneWhen: "Has hecho la primera serie de verdad, sin el móvil en la mano. El resto de la sesión ya está en marcha.",
    why: "Si entre series miras el teléfono, la cabeza se va y la técnica se descuida. Una frase te deja en el cuerpo, que es donde está el entreno.",
  };
}

function walkPractice(): MindPractice {
  return {
    id: "walk",
    title: "Paseo de 10–15 minutos sin mirar el móvil",
    minutes: 12,
    when: "En un día sin entreno, o si anoche dormiste mal y no te apetece “compensar” con más café y más pantallas.",
    what: "Sales a andar a un ritmo en el que podrías hablar. El móvil no se mira. No es cardio, no es un entrenamiento extra: es moverte y que la cabeza baje un cambio.",
    setup: [
      "Zapatillas cómodas. Chaqueta si hace falta. Agua opcional.",
      "El móvil en el bolsillo, en silencio o en “no molestar”. No es un podcast ni un recado andando.",
      "Una vuelta a la manzana, un parque, un pasillo largo si llueve. Da igual el sitio mientras puedas andar 10 minutos seguidos.",
    ],
    steps: [
      "Sal. Anda como si fueras a hablar con alguien al lado: no corras, no te pares a cada 20 metros.",
      "Los primeros 2 minutos, solo llega. Nota el aire en la cara y cómo pisan los pies.",
      "Luego cuenta 10 pasos notando la planta del pie (talón, medio, dedos). Al 10, suelta la cuenta y anda normal.",
      "Si te pica el móvil, nómbralo: “ganas de mirar”. No lo saques. Sigue andando hasta cumplir el tiempo.",
      "Vuelve a casa. Un vaso de agua. Ya está.",
    ],
    ifStuck: [
      {
        ifThis: "Hace mal tiempo o no puedo salir",
        then: "Anda en casa: pasillo, o 10 minutos al sitio levantando un poco las rodillas. Sigue sin pantalla.",
      },
      {
        ifThis: "Me aburro y acelero para “hacerlo útil”",
        then: "Baja el ritmo. Si puedes cantar una frase, vas bien. Si jadeas, vas demasiado fuerte para este rato.",
      },
    ],
    doneWhen: "Han pasado 10–15 minutos andando y no has abierto el móvil. No hace falta haber “pensado en nada especial”.",
    why: "El descanso del plan no es hundirte en el sofá con la pantalla. Un paseo corto mueve el cuerpo sin exigir rendimiento.",
  };
}

function sleepPractice(profile: Profile): MindPractice {
  const minutes = profileAge(profile) >= 60 ? 12 : 10;
  return {
    id: "wind-down",
    title: "Rutina para irte a dormir",
    minutes,
    when: "Empieza 30 o 40 minutos antes de la hora a la que quieres estar en la cama. Todos los días a la misma hora, también el fin de semana si puedes.",
    what: "No es un truco para dormirte en 30 segundos. Es repetir las mismas acciones cada noche para que el cuerpo entienda: ahora toca parar. Luz más baja, menos pantallas, y una respiración lenta o notar el cuerpo.",
    setup: [
      "Decide ya la hora de cama (ejemplo: 23:00). Esta rutina empieza a las 22:20 o 22:30.",
      "Baja las luces de casa. Si puedes, evita techos muy blancos.",
      "El teléfono fuera del dormitorio, o al menos cargando lejos de la almohada, en silencio.",
    ],
    steps: [
      "Haz siempre el mismo orden: baño o ducha si toca, lavarse los dientes, un vaso de agua, ropa de dormir.",
      "Siéntate o túmbate. 5 minutos de respiración lenta: inspiras contando 4, sueltas contando 6. Sin aguantar el aire.",
      "Si prefieres, en vez de contar, recorre el cuerpo de los pies a la cara (como en la práctica de “notar el cuerpo”).",
      "Métete en la cama a la hora que dijiste. Luz apagada. No hace falta “conseguir” el sueño. El trabajo ya fue parar.",
      "Si a los 20 minutos sigues igual de despierto, levántate. Haz algo aburrido a media luz: doblar ropa, leer papel. Nada de móvil, series ni cocina de premio. Cuando te entre sueño, vuelve a la cama.",
    ],
    ifStuck: [
      {
        ifThis: "“Ya me acostaré cuando me caiga”",
        then: "Eso alarga el día y descuadra el reloj interno. La hora se respeta aunque no tengas sueño de golpe.",
      },
      {
        ifThis: "Me despierto a las 4 y ya no pego ojo",
        then: "Misma regla: cama si hay sueño, levantarte a algo aburrido si no. Evita mirar la hora cada dos minutos.",
      },
    ],
    doneWhen: `Has hecho la secuencia (${minutes} min o el baño + respiración) y estás en la cama a la hora prevista. Dormirte del todo no es el “resultado” de esta práctica; es lo que a veces llega después.`,
    why: "El sueño responde a horarios repetidos, no a un truco distinto cada noche. Esta rutina es el calentamiento de irse a dormir.",
  };
}

function consistencyPractice(): MindPractice {
  return {
    id: "tiny-win",
    title: "El mínimo de hoy (cuando no te apetece nada)",
    minutes: 2,
    when: "Si hoy el plan se te atraganta: poco sueño, mal día, o ganas de saltártelo “y ya mañana lo hago doble”.",
    what: "Bajas el listón a algo tan pequeño que sí puedes hacerlo en los próximos 20 minutos. Lo haces. Lo marcas. Mañana no “pagas” con el doble.",
    setup: [
      "Papel, notas del móvil o la app. Una sola línea. Reloj a la vista.",
    ],
    steps: [
      "Escribe: “Hoy el mínimo es: ___”. Tiene que caber en 10–15 minutos. Ejemplos: el paseo de 10 min, las 8 respiraciones lentas, solo el calentamiento del entreno, o 10 sentadillas junto a una silla.",
      "No vale “entrenar entero” si sabes que no va a pasar. Tampoco vale “nada”. Elige el más pequeño que aún sea real.",
      "Hazlo en los siguientes 20 minutos. No lo dejes “para más tarde”.",
      "Márcalo (aquí, en un papel, donde sea). Cierra. El día ya tiene un punto.",
      "Mañana vuelves al plan normal. No haces el doble para compensar.",
    ],
    ifStuck: [
      {
        ifThis: "Me da vergüenza que el mínimo sea tan pequeño",
        then: "Pequeño y hecho gana a grande e imaginado. Mañana hay otro día del plan.",
      },
      {
        ifThis: "Al empezar el mínimo me entra gana de hacer más",
        then: "Puedes seguir un poco, pero no conviertas esto en un entreno heroico. El objetivo de hoy era no romper la racha.",
      },
    ],
    doneWhen: "El mínimo está hecho y anotado. Aunque el resto del día se desmonte, esta línea cuenta.",
    why: "Dejar de hacer “el plan perfecto” un día no es el problema. El problema es desaparecer tres días. Un mínimo mantiene el hilo.",
  };
}

function pickPractices(
  profile: Profile,
  goal: Goal,
  prefs: MindPrefs,
  training: boolean,
  intensity: Intensity | null,
  lastCheck: CheckIn | undefined
): MindPractice[] {
  const list: MindPractice[] = [];
  const sleepLow = (lastCheck?.sleep ?? 3) <= 2;
  const energyLow = (lastCheck?.energy ?? 3) <= 2;

  if (training) {
    if (wants(prefs, "focus") || goal.type === "strength") list.push(preLiftPractice());
    list.push(breathPractice(profile));
    if (wants(prefs, "body") || intensity === "high") list.push(bodyPractice(profile));
    else list.push(sitPractice(profile));
  } else {
    if (wants(prefs, "stress") || wants(prefs, "sleep") || sleepLow) {
      list.push(breathPractice(profile));
    }
    list.push(walkPractice());
    list.push(sitPractice(profile));
    if (wants(prefs, "body")) list.push(bodyPractice(profile));
  }

  if (wants(prefs, "sleep") || sleepLow) list.push(sleepPractice(profile));
  if (wants(prefs, "consistency") || energyLow || goal.type === "health") {
    list.push(consistencyPractice());
  }

  const seen = new Set<string>();
  return list.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  }).slice(0, 4);
}

export function emptyMindPrefs(): MindPrefs {
  return { focuses: ["stress"], notes: "" };
}

export function buildMindGuide(input: {
  profile: Profile;
  goal: Goal;
  plan: Plan;
  prefs: MindPrefs;
  lastCheck?: CheckIn;
  weekday?: number;
}): MindGuide {
  const { profile, goal, plan, prefs, lastCheck } = input;
  const age = profileAge(profile);
  const band = ageBand(age);
  const weekday = input.weekday ?? new Date().getDay();
  const todayWorkout = plan.weeklySplit.find((day) => day.weekday === weekday) ?? null;

  const week: MindDay[] = [1, 2, 3, 4, 5, 6, 0].map((day) => {
    const workout = plan.weeklySplit.find((item) => item.weekday === day) ?? null;
    const practices = pickPractices(
      profile,
      goal,
      prefs,
      Boolean(workout),
      workout?.intensity ?? null,
      lastCheck
    );
    return {
      weekday: day,
      trainingName: workout?.name ?? null,
      note: workout
        ? `${weekdayName(day)} hay sesión (${workout.name}). Antes: una frase de técnica. Después: respirar más lento o notar el cuerpo.`
        : `${weekdayName(day)} no hay entreno. Un paseo sin móvil o unos minutos sentado quieto. No es “hacer nada”: es recuperar también la cabeza.`,
      practices,
    };
  });

  const today = week.find((day) => day.weekday === weekday) ?? week[0];
  const principles = [
    "Hecho en 5 minutos gana a “un día de estos hago media hora”.",
    "La cabeza se va a otra cosa. Eso no es fallar. Fallar sería no volver. Cada vez que vuelves al aire o a los pies, has hecho una repetición.",
    goal.type === "fat_loss"
      ? "El número de la báscula es un dato, como las horas de sueño. No es un veredicto de si vales o no."
      : goal.type === "muscle_gain" || goal.type === "strength"
        ? "Ganar músculo o fuerza pide semanas. La cabeza también: no hay un atajo de “motivación” que sustituya repetir."
        : "Moverte y dormir es salud. Estos minutos de atención van en el mismo bloque, no son un extra si sobra tiempo.",
    band === "senior"
      ? "Sentado en una silla vale. Lo que cuenta es repetirlo, no la postura de postal."
      : band === "young"
        ? "Que sea corto. Si te pides 30 minutos, lo más probable es que no lo hagas."
        : "Ponlo pegado al entreno (antes o después). “Cuando tenga un rato” casi nunca llega.",
  ];

  const medical: string[] = [];
  if (conservativeBreath(profile)) {
    medical.push(
      "Con hipertensión, asma, antecedente cardíaco o embarazo: respiración sin aguantar el aire. Si mareas, paras."
    );
  }
  if (hasFlag(profile.medicalFlags, "recent_injury") || hasFlag(profile.medicalFlags, "back_pain")) {
    medical.push(
      "Si un recorrido del cuerpo reproduce el dolor de la lesión, cambia a respiración sentado y consulta a tu profesional."
    );
  }
  if (prefs.notes.trim()) {
    medical.push(`Anotaste: “${prefs.notes.trim()}”. Úsalo como recordatorio, no como diagnóstico.`);
  }

  const sleepLow = (lastCheck?.sleep ?? 3) <= 2;
  const todayNote = todayWorkout
    ? sleepLow
      ? `Hoy toca ${todayWorkout.name} y el último check-in de sueño salió bajo. Si hace falta, acorta el entreno. No te saltes la respiración lenta al acabar.`
      : `Hoy toca ${todayWorkout.name}. Lee la práctica, hazla tal cual está escrita (temporizador incluido) y sigue. No hay que “sentir nada especial”.`
    : sleepLow
      ? "Hoy no hay entreno y el sueño vino escaso. Un paseo corto sin móvil y la rutina de cama a la misma hora. Nada de compensar con más café."
      : "Hoy no hay entreno. Elige el paseo o los minutos sentado y hazlos con el temporizador. Eso también es el plan.";

  const focusText = prefs.focuses.length
    ? prefs.focuses
        .map((id) => MIND_FOCUS_OPTIONS.find((option) => option.id === id)?.label ?? id)
        .join(", ")
    : "hábito general";

  return {
    summary: `Mente · ${GOAL_LABEL[goal.type]} · ${age} años · foco: ${focusText.toLowerCase()}.`,
    principles,
    todayNote,
    today: today.practices,
    week,
    medical,
  };
}
