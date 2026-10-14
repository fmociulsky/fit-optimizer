"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth, useClerk } from "@clerk/nextjs";
import { AuthShell } from "@/components/auth-shell";
import { buttonVariants } from "@/components/ui/button";
import { claimStudentFromClerk } from "@/lib/student-auth";
import { cn } from "@/lib/utils";

export function StudentClaim() {
  const { isLoaded, userId } = useAuth();
  const { signOut } = useClerk();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!isLoaded || started.current) return;
    if (!userId) {
      window.location.replace("/entrar-usuario");
      return;
    }
    started.current = true;
    void claimStudentFromClerk()
      .then(async (result) => {
        if (result.ok) {
          window.location.assign("/panel");
          return;
        }
        await signOut({ redirectUrl: "/entrar-usuario?error=no-alumno" });
      })
      .catch(() => {
        setError("No se pudo validar el alumno.");
      });
  }, [isLoaded, signOut, userId]);

  if (error) {
    return (
      <AuthShell title="No pudiste entrar." hint={error}>
        <div className="flex justify-center">
          <Link
            href="/entrar-usuario"
            className={cn(buttonVariants(), "h-11 px-6")}
          >
            Volver
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Validando tu acceso."
      hint="Buscamos el alumno que el gimnasio dio de alta."
    />
  );
}
