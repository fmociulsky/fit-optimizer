import { AccountConfigForm } from "@/components/account-config-form";
import { requireProfessional } from "@/lib/require-user";

export default async function ProfesorConfiguracionPage() {
  await requireProfessional();
  return <AccountConfigForm role="teacher" />;
}
