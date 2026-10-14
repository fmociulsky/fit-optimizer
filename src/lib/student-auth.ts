"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { accounts, studioMemberships } from "@/db/schema";
import { appOrigin } from "@/lib/origin";

function parseStudentEmail(raw: string) {
  const email = raw.trim().toLowerCase();
  if (email.length > 120) throw new Error("El email es demasiado largo.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Pon un email válido.");
  }
  return email;
}

function clerkEmail(user: {
  emailAddresses: { id: string; emailAddress: string }[];
  primaryEmailAddressId: string | null;
}) {
  const primary = user.emailAddresses.find(
    (item) => item.id === user.primaryEmailAddressId
  );
  return (primary?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? "")
    .trim()
    .toLowerCase();
}

async function findGymStudentByEmail(email: string) {
  const db = getDb();
  const [account] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.email, email), eq(accounts.role, "client")))
    .limit(1);
  if (!account) return null;
  const [member] = await db
    .select({ id: studioMemberships.id })
    .from(studioMemberships)
    .where(
      and(
        eq(studioMemberships.userId, account.userId),
        eq(studioMemberships.role, "client")
      )
    )
    .limit(1);
  if (!member) return null;
  return account;
}

export async function claimStudentFromClerk() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return { ok: false as const, reason: "no-session" };
  const client = await clerkClient();
  const user = await client.users.getUser(clerkUserId);
  const email = clerkEmail(user);
  if (!email) return { ok: false as const, reason: "no-alumno" };
  const student = await findGymStudentByEmail(email);
  if (!student) return { ok: false as const, reason: "no-alumno" };
  if (student.clerkUserId && student.clerkUserId !== clerkUserId) {
    return { ok: false as const, reason: "vinculado" };
  }
  const db = getDb();
  const [other] = await db
    .select({ userId: accounts.userId })
    .from(accounts)
    .where(eq(accounts.clerkUserId, clerkUserId))
    .limit(1);
  if (other && other.userId !== student.userId) {
    return { ok: false as const, reason: "vinculado" };
  }
  await db
    .update(accounts)
    .set({ clerkUserId: clerkUserId, updatedAt: new Date() })
    .where(eq(accounts.userId, student.userId));
  return { ok: true as const };
}

export async function requestStudentFirstAccess(rawEmail: string) {
  const email = parseStudentEmail(rawEmail);
  const student = await findGymStudentByEmail(email);
  if (!student) {
    throw new Error("No hay un alumno con ese email. Pedile al gimnasio que te dé de alta.");
  }
  if (student.clerkUserId) {
    throw new Error("Ese alumno ya tiene acceso. Entrá con Google o con tu email y contraseña.");
  }
  const origin = await appOrigin();
  const client = await clerkClient();
  try {
    await client.invitations.createInvitation({
      emailAddress: email,
      redirectUrl: `${origin}/entrar-usuario/clave`,
      notify: true,
      ignoreExisting: true,
      publicMetadata: { enformaStudent: true },
    });
  } catch (caught) {
    const message =
      caught instanceof Error ? caught.message : "No se pudo enviar el email.";
    throw new Error(
      message.toLowerCase().includes("already")
        ? "Ese email ya tiene una cuenta. Entrá con tu contraseña o con Google."
        : "No se pudo enviar el email para setear la contraseña."
    );
  }
  return { ok: true as const };
}
