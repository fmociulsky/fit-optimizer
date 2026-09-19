"use client";

import { CircleHelp } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAppStore } from "@/components/app-provider";
import { getExerciseGuide } from "@/lib/exercise-guides";
import type { Exercise } from "@/lib/types";

export function ExerciseGuideDialog({ exercise }: { exercise: Exercise }) {
  const { state } = useAppStore();
  const guide = getExerciseGuide(exercise.name, state?.profile.sex);
  const videoSrc = guide.video ?? "/exercises/male/generic.mp4";

  return (
    <Dialog>
      <DialogTrigger
        nativeButton
        className="flex w-full cursor-pointer flex-col gap-1 rounded-xl py-3 text-left transition-colors hover:bg-muted/60 sm:flex-row sm:items-baseline sm:justify-between"
      >
        <div>
          <span className="block font-medium">{exercise.name}</span>
          {exercise.notes && (
            <span className="mt-0.5 block text-sm text-muted-foreground">{exercise.notes}</span>
          )}
          <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary">
            <CircleHelp className="size-3.5" />
            Cómo se hace
          </span>
        </div>
        <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
          {exercise.sets} × {exercise.reps}
          {exercise.restSec > 0 ? ` · ${exercise.restSec}s` : ""}
        </span>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl italic">
            {exercise.name}
          </DialogTitle>
          <DialogDescription>{guide.summary}</DialogDescription>
        </DialogHeader>

        <video
          key={videoSrc}
          className="aspect-[4/3] w-full rounded-2xl bg-muted object-cover"
          src={videoSrc}
          poster={guide.poster ?? "/exercises/male/generic-0.jpg"}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-label={`Vídeo: cómo hacer ${exercise.name}`}
        />

        <ol className="grid gap-3 sm:grid-cols-3">
          {guide.phases.map((phase, index) => (
            <li
              key={phase.title}
              className="rounded-2xl border border-border bg-secondary/40 p-3"
            >
              <p className="text-xs font-medium tracking-wide text-primary uppercase">
                {index + 1}. {phase.title}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {phase.cue}
              </p>
            </li>
          ))}
        </ol>

        <div className="space-y-3 text-sm">
          <p>
            <span className="font-medium">Colócate. </span>
            {guide.setup}
          </p>
          <p>
            <span className="font-medium">Respira. </span>
            {guide.breathe}
          </p>
          <div>
            <p className="font-medium">Evita</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
              {guide.avoid.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
