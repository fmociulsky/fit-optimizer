import { Suspense } from "react";
import { AuthShell } from "@/components/auth-shell";
import { StudentPasswordForm } from "@/components/student-password-form";

export default function StudentPasswordPage() {
  return (
    <Suspense
      fallback={
        <AuthShell
          title="Elegí tu contraseña."
          hint="Abriendo el enlace del email."
        />
      }
    >
      <StudentPasswordForm />
    </Suspense>
  );
}
