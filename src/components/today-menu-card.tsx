"use client";

import Link from "next/link";
import { UtensilsCrossed } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { weekdayName } from "@/lib/labels";
import { MEAL_SLOT_LABEL } from "@/lib/weekly-menu";
import type { WeeklyMenu } from "@/lib/types";
import { cn } from "@/lib/utils";

export function TodayMenuCard({ menu }: { menu: WeeklyMenu }) {
  const weekday = new Date().getDay();
  const day = menu.days.find((item) => item.weekday === weekday);
  if (!day || day.meals.length === 0) return null;

  return (
    <section className="mt-6 rounded-3xl border border-foreground/8 bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="size-5 shrink-0 text-primary" />
            <h2 className="font-heading text-2xl italic">
              Menú de hoy · {weekdayName(weekday)}
            </h2>
          </div>
          {day.note ? (
            <p className="mt-2 text-sm text-muted-foreground">{day.note}</p>
          ) : day.trainingName ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Alineado con {day.trainingName}.
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Día de descanso: comidas más ligeras.
            </p>
          )}
        </div>
        <Link
          href="/nutricion"
          className={cn(buttonVariants({ variant: "outline" }), "h-10 px-3")}
        >
          Ver semana
        </Link>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {day.meals.map((meal) => (
          <div
            key={meal.slot}
            className="rounded-2xl border border-foreground/8 bg-background/60 px-4 py-3"
          >
            <p className="text-xs font-medium tracking-wide text-primary uppercase">
              {MEAL_SLOT_LABEL[meal.slot]}
            </p>
            <p className="mt-1 font-medium">{meal.title}</p>
            <ul className="mt-1 list-disc pl-4 text-sm text-muted-foreground">
              {meal.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            {meal.note ? (
              <p className="mt-2 text-xs text-foreground/70">{meal.note}</p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
