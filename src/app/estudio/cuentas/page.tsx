import { GymAccountsView } from "@/components/gym-accounts";
import { requireStudio } from "@/lib/require-user";

export default async function CuentasEstudioPage() {
  await requireStudio();
  return <GymAccountsView />;
}
