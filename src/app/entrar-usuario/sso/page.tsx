"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { AuthShell } from "@/components/auth-shell";

export default function StudentSsoPage() {
  return (
    <AuthShell title="Conectando." hint="Estamos volviendo de Google.">
      <AuthenticateWithRedirectCallback
        signInFallbackRedirectUrl="/entrar-usuario/vincular"
        signUpFallbackRedirectUrl="/entrar-usuario/vincular"
        signInForceRedirectUrl="/entrar-usuario/vincular"
        signUpForceRedirectUrl="/entrar-usuario/vincular"
      />
    </AuthShell>
  );
}
