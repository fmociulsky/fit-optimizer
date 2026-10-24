import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/admin-login-form";
import { loadAccount } from "@/lib/account";
import { getSessionUserId } from "@/lib/session";

export default async function AdminLoginPage() {
  const userId = await getSessionUserId();
  if (userId) {
    const account = await loadAccount();
    if (account?.role === "admin") redirect("/admin/estudios");
  }
  return <AdminLoginForm />;
}
