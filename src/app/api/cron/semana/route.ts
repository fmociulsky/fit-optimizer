import { gymTodayYmd } from "@/lib/client-account";
import { openReleasedWeeks } from "@/lib/month-turns";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization");
  if (secret && header !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!secret && process.env.NODE_ENV === "production") {
    return new Response("Unauthorized", { status: 401 });
  }
  const ymd = gymTodayYmd();
  if (new Date(`${ymd}T12:00:00`).getDay() !== 0) {
    return Response.json({ opened: false, ymd });
  }
  const result = await openReleasedWeeks();
  return Response.json({ opened: true, ymd, ...result });
}
