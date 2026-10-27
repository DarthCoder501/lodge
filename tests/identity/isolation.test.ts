import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { after, before, beforeEach, test } from "node:test";
import { exec, query } from "../../src/identity/db.ts";
import { IdentityError } from "../../src/identity/errors.ts";
import { signInWithPassword } from "../../src/identity/sign-in.ts";
import {
  readMemorySessionCookie,
  requireUser,
  signOut,
  writeSessionCookie,
} from "../../src/identity/session.ts";
import { signUpWithPassword } from "../../src/identity/sign-up.ts";

process.env.IDENTITY_COOKIE_STORE = "memory";

const password = "0123456789";
const emailA = "isolation.a@example.com";
const emailB = "isolation.b@example.com";

async function removeFixtures(): Promise<void> {
  await query("delete from identity.accounts where email = any($1::text[])", [[emailA, emailB]]);
}

before(async () => {
  const dir = join("supabase", "migrations");
  for (const name of readdirSync(dir).filter((file) => file.endsWith(".sql")).sort()) {
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

test("account A's session loads account A", async () => {
  const accountA = await signUpWithPassword({ email: emailA, password });
  await signUpWithPassword({ email: emailB, password });
  await signInWithPassword({ email: emailA, password });

  const current = await requireUser();
  assert.equal(current.id, accountA.id);
  assert.equal(current.email, emailA);
  assert.equal(current.emailVerified, false);
  assert.equal(current.loginProvider, "password");
});

test("account A's session does not load account B", async () => {
  const accountA = await signUpWithPassword({ email: emailA, password });
  const accountB = await signUpWithPassword({ email: emailB, password });
  await signInWithPassword({ email: emailA, password });
  const sessionA = readMemorySessionCookie();
  assert.ok(sessionA);

  await signInWithPassword({ email: emailB, password });
  const asB = await requireUser();
  assert.equal(asB.id, accountB.id);
  assert.equal(asB.email, emailB);

  await writeSessionCookie(sessionA.value);
  const asA = await requireUser();
  assert.equal(asA.id, accountA.id);
  assert.equal(asA.email, emailA);
  assert.notEqual(asA.id, accountB.id);
  assert.notEqual(asA.email, emailB);
});

test("no session fails with UNAUTHENTICATED", async () => {
  await signUpWithPassword({ email: emailA, password });
  await assert.rejects(
    () => requireUser(),
    (error: unknown) => {
      assert.ok(error instanceof IdentityError);
      assert.equal(error.code, "UNAUTHENTICATED");
      assert.equal(error.message, "Sign in required");
      return true;
    },
  );
});
