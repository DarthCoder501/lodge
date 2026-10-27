"use server";

import { redirect } from "next/navigation";
import { IdentityError } from "../../identity/errors.ts";
import { signInWithPassword } from "../../identity/sign-in.ts";
import { signOut } from "../../identity/session.ts";
import type { APIError } from "../../identity/types.ts";

export type SignInFormState = {
  id?: string;
  email?: string;
  password?: string;
  error?: APIError["error"];
};

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function signIn(
  _previous: SignInFormState,
  formData: FormData,
): Promise<SignInFormState> {
  const email = field(formData, "email");
  const password = field(formData, "password");
  try {
    await signInWithPassword({ email, password });
  } catch (error) {
    if (error instanceof IdentityError) {
      return {
        id: crypto.randomUUID(),
        email,
        password,
        error: { code: error.code, message: error.message },
      };
    }
    throw error;
  }
  redirect("/sign-in");
}

export async function signOutAction(
  _previous: void | undefined,
  _formData: FormData,
): Promise<void> {
  await signOut();
  redirect("/sign-in");
}
