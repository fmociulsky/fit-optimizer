import { GOAL_LABEL } from "./labels";
import { ageBand, profileAge } from "./metrics";
import type {
  FoodDislike,
  FoodRestriction,
  Goal,
  Intensity,
  MealSlot,
  NutritionPrefs,
  Plan,
  Profile,
  WeeklyMenu,
  WeeklyMenuMeal,
} from "./types";

export const ALLERGY_OPTIONS: { id: FoodRestriction; label: string }[] = [
  { id: "none", label: "Ninguna alergia o intolerancia conocida" },
  { id: "dairy", label: "Lácteos / lactosa" },
  { id: "gluten", label: "Gluten" },
  { id: "egg", label: "Huevo" },
  { id: "fish", label: "Pescado" },
  { id: "shellfish", label: "Marisco" },
  { id: "nuts", label: "Frutos secos" },
  { id: "peanuts", label: "Cacahuete" },
  { id: "soy", label: "Soja" },
  { id: "legumes", label: "Legumbres" },
];

export const DISLIKE_OPTIONS: { id: FoodDislike; label: string }[] = [
  { id: "chicken", label: "Pollo / pavo" },
  { id: "red_meat", label: "Carne roja" },
  { id: "pork", label: "Cerdo" },
  { id: "fish", label: "Pescado" },
  { id: "egg", label: "Huevo" },
  { id: "dairy", label: "Lácteos" },
  { id: "legumes", label: "Legumbres" },
  { id: "nuts", label: "Frutos secos" },
  { id: "oats", label: "Avena" },
  { id: "spicy", label: "Picante" },
];

export const MEAL_SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: "Desayuno",
  lunch: "Comida",
  snack: "Merienda",
  dinner: "Cena",
};

type FoodTag = FoodRestriction | FoodDislike;
type CarbLevel = "low" | "mod" | "high";

type MealTemplate = {
  id: string;
  slot: MealSlot;
  title: string;
  items: string[];
  contains: FoodTag[];
  carbs: CarbLevel;
  easy: boolean;
  shop: string[];
};

const MEALS: MealTemplate[] = [
  {
    id: "b-yogur-avena",
    slot: "breakfast",
    title: "Yogur, avena y fruta",
    items: ["Yogur natural", "Avena", "Fruta de temporada", "Canela"],
    contains: ["dairy", "oats"],
    carbs: "mod",
    easy: true,
    shop: ["Yogur natural", "Avena", "Fruta"],
  },
  {
    id: "b-huevos-tostada",
    slot: "breakfast",
    title: "Huevos y tostada integral",
    items: ["2 huevos", "Pan integral", "Tomate", "Aceite de oliva"],
    contains: ["egg", "gluten"],
    carbs: "mod",
    easy: true,
    shop: ["Huevos", "Pan integral", "Tomate", "Aceite de oliva"],
  },
  {
    id: "b-avena-vegetal",
    slot: "breakfast",
    title: "Avena con bebida vegetal",
    items: ["Avena", "Bebida de avena o arroz", "Fruta", "Semillas de chía"],
    contains: ["oats"],
    carbs: "high",
    easy: true,
    shop: ["Avena", "Bebida vegetal", "Fruta"],
  },
  {
    id: "b-requeson",
    slot: "breakfast",
    title: "Requesón y fruta",
    items: ["Requesón o queso fresco", "Fruta", "Un chorro de miel si apetece"],
    contains: ["dairy"],
    carbs: "low",
    easy: true,
    shop: ["Requesón", "Fruta"],
  },
  {
    id: "b-tofu",
    slot: "breakfast",
    title: "Revuelto de tofu y verdura",
    items: ["Tofu firme", "Espinacas o calabacín", "Cúrcuma", "Pan si lo toleras"],
    contains: ["soy"],
    carbs: "low",
    easy: true,
    shop: ["Tofu", "Espinacas", "Calabacín"],
  },
  {
    id: "b-quinoa-fruta",
    slot: "breakfast",
    title: "Quinoa con fruta",
    items: ["Quinoa cocida", "Manzana o pera", "Canela", "Aceite de oliva o tahini suave"],
    contains: [],
    carbs: "mod",
    easy: true,
    shop: ["Quinoa", "Manzana"],
  },
  {
    id: "b-pavo-pan",
    slot: "breakfast",
    title: "Pan con tomate y pavo",
    items: ["Pan integral", "Tomate", "Lonchas de pavo", "Aceite de oliva"],
    contains: ["gluten", "chicken"],
    carbs: "mod",
    easy: true,
    shop: ["Pan integral", "Tomate", "Pavo loncheado", "Aceite de oliva"],
  },
  {
    id: "b-huevos-aguacate",
    slot: "breakfast",
    title: "Huevos con aguacate",
    items: ["2 huevos", "Medio aguacate", "Sal y pimienta suave"],
    contains: ["egg"],
    carbs: "low",
    easy: true,
    shop: ["Huevos", "Aguacate"],
  },
  {
    id: "b-compota-yogur",
    slot: "breakfast",
    title: "Compota de manzana y yogur",
    items: ["Compota sin azúcar añadido", "Yogur natural", "Fácil de masticar"],
    contains: ["dairy"],
    carbs: "mod",
    easy: true,
    shop: ["Manzana", "Yogur natural"],
  },
  {
    id: "b-arroz-canela",
    slot: "breakfast",
    title: "Arroz con canela y fruta",
    items: ["Arroz blanco o integral suave", "Bebida vegetal", "Canela", "Plátano maduro"],
    contains: [],
    carbs: "high",
    easy: true,
    shop: ["Arroz", "Bebida vegetal", "Plátano"],
  },
  {
    id: "l-pollo-arroz",
    slot: "lunch",
    title: "Pollo, arroz y brócoli",
    items: ["Pechuga de pollo a la plancha", "Arroz", "Brócoli", "Aceite de oliva"],
    contains: ["chicken"],
    carbs: "high",
    easy: false,
    shop: ["Pollo", "Arroz", "Brócoli", "Aceite de oliva"],
  },
  {
    id: "l-lentejas",
    slot: "lunch",
    title: "Lentejas con verdura",
    items: ["Lentejas", "Zanahoria y puerro", "Comino suave", "Pan si lo toleras"],
    contains: ["legumes"],
    carbs: "mod",
    easy: true,
    shop: ["Lentejas", "Zanahoria", "Puerro"],
  },
  {
    id: "l-merluza-patata",
    slot: "lunch",
    title: "Merluza, patata y ensalada",
    items: ["Merluza al horno", "Patata cocida", "Ensalada de lechuga y tomate"],
    contains: ["fish"],
    carbs: "mod",
    easy: true,
    shop: ["Merluza", "Patata", "Lechuga", "Tomate"],
  },
  {
    id: "l-tofu-arroz",
    slot: "lunch",
    title: "Tofu salteado con arroz",
    items: ["Tofu", "Arroz", "Calabacín y pimiento", "Salsa de soja suave o sal"],
    contains: ["soy"],
    carbs: "high",
    easy: false,
    shop: ["Tofu", "Arroz", "Calabacín", "Pimiento"],
  },
  {
    id: "l-pavo-pasta",
    slot: "lunch",
    title: "Pavo con pasta y calabacín",
    items: ["Pavo picado o filetes", "Pasta", "Calabacín", "Tomate triturado"],
    contains: ["chicken", "gluten"],
    carbs: "high",
    easy: false,
    shop: ["Pavo", "Pasta", "Calabacín", "Tomate triturado"],
  },
  {
    id: "l-garbanzos-quinoa",
    slot: "lunch",
    title: "Garbanzos con quinoa",
    items: ["Garbanzos", "Quinoa", "Espinacas", "Pimentón dulce"],
    contains: ["legumes"],
    carbs: "mod",
    easy: true,
    shop: ["Garbanzos", "Quinoa", "Espinacas"],
  },
  {
    id: "l-ternera-patata",
    slot: "lunch",
    title: "Ternera magra y patata",
    items: ["Ternera a la plancha", "Patata", "Ensalada"],
    contains: ["red_meat"],
    carbs: "mod",
    easy: false,
    shop: ["Ternera magra", "Patata", "Lechuga"],
  },
  {
    id: "l-tortilla-patata",
    slot: "lunch",
    title: "Tortilla de patata y ensalada",
    items: ["Tortilla de patata (poco aceite)", "Ensalada", "Tomate"],
    contains: ["egg"],
    carbs: "mod",
    easy: true,
    shop: ["Huevos", "Patata", "Lechuga", "Tomate"],
  },
  {
    id: "l-salmon-boniato",
    slot: "lunch",
    title: "Salmón y boniato",
    items: ["Salmón al horno", "Boniato", "Judías verdes"],
    contains: ["fish"],
    carbs: "mod",
    easy: true,
    shop: ["Salmón", "Boniato", "Judías verdes"],
  },
  {
    id: "l-potaje",
    slot: "lunch",
    title: "Potaje suave de judías",
    items: ["Judías blancas", "Zanahoria y calabaza", "Pimentón dulce", "Fácil de masticar"],
    contains: ["legumes"],
    carbs: "mod",
    easy: true,
    shop: ["Judías blancas", "Zanahoria", "Calabaza"],
  },
  {
    id: "l-pollo-guiso",
    slot: "lunch",
    title: "Guiso de pollo y patata",
    items: ["Pollo desmenuzado", "Patata", "Zanahoria", "Caldo suave"],
    contains: ["chicken"],
    carbs: "mod",
    easy: true,
    shop: ["Pollo", "Patata", "Zanahoria"],
  },
  {
    id: "l-arroz-verdura-huevo",
    slot: "lunch",
    title: "Arroz, verdura y huevo",
    items: ["Arroz", "Verdura salteada", "Huevo poché o duro"],
    contains: ["egg"],
    carbs: "high",
    easy: true,
    shop: ["Arroz", "Verdura de temporada", "Huevos"],
  },
  {
    id: "d-pescado-ensalada",
    slot: "dinner",
    title: "Pescado blanco y ensalada",
    items: ["Pescado blanco a la plancha", "Ensalada abundante", "Aceite de oliva"],
    contains: ["fish"],
    carbs: "low",
    easy: true,
    shop: ["Pescado blanco", "Lechuga", "Tomate", "Aceite de oliva"],
  },
  {
    id: "d-pollo-verdura",
    slot: "dinner",
    title: "Pollo y verdura al horno",
    items: ["Contramuslo o pechuga", "Calabacín y pimiento", "Hierbas"],
    contains: ["chicken"],
    carbs: "low",
    easy: true,
    shop: ["Pollo", "Calabacín", "Pimiento"],
  },
  {
    id: "d-sopa-lentejas",
    slot: "dinner",
    title: "Sopa de lentejas suave",
    items: ["Lentejas pasadas por pasapurés si hace falta", "Verdura", "Comino suave"],
    contains: ["legumes"],
    carbs: "mod",
    easy: true,
    shop: ["Lentejas", "Zanahoria", "Puerro"],
  },
  {
    id: "d-tortilla-francesa",
    slot: "dinner",
    title: "Tortilla francesa y ensalada",
    items: ["Tortilla de 2 huevos", "Ensalada", "Tomate"],
    contains: ["egg"],
    carbs: "low",
    easy: true,
    shop: ["Huevos", "Lechuga", "Tomate"],
  },
  {
    id: "d-tofu-salteado",
    slot: "dinner",
    title: "Tofu con verdura salteada",
    items: ["Tofu", "Brócoli o pak choi", "Ajo suave"],
    contains: ["soy"],
    carbs: "low",
    easy: false,
    shop: ["Tofu", "Brócoli"],
  },
  {
    id: "d-pavo-calabacin",
    slot: "dinner",
    title: "Pavo y calabacín",
    items: ["Filetes de pavo", "Calabacín a la plancha", "Aceite de oliva"],
    contains: ["chicken"],
    carbs: "low",
    easy: true,
    shop: ["Pavo", "Calabacín", "Aceite de oliva"],
  },
  {
    id: "d-merluza-judias",
    slot: "dinner",
    title: "Merluza y judías verdes",
    items: ["Merluza", "Judías verdes", "Patata pequeña si entrenaste duro"],
    contains: ["fish"],
    carbs: "low",
    easy: true,
    shop: ["Merluza", "Judías verdes", "Patata"],
  },
  {
    id: "d-huevos-espinacas",
    slot: "dinner",
    title: "Huevos con espinacas",
    items: ["Huevos revueltos", "Espinacas", "Un poco de queso si lo toleras"],
    contains: ["egg", "dairy"],
    carbs: "low",
    easy: true,
    shop: ["Huevos", "Espinacas"],
  },
  {
    id: "d-crema-verduras",
    slot: "dinner",
    title: "Crema de verduras",
    items: ["Crema de calabaza o calabacín", "Aceite de oliva", "Fácil de tragar"],
    contains: [],
    carbs: "low",
    easy: true,
    shop: ["Calabaza", "Calabacín", "Aceite de oliva"],
  },
  {
    id: "d-atun-ensalada",
    slot: "dinner",
    title: "Ensalada de atún",
    items: ["Atún al natural", "Lechuga, tomate, pepino", "Aceite de oliva"],
    contains: ["fish"],
    carbs: "low",
    easy: true,
    shop: ["Atún al natural", "Lechuga", "Tomate", "Pepino"],
  },
  {
    id: "d-caldo-pollo",
    slot: "dinner",
    title: "Caldo de pollo con verdura",
    items: ["Caldo casero o suave", "Pollo desmenuzado", "Zanahoria", "Fideos de arroz si quieres"],
    contains: ["chicken"],
    carbs: "low",
    easy: true,
    shop: ["Pollo", "Zanahoria", "Fideos de arroz"],
  },
  {
    id: "s-yogur-fruta",
    slot: "snack",
    title: "Yogur y fruta",
    items: ["Yogur natural", "Fruta"],
    contains: ["dairy"],
    carbs: "mod",
    easy: true,
    shop: ["Yogur natural", "Fruta"],
  },
  {
    id: "s-hummus",
    slot: "snack",
    title: "Hummus y zanahoria",
    items: ["Hummus", "Zanahoria o pepino en palitos"],
    contains: ["legumes"],
    carbs: "mod",
    easy: true,
    shop: ["Garbanzos", "Zanahoria", "Pepino"],
  },
  {
    id: "s-platano-nueces",
    slot: "snack",
    title: "Plátano y frutos secos",
    items: ["Plátano", "Un puñado de nueces"],
    contains: ["nuts"],
    carbs: "high",
    easy: false,
    shop: ["Plátano", "Nueces"],
  },
  {
    id: "s-queso-fresco",
    slot: "snack",
    title: "Queso fresco",
    items: ["Queso fresco", "Tomate cherry"],
    contains: ["dairy"],
    carbs: "low",
    easy: true,
    shop: ["Queso fresco", "Tomate"],
  },
  {
    id: "s-manzana-cacahuete",
    slot: "snack",
    title: "Manzana y crema de cacahuete",
    items: ["Manzana", "Cucharada de crema de cacahuete"],
    contains: ["peanuts"],
    carbs: "mod",
    easy: false,
    shop: ["Manzana", "Crema de cacahuete"],
  },
  {
    id: "s-soja",
    slot: "snack",
    title: "Yogur de soja y fruta",
    items: ["Yogur de soja", "Fruta"],
    contains: ["soy"],
    carbs: "mod",
    easy: true,
    shop: ["Yogur de soja", "Fruta"],
  },
  {
    id: "s-compota",
    slot: "snack",
    title: "Compota de manzana",
    items: ["Compota sin azúcar añadido", "Canela"],
    contains: [],
    carbs: "mod",
    easy: true,
    shop: ["Manzana"],
  },
  {
    id: "s-arroz-inflado",
    slot: "snack",
    title: "Tortitas de arroz y fruta",
    items: ["Tortitas de arroz", "Fruta", "Un poco de miel si apetece"],
    contains: [],
    carbs: "high",
    easy: true,
    shop: ["Tortitas de arroz", "Fruta"],
  },
  {
    id: "s-pavo-tomate",
    slot: "snack",
    title: "Pavo y tomate",
    items: ["Lonchas de pavo", "Tomate"],
    contains: ["chicken"],
    carbs: "low",
    easy: true,
    shop: ["Pavo loncheado", "Tomate"],
  },
];

function blockedTags(prefs: NutritionPrefs) {
  const tags = new Set<FoodTag>();
  for (const item of prefs.restrictions) {
    if (item !== "none") tags.add(item);
  }
  for (const item of prefs.dislikes) tags.add(item);
  return tags;
}

function allowed(meal: MealTemplate, blocked: Set<FoodTag>) {
  return !meal.contains.some((tag) => blocked.has(tag));
}

function scoreMeal(
  meal: MealTemplate,
  training: boolean,
  intensity: Intensity | null,
  goal: Goal["type"],
  band: ReturnType<typeof ageBand>
) {
  let score = 1;
  const hard = training && (intensity === "moderate" || intensity === "high");
  if (hard && meal.carbs === "high") score += 3;
  if (hard && meal.carbs === "mod") score += 1;
  if (!training && meal.carbs === "low") score += 2;
  if (!training && meal.carbs === "high") score -= 1;
  if (goal === "fat_loss" && !training && meal.carbs !== "high") score += 1;
  if (goal === "muscle_gain" && meal.carbs === "high") score += 2;
  if (goal === "endurance" && training && meal.carbs === "high") score += 3;
  if (goal === "strength" && hard && meal.carbs !== "low") score += 2;
  if (goal === "health" && meal.easy) score += 1;
  if (band === "senior" && meal.easy) score += 4;
  if (band === "mature" && meal.easy) score += 2;
  if (band === "young" && training && meal.carbs === "high") score += 1;
  return score;
}

function pickMeal(
  slot: MealSlot,
  prefs: NutritionPrefs,
  training: boolean,
  intensity: Intensity | null,
  goal: Goal["type"],
  band: ReturnType<typeof ageBand>,
  dayIndex: number,
  used: Set<string>
) {
  const blocked = blockedTags(prefs);
  const candidates = MEALS.filter(
    (meal) => meal.slot === slot && allowed(meal, blocked)
  );
  const fresh = candidates.filter((meal) => !used.has(meal.id));
  const pool = fresh.length ? fresh : candidates;
  if (!pool.length) return fallbackMeal(slot, prefs, training);
  const ranked = pool
    .map((meal) => ({
      meal,
      score: scoreMeal(meal, training, intensity, goal, band),
    }))
    .sort((a, b) => b.score - a.score || a.meal.id.localeCompare(b.meal.id));
  const best = ranked[0].score;
  const top = ranked.filter((item) => item.score >= best - 1);
  const chosen = top[dayIndex % top.length].meal;
  used.add(chosen.id);
  return toMeal(chosen, training);
}

function toMeal(meal: MealTemplate, training: boolean): WeeklyMenuMeal {
  return {
    slot: meal.slot,
    title: meal.title,
    items: meal.items,
    note:
      training && meal.carbs === "high"
        ? "Hay entreno: este carbohidrato viene a cuento."
        : undefined,
  };
}

function fallbackMeal(
  slot: MealSlot,
  prefs: NutritionPrefs,
  training: boolean
): WeeklyMenuMeal {
  const blocked = blockedTags(prefs);
  const protein = !blocked.has("egg")
    ? "Huevos"
    : !blocked.has("chicken")
      ? "Pollo o pavo"
      : !blocked.has("fish")
        ? "Pescado blanco"
        : !blocked.has("legumes")
          ? "Lentejas o garbanzos"
          : !blocked.has("soy")
            ? "Tofu"
            : "La proteína que toleres";
  const carb = training
    ? blocked.has("gluten")
      ? "Arroz, patata o quinoa"
      : "Arroz, patata o pan integral"
    : "Verdura de volumen y un poco de patata si hace falta";
  return {
    slot,
    title: "Plato base (sin coincidencias en el recetario)",
    items: [protein, carb, "Verdura", "Aceite de oliva"],
    note: "Filtramos alergias y lo que no te apetece. Si esto queda muy vago, afloja una casilla o habla con tu nutricionista.",
  };
}

function dayNote(
  trainingName: string | null,
  intensity: Intensity | null,
  goal: Goal["type"],
  band: ReturnType<typeof ageBand>
) {
  if (trainingName) {
    const extra =
      goal === "endurance" || goal === "muscle_gain" || intensity === "high"
        ? "Más carbohidrato en comida y merienda."
        : "Proteína en cada toma; el carbohidrato, alrededor de la sesión.";
    return `Hoy toca ${trainingName}. ${extra}`;
  }
  if (goal === "fat_loss") {
    return "Descanso: misma proteína, un poco menos de arroz o pan.";
  }
  if (band === "senior") {
    return "Descanso: cocina suave, proteína y calma. Recuperar también es el plan.";
  }
  return "Descanso: come, duerme, camina. No recortes a lo loco.";
}

function ageRationale(band: ReturnType<typeof ageBand>, age: number) {
  if (band === "senior") {
    return `${age} años: priorizamos platos fáciles de masticar, proteína en cada toma y menos picante.`;
  }
  if (band === "mature") {
    return `${age} años: proteína constante y digestión sencilla. El volumen de entreno no pide un menú de culturista.`;
  }
  if (band === "young") {
    return `${age} años: si hay sesión, hay carbohidrato. Si no, no hace falta copiar el plato del día duro.`;
  }
  return `${age} años: menú repetible, no recetas de revista.`;
}

export function emptyNutritionPrefs(): NutritionPrefs {
  return { restrictions: ["none"], dislikes: [], notes: "" };
}

export function buildWeeklyMenu(input: {
  profile: Profile;
  goal: Goal;
  plan: Plan;
  prefs: NutritionPrefs;
  weightKg: number;
}): WeeklyMenu {
  const { profile, goal, plan, prefs } = input;
  const age = profileAge(profile);
  const band = ageBand(age);
  const used = new Set<string>();
  const weekdays = [1, 2, 3, 4, 5, 6, 0];
  const days = weekdays.map((weekday, dayIndex) => {
    const workout = plan.weeklySplit.find((day) => day.weekday === weekday) ?? null;
    const training = Boolean(workout);
    const intensity = workout?.intensity ?? null;
    const meals = (["breakfast", "lunch", "snack", "dinner"] as MealSlot[]).map(
      (slot) =>
        pickMeal(slot, prefs, training, intensity, goal.type, band, dayIndex, used)
    );
    return {
      weekday,
      trainingName: workout?.name ?? null,
      trainingIntensity: intensity,
      note: dayNote(workout?.name ?? null, intensity, goal.type, band),
      meals,
    };
  });

  const shop = new Map<string, Set<string>>();
  const groupFor = (item: string) => {
    if (/pollo|pavo|ternera|huevo|tofu|lenteja|garbanzo|yogur|queso|reques|atún|atun|merluza|salmón|salmon|pescado|jamón|jamon/i.test(item)) {
      return "Proteína";
    }
    if (/arroz|avena|pan|pasta|patata|boniato|quinoa|tortita|fideo/i.test(item)) {
      return "Carbohidratos";
    }
    return "Verdura, fruta y extra";
  };
  for (const day of days) {
    for (const meal of day.meals) {
      const template = MEALS.find((item) => item.title === meal.title);
      for (const item of template?.shop ?? meal.items) {
        const group = groupFor(item);
        if (!shop.has(group)) shop.set(group, new Set());
        shop.get(group)!.add(item);
      }
    }
  }

  const allergyText = prefs.restrictions.includes("none") || !prefs.restrictions.length
    ? "Sin alergias o intolerancias marcadas."
    : `Evitamos: ${prefs.restrictions
        .filter((item) => item !== "none")
        .map((item) => ALLERGY_OPTIONS.find((option) => option.id === item)?.label ?? item)
        .join(", ")}.`;
  const dislikeText = prefs.dislikes.length
    ? `No entra lo que no te apetece: ${prefs.dislikes
        .map((item) => DISLIKE_OPTIONS.find((option) => option.id === item)?.label ?? item)
        .join(", ")}.`
    : "No marcaste comidas que te caigan mal de gusto.";

  const rationale = [
    `Objetivo ${GOAL_LABEL[goal.type].toLowerCase()} y ${profile.weekdays.length} días de entreno. Los días con sesión llevan más carbohidrato; los de descanso, más verdura.`,
    ageRationale(band, age),
    allergyText,
    dislikeText,
  ];
  if (prefs.notes.trim()) {
    rationale.push(
      `Anotaste: “${prefs.notes.trim()}”. El menú no interpreta texto libre; úsalo como recordatorio al hacer la compra.`
    );
  }
  rationale.push(
    `Raciones a ojo, pensadas para unos ${input.weightKg.toFixed(0)} kg. Un nutricionista puede ajustar cantidades.`
  );

  return {
    generatedAt: new Date().toISOString(),
    summary: `Menú de 7 días · ${GOAL_LABEL[goal.type]} · ${band === "senior" ? "cocina suave" : `${age} años`}`,
    rationale,
    days,
    groceries: [...shop.entries()].map(([group, items]) => ({
      group,
      items: [...items].sort((a, b) => a.localeCompare(b, "es")),
    })),
  };
}
