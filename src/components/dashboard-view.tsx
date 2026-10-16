"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  Apple,
  Brain,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  GraduationCap,
  Moon,
  RefreshCw,
} from "lucide-react";
import { CheckInDialog } from "@/components/check-in-dialog";
import { SiteHeader } from "@/components/site-header";
import { PlanWarning } from "@/components/plan-warning";
import { WeightChart } from "@/components/weight-chart";
import { WorkoutDayCard } from "@/components/workout-day-card";
import { useAppStore } from "@/components/app-provider";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  EQUIPMENT_LABEL,
  FOCUS_AREA_LABEL,
  GOAL_LABEL,
  HORIZON_LABEL,
  teacherRoleWord,
  weekdayName,
  weekdayShort,
} from "@/lib/labels";
import { gymMachineNames } from "@/lib/gym-machines";
import { homeItemNames } from "@/lib/home-items";
import { pilatesItemNames } from "@/lib/pilates";
import { PLAN_ACCEPTANCE_TEXT } from "@/lib/disclaimers";
import { isCoachLed, isCoachPlanPending } from "@/lib/coach";
import {
  checkInDue,
  currentWeek,
  currentWeight,
  daysUntilCheckIn,
  formatDate,
  planProgress,
} from "@/lib/metrics";
import {
  sessionOnDate,
  sessionsThisWeek,
  todayWorkout,
  weekGrid,
} from "@/lib/schedule";
import { clientHomeHref } from "@/lib/roles";
import { loadAssignedTeacher } from "@/lib/studio";
import type { Sex } from "@/lib/types";
import { cn } from "@/lib/utils";

function Score({ value }: { value: number }) {
  return (
    <span className="font-heading text-2xl italic tabular-nums">{value}/5</span>
  );
}

function weekDateLabel(date: Date) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
  }).format(date);
}

function zonesLabel(areas?: (keyof typeof FOCUS_AREA_LABEL)[] | null) {
  if (!areas?.length || areas.includes("full_body")) {
    return FOCUS_AREA_LABEL.full_body;
  }
  return areas
    .filter((area) => area !== "full_body")
    .map((area) => FOCUS_AREA_LABEL[area])
    .join(", ");
}

function teacherPendingPlanCopy(
  teacherName: string | null,
  teacherSex: Sex | null,
  kind: "plan" | "ejercicios"
) {
  const role = teacherRoleWord(teacherSex);
  const name = teacherName?.trim();
  const who = name ? `Tu ${role} ${name}` : `Tu ${role}`;
  const what =
    kind === "ejercicios" ? "el plan de ejercicios" : "el plan";
  return `${who} todavía no cargó ${what}. Cuando lo haga, las sesiones aparecen acá.`;
}

export function DashboardView() {
  const router = useRouter();
  const { ready, state, logSession, reset, acceptPlanGuide, account } =
    useAppStore();
  const [rpe, setRpe] = useState(7);
  const [acceptedNotice, setAcceptedNotice] = useState(false);
  const [assignedTeacher, setAssignedTeacher] = useState<string | null>(null);
  const [assignedTeacherSex, setAssignedTeacherSex] = useState<Sex | null>(null);

  const studioStudent =
    account?.role === "client" && account.studioRole === "client";
  const savedTeacher = state?.plan.loadedBy?.name.trim() || null;

  useEffect(() => {
    if (!ready || !studioStudent) return;
    let cancelled = false;
    void loadAssignedTeacher()
      .then((teacher) => {
        if (cancelled) return;
        setAssignedTeacher(teacher?.name ?? null);
        setAssignedTeacherSex(teacher?.sex ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setAssignedTeacher(null);
        setAssignedTeacherSex(null);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, studioStudent]);

  useEffect(() => {
    if (!ready) return;
    if (state) return;
    if (studioStudent) return;
    router.replace(clientHomeHref(account));
  }, [account, ready, router, state, studioStudent]);

  if (!ready || !state) {
    if (ready && !state && studioStudent) {
      return (
        <div className="min-h-svh bg-background">
          <SiteHeader />
          <main className="mx-auto w-full max-w-3xl px-4 py-8">
            <p className="text-sm font-medium tracking-wide text-primary uppercase">
              Alumno
            </p>
            <h1 className="mt-1 font-heading text-4xl tracking-tight italic sm:text-5xl">
              Tu plan.
            </h1>
            <p className="mt-3 max-w-xl text-muted-foreground">
              {teacherPendingPlanCopy(
                assignedTeacher,
                assignedTeacherSex,
                "plan"
              )}
            </p>
            <Link
              href="/turnos"
              className="mt-6 flex gap-3 rounded-2xl border border-foreground/8 bg-card p-4 transition-colors hover:border-primary/40"
            >
              <CalendarClock className="mt-0.5 size-5 shrink-0 text-primary" />
              <div>
                <p className="font-medium">Días de asistencia</p>
                <p className="text-sm text-muted-foreground">
                  Mientras tanto, podés elegir cuándo vas.
                </p>
              </div>
            </Link>
          </main>
        </div>
      );
    }
    return (
      <div className="flex min-h-svh items-center justify-center text-muted-foreground">
        Cargando tu plan…
      </div>
    );
  }

  const today = todayWorkout(state);
  const doneToday = today ? sessionOnDate(state, today.id) : null;
  const due = checkInDue(state);
  const week = currentWeek(state);
  const progress = planProgress(state);
  const weekSessions = sessionsThisWeek(state);
  const grid = weekGrid(state);
  const lastCheck = state.checkIns.at(-1);
  const firstName = state.profile.name.split(" ")[0];
  const coachPending = isCoachPlanPending(state);
  const coachLed = isCoachLed(state.profile);
  const canReconfigure = !coachLed && !studioStudent;
  const foodNotes = studioStudent
    ? (state.plan.coachNutrition ?? [])
    : state.plan.nutritionHints;
  const showFood = !studioStudent || foodNotes.length > 0;
  const planTeacher = savedTeacher || assignedTeacher;

  if (!state.planAcceptedAt) {
    return (
      <div className="min-h-svh bg-background">
        <SiteHeader />
        <main className="mx-auto w-full max-w-xl px-4 py-10">
          <p className="text-sm font-medium tracking-wide text-primary uppercase">
            Tu plan
          </p>
          <h1 className="mt-1 font-heading text-4xl tracking-tight italic">
            Un aviso, {firstName}.
          </h1>
          <p className="mt-3 text-muted-foreground">
            Antes de las sesiones, esto tiene que quedar claro.
          </p>
          <div className="mt-8">
            <PlanWarning />
          </div>
          <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-foreground/8 bg-card px-4 py-4">
            <Checkbox
              checked={acceptedNotice}
              onCheckedChange={(value) => setAcceptedNotice(Boolean(value))}
              className="mt-0.5"
            />
            <span className="text-sm leading-relaxed">
              {PLAN_ACCEPTANCE_TEXT}
            </span>
          </label>
          <Button
            className="mt-6 h-11 px-4"
            disabled={!acceptedNotice}
            onClick={acceptPlanGuide}
          >
            Acepto y ver mi plan
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl px-4 py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium tracking-wide text-primary uppercase">
              Semana {week} de {state.plan.durationWeeks} · plan v{state.plan.version}
            </p>
            <h1 className="mt-1 font-heading text-4xl tracking-tight italic sm:text-5xl">
              Hola, {firstName}.
            </h1>
            <p className="mt-2 max-w-xl text-muted-foreground">
              {GOAL_LABEL[state.goal.type]} · {zonesLabel(state.goal.focusAreas)} ·{" "}
              {HORIZON_LABEL[state.goal.horizon]} · {currentWeight(state).toFixed(1)} kg
            </p>
            {studioStudent && !coachPending && planTeacher && (
              <p className="mt-3 flex items-center gap-2 text-sm">
                <GraduationCap className="size-4 shrink-0 text-primary" />
                <span>
                  Plan cargado por{" "}
                  <span className="font-medium">{planTeacher}</span>
                </span>
              </p>
            )}
          </div>
          <CheckInDialog due={due} />
        </div>

        <div className="mt-6">
          <div className="mb-2 flex justify-between text-sm text-muted-foreground">
            <span>Avance del bloque</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} />
        </div>

        {due && (
          <div className="mt-6 flex gap-3 rounded-2xl border border-primary/30 bg-primary/8 p-4">
            <CalendarCheck className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <p className="font-medium">Toca el check-in semanal</p>
              <p className="text-sm text-muted-foreground">
                Peso, energía, sueño, sesiones y molestias. Con eso rehacemos
                intensidad y volumen para la semana que entra.
              </p>
            </div>
          </div>
        )}

        {!due && (
          <p className="mt-4 text-sm text-muted-foreground">
            Próximo check-in en {daysUntilCheckIn(state)} día
            {daysUntilCheckIn(state) === 1 ? "" : "s"}.
          </p>
        )}

        {account?.studioRole === "client" && (
          <Link
            href="/turnos"
            className="mt-6 flex gap-3 rounded-2xl border border-foreground/8 bg-card p-4 transition-colors hover:border-primary/40"
          >
            <CalendarClock className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <p className="font-medium">Días de asistencia</p>
              <p className="text-sm text-muted-foreground">
                Elige cuándo vas, dentro de las veces por semana que te asignó
                el gimnasio.
              </p>
            </div>
          </Link>
        )}

        <div className="mt-6">
          <PlanWarning compact />
        </div>

        {coachPending && (
          <div className="mt-6 rounded-2xl border border-foreground/8 bg-card p-4 text-sm leading-relaxed text-muted-foreground">
            {teacherPendingPlanCopy(
              savedTeacher || assignedTeacher,
              assignedTeacherSex,
              "ejercicios"
            )}
          </div>
        )}

        <Tabs defaultValue="hoy" className="mt-8">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="hoy">Hoy</TabsTrigger>
            <TabsTrigger value="semana">Semana</TabsTrigger>
            <TabsTrigger value="avance">Avance</TabsTrigger>
            <TabsTrigger value="plan">Por qué este plan</TabsTrigger>
          </TabsList>

          <TabsContent value="hoy" className="mt-6 space-y-4">
            <p className="font-heading text-xl italic text-muted-foreground">
              {state.plan.weeklyFocus}
            </p>
            {coachPending ? null : today ? (
              <WorkoutDayCard
                day={today}
                actions={
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    {doneToday ? (
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <CheckCircle2 className="size-4 text-primary" />
                        Sesión registrada · esfuerzo {doneToday.rpe}/10
                      </p>
                    ) : (
                      <>
                        <div className="flex flex-1 items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            Esfuerzo 1–10
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {[4, 5, 6, 7, 8, 9].map((n) => (
                              <button
                                key={n}
                                type="button"
                                onClick={() => setRpe(n)}
                                className={cn(
                                  "size-8 rounded-full text-sm",
                                  rpe === n
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted text-muted-foreground"
                                )}
                              >
                                {n}
                              </button>
                            ))}
                          </div>
                        </div>
                        <Button
                          className="h-11 px-4"
                          onClick={() => {
                            logSession(today.id, rpe);
                            toast.success("Sesión anotada. Mañana seguimos.");
                          }}
                        >
                          Marcar como hecha
                        </Button>
                      </>
                    )}
                  </div>
                }
              />
            ) : (
              <Card>
                <CardContent className="flex items-start gap-3 py-8">
                  <Moon className="size-5 text-primary" />
                  <div>
                    <p className="font-heading text-2xl italic">Día de descanso</p>
                    <p className="mt-1 text-muted-foreground">
                      Camina un poco si te apetece, duerme y come como si el
                      entrenamiento de mañana importara. Porque importa. Si la
                      cabeza no para, en Mente hay un bloque corto para hoy.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardContent className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <CalendarDays className="mt-0.5 size-5 shrink-0 text-primary" />
                  <div>
                    <p className="font-medium">Agenda de la semana</p>
                    <p className="text-sm text-muted-foreground">
                      {showFood
                        ? "Todas las tareas, día a día: entreno, comidas y mente."
                        : "Las sesiones, día a día."}
                    </p>
                  </div>
                </div>
                <Link
                  href="/agenda"
                  className={cn(buttonVariants({ variant: "outline" }), "h-11 px-4")}
                >
                  Ver agenda
                </Link>
              </CardContent>
            </Card>
            {canReconfigure && (
            <Card>
              <CardContent className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <RefreshCw className="mt-0.5 size-5 shrink-0 text-primary" />
                  <div>
                    <p className="font-medium">¿Cambió dónde entrenas?</p>
                    <p className="text-sm text-muted-foreground">
                      De casa a gimnasio, o al revés. Rearmamos ejercicios con el material nuevo y guardamos check-ins y sesiones.
                    </p>
                  </div>
                </div>
                <Link
                  href="/comenzar?modo=rearmar"
                  className={cn(buttonVariants({ variant: "outline" }), "h-11 px-4")}
                >
                  Reconfigurar plan
                </Link>
              </CardContent>
            </Card>
            )}
            {showFood && (
            <Card>
              <CardContent className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <Apple className="mt-0.5 size-5 shrink-0 text-primary" />
                  <div>
                    <p className="font-medium">Comer, en bruto</p>
                    <p className="text-sm text-muted-foreground">
                      Guía orientativa: calorías y un día tipo. No sustituye a
                      un nutricionista profesional.
                    </p>
                  </div>
                </div>
                <Link
                  href="/nutricion"
                  className={cn(buttonVariants({ variant: "outline" }), "h-11 px-4")}
                >
                  Ver nutrición
                </Link>
              </CardContent>
            </Card>
            )}
            <Card>
              <CardContent className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <Brain className="mt-0.5 size-5 shrink-0 text-primary" />
                  <div>
                    <p className="font-medium">Mente</p>
                    <p className="text-sm text-muted-foreground">
                      Prácticas cortas, paso a paso: respirar más lento, estar
                      quieto, pasear sin móvil.
                    </p>
                  </div>
                </div>
                <Link
                  href="/mente"
                  className={cn(buttonVariants({ variant: "outline" }), "h-11 px-4")}
                >
                  Ver mente
                </Link>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="semana" className="mt-6 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {weekSessions.length} de {state.profile.weekdays.length} sesiones
                apuntadas esta semana.
              </p>
              <Link
                href="/agenda"
                className={cn(buttonVariants({ variant: "outline" }), "h-11 px-4")}
              >
                Ver agenda completa
              </Link>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {grid.map(({ weekday, date, workout }) => (
                <div
                  key={weekday}
                  className={cn(
                    "rounded-2xl border px-4 py-3",
                    workout ? "bg-card" : "bg-muted/40"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium">
                      {weekdayName(weekday)}{" "}
                      <span className="font-normal text-muted-foreground">
                        {weekDateLabel(date)}
                      </span>
                    </p>
                    {workout ? (
                      <Badge variant="secondary">{workout.durationMin} min</Badge>
                    ) : (
                      <Badge variant="outline">Descanso</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {workout ? `${workout.name} · ${workout.focus}` : "Sin sesión programada"}
                  </p>
                </div>
              ))}
            </div>
            <div className="space-y-4">
              {grid.map(({ weekday, date, workout }) =>
                workout ? (
                  <div key={`${weekday}-${workout.id}`}>
                    <p className="mb-2 text-sm font-medium text-muted-foreground">
                      {weekdayShort(weekday)} {weekDateLabel(date)}
                    </p>
                    <WorkoutDayCard day={workout} />
                  </div>
                ) : null
              )}
            </div>
          </TabsContent>

          <TabsContent value="avance" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Peso</CardTitle>
              </CardHeader>
              <CardContent>
                <WeightChart state={state} />
              </CardContent>
            </Card>
            {lastCheck ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <Card>
                  <CardContent className="pt-1">
                    <p className="text-sm text-muted-foreground">Última energía</p>
                    <Score value={lastCheck.energy} />
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-1">
                    <p className="text-sm text-muted-foreground">Último sueño</p>
                    <Score value={lastCheck.sleep} />
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-1">
                    <p className="text-sm text-muted-foreground">Sesiones esa semana</p>
                    <p className="font-heading text-2xl italic tabular-nums">
                      {lastCheck.sessionsCompleted}/{state.profile.weekdays.length}
                    </p>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Todavía no hay check-ins. En 7 días te pediremos la primera
                foto de cómo vas (en números, no en selfies).
              </p>
            )}
            <div className="space-y-3">
              <h2 className="font-heading text-2xl italic">Reajustes</h2>
              {state.plan.adjustments.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aún no hemos tocado el plan. El primer check-in es el que
                  empieza a personalizar de verdad.
                </p>
              ) : (
                <ol className="space-y-3">
                  {state.plan.adjustments
                    .slice()
                    .reverse()
                    .map((adj) => (
                      <li key={adj.id} className="rounded-2xl border bg-card p-4">
                        <p className="text-sm text-muted-foreground">
                          {formatDate(adj.date)} · {adj.reason}
                        </p>
                        <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
                          {adj.changes.map((c) => (
                            <li key={c}>{c}</li>
                          ))}
                        </ul>
                      </li>
                    ))}
                </ol>
              )}
            </div>
            {state.checkIns.length > 0 && (
              <div className="space-y-3">
                <h2 className="font-heading text-2xl italic">Historial de check-ins</h2>
                <ul className="space-y-2">
                  {state.checkIns
                    .slice()
                    .reverse()
                    .map((c) => (
                      <li
                        key={c.id}
                        className="rounded-2xl border px-4 py-3 text-sm"
                      >
                        <p className="font-medium">
                          {formatDate(c.date)} · {c.weightKg.toFixed(1)} kg
                        </p>
                        <p className="text-muted-foreground">
                          Energía {c.energy}/5 · Sueño {c.sleep}/5 · {c.sessionsCompleted}{" "}
                          sesiones
                          {c.pain ? ` · molestia: ${c.pain}` : ""}
                        </p>
                        {c.notes && <p className="mt-1">{c.notes}</p>}
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </TabsContent>

          <TabsContent value="plan" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="size-4" />
                  Antes de entrenar
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc space-y-2 pl-4 text-sm text-muted-foreground">
                  {state.plan.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <div>
              <h2 className="font-heading text-2xl italic">Por qué te armamos esto</h2>
              <ul className="mt-3 space-y-2">
                {state.plan.rationale.map((r) => (
                  <li key={r} className="rounded-2xl bg-muted/60 px-4 py-3 text-sm">
                    {r}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="font-heading text-2xl italic">Zonas</h2>
              <p className="mt-2 text-sm">
                {zonesLabel(state.goal.focusAreas)}
              </p>
            </div>
            <div>
              <h2 className="font-heading text-2xl italic">Material</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {EQUIPMENT_LABEL[state.profile.equipment]}
              </p>
              {state.profile.equipment === "full_gym" && (
                <p className="mt-2 text-sm">
                  {gymMachineNames(state.profile.gymMachines).join(" · ")}
                </p>
              )}
              {state.profile.equipment === "pilates" && (
                <p className="mt-2 text-sm">
                  {pilatesItemNames(state.profile.pilatesItems).join(" · ") ||
                    "Aún no marcaste el material de pilates. Reconfigura el plan."}
                </p>
              )}
              {state.profile.equipment !== "full_gym" &&
                state.profile.equipment !== "coach" &&
                state.profile.equipment !== "pilates" && (
                  <p className="mt-2 text-sm">
                    {homeItemNames(state.profile.homeItems).join(" · ") ||
                      "Aún no marcaste lo de casa. Reconfigura el plan."}
                  </p>
                )}
              {coachLed && (
                <p className="mt-2 text-sm">
                  {planTeacher
                    ? `Plan cargado por ${planTeacher}.`
                    : "El plan físico lo carga tu profesor."}
                </p>
              )}
            </div>
            {state.plan.adjustments.length > 0 && (
              <div className="space-y-3">
                <h2 className="font-heading text-2xl italic">Reconfiguraciones</h2>
                <ul className="space-y-2">
                  {state.plan.adjustments
                    .slice()
                    .reverse()
                    .map((adjustment) => (
                      <li
                        key={adjustment.id}
                        className="rounded-2xl border px-4 py-3 text-sm"
                      >
                        <p className="font-medium">
                          {formatDate(adjustment.date)} · {adjustment.reason}
                        </p>
                        <ul className="mt-1 list-disc pl-4 text-muted-foreground">
                          {adjustment.changes.map((change) => (
                            <li key={change}>{change}</li>
                          ))}
                        </ul>
                      </li>
                    ))}
                </ul>
              </div>
            )}
            {showFood && (
            <div>
              <h2 className="font-heading text-2xl italic">Comida, en bruto</h2>
              <ul className="mt-3 list-disc space-y-2 pl-4 text-sm text-muted-foreground">
                {foodNotes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
              <Link
                href="/nutricion"
                className={cn(buttonVariants({ variant: "outline" }), "mt-4 h-11 px-4")}
              >
                Abrir la guía de nutrición
              </Link>
            </div>
            )}
            {canReconfigure && (
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/comenzar?modo=rearmar"
                className={cn(buttonVariants({ variant: "outline" }), "h-11 px-4")}
              >
                Reconfigurar material y rearmar
              </Link>
              <Button
                variant="ghost"
                className="h-11 px-4"
                onClick={() => {
                  reset();
                  router.push("/");
                }}
              >
                Borrar este plan y empezar otro
              </Button>
            </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
