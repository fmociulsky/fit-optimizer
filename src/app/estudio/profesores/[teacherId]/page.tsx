import { GymTeacherDetailView } from "@/components/gym-teachers";
import { requireStudio } from "@/lib/require-user";

export default async function ProfesorGimnasioPage({
  params,
}: {
  params: Promise<{ teacherId: string }>;
}) {
  await requireStudio();
  const { teacherId } = await params;
  return <GymTeacherDetailView teacherId={teacherId} />;
}
