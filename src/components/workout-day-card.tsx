import type { WorkoutDay } from "@/lib/types";
import { INTENSITY_LABEL } from "@/lib/labels";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export function WorkoutDayCard({
  day,
  actions,
}: {
  day: WorkoutDay;
  actions?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="font-heading text-2xl italic">{day.name}</CardTitle>
            <p className="mt-1 text-muted-foreground">{day.focus}</p>
          </div>
          <div className="flex gap-1.5">
            <Badge variant="secondary">{day.durationMin} min</Badge>
            <Badge variant="outline">{INTENSITY_LABEL[day.intensity]}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Calentamiento. </span>
          {day.warmup}
        </p>
        <ul className="divide-y">
          {day.exercises.map((ex) => (
            <li key={ex.name} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:justify-between">
              <div>
                <p className="font-medium">{ex.name}</p>
                {ex.notes && (
                  <p className="text-sm text-muted-foreground">{ex.notes}</p>
                )}
              </div>
              <p className="shrink-0 text-sm tabular-nums text-muted-foreground">
                {ex.sets} × {ex.reps}
                {ex.restSec > 0 ? ` · ${ex.restSec}s` : ""}
              </p>
            </li>
          ))}
        </ul>
        <Separator />
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Cierre. </span>
          {day.cooldown}
        </p>
        {actions}
      </CardContent>
    </Card>
  );
}
