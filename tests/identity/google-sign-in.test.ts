import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { after, before, beforeEach, test } from "node:test";
import { exec, query } from "../../src/identity/db.ts";
import { IdentityError } from "../../src/identity/errors.ts";
import {
  exchangeAuthorizationCode,
  googleCallbackUrl,
  publicOrigin,
  signInWithProvider,
} from "../../src/identity/provider-sign-in";
import {
  readMemorySessionCookie,
  requireUser,
  signOut,
} from "../../src/identity/session.ts";

process.env.IDENTITY_COOKIE_STORE = "memory";

const fresh = "google.person@example.com";
const optedIn = "google.optin@example.com";

async function removeFixtures(): Promise<void> {
  await query("delete from identity.accounts where email = any($1::text[])", [
    [fresh, optedIn],
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

test("google sign-in verifies the email, stores no password, and creates no mailbox", async () => {
  const user = await signInWithProvider({
    provider: "google",
    email: "  Google.Person@Example.com ",
    linkAsMailbox: false,
  });

  assert.equal(user.email, fresh);
  assert.equal(user.emailVerified, true);
  assert.equal(user.loginProvider, "google");
  assert.equal(user.linkAsMailbox, false);
  assert.equal("password" in user, false);
  assert.equal("passwordHash" in user, false);
  assert.equal("password_hash" in user, false);

  const rows = await query<{
    password_hash: string | null;
    login_provider: string;
  }>(
    `select password_hash, login_provider from identity.accounts where email = $1`,
    [fresh],
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].login_provider, "google");
  assert.equal(rows[0].password_hash, null);

  const cookie = readMemorySessionCookie();
  assert.ok(cookie);
  assert.equal(cookie.httpOnly, true);
  const current = await requireUser();
  assert.equal(current.id, user.id);

  const again = await signInWithProvider({
    provider: "google",
    email: fresh,
    linkAsMailbox: false,
  });
  assert.equal(again.id, user.id);
  const count = await query<{ count: string }>(
    "select count(*)::text as count from identity.accounts where email = $1",
    [fresh],
  );
  assert.equal(count[0].count, "1");

  const mailboxes = await query<{ name: string | null }>(
    "select to_regclass('identity.mailboxes')::text as name",
  );
  assert.equal(mailboxes[0].name, null);
});

test("opting in returns linkAsMailbox true and still creates no mailbox", async () => {
  const user = await signInWithProvider({
    provider: "google",
    email: optedIn,
    linkAsMailbox: true,
  });
  assert.equal(user.linkAsMailbox, true);
  assert.equal(user.emailVerified, true);
  assert.equal(user.loginProvider, "google");
  const mailboxes = await query<{ name: string | null }>(
    "select to_regclass('identity.mailboxes')::text as name",
  );
  assert.equal(mailboxes[0].name, null);
});

test("the callback url uses the public host", () => {
  assert.equal(
    publicOrigin({
      url: "http://localhost:3000/sign-in/google",
      forwardedHost: "inbox.example.com",
      forwardedProto: "https",
    }),
    "https://inbox.example.com",
  );
  assert.equal(
    googleCallbackUrl("https://inbox.example.com"),
    "https://inbox.example.com/sign-in/google/callback",
  );
  assert.equal(
    publicOrigin({
      url: "http://localhost:3000/sign-in/google",
      forwardedHost: "evil.example/path",
      forwardedProto: "https",
    }),
    "http://localhost:3000",
  );
  assert.equal(
    publicOrigin({
      url: "http://127.0.0.1:3000/sign-in/google",
      forwardedHost: null,
      forwardedProto: null,
    }),
    "http://127.0.0.1:3000",
  );
});

test("google exchange fails closed without credentials", async () => {
  const savedId = process.env.GOOGLE_CLIENT_ID;
  const savedSecret = process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  try {
    await assert.rejects(
      () =>
        exchangeAuthorizationCode({
          provider: "google",
          code: "not-a-real-code",
          redirectUri: "http://localhost:3000/sign-in/google/callback",
        }),
      (error: unknown) => {
        assert.equal(
          error instanceof Error && error.message,
          "Google sign-in is not configured",
        );
        return true;
      },
    );
  } finally {
    if (savedId === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = savedId;
    if (savedSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET;
    else process.env.GOOGLE_CLIENT_SECRET = savedSecret;
  }
});

test("a blank email is rejected", async () => {
  await assert.rejects(
    () =>
      signInWithProvider({
        provider: "google",
        email: "   ",
        linkAsMailbox: false,
      }),
    (error: unknown) => {
      assert.ok(error instanceof IdentityError);
      assert.equal(error.code, "VALIDATION_ERROR");
      return true;
    },
  );
});
