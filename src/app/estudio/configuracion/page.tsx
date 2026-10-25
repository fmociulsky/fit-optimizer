import { AccountConfigForm } from "@/components/account-config-form";
import { requireStudio } from "@/lib/require-user";

export default async function EstudioConfiguracionPage() {
  await requireStudio();
  return <AccountConfigForm role="studio" />;
}
