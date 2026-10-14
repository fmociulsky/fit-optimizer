export function parseHour(value: string) {
  const [h, m] = value.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

export function formatHour(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function hourSlots(openFrom: string, openTo: string, slotMinutes = 60) {
  const start = parseHour(openFrom);
  const end = parseHour(openTo);
  if (start == null || end == null || end <= start) return [];
  const slots: string[] = [];
  for (let t = start; t + slotMinutes <= end; t += slotMinutes) {
    slots.push(formatHour(t));
  }
  return slots;
}

export function clockHours(from = 6, to = 23) {
  const slots: string[] = [];
  for (let hour = from; hour <= to; hour += 1) {
    slots.push(formatHour(hour * 60));
  }
  return slots;
}

export function hourCovers(startHour: string, endHour: string, slot: string) {
  const start = parseHour(startHour);
  const end = parseHour(endHour);
  const at = parseHour(slot);
  if (start == null || end == null || at == null) return false;
  return at >= start && at < end;
}

export type DayHours = {
  weekday: number;
  openFrom: string;
  openTo: string;
  gymCapacity?: number;
  pilatesCapacity?: number;
};

export function defaultDayHours(
  weekdays: number[] = [1, 2, 3, 4, 5, 6],
  openFrom = "08:00",
  openTo = "21:00"
): DayHours[] {
  return weekdays.map((weekday) => ({
    weekday,
    openFrom,
    openTo,
    gymCapacity: 8,
    pilatesCapacity: 8,
  }));
}

export function dayKindCapacity(
  day: Pick<DayHours, "gymCapacity" | "pilatesCapacity"> | null | undefined,
  kind: "gym" | "pilates",
  fallback = 8
) {
  const raw = kind === "gym" ? day?.gymCapacity : day?.pilatesCapacity;
  return normalizeCupo(raw, fallback) ?? fallback;
}

export function normalizeCupo(raw: unknown, fallback = 8) {
  const cupo = Math.round(Number(raw ?? fallback));
  if (cupo < 1 || cupo > 40) return null;
  return cupo;
}

export function normalizeDayHours(
  raw: unknown,
  fallback: DayHours[]
): DayHours[] {
  if (!Array.isArray(raw)) return fallback;
  const days: DayHours[] = [];
  const seen = new Set<number>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Partial<DayHours>;
    if (typeof row.weekday !== "number" || seen.has(row.weekday)) continue;
    const openFrom = row.openFrom ?? fallback[0]?.openFrom ?? "08:00";
    const openTo = row.openTo ?? fallback[0]?.openTo ?? "21:00";
    if (!hourSlots(openFrom, openTo).length) continue;
    seen.add(row.weekday);
    days.push({
      weekday: row.weekday,
      openFrom,
      openTo,
      gymCapacity: normalizeCupo(row.gymCapacity, 8) ?? 8,
      pilatesCapacity: normalizeCupo(row.pilatesCapacity, 8) ?? 8,
    });
  }
  return days.length ? days : fallback;
}

export function hoursForWeekday(days: DayHours[], weekday: number) {
  return days.find((item) => item.weekday === weekday) ?? null;
}

export function occupancyForActivities(
  cell: {
    gymTaken: number;
    gymCapacity: number;
    pilatesTaken: number;
    pilatesCapacity: number;
  },
  activities: Array<"gym" | "pilates">,
  self: { inDb?: boolean; selected?: boolean } = {}
) {
  const needGym = activities.includes("gym");
  const needPilates = activities.includes("pilates");
  const gymOthers = Math.max(
    0,
    cell.gymTaken - (self.inDb && needGym ? 1 : 0)
  );
  const pilatesOthers = Math.max(
    0,
    cell.pilatesTaken - (self.inDb && needPilates ? 1 : 0)
  );
  const gymTaken = gymOthers + (self.selected && needGym ? 1 : 0);
  const pilatesTaken = pilatesOthers + (self.selected && needPilates ? 1 : 0);
  const gymFull = needGym && gymOthers >= cell.gymCapacity;
  const pilatesFull = needPilates && pilatesOthers >= cell.pilatesCapacity;
  if (needGym && needPilates) {
    return {
      display: `${gymTaken}/${cell.gymCapacity} G · ${pilatesTaken}/${cell.pilatesCapacity} P`,
      full: gymFull || pilatesFull,
    };
  }
  if (needPilates) {
    return {
      display: `${pilatesTaken}/${cell.pilatesCapacity}`,
      full: pilatesFull,
    };
  }
  return {
    display: `${gymTaken}/${cell.gymCapacity}`,
    full: gymFull,
  };
}

export function nextHourSlot(now = new Date()) {
  let hours = now.getHours();
  let weekday = now.getDay();
  if (now.getMinutes() > 0 || now.getSeconds() > 0 || now.getMilliseconds() > 0) {
    hours += 1;
  }
  if (hours >= 24) {
    hours = 0;
    weekday = (weekday + 1) % 7;
  }
  return { weekday, slotStart: formatHour(hours * 60) };
}
