"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loadMyStudio, redeemStudioInvite } from "@/lib/studio";
import { cn } from "@/lib/utils";

export function StudioJoinForm() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [already, setAlready] = useState<string | null>(null);
  const [teacherHint, setTeacherHint] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadMyStudio()
      .then((row) => {
        if (cancelled || !row) return;
        if (row.role === "owner") {
          setAlready(`Ya tienes el gimnasio ${row.studio.name}.`);
          return;
        }
        if (row.role === "client") {
          setAlready(`Ya estás en ${row.studio.name}.`);
          return;
        }
        if (row.role === "teacher" && row.branchNames.length) {
          setTeacherHint(
            `Ya das clase en ${row.branchNames.join(", ")}. Otro código PRF- te suma a otra sucursal del mismo gimnasio.`
          );
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit() {
    if (busy) return;
    setBusy(true);
    try {
      const next = await redeemStudioInvite(code);
      toast.success(
        next.memberRole === "teacher"
          ? `Entraste como profesor en ${next.studioName}.`
          : `Entraste como alumno en ${next.studioName}.`
      );
      window.location.assign(
        next.role === "professional" ? "/profesor" : "/panel"
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo usar el código."
      );
      setBusy(false);
    }
  }

  return (
    <div className="min-h-svh bg-background">
      <SiteHeader compact />
      <main className="mx-auto w-full max-w-xl px-4 py-10">
        <p className="text-sm font-medium tracking-wide text-primary uppercase">
          Unirse
        </p>
        <h1 className="mt-1 font-heading text-4xl tracking-tight italic sm:text-5xl">
          Código del gimnasio.
        </h1>
        <p className="mt-3 text-muted-foreground">
          El gimnasio te da un código PRF- si eres profesor o ALU- si eres
          alumno. Con eso entras al sistema.
        </p>
        {teacherHint && (
          <p className="mt-3 text-sm text-muted-foreground">{teacherHint}</p>
        )}

        {already ? (
          <div className="mt-8 rounded-2xl border border-foreground/8 bg-card p-4">
            <p className="text-sm leading-relaxed">{already}</p>
            <Link
              href="/"
              className={cn(buttonVariants({ variant: "outline" }), "mt-4 h-11 px-4")}
            >
              Volver
            </Link>
          </div>
        ) : (
          <form
            className="mt-8 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="join-code">Código</Label>
              <Input
                id="join-code"
                className="h-11 text-base uppercase tracking-wide"
                placeholder="PRF- o ALU-"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                autoComplete="off"
              />
            </div>
            <Button className="h-11 px-5" disabled={busy || code.trim().length < 4}>
              {busy ? "Entrando…" : "Entrar al gimnasio"}
            </Button>
          </form>
        )}
      </main>
    </div>
  );
}
