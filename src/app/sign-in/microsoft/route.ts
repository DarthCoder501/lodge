import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  MICROSOFT_LINK_COOKIE,
  MICROSOFT_STATE_COOKIE,
  microsoftCallbackUrl,
  publicOrigin,
} from "../../../identity/provider-sign-in.ts";

// shortcut: set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET on the server. The app registration must allow this origin's /sign-in/microsoft/callback. No PKCE; add a code_verifier cookie if Microsoft requires it for this web client.

export async function GET(request: Request): Promise<void> {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!clientId || !clientSecret) redirect("/sign-in?microsoft=unconfigured");

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
  jar.set(MICROSOFT_STATE_COOKIE, state, options);
  jar.set(MICROSOFT_LINK_COOKIE, linkAsMailbox ? "1" : "0", options);

  const auth = new URL(
    "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
  );
  auth.searchParams.set("client_id", clientId);
  auth.searchParams.set("redirect_uri", microsoftCallbackUrl(origin));
  auth.searchParams.set("response_type", "code");
  auth.searchParams.set("response_mode", "query");
  auth.searchParams.set("scope", "openid email");
  auth.searchParams.set("state", state);
  auth.searchParams.set("prompt", "select_account");
  redirect(auth.toString());
}
