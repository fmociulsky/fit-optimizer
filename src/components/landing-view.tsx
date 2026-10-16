import Link from "next/link";
import { Building2, GraduationCap, Users } from "lucide-react";
import { SiteHeader } from "@/components/site-header";

const ENTRIES = [
  {
    href: "/entrar-estudio",
    icon: Building2,
    title: "Estudio",
    text: "Ingresar como estudio",
  },
  {
    href: "/entrar-profesor",
    icon: GraduationCap,
    title: "Profesor",
    text: "Ingresar como profesor",
  },
  {
    href: "/entrar-usuario",
    icon: Users,
    title: "Alumno",
    text: "Ingresar como alumno",
  },
];

export function LandingView() {
  return (
    <div className="min-h-svh bg-background">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-12 sm:py-20">
        <p className="text-sm font-medium tracking-wide text-primary uppercase">
          Enforma
        </p>
        <h1 className="mt-3 font-heading text-5xl tracking-tight italic sm:text-6xl">
          Elegí cómo entrar.
        </h1>
        <div className="mt-10 grid gap-3 sm:grid-cols-3">
          {ENTRIES.map((entry) => (
            <Link
              key={entry.href}
              href={entry.href}
              className="rounded-3xl border border-foreground/8 bg-card p-5 transition-colors hover:border-primary/40"
            >
              <span className="flex items-center gap-3">
                <entry.icon className="size-5 shrink-0 text-primary" />
                <span className="font-heading text-3xl italic leading-none">
                  {entry.title}
                </span>
              </span>
              <span className="mt-1 block pl-8 text-sm text-muted-foreground">
                {entry.text}
              </span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
