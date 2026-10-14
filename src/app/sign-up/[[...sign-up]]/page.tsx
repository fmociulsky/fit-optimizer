import { SignUp } from "@clerk/nextjs";
import { AuthShell } from "@/components/auth-shell";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ como?: string }>;
}) {
  const { como } = await searchParams;
  const after =
    como === "profesional" || como === "profesor"
      ? "/rol?como=profesor"
      : como === "estudio" || como === "gimnasio"
        ? "/rol?como=gimnasio"
        : como === "alumno"
          ? "/rol?como=alumno"
          : "/rol";
  return (
    <AuthShell
      title="Crea tu cuenta."
      hint={
        como === "profesional" || como === "profesor"
          ? "Luego eliges profesor. El gimnasio te asigna alumnos."
          : como === "estudio" || como === "gimnasio"
            ? "Luego eliges gimnasio y cargas profesores, alumnos y horarios."
            : como === "alumno"
              ? "Luego eliges alumno y entras con el código que te dieron."
              : "Correo y contraseña. Luego eliges si administras un gimnasio, eres profesor o alumno."
      }
    >
      <div className="flex justify-center">
        <SignUp
          fallbackRedirectUrl={after}
          signInUrl="/sign-in"
          forceRedirectUrl={after}
        />
      </div>
    </AuthShell>
  );
}
