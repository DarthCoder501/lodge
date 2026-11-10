"use server";

import { resendVerificationLink } from "../../identity/verify-email.ts";

export type ResendState = { sent: boolean };

export async function resendVerification(
  _previous: ResendState,
  formData: FormData,
): Promise<ResendState> {
  const value = formData.get("email");
  const email = typeof value === "string" ? value : "";
  return { sent: await resendVerificationLink(email) };
}
