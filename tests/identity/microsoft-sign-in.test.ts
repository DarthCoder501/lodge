import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { after, before, beforeEach, test } from "node:test";
import { exec, query } from "../../src/identity/db.ts";
import {
  exchangeAuthorizationCode,
  microsoftCallbackUrl,
  signInWithProvider,
} from "../../src/identity/provider-sign-in";
import { signOut } from "../../src/identity/session.ts";
import { signUpWithPassword } from "../../src/identity/sign-up.ts";

process.env.IDENTITY_COOKIE_STORE = "memory";

const fresh = "microsoft.person@example.com";
const optedIn = "microsoft.optin@example.com";
const joined = "microsoft.join@example.com";

async function removeFixtures(): Promise<void> {
  await query("delete from identity.accounts where email = any($1::text[])", [
    [fresh, optedIn, joined],
  ]);
}

before(async () => {
  const dir = join("supabase", "migrations");
  for (const name of readdirSync(dir)
    .filter((file) => file.endsWith(".sql"))
    .sort()) {
    await exec(readFileSync(join(dir, name), "utf8"));
  }
  await removeFixtures();
});

after(async () => {
  await signOut();
  await removeFixtures();
});

beforeEach(async () => {
  await signOut();
  await removeFixtures();
});

test("microsoft sign-in verifies the email and stores no password", async () => {
  const user = await signInWithProvider({
    provider: "microsoft",
    email: "  Microsoft.Person@Example.com ",
    linkAsMailbox: false,
  });

  assert.equal(user.email, fresh);
  assert.equal(user.emailVerified, true);
  assert.equal(user.loginProvider, "microsoft");
  assert.equal(user.linkAsMailbox, false);
  assert.equal("password" in user, false);
  assert.equal("passwordHash" in user, false);

  const rows = await query<{ password_hash: string | null }>(
    "select password_hash from identity.accounts where email = $1",
    [fresh],
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].password_hash, null);

  const mailboxes = await query<{ name: string | null }>(
    "select to_regclass('identity.mailboxes')::text as name",
  );
  assert.equal(mailboxes[0].name, null);
});

test("opting in returns linkAsMailbox true and still creates no mailbox", async () => {
  const user = await signInWithProvider({
    provider: "microsoft",
    email: optedIn,
    linkAsMailbox: true,
  });
  assert.equal(user.linkAsMailbox, true);
  assert.equal(user.loginProvider, "microsoft");
  const mailboxes = await query<{ name: string | null }>(
    "select to_regclass('identity.mailboxes')::text as name",
  );
  assert.equal(mailboxes[0].name, null);
});

test("a provider sign-in for an existing email returns that account", async () => {
  const created = await signUpWithPassword({
    email: "Microsoft.Join@Example.com",
    password: "long-enough-password",
  });

  const viaMicrosoft = await signInWithProvider({
    provider: "microsoft",
    email: joined,
    linkAsMailbox: false,
  });
  assert.equal(viaMicrosoft.id, created.id);
  assert.equal(viaMicrosoft.emailVerified, true);
  assert.equal(viaMicrosoft.linkAsMailbox, false);
  assert.equal(viaMicrosoft.loginProvider, "password");

  const viaGoogle = await signInWithProvider({
    provider: "google",
    email: "  microsoft.join@example.com ",
    linkAsMailbox: true,
  });
  assert.equal(viaGoogle.id, created.id);
  assert.equal(viaGoogle.linkAsMailbox, true);
  assert.equal(viaGoogle.loginProvider, "password");

  const rows = await query<{ count: string; password_hash: string | null }>(
    `select count(*)::text as count, max(password_hash) as password_hash
     from identity.accounts where email = $1`,
    [joined],
  );
  assert.equal(rows[0].count, "1");
  assert.ok(rows[0].password_hash);
});

test("the microsoft callback url uses the public origin", () => {
  assert.equal(
    microsoftCallbackUrl("https://inbox.example.com"),
    "https://inbox.example.com/sign-in/microsoft/callback",
  );
});

test("microsoft exchange returns the id token email", async () => {
  const savedId = process.env.MICROSOFT_CLIENT_ID;
  const savedSecret = process.env.MICROSOFT_CLIENT_SECRET;
  process.env.MICROSOFT_CLIENT_ID = "microsoft-client";
  process.env.MICROSOFT_CLIENT_SECRET = "microsoft-secret";
  const payload = Buffer.from(
    JSON.stringify({ email: "Ms.Person@Example.com" }),
  ).toString("base64url");
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assert.equal(
      String(url),
      "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    );
    const body = String(init?.body);
    assert.equal(body.includes("code=auth-code"), true);
    assert.equal(body.includes("client_id=microsoft-client"), true);
    assert.equal(body.includes("redirect_uri="), true);
    assert.equal(body.includes("grant_type=authorization_code"), true);
    return new Response(
      JSON.stringify({
        access_token: "access",
        id_token: `header.${payload}.sig`,
      }),
      { status: 200 },
    );
  };
  try {
    const profile = await exchangeAuthorizationCode({
      provider: "microsoft",
      code: "auth-code",
      redirectUri: "http://localhost:3000/sign-in/microsoft/callback",
    });
    assert.equal(profile.email, "Ms.Person@Example.com");
  } finally {
    globalThis.fetch = original;
    if (savedId === undefined) delete process.env.MICROSOFT_CLIENT_ID;
    else process.env.MICROSOFT_CLIENT_ID = savedId;
    if (savedSecret === undefined) delete process.env.MICROSOFT_CLIENT_SECRET;
    else process.env.MICROSOFT_CLIENT_SECRET = savedSecret;
  }
});

test("microsoft exchange fails closed without credentials", async () => {
  const savedId = process.env.MICROSOFT_CLIENT_ID;
  const savedSecret = process.env.MICROSOFT_CLIENT_SECRET;
  delete process.env.MICROSOFT_CLIENT_ID;
  delete process.env.MICROSOFT_CLIENT_SECRET;
  try {
    await assert.rejects(
      () =>
        exchangeAuthorizationCode({
          provider: "microsoft",
          code: "not-a-real-code",
          redirectUri: "http://localhost:3000/sign-in/microsoft/callback",
        }),
      (error: unknown) => {
        assert.equal(
          error instanceof Error && error.message,
          "Microsoft sign-in is not configured",
        );
        return true;
      },
    );
  } finally {
    if (savedId === undefined) delete process.env.MICROSOFT_CLIENT_ID;
    else process.env.MICROSOFT_CLIENT_ID = savedId;
    if (savedSecret === undefined) delete process.env.MICROSOFT_CLIENT_SECRET;
    else process.env.MICROSOFT_CLIENT_SECRET = savedSecret;
  }
});
