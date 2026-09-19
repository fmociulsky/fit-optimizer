"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { GymMachinePicker } from "@/components/gym-machine-picker";
import { HomeItemPicker } from "@/components/home-item-picker";
import { PlanWarning } from "@/components/plan-warning";
import { useAppStore } from "@/components/app-provider";
import {
  EQUIPMENT_HINT,
  EQUIPMENT_LABEL,
  EXPERIENCE_HINT,
  EXPERIENCE_LABEL,
  FOCUS_AREA_HINT,
  FOCUS_AREA_LABEL,
  FOCUS_ZONE_OPTIONS,
  GOAL_HINT,
  GOAL_LABEL,
  HORIZON_HINT,
  HORIZON_LABEL,
  MEDICAL_LABEL,
  SEX_LABEL,
  WEEKDAYS,
} from "@/lib/labels";
import { TYPICAL_GYM_MACHINE_IDS } from "@/lib/gym-machines";
import { seedHomeItems } from "@/lib/home-items";
import {
  ageFromBirthDate,
  birthDateBounds,
  birthDateFromAge,
  bmiCategory,
  calcBmi,
  defaultDraftProfile,
  parseLocalYmd,
  profileAge,
  withComputedAge,
} from "@/lib/metrics";
import { PLAN_ACCEPTANCE_TEXT } from "@/lib/disclaimers";
import { cn } from "@/lib/utils";
import type {
  Equipment,
  Experience,
  FocusArea,
  Goal,
  GoalType,
  Horizon,
  MedicalFlag,
  Profile,
  Sex,
} from "@/lib/types";

const ALL_STEPS = [
  { id: 0, label: "Tú" },
  { id: 1, label: "Cuerpo" },
  { id: 2, label: "Salud" },
  { id: 3, label: "Entrenamiento" },
  { id: 4, label: "Material" },
  { id: 5, label: "Objetivo" },
] as const;

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

function ChoiceCard({
  selected,
  title,
  hint,
  onClick,
}: {
  selected: boolean;
  title: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-2xl border px-4 py-3 text-left transition-colors",
        selected
          ? "border-primary bg-primary/8 ring-1 ring-primary"
          : "border-border bg-card hover:border-primary/40"
      )}
    >
      <div className="font-medium">{title}</div>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
    </button>
  );
}

export function OnboardingWizard({ rearmar = false }: { rearmar?: boolean }) {
  const router = useRouter();
  const { startPlan, rebuildPlan, ready, state } = useAppStore();
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<Profile>(defaultDraftProfile);
  const [goal, setGoal] = useState<Goal>({
    horizon: "medium",
    type: "health",
    targetWeightKg: null,
    notes: "",
    focusAreas: ["full_body"],
  });
  const [targetOn, setTargetOn] = useState(false);
  const [medicalAck, setMedicalAck] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const visibleSteps = ALL_STEPS;

  useEffect(() => {
    if (!ready || hydrated) return;
    if (rearmar && state) {
      setProfile({
        ...state.profile,
        homeItems: seedHomeItems(state.profile.equipment, state.profile.homeItems),
        birthDate:
          state.profile.birthDate && parseLocalYmd(state.profile.birthDate)
            ? state.profile.birthDate
            : birthDateFromAge(state.profile.age),
        age: profileAge(state.profile),
      });
      setGoal({
        ...state.goal,
        focusAreas: state.goal.focusAreas?.length
          ? state.goal.focusAreas
          : ["full_body"],
      });
      setTargetOn(Boolean(state.goal.targetWeightKg));
      if (
        state.profile.medicalFlags.some((flag) =>
          ["cardiac", "pregnancy", "recent_injury"].includes(flag)
        )
      ) {
        setMedicalAck(true);
      }
    }
    setHydrated(true);
  }, [ready, rearmar, state, hydrated]);

  const bmi = useMemo(
    () => calcBmi(profile.weightKg, profile.heightCm),
    [profile.weightKg, profile.heightCm]
  );

  if (rearmar && !hydrated) {
    return (
      <p className="mx-auto w-full max-w-2xl px-4 py-16 text-muted-foreground">
        Cargando tu plan actual…
      </p>
    );
  }

  function update<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile((p) => ({ ...p, [key]: value }));
  }

  function toggleMedical(flag: MedicalFlag) {
    setProfile((p) => {
      if (flag === "none") {
        return { ...p, medicalFlags: p.medicalFlags.includes("none") ? [] : ["none"] };
      }
      const withoutNone = p.medicalFlags.filter((f) => f !== "none");
      const next = withoutNone.includes(flag)
        ? withoutNone.filter((f) => f !== flag)
        : [...withoutNone, flag];
      return { ...p, medicalFlags: next };
    });
  }

  function toggleDay(id: number) {
    setProfile((p) => {
      const has = p.weekdays.includes(id);
      if (has && p.weekdays.length <= 2) return p;
      const weekdays = has
        ? p.weekdays.filter((d) => d !== id)
        : [...p.weekdays, id].sort((a, b) => {
            const order = [1, 2, 3, 4, 5, 6, 0];
            return order.indexOf(a) - order.indexOf(b);
          });
      if (weekdays.length > 6) return p;
      return { ...p, weekdays };
    });
  }

  function toggleFocus(area: FocusArea) {
    setGoal((g) => {
      if (area === "full_body") return { ...g, focusAreas: ["full_body"] };
      const current = (g.focusAreas ?? ["full_body"]).filter((item) => item !== "full_body");
      const next = current.includes(area)
        ? current.filter((item) => item !== area)
        : [...current, area];
      return { ...g, focusAreas: next.length ? next : ["full_body"] };
    });
  }

  function validateStep() {
    if (step === 0) {
      if (profile.name.trim().length < 2) return "Dinos cómo te llamas.";
      if (!profile.birthDate || !parseLocalYmd(profile.birthDate)) {
        return "Indica tu fecha de nacimiento.";
      }
      const age = ageFromBirthDate(profile.birthDate);
      if (!Number.isFinite(age) || age < 16 || age > 85) {
        return "La fecha debe dar una edad entre 16 y 85 años.";
      }
    }
    if (step === 1) {
      if (profile.weightKg < 40 || profile.weightKg > 220) return "Revisa el peso (kg).";
      if (profile.heightCm < 140 || profile.heightCm > 220) return "Revisa la altura (cm).";
    }
    if (step === 2) {
      if (profile.medicalFlags.length === 0) {
        return "Marca al menos una opción, aunque sea “ninguno”.";
      }
      if (!medicalAck) {
        return "Confirma que vas a usar el plan como guía y contrastarlo con un profesional.";
      }
    }
    if (step === 3) {
      if (profile.weekdays.length < 2) return "Elige al menos 2 días.";
    }
    if (step === 4) {
      if (profile.equipment === "full_gym") {
        if ((profile.gymMachines?.length ?? 0) < 4) {
          return "Marca al menos 4 máquinas o zonas (o el pack típico).";
        }
      } else if ((profile.homeItems?.length ?? 0) < 2) {
        return "Marca al menos 2 cosas que tengas en casa (o “lo habitual”).";
      }
    }
    if (step === 5) {
      if (!goal.focusAreas?.length) return "Elige cuerpo completo o al menos una zona.";
      if (targetOn) {
        if (!goal.targetWeightKg || goal.targetWeightKg < 40 || goal.targetWeightKg > 220) {
          return "Indica un peso objetivo realista o desactívalo.";
        }
      }
    }
    return null;
  }

  function nextStepFrom(current: number) {
    return current + 1;
  }

  function prevStepFrom(current: number) {
    return current - 1;
  }

  function next() {
    const problem = validateStep();
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    if (step !== 5) {
      setStep(nextStepFrom(step));
      return;
    }
    const nextGoal = {
      ...goal,
      targetWeightKg: targetOn ? goal.targetWeightKg : null,
    };
    const nextProfile = withComputedAge(profile);
    const created =
      rearmar && state
        ? rebuildPlan(nextProfile, nextGoal)
        : startPlan(nextProfile, nextGoal);
    toast.success(
      rearmar
        ? `Plan rearmado (v${created.plan.version}). El historial se queda.`
        : `Plan v${created.plan.version} listo para ${profile.name.split(" ")[0]}`
    );
    router.push("/panel");
  }

  return (
    <form
      className={cn(
        "mx-auto w-full px-4 py-8",
        step === 4 ? "max-w-4xl" : "max-w-2xl"
      )}
      onSubmit={(e) => {
        e.preventDefault();
        next();
      }}
    >
      <p className="text-sm font-medium tracking-wide text-primary uppercase">
        {rearmar ? "Reconfigurar · " : ""}Paso{" "}
        {visibleSteps.findIndex((item) => item.id === step) + 1} de{" "}
        {visibleSteps.length}
      </p>
      <div className="mt-3 flex gap-1.5">
        {visibleSteps.map((item) => (
          <div key={item.label} className="flex-1">
            <div
              className={cn(
                "h-1.5 rounded-full",
                item.id <= step ? "bg-primary" : "bg-foreground/10"
              )}
            />
            <p
              className={cn(
                "mt-2 hidden text-xs sm:block",
                item.id === step ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {item.label}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-8">
        {step === 0 && (
          <section className="space-y-6">
            <header>
              <h1 className="font-heading text-4xl tracking-tight italic sm:text-5xl">
                {rearmar ? "Rearmamos el plan." : "Empecemos por ti."}
              </h1>
              <p className="mt-3 text-muted-foreground">
                {rearmar
                  ? "Cambia el material, las máquinas o el objetivo. Los check-ins y las sesiones hechas se quedan."
                  : "El plan cambia si tienes 24 o 64 años. La edad la sacamos de tu fecha de nacimiento."}
              </p>
            </header>
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                value={profile.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="Alex"
                className="h-11 text-base"
                autoComplete="given-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="birthDate">Fecha de nacimiento</Label>
              <Input
                id="birthDate"
                type="date"
                min={birthDateBounds().min}
                max={birthDateBounds().max}
                value={profile.birthDate ?? ""}
                onChange={(e) => {
                  const birthDate = e.target.value;
                  const age = ageFromBirthDate(birthDate);
                  setProfile((p) => ({
                    ...p,
                    birthDate,
                    age: Number.isFinite(age) ? age : p.age,
                  }));
                }}
                className="h-11 text-base"
                autoComplete="bday"
              />
              {profile.birthDate && Number.isFinite(ageFromBirthDate(profile.birthDate)) ? (
                <p className="text-sm text-muted-foreground">
                  Hoy tienes {ageFromBirthDate(profile.birthDate)} años.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  La usamos para calcular tu edad y ajustar el plan.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Sexo (para orientar el plan, no para etiquetarte)</Label>
              <div className="grid gap-2 sm:grid-cols-3">
                {(Object.keys(SEX_LABEL) as Sex[]).map((sex) => (
                  <ChoiceCard
                    key={sex}
                    selected={profile.sex === sex}
                    title={SEX_LABEL[sex]}
                    onClick={() => update("sex", sex)}
                  />
                ))}
              </div>
            </div>
          </section>
        )}

        {step === 1 && (
          <section className="space-y-6">
            <header>
              <h1 className="font-heading text-4xl tracking-tight italic sm:text-5xl">
                Peso y altura.
              </h1>
              <p className="mt-3 text-muted-foreground">
                Sirven para calcular el IMC y, si quieres, un peso objetivo más adelante.
                No es un juicio: es un dato de partida.
              </p>
            </header>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="weight">Peso (kg)</Label>
                <Input
                  id="weight"
                  type="number"
                  step="0.1"
                  value={profile.weightKg}
                  onChange={(e) => update("weightKg", Number(e.target.value))}
                  className="h-11 text-base"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="height">Altura (cm)</Label>
                <Input
                  id="height"
                  type="number"
                  value={profile.heightCm}
                  onChange={(e) => update("heightCm", Number(e.target.value))}
                  className="h-11 text-base"
                />
              </div>
            </div>
            <div className="rounded-2xl bg-primary/8 px-4 py-3">
              <p className="text-sm text-muted-foreground">IMC estimado</p>
              <p className="font-heading text-3xl italic">
                {bmi.toFixed(1)}{" "}
                <span className="text-lg not-italic text-muted-foreground">
                  · {bmiCategory(bmi)}
                </span>
              </p>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="space-y-6">
            <header>
              <h1 className="font-heading text-4xl tracking-tight italic sm:text-5xl">
                Antecedentes.
              </h1>
              <p className="mt-3 text-muted-foreground">
                Condicionan ejercicios, descansos e intensidad. Este plan es una
                guía: debe ir asistido por un profesional de la salud o del
                ejercicio. Si algo duele de verdad, se para.
              </p>
            </header>
            <div className="grid gap-2">
              {MEDICAL_OPTIONS.map((flag) => {
                const checked = profile.medicalFlags.includes(flag);
                return (
                  <label
                    key={flag}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3",
                      checked ? "border-primary bg-primary/8" : "border-border bg-card"
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleMedical(flag)}
                      className="mt-0.5"
                    />
                    <span>{MEDICAL_LABEL[flag]}</span>
                  </label>
                );
              })}
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notas (medicación, cirugías, lo que importe)</Label>
              <Textarea
                id="notes"
                value={profile.medicalNotes}
                onChange={(e) => update("medicalNotes", e.target.value)}
                placeholder="Ej. operada de menisco en 2023, me molesta al bajar escaleras."
                className="min-h-24"
              />
            </div>
            <PlanWarning />
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-foreground/8 bg-card px-4 py-4">
              <Checkbox
                checked={medicalAck}
                onCheckedChange={(v) => setMedicalAck(Boolean(v))}
                className="mt-0.5"
              />
              <span className="text-sm leading-relaxed">
                {PLAN_ACCEPTANCE_TEXT}
              </span>
            </label>
          </section>
        )}

        {step === 3 && (
          <section className="space-y-6">
            <header>
              <h1 className="font-heading text-4xl tracking-tight italic sm:text-5xl">
                Cómo puedes entrenar.
              </h1>
              <p className="mt-3 text-muted-foreground">
                Un plan de 6 días que no vas a cumplir no sirve. Elige lo real.
              </p>
            </header>
            <div className="space-y-2">
              <Label>Experiencia</Label>
              <div className="grid gap-2">
                {(Object.keys(EXPERIENCE_LABEL) as Experience[]).map((exp) => (
                  <ChoiceCard
                    key={exp}
                    selected={profile.experience === exp}
                    title={EXPERIENCE_LABEL[exp]}
                    hint={EXPERIENCE_HINT[exp]}
                    onClick={() => update("experience", exp)}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Material</Label>
              <div className="grid gap-2 sm:grid-cols-3">
                {(Object.keys(EQUIPMENT_LABEL) as Equipment[]).map((eq) => (
                  <ChoiceCard
                    key={eq}
                    selected={profile.equipment === eq}
                    title={EQUIPMENT_LABEL[eq]}
                    hint={EQUIPMENT_HINT[eq]}
                    onClick={() =>
                      setProfile((p) => ({
                        ...p,
                        equipment: eq,
                        gymMachines:
                          eq === "full_gym" && !p.gymMachines?.length
                            ? [...TYPICAL_GYM_MACHINE_IDS]
                            : p.gymMachines,
                        homeItems: seedHomeItems(eq, p.homeItems),
                      }))
                    }
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Días (mínimo 2, máximo 6)</Label>
              <div className="grid grid-cols-7 gap-1.5">
                {WEEKDAYS.map((d) => {
                  const on = profile.weekdays.includes(d.id);
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => toggleDay(d.id)}
                      className={cn(
                        "rounded-2xl py-3 text-sm font-medium",
                        on
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {d.short}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Duración de cada sesión</Label>
              <div className="grid grid-cols-4 gap-2">
                {[30, 45, 60, 75].map((min) => (
                  <ChoiceCard
                    key={min}
                    selected={profile.sessionMinutes === min}
                    title={`${min} min`}
                    onClick={() => update("sessionMinutes", min)}
                  />
                ))}
              </div>
            </div>
          </section>
        )}

        {step === 4 && profile.equipment === "full_gym" && (
          <section className="space-y-6">
            <header>
              <h1 className="font-heading text-4xl tracking-tight italic sm:text-5xl">
                Qué hay en tu gimnasio.
              </h1>
              <p className="mt-3 text-muted-foreground">
                Marca solo lo que puedes usar. El plan se arma con esas máquinas; si
                falta un patrón, hay variante de peso corporal.
              </p>
            </header>
            <GymMachinePicker
              selected={profile.gymMachines ?? []}
              onChange={(ids) => update("gymMachines", ids)}
            />
          </section>
        )}

        {step === 4 && profile.equipment !== "full_gym" && (
          <section className="space-y-6">
            <header>
              <h1 className="font-heading text-4xl tracking-tight italic sm:text-5xl">
                Qué tienes en casa.
              </h1>
              <p className="mt-3 text-muted-foreground">
                Marca solo lo que puedes usar de verdad: mancuernas, bandas, una
                silla, la pared. El plan se arma con eso.
              </p>
            </header>
            <HomeItemPicker
              selected={profile.homeItems ?? []}
              equipment={profile.equipment}
              onChange={(ids) => update("homeItems", ids)}
            />
          </section>
        )}

        {step === 5 && (
          <section className="space-y-6">
            <header>
              <h1 className="font-heading text-4xl tracking-tight italic sm:text-5xl">
                Qué quieres conseguir.
              </h1>
              <p className="mt-3 text-muted-foreground">
                Corto, mediano o largo plazo cambia el ritmo, no solo el calendario.
              </p>
            </header>
            <div className="space-y-2">
              <Label>Horizonte</Label>
              <div className="grid gap-2 sm:grid-cols-3">
                {(Object.keys(HORIZON_LABEL) as Horizon[]).map((h) => (
                  <ChoiceCard
                    key={h}
                    selected={goal.horizon === h}
                    title={HORIZON_LABEL[h]}
                    hint={HORIZON_HINT[h]}
                    onClick={() => setGoal((g) => ({ ...g, horizon: h }))}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Objetivo principal</Label>
              <div className="grid gap-2">
                {(Object.keys(GOAL_LABEL) as GoalType[]).map((type) => (
                  <ChoiceCard
                    key={type}
                    selected={goal.type === type}
                    title={GOAL_LABEL[type]}
                    hint={GOAL_HINT[type]}
                    onClick={() => setGoal((g) => ({ ...g, type }))}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Qué quieres ejercitar</Label>
              <p className="text-sm text-muted-foreground">
                Cuerpo completo, o marca las zonas que más te importan. El plan les da más volumen.
              </p>
              <ChoiceCard
                selected={(goal.focusAreas ?? ["full_body"]).includes("full_body")}
                title={FOCUS_AREA_LABEL.full_body}
                hint={FOCUS_AREA_HINT.full_body}
                onClick={() => toggleFocus("full_body")}
              />
              <div className="grid gap-2 sm:grid-cols-2">
                {FOCUS_ZONE_OPTIONS.map((area) => (
                  <ChoiceCard
                    key={area}
                    selected={(goal.focusAreas ?? []).includes(area)}
                    title={FOCUS_AREA_LABEL[area]}
                    hint={FOCUS_AREA_HINT[area]}
                    onClick={() => toggleFocus(area)}
                  />
                ))}
              </div>
            </div>
            <label className="flex items-center gap-3 text-sm">
              <Checkbox
                checked={targetOn}
                onCheckedChange={(v) => setTargetOn(Boolean(v))}
              />
              Quiero un peso objetivo
            </label>
            {targetOn && (
              <div className="space-y-2">
                <Label htmlFor="target">Peso objetivo (kg)</Label>
                <Input
                  id="target"
                  type="number"
                  step="0.1"
                  value={goal.targetWeightKg ?? ""}
                  onChange={(e) =>
                    setGoal((g) => ({
                      ...g,
                      targetWeightKg: e.target.value ? Number(e.target.value) : null,
                    }))
                  }
                  className="h-11 text-base"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="goal-notes">Algo más que debamos tener en cuenta</Label>
              <Textarea
                id="goal-notes"
                value={goal.notes}
                onChange={(e) => setGoal((g) => ({ ...g, notes: e.target.value }))}
                placeholder="Ej. boda en 4 meses, o quiero sentirme fuerte en las cuestas."
              />
            </div>
          </section>
        )}
      </div>

      {error && (
        <p className="mt-6 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="mt-8 flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setError(null);
            if (step === 0) router.push(rearmar ? "/panel" : "/");
            else setStep(prevStepFrom(step));
          }}
          className="h-11 px-4"
        >
          <ArrowLeft data-icon="inline-start" />
          Atrás
        </Button>
        <Button
          type="submit"
          className="h-11 px-5"
          onClick={(e) => {
            e.preventDefault();
            next();
          }}
        >
          {step === 5
            ? rearmar
              ? "Rearmar mi plan"
              : "Armar mi plan"
            : "Continuar"}
          <ArrowRight data-icon="inline-end" />
        </Button>
      </div>
    </form>
  );
}
