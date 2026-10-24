import { TeacherProfileForm } from "@/components/teacher-profile-form";
import { requireProfessional } from "@/lib/require-user";

export default async function ProfesorDatosPage() {
  await requireProfessional();
  return <TeacherProfileForm />;
}
