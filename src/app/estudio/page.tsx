import { StudioHome } from "@/components/studio-home";
import { requireStudio } from "@/lib/require-user";

export default async function EstudioPage() {
  await requireStudio();
  return <StudioHome />;
}
