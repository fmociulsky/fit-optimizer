export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const state = globalThis as typeof globalThis & { __weekOpening?: boolean };
  if (state.__weekOpening) return;
  state.__weekOpening = true;
  const { scheduleWeekOpening } = await import("@/lib/month-turns");
  scheduleWeekOpening();
}
