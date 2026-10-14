import { redirect } from "next/navigation";
import { LandingView } from "@/components/landing-view";
import { loadAccount } from "@/lib/account";
import { clientHomeHref } from "@/lib/roles";
import { loadUserState } from "@/lib/user-state";

export default async function Home() {
  let account = null;
  try {
    account = await loadAccount();
  } catch {
    account = null;
  }
  if (account) {
    const state = await loadUserState().catch(() => null);
    redirect(clientHomeHref(account, Boolean(state)));
  }
  return <LandingView />;
}
