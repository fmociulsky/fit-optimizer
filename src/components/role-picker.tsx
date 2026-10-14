"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Building2, GraduationCap, User } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { useAppStore } from "@/components/app-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { clientHomeHref } from "@/lib/roles";
import type { AccountRole } from "@/lib/types";

const OPTIONS: {
  id: AccountRole;
  title: string;
  hint: string;
  icon: typeof User;
}[] = [
  {
    id: "studio",
    title: "Administro un gimnasio",
    hint: "Profesores, alumnos, horarios y cupo. Puede ser gimnasio, casa de pilates o ambos.",
    icon: Building2,
  },
  {
    id: "professional",
    title: "Soy profesor",
    hint: "El gimnasio me asigna alumnos. Cargo mi horario.",
    icon: GraduationCap,
  },
  {
    id: "client",
    title: "Soy alumno",
    hint: "Me dieron un código ALU-. Elijo el día dentro del horario de mi sucursal.",
    icon: User,
  },
];

function presetRole(como: string | null): AccountRole {
  if (como === "profesional" || como === "profesor") return "professional";
  if (como === "alumno" || como === "usuario") return "client";
  return "studio";
}

export function RolePicker() {
  const router = useRouter();
  const params = useSearchParams();
  const { account, chooseRole, state } = useAppStore();
  const preset = presetRole(params.get("como"));
  const [role, setRole] = useState<AccountRole>(account?.role ?? preset);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (account?.role) setRole(account.role);
  }, [account?.role]);

  async function continueWithRole() {
    if (busy) return;
    setBusy(true);
    try {
      const next = await chooseRole(role);
      toast.success(
        next.role === "professional"
          ? "Cuenta de profesor lista."
          : next.role === "studio"
            ? "Gimnasio listo."
            : "Cuenta de alumno lista."
      );
      router.replace(
        next.role === "professional"
          ? "/profesor"
          : next.role === "studio"
            ? "/estudio"
            : clientHomeHref(next, Boolean(state))
      );
    } catch {
      toast.error("No se pudo guardar el rol. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-svh bg-background">
      <SiteHeader compact />
      <main className="mx-auto w-full max-w-xl px-4 py-10">
        <p className="text-sm font-medium tracking-wide text-primary uppercase">
          Tu cuenta
        </p>
        <h1 className="mt-1 font-heading text-4xl tracking-tight italic sm:text-5xl">
          ¿Cómo vas a usar Enforma?
        </h1>
        <p className="mt-3 text-muted-foreground">
          Gimnasio, profesor y alumno no ven lo mismo. Si te invitaron, entra
          con el código.
        </p>
        <Link
          href="/unirse"
          className="mt-3 inline-block text-sm text-primary underline-offset-4 hover:underline"
        >
          Tengo un código de gimnasio
        </Link>
        <div className="mt-8 grid gap-3">
          {OPTIONS.map((option) => {
            const Icon = option.icon;
            const selected = role === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setRole(option.id)}
                className={cn(
                  "rounded-2xl border px-4 py-4 text-left transition-colors",
                  selected
                    ? "border-primary bg-primary/8 ring-1 ring-primary"
                    : "border-border bg-card hover:border-primary/40"
                )}
              >
                <div className="flex items-start gap-3">
                  <Icon className="mt-0.5 size-5 shrink-0 text-primary" />
                  <div>
                    <p className="font-medium">{option.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {option.hint}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        <Button
          className="mt-8 h-11 px-5"
          disabled={busy}
          onClick={() => void continueWithRole()}
        >
          {busy ? "Guardando…" : "Continuar"}
        </Button>
      </main>
    </div>
  );
}
