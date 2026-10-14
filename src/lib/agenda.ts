import { INTENSITY_LABEL, weekdayName } from "./labels";
import { checkInDue, isoDate } from "./metrics";
import { buildMindGuide } from "./mind";
import { dateForWeekday, sessionOnDate, workoutOnDate } from "./schedule";
import type { AppState, CompletedSession, MealSlot } from "./types";
import { MEAL_SLOT_LABEL } from "./weekly-menu";

export type AgendaKind = "train" | "rest" | "meal" | "mind" | "checkin";

export type AgendaTask = {
  id: string;
  kind: AgendaKind;
  title: string;
  detail: string;
  minutes?: number;
  done?: boolean;
  items?: string[];
  exercises?: { name: string; label: string; done: boolean }[];
  practiceId?: string;
  dayId?: string;
  slot?: MealSlot;
};

export type AgendaDay = {
  weekday: number;
  iso: string;
  dateLabel: string;
  isToday: boolean;
  tasks: AgendaTask[];
};

export type CalendarCell = {
  date: Date;
  day: number;
  weekday: number;
  inMonth: boolean;
  isToday: boolean;
  training: boolean;
  sessionDone: boolean;
};

export function localNoon(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
}

export function sameLocalDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isFutureDay(date: Date, now = new Date()) {
  return localNoon(date).getTime() > localNoon(now).getTime();
}

export function sessionFullyDone(
  session: CompletedSession | undefined | null,
  exerciseNames: string[]
) {
  if (!session) return false;
  if (!session.exercisesDone) return true;
  if (exerciseNames.length === 0) return true;
  return exerciseNames.every((name) => session.exercisesDone?.includes(name));
}

export function monthLabel(year: number, month: number) {
  const raw = new Intl.DateTimeFormat("es-ES", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month, 1));
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function monthCells(year: number, month: number) {
  const first = new Date(year, month, 1, 12);
  const mondayOffset = first.getDay() === 0 ? 6 : first.getDay() - 1;
  const start = new Date(year, month, 1 - mondayOffset, 12);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

export function calendarCells(
  state: AppState,
  year: number,
  month: number,
  now = new Date()
): CalendarCell[] {
  const cells = monthCells(year, month).map((date) => {
    const weekday = date.getDay();
    const workout = workoutOnDate(state, date);
    const names = workout?.exercises.map((exercise) => exercise.name) ?? [];
    const session = workout
      ? sessionOnDate(state, workout.id, date)
      : undefined;
    return {
      date,
      day: date.getDate(),
      weekday,
      inMonth: date.getMonth() === month,
      isToday: sameLocalDay(date, now),
      training: Boolean(workout),
      sessionDone: sessionFullyDone(session, names),
    };
  });
  const lastInMonth = cells.findLastIndex((cell) => cell.inMonth);
  const weeks = Math.max(1, Math.ceil((lastInMonth + 1) / 7));
  return cells.slice(0, weeks * 7);
}

function loggedOn(iso: string, date: string) {
  return isoDate(new Date(date)) === iso;
}

export function dayStats(day: AgendaDay) {
  const countable = day.tasks.filter((task) => task.kind !== "rest");
  return {
    total: countable.length,
    done: countable.filter((task) => task.done).length,
  };
}

export function buildAgendaDay(
  state: AppState,
  date: Date,
  now = new Date()
): AgendaDay {
  const day = localNoon(date);
  const weekday = day.getDay();
  const iso = isoDate(day);
  const isToday = sameLocalDay(day, now);
  const workout = workoutOnDate(state, day);
  const menuDay = state.weeklyMenu?.days.find((item) => item.weekday === weekday);
  const mindGuide = state.mindPrefs
    ? buildMindGuide({
        profile: state.profile,
        goal: state.goal,
        plan: state.plan,
        prefs: state.mindPrefs,
        lastCheck: state.checkIns.at(-1),
        weekday,
      })
    : null;
  const mindDay = mindGuide?.week.find((item) => item.weekday === weekday);
  const session = workout ? sessionOnDate(state, workout.id, day) : null;
  const tasks: AgendaTask[] = [];

  if (workout) {
    const names = workout.exercises.map((exercise) => exercise.name);
    const doneSet = new Set(
      session?.exercisesDone ?? (session ? names : [])
    );
    tasks.push({
      id: `train-${workout.id}`,
      kind: "train",
      title: workout.name,
      detail: `${workout.focus} · Intensidad ${INTENSITY_LABEL[workout.intensity].toLowerCase()}.`,
      minutes: workout.durationMin,
      done: sessionFullyDone(session, names),
      exercises: workout.exercises.map((exercise) => ({
        name: exercise.name,
        label: `${exercise.name} · ${exercise.sets} × ${exercise.reps}`,
        done: doneSet.has(exercise.name),
      })),
      dayId: workout.id,
    });
  } else {
    tasks.push({
      id: `rest-${weekday}`,
      kind: "rest",
      title: "Día de descanso",
      detail:
        "Sin sesión de fuerza. Un paseo corto si te apetece, y duerme como si el entreno de mañana importara.",
    });
  }

  if (menuDay) {
    for (const meal of menuDay.meals) {
      tasks.push({
        id: `meal-${weekday}-${meal.slot}`,
        kind: "meal",
        title: `${MEAL_SLOT_LABEL[meal.slot]}: ${meal.title}`,
        detail: meal.note ?? meal.items.join(" · "),
        done: (state.mealLogs ?? []).some(
          (log) => log.slot === meal.slot && loggedOn(iso, log.date)
        ),
        items: meal.items,
        slot: meal.slot,
      });
    }
  }

  if (mindDay) {
    for (const practice of mindDay.practices) {
      tasks.push({
        id: `mind-${weekday}-${practice.id}`,
        kind: "mind",
        title: practice.title,
        detail: practice.when,
        minutes: practice.minutes,
        done: (state.mindLogs ?? []).some(
          (log) => log.practiceId === practice.id && loggedOn(iso, log.date)
        ),
        items: practice.steps,
        practiceId: practice.id,
      });
    }
  }

  if (isToday && checkInDue(state, now)) {
    tasks.push({
      id: "checkin-week",
      kind: "checkin",
      title: "Check-in de la semana",
      detail:
        "Peso, energía, sueño, sesiones y molestias. Con eso se reajusta la semana que entra.",
    });
  }

  return {
    weekday,
    iso,
    dateLabel: `${weekdayName(weekday)} ${new Intl.DateTimeFormat("es-ES", {
      day: "numeric",
      month: "short",
    }).format(day)}`,
    isToday,
    tasks,
  };
}

export function buildAgenda(state: AppState, now = new Date()): AgendaDay[] {
  return [1, 2, 3, 4, 5, 6, 0].map((weekday) =>
    buildAgendaDay(state, dateForWeekday(weekday, now), now)
  );
}
