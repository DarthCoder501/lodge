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
const known = "signin.known@example.com";
const other = "signin.other@example.com";

async function removeFixtures(): Promise<void> {
  await query("delete from identity.accounts where email = any($1::text[])", [[known, other]]);
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

test("right password sets an httpOnly session cookie", async () => {
  const created = await signUpWithPassword({
    email: "  Signin.Known@Example.com ",
    password,
  });
  const user = await signInWithPassword({
    email: "  Signin.Known@Example.com ",
    password,
  });

  assert.equal(user.id, created.id);
  assert.equal(user.email, known);
  assert.equal(user.emailVerified, false);
  assert.equal(user.loginProvider, "password");
  assert.equal("password" in user, false);
  assert.equal("passwordHash" in user, false);
  assert.equal("password_hash" in user, false);

  const cookie = readMemorySessionCookie();
  assert.ok(cookie);
  assert.equal(cookie.httpOnly, true);
  assert.equal(cookie.sameSite, "lax");
  assert.equal(cookie.path, "/");

  const sessions = await query<{ id: string }>(
    "select id from identity.sessions where id = $1 and account_id = $2::bigint",
    [cookie.value, user.id],
  );
  assert.equal(sessions.length, 1);

  const current = await requireUser();
  assert.equal(current.id, user.id);
  assert.equal(current.email, user.email);
});

test("unknown email and wrong password fail the same way", async () => {
  await signUpWithPassword({ email: other, password });

  const unknown = await rejected(() =>
    signInWithPassword({ email: "missing@example.com", password }),
  );
  const wrong = await rejected(() =>
    signInWithPassword({ email: other, password: "wrong-password-1" }),
  );

  assert.equal(unknown.code, "INVALID_LOGIN");
  assert.equal(wrong.code, "INVALID_LOGIN");
  assert.equal(unknown.message, "Email or password is wrong. Try again.");
  assert.equal(wrong.message, unknown.message);
  assert.equal(readMemorySessionCookie(), undefined);

  const sessions = await query<{ count: string }>(
    `select count(*)::text as count
     from identity.sessions s
     join identity.accounts a on a.id = s.account_id
     where a.email = $1`,
    [other],
  );
  assert.equal(sessions[0].count, "0");
});

test("an unknown session cookie is unauthenticated", async () => {
  await writeSessionCookie("missing-session");
  await assert.rejects(
    () => requireUser(),
    (error: unknown) => {
      assert.equal(asIdentityError(error).code, "UNAUTHENTICATED");
      return true;
    },
  );
});

test("sign-out clears the session", async () => {
  await signUpWithPassword({ email: known, password });
  await signInWithPassword({ email: known, password });
  await signOut();

  assert.equal(readMemorySessionCookie(), undefined);
  const leftover = await query<{ id: string }>(
    `select s.id
     from identity.sessions s
     join identity.accounts a on a.id = s.account_id
     where a.email = $1`,
    [known],
  );
  assert.equal(leftover.length, 0);
  await assert.rejects(
    () => requireUser(),
    (error: unknown) => {
      assert.equal(asIdentityError(error).code, "UNAUTHENTICATED");
      return true;
    },
  );
});
