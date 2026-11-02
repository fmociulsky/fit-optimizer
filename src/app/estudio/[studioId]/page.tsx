import { StudioWeekAgenda } from "@/components/studio-week-agenda";
import { requireStudio } from "@/lib/require-user";

export default async function SucursalPage({
  params,
}: {
  params: Promise<{ studioId: string }>;
}) {
  await requireStudio();
  const { studioId } = await params;
  return <StudioWeekAgenda studioId={studioId} />;
}
