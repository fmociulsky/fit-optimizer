import { SignIn } from "@clerk/nextjs";
import { AuthShell } from "@/components/auth-shell";

export default function SignInPage() {
  return (
    <AuthShell
      title="Entra a tu cuenta."
      hint="Así el gimnasio, tus alumnos o tus turnos quedan en tu perfil."
    >
      <div className="flex justify-center">
        <SignIn
          fallbackRedirectUrl="/"
          signUpUrl="/sign-up"
          forceRedirectUrl="/"
        />
      </div>
    </AuthShell>
  );
}
