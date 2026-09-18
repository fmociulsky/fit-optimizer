"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAppStore } from "@/components/app-provider";
import { currentWeight } from "@/lib/metrics";
import { cn } from "@/lib/utils";

function Scale({
  label,
  value,
  onChange,
  low,
  high,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  low: string;
  high: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <Label>{label}</Label>
        <span className="tabular-nums text-muted-foreground">{value}/5</span>
      </div>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={cn(
              "h-10 flex-1 rounded-xl text-sm font-medium",
              value === n
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}

export function CheckInDialog({ due = false }: { due?: boolean }) {
  const { state, submitCheckIn } = useAppStore();
  const [open, setOpen] = useState(false);
  const planned = state?.profile.weekdays.length ?? 3;
  const [weightKg, setWeightKg] = useState(state ? currentWeight(state) : 70);
  const [energy, setEnergy] = useState(3);
  const [sleep, setSleep] = useState(3);
  const [sessionsCompleted, setSessionsCompleted] = useState(planned);
  const [pain, setPain] = useState("");
  const [notes, setNotes] = useState("");

  const canSubmit = useMemo(
    () => weightKg >= 40 && weightKg <= 220 && sessionsCompleted >= 0,
    [weightKg, sessionsCompleted]
  );

  if (!state) return null;
  const app = state;

  function handleOpenChange(next: boolean) {
    if (next) {
      setWeightKg(currentWeight(app));
      setSessionsCompleted(app.profile.weekdays.length);
    }
    setOpen(next);
  }

  function submit() {
    if (!canSubmit) return;
    submitCheckIn({
      weightKg,
      energy,
      sleep,
      sessionsCompleted,
      pain,
      notes,
    });
    toast.success("Check-in guardado. El plan se reajustó con lo que contaste.");
    setOpen(false);
    setPain("");
    setNotes("");
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            variant={due ? "default" : "outline"}
            className="h-11 px-4"
          />
        }
      >
        {due ? "Hacer check-in de la semana" : "Nuevo check-in"}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl italic">
            Cómo te fue esta semana
          </DialogTitle>
          <DialogDescription>
            Con esto reajustamos intensidad, volumen o cardio. Sé honesto: un
            2 en energía vale más que un “bien”.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ck-weight">Peso de hoy (kg)</Label>
              <Input
                id="ck-weight"
                type="number"
                step="0.1"
                value={weightKg}
                onChange={(e) => setWeightKg(Number(e.target.value))}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ck-sessions">Sesiones hechas (de {planned})</Label>
              <Input
                id="ck-sessions"
                type="number"
                min={0}
                max={7}
                value={sessionsCompleted}
                onChange={(e) => setSessionsCompleted(Number(e.target.value))}
                className="h-11"
              />
            </div>
          </div>
          <Scale
            label="Energía"
            value={energy}
            onChange={setEnergy}
            low="Agotado"
            high="Con ganas"
          />
          <Scale
            label="Sueño"
            value={sleep}
            onChange={setSleep}
            low="Muy mal"
            high="Descansado"
          />
          <div className="space-y-2">
            <Label htmlFor="ck-pain">¿Dolor o molestia?</Label>
            <Input
              id="ck-pain"
              value={pain}
              onChange={(e) => setPain(e.target.value)}
              placeholder="Ej. rodilla derecha al bajar"
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ck-notes">Notas de la semana</Label>
            <Textarea
              id="ck-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Viaje, estrés, regla, resfriado…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" onClick={submit} disabled={!canSubmit} className="h-11 px-4">
            Guardar y reajustar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
