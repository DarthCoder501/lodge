import { randomBytes, scrypt } from "node:crypto";
import { query } from "./db.ts";
import { IdentityError } from "./errors.ts";
import type { CurrentUser, LoginProvider } from "./types.ts";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function assertPassword(password: string): void {
  if (password.length < 10) {
    throw new IdentityError(
      "VALIDATION_ERROR",
      "Password must be at least 10 characters",
    );
  }
}

function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 32, (error, key) => {
      if (error) reject(error);
      else resolve(`scrypt$${salt}$${key.toString("hex")}`);
    });
  });
}

type AccountRow = {
  id: string;
  email: string;
  email_verified: boolean;
  login_provider: string;
};

function loginProvider(value: string): LoginProvider {
  if (value === "google" || value === "microsoft" || value === "password") return value;
  throw new Error(`Unexpected login provider: ${value}`);
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

export async function signUpWithPassword(input: {
  email: string;
  password: string;
}): Promise<CurrentUser> {
  const email = normalizeEmail(input.email);
  if (email.length === 0) {
    throw new IdentityError("VALIDATION_ERROR", "Enter an email");
  }
  assertPassword(input.password);

  const passwordHash = await hashPassword(input.password);
  try {
    const rows = await query<AccountRow>(
      `insert into identity.accounts (email, password_hash)
       values ($1, $2)
       returning id::text as id, email, email_verified, login_provider`,
      [email, passwordHash],
    );
    const row = rows[0];
    return {
      id: row.id,
      email: row.email,
      emailVerified: row.email_verified,
      loginProvider: loginProvider(row.login_provider),
    };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new IdentityError("EMAIL_TAKEN", "An account with that email already exists");
    }
    throw error;
  }
}
