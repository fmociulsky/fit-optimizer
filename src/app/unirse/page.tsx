import { StudioJoinForm } from "@/components/studio-join-form";
import { requireUser } from "@/lib/require-user";

export default async function UnirsePage() {
  await requireUser();
  return <StudioJoinForm />;
}
