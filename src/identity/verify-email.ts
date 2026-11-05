import { createHash, randomBytes } from "node:crypto";
import { query } from "./db.ts";
import { IdentityError } from "./errors.ts";
import type { CurrentUser, LoginProvider } from "./types.ts";

// shortcut: outbox stays in process memory and is never sent or trimmed, replace when a mail vendor is approved.

const invalidLink = "This verification link is no longer valid.";

export type VerificationMessage = {
  to: string;
  link: string;
};

const outbox: VerificationMessage[] = [];

type AccountRow = {
  id: string;
  email: string;
  email_verified: boolean;
  login_provider: string;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function loginProvider(value: string): LoginProvider {
  if (value === "google" || value === "microsoft" || value === "password") return value;
  throw new Error(`Unexpected login provider: ${value}`);
}

function toCurrentUser(row: AccountRow): CurrentUser {
  return {
    id: row.id,
    email: row.email,
    emailVerified: row.email_verified,
    loginProvider: loginProvider(row.login_provider),
  };
}

export function readVerificationOutbox(): readonly VerificationMessage[] {
  return outbox;
}

export function clearVerificationOutbox(): void {
  outbox.length = 0;
}

export async function sendVerificationLink(account: {
  id: string;
  email: string;
}): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  // The insert reads retired so the delete finishes first and cannot remove the new row.
  await query(
    `with retired as (
       delete from identity.email_verifications
       where account_id = $1::bigint
       returning 1
     )
     insert into identity.email_verifications (account_id, token_hash)
     select $1::bigint, $2
     where (select count(*) from retired) >= 0`,
    [account.id, hashToken(token)],
  );
  outbox.push({
    to: account.email,
    link: `/verify?token=${encodeURIComponent(token)}`,
  });
}

export async function confirmEmail(input: { token: string }): Promise<CurrentUser> {
  const token = input.token.trim();
  if (!token) throw new IdentityError("VALIDATION_ERROR", invalidLink);
  const rows = await query<AccountRow>(
    `with spent as (
       delete from identity.email_verifications
       where token_hash = $1
         and sent_at + interval '24 hours' > now()
       returning account_id
     )
     update identity.accounts a
     set email_verified = true
     from spent
     where a.id = spent.account_id
     returning a.id::text as id, a.email, a.email_verified, a.login_provider`,
    [hashToken(token)],
  );
  const row = rows[0];
  if (!row) throw new IdentityError("VALIDATION_ERROR", invalidLink);
  return toCurrentUser(row);
}
