"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  DefaultAttendancePicker,
  type AttendancePick,
} from "@/components/default-attendance-picker";
import { SiteHeader } from "@/components/site-header";
import { useNow } from "@/components/use-now";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  formatClassDate,
  formatDayMonth,
  formatMonthTitle,
  WEEKDAYS,
} from "@/lib/labels";
import { mondayOfYmd, shiftYmd, turnGridBounds } from "@/lib/client-account";
import { isCurrentClassSlot, classSlotPassed } from "@/lib/hours";
import {
  bookRecoveryTurn,
  cancelRecoveryTurn,
  joinWaitlist,
  leaveWaitlist,
  loadClientBooking,
  saveClientReservations,
  setClientAbsence,
  type ClientCreditState,
  type ClientMonthTurn,
  type RecoveryDay,
  type StudioReservationView,
  type StudioSlotView,
} from "@/lib/studio";
import type { Studio, StudioKind } from "@/lib/types";
import { cn } from "@/lib/utils";

function monthLabel(ym: string) {
  return formatMonthTitle(ym).replace(/ \d{4}$/, "");
}

function monthFigures(
  months: string[] | undefined,
  values: Record<string, number> | undefined
) {
  if (!months?.length) return "0";
  return months
    .map((month) => `${Math.max(0, values?.[month] ?? 0)} (${monthLabel(month)})`)
    .join(" - ");
}

function creditLine(
  credits: {
    turnPlan?: "fixed" | "week" | "month";
    months?: string[];
    creditsByMonth?: Record<string, number>;
    creditsByWeek?: Record<string, number>;
  } | null,
  week: { start: string; end: string; fixedAvailable: number }
) {
  if (!credits) return "sin créditos";
  if (credits.turnPlan === "fixed") {
    if (week.fixedAvailable < 1) return "sin créditos";
    return `${week.fixedAvailable} (solo el día que anula)`;
  }
  if (credits.turnPlan === "week") {
    const available = Math.max(0, credits.creditsByWeek?.[week.start] ?? 0);
    if (available < 1) return "sin créditos";
    return `${available} (${formatDayMonth(week.start)} – ${formatDayMonth(week.end)})`;
  }
  return monthFigures(credits.months, credits.creditsByMonth);
}

function fixedDayMove(
  turns: ClientMonthTurn[],
  day: RecoveryDay | undefined
) {
  const freed = turns.some((item) => item.status === "absent");
  const used = turns.some(
    (item) => item.status === "scheduled" && item.source === "recovery"
  );
  const waiting = day?.slots.some((slot) => slot.waiting) ?? false;
  return freed && !used && !waiting ? 1 : 0;
}

function weekdayName(id: number) {
  return WEEKDAYS.find((day) => day.id === id)?.full ?? "Día";
}

function spanishList(parts: string[]) {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} y ${parts[parts.length - 1]}`;
}

function hourShort(slot: string) {
  const [rawHour, minutes] = slot.split(":");
  const hour = String(Number(rawHour));
  if (!minutes || minutes === "00") return `${hour}hs`;
  return `${hour}:${minutes}hs`;
}

function planSentence(
  turnPlan: "fixed" | "week" | "month" | undefined,
  count: number,
  slots: { weekday: number; slotStart: string }[]
) {
  const n = Math.max(1, count);
  const turnos = n === 1 ? "1 turno" : `${n} turnos`;
  const ordered = [...slots].sort(
    (a, b) =>
      (a.weekday === 0 ? 7 : a.weekday) - (b.weekday === 0 ? 7 : b.weekday) ||
      a.slotStart.localeCompare(b.slotStart)
  );
  const detail = spanishList(
    ordered.map(
      (item) =>
        `${weekdayName(item.weekday).toLocaleLowerCase("es")} ${hourShort(item.slotStart)}`
    )
  );
  if (turnPlan === "week") {
    if (!detail) return `${turnos} por semana libre`;
    return `${turnos} por semana libre · ${detail}`;
  }
  if (turnPlan === "month") {
    if (!detail) return `${turnos} por mes`;
    return `${turnos} por mes · ${detail}`;
  }
  if (!detail) return `${turnos} fijo`;
  return `${turnos}: ${detail} fijo`;
}

/** Más de 2 libres en verde, 1 o 2 en amarillo, sin cupo en rojo. */
function roomTone(free: number) {
  if (free > 2) return "bg-emerald-500/30 ring-1 ring-emerald-700/25";
  if (free > 0) return "bg-amber-300/55 ring-1 ring-amber-700/30";
  return "bg-red-500 ring-1 ring-red-800";
}

function WeekTurnGrid({
  turns,
  hours,
  today,
  credits,
  recoveryDays,
  fixedWeekdays,
  planLine,
  pendingOn,
  onToggle,
  onRelease,
  onBook,
  onWait,
  onLeaveWait,
}: {
  turns: ClientMonthTurn[];
  hours: string[];
  today: string;
  credits: ClientCreditState | null;
  recoveryDays: RecoveryDay[];
  /** Con días fijos, estas columnas. Null muestra la semana entera. */
  fixedWeekdays: number[] | null;
  planLine: string;
  pendingOn: string | null;
  onToggle: (occursOn: string, absent: boolean) => void;
  onRelease: (turnId: string) => void;
  onBook: (occursOn: string, slotStart: string) => void;
  onWait: (occursOn: string, slotStart: string) => void;
  onLeaveWait: (occursOn: string, slotStart: string) => void;
}) {
  const bounds = today ? turnGridBounds(today) : null;
  const [weekStart, setWeekStart] = useState("");
  const start = weekStart || (today ? mondayOfYmd(today) : "");
  const end = start ? shiftYmd(start, 6) : "";
  const extraWeekdays = new Set<number>();
  if (fixedWeekdays && start) {
    for (const turn of turns) {
      if (turn.occursOn < start || turn.occursOn > end) continue;
      const weekday = new Date(`${turn.occursOn}T12:00:00`).getDay();
      if (!fixedWeekdays.includes(weekday)) extraWeekdays.add(weekday);
    }
    for (const day of recoveryDays) {
      if (day.occursOn < start || day.occursOn > end) continue;
      if (!day.slots.some((slot) => slot.waiting)) continue;
      const weekday = new Date(`${day.occursOn}T12:00:00`).getDay();
      if (!fixedWeekdays.includes(weekday)) extraWeekdays.add(weekday);
    }
  }
  const days = start
    ? WEEKDAYS.map((day, index) => ({
        ...day,
        ymd: shiftYmd(start, index),
      })).filter(
        (day) =>
          fixedWeekdays == null ||
          fixedWeekdays.includes(day.id) ||
          extraWeekdays.has(day.id)
      )
    : [];
  const weekTurns = turns.filter(
    (turn) => turn.occursOn >= start && turn.occursOn <= end
  );
  const rowHours = [
    ...new Set([
      ...hours,
      ...weekTurns.map((turn) => turn.slotStart),
    ]),
  ].sort();
  const byCell = new Map<string, ClientMonthTurn[]>();
  for (const turn of weekTurns) {
    const key = `${turn.occursOn}|${turn.slotStart}`;
    const list = byCell.get(key) ?? [];
    list.push(turn);
    byCell.set(key, list);
  }
  const recoveryByDay = new Map(
    recoveryDays.map((day) => [day.occursOn, day] as const)
  );
  const fixedAvailable =
    credits?.turnPlan === "fixed"
      ? [...new Set(turns.map((item) => item.occursOn))]
          .filter((ymd) => ymd > today && ymd >= start && ymd <= end)
          .reduce((sum, ymd) => {
            const dayTurns = turns.filter((item) => item.occursOn === ymd);
            return sum + fixedDayMove(dayTurns, recoveryByDay.get(ymd));
          }, 0)
      : 0;
  const atStart = !bounds || start <= mondayOfYmd(bounds.from);
  const atEnd = !bounds || shiftYmd(start, 7) > bounds.to;
  const now = useNow();

  return (
    <section className="mt-4">
      <p className="text-sm font-medium">{planLine}</p>
      <p className="mt-1 text-sm font-medium">
        Créditos disponibles:{" "}
        {creditLine(credits, { start, end, fixedAvailable })}
      </p>
      <p className="text-sm font-medium">
        Cancelaciones disponibles:{" "}
        {monthFigures(credits?.months, credits?.cancelsLeftByMonth)}
      </p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!start || atStart}
          onClick={() => setWeekStart(shiftYmd(start, -7))}
        >
          Atrás
        </Button>
        <p className="text-center text-sm font-medium">
          {start && end
            ? `${formatDayMonth(start)} – ${formatDayMonth(end)}`
            : ""}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!start || atEnd}
          onClick={() => setWeekStart(shiftYmd(start, 7))}
        >
          Adelante
        </Button>
      </div>
      {turns.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Todavía no hay clases fechadas.
        </p>
      ) : null}
      {rowHours.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Esta semana no tiene horarios.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <div
            className={cn("grid gap-1", days.length > 4 && "min-w-[40rem]")}
            style={{
              gridTemplateColumns: `3.2rem repeat(${Math.max(days.length, 1)}, minmax(0, 1fr))`,
            }}
          >
            <div />
            {days.map((day) => (
              <div
                key={day.ymd}
                className={cn(
                  "rounded-xl px-1 py-2 text-center",
                  day.ymd === today && "bg-primary/10"
                )}
              >
                <p
                  className={cn(
                    "text-[11px] font-medium tracking-wide uppercase",
                    day.ymd === today
                      ? "text-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  {day.ymd === today ? "Hoy" : day.short}
                </p>
                <p className="text-sm font-medium">{Number(day.ymd.slice(8))}</p>
              </div>
            ))}
            {rowHours.map((hour) => (
              <div key={hour} className="contents">
                <p className="flex items-start pt-2 text-xs font-medium">
                  {hour}
                </p>
                {days.map((day) => {
                  const cellTurns = byCell.get(`${day.ymd}|${hour}`) ?? [];
                  const activeTurns = cellTurns.filter(
                    (item) => item.status !== "absent"
                  );
                  const past =
                    day.ymd < today || classSlotPassed(day.ymd, hour, now);
                  const later = day.ymd > today;
                  const recovery = recoveryByDay.get(day.ymd);
                  const slot = recovery?.slots.find(
                    (item) => item.slotStart === hour
                  );
                  const turn = activeTurns[0];
                  const month = day.ymd.slice(0, 7);
                  const dayTurns = turns.filter(
                    (item) => item.occursOn === day.ymd
                  );
                  const windowCredits =
                    credits?.turnPlan === "fixed"
                      ? fixedDayMove(dayTurns, recovery)
                      : credits?.turnPlan === "week"
                        ? (credits.creditsByWeek?.[mondayOfYmd(day.ymd)] ?? 0)
                        : (credits?.creditsByMonth?.[month] ?? 0);
                  const cancelsLeftForDay = credits?.cancelsLeftByMonth?.[month] ?? 0;
                  const canAdd = Boolean(
                    later && !turn && windowCredits >= 1 && slot?.bookable && !slot.waiting
                  );
                  const canWait = Boolean(
                    later &&
                      !turn &&
                      windowCredits >= 1 &&
                      slot?.open &&
                      slot.full &&
                      !slot.held &&
                      !slot.waiting
                  );
                  const canLeaveWait = Boolean(later && !turn && slot?.waiting);
                  const canAnnul = Boolean(
                    turn &&
                      !past &&
                      (turn.source === "recovery" || cancelsLeftForDay > 0)
                  );
                  const pending = Boolean(
                    pendingOn &&
                      (pendingOn === `${day.ymd}-${hour}` ||
                        pendingOn === `${day.ymd}-${hour}-espera` ||
                        cellTurns.some(
                          (item) =>
                            pendingOn === item.id || pendingOn === item.occursOn
                        ))
                  );
                  const showRoom = activeTurns.length === 0 && Boolean(slot?.open);
                  const current = isCurrentClassSlot(day.ymd, hour, now);
                  const tone =
                    activeTurns.length > 0
                      ? "bg-primary/10 ring-2 ring-emerald-600"
                      : showRoom && slot
                        ? roomTone(slot.free)
                        : day.ymd === today
                          ? "bg-primary/5"
                          : "";
                  const chrome = cn(
                    "flex min-h-14 flex-col justify-center rounded-xl px-1.5 py-1.5 text-left",
                    tone,
                    (canAdd || canWait) && "relative pb-8",
                    current &&
                      activeTurns.length === 0 &&
                      "outline outline-2 -outline-offset-2 outline-foreground",
                    pending && "opacity-60"
                  );
                  const teacherLine = slot?.teachers
                    ? `Profe: ${slot.teachers}`
                    : turn?.teacherName
                      ? `Profe: ${turn.teacherName}`
                      : null;
                  const body = (
                    <>
                      {current ? (
                        <span className="block text-[10px] font-semibold uppercase tracking-wide">
                          Ahora
                        </span>
                      ) : null}
                      {teacherLine ? (
                        <span className="block truncate text-[10px] font-medium leading-tight">
                          {teacherLine}
                        </span>
                      ) : null}
                      {activeTurns.map((item) => {
                        const note = past ? "Ya fue" : "Tu turno";
                        return (
                          <span key={item.id} className="min-w-0">
                            <span className="block truncate text-[11px] font-medium leading-tight sm:text-xs">
                              {note}
                            </span>
                          </span>
                        );
                      })}
                      {canAnnul ? (
                        <button
                          type="button"
                          disabled={pending}
                          aria-label={`Anular el turno del ${formatClassDate(day.ymd)} a las ${hour}`}
                          onClick={() => {
                            if (turn.source === "recovery") {
                              onRelease(turn.id);
                              return;
                            }
                            onToggle(day.ymd, true);
                          }}
                          className="mt-1 w-full rounded-md bg-background px-1 py-0.5 text-[10px] font-medium ring-1 ring-foreground/15"
                        >
                          Anular
                        </button>
                      ) : null}
                      {showRoom && slot ? (
                        <span className="min-w-0">
                          <span className="block text-[11px] font-medium leading-tight">
                            {slot.occupancy}
                          </span>
                        </span>
                      ) : null}
                      {canAdd ? (
                        <button
                          type="button"
                          disabled={pending}
                          aria-label={`Anotarse el ${formatClassDate(day.ymd)} a las ${hour}`}
                          onClick={() => onBook(day.ymd, hour)}
                          className="absolute right-1.5 bottom-1.5 grid size-6 place-items-center rounded-full bg-background text-sm leading-none font-semibold text-foreground shadow-sm ring-1 ring-foreground/25 hover:bg-foreground hover:text-background disabled:opacity-40"
                        >
                          <span aria-hidden="true">+</span>
                        </button>
                      ) : null}
                      {canWait ? (
                        <button
                          type="button"
                          disabled={pending}
                          aria-label={`Lista de espera el ${formatClassDate(day.ymd)} a las ${hour}`}
                          onClick={() => onWait(day.ymd, hour)}
                          className="absolute right-1.5 bottom-1.5 rounded-full bg-background px-2 py-1 text-[10px] leading-none font-semibold whitespace-nowrap text-foreground shadow-sm ring-1 ring-foreground/25 hover:bg-foreground hover:text-background disabled:opacity-40"
                        >
                          + Lista Espera
                        </button>
                      ) : null}
                      {canLeaveWait ? (
                        <button
                          type="button"
                          disabled={pending}
                          aria-label={`Salir de la lista de espera del ${formatClassDate(day.ymd)} a las ${hour}`}
                          onClick={() => onLeaveWait(day.ymd, hour)}
                          className="mt-1 w-full rounded-md bg-background px-1 py-0.5 text-[10px] font-medium ring-1 ring-foreground/15"
                        >
                          En espera · salir
                        </button>
                      ) : null}
                    </>
                  );
                  return (
                    <div key={day.ymd} className={chrome}>
                      {body}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function picksFromMine(mine: StudioReservationView[]): AttendancePick[] {
  return mine.map((item) => ({
    weekday: item.weekday,
    slotStart: item.slotStart,
  }));
}

function samePicks(a: AttendancePick[], b: AttendancePick[]) {
  if (a.length !== b.length) return false;
  const key = (item: AttendancePick) => `${item.weekday}|${item.slotStart}`;
  const left = [...a].map(key).sort();
  const right = [...b].map(key).sort();
  return left.every((item, index) => item === right[index]);
}

export function StudioBooking() {
  const [studio, setStudio] = useState<Studio | null>(null);
  const [allowed, setAllowed] = useState(1);
  const [occupancy, setOccupancy] = useState<StudioSlotView[]>([]);
  const [mine, setMine] = useState<StudioReservationView[]>([]);
  const [monthTurns, setMonthTurns] = useState<ClientMonthTurn[]>([]);
  const [credits, setCredits] = useState<ClientCreditState | null>(null);
  const [recoveryDays, setRecoveryDays] = useState<RecoveryDay[]>([]);
  const [today, setToday] = useState("");
  const [pendingOn, setPendingOn] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [activities, setActivities] = useState<StudioKind[]>(["gym"]);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [picks, setPicks] = useState<AttendancePick[]>([]);
  const [editingDefaults, setEditingDefaults] = useState(false);
  const [savingDefaults, setSavingDefaults] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadClientBooking()
      .then((row) => {
        if (cancelled) return;
        if (!row) {
          setMissing(true);
          return;
        }
        setStudio(row.studio);
        setAllowed(row.sessionsPerWeek);
        setOccupancy(row.occupancy);
        setMine(row.mine);
        setMonthTurns(row.monthTurns);
        setCredits(row.credits);
        setRecoveryDays(row.recoveryDays);
        setToday(row.today);
        setActivities(row.activities);
        setTeacherId(row.teacher?.userId ?? null);
        setPicks(picksFromMine(row.mine));
      })
      .catch(() => {
        if (!cancelled) setMissing(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const slots = useMemo(
    () => [...new Set(occupancy.map((item) => item.slotStart))],
    [occupancy]
  );
  const canEditDefaults =
    credits?.turnPlan === "week" || credits?.turnPlan === "month";
  const defaultsDirty = !samePicks(picks, picksFromMine(mine));

  async function saveDefaults() {
    if (!canEditDefaults || savingDefaults) return;
    setSavingDefaults(true);
    try {
      const next = await saveClientReservations(picks);
      if (!next) throw new Error("No se pudo guardar.");
      setStudio(next.studio);
      setAllowed(next.sessionsPerWeek);
      setOccupancy(next.occupancy);
      setMine(next.mine);
      setMonthTurns(next.monthTurns);
      setCredits(next.credits);
      setRecoveryDays(next.recoveryDays);
      setToday(next.today);
      setActivities(next.activities);
      setTeacherId(next.teacher?.userId ?? null);
      setPicks(picksFromMine(next.mine));
      setEditingDefaults(false);
      toast.success("Guardaste tus horarios por defecto.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudieron guardar los horarios."
      );
    } finally {
      setSavingDefaults(false);
    }
  }

  async function toggleAbsence(occursOn: string, absent: boolean) {
    setPendingOn(occursOn);
    try {
      const next = await setClientAbsence(occursOn, absent);
      if (!next) throw new Error("No se pudo guardar.");
      setMonthTurns(next.monthTurns);
      setCredits(next.credits);
      setRecoveryDays(next.recoveryDays);
      setToday(next.today);
      const saved = next.monthTurns.find(
        (item) => item.source === "fixed" && item.occursOn === occursOn
      );
      toast.success(
        absent
          ? next.turnPlan === "fixed"
            ? `Avisaste que no vas el ${formatClassDate(occursOn)}. Podés anotarte en otro horario de ese día.`
            : saved?.outcome === "credit"
              ? `Avisaste a tiempo. Ganaste 1 crédito${next.turnPlan === "week" ? " de esa semana" : ` de ${monthLabel(occursOn.slice(0, 7))}`}. Te quedan ${next.turnPlan === "week" ? (next.credits.creditsByWeek[mondayOfYmd(occursOn)] ?? 0) : (next.credits.creditsByMonth[occursOn.slice(0, 7)] ?? 0)}.`
              : `Avisaste que no vas el ${formatClassDate(occursOn)}. El cupo queda libre, sin crédito.`
          : "Cancelaste el aviso: volvés a figurar en esa clase."
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo guardar el aviso."
      );
    } finally {
      setPendingOn(null);
    }
  }

  async function bookCredit(occursOn: string, slotStart: string) {
    setPendingOn(`${occursOn}-${slotStart}`);
    try {
      const next = await bookRecoveryTurn(occursOn, slotStart);
      if (!next) throw new Error("No se pudo reservar.");
      setMonthTurns(next.monthTurns);
      setCredits(next.credits);
      setRecoveryDays(next.recoveryDays);
      setToday(next.today);
      toast.success(
        next.turnPlan === "fixed"
          ? `Tomaste el ${formatClassDate(occursOn)} a las ${slotStart}.`
          : `Tomaste el ${formatClassDate(occursOn)} a las ${slotStart}. Te quedan ${next.turnPlan === "week" ? (next.credits.creditsByWeek[mondayOfYmd(occursOn)] ?? 0) : (next.credits.creditsByMonth[occursOn.slice(0, 7)] ?? 0)} créditos.`
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo usar el crédito."
      );
    } finally {
      setPendingOn(null);
    }
  }

  async function joinQueue(occursOn: string, slotStart: string) {
    setPendingOn(`${occursOn}-${slotStart}-espera`);
    try {
      const next = await joinWaitlist(occursOn, slotStart);
      if (!next) throw new Error("No se pudo anotar en la lista.");
      setMonthTurns(next.monthTurns);
      setCredits(next.credits);
      setRecoveryDays(next.recoveryDays);
      setToday(next.today);
      const took = next.monthTurns.some(
        (item) =>
          item.occursOn === occursOn &&
          item.slotStart === slotStart &&
          item.status !== "absent"
      );
      toast.success(
        took
          ? `Se liberó un lugar y quedaste anotado el ${formatClassDate(occursOn)} a las ${slotStart}.`
          : next.turnPlan === "fixed"
            ? "Quedaste en la lista de espera de ese día."
            : `Quedaste en la lista de espera. El crédito queda reservado. Te quedan ${next.turnPlan === "week" ? (next.credits.creditsByWeek[mondayOfYmd(occursOn)] ?? 0) : (next.credits.creditsByMonth[occursOn.slice(0, 7)] ?? 0)}.`
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo anotar en la lista."
      );
    } finally {
      setPendingOn(null);
    }
  }

  async function leaveQueue(occursOn: string, slotStart: string) {
    setPendingOn(`${occursOn}-${slotStart}-espera`);
    try {
      const next = await leaveWaitlist(occursOn, slotStart);
      if (!next) throw new Error("No se pudo salir de la lista.");
      setMonthTurns(next.monthTurns);
      setCredits(next.credits);
      setRecoveryDays(next.recoveryDays);
      setToday(next.today);
      toast.success(
        next.turnPlan === "fixed"
          ? "Saliste de la lista. Podés anotarte en otro horario de ese día."
          : `Saliste de la lista. Te quedan ${next.turnPlan === "week" ? (next.credits.creditsByWeek[mondayOfYmd(occursOn)] ?? 0) : (next.credits.creditsByMonth[occursOn.slice(0, 7)] ?? 0)} créditos.`
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo salir de la lista."
      );
    } finally {
      setPendingOn(null);
    }
  }

  async function releaseRecovery(turnId: string) {
    setPendingOn(turnId);
    try {
      const next = await cancelRecoveryTurn(turnId);
      if (!next) throw new Error("No se pudo soltar.");
      setMonthTurns(next.monthTurns);
      setCredits(next.credits);
      setRecoveryDays(next.recoveryDays);
      setToday(next.today);
      toast.success(
        next.turnPlan === "fixed"
          ? "Soltaste esa clase. Podés anotarte de nuevo ese día."
          : "Soltaste esa clase. El crédito volvió."
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo soltar la clase."
      );
    } finally {
      setPendingOn(null);
    }
  }

  if (missing) {
    return (
      <div className="min-h-svh bg-background">
        <SiteHeader />
        <main className="mx-auto w-full max-w-xl px-4 py-10">
          <h1 className="font-heading text-4xl tracking-tight italic">
            Sin gimnasio.
          </h1>
          <p className="mt-3 text-muted-foreground">
            Si te dieron un código ALU-, úsalo para entrar.
          </p>
          <Link
            href="/unirse"
            className={cn(buttonVariants(), "mt-6 h-11 px-5")}
          >
            Cargar código
          </Link>
        </main>
      </div>
    );
  }

  if (!studio) {
    return (
      <div className="flex min-h-svh items-center justify-center text-muted-foreground">
        Cargando turnos…
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl px-4 py-8">
        <h1 className="font-heading text-4xl tracking-tight italic">
          Tu agenda
        </h1>
        <WeekTurnGrid
          turns={monthTurns}
          hours={slots}
          today={today}
          credits={credits}
          recoveryDays={recoveryDays}
          fixedWeekdays={
            credits?.turnPlan === "fixed"
              ? mine.map((item) => item.weekday)
              : null
          }
          planLine={planSentence(credits?.turnPlan, allowed, mine)}
          pendingOn={pendingOn}
          onToggle={(occursOn, absent) => void toggleAbsence(occursOn, absent)}
          onRelease={(turnId) => void releaseRecovery(turnId)}
          onBook={(occursOn, slotStart) => void bookCredit(occursOn, slotStart)}
          onWait={(occursOn, slotStart) => void joinQueue(occursOn, slotStart)}
          onLeaveWait={(occursOn, slotStart) =>
            void leaveQueue(occursOn, slotStart)
          }
        />
        {canEditDefaults ? (
          <section className="mt-8 border-t border-foreground/10 pt-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-heading text-2xl tracking-tight italic">
                  Horarios por defecto
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Se usan cuando se arma una semana nueva. Elegí {allowed}{" "}
                  {allowed === 1 ? "día y horario" : "días y horarios"}.
                </p>
              </div>
              {editingDefaults ? null : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPicks(picksFromMine(mine));
                    setEditingDefaults(true);
                  }}
                >
                  Cambiar
                </Button>
              )}
            </div>
            {editingDefaults ? (
              <div className="mt-4">
                <DefaultAttendancePicker
                  occupancy={occupancy}
                  allowed={allowed}
                  activities={activities}
                  value={picks}
                  committed={picksFromMine(mine)}
                  assignedTeacherId={teacherId}
                  voice="self"
                  onChange={setPicks}
                />
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    className="h-11 px-5"
                    disabled={
                      savingDefaults ||
                      picks.length !== allowed ||
                      !defaultsDirty
                    }
                    onClick={() => void saveDefaults()}
                  >
                    {savingDefaults ? "Guardando…" : "Guardar"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 px-5"
                    disabled={savingDefaults}
                    onClick={() => {
                      setPicks(picksFromMine(mine));
                      setEditingDefaults(false);
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm">
                {planSentence(credits?.turnPlan, allowed, mine)}
              </p>
            )}
          </section>
        ) : null}
      </main>
    </div>
  );
}
