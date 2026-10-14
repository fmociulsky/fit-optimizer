"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { BackLink } from "@/components/back-link";
import { SiteHeader } from "@/components/site-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  loadCoachClient,
  saveCoachClientPlan,
  type CoachClientDetail,
} from "@/lib/account";
import { coachPlanMetricsError } from "@/lib/coach";
import { gymMachineNames } from "@/lib/gym-machines";
import {
  EQUIPMENT_LABEL,
  GOAL_LABEL,
  INTENSITY_LABEL,
  MEDICAL_LABEL,
  weekdayName,
} from "@/lib/labels";
import { profileAge } from "@/lib/metrics";
import { pilatesItemNames } from "@/lib/pilates";
import {
  branchTrainingPlaces,
  generateWeeklySplit,
  type TrainingPlace,
} from "@/lib/plan";
import type { GoalType, Intensity, MedicalFlag, WorkoutDay } from "@/lib/types";

const MEDICAL_OPTIONS: MedicalFlag[] = [
  "none",
  "hypertension",
  "diabetes",
  "back_pain",
  "knee_hip",
  "asthma",
  "cardiac",
  "recent_injury",
  "pregnancy",
];
import { cn } from "@/lib/utils";

function emptyExercise() {
  return { name: "", sets: 3, reps: "8–12", restSec: 75 };
}

function emptyDay(
  weekday: number,
  durationMin: number,
  id?: string
): WorkoutDay {
  return {
    id: id ?? crypto.randomUUID(),
    weekday,
    name: "Sesión",
    focus: "Según el objetivo del alumno",
    durationMin,
    intensity: "moderate",
    exercises: [],
    warmup: "5 minutos de movilidad suave",
    cooldown: "Estiramientos 5 minutos, sin dolor",
  };
}

function guessPlace(profile: CoachClientDetail["profile"]): TrainingPlace {
  if (profile.equipment !== "coach") {
    return profile.equipment;
  }
  if (profile.pilatesItems?.length) return "pilates";
  if (profile.gymMachines?.length) return "full_gym";
  if (profile.homeItems?.length) {
    return profile.homeItems.includes("dumbbells")
      ? "home_dumbbells"
      : "bodyweight";
  }
  return "full_gym";
}

export function ProfessionalPlanEditor({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [detail, setDetail] = useState<CoachClientDetail | null>(null);
  const [days, setDays] = useState<WorkoutDay[]>([]);
  const [place, setPlace] = useState<TrainingPlace>("full_gym");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [goalType, setGoalType] = useState<GoalType | "">("");
  const [medicalFlags, setMedicalFlags] = useState<MedicalFlag[]>([]);
  const [medicalNotes, setMedicalNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadCoachClient(clientId)
      .then((loaded) => {
        if (cancelled) return;
        setDetail(loaded);
        if (loaded.hasPlan) {
          setWeight(String(loaded.profile.weightKg));
          setHeight(String(loaded.profile.heightCm));
          setGoalType(loaded.goal.type);
          setMedicalFlags(loaded.profile.medicalFlags);
          setMedicalNotes(loaded.profile.medicalNotes);
        }
        const places = branchTrainingPlaces(loaded.branch);
        const guessed = guessPlace(loaded.profile);
        setPlace(places.includes(guessed) ? guessed : (places[0] ?? "full_gym"));
        const byWeekday = new Map(
          loaded.weeklySplit.map((day) => [day.weekday, day])
        );
        const weekdays = loaded.trainingWeekdays.length
          ? loaded.trainingWeekdays
          : loaded.profile.weekdays;
        setDays(
          weekdays.map((weekday) => {
            const existing = byWeekday.get(weekday);
            if (!existing) {
              return emptyDay(weekday, loaded.profile.sessionMinutes);
            }
            return {
              ...existing,
              exercises: existing.exercises.map((exercise) => ({ ...exercise })),
            };
          })
        );
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "No se pudo cargar al alumno."
        );
      });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  function updateDay(weekday: number, patch: Partial<WorkoutDay>) {
    setDays((current) =>
      current.map((day) =>
        day.weekday === weekday ? { ...day, ...patch } : day
      )
    );
  }

  function updateExercise(
    weekday: number,
    index: number,
    patch: Partial<WorkoutDay["exercises"][number]>
  ) {
    setDays((current) =>
      current.map((day) => {
        if (day.weekday !== weekday) return day;
        const exercises = day.exercises.map((exercise, i) =>
          i === index ? { ...exercise, ...patch } : exercise
        );
        return { ...day, exercises };
      })
    );
  }

  function toggleMedical(flag: MedicalFlag) {
    setMedicalFlags((current) => {
      if (flag === "none") {
        return current.includes("none") ? [] : ["none"];
      }
      const withoutNone = current.filter((item) => item !== "none");
      return withoutNone.includes(flag)
        ? withoutNone.filter((item) => item !== flag)
        : [...withoutNone, flag];
    });
  }

  function metricsError() {
    return coachPlanMetricsError({
      weightKg: Number(weight),
      heightCm: Number(height),
      goalType,
      medicalFlags,
      medicalNotes,
    });
  }

  function applyGenerated() {
    if (!detail) return;
    const issue = metricsError();
    const places = branchTrainingPlaces(detail.branch);
    if (!places.length) {
      setError(
        detail.branch.studioNames.length
          ? "La sucursal no tiene equipos cargados."
          : "Este alumno no está en una sucursal."
      );
      return;
    }
    if (!places.includes(place)) {
      setError("El plan tiene que usar los equipos de la sucursal.");
      return;
    }
    if (issue || !goalType) {
      setError(issue ?? "Elige el objetivo del alumno.");
      return;
    }
    setError(null);
    const generated = generateWeeklySplit(
      {
        ...detail.profile,
        weightKg: Number(weight),
        heightCm: Number(height),
        medicalFlags,
        medicalNotes: medicalNotes.trim(),
      },
      { ...detail.goal, type: goalType },
      place,
      detail.branch
    );
    const byWeekday = new Map(generated.map((day) => [day.weekday, day]));
    setDays((current) =>
      current.map((day) => {
        const next = byWeekday.get(day.weekday);
        if (!next) return day;
        return { ...next, id: day.id };
      })
    );
    toast.success("Propuesta de Enforma lista. Revísala o ajústala a mano.");
  }

  function clearPlan() {
    if (!detail) return;
    setDays((current) =>
      current.map((day) =>
        emptyDay(day.weekday, detail.profile.sessionMinutes, day.id)
      )
    );
    toast.success("Plan vacío. Puedes escribirlo o pedir una propuesta.");
  }

  async function save() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const issue = metricsError();
      const places = detail ? branchTrainingPlaces(detail.branch) : [];
      if (!places.length) {
        throw new Error(
          detail?.branch.studioNames.length
            ? "La sucursal no tiene equipos cargados."
            : "Este alumno no está en una sucursal."
        );
      }
      if (!places.includes(place)) {
        throw new Error("El plan tiene que usar los equipos de la sucursal.");
      }
      if (issue || !goalType) {
        throw new Error(issue ?? "Elige el objetivo del alumno.");
      }
      const cleaned = days
        .map((day) => ({
          ...day,
          exercises: day.exercises.filter((exercise) => exercise.name.trim()),
        }))
        .filter((day) => day.exercises.length);
      await saveCoachClientPlan(clientId, {
        weeklySplit: cleaned,
        weightKg: Number(weight),
        heightCm: Number(height),
        goalType,
        place,
        medicalFlags,
        medicalNotes: medicalNotes.trim(),
      });
      toast.success("Plan cargado. El alumno ya puede ver las sesiones.");
      router.push("/profesor/alumnos");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "No se pudo guardar."
      );
    } finally {
      setBusy(false);
    }
  }

  if (error && !detail) {
    return (
      <div className="min-h-svh bg-background">
        <SiteHeader />
        <main className="mx-auto w-full max-w-2xl px-4 py-10">
          <p className="text-sm text-destructive">{error}</p>
          <Link
            href="/profesor/alumnos"
            className={cn(buttonVariants({ variant: "outline" }), "mt-6 h-11 px-4")}
          >
            Volver a alumnos
          </Link>
        </main>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex min-h-svh items-center justify-center text-muted-foreground">
        Cargando ficha…
      </div>
    );
  }

  const titleName = detail.profile.name.trim().replace(/\s+/g, " ") || "Alumno";
  const places = branchTrainingPlaces(detail.branch);
  const studioLabel = detail.branch.studioNames.join(", ");
  const equipmentNames =
    place === "pilates"
      ? pilatesItemNames(detail.branch.pilatesItems)
      : gymMachineNames(detail.branch.gymMachines);

  return (
    <div className="min-h-svh bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl px-4 py-8">
        <BackLink href="/profesor/alumnos">Volver a alumnos</BackLink>
        <p className="text-sm font-medium tracking-wide text-primary uppercase">
          {detail.hasPlan ? "Editar plan" : "Cargar plan"}
        </p>
        <h1 className="mt-1 font-heading text-4xl tracking-tight italic">
          {titleName}.
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {profileAge(detail.profile)} años · {detail.profile.sessionMinutes} min
          {studioLabel ? ` · ${studioLabel}` : ""}
        </p>
        <details className="group mt-6 rounded-3xl border border-foreground/8 bg-card">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-4 sm:p-5 [&::-webkit-details-marker]:hidden">
            <span className="min-w-0">
              <span className="block font-medium">Datos del alumno</span>
              <span className="mt-1 block text-sm text-muted-foreground">
                {[
                  weight.trim() ? `${weight.trim()} kg` : null,
                  height.trim() ? `${height.trim()} cm` : null,
                  goalType ? GOAL_LABEL[goalType] : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Peso, altura y objetivo."}
              </span>
            </span>
            <ChevronDown className="mt-0.5 size-5 shrink-0 text-muted-foreground transition group-open:rotate-180" />
          </summary>
          <div className="border-t border-foreground/8 px-4 pt-4 pb-4 sm:px-5 sm:pb-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="alumno-peso">Peso (kg)</Label>
                <Input
                  id="alumno-peso"
                  type="number"
                  min={40}
                  max={220}
                  inputMode="decimal"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="h-11 text-base"
                  placeholder="Ej. 72"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="alumno-altura">Altura (cm)</Label>
                <Input
                  id="alumno-altura"
                  type="number"
                  min={140}
                  max={220}
                  inputMode="numeric"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  className="h-11 text-base"
                  placeholder="Ej. 168"
                />
              </div>
            </div>
            <div className="mt-4">
              <Label>Objetivo</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {(Object.keys(GOAL_LABEL) as GoalType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={goalType === type}
                    onClick={() => setGoalType(type)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-sm",
                      goalType === type
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {GOAL_LABEL[type]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </details>

        <details className="group mt-4 rounded-3xl border border-foreground/8 bg-card">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-4 sm:p-5 [&::-webkit-details-marker]:hidden">
            <span className="min-w-0">
              <span className="block font-medium">Salud</span>
              <span className="mt-1 block text-sm text-muted-foreground">
                {medicalFlags.length
                  ? medicalFlags.map((flag) => MEDICAL_LABEL[flag]).join(" · ")
                  : "Antecedentes que condicionan el plan."}
                {medicalNotes.trim() ? " · Con notas" : ""}
              </span>
            </span>
            <ChevronDown className="mt-0.5 size-5 shrink-0 text-muted-foreground transition group-open:rotate-180" />
          </summary>
          <div className="border-t border-foreground/8 px-4 pt-4 pb-4 sm:px-5 sm:pb-5">
            <p className="text-sm text-muted-foreground">
              Condicionan ejercicios, descansos e intensidad. Marca al menos una
              opción, aunque sea que no hay antecedentes.
            </p>
            <div className="mt-3 grid gap-2">
              {MEDICAL_OPTIONS.map((flag) => {
                const checked = medicalFlags.includes(flag);
                return (
                  <label
                    key={flag}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3",
                      checked
                        ? "border-primary bg-primary/8"
                        : "border-border"
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleMedical(flag)}
                      className="mt-0.5"
                    />
                    <span className="text-sm">{MEDICAL_LABEL[flag]}</span>
                  </label>
                );
              })}
            </div>
            <div className="mt-4 space-y-2">
              <Label htmlFor="alumno-salud">
                Notas (medicación, cirugías, lo que importe)
              </Label>
              <Textarea
                id="alumno-salud"
                value={medicalNotes}
                onChange={(event) => setMedicalNotes(event.target.value)}
                placeholder="Ej. operada de menisco en 2023, le molesta al bajar escaleras."
                className="min-h-24"
              />
            </div>
          </div>
        </details>

        <div className="mt-6 rounded-2xl border border-primary/30 bg-primary/8 p-4">
          <p className="font-medium">Equipos de la sucursal</p>
          {places.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {studioLabel
                ? "Esta sucursal no tiene equipos cargados. Añádelos en la sucursal antes de armar el plan."
                : "Este alumno no está en una sucursal, así que no hay equipos para el plan."}
            </p>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted-foreground">
                {equipmentNames.join(" · ")}
              </p>
              {places.length > 1 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {places.map((option) => (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={place === option}
                      onClick={() => setPlace(option)}
                      className={cn(
                        "rounded-full px-3 py-1.5 text-sm",
                        place === option
                          ? "bg-primary text-primary-foreground"
                          : "bg-background text-muted-foreground"
                      )}
                    >
                      {EQUIPMENT_LABEL[option]}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
          <p className="mt-3 text-sm text-muted-foreground">
            Los días que entrena empiezan vacíos. Pide una propuesta con esos
            equipos o escribe los ejercicios. Si cargas un plan nuevo, el alumno
            lo ve desde hoy.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 px-4"
              onClick={applyGenerated}
            >
              <Sparkles className="size-4" data-icon="inline-start" />
              Propuesta de Enforma
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-11 px-4"
              disabled={!days.some((day) => day.exercises.length)}
              onClick={clearPlan}
            >
              <Trash2 className="size-4" data-icon="inline-start" />
              Limpiar plan
            </Button>
          </div>
        </div>

        <div className="mt-8 space-y-6">
          {days.map((day) => (
            <section
              key={day.weekday}
              className="rounded-3xl border border-foreground/8 bg-card p-4 sm:p-5"
            >
              <h2 className="font-heading text-2xl italic">
                {weekdayName(day.weekday)}
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nombre de la sesión</Label>
                  <Input
                    value={day.name}
                    onChange={(e) =>
                      updateDay(day.weekday, { name: e.target.value })
                    }
                    className="h-11 text-base"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Foco</Label>
                  <Input
                    value={day.focus}
                    onChange={(e) =>
                      updateDay(day.weekday, { focus: e.target.value })
                    }
                    className="h-11 text-base"
                  />
                </div>
              </div>
              <div className="mt-3">
                <Label>Intensidad</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(Object.keys(INTENSITY_LABEL) as Intensity[]).map(
                    (intensity) => (
                      <button
                        key={intensity}
                        type="button"
                        onClick={() => updateDay(day.weekday, { intensity })}
                        className={cn(
                          "rounded-full px-3 py-1.5 text-sm",
                          day.intensity === intensity
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {INTENSITY_LABEL[intensity]}
                      </button>
                    )
                  )}
                </div>
              </div>
              {day.exercises.length === 0 && (
                <p className="mt-4 text-sm text-muted-foreground">
                  Sin ejercicios. Añade uno o usa la propuesta de Enforma.
                </p>
              )}
              <ul className="mt-4 space-y-3">
                {day.exercises.map((exercise, index) => (
                  <li
                    key={`${day.weekday}-${index}`}
                    className="rounded-2xl bg-muted/50 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Label className="text-xs text-muted-foreground">
                        Ejercicio {index + 1}
                      </Label>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground"
                        aria-label="Quitar ejercicio"
                        onClick={() =>
                          updateDay(day.weekday, {
                            exercises: day.exercises.filter(
                              (_, i) => i !== index
                            ),
                          })
                        }
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                    <Input
                      value={exercise.name}
                      placeholder="Ej. Sentadilla goblet"
                      onChange={(e) =>
                        updateExercise(day.weekday, index, {
                          name: e.target.value,
                        })
                      }
                      className="mt-2 h-11 text-base"
                    />
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <div>
                        <Input
                          type="number"
                          min={1}
                          value={exercise.sets}
                          onChange={(e) =>
                            updateExercise(day.weekday, index, {
                              sets: Number(e.target.value) || 1,
                            })
                          }
                          className="h-11 text-base"
                          aria-label="Series"
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                          Series
                        </p>
                      </div>
                      <div>
                        <Input
                          value={exercise.reps}
                          onChange={(e) =>
                            updateExercise(day.weekday, index, {
                              reps: e.target.value,
                            })
                          }
                          className="h-11 text-base"
                          aria-label="Repeticiones"
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                          Repeticiones
                        </p>
                      </div>
                      <div>
                        <Input
                          type="number"
                          min={0}
                          value={exercise.restSec}
                          onChange={(e) =>
                            updateExercise(day.weekday, index, {
                              restSec: Number(e.target.value) || 0,
                            })
                          }
                          className="h-11 text-base"
                          aria-label="Descanso en segundos"
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                          Descanso (s)
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <Button
                type="button"
                variant="outline"
                className="mt-3 h-11 px-4"
                onClick={() =>
                  updateDay(day.weekday, {
                    exercises: [...day.exercises, emptyExercise()],
                  })
                }
              >
                <Plus className="size-4" data-icon="inline-start" />
                Añadir ejercicio
              </Button>
            </section>
          ))}
        </div>

        {error && (
          <p className="mt-6 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <Button className="h-11 px-5" disabled={busy} onClick={() => void save()}>
            {busy
              ? "Guardando…"
              : detail.hasPlan
                ? "Guardar plan"
                : "Cargar plan al alumno"}
          </Button>
          <Link
            href="/profesor/alumnos"
            className={cn(buttonVariants({ variant: "outline" }), "h-11 px-4")}
          >
            Cancelar
          </Link>
        </div>
      </main>
    </div>
  );
}
