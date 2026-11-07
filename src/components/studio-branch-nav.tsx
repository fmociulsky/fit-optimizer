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
  active: "agenda" | "profesores" | "alumnos" | "ausencias" | "detalles";
}) {
  return (
    <header>
      <BackLink href="/estudio" />
      <h1 className="mt-2 font-heading text-4xl tracking-tight italic sm:text-5xl">
        {name}
      </h1>
      <nav className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
        {(
          [
            ["agenda", "Agenda", ""],
            ["profesores", "Profesores", "/profesores"],
            ["alumnos", "Alumnos", "/alumnos"],
            ["ausencias", "Ausencias", "/ausencias"],
            ["detalles", "Detalles", "/detalles"],
          ] as const
        ).map(([id, label, suffix]) => (
          <Link
            key={id}
            href={`/estudio/${studioId}${suffix}`}
            className={cn(
              buttonVariants({
                variant: active === id ? "default" : "outline",
              }),
              "h-10 shrink-0 px-4"
            )}
          >
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
