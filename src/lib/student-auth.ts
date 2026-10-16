"use server";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { accounts, studioMemberships } from "@/db/schema";
import { appOrigin } from "@/lib/origin";
import { hashPassword } from "@/lib/password";
import { passwordResetEmailContent } from "@/lib/password-reset-email";
import {
  createPasswordResetToken,
  parseResetPassword,
  readPasswordResetToken,
} from "@/lib/password-reset";

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

async function syncLocalPassword(userId: string, password: string) {
  await getDb()
    .update(accounts)
    .set({
      passwordHash: await hashPassword(password),
      updatedAt: new Date(),
    })
    .where(eq(accounts.userId, userId));
}

async function syncClerkPassword(clerkUserId: string, password: string) {
  const client = await clerkClient();
  await client.users.updateUser(clerkUserId, { password });
}

async function sendResetLinkEmail(input: {
  email: string;
  name: string;
  resetUrl: string;
  logoUrl: string;
}) {
  const from =
    process.env.CLERK_EMAIL_FROM?.trim() ||
    process.env.EMAIL_FROM?.trim() ||
    "";
  if (!from) return false;
  const content = passwordResetEmailContent({
    name: input.name,
    resetUrl: input.resetUrl,
    logoUrl: input.logoUrl,
  });
  try {
    let attachments:
      | { filename: string; content: string }[]
      | undefined;
    try {
      const logo = await readFile(
        join(process.cwd(), "public", "enforma-logo.png")
      );
      attachments = [
        { filename: "enforma-logo.png", content: logo.toString("base64") },
      ];
    } catch {
      attachments = undefined;
    }
    const client = await clerkClient();
    await client.emails.create({
      to: { address: input.email },
      from: { address: from, name: "Enforma" },
      subject: content.subject,
      html: content.html,
      text: content.text,
      ...(attachments ? { attachments } : {}),
    });
    return true;
  } catch {
    return false;
  }
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

export async function syncStudentPasswordFromClerk(password: string) {
  parseResetPassword(password);
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) throw new Error("No hay sesión.");
  const client = await clerkClient();
  const user = await client.users.getUser(clerkUserId);
  const email = clerkEmail(user);
  if (!email) throw new Error("No hay un alumno con ese email.");
  const student = await findGymStudentByEmail(email);
  if (!student) throw new Error("No hay un alumno con ese email.");
  await syncLocalPassword(student.userId, password);
  if (!student.clerkUserId) {
    await getDb()
      .update(accounts)
      .set({ clerkUserId, updatedAt: new Date() })
      .where(eq(accounts.userId, student.userId));
  }
  return { ok: true as const };
}

/** @deprecated Use requestStudentPasswordReset */
export async function requestStudentFirstAccess(rawEmail: string) {
  return requestStudentPasswordReset(rawEmail);
}

export async function requestStudentPasswordReset(rawEmail: string) {
  const email = parseStudentEmail(rawEmail);
  const student = await findGymStudentByEmail(email);
  if (!student) {
    throw new Error(
      "No hay un alumno con ese email. Pedile al gimnasio que te dé de alta."
    );
  }

  const origin = await appOrigin();
  const token = createPasswordResetToken(student.userId);
  const resetUrl = `${origin}/entrar-usuario/clave?token=${encodeURIComponent(token)}`;
  const logoUrl = `${origin}/enforma-logo.png`;

  const emailed = await sendResetLinkEmail({
    email,
    name: student.name || "",
    resetUrl,
    logoUrl,
  });
  if (emailed) return { ok: true as const, mode: "link" as const };

  if (!student.clerkUserId) {
    const client = await clerkClient();
    try {
      await client.invitations.createInvitation({
        emailAddress: email,
        redirectUrl: resetUrl,
        notify: true,
        ignoreExisting: true,
        publicMetadata: { enformaStudent: true, passwordReset: true },
      });
      return { ok: true as const, mode: "link" as const };
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "No se pudo enviar el email.";
      throw new Error(
        message.toLowerCase().includes("already")
          ? "Ese email ya tiene una cuenta. Entrá con tu contraseña o con Google, o pedí recuperar de nuevo."
          : "No se pudo enviar el email para restablecer la contraseña."
      );
    }
  }

  return { ok: true as const, mode: "clerk" as const, email };
}

export async function loadPasswordResetTarget(token: string) {
  const userId = readPasswordResetToken(token.trim());
  if (!userId) {
    throw new Error(
      "Ese enlace no es válido o ya venció. Pedí recuperar contraseña de nuevo."
    );
  }
  const [student] = await getDb()
    .select({
      userId: accounts.userId,
      name: accounts.name,
      email: accounts.email,
    })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.role, "client")))
    .limit(1);
  if (!student?.email) {
    throw new Error(
      "Ese enlace no es válido o ya venció. Pedí recuperar contraseña de nuevo."
    );
  }
  return {
    name: student.name || "Alumno",
    email: student.email,
  };
}

export async function resetStudentPasswordWithToken(
  token: string,
  password: string
) {
  const nextPassword = parseResetPassword(password);
  const userId = readPasswordResetToken(token.trim());
  if (!userId) {
    throw new Error(
      "Ese enlace no es válido o ya venció. Pedí recuperar contraseña de nuevo."
    );
  }
  const [student] = await getDb()
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.role, "client")))
    .limit(1);
  if (!student) {
    throw new Error(
      "Ese enlace no es válido o ya venció. Pedí recuperar contraseña de nuevo."
    );
  }
  await syncLocalPassword(student.userId, nextPassword);
  if (student.clerkUserId) {
    try {
      await syncClerkPassword(student.clerkUserId, nextPassword);
    } catch {
      // La contraseña local ya quedó; el login con email sigue andando.
    }
  }
  return {
    ok: true as const,
    email: student.email || "",
    userId: student.userId,
  };
}
