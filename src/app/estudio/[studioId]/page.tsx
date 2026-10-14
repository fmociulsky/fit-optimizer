import { StudioBranchForm } from "@/components/studio-branch-form";
import { requireStudio } from "@/lib/require-user";

export default async function EditarSucursalPage({
  params,
}: {
  params: Promise<{ studioId: string }>;
}) {
  await requireStudio();
  const { studioId } = await params;
  return <StudioBranchForm studioId={studioId} />;
}
