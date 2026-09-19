"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Brain, CheckCircle2 } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { useAppStore } from "@/components/app-provider";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { weekdayName } from "@/lib/labels";
import { isoDate, jsWeekday } from "@/lib/metrics";
import {
  MIND_ACCEPTANCE_TEXT,
  MIND_FOCUS_OPTIONS,
  MIND_PROFESSIONAL_WARNING,
  MIND_WARNING_DETAIL,
  buildMindGuide,
  emptyMindPrefs,
  type MindPractice,
} from "@/lib/mind";
import type { MindFocus, MindPrefs } from "@/lib/types";
import { cn } from "@/lib/utils";

function MindWarning({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-primary/30 bg-primary/8 p-4">
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-primary" />
      <div className="space-y-2 text-sm leading-relaxed">
        <p className="font-medium">{MIND_PROFESSIONAL_WARNING}</p>
        {!compact && (
          <p className="text-muted-foreground">{MIND_WARNING_DETAIL}</p>
        )}
      </div>
    </div>
  );
}

function PracticeBody({
  practice,
  done,
  onDone,
}: {
  practice: MindPractice;
  done?: boolean;
  onDone?: () => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Cuándo: </span>
        {practice.when}
      </p>
      <div>
        <p className="text-xs font-medium tracking-wide text-primary uppercase">
          Qué es esto
        </p>
        <p className="mt-1 text-sm leading-relaxed">{practice.what}</p>
      </div>
      <div>
        <p className="text-xs font-medium tracking-wide text-primary uppercase">
          Antes de empezar
        </p>
        <ul className="mt-1 list-disc space-y-1.5 pl-4 text-sm leading-relaxed">
          {practice.setup.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <div>
        <p className="text-xs font-medium tracking-wide text-primary uppercase">
          Pasos
        </p>
        <ol className="mt-1 list-decimal space-y-2 pl-4 text-sm leading-relaxed">
          {practice.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>
      {practice.ifStuck.length > 0 && (
        <div>
          <p className="text-xs font-medium tracking-wide text-primary uppercase">
            Si te pasa esto
          </p>
          <ul className="mt-2 space-y-2">
            {practice.ifStuck.map((item) => (
              <li
                key={item.ifThis}
                className="rounded-xl bg-muted/60 px-3 py-2 text-sm leading-relaxed"
              >
                <span className="font-medium">{item.ifThis}. </span>
                <span className="text-muted-foreground">{item.then}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-sm leading-relaxed">
        <span className="font-medium">Ya está cuando: </span>
        <span className="text-muted-foreground">{practice.doneWhen}</span>
      </p>
      <div>
        <p className="text-xs font-medium tracking-wide text-primary uppercase">
          Para qué sirve
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{practice.why}</p>
      </div>
      {onDone && (
        done ? (
          <p className="flex items-center gap-2 text-sm font-medium">
            <CheckCircle2 className="size-4 text-primary" />
            Hecha hoy
          </p>
        ) : (
          <Button className="h-11 px-4" variant="outline" onClick={onDone}>
            Marcar como hecha
          </Button>
        )
      )}
    </div>
  );
}

function PracticeCard({
  practice,
  done,
  onDone,
}: {
  practice: MindPractice;
  done?: boolean;
  onDone?: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="font-heading text-xl italic">
            {practice.title}
          </CardTitle>
          <Badge variant="secondary">{practice.minutes} min</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <PracticeBody practice={practice} done={done} onDone={onDone} />
      </CardContent>
    </Card>
  );
}

export function MindView() {
  const router = useRouter();
  const { ready, state, acceptMindGuide, saveMindPrefs, logMindPractice } =
    useAppStore();
  const [acceptedNotice, setAcceptedNotice] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<MindPrefs>(emptyMindPrefs());

  useEffect(() => {
    if (ready && !state) router.replace("/comenzar");
  }, [ready, state, router]);

  useEffect(() => {
    if (state?.mindPrefs) setDraft(state.mindPrefs);
  }, [state?.mindPrefs]);

  const guide = useMemo(() => {
    if (!state?.mindPrefs) return null;
    return buildMindGuide({
      profile: state.profile,
      goal: state.goal,
      plan: state.plan,
      prefs: state.mindPrefs,
      lastCheck: state.checkIns.at(-1),
      weekday: jsWeekday(),
    });
  }, [state]);

  if (!ready || !state) {
    return (
      <div className="flex min-h-svh items-center justify-center text-muted-foreground">
        Cargando tu guía…
      </div>
    );
  }

  const firstName = state.profile.name.split(" ")[0];
  const todayStamp = isoDate();

  function toggleFocus(id: MindFocus) {
    setDraft((current) => {
      const next = current.focuses.includes(id)
        ? current.focuses.filter((item) => item !== id)
        : [...current.focuses, id];
      return { ...current, focuses: next };
    });
  }

  function submitPrefs() {
    if (!draft.focuses.length) return;
    saveMindPrefs(draft);
    setEditing(false);
  }

  if (!state.mindAcceptedAt) {
    return (
      <div className="min-h-svh bg-background">
        <SiteHeader />
        <main className="mx-auto w-full max-w-xl px-4 py-10">
          <p className="text-sm font-medium tracking-wide text-primary uppercase">
            Mente
          </p>
          <h1 className="mt-1 font-heading text-4xl tracking-tight italic">
            Un aviso, {firstName}.
          </h1>
          <p className="mt-3 text-muted-foreground">
            Antes de sentarte cinco minutos, esto tiene que quedar claro.
          </p>
          <div className="mt-8">
            <MindWarning />
          </div>
          <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-foreground/8 bg-card px-4 py-4">
            <Checkbox
              checked={acceptedNotice}
              onCheckedChange={(value) => setAcceptedNotice(Boolean(value))}
              className="mt-0.5"
            />
            <span className="text-sm leading-relaxed">
              {MIND_ACCEPTANCE_TEXT}
            </span>
          </label>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button
              className="h-11 px-4"
              disabled={!acceptedNotice}
              onClick={acceptMindGuide}
            >
              Acepto y seguir
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

  const showForm = !state.mindPrefs || editing;

  return (
    <div className="min-h-svh bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl px-4 py-8">
        <p className="text-sm font-medium tracking-wide text-primary uppercase">
          Mente
        </p>
        <h1 className="mt-1 font-heading text-4xl tracking-tight italic sm:text-5xl">
          Minutos para la cabeza.
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          {firstName}, esto va con el plan físico, no en contra. Cada práctica
          te dice qué hacer, cómo sentarte, cómo contar y qué hacer si te
          pierdes. Cinco minutos hechos ganan a media hora imaginada.
        </p>
        <div className="mt-6">
          <MindWarning compact />
        </div>

        {showForm && (
          <section className="mt-8 space-y-5 rounded-3xl border border-foreground/8 bg-card p-4 sm:p-5">
            <div>
              <h2 className="font-heading text-2xl italic">Qué te está costando</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Elige una o varias. Según eso, y según si hoy toca entreno o
                descanso, te salen prácticas distintas con los pasos escritos.
              </p>
            </div>
            <div className="grid gap-2">
              {MIND_FOCUS_OPTIONS.map((option) => {
                const checked = draft.focuses.includes(option.id);
                return (
                  <label
                    key={option.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3",
                      checked ? "border-primary bg-primary/8" : "border-border"
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleFocus(option.id)}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="block text-sm font-medium">{option.label}</span>
                      <span className="text-sm text-muted-foreground">
                        {option.hint}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            <div className="space-y-2">
              <Label htmlFor="mind-notes">Notas (opcional)</Label>
              <Textarea
                id="mind-notes"
                value={draft.notes}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, notes: event.target.value }))
                }
                placeholder="Ej. me cuesta desconectar después de entrenar, duermo fatal los domingos…"
                className="min-h-24"
              />
            </div>
            <Button
              className="h-11 px-4"
              disabled={!draft.focuses.length}
              onClick={submitPrefs}
            >
              Crear mis prácticas
            </Button>
          </section>
        )}

        {guide && !showForm && (
          <>
            <p className="mt-6 text-sm text-muted-foreground">{guide.summary}</p>
            <div className="mt-4 flex justify-end">
              <Button
                variant="outline"
                className="h-11 px-4"
                onClick={() => setEditing(true)}
              >
                Cambiar el foco
              </Button>
            </div>

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

            <section className="mt-8">
              <div className="flex items-center gap-2">
                <Brain className="size-5 text-primary" />
                <h2 className="font-heading text-2xl italic">Hoy</h2>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{guide.todayNote}</p>
              <p className="mt-3 rounded-2xl border border-foreground/8 bg-card px-4 py-3 text-sm leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">Cómo leer cada una: </span>
                primero qué es, luego cómo te colocas, después los pasos
                numerados. Si te mareas, te aburres o te despistas, mira
                “Si te pasa esto”. Cuando suena el temporizador, ya cuenta.
              </p>
              <div className="mt-4 grid gap-4">
                {guide.today.map((practice) => (
                  <PracticeCard
                    key={practice.id}
                    practice={practice}
                    done={state.mindLogs?.some(
                      (log) =>
                        log.practiceId === practice.id &&
                        isoDate(new Date(log.date)) === todayStamp
                    )}
                    onDone={() => {
                      logMindPractice(practice.id);
                      toast.success("Anotado. La cabeza también entrena.");
                    }}
                  />
                ))}
              </div>
            </section>

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
              <h2 className="font-heading text-2xl italic">La semana</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Abre cada práctica para ver los mismos pasos que en Hoy:
                colocación, cuenta y qué hacer si te pierdes.
              </p>
              <div className="mt-4 grid gap-3">
                {guide.week.map((day) => (
                  <div
                    key={day.weekday}
                    className="rounded-2xl border border-foreground/8 bg-card px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{weekdayName(day.weekday)}</p>
                      {day.trainingName ? (
                        <Badge variant="secondary">{day.trainingName}</Badge>
                      ) : (
                        <Badge variant="outline">Descanso</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{day.note}</p>
                    <ul className="mt-3 space-y-2">
                      {day.practices.map((practice) => (
                        <li key={practice.id}>
                          <details className="group rounded-xl border border-foreground/8 bg-background px-3 py-2">
                            <summary className="cursor-pointer list-none text-sm leading-relaxed [&::-webkit-details-marker]:hidden">
                              <span className="font-medium">{practice.title}</span>
                              <span className="text-muted-foreground">
                                {" "}
                                · {practice.minutes} min · {practice.when}
                              </span>
                              <span className="mt-1 block text-xs text-primary group-open:hidden">
                                Ver pasos
                              </span>
                            </summary>
                            <div className="mt-3 border-t border-foreground/8 pt-3">
                              <PracticeBody practice={practice} />
                            </div>
                          </details>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        <div className="mt-8">
          <Link href="/panel" className={cn(buttonVariants(), "h-11 px-4")}>
            Volver a mi plan
          </Link>
        </div>
      </main>
    </div>
  );
}
