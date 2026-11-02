export type AbsenceOutcome = "credit" | "notice";

export function classStart(ymd: string, slotStart: string) {
  const date = new Date(`${ymd}T00:00:00`);
  const [hours, minutes] = slotStart.split(":").map(Number);
  date.setHours(Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  return date;
}

/** Aviso a tiempo y dentro del tope del mes: devuelve crédito. Si no, solo avisa. */
export function cancellationOutcome(input: {
  classAt: Date;
  now: Date;
  noticeHours: number;
  usedThisMonth: number;
  maxPerMonth: number;
}): AbsenceOutcome {
  const noticeMs = input.noticeHours * 60 * 60 * 1000;
  const onTime = input.classAt.getTime() - input.now.getTime() >= noticeMs;
  if (onTime && input.usedThisMonth < input.maxPerMonth) return "credit";
  return "notice";
}

export function parseNoticeHours(raw: unknown, fallback = 12) {
  if (raw == null || raw === "") return fallback;
  const hours = Math.round(Number(raw));
  if (!Number.isFinite(hours) || hours < 0 || hours > 168) {
    throw new Error("La anticipación va de 0 a 168 horas.");
  }
  return hours;
}

export function parseMaxCancels(raw: unknown, fallback = 4) {
  if (raw == null || raw === "") return fallback;
  const max = Math.round(Number(raw));
  if (!Number.isFinite(max) || max < 0 || max > 31) {
    throw new Error("El tope de cancelaciones va de 0 a 31 por mes.");
  }
  return max;
}
