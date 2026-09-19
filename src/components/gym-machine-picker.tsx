"use client";

import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  GYM_CATEGORIES,
  GYM_MACHINES,
  TYPICAL_GYM_MACHINE_IDS,
  type GymCategory,
} from "@/lib/gym-machines";
import { cn } from "@/lib/utils";

export function GymMachinePicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [category, setCategory] = useState<GymCategory | "Todas">("Todas");
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const visible = useMemo(
    () =>
      category === "Todas"
        ? GYM_MACHINES
        : GYM_MACHINES.filter((machine) => machine.category === category),
    [category]
  );

  function toggle(id: string) {
    onChange(
      selectedSet.has(id)
        ? selected.filter((item) => item !== id)
        : [...selected, id]
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {(["Todas", ...GYM_CATEGORIES] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setCategory(item)}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm",
              category === item
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted-foreground">
          {selected.length} de {GYM_MACHINES.length} seleccionadas
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange([...TYPICAL_GYM_MACHINE_IDS])}
        >
          Típico de gimnasio
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange(GYM_MACHINES.map((machine) => machine.id))}
        >
          Todas
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange([])}>
          Ninguna
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {visible.map((machine) => {
          const on = selectedSet.has(machine.id);
          return (
            <button
              key={machine.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(machine.id)}
              className={cn(
                "overflow-hidden rounded-2xl border text-left transition-colors",
                on
                  ? "border-primary ring-1 ring-primary"
                  : "border-border hover:border-primary/40"
              )}
            >
              <span className="relative block aspect-[4/3] bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={machine.photo}
                  alt=""
                  className="size-full object-cover"
                />
                {on && (
                  <span className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3.5" />
                  </span>
                )}
              </span>
              <span className="block px-3 py-2">
                <span className="block text-sm font-medium leading-tight">
                  {machine.name}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {machine.hint}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
