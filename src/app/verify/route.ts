import { IdentityError } from "../../identity/errors.ts";
import { confirmEmail } from "../../identity/verify-email.ts";

// shortcut: GET spends the link, so a mail scanner can consume it. Ask for a confirm step when a mail vendor is approved.

export async function GET(request: Request): Promise<Response> {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  try {
    await confirmEmail({ token });
  } catch (error) {
    if (error instanceof IdentityError) {
      return new Response(`${error.code}. ${error.message}`, {
        status: 400,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
    throw error;
  }
  return new Response("Email verified.", {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
