import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { loadAccount } from "@/lib/account";
import { clientHomeHref } from "@/lib/roles";
import { getSessionUserId } from "@/lib/session";

export async function requireUser() {
  const userId = await getSessionUserId();
  if (userId) return userId;
  await auth.protect();
  return (await auth()).userId as string;
}

export async function requireClient() {
  await requireUser();
  const account = await loadAccount();
  if (!account) redirect("/rol");
  if (account.role === "professional") redirect("/profesor");
  if (account.role === "studio") redirect("/estudio");
  return account;
}

export async function requireProfessional() {
  await requireUser();
  const account = await loadAccount();
  if (!account) redirect("/rol");
  if (account.role !== "professional") {
    redirect(clientHomeHref(account));
  }
  return account;
}

export async function requireStudio() {
  await requireUser();
  const account = await loadAccount();
  if (!account) redirect("/rol");
  if (account.role !== "studio") {
    redirect(clientHomeHref(account));
  }
  return account;
}

export async function requireAdmin() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/admin");
  const account = await loadAccount();
  if (!account || account.role !== "admin") {
    redirect(account ? clientHomeHref(account) : "/admin");
  }
  return account;
}
