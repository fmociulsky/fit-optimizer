"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { ageFromBirthDate, parseLocalYmd, toLocalYmd } from "./metrics";

export type GooglePrefill = {
  name: string;
  birthDate: string;
  fromGoogle: boolean;
};

function nameFromClerk(user: {
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  username?: string | null;
}) {
  const full = user.fullName?.trim();
  if (full) return full;
  const joined = [user.firstName, user.lastName]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(" ")
    .trim();
  return joined || user.username?.trim() || "";
}

function ymdFromPeopleBirthday(payload: {
  birthdays?: { date?: { year?: number; month?: number; day?: number }; metadata?: { primary?: boolean } }[];
}) {
  const birthdays = payload.birthdays ?? [];
  const chosen =
    birthdays.find((item) => item.metadata?.primary && item.date?.year) ??
    birthdays.find((item) => item.date?.year) ??
    birthdays[0];
  const date = chosen?.date;
  if (!date?.year || !date.month || !date.day) return "";
  const ymd = toLocalYmd(new Date(date.year, date.month - 1, date.day));
  return parseLocalYmd(ymd) && Number.isFinite(ageFromBirthDate(ymd)) ? ymd : "";
}

async function birthdayFromGoogle(userId: string, client: Awaited<ReturnType<typeof clerkClient>>) {
  try {
    const tokens = await client.users.getUserOauthAccessToken(userId, "google");
    const token = tokens.data[0]?.token;
    if (!token) return "";
    const response = await fetch(
      "https://people.googleapis.com/v1/people/me?personFields=birthdays",
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
    );
    if (!response.ok) return "";
    return ymdFromPeopleBirthday(await response.json());
  } catch {
    return "";
  }
}

export async function loadGooglePrefill(): Promise<GooglePrefill> {
  const { userId } = await auth();
  if (!userId) return { name: "", birthDate: "", fromGoogle: false };

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const fromGoogle = user.externalAccounts.some((account) =>
    account.provider === "google" || account.provider === "oauth_google"
  );

  return {
    name: nameFromClerk(user),
    birthDate: fromGoogle ? await birthdayFromGoogle(userId, client) : "",
    fromGoogle,
  };
}
