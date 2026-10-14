"use client";

import { useMemo } from "react";
import { toast } from "sonner";
import { WEEKDAYS } from "@/lib/labels";
import { occupancyForActivities } from "@/lib/hours";
import type { StudioSlotView } from "@/lib/studio";
import type { StudioKind } from "@/lib/types";
import { cn } from "@/lib/utils";

export type AttendancePick = { weekday: number; slotStart: string };

type DefaultAttendancePickerProps = {
  occupancy: StudioSlotView[];
  allowed: number;
  activities: StudioKind[];
  value: AttendancePick[];
  committed?: AttendancePick[];
  onChange: (next: AttendancePick[]) => void;
};

export function DefaultAttendancePicker({
  occupancy,
  allowed,
  activities,
  value,
  committed = [],
  onChange,
}: DefaultAttendancePickerProps) {
  const days = useMemo(() => {
    return WEEKDAYS.filter((day) =>
      occupancy.some((item) => item.weekday === day.id)
    );
  }, [occupancy]);
  const slots = useMemo(() => {
    const hours = occupancy.map((item) => item.slotStart);
    return [...new Set(hours)];
  }, [occupancy]);

  function selectedOn(weekday: number) {
    return value.find((item) => item.weekday === weekday) ?? null;
  }

  function toggle(weekday: number, slotStart: string) {
    const current = selectedOn(weekday);
    if (current?.slotStart === slotStart) {
      onChange(value.filter((item) => item.weekday !== weekday));
      return;
    }
    const cell = occupancy.find(
      (item) => item.weekday === weekday && item.slotStart === slotStart
    );
    const selfInDb = committed.some(
      (item) => item.weekday === weekday && item.slotStart === slotStart
    );
    const counts = cell
      ? occupancyForActivities(cell, activities, {
          inDb: selfInDb,
          selected: true,
        })
      : { full: true };
    if (!cell || (counts.full && !selfInDb)) {
      toast.error(`Sin cupo a las ${slotStart}.`);
      return;
    }
    const withoutDay = value.filter((item) => item.weekday !== weekday);
    if (!current && withoutDay.length >= allowed) {
      toast.error(
        allowed === 1
          ? "Le toca 1 vez por semana."
          : `Le tocan ${allowed} veces por semana.`
      );
      return;
    }
    onChange([...withoutDay, { weekday, slotStart }]);
  }

  if (occupancy.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Esta sucursal todavía no tiene días y horarios.
      </p>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 bg-card px-2 py-2 text-left font-medium">
                Hora
              </th>
              {days.map((day) => (
                <th key={day.id} className="px-2 py-2 text-left font-medium">
                  {day.short}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slots.map((slot) => (
              <tr key={slot} className="border-t border-foreground/8">
                <td className="sticky left-0 bg-card px-2 py-2 font-medium">
                  {slot}
                </td>
                {days.map((day) => {
                  const cell = occupancy.find(
                    (item) => item.weekday === day.id && item.slotStart === slot
                  );
                  const mineHere = selectedOn(day.id)?.slotStart === slot;
                  const selfInDb = committed.some(
                    (item) =>
                      item.weekday === day.id && item.slotStart === slot
                  );
                  const counts = cell
                    ? occupancyForActivities(cell, activities, {
                        inDb: selfInDb,
                        selected: mineHere,
                      })
                    : { display: "—", full: true };
                  const full = Boolean(cell && counts.full && !mineHere);
                  const blocked = !cell || full;
                  const shown = counts;
                  return (
                    <td key={day.id} className="px-2 py-2">
                      {cell ? (
                        <button
                          type="button"
                          disabled={blocked && !mineHere}
                          onClick={() => toggle(day.id, slot)}
                          className={cn(
                            "flex min-w-[5.5rem] flex-col rounded-xl px-2 py-2 text-left",
                            mineHere
                              ? "bg-primary text-primary-foreground"
                              : blocked
                                ? "bg-muted text-muted-foreground"
                                : "bg-background ring-1 ring-foreground/10 hover:ring-primary/40"
                          )}
                        >
                          <span className="text-xs">{shown.display}</span>
                          <span className="text-[11px] opacity-80">
                            {full ? "Sin cupo" : "Cupo"}
                          </span>
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        Elegidos {value.length} de {allowed}.
      </p>
    </div>
  );
}
