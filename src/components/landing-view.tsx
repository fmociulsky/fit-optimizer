"use client";

import Link from "next/link";
import { ArrowRight, HeartPulse, Target, TimerReset } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/components/app-provider";

const STEPS = [
  {
    icon: Target,
    title: "Objetivo con fecha",
    text: "Corto (6 semanas), mediano (16) o largo (36). El horizonte cambia el ritmo, no solo el calendario.",
  },
  {
    icon: HeartPulse,
    title: "Tu cuerpo, no una plantilla",
    text: "Edad, peso, altura, experiencia, material y antecedentes. El plan se recorta donde hace falta.",
  },
  {
    icon: TimerReset,
    title: "Check-in y reajuste",
    text: "Cada semana te pedimos peso, energía, sueño y molestias. Si algo no cuadra, el plan se mueve.",
  },
];

export function LandingView() {
  const { ready, state } = useAppStore();
  const hasPlan = ready && Boolean(state);

  return (
    <div className="min-h-svh bg-background">
      <SiteHeader compact={!hasPlan} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pb-16 pt-10 sm:pt-16">
        <p className="text-sm font-medium tracking-wide text-primary uppercase">
          Entrenamiento con seguimiento
        </p>
        <h1 className="mt-4 max-w-3xl font-heading text-5xl leading-[1.05] tracking-tight italic sm:text-7xl">
          Di tu meta. Te armamos el plan.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
          Corto, mediano o largo plazo. Con tu edad, peso, altura y
          antecedentes. Y un seguimiento que pregunta de verdad para
          reajustar, no para llenar una gráfica.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button className="h-12 px-6 text-base" render={<Link href={hasPlan ? "/panel" : "/comenzar"} />}>
            {hasPlan ? "Seguir mi plan" : "Empezar mi plan"}
            <ArrowRight data-icon="inline-end" />
          </Button>
          {hasPlan && (
            <Button
              variant="outline"
              className="h-12 px-6 text-base"
              render={<Link href="/comenzar" />}
            >
              Armar uno nuevo
            </Button>
          )}
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-3">
          {STEPS.map((step) => (
            <article
              key={step.title}
              className="rounded-3xl border border-foreground/8 bg-card p-5"
            >
              <step.icon className="size-5 text-primary" />
              <h2 className="mt-4 font-heading text-2xl italic">{step.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {step.text}
              </p>
            </article>
          ))}
        </div>

        <p className="mt-16 max-w-2xl text-xs leading-relaxed text-muted-foreground">
          Enforma no es un diagnóstico ni sustituye consejo médico. Si tienes
          antecedentes cardíacos, lesión, embarazo o cualquier condición, habla
          con un profesional de la salud antes de empezar.
        </p>
      </main>
    </div>
  );
}
