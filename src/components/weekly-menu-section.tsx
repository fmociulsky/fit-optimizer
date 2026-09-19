"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { weekdayName } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { FoodDislike, FoodRestriction, NutritionPrefs, WeeklyMenu } from "@/lib/types";
import {
  ALLERGY_OPTIONS,
  DISLIKE_OPTIONS,
  MEAL_SLOT_LABEL,
  emptyNutritionPrefs,
} from "@/lib/weekly-menu";

export function WeeklyMenuSection({
  prefs,
  menu,
  onSave,
}: {
  prefs?: NutritionPrefs;
  menu?: WeeklyMenu;
  onSave: (next: NutritionPrefs) => void;
}) {
  const [editing, setEditing] = useState(!menu);
  const [draft, setDraft] = useState<NutritionPrefs>(prefs ?? emptyNutritionPrefs());

  function toggleRestriction(id: FoodRestriction) {
    setDraft((current) => {
      if (id === "none") {
        return { ...current, restrictions: ["none"] };
      }
      const withoutNone = current.restrictions.filter((item) => item !== "none");
      const next = withoutNone.includes(id)
        ? withoutNone.filter((item) => item !== id)
        : [...withoutNone, id];
      return { ...current, restrictions: next.length ? next : ["none"] };
    });
  }

  function toggleDislike(id: FoodDislike) {
    setDraft((current) => ({
      ...current,
      dislikes: current.dislikes.includes(id)
        ? current.dislikes.filter((item) => item !== id)
        : [...current.dislikes, id],
    }));
  }

  function submit() {
    onSave(draft);
    setEditing(false);
  }

  return (
    <section className="mt-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays className="size-5 text-primary" />
            <h2 className="font-heading text-2xl italic">Menú de la semana</h2>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Siete días alineados con tu entreno, tu objetivo y tu edad. Primero
            las alergias, intolerancias y lo que no te apetece.
          </p>
        </div>
        {menu && !editing && (
          <Button
            variant="outline"
            className="h-11 px-4"
            onClick={() => {
              setDraft(prefs ?? emptyNutritionPrefs());
              setEditing(true);
            }}
          >
            Cambiar filtros y rearmar
          </Button>
        )}
      </div>

      {editing && (
        <div className="mt-5 space-y-6 rounded-3xl border border-foreground/8 bg-card p-4 sm:p-5">
          <div>
            <p className="font-medium">Alergias o intolerancias</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Esto se excluye del todo. No es un diagnóstico: es lo que nos
              cuentas.
            </p>
            <div className="mt-3 grid gap-2">
              {ALLERGY_OPTIONS.map((option) => {
                const checked = draft.restrictions.includes(option.id);
                return (
                  <label
                    key={option.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3",
                      checked
                        ? "border-primary bg-primary/8"
                        : "border-border"
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleRestriction(option.id)}
                      className="mt-0.5"
                    />
                    <span className="text-sm">{option.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <div>
            <p className="font-medium">Comidas que no te apetecen</p>
            <p className="mt-1 text-sm text-muted-foreground">
              No es alergia: es gusto. El menú no te las pone.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {DISLIKE_OPTIONS.map((option) => {
                const checked = draft.dislikes.includes(option.id);
                return (
                  <label
                    key={option.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3",
                      checked
                        ? "border-primary bg-primary/8"
                        : "border-border"
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleDislike(option.id)}
                      className="mt-0.5"
                    />
                    <span className="text-sm">{option.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="food-notes">Otras notas (opcional)</Label>
            <Textarea
              id="food-notes"
              value={draft.notes}
              onChange={(event) =>
                setDraft((current) => ({ ...current, notes: event.target.value }))
              }
              placeholder="Ej. no me sienta el brócoli, prefiero cocina suave, ceno pronto…"
              className="min-h-24"
            />
          </div>
          <Button className="h-11 px-4" onClick={submit}>
            Armar el menú de la semana
          </Button>
        </div>
      )}

      {menu && !editing && <WeeklyMenuBoard menu={menu} />}
    </section>
  );
}

function WeeklyMenuBoard({ menu }: { menu: WeeklyMenu }) {
  return (
    <div className="mt-5 space-y-5">
      <p className="text-sm text-muted-foreground">{menu.summary}</p>
      <ul className="space-y-2">
        {menu.rationale.map((item) => (
          <li
            key={item}
            className="rounded-2xl border border-foreground/8 bg-card px-4 py-3 text-sm leading-relaxed"
          >
            {item}
          </li>
        ))}
      </ul>
      <div className="grid gap-4">
        {menu.days.map((day) => (
          <Card key={day.weekday}>
            <CardHeader className="border-b">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="font-heading text-xl italic">
                  {weekdayName(day.weekday)}
                </CardTitle>
                {day.trainingName ? (
                  <Badge variant="secondary">{day.trainingName}</Badge>
                ) : (
                  <Badge variant="outline">Descanso</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{day.note}</p>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {day.meals.map((meal) => (
                  <div key={`${day.weekday}-${meal.slot}`}>
                    <p className="text-xs font-medium tracking-wide text-primary uppercase">
                      {MEAL_SLOT_LABEL[meal.slot]}
                    </p>
                    <p className="mt-1 font-medium">{meal.title}</p>
                    <ul className="mt-1 list-disc pl-4 text-sm text-muted-foreground">
                      {meal.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                    {meal.note && (
                      <p className="mt-2 text-xs text-foreground/70">{meal.note}</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div>
        <h3 className="font-heading text-xl italic">Lista de la compra (semana)</h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          {menu.groceries.map((group) => (
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
      </div>
    </div>
  );
}
