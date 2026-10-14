import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Falta DATABASE_URL");

const sql = neon(url);

await sql`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS clerk_user_id text`;
await sql`CREATE UNIQUE INDEX IF NOT EXISTS accounts_clerk_user_id_uidx ON accounts (clerk_user_id)`;

const reserved = new Set(["1234", "1111", "2222"]);

function usernameFromEmail(email) {
  const local = String(email).split("@")[0]?.toLowerCase() ?? "";
  let base = local.replace(/[^a-z0-9._-]/g, "").replace(/^[._-]+|[._-]+$/g, "");
  if (base.length < 3) base = `alu${base}`.replace(/[^a-z0-9._-]/g, "");
  if (base.length < 3) base = "alumno";
  base = base.slice(0, 24);
  if (reserved.has(base) || !/^[a-z0-9._-]+$/.test(base)) {
    base = `alu-${base}`.replace(/[^a-z0-9._-]/g, "-").slice(0, 32);
  }
  if (base.length < 3) base = "alumno";
  return base;
}

const takenRows = await sql`SELECT username FROM accounts WHERE username IS NOT NULL`;
const taken = new Set(takenRows.map((row) => row.username));
const missing = await sql`
  SELECT user_id, email
  FROM accounts
  WHERE role = 'client' AND username IS NULL AND email IS NOT NULL AND email <> ''
`;

for (const row of missing) {
  const base = usernameFromEmail(row.email);
  let username = base;
  let attempt = 2;
  while (taken.has(username)) {
    username = `${base.slice(0, 28)}${attempt}`.slice(0, 32);
    attempt += 1;
  }
  taken.add(username);
  await sql`UPDATE accounts SET username = ${username} WHERE user_id = ${row.user_id}`;
}

console.log(`ok clerk_user_id + ${missing.length} usernames`);
