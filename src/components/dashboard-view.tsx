"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  Moon,
} from "lucide-react";
import { CheckInDialog } from "@/components/check-in-dialog";
import { SiteHeader } from "@/components/site-header";
import { WeightChart } from "@/components/weight-chart";
import { WorkoutDayCard } from "@/components/workout-day-card";
import { useAppStore } from "@/components/app-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  GOAL_LABEL,
  HORIZON_LABEL,
  weekdayName,
  weekdayShort,
} from "@/lib/labels";
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
import { cn } from "@/lib/utils";

function Score({ value }: { value: number }) {
  return (
    <span className="font-heading text-2xl italic tabular-nums">{value}/5</span>
  );
}

export function DashboardView() {
  const router = useRouter();
  const { ready, state, logSession, reset } = useAppStore();
  const [rpe, setRpe] = useState(7);

  useEffect(() => {
    if (ready && !state) router.replace("/comenzar");
  }, [ready, state, router]);

  if (!ready || !state) {
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
              {GOAL_LABEL[state.goal.type]} · {HORIZON_LABEL[state.goal.horizon]} ·{" "}
              {currentWeight(state).toFixed(1)} kg
            </p>
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
            {today ? (
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
                      entrenamiento de mañana importara. Porque importa.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="semana" className="mt-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              {weekSessions.length} de {state.profile.weekdays.length} sesiones
              apuntadas esta semana.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {grid.map(({ weekday, workout }) => (
                <div
                  key={weekday}
                  className={cn(
                    "rounded-2xl border px-4 py-3",
                    workout ? "bg-card" : "bg-muted/40"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{weekdayName(weekday)}</p>
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
              {state.plan.weeklySplit.map((day) => (
                <div key={day.id}>
                  <p className="mb-2 text-sm font-medium text-muted-foreground">
                    {weekdayShort(day.weekday)}
                  </p>
                  <WorkoutDayCard day={day} />
                </div>
              ))}
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
              <h2 className="font-heading text-2xl italic">Comida, en bruto</h2>
              <ul className="mt-3 list-disc space-y-2 pl-4 text-sm text-muted-foreground">
                {state.plan.nutritionHints.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
            <Button
              variant="outline"
              className="h-11 px-4"
              onClick={() => {
                reset();
                router.push("/");
              }}
            >
              Borrar este plan y empezar otro
            </Button>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
