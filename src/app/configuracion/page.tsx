import { AccountConfigForm } from "@/components/account-config-form";
import { requireClient } from "@/lib/require-user";

export default async function ConfiguracionPage() {
  await requireClient();
  return <AccountConfigForm role="client" />;
}