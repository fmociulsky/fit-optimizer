import { StudioBranchForm } from "@/components/studio-branch-form";
import { requireStudio } from "@/lib/require-user";

export default async function NuevaSucursalPage() {
  await requireStudio();
  return <StudioBranchForm />;
}
