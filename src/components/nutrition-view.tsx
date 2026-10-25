"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Apple, Droplets, UtensilsCrossed } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { WeeklyMenuSection } from "@/components/weekly-menu-section";
import { useAppStore } from "@/components/app-provider";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { GOAL_LABEL } from "@/lib/labels";
import { currentWeight } from "@/lib/metrics";
import {
  buildNutritionGuide,
  NUTRITION_ACCEPTANCE_TEXT,
  NUTRITION_PROFESSIONAL_WARNING,
} from "@/lib/nutrition";
import { teacherRoleWord } from "@/lib/labels";
import { loadAssignedTeacher } from "@/lib/studio";
import type { Sex } from "@/lib/types";
import { cn } from "@/lib/utils";

function Macro({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <Card>
      <CardContent className="py-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 font-heading text-3xl italic tabular-nums">
          {value}
          <span className="ml-1 text-lg font-sans not-italic text-muted-foreground">
            {unit}
          </span>
        </p>
      </CardContent>
    </Card>
  );
}

function NutritionWarning({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-primary/30 bg-primary/8 p-4">
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-primary" />
      <div className="space-y-2 text-sm leading-relaxed">
        <p className="font-medium">{NUTRITION_PROFESSIONAL_WARNING}</p>
        {!compact && (
          <p className="text-muted-foreground">
            Las calorías y raciones se estiman con tu perfil. No tienen en
            cuenta alergias, intolerancias, analíticas ni medicación. Si algo
            no encaja con lo que te ha dicho un profesional, manda lo que te
            haya dicho el profesional.
          </p>
        )}
      </div>
    </div>
  );
}

export function NutritionView() {
  const router = useRouter();
  const { ready, state, account, acceptNutritionGuide, saveNutritionMenu } =
    useAppStore();
  const [acceptedNotice, setAcceptedNotice] = useState(false);
  const [assignedTeacher, setAssignedTeacher] = useState<string | null>(null);
  const [assignedTeacherSex, setAssignedTeacherSex] = useState<Sex | null>(null);
  const studioStudent =
    account?.role === "client" && account.studioRole === "client";

  useEffect(() => {
    if (!ready || state || studioStudent) return;
    router.replace("/comenzar");
  }, [ready, state, studioStudent, router]);

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

  if (!ready) {
    return (
      <div className="flex min-h-svh items-center justify-center text-muted-foreground">
        Cargando tu guía…
      </div>
    );
  }

  if (!state) {
    if (studioStudent) {
      return (
        <div className="min-h-svh bg-background">
          <SiteHeader />
          <main className="mx-auto w-full max-w-xl px-4 py-10">
            <p className="text-sm font-medium tracking-wide text-primary uppercase">
              Nutrición
            </p>
            <h1 className="mt-1 font-heading text-4xl tracking-tight italic">
              Primero tu plan.
            </h1>
            <p className="mt-3 text-muted-foreground">
              Cuando tengas un plan de ejercicios, acá armás un menú semanal
              alineado con ese entreno y tu objetivo.
            </p>
            <Link
              href="/panel"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "mt-6 h-11 px-4"
              )}
            >
              Ir a mi plan
            </Link>
          </main>
        </div>
      );
    }
    return (
      <div className="flex min-h-svh items-center justify-center text-muted-foreground">
        Cargando tu guía…
      </div>
    );
  }

  const firstName = state.profile.name.split(" ")[0];
  const teacherFood = state.plan.coachNutrition ?? [];
  const teacherName =
    state.plan.loadedBy?.name.trim() || assignedTeacher || null;
  const role = teacherRoleWord(assignedTeacherSex);
  const teacherLabel = teacherName
    ? `Tu ${role} ${teacherName}`
    : `Tu ${role}`;

  if (!state.nutritionAcceptedAt) {
    return (
      <div className="min-h-svh bg-background">
        <SiteHeader />
        <main className="mx-auto w-full max-w-xl px-4 py-10">
          <p className="text-sm font-medium tracking-wide text-primary uppercase">
            Nutrición
          </p>
          <h1 className="mt-1 font-heading text-4xl tracking-tight italic">
            Un aviso, {firstName}.
          </h1>
          <p className="mt-3 text-muted-foreground">
            Antes de las cifras y el día tipo, esto tiene que quedar claro.
          </p>
          <div className="mt-8">
            <NutritionWarning />
          </div>
          <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-foreground/8 bg-card px-4 py-4">
            <Checkbox
              checked={acceptedNotice}
              onCheckedChange={(value) => setAcceptedNotice(Boolean(value))}
              className="mt-0.5"
            />
            <span className="text-sm leading-relaxed">
              {NUTRITION_ACCEPTANCE_TEXT}
            </span>
          </label>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button
              className="h-11 px-4"
              disabled={!acceptedNotice}
              onClick={acceptNutritionGuide}
            >
              Acepto y ver la guía
            </Button>
            <Link
              href="/panel"
              className={cn(buttonVariants({ variant: "outline" }), "h-11 px-4")}
            >
              Volver al plan
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const weight = currentWeight(state);
  const guide = buildNutritionGuide(state.profile, state.goal, weight);

  return (
    <div className="min-h-svh bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl px-4 py-8">
        <p className="text-sm font-medium tracking-wide text-primary uppercase">
          Nutrición · {GOAL_LABEL[state.goal.type]}
        </p>
        <h1 className="mt-1 font-heading text-4xl tracking-tight italic sm:text-5xl">
          Comer, en bruto.
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          {firstName}, esto va con tu plan de ejercicios, no es un menú de
          revista. Usá las manos como medida y repetí platos que puedas
          aguantar. {guide.summary}
        </p>

        <div className="mt-6">
          <NutritionWarning compact />
        </div>

        {teacherFood.length > 0 ? (
          <section className="mt-8 rounded-3xl border border-foreground/8 bg-card p-5">
            <p className="font-medium">Indicaciones de {teacherLabel}</p>
            <ul className="mt-3 list-disc space-y-1.5 pl-4 text-sm text-muted-foreground">
              {teacherFood.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Macro label="Calorías / día" value={String(guide.calories)} unit="kcal" />
          <Macro label="Proteína" value={String(guide.proteinG)} unit="g" />
          <Macro label="Carbohidratos" value={String(guide.carbsG)} unit="g" />
          <Macro label="Grasa" value={String(guide.fatG)} unit="g" />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{guide.calorieNote}</p>
        <p className="mt-1 text-sm text-muted-foreground">{guide.proteinNote}</p>

        <WeeklyMenuSection
          prefs={state.nutritionPrefs}
          menu={state.weeklyMenu}
          onSave={saveNutritionMenu}
        />

        {guide.medical.length > 0 && (
          <div className="mt-6 flex gap-3 rounded-2xl border border-primary/30 bg-primary/8 p-4">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-primary" />
            <ul className="space-y-2 text-sm">
              {guide.medical.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        <section className="mt-10">
          <h2 className="font-heading text-2xl italic">Las reglas que sí importan</h2>
          <ul className="mt-4 space-y-3">
            {guide.principles.map((item) => (
              <li
                key={item}
                className="rounded-2xl border border-foreground/8 bg-card px-4 py-3 text-sm leading-relaxed"
              >
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-10">
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="size-5 text-primary" />
            <h2 className="font-heading text-2xl italic">Un día tipo</h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Palma de proteína, puño de carbohidrato, medio plato de verdura.
            Ajusta raciones, no reinventes el menú cada lunes.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {guide.meals.map((meal) => (
              <Card key={meal.name}>
                <CardHeader>
                  <CardTitle className="font-heading text-xl italic">
                    {meal.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc space-y-1.5 pl-4 text-sm text-muted-foreground">
                    {meal.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  {meal.note && (
                    <p className="mt-3 text-sm text-foreground/80">{meal.note}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="font-heading text-2xl italic">Alrededor del entreno</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {guide.training.map((block) => (
              <article
                key={block.title}
                className="rounded-3xl border border-foreground/8 bg-card p-5"
              >
                <p className="font-medium">{block.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {block.text}
                </p>
              </article>
            ))}
          </div>
        </section>

        {!state.weeklyMenu && (
        <section className="mt-10">
          <div className="flex items-center gap-2">
            <Apple className="size-5 text-primary" />
            <h2 className="font-heading text-2xl italic">Lista de la compra</h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Cuando armes el menú semanal, la compra se detalla ahí.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {guide.groceries.map((group) => (
              <Card key={group.group}>
                <CardHeader>
                  <CardTitle>{group.group}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1.5 text-sm text-muted-foreground">
                    {group.items.map((item) => (
                      <li key={item}>· {item}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
        )}

        <section className="mt-10 flex gap-3 rounded-2xl border px-4 py-4">
          <Droplets className="mt-0.5 size-5 shrink-0 text-primary" />
          <div>
            <p className="font-medium">Agua y café</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Unos 30–35 ml por kg ({Math.round(weight * 32)} ml de orientación).
              El café cuenta como líquido; el alcohol, como calorías que no
              entrenan.
            </p>
          </div>
        </section>

        <p className="mt-8 text-xs leading-relaxed text-muted-foreground">
          {guide.disclaimer}
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/panel" className={cn(buttonVariants(), "h-11 px-4")}>
            Volver a mi plan
          </Link>
          <Badge variant="outline" className="h-11 justify-center px-4 font-normal">
            Cifras con tu peso actual: {weight.toFixed(1)} kg
          </Badge>
        </div>
      </main>
    </div>
  );
}
