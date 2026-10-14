import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { accounts } from "@/db/schema";

export async function resolveInternalUserIdFromClerk(clerkUserId: string) {
  const [linked] = await getDb()
    .select({ userId: accounts.userId })
    .from(accounts)
    .where(eq(accounts.clerkUserId, clerkUserId))
    .limit(1);
  return linked?.userId ?? null;
}
