import { StudioAbsencesView } from "@/components/studio-absences";
import { requireStudio } from "@/lib/require-user";

export default async function AusenciasSucursalPage({
  params,
}: {
  params: Promise<{ studioId: string }>;
}) {
  await requireStudio();
  const { studioId } = await params;
  return <StudioAbsencesView studioId={studioId} />;
}
