import { randomBytes } from "node:crypto";
import { query } from "./db.ts";
import { IdentityError } from "./errors.ts";
import { writeSessionCookie } from "./session.ts";
import type { LoginProvider, ProviderSignInResult } from "./types.ts";

export const GOOGLE_STATE_COOKIE = "google_oauth";
export const GOOGLE_LINK_COOKIE = "google_link";
export const MICROSOFT_STATE_COOKIE = "microsoft_oauth";
export const MICROSOFT_LINK_COOKIE = "microsoft_link";

// shortcut: the account key is the normalized email. Store Google's sub when an email can move to another person.

type AccountRow = {
  id: string;
  email: string;
  email_verified: boolean;
  login_provider: string;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function loginProvider(value: string): LoginProvider {
  if (value === "google" || value === "microsoft" || value === "password")
    return value;
  throw new Error(`Unexpected login provider: ${value}`);
}

export function publicOrigin(input: {
  url: string;
  forwardedHost: string | null;
  forwardedProto: string | null;
}): string {
  const host = input.forwardedHost?.split(",")[0]?.trim() ?? "";
  const proto = input.forwardedProto?.split(",")[0]?.trim();
  if (
    /^[a-z0-9.-]+(?::\d+)?$/i.test(host) &&
    (proto === "http" || proto === "https")
  ) {
    return `${proto}://${host}`;
  }
  return new URL(input.url).origin;
}

export function googleCallbackUrl(origin: string): string {
  return new URL("/sign-in/google/callback", origin).toString();
}

export function microsoftCallbackUrl(origin: string): string {
  return new URL("/sign-in/microsoft/callback", origin).toString();
}

export async function signInWithProvider(input: {
  provider: "google" | "microsoft";
  email: string;
  linkAsMailbox: boolean;
}): Promise<ProviderSignInResult> {
  const email = normalizeEmail(input.email);
  if (email.length === 0) {
    throw new IdentityError("VALIDATION_ERROR", "Enter an email");
  }

  const rows = await query<AccountRow>(
    `insert into identity.accounts (email, password_hash, email_verified, login_provider)
     values ($1, null, true, $2)
     on conflict (email) do update
       set email_verified = true
     returning id::text as id, email, email_verified, login_provider`,
    [email, input.provider],
  );
  const row = rows[0];
  const sessionId = randomBytes(32).toString("base64url");
  await query(
    "insert into identity.sessions (id, account_id) values ($1, $2::bigint)",
    [sessionId, row.id],
  );
  await writeSessionCookie(sessionId);
  return {
    id: row.id,
    email: row.email,
    emailVerified: row.email_verified,
    loginProvider: loginProvider(row.login_provider),
    // shortcut: linkAsMailbox is only returned. Mailboxes reads it when that module connects an inbox.
    linkAsMailbox: input.linkAsMailbox,
  };
}

export async function exchangeAuthorizationCode(input: {
  provider: "google" | "microsoft";
  code: string;
  redirectUri: string;
}): Promise<{ email: string }> {
  if (input.provider === "microsoft") return exchangeMicrosoft(input);
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Google sign-in is not configured");
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: input.code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: input.redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenResponse.ok) throw new Error("Google token exchange failed");
  const token = (await tokenResponse.json()) as { access_token?: string };
  if (!token.access_token) throw new Error("Google token exchange failed");

  const profileResponse = await fetch(
    "https://openidconnect.googleapis.com/v1/userinfo",
    {
      headers: { authorization: `Bearer ${token.access_token}` },
    },
  );
  if (!profileResponse.ok) throw new Error("Google profile request failed");
  const profile = (await profileResponse.json()) as { email?: unknown };
  if (typeof profile.email !== "string" || profile.email.trim() === "") {
    throw new Error("Google did not return an email");
  }
  return { email: profile.email };
}

function emailFromIdToken(idToken: string): string {
  // shortcut: signature is not checked. This value is the body of our client-authenticated token response. Verify it if an id_token is accepted from anywhere else.
  const segment = idToken.split(".")[1];
  if (!segment) throw new Error("Microsoft did not return an email");
  let email: unknown;
  try {
    email = (
      JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as {
        email?: unknown;
      }
    ).email;
  } catch {
    throw new Error("Microsoft did not return an email");
  }
  if (typeof email !== "string" || email.trim() === "") {
    throw new Error("Microsoft did not return an email");
  }
  return email;
}

async function exchangeMicrosoft(input: {
  code: string;
  redirectUri: string;
}): Promise<{ email: string }> {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Microsoft sign-in is not configured");
  }

  const tokenResponse = await fetch(
    "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: input.code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: input.redirectUri,
        grant_type: "authorization_code",
        scope: "openid email",
      }),
    },
  );
  if (!tokenResponse.ok) throw new Error("Microsoft token exchange failed");
  const token = (await tokenResponse.json()) as { id_token?: unknown };
  if (typeof token.id_token !== "string")
    throw new Error("Microsoft token exchange failed");
  return { email: emailFromIdToken(token.id_token) };
}
