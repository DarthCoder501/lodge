import { randomBytes } from "node:crypto";
import { query } from "./db.ts";
import { IdentityError } from "./errors.ts";
import { verifyPassword } from "./hash.ts";
import { writeSessionCookie } from "./session.ts";
import type { CurrentUser, LoginProvider } from "./types.ts";

const INVALID_LOGIN_MESSAGE = "Email or password is wrong. Try again.";

const dummyPasswordHash = `scrypt$${randomBytes(16).toString("hex")}$${randomBytes(32).toString("hex")}`;

type AccountRow = {
  id: string;
  email: string;
  email_verified: boolean;
  login_provider: string;
  password_hash: string;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function invalidLogin(): IdentityError {
  return new IdentityError("INVALID_LOGIN", INVALID_LOGIN_MESSAGE);
}

function loginProvider(value: string): LoginProvider {
  if (value === "google" || value === "microsoft" || value === "password") return value;
  throw new Error(`Unexpected login provider: ${value}`);
}

export async function signInWithPassword(input: {
  email: string;
  password: string;
}): Promise<CurrentUser> {
  const email = normalizeEmail(input.email);
  const rows = await query<AccountRow>(
    `select id::text as id, email, email_verified, login_provider, password_hash
     from identity.accounts
     where email = $1`,
    [email],
  );
  const row = rows[0];
  const matches = await verifyPassword(input.password, row?.password_hash ?? dummyPasswordHash);
  if (!row || !matches) throw invalidLogin();

  const sessionId = randomBytes(32).toString("base64url");
  await query("insert into identity.sessions (id, account_id) values ($1, $2::bigint)", [
    sessionId,
    row.id,
  ]);
  await writeSessionCookie(sessionId);
  return {
    id: row.id,
    email: row.email,
    emailVerified: row.email_verified,
    loginProvider: loginProvider(row.login_provider),
  };
}
