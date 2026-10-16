"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSignIn, useSignUp } from "@clerk/nextjs";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth-shell";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginDemoClient } from "@/lib/session";
import { PASSWORD_HINT, passwordClientError } from "@/lib/password-rules";
import {
  claimStudentFromClerk,
  loadPasswordResetTarget,
  resetStudentPasswordWithToken,
  syncStudentPasswordFromClerk,
} from "@/lib/student-auth";
import { cn } from "@/lib/utils";

function clerkMessage(error: { message?: string; longMessage?: string } | null) {
  return error?.longMessage || error?.message || "No se pudo continuar.";
}

function ticketFromParams(params: URLSearchParams) {
  return (
    params.get("__clerk_ticket") ||
    params.get("__clerk_invitation_token") ||
    params.get("ticket") ||
    ""
  );
}

export function StudentPasswordForm() {
  const searchParams = useSearchParams();
  const resetToken = searchParams.get("token")?.trim() || "";
  const { signUp, fetchStatus: signUpStatus } = useSignUp();
  const { signIn, fetchStatus: signInStatus } = useSignIn();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetEmail, setResetEmail] = useState("");
  const started = useRef(false);

  const waiting =
    busy || signUpStatus === "fetching" || signInStatus === "fetching";

  useEffect(() => {
    if (resetToken) {
      let cancelled = false;
      void loadPasswordResetTarget(resetToken)
        .then((target) => {
          if (cancelled) return;
          setResetEmail(target.email);
          setReady(true);
        })
        .catch((caught: unknown) => {
          if (cancelled) return;
          setError(
            caught instanceof Error
              ? caught.message
              : "Ese enlace no es válido. Pedí recuperar contraseña de nuevo."
          );
        });
      return () => {
        cancelled = true;
      };
    }

    if (!signUp || started.current) return;
    const ticket = ticketFromParams(searchParams);
    if (!ticket) {
      setError(
        "Ese enlace no es válido. Pedí recuperar contraseña de nuevo."
      );
      return;
    }
    started.current = true;
    void (async () => {
      const { error: ticketError } = await signUp.ticket({ ticket });
      if (ticketError && signIn) {
        const { error: signInError } = await signIn.ticket({ ticket });
        if (signInError) {
          setError(clerkMessage(signInError));
          return;
        }
        if (signIn.status === "complete") {
          await signIn.finalize({
            navigate: async ({ decorateUrl }) => {
              const url = decorateUrl("/entrar-usuario/vincular");
              window.location.href = url.startsWith("http")
                ? url
                : "/entrar-usuario/vincular";
            },
          });
          return;
        }
      }
      if (
        ticketError &&
        signUp.status !== "complete" &&
        signUp.missingFields.length === 0
      ) {
        setError(clerkMessage(ticketError));
        return;
      }
      if (signUp.status === "complete") {
        await signUp.finalize({
          navigate: async ({ decorateUrl }) => {
            const url = decorateUrl("/entrar-usuario/vincular");
            window.location.href = url.startsWith("http")
              ? url
              : "/entrar-usuario/vincular";
          },
        });
        return;
      }
      setReady(true);
    })();
  }, [resetToken, searchParams, signIn, signUp]);

  async function submitResetToken() {
    if (waiting) return;
    const passwordError = passwordClientError(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await resetStudentPasswordWithToken(resetToken, password);
      const account = await loginDemoClient(
        result.email || resetEmail,
        password
      );
      if (!account) {
        throw new Error("La contraseña se guardó. Entrá con tu email.");
      }
      toast.success("Contraseña actualizada.");
      window.location.assign("/panel");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "No se pudo guardar."
      );
      setBusy(false);
    }
  }

  async function submitClerkInvite() {
    if (waiting || !signUp) return;
    const passwordError = passwordClientError(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const emailAddress = signUp.emailAddress || "";
      const { error: passwordError } = await signUp.password({
        emailAddress,
        password,
        firstName: signUp.firstName || "Alumno",
      });
      if (passwordError) throw new Error(clerkMessage(passwordError));
      if (signUp.status !== "complete") {
        throw new Error(
          "Falta completar el alta. Revisá el email e intentá de nuevo."
        );
      }
      await signUp.finalize({
        navigate: async ({ decorateUrl }) => {
          const url = decorateUrl("/entrar-usuario/vincular");
          if (url.startsWith("http")) {
            window.location.href = url;
            return;
          }
          const claimed = await claimStudentFromClerk();
          if (!claimed.ok) {
            window.location.replace("/entrar-usuario?error=no-alumno");
            return;
          }
          try {
            await syncStudentPasswordFromClerk(password);
          } catch {
            // Entró igual; la contraseña de Clerk ya quedó.
          }
          window.location.assign("/panel");
        },
      });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "No se pudo guardar."
      );
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Elegí tu contraseña."
      hint={`Con ese email y esta contraseña vas a entrar la próxima vez. ${PASSWORD_HINT}`}
    >
      {!ready && !error ? (
        <p className="text-center text-sm text-muted-foreground">
          Abriendo el enlace…
        </p>
      ) : null}
      {ready ? (
        <form
          className="mx-auto w-full max-w-sm space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void (resetToken ? submitResetToken() : submitClerkInvite());
          }}
        >
          {resetEmail ? (
            <p className="text-sm text-muted-foreground">{resetEmail}</p>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="new-pass">Contraseña</Label>
            <Input
              id="new-pass"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-11 text-base"
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-pass-2">Repetir contraseña</Label>
            <Input
              id="new-pass-2"
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              className="h-11 text-base"
              autoComplete="new-password"
            />
          </div>
          {error && (
            <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <Button className="h-11 w-full" disabled={waiting} type="submit">
            {waiting ? "Guardando…" : "Guardar y entrar"}
          </Button>
        </form>
      ) : error ? (
        <div className="mx-auto w-full max-w-sm space-y-4">
          <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
          <Link
            href="/entrar-usuario"
            className={cn(
              buttonVariants(),
              "flex h-11 w-full items-center justify-center"
            )}
          >
            Volver
          </Link>
        </div>
      ) : null}
    </AuthShell>
  );
}
