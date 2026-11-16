#!/usr/bin/env node
/**
 * LOCAL DEVELOPMENT ONLY — create a confirmed account in the local Supabase
 * stack and authorize it as The Makerie's owner, so sign-in can be tested
 * without Google credentials (use the email-code backup; codes appear in the
 * local mail viewer at http://127.0.0.1:56324).
 *
 *   npm run db:owner -- you@example.com
 *
 * Refuses to run against anything but the local stack.
 */
import { execFileSync } from "node:child_process";

const email = process.argv[2]?.trim().toLowerCase();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Usage: npm run db:owner -- you@example.com");
  process.exit(1);
}

const status = JSON.parse(execFileSync("npx", ["supabase", "status", "-o", "json"], { encoding: "utf8" }));
const apiUrl = status.API_URL;
const secretKey = status.SECRET_KEY ?? status.SERVICE_ROLE_KEY;
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(apiUrl ?? "")) {
  console.error(`Refusing to run: ${apiUrl} is not a local Supabase API.`);
  process.exit(1);
}

const admin = (path, init = {}) =>
  fetch(`${apiUrl}/auth/v1/admin${path}`, {
    ...init,
    headers: { apikey: secretKey, Authorization: `Bearer ${secretKey}`, "content-type": "application/json" },
  });

let userId;
const created = await admin("/users", { method: "POST", body: JSON.stringify({ email, email_confirm: true }) });
if (created.ok) {
  userId = (await created.json()).id;
  console.log(`Created local account ${email}`);
} else {
  const list = await (await admin("/users?per_page=1000")).json();
  userId = list.users?.find((u) => u.email === email)?.id;
  if (!userId) {
    console.error(`Could not create or find ${email}: ${created.status} ${await created.text()}`);
    process.exit(1);
  }
  console.log(`Found existing local account ${email}`);
}

if (!/^[0-9a-f-]{36}$/.test(userId)) throw new Error("Unexpected user id");

try {
  execFileSync(
    "docker",
    [
      "exec",
      "supabase_db_themakerie",
      "psql",
      "-U",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `select private.authorize_account('${userId}', 'local owner');`,
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  console.log(`Authorized ${email} (${userId}) as the local owner.`);
} catch (error) {
  const message = String(error.stderr ?? error);
  if (message.includes("authorized_accounts_pkey")) console.log("Already authorized.");
  else if (message.includes("authorized_accounts_single_owner"))
    console.error("Another account is already the local owner. Run `npm run db:reset` to start over.");
  else console.error(message);
}
