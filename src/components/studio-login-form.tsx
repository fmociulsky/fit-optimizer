"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth-shell";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginDemoStudio } from "@/lib/session";
import { cn } from "@/lib/utils";

export function StudioLoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await loginDemoStudio(username, password);
      toast.success("Entraste como estudio de prueba.");
      window.location.assign("/estudio");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "No se pudo entrar."
      );
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Entrar como estudio."
      hint="Usuario y contraseña del estudio. Para la prueba: hema y 1234."
    >
      <form
        className="mx-auto w-full max-w-sm space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="studio-login">Usuario</Label>
          <Input
            id="studio-login"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="h-11 text-base"
            autoComplete="username"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="studio-pass">Contraseña</Label>
          <Input
            id="studio-pass"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-11 text-base"
            autoComplete="current-password"
          />
        </div>
        {error && (
          <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <Button className="h-11 w-full" disabled={busy} type="submit">
          {busy ? "Entrando…" : "Entrar"}
        </Button>
        <Link
          href="/"
          className={cn(buttonVariants({ variant: "ghost" }), "h-11 w-full")}
        >
          Volver
        </Link>
      </form>
    </AuthShell>
  );
}
