import { NutritionView } from "@/components/nutrition-view";
import { requireClient } from "@/lib/require-user";

export default async function NutricionPage() {
  await requireClient();
  return <NutritionView />;
}
