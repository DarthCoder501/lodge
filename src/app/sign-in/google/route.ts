import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  GOOGLE_LINK_COOKIE,
  GOOGLE_STATE_COOKIE,
  googleCallbackUrl,
  publicOrigin,
} from "../../../identity/provider-sign-in.ts";

// shortcut: set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on the server. Google must allow this origin's /sign-in/google/callback.

export async function GET(request: Request): Promise<void> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) redirect("/sign-in?google=unconfigured");

  const origin = publicOrigin({
    url: request.url,
    forwardedHost: request.headers.get("x-forwarded-host"),
    forwardedProto: request.headers.get("x-forwarded-proto"),
  });
  const linkAsMailbox =
    new URL(request.url).searchParams.get("linkAsMailbox") === "true";
  const state = randomBytes(32).toString("base64url");
  const jar = await cookies();
  const options = {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: origin.startsWith("https:"),
    maxAge: 600,
  };
  jar.set(GOOGLE_STATE_COOKIE, state, options);
  jar.set(GOOGLE_LINK_COOKIE, linkAsMailbox ? "1" : "0", options);

  const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  auth.searchParams.set("client_id", clientId);
  auth.searchParams.set("redirect_uri", googleCallbackUrl(origin));
  auth.searchParams.set("response_type", "code");
  auth.searchParams.set("scope", "openid email");
  auth.searchParams.set("state", state);
  auth.searchParams.set("prompt", "select_account");
  redirect(auth.toString());
}
