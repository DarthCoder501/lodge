import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { after, before, beforeEach, test } from "node:test";
import { exec, query } from "../../src/identity/db.ts";
import { IdentityError } from "../../src/identity/errors.ts";
import { assertCanConnectMailbox } from "../../src/identity/mailbox-gate.ts";
import { signInWithPassword } from "../../src/identity/sign-in.ts";
import {
  readMemorySessionCookie,
  requireUser,
  signOut,
} from "../../src/identity/session.ts";
import { signUpWithPassword } from "../../src/identity/sign-up.ts";
import type { CurrentUser } from "../../src/identity/types.ts";
import {
  clearVerificationOutbox,
  confirmEmail,
  openVerification,
  readVerificationOutbox,
  sendVerificationLink,
} from "../../src/identity/verify-email.ts";

process.env.IDENTITY_COOKIE_STORE = "memory";

const password = "0123456789";
const emails = [
  "verify.gate@example.com",
  "verify.used@example.com",
  "verify.fresh@example.com",
  "verify.expired@example.com",
  "verify.resend@example.com",
  "verify.open@example.com",
  "verify.open-old@example.com",
];

const invalidLink = "This verification link is no longer valid.";

async function removeFixtures(): Promise<void> {
  await query("delete from identity.accounts where email = any($1::text[])", [
    emails,
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
  clearVerificationOutbox();
});

function asIdentityError(error: unknown): IdentityError {
  if (error instanceof IdentityError) return error;
  throw error;
}

async function rejected(run: () => Promise<unknown>): Promise<IdentityError> {
  try {
    await run();
  } catch (error) {
    return asIdentityError(error);
  }
  assert.fail("expected an error");
}

function latestToken(): string {
  const link = readVerificationOutbox().at(-1)?.link;
  assert.ok(link);
  const token = new URL(link, "http://localhost").searchParams.get("token");
  assert.ok(token);
  assert.equal(link.includes(token), true);
  return token;
}

function noToken(user: CurrentUser): void {
  assert.equal("token" in user, false);
  assert.equal("verificationToken" in user, false);
  assert.equal("token_hash" in user, false);
  assert.equal("tokenHash" in user, false);
}

async function ageLink(email: string, interval: string): Promise<void> {
  await query(
    `update identity.email_verifications v
     set sent_at = now() - $2::interval
     from identity.accounts a
     where a.id = v.account_id and a.email = $1`,
    [email, interval],
  );
}

test("an unverified account can sign in, and the mailbox gate waits for the link", async () => {
  const created = await signUpWithPassword({
    email: "  Verify.Gate@Example.com ",
    password,
  });
  assert.equal(created.emailVerified, false);
  noToken(created);
  assert.throws(
    () => assertCanConnectMailbox(created),
    (error: unknown) => {
      const identityError = asIdentityError(error);
      assert.equal(identityError.code, "EMAIL_UNVERIFIED");
      assert.equal(
        identityError.message,
        "Verify your email before connecting a mailbox",
      );
      return true;
    },
  );

  const signedIn = await signInWithPassword({
    email: "verify.gate@example.com",
    password,
  });
  assert.equal(signedIn.id, created.id);
  assert.equal(signedIn.emailVerified, false);
  assert.ok(readMemorySessionCookie());
  assert.throws(
    () => assertCanConnectMailbox(signedIn),
    (error: unknown) => {
      assert.equal(asIdentityError(error).code, "EMAIL_UNVERIFIED");
      return true;
    },
  );

  const token = latestToken();
  const rows = await query<{ token_hash: string }>(
    `select v.token_hash
     from identity.email_verifications v
     join identity.accounts a on a.id = v.account_id
     where a.email = $1`,
    ["verify.gate@example.com"],
  );
  assert.equal(rows.length, 1);
  assert.match(rows[0].token_hash, /^[0-9a-f]{64}$/);
  assert.notEqual(rows[0].token_hash, token);
  assert.equal(rows[0].token_hash.includes(token), false);

  const confirmed = await confirmEmail({ token });
  assert.equal(confirmed.id, created.id);
  assert.equal(confirmed.email, "verify.gate@example.com");
  assert.equal(confirmed.emailVerified, true);
  assert.equal(confirmed.loginProvider, "password");
  noToken(confirmed);
  assertCanConnectMailbox(confirmed);

  const current = await requireUser();
  assert.equal(current.emailVerified, true);
  noToken(current);
  assertCanConnectMailbox(current);
});

test("a used link fails", async () => {
  await signUpWithPassword({ email: "verify.used@example.com", password });
  const token = latestToken();
  await confirmEmail({ token });
  const error = await rejected(() => confirmEmail({ token }));
  assert.equal(error.code, "VALIDATION_ERROR");
  assert.equal(error.message, invalidLink);
});

test("a link younger than 24 hours works and an older link fails", async () => {
  await signUpWithPassword({ email: "verify.fresh@example.com", password });
  await ageLink("verify.fresh@example.com", "23 hours");
  const fresh = await confirmEmail({ token: latestToken() });
  assert.equal(fresh.emailVerified, true);

  clearVerificationOutbox();
  await signUpWithPassword({ email: "verify.expired@example.com", password });
  await ageLink("verify.expired@example.com", "24 hours 1 second");
  const error = await rejected(() => confirmEmail({ token: latestToken() }));
  assert.equal(error.code, "VALIDATION_ERROR");
  assert.equal(error.message, invalidLink);
  const rows = await query<{ email_verified: boolean }>(
    "select email_verified from identity.accounts where email = $1",
    ["verify.expired@example.com"],
  );
  assert.equal(rows[0].email_verified, false);
});

test("a new link retires the previous one", async () => {
  const created = await signUpWithPassword({
    email: "verify.resend@example.com",
    password,
  });
  const first = latestToken();
  await sendVerificationLink(created);
  const second = latestToken();
  assert.notEqual(first, second);

  const retired = await rejected(() => confirmEmail({ token: first }));
  assert.equal(retired.code, "VALIDATION_ERROR");
  assert.equal(retired.message, invalidLink);

  const confirmed = await confirmEmail({ token: second });
  assert.equal(confirmed.emailVerified, true);
  assertCanConnectMailbox(confirmed);

  const rows = await query<{ count: string }>(
    `select count(*)::text as count
     from identity.email_verifications v
     join identity.accounts a on a.id = v.account_id
     where a.email = $1`,
    ["verify.resend@example.com"],
  );
  assert.equal(rows[0].count, "0");
});

test("opening a link verifies it, and a bad, used, or expired link does not", async () => {
  await signUpWithPassword({ email: "verify.open@example.com", password });
  const token = latestToken();

  assert.deepEqual(await openVerification(""), { kind: "invalid" });
  assert.deepEqual(await openVerification("not-a-real-token"), {
    kind: "invalid",
  });
  const stillUnverified = await query<{ email_verified: boolean }>(
    "select email_verified from identity.accounts where email = $1",
    ["verify.open@example.com"],
  );
  assert.equal(stillUnverified[0].email_verified, false);

  const ok = await openVerification(token);
  assert.deepEqual(ok, { kind: "verified", email: "verify.open@example.com" });
  assert.equal(JSON.stringify(ok).includes(token), false);
  const current = await query<{ email_verified: boolean }>(
    "select email_verified from identity.accounts where email = $1",
    ["verify.open@example.com"],
  );
  assert.equal(current[0].email_verified, true);
  assert.deepEqual(await openVerification(token), { kind: "used" });

  clearVerificationOutbox();
  await signUpWithPassword({ email: "verify.open-old@example.com", password });
  await ageLink("verify.open-old@example.com", "24 hours 1 second");
  const expired = await openVerification(latestToken());
  assert.deepEqual(expired, {
    kind: "expired",
    email: "verify.open-old@example.com",
  });
  const rows = await query<{ email_verified: boolean }>(
    "select email_verified from identity.accounts where email = $1",
    ["verify.open-old@example.com"],
  );
  assert.equal(rows[0].email_verified, false);
});
