"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { clockHours, hoursForWeekday } from "@/lib/hours";
import { WEEKDAYS } from "@/lib/labels";
import type { StudioDayHours } from "@/lib/types";
import { cn } from "@/lib/utils";

const HOURS = clockHours();
const fieldClass =
  "h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-base md:text-sm";

type DraftShift = {
  startHour: string;
  endHour: string;
};

export type TeacherHoursDraft = {
  weekday: number;
  startHour: string;
  endHour: string;
  capacityPerSlot?: number;
};

function draftsFromShifts(shifts: TeacherHoursDraft[]) {
  return Object.fromEntries(
    shifts.map((item) => [
      item.weekday,
      {
        startHour: item.startHour,
        endHour: item.endHour,
      },
    ])
  ) as Record<number, DraftShift>;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo guardar.";
}

export function TeacherHoursEditor({
  dayHours,
  shifts,
  onSave,
  saveLabel,
  className,
}: {
  dayHours: StudioDayHours[];
  shifts: TeacherHoursDraft[];
  onSave: (next: TeacherHoursDraft[]) => Promise<void>;
  saveLabel: string;
  className?: string;
}) {
  const [draft, setDraft] = useState(() => draftsFromShifts(shifts));
  const [busy, setBusy] = useState(false);
  const shiftsRef = useRef(shifts);
  shiftsRef.current = shifts;
  const shiftsKey = shifts
    .map(
      (item) =>
        `${item.weekday}:${item.startHour}:${item.endHour}`
    )
    .join("|");

  useEffect(() => {
    setDraft(draftsFromShifts(shiftsRef.current));
  }, [shiftsKey]);

  function toggle(weekday: number) {
    setDraft((current) => {
      if (current[weekday]) {
        const next = { ...current };
        delete next[weekday];
        return next;
      }
      const hours = hoursForWeekday(dayHours, weekday);
      return {
        ...current,
        [weekday]: {
          startHour: hours?.openFrom ?? "08:00",
          endHour: hours?.openTo ?? "21:00",
        },
      };
    });
  }

  async function save() {
    setBusy(true);
    try {
      await onSave(
        Object.entries(draft).map(([weekday, hours]) => ({
          weekday: Number(weekday),
          startHour: hours.startHour,
          endHour: hours.endHour,
        }))
      );
      toast.success("Horario guardado.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const openDays = WEEKDAYS.filter((day) =>
    dayHours.some((item) => item.weekday === day.id)
  );

  if (openDays.length === 0) {
    return (
      <p className="mt-3 text-sm text-muted-foreground">
        El gimnasio no tiene días abiertos.
      </p>
    );
  }

  return (
    <div className={cn("mt-4 space-y-3", className)}>
      {openDays.map((day) => {
        const shift = draft[day.id];
        return (
          <div
            key={day.id}
            className="grid gap-2 sm:grid-cols-[7rem_1fr_1fr] sm:items-center"
          >
            <button
              type="button"
              onClick={() => toggle(day.id)}
              className={cn(
                "h-11 rounded-xl text-sm font-medium",
                shift
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {day.short}
            </button>
            {shift ? (
              <>
                <select
                  className={fieldClass}
                  value={shift.startHour}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      [day.id]: { ...shift, startHour: event.target.value },
                    }))
                  }
                >
                  {HOURS.map((hour) => (
                    <option key={hour} value={hour}>
                      Desde {hour}
                    </option>
                  ))}
                </select>
                <select
                  className={fieldClass}
                  value={shift.endHour}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      [day.id]: { ...shift, endHour: event.target.value },
                    }))
                  }
                >
                  {HOURS.map((hour) => (
                    <option key={hour} value={hour}>
                      Hasta {hour}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <p className="text-sm text-muted-foreground sm:col-span-2">
                No trabaja
              </p>
            )}
          </div>
        );
      })}
      <Button
        type="button"
        variant="outline"
        className="h-11 px-4"
        disabled={busy}
        onClick={() => void save()}
      >
        {busy ? "Guardando…" : saveLabel}
      </Button>
    </div>
  );
}
