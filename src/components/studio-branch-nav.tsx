"use client";

import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function StudioBranchNav({
  studioId,
  name,
  active,
}: {
  studioId: string;
  name: string;
  active: "detalles" | "profesores" | "alumnos";
}) {
  return (
    <header>
      <BackLink href="/estudio" />
      <h1 className="mt-2 font-heading text-4xl tracking-tight italic sm:text-5xl">
        {name}
      </h1>
      <nav className="mt-5 flex flex-wrap gap-2">
        {(
          [
            ["profesores", "Profesores", "/profesores"],
            ["alumnos", "Alumnos", "/alumnos"],
            ["detalles", "Detalles", ""],
          ] as const
        ).map(([id, label, suffix]) => (
          <Link
            key={id}
            href={`/estudio/${studioId}${suffix}`}
            className={cn(
              buttonVariants({
                variant: active === id ? "default" : "outline",
              }),
              "h-10 px-4"
            )}
          >
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
