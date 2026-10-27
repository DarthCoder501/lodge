import { query } from "./db.ts";
import { IdentityError } from "./errors.ts";
import type { CurrentUser, LoginProvider } from "./types.ts";

export const SESSION_COOKIE = "session";

// shortcut: sessions last until sign-out, add an expiry when a lifetime is chosen.
// shortcut: IDENTITY_COOKIE_STORE=memory records the cookie for node:test. Leave it unset so Next writes the httpOnly cookie. Ignored when NODE_ENV is production.

export type SessionCookie = {
  value: string;
  httpOnly: true;
  sameSite: "lax";
  path: "/";
  secure: boolean;
};

type AccountRow = {
  id: string;
  email: string;
  email_verified: boolean;
  login_provider: string;
};

const memory = new Map<string, SessionCookie>();

function useMemory(): boolean {
  return (
    process.env.NODE_ENV !== "production" && process.env.IDENTITY_COOKIE_STORE === "memory"
  );
}

function cookieRecord(sessionId: string): SessionCookie {
  return {
    value: sessionId,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  };
}

export function readMemorySessionCookie(): SessionCookie | undefined {
  return memory.get(SESSION_COOKIE);
}

async function requestCookies() {
  const { cookies } = await import("next/headers");
  return cookies();
}

export async function writeSessionCookie(sessionId: string): Promise<void> {
  const record = cookieRecord(sessionId);
  if (useMemory()) {
    memory.set(SESSION_COOKIE, record);
    return;
  }
  const jar = await requestCookies();
  jar.set(SESSION_COOKIE, sessionId, {
    httpOnly: record.httpOnly,
    sameSite: record.sameSite,
    path: record.path,
    secure: record.secure,
  });
}

async function readSessionId(): Promise<string | undefined> {
  if (useMemory()) return memory.get(SESSION_COOKIE)?.value;
  const jar = await requestCookies();
  return jar.get(SESSION_COOKIE)?.value;
}

async function clearSessionCookie(): Promise<void> {
  if (useMemory()) {
    memory.delete(SESSION_COOKIE);
    return;
  }
  const jar = await requestCookies();
  jar.delete(SESSION_COOKIE);
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

export async function requireUser(): Promise<CurrentUser> {
  const sessionId = await readSessionId();
  if (!sessionId) throw new IdentityError("UNAUTHENTICATED", "Sign in required");
  const rows = await query<AccountRow>(
    `select a.id::text as id, a.email, a.email_verified, a.login_provider
     from identity.sessions s
     join identity.accounts a on a.id = s.account_id
     where s.id = $1`,
    [sessionId],
  );
  const row = rows[0];
  if (!row) throw new IdentityError("UNAUTHENTICATED", "Sign in required");
  return toCurrentUser(row);
}

export async function signOut(): Promise<void> {
  const sessionId = await readSessionId();
  if (sessionId) {
    await query("delete from identity.sessions where id = $1", [sessionId]);
  }
  await clearSessionCookie();
}
