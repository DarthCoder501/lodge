import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

// shortcut: spent hashes live in this process. A restart or another server shows a used link as invalid. Persist them when a mail vendor is approved.
const spentHashes = new Set<string>();

export type OpenedVerification =
  | { kind: "verified"; email: string }
  | { kind: "expired"; email: string }
  | { kind: "used" }
  | { kind: "invalid" };

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
  if (value === "google" || value === "microsoft" || value === "password")
    return value;
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
  const link = `/verify?token=${encodeURIComponent(token)}`;
  outbox.push({ to: account.email, link });
  // shortcut: dev tests read this file because the in-memory outbox is not shared across server workers. Remove it when a mail vendor sends the link.
  if (process.env.NODE_ENV !== "production") {
    const dir = join(tmpdir(), "lodge-verify");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, encodeURIComponent(account.email)), link, {
      mode: 0o600,
    });
  }
}

export function readDevVerificationLink(email: string): string {
  if (process.env.NODE_ENV === "production") return "";
  try {
    return readFileSync(
      join(tmpdir(), "lodge-verify", encodeURIComponent(email)),
      "utf8",
    );
  } catch {
    return "";
  }
}

export async function openVerification(
  token: string,
): Promise<OpenedVerification> {
  const trimmed = token.trim();
  if (!trimmed) return { kind: "invalid" };
  const hash = hashToken(trimmed);
  const rows = await query<{ email: string; fresh: boolean }>(
    `select a.email, (v.sent_at + interval '24 hours' > now()) as fresh
     from identity.email_verifications v
     join identity.accounts a on a.id = v.account_id
     where v.token_hash = $1`,
    [hash],
  );
  const row = rows[0];
  if (row?.fresh === true) {
    try {
      const user = await confirmEmail({ token: trimmed });
      spentHashes.add(hash);
      return { kind: "verified", email: user.email };
    } catch (error) {
      if (!(error instanceof IdentityError)) throw error;
      return spentHashes.has(hash) ? { kind: "used" } : { kind: "invalid" };
    }
  }
  if (row) return { kind: "expired", email: row.email };
  if (spentHashes.has(hash)) return { kind: "used" };
  return { kind: "invalid" };
}

export async function resendVerificationLink(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  const rows = await query<{ id: string; email: string }>(
    "select id::text as id, email from identity.accounts where email = $1",
    [normalized],
  );
  const account = rows[0];
  if (!account) return false;
  await sendVerificationLink(account);
  return true;
}

export async function confirmEmail(input: {
  token: string;
}): Promise<CurrentUser> {
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
