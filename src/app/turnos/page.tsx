import { StudioBooking } from "@/components/studio-booking";
import { requireClient } from "@/lib/require-user";

export default async function TurnosPage() {
  await requireClient();
  return <StudioBooking />;
}
