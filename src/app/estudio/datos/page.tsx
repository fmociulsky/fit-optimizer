import { StudioOwnerProfileForm } from "@/components/studio-owner-profile-form";
import { requireStudio } from "@/lib/require-user";

export default async function EstudioDatosPage() {
  await requireStudio();
  return <StudioOwnerProfileForm />;
}
