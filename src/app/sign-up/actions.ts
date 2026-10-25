"use server";

import { IdentityError } from "../../identity/errors.ts";
import { signUpWithPassword } from "../../identity/sign-up.ts";
import type { APIError } from "../../identity/types.ts";

export type SignUpFormState = {
  id?: string;
  email?: string;
  password?: string;
  createdEmail?: string;
  error?: APIError["error"];
};

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function signUp(
  _previous: SignUpFormState,
  formData: FormData,
): Promise<SignUpFormState> {
  const email = field(formData, "email");
  const password = field(formData, "password");
  try {
    const user = await signUpWithPassword({ email, password });
    return {
      id: crypto.randomUUID(),
      email: user.email,
      password: "",
      createdEmail: user.email,
    };
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
}
