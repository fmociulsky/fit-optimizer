import { ProfessionalBranches } from "@/components/professional-branches";
import { requireProfessional } from "@/lib/require-user";

export default async function ProfesorSucursalesPage() {
  await requireProfessional();
  return <ProfessionalBranches />;
}
