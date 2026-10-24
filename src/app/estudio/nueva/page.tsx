import { redirect } from "next/navigation";
import { StudioBranchForm } from "@/components/studio-branch-form";
import { requireStudio } from "@/lib/require-user";
import { getOwnedBranchQuota } from "@/lib/studio";

export default async function NuevaSucursalPage() {
  await requireStudio();
  const quota = await getOwnedBranchQuota();
  if (!quota.canAdd) redirect("/estudio");
  return <StudioBranchForm />;
}
