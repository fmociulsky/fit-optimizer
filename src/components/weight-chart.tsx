import type { AppState } from "@/lib/types";

export function WeightChart({ state }: { state: AppState }) {
  const points = [
    { date: state.plan.createdAt, weight: state.plan.startWeightKg },
    ...state.checkIns.map((c) => ({ date: c.date, weight: c.weightKg })),
  ];

  const unique = points.filter((p, i, arr) => {
    if (i === 0) return true;
    return arr[i - 1].weight !== p.weight || arr[i - 1].date !== p.date;
  });

  if (unique.length < 2) {
    return (
      <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground">
        El gráfico aparece tras el primer check-in. El punto de partida es{" "}
        {state.profile.weightKg} kg.
      </div>
    );
  }

  const weights = unique.map((p) => p.weight);
  const min = Math.min(...weights) - 1;
  const max = Math.max(...weights) + 1;
  const w = 320;
  const h = 140;
  const pad = 12;
  const coords = unique.map((p, i) => {
    const x = pad + (i / (unique.length - 1)) * (w - pad * 2);
    const y = pad + ((max - p.weight) / (max - min || 1)) * (h - pad * 2);
    return { x, y, ...p };
  });
  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");
  const last = coords.at(-1)!;
  const first = coords[0];
  const delta = last.weight - first.weight;

  return (
    <div>
      <div className="mb-2 flex items-end justify-between">
        <p className="font-heading text-3xl italic tabular-nums">{last.weight.toFixed(1)} kg</p>
        <p className="text-sm text-muted-foreground">
          {delta > 0 ? "+" : ""}
          {delta.toFixed(1)} kg desde el inicio
        </p>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-40 w-full overflow-visible">
        <path d={path} fill="none" stroke="currentColor" strokeWidth="2.5" className="text-primary" />
        {coords.map((c) => (
          <circle key={c.date} cx={c.x} cy={c.y} r="3.5" className="fill-primary" />
        ))}
      </svg>
    </div>
  );
}
