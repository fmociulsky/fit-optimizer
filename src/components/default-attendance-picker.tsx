"use client";

import { useMemo } from "react";
import { toast } from "sonner";
import { WEEKDAYS } from "@/lib/labels";
import { occupancyForActivities } from "@/lib/hours";
import type { StudioSlotTeacher, StudioSlotView } from "@/lib/studio";
import type { StudioKind } from "@/lib/types";
import { cn } from "@/lib/utils";

export type AttendancePick = { weekday: number; slotStart: string };

type DefaultAttendancePickerProps = {
  occupancy: StudioSlotView[];
  allowed: number;
  activities: StudioKind[];
  value: AttendancePick[];
  committed?: AttendancePick[];
  assignedTeacherId?: string | null;
  onChange: (next: AttendancePick[]) => void;
};

function teachersInSlot(
  cell: StudioSlotView | undefined,
  assignedTeacherId?: string | null
) {
  if (!cell) return [];
  const seen = new Set<string>();
  const teachers: StudioSlotTeacher[] = [];
  for (const teacher of cell.teachers) {
    if (seen.has(teacher.userId)) continue;
    seen.add(teacher.userId);
    teachers.push(teacher);
  }
  return teachers.sort((a, b) => {
    if (assignedTeacherId) {
      if (a.userId === assignedTeacherId) return -1;
      if (b.userId === assignedTeacherId) return 1;
    }
    return a.name.localeCompare(b.name, "es");
  });
}

function SlotTeachers({
  full,
  teachers,
  assignedTeacherId,
  selected,
}: {
  full: boolean;
  teachers: StudioSlotTeacher[];
  assignedTeacherId?: string | null;
  selected: boolean;
}) {
  if (full) {
    return (
      <span className="mt-1 block text-[11px] font-medium opacity-80">
        Sin cupo
      </span>
    );
  }
  if (teachers.length === 0) {
    return (
      <span className="mt-1 block text-[11px] opacity-50">Sin profesor</span>
    );
  }
  return (
    <ul className="mt-1 space-y-0.5">
      {teachers.map((item) => {
        const mine = Boolean(
          assignedTeacherId && item.userId === assignedTeacherId
        );
        return (
          <li
            key={item.userId}
            className={cn(
              "truncate rounded-md px-1 py-0.5 text-[11px] font-medium leading-snug ring-1",
              selected
                ? mine
                  ? "bg-primary-foreground/25 text-primary-foreground ring-primary-foreground/40"
                  : "bg-primary-foreground/10 text-primary-foreground/90 ring-primary-foreground/20"
                : mine
                  ? "bg-chart-2/30 text-foreground ring-chart-2/55"
                  : "bg-muted/80 text-muted-foreground ring-foreground/10"
            )}
            title={item.name}
          >
            {item.name}
          </li>
        );
      })}
    </ul>
  );
}

export function DefaultAttendancePicker({
  occupancy,
  allowed,
  activities,
  value,
  committed = [],
  assignedTeacherId = null,
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
                <td className="sticky left-0 bg-card px-2 py-2 align-top font-medium">
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
                  const teachers = teachersInSlot(cell, assignedTeacherId);
                  return (
                    <td key={day.id} className="px-2 py-2 align-top">
                      {cell ? (
                        <button
                          type="button"
                          disabled={blocked && !mineHere}
                          onClick={() => toggle(day.id, slot)}
                          className={cn(
                            "flex min-w-[6.5rem] flex-col rounded-xl px-2 py-2 text-left",
                            mineHere
                              ? "bg-primary text-primary-foreground"
                              : blocked
                                ? "bg-muted text-muted-foreground"
                                : "bg-background ring-1 ring-foreground/10 hover:ring-primary/40"
                          )}
                        >
                          <span className="text-xs font-medium">
                            {counts.display}
                          </span>
                          <SlotTeachers
                            full={full}
                            teachers={teachers}
                            assignedTeacherId={assignedTeacherId}
                            selected={mineHere}
                          />
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
        Elegidos {value.length} de {allowed}. En cada casilla ves quién da clase
        ese día y horario.
      </p>
    </div>
  );
}
