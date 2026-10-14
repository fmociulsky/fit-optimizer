import { StudioPeopleView } from "@/components/studio-people";
import { requireStudio } from "@/lib/require-user";

export default async function AlumnosSucursalPage({
  params,
}: {
  params: Promise<{ studioId: string }>;
}) {
  await requireStudio();
  const { studioId } = await params;
  return <StudioPeopleView studioId={studioId} section="alumnos" />;
}
