import { MindView } from "@/components/mind-view";
import { requireClient } from "@/lib/require-user";

export default async function MentePage() {
  await requireClient();
  return <MindView />;
}
