import { ClientProfileForm } from "@/components/client-profile-form";
import { requireClient } from "@/lib/require-user";

export default async function DatosPage() {
  await requireClient();
  return <ClientProfileForm />;
}
