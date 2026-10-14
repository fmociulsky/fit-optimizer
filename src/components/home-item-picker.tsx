"use client";

import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  HOME_CATEGORIES,
  HOME_ITEMS,
  typicalHomeItems,
  type HomeCategory,
} from "@/lib/home-items";
import type { Equipment } from "@/lib/types";
import { cn } from "@/lib/utils";

export function HomeItemPicker({
  selected,
  equipment,
  onChange,
}: {
  selected: string[];
  equipment: Exclude<Equipment, "full_gym" | "coach" | "pilates">;
  onChange: (ids: string[]) => void;
}) {
  const [category, setCategory] = useState<HomeCategory | "Todas">("Todas");
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const visible = useMemo(
    () =>
      category === "Todas"
        ? HOME_ITEMS
        : HOME_ITEMS.filter((item) => item.category === category),
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
        {(["Todas", ...HOME_CATEGORIES] as const).map((item) => (
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
          {selected.length} de {HOME_ITEMS.length} seleccionados
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange(typicalHomeItems(equipment))}
        >
          Lo habitual en casa
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange(HOME_ITEMS.map((item) => item.id))}
        >
          Todos
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange([])}>
          Ninguno
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {visible.map((item) => {
          const on = selectedSet.has(item.id);
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(item.id)}
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
                  src={item.photo}
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
                  {item.name}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {item.hint}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
