import { Suspense } from "react";
import { AuthShell } from "@/components/auth-shell";
import { StudentRecoverForm } from "@/components/student-recover-form";

export default function StudentRecoverPage() {
  return (
    <Suspense
      fallback={
        <AuthShell
          title="Recuperar contraseña."
          hint="Preparando el email de recuperación."
        />
      }
    >
      <StudentRecoverForm />
    </Suspense>
  );
}
