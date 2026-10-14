"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Brain,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Moon,
  UtensilsCrossed,
} from "lucide-react";
import { CheckInDialog } from "@/components/check-in-dialog";
import { SiteHeader } from "@/components/site-header";
import { useAppStore } from "@/components/app-provider";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { WEEKDAYS } from "@/lib/labels";
import {
  buildAgendaDay,
  calendarCells,
  dayStats,
  isFutureDay,
  localNoon,
  monthLabel,
  sameLocalDay,
  type AgendaDay,
  type AgendaTask,
  type CalendarCell,
} from "@/lib/agenda";
import { isHistoricalPlanDate } from "@/lib/schedule";
import { cn } from "@/lib/utils";
import { isCoachPlanPending } from "@/lib/coach";

const KIND_LABEL: Record<AgendaTask["kind"], string> = {
  train: "Entreno",
  rest: "Descanso",
  meal: "Comer",
  mind: "Mente",
  checkin: "Seguimiento",
};

function KindIcon({ kind }: { kind: AgendaTask["kind"] }) {
  const className = "size-4 shrink-0 text-primary";
  if (kind === "train") return <Dumbbell className={className} />;
  if (kind === "rest") return <Moon className={className} />;
  if (kind === "meal") return <UtensilsCrossed className={className} />;
  if (kind === "mind") return <Brain className={className} />;
  return <CalendarDays className={className} />;
}

function AgendaCalendar({
  year,
  month,
  cells,
  selected,
  onSelect,
  onPrev,
  onNext,
  onToday,
}: {
  year: number;
  month: number;
  cells: CalendarCell[];
  selected: Date;
  onSelect: (date: Date) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  return (
    <section className="rounded-3xl border border-foreground/8 bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Mes anterior"
          onClick={onPrev}
        >
          <ChevronLeft />
        </Button>
        <div className="text-center">
          <h2 className="font-heading text-2xl italic">{monthLabel(year, month)}</h2>
          <button
            type="button"
            className="text-xs font-medium text-primary"
            onClick={onToday}
          >
            Ir a hoy
          </button>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Mes siguiente"
          onClick={onNext}
        >
          <ChevronRight />
        </Button>
      </div>
      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
        {WEEKDAYS.map((day) => (
          <div key={day.id} className="py-1">
            {day.short}
          </div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((cell) => {
          const selectedDay = sameLocalDay(cell.date, selected);
          const label = [
            WEEKDAYS.find((item) => item.id === cell.weekday)?.full,
            cell.day,
            cell.isToday ? "hoy" : null,
            cell.training ? "entreno" : "descanso",
            cell.sessionDone ? "sesión hecha" : null,
          ]
            .filter(Boolean)
            .join(", ");
          return (
            <button
              key={cell.date.toISOString()}
              type="button"
              aria-label={label}
              aria-current={cell.isToday ? "date" : undefined}
              aria-pressed={selectedDay}
              onClick={() => onSelect(cell.date)}
              className={cn(
                "flex min-h-12 flex-col items-center justify-center rounded-2xl py-1.5 text-sm transition-colors",
                !cell.inMonth && "opacity-40",
                selectedDay
                  ? "bg-primary text-primary-foreground"
                  : cell.isToday
                    ? "bg-primary/12 text-foreground"
                    : "hover:bg-muted"
              )}
            >
              <span className="tabular-nums leading-none">{cell.day}</span>
              <span className="mt-1 flex h-3 items-center justify-center">
                {cell.sessionDone ? (
                  <CheckCircle2
                    className={cn(
                      "size-3",
                      selectedDay ? "text-primary-foreground" : "text-primary"
                    )}
                  />
                ) : cell.training ? (
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      selectedDay ? "bg-primary-foreground" : "bg-primary"
                    )}
                  />
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        El punto es día de entreno. El check es sesión ya marcada.
      </p>
    </section>
  );
}

function TaskRow({
  task,
  canMark,
  canMarkTrain,
  onMarkMeal,
  onMarkMind,
  onMarkTrain,
  onUnmarkTrain,
  onToggleExercise,
}: {
  task: AgendaTask;
  canMark: boolean;
  canMarkTrain: boolean;
  onMarkMeal: (slot: NonNullable<AgendaTask["slot"]>) => void;
  onMarkMind: (practiceId: string) => void;
  onMarkTrain: (dayId: string) => void;
  onUnmarkTrain: (dayId: string) => void;
  onToggleExercise: (dayId: string, name: string, allNames: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const hasItems = Boolean(task.items?.length);
  const exercises = task.exercises ?? [];
  const exerciseNames = exercises.map((exercise) => exercise.name);

  return (
    <li className="rounded-2xl border border-foreground/8 bg-card px-4 py-3">
      <div className="flex items-start gap-3">
        <KindIcon kind={task.kind} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium tracking-wide text-primary uppercase">
            {KIND_LABEL[task.kind]}
            {task.minutes ? ` · ${task.minutes} min` : ""}
          </p>
          <p className="mt-0.5 font-medium leading-snug">{task.title}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {task.detail}
          </p>
          {exercises.length > 0 && (
            <ul className="mt-3 space-y-2">
              {exercises.map((exercise) => (
                <li key={exercise.name}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-xl px-1 py-1",
                      !canMarkTrain && "cursor-default"
                    )}
                  >
                    <Checkbox
                      checked={exercise.done}
                      disabled={!canMarkTrain || !task.dayId}
                      onCheckedChange={() => {
                        if (!task.dayId || !canMarkTrain) return;
                        onToggleExercise(task.dayId, exercise.name, exerciseNames);
                      }}
                      className="mt-0.5"
                    />
                    <span
                      className={cn(
                        "text-sm leading-snug",
                        exercise.done && "text-muted-foreground line-through"
                      )}
                    >
                      {exercise.label}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {hasItems && (
            <button
              type="button"
              className="mt-2 text-xs font-medium text-primary"
              onClick={() => setOpen((current) => !current)}
            >
              {open ? "Ocultar detalle" : "Ver detalle"}
            </button>
          )}
          {open && hasItems && (
            <ul className="mt-2 list-disc space-y-1 pl-4 text-sm leading-relaxed">
              {task.items?.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
          {canMarkTrain && task.kind === "train" && task.dayId && !task.done && (
            <Button
              className="mt-3 h-10 px-3"
              variant="outline"
              onClick={() => onMarkTrain(task.dayId!)}
            >
              Marcar sesión como realizada
            </Button>
          )}
          {canMarkTrain && task.kind === "train" && task.dayId && task.done && (
            <Button
              className="mt-3 h-10 px-3"
              variant="ghost"
              onClick={() => onUnmarkTrain(task.dayId!)}
            >
              Quitar marca de la sesión
            </Button>
          )}
          {canMark && !task.done && task.kind === "meal" && task.slot && (
            <Button
              className="mt-3 h-10 px-3"
              variant="outline"
              onClick={() => onMarkMeal(task.slot!)}
            >
              Marcar comida
            </Button>
          )}
          {canMark && !task.done && task.kind === "mind" && task.practiceId && (
            <Button
              className="mt-3 h-10 px-3"
              variant="outline"
              onClick={() => onMarkMind(task.practiceId!)}
            >
              Marcar como hecha
            </Button>
          )}
          {canMark && task.kind === "checkin" && (
            <div className="mt-3">
              <CheckInDialog due />
            </div>
          )}
        </div>
        {task.done ? (
          <span className="flex shrink-0 items-center gap-1 text-xs font-medium">
            <CheckCircle2 className="size-4 text-primary" />
            Hecha
          </span>
        ) : null}
      </div>
    </li>
  );
}

function DayCard({
  day,
  canMark,
  canMarkTrain,
  onMarkMeal,
  onMarkMind,
  onMarkTrain,
  onUnmarkTrain,
  onToggleExercise,
}: {
  day: AgendaDay;
  canMark: boolean;
  canMarkTrain: boolean;
  onMarkMeal: (slot: NonNullable<AgendaTask["slot"]>) => void;
  onMarkMind: (practiceId: string) => void;
  onMarkTrain: (dayId: string) => void;
  onUnmarkTrain: (dayId: string) => void;
  onToggleExercise: (dayId: string, name: string, allNames: string[]) => void;
}) {
  const stats = dayStats(day);
  return (
    <section
      className={cn(
        "rounded-3xl border px-4 py-4 sm:px-5",
        day.isToday
          ? "border-primary/40 bg-primary/6"
          : "border-foreground/8 bg-background"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-heading text-2xl italic">{day.dateLabel}</h2>
          {day.isToday && (
            <p className="text-sm font-medium text-primary">Hoy</p>
          )}
        </div>
        <Badge variant={day.isToday ? "default" : "secondary"}>
          {stats.done}/{stats.total} hechas
        </Badge>
      </div>
      <ul className="mt-4 space-y-2">
        {day.tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            canMark={canMark}
            canMarkTrain={canMarkTrain}
            onMarkMeal={onMarkMeal}
            onMarkMind={onMarkMind}
            onMarkTrain={onMarkTrain}
            onUnmarkTrain={onUnmarkTrain}
            onToggleExercise={onToggleExercise}
          />
        ))}
      </ul>
    </section>
  );
}

export function AgendaView() {
  const router = useRouter();
  const {
    ready,
    state,
    account,
    logMeal,
    logMindPractice,
    logSession,
    unlogSession,
    toggleExercise,
  } = useAppStore();
  const [cursor, setCursor] = useState(() => localNoon(new Date()));
  const [selected, setSelected] = useState(() => localNoon(new Date()));

  useEffect(() => {
    if (!ready) return;
    if (!state) router.replace("/comenzar");
    else if (!state.planAcceptedAt) router.replace("/panel");
  }, [ready, state, router]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const cells = useMemo(
    () => (state ? calendarCells(state, year, month) : []),
    [state, year, month]
  );
  const selectedDay = useMemo(
    () => (state ? buildAgendaDay(state, selected) : null),
    [state, selected]
  );
  const selectedStats = selectedDay ? dayStats(selectedDay) : null;

  if (!ready || !state || !state.planAcceptedAt) {
    return (
      <div className="flex min-h-svh items-center justify-center text-muted-foreground">
        Cargando tu agenda…
      </div>
    );
  }

  const firstName = state.profile.name.split(" ")[0];

  function goToday() {
    const today = localNoon(new Date());
    setCursor(today);
    setSelected(today);
  }

  return (
    <div className="min-h-svh bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <p className="text-sm font-medium tracking-wide text-primary uppercase">
          Agenda
        </p>
        <h1 className="mt-1 font-heading text-4xl tracking-tight italic sm:text-5xl">
          Calendario.
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          {firstName}, elige un día. Marca el entreno y cada ejercicio cuando
          lo hagas. Si tu profesor cambia el plan, lo ves desde ese día; los
          anteriores se quedan con lo que tocaba entonces.
        </p>

        {isCoachPlanPending(state) && (
          <div className="mt-6 rounded-2xl border border-foreground/8 bg-card p-4 text-sm leading-relaxed text-muted-foreground">
            El gimnasio te asigna el profesor. No hace falta un código.
          </div>
        )}

        {(!state.weeklyMenu || !state.mindPrefs) && (
          <div className="mt-6 space-y-2 rounded-2xl border border-primary/30 bg-primary/8 p-4 text-sm leading-relaxed">
            {!state.weeklyMenu &&
              !(
                account?.role === "client" &&
                account.studioRole === "client" &&
                !(state.plan.coachNutrition?.length)
              ) && (
              <p>
                Aún no hay menú semanal.{" "}
                <Link href="/nutricion" className="font-medium underline">
                  Armarlo en Nutrición
                </Link>{" "}
                para que salgan desayuno, comida, merienda y cena.
              </p>
            )}
            {!state.mindPrefs && (
              <p>
                Aún no hay prácticas de cabeza.{" "}
                <Link href="/mente" className="font-medium underline">
                  Elegir el foco en Mente
                </Link>{" "}
                para que salgan en cada día.
              </p>
            )}
          </div>
        )}

        <div className="mt-6">
          <AgendaCalendar
            year={year}
            month={month}
            cells={cells}
            selected={selected}
            onSelect={(date) => {
              const next = localNoon(date);
              setSelected(next);
              setCursor(next);
            }}
            onPrev={() => {
              const next = new Date(year, month - 1, 1, 12);
              setCursor(next);
              setSelected(next);
            }}
            onNext={() => {
              const next = new Date(year, month + 1, 1, 12);
              setCursor(next);
              setSelected(next);
            }}
            onToday={goToday}
          />
        </div>

        {selectedDay && selectedStats && (
          <div className="mt-6 space-y-3">
            {isFutureDay(selected) && (
              <p className="text-sm text-muted-foreground">
                Este día aún no ha llegado. El entreno se podrá marcar cuando
                toque.
              </p>
            )}
            {!isFutureDay(selected) && !selectedDay.isToday && (
              <p className="text-sm text-muted-foreground">
                {isHistoricalPlanDate(state, selected)
                  ? "Este día muestra el plan que tenías entonces, con los ejercicios que marcaste."
                  : "Puedes marcar el entreno de este día si ya lo hiciste."}
              </p>
            )}
            {selectedDay.isToday && (
              <p className="text-sm text-muted-foreground">
                Hoy: {selectedStats.done} de {selectedStats.total} tareas hechas.
              </p>
            )}
            <DayCard
              day={selectedDay}
              canMark={selectedDay.isToday}
              canMarkTrain={!isFutureDay(selected)}
              onMarkMeal={(slot) => {
                logMeal(slot);
                toast.success("Comida anotada.");
              }}
              onMarkMind={(practiceId) => {
                logMindPractice(practiceId);
                toast.success("Anotado. La cabeza también entrena.");
              }}
              onMarkTrain={(dayId) => {
                logSession(dayId, 7, selected);
                toast.success("Sesión marcada como realizada.");
              }}
              onUnmarkTrain={(dayId) => {
                unlogSession(dayId, selected);
                toast.success("Quitamos la marca de la sesión.");
              }}
              onToggleExercise={(dayId, name, allNames) => {
                toggleExercise(dayId, name, allNames, selected);
              }}
            />
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/panel" className={cn(buttonVariants(), "h-11 px-4")}>
            Ir al plan
          </Link>
          <Link
            href="/nutricion"
            className={cn(buttonVariants({ variant: "outline" }), "h-11 px-4")}
          >
            Nutrición
          </Link>
          <Link
            href="/mente"
            className={cn(buttonVariants({ variant: "outline" }), "h-11 px-4")}
          >
            Mente
          </Link>
        </div>
      </main>
    </div>
  );
}
