import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { exec, query } from "../../src/identity/db";
import { IdentityError } from "../../src/identity/errors";
import { signUpWithPassword } from "../../src/identity/sign-up";

type AccountRow = {
  id: string;
  email: string;
  email_verified: boolean;
  login_provider: string;
  password_hash: string;
};

const fixtureEmails = ["new.person@example.com", "a@example.com", "short@example.com"];

async function removeFixtures(): Promise<void> {
  await query("delete from identity.accounts where email = any($1::text[])", [fixtureEmails]);
}

before(async () => {
  const dir = join("supabase", "migrations");
  const name = readdirSync(dir).find((file) => file.endsWith("_accounts.sql"));
  assert.ok(name, "accounts migration");
  await exec(readFileSync(join(dir, name), "utf8"));
  await removeFixtures();
});

after(removeFixtures);

function asIdentityError(error: unknown): IdentityError {
  if (error instanceof IdentityError) return error;
  throw error;
}

function accounts(email: string) {
  return query<AccountRow>(
    `select id::text, email, email_verified, login_provider, password_hash
     from identity.accounts
     where email = $1`,
    [email],
  );
}

test("creates one unverified password account and no mailbox", async () => {
  const user = await signUpWithPassword({
    email: "  New.Person@Example.com ",
    password: "0123456789",
  });

  assert.equal(user.email, "new.person@example.com");
  assert.equal(user.emailVerified, false);
  assert.equal(user.loginProvider, "password");
  assert.equal("password" in user, false);
  assert.equal("passwordHash" in user, false);
  assert.equal("password_hash" in user, false);

  const rows = await accounts("new.person@example.com");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, user.id);
  assert.equal(rows[0].email_verified, false);
  assert.equal(rows[0].login_provider, "password");
  assert.notEqual(rows[0].password_hash, "0123456789");
  assert.equal(rows[0].password_hash.includes("0123456789"), false);

  const mailboxes = await query<{ name: string | null }>(
    "select to_regclass('identity.mailboxes')::text as name",
  );
  assert.equal(mailboxes[0].name, null);
});

test("treats mixed-case email as one account", async () => {
  await signUpWithPassword({ email: "A@Example.com", password: "0123456789" });
  await assert.rejects(
    () => signUpWithPassword({ email: "a@example.com", password: "9876543210" }),
    (error: unknown) => {
      assert.equal(asIdentityError(error).code, "EMAIL_TAKEN");
      return true;
    },
  );
  const rows = await accounts("a@example.com");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].email, "a@example.com");
});

test("rejects a password shorter than 10 characters", async () => {
  await assert.rejects(
    () => signUpWithPassword({ email: "short@example.com", password: "012345678" }),
    (error: unknown) => {
      const identityError = asIdentityError(error);
      assert.equal(identityError.code, "VALIDATION_ERROR");
      assert.equal(identityError.message, "Password must be at least 10 characters");
      return true;
    },
  );
  assert.equal((await accounts("short@example.com")).length, 0);
});

test("rejects a blank email", async () => {
  await assert.rejects(
    () => signUpWithPassword({ email: "   ", password: "0123456789" }),
    (error: unknown) => {
      assert.equal(asIdentityError(error).code, "VALIDATION_ERROR");
      return true;
    },
  );
});
