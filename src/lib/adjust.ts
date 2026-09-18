import type { Adjustment, AppState, CheckIn, Plan } from "./types";
import { currentWeight } from "./metrics";

function uid() {
  return crypto.randomUUID();
}

function clonePlan(plan: Plan): Plan {
  return structuredClone(plan);
}

function scaleSets(plan: Plan, delta: number) {
  for (const day of plan.weeklySplit) {
    for (const ex of day.exercises) {
      if (ex.sets > 1) {
        ex.sets = Math.max(2, Math.min(5, ex.sets + delta));
      }
    }
  }
}

function addRest(plan: Plan, seconds: number) {
  for (const day of plan.weeklySplit) {
    for (const ex of day.exercises) {
      if (ex.restSec > 0) {
        ex.restSec = Math.max(45, Math.min(180, ex.restSec + seconds));
      }
    }
  }
}

function bumpConditioning(plan: Plan, minutes: number) {
  for (const day of plan.weeklySplit) {
    const last = day.exercises.at(-1);
    if (!last) continue;
    const match = last.reps.match(/(\d+)\s*min/);
    if (match) {
      const next = Math.max(6, Math.min(30, Number(match[1]) + minutes));
      last.reps = `${next} min`;
      day.durationMin = Math.min(90, day.durationMin + Math.max(0, minutes));
    }
  }
}

function dropIntensity(plan: Plan) {
  for (const day of plan.weeklySplit) {
    if (day.intensity === "high") day.intensity = "moderate";
    else if (day.intensity === "moderate") day.intensity = "low";
  }
}

function raiseIntensity(plan: Plan) {
  for (const day of plan.weeklySplit) {
    if (day.intensity === "low") day.intensity = "moderate";
    else if (day.intensity === "moderate") day.intensity = "high";
  }
}

function shortenSessions(plan: Plan) {
  for (const day of plan.weeklySplit) {
    if (day.exercises.length > 4) {
      day.exercises = day.exercises.slice(0, -1);
    }
    day.durationMin = Math.max(25, day.durationMin - 10);
  }
}

export function applyCheckIn(state: AppState, checkIn: CheckIn): {
  plan: Plan;
  adjustment: Adjustment;
} {
  const plan = clonePlan(state.plan);
  const changes: string[] = [];
  const reasons: string[] = [];
  const planned = Math.max(1, state.profile.weekdays.length);
  const adherence = checkIn.sessionsCompleted / planned;
  const previous = currentWeight(state);
  const delta = checkIn.weightKg - previous;
  const pain = checkIn.pain.trim();

  if (checkIn.energy <= 2 || checkIn.sleep <= 2) {
    reasons.push("Energía o sueño bajos");
    dropIntensity(plan);
    addRest(plan, 20);
    changes.push("Bajamos la intensidad y alargamos los descansos para que recuperes.");
  }

  if (adherence < 0.5) {
    reasons.push("Pocas sesiones esta semana");
    shortenSessions(plan);
    changes.push("Acortamos las sesiones: más fácil de cumplir que un plan perfecto que no se hace.");
  }

  if (pain) {
    reasons.push("Molestia o dolor");
    dropIntensity(plan);
    scaleSets(plan, -1);
    changes.push(
      `Reducimos volumen mientras hay molestia (“${pain}”). Si el dolor es agudo o irradia, para y consulta.`
    );
  }

  if (
    state.goal.type === "fat_loss" &&
    Math.abs(delta) < 0.25 &&
    adherence >= 0.7 &&
    checkIn.energy >= 3 &&
    !pain
  ) {
    reasons.push("El peso apenas se movió");
    bumpConditioning(plan, 6);
    changes.push("Sumamos unos minutos de acondicionamiento. El siguiente paso, si sigue plano, es revisar raciones, no machacarte.");
  }

  if (state.goal.type === "fat_loss" && delta <= -1.2) {
    reasons.push("Bajada de peso demasiado rápida");
    bumpConditioning(plan, -6);
    addRest(plan, 15);
    changes.push("Suavizamos el cardio. Perder más de ~1 kg por semana suele pasar factura.");
  }

  if (
    (state.goal.type === "muscle_gain" || state.goal.type === "strength") &&
    delta < -0.6 &&
    adherence >= 0.6
  ) {
    reasons.push("Estás perdiendo peso con un objetivo de ganar");
    bumpConditioning(plan, -5);
    changes.push("Recortamos acondicionamiento. Para ganar músculo o fuerza hace falta comer y recuperar.");
  }

  if (adherence >= 0.85 && checkIn.energy >= 4 && checkIn.sleep >= 3 && !pain) {
    reasons.push("Buena semana");
    scaleSets(plan, 1);
    if (state.profile.experience !== "beginner") raiseIntensity(plan);
    changes.push("Subimos un poco el volumen (más series). Cuando las últimas repeticiones salgan limpias, también puedes sumar carga.");
  }

  if (checkIn.energy >= 4 && adherence < 0.7 && !pain) {
    reasons.push("Buena energía, poca asistencia");
    changes.push("El cuerpo responde; el cuello de botella es el calendario. Deja el material listo la noche anterior y trata el día de entreno como una cita.");
  }

  if (changes.length === 0) {
    reasons.push("Semana estable");
    changes.push("No hace falta rehacer el plan. Repite la misma semana y anota las cargas que usaste.");
  }

  const adjustment: Adjustment = {
    id: uid(),
    date: checkIn.date,
    reason: reasons.join(" · "),
    changes,
  };
  plan.version += 1;
  plan.weeklyFocus = changes[0];
  plan.adjustments = [...plan.adjustments, adjustment];

  return { plan, adjustment };
}
