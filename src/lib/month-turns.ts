import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { getDb } from "@/db";
import {
  studioAbsences,
  studioMemberships,
  studioMonthTurns,
  studioReservations,
  studioTeacherLeaves,
  studios,
} from "@/db/schema";
import {
  gymTodayYmd,
  GYM_TIME_ZONE,
  shiftYmd,
  todayBillingYmd,
  turnGridBounds,
} from "@/lib/client-account";
import {
  defaultDayHours,
  hoursForWeekday,
  normalizeDayHours,
} from "@/lib/hours";

export type MonthTurnStatus = "scheduled" | "absent";

/** Desde el 1 de este mes hasta la semana que ya se liberó un domingo. */
export function monthTurnBounds(today = todayBillingYmd()) {
  return turnGridBounds(today);
}

export function isInMonthTurnWindow(ymd: string, today = todayBillingYmd()) {
  const { from, to } = monthTurnBounds(today);
  return ymd >= from && ymd <= to;
}

function weekdayOf(ymd: string) {
  return new Date(`${ymd}T12:00:00`).getDay();
}

function datesInRange(from: string, to: string) {
  const dates: string[] = [];
  let cursor = from;
  while (cursor <= to && dates.length < 120) {
    dates.push(cursor);
    cursor = shiftYmd(cursor, 1);
  }
  return dates;
}

function chunks<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    out.push(items.slice(index, index + size));
  }
  return out;
}

/**
 * Materializa las clases de las semanas ya liberadas.
 * La semana nueva entra el domingo a las 00:00 de Argentina.
 * Cada alumno de días fijos copia sus días y horas fijos.
 * El resto copia sus días y horas por defecto. Los dos están en el horario semanal.
 * El pasado ya generado no se mueve. Una recuperación no se pisa.
 */
export async function syncFixedMonthTurns(
  studioId: string,
  clientUserId?: string
) {
  const db = getDb();
  const [studio] = await db
    .select()
    .from(studios)
    .where(eq(studios.id, studioId))
    .limit(1);
  if (!studio) return;

  const dayHours = normalizeDayHours(
    studio.dayHours,
    defaultDayHours(
      studio.openWeekdays ?? [1, 2, 3, 4, 5, 6],
      studio.openFrom,
      studio.openTo
    )
  );
  const { from, to, today } = monthTurnBounds();
  const openDates = datesInRange(from, to).filter((ymd) =>
    Boolean(hoursForWeekday(dayHours, weekdayOf(ymd)))
  );

  const reservationWhere = clientUserId
    ? and(
        eq(studioReservations.studioId, studioId),
        eq(studioReservations.clientUserId, clientUserId)
      )
    : eq(studioReservations.studioId, studioId);
  const turnWhere = clientUserId
    ? and(
        eq(studioMonthTurns.studioId, studioId),
        eq(studioMonthTurns.clientUserId, clientUserId),
        gte(studioMonthTurns.occursOn, from),
        lte(studioMonthTurns.occursOn, to)
      )
    : and(
        eq(studioMonthTurns.studioId, studioId),
        gte(studioMonthTurns.occursOn, from),
        lte(studioMonthTurns.occursOn, to)
      );
  const absenceWhere = clientUserId
    ? and(
        eq(studioAbsences.studioId, studioId),
        eq(studioAbsences.clientUserId, clientUserId),
        gte(studioAbsences.absentOn, from),
        lte(studioAbsences.absentOn, to)
      )
    : and(
        eq(studioAbsences.studioId, studioId),
        gte(studioAbsences.absentOn, from),
        lte(studioAbsences.absentOn, to)
      );

  const memberWhere = clientUserId
    ? and(
        eq(studioMemberships.studioId, studioId),
        eq(studioMemberships.userId, clientUserId),
        eq(studioMemberships.role, "client")
      )
    : and(
        eq(studioMemberships.studioId, studioId),
        eq(studioMemberships.role, "client")
      );

  const [reservations, existing, absences, members, studioRow] =
    await Promise.all([
      db.select().from(studioReservations).where(reservationWhere),
      db.select().from(studioMonthTurns).where(turnWhere),
      db
        .select({
          clientUserId: studioAbsences.clientUserId,
          absentOn: studioAbsences.absentOn,
        })
        .from(studioAbsences)
        .where(absenceWhere),
      db
        .select({
          userId: studioMemberships.userId,
          paymentStatus: studioMemberships.paymentStatus,
        })
        .from(studioMemberships)
        .where(memberWhere),
      db
        .select({ ownerUserId: studios.ownerUserId })
        .from(studios)
        .where(eq(studios.id, studioId))
        .limit(1)
        .then((rows) => rows[0] ?? null),
    ]);

  const leaves = studioRow
    ? await db
        .select({
          teacherUserId: studioTeacherLeaves.teacherUserId,
          replacementTeacherUserId:
            studioTeacherLeaves.replacementTeacherUserId,
          startsOn: studioTeacherLeaves.startsOn,
          endsOn: studioTeacherLeaves.endsOn,
        })
        .from(studioTeacherLeaves)
        .where(
          and(
            eq(studioTeacherLeaves.ownerUserId, studioRow.ownerUserId),
            eq(studioTeacherLeaves.status, "approved"),
            lte(studioTeacherLeaves.startsOn, to),
            gte(studioTeacherLeaves.endsOn, from)
          )
        )
    : [];

  const pausedClientIds = new Set(
    members
      .filter((item) => item.paymentStatus === "paused")
      .map((item) => item.userId)
  );
  const teacherCoverByDay = new Map<string, string>();
  for (const leave of leaves) {
    if (!leave.replacementTeacherUserId) continue;
    let cursor = leave.startsOn < from ? from : leave.startsOn;
    const last = leave.endsOn > to ? to : leave.endsOn;
    while (cursor <= last) {
      teacherCoverByDay.set(
        `${cursor}|${leave.teacherUserId}`,
        leave.replacementTeacherUserId
      );
      cursor = shiftYmd(cursor, 1);
    }
  }

  const absentKeys = new Set(
    absences.map((row) => `${row.clientUserId}|${row.absentOn}`)
  );
  const existingByKey = new Map<string, (typeof existing)[number]>(
    existing
      .filter((row) => row.source === "fixed")
      .map((row) => [`${row.clientUserId}|${row.occursOn}`, row])
  );
  const clientsWithPast = new Set(
    existing
      .filter((row) => row.occursOn < today)
      .map((row) => row.clientUserId)
  );

  const expectedKeys = new Set<string>();
  const toInsert: (typeof studioMonthTurns.$inferInsert)[] = [];
  const toUpdate: {
    id: string;
    weekday: number;
    slotStart: string;
    teacherUserId: string | null;
    status: MonthTurnStatus;
  }[] = [];

  for (const ymd of openDates) {
    const weekday = weekdayOf(ymd);
    for (const reservation of reservations) {
      if (reservation.weekday !== weekday) continue;
      if (pausedClientIds.has(reservation.clientUserId)) continue;
      const key = `${reservation.clientUserId}|${ymd}`;
      expectedKeys.add(key);
      const status: MonthTurnStatus = absentKeys.has(key)
        ? "absent"
        : "scheduled";
      const current = existingByKey.get(key);
      const coveredTeacher = reservation.teacherUserId
        ? (teacherCoverByDay.get(`${ymd}|${reservation.teacherUserId}`) ??
          reservation.teacherUserId)
        : reservation.teacherUserId;
      if (!current) {
        if (ymd < today && clientsWithPast.has(reservation.clientUserId)) {
          continue;
        }
        toInsert.push({
          id: crypto.randomUUID(),
          studioId,
          clientUserId: reservation.clientUserId,
          occursOn: ymd,
          weekday,
          slotStart: reservation.slotStart,
          teacherUserId: coveredTeacher,
          source: "fixed",
          status,
        });
        continue;
      }
      if (current.source !== "fixed") continue;
      const frozen = ymd < today;
      const nextSlot = frozen ? current.slotStart : reservation.slotStart;
      const nextTeacher = frozen ? current.teacherUserId : coveredTeacher;
      const nextWeekday = frozen ? current.weekday : weekday;
      if (
        current.status !== status ||
        current.slotStart !== nextSlot ||
        current.teacherUserId !== nextTeacher ||
        current.weekday !== nextWeekday
      ) {
        toUpdate.push({
          id: current.id,
          weekday: nextWeekday,
          slotStart: nextSlot,
          teacherUserId: nextTeacher,
          status,
        });
      }
    }
  }

  const toDelete = existing
    .filter((row) => {
      if (row.occursOn < today || row.source !== "fixed") return false;
      return !expectedKeys.has(`${row.clientUserId}|${row.occursOn}`);
    })
    .map((row) => row.id);

  if (toDelete.length) {
    await db
      .delete(studioMonthTurns)
      .where(inArray(studioMonthTurns.id, toDelete));
  }
  for (const part of chunks(toInsert, 200)) {
    await db
      .insert(studioMonthTurns)
      .values(part)
      .onConflictDoNothing({
        target: [
          studioMonthTurns.studioId,
          studioMonthTurns.clientUserId,
          studioMonthTurns.occursOn,
          studioMonthTurns.slotStart,
        ],
      });
  }
  for (const row of toUpdate) {
    await db
      .update(studioMonthTurns)
      .set({
        weekday: row.weekday,
        slotStart: row.slotStart,
        teacherUserId: row.teacherUserId,
        status: row.status,
      })
      .where(eq(studioMonthTurns.id, row.id));
  }
}

/** Arma las semanas ya liberadas en todas las sucursales. */
export async function openReleasedWeeks() {
  const db = getDb();
  const rows = await db.select({ id: studios.id }).from(studios);
  for (const row of rows) {
    await syncFixedMonthTurns(row.id);
  }
  const bounds = turnGridBounds();
  return { through: bounds.to, studios: rows.length };
}

/** Milisegundos hasta el próximo domingo 00:00 de Argentina. */
export function msUntilNextWeekOpening(now = new Date()) {
  const ymd = gymTodayYmd(now);
  const weekday = new Date(`${ymd}T12:00:00`).getDay();
  const clock = new Intl.DateTimeFormat("en-GB", {
    timeZone: GYM_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(now);
  const [hour, minute, second] = clock
    .split(":")
    .map((part) => Number(part.replace(/\D/g, "")));
  const elapsed = hour * 3600 + minute * 60 + second;
  let days = (7 - weekday) % 7;
  if (days === 0 && elapsed > 0) days = 7;
  return Math.max(0, days * 86400 - elapsed) * 1000;
}

/** El domingo a primera hora arma la semana nueva, aunque nadie abra la agenda. */
export function scheduleWeekOpening() {
  void openReleasedWeeks().catch((error: unknown) => {
    console.error("No se pudo armar la semana.", error);
  });
  const wait = msUntilNextWeekOpening();
  const delay = wait === 0 ? 7 * 24 * 60 * 60 * 1000 : wait;
  setTimeout(() => {
    scheduleWeekOpening();
  }, delay);
}
