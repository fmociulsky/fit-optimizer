"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth-shell";
import { useAppStore } from "@/components/app-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginDemoProfessional } from "@/lib/session";
import { cn } from "@/lib/utils";

export function ProfessionalLoginForm() {
  const router = useRouter();
  const { enterDemoProfessional } = useAppStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const account = await loginDemoProfessional(username, password);
      enterDemoProfessional(account);
      toast.success(
        account.userId.startsWith("demo-")
          ? "Entraste como profesor de prueba."
          : "Entraste como profesor."
      );
      router.replace("/profesor");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo entrar."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Entrar como profesor."
      hint="Los profesores del gimnasio entran con su usuario y contraseña 1234. Para el profesor de prueba: 1234 y 1234."
    >
      <form
        className="mx-auto w-full max-w-sm space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="pro-user">Usuario</Label>
          <Input
            id="pro-user"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="h-11 text-base"
            autoComplete="username"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pro-pass">Contraseña</Label>
          <Input
            id="pro-pass"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
