import { ClientLoginForm } from "@/components/client-login-form";

export default async function EntrarUsuarioPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return <ClientLoginForm denied={error === "no-alumno"} />;
}
