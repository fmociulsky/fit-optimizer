import type { WorkoutDay } from "@/lib/types";
import { INTENSITY_LABEL } from "@/lib/labels";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExerciseGuideDialog } from "@/components/exercise-guide-dialog";
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
            <li key={ex.name}>
              <ExerciseGuideDialog exercise={ex} />
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
