import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  MICROSOFT_LINK_COOKIE,
  MICROSOFT_STATE_COOKIE,
  exchangeAuthorizationCode,
  microsoftCallbackUrl,
  publicOrigin,
  signInWithProvider,
} from "../../../../identity/provider-sign-in.ts";

function matchesState(stored: string, received: string): boolean {
  const left = Buffer.from(stored);
  const right = Buffer.from(received);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function GET(request: Request): Promise<void> {
  const url = new URL(request.url);
  const jar = await cookies();
  const stored = jar.get(MICROSOFT_STATE_COOKIE)?.value;
  const link = jar.get(MICROSOFT_LINK_COOKIE)?.value === "1";
  jar.delete(MICROSOFT_STATE_COOKIE);
  jar.delete(MICROSOFT_LINK_COOKIE);

  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  if (
    url.searchParams.get("error") ||
    !stored ||
    !state ||
    !code ||
    !matchesState(stored, state)
  ) {
    redirect("/sign-in?microsoft=failed");
  }

  const origin = publicOrigin({
    url: request.url,
    forwardedHost: request.headers.get("x-forwarded-host"),
    forwardedProto: request.headers.get("x-forwarded-proto"),
  });
  try {
    const profile = await exchangeAuthorizationCode({
      provider: "microsoft",
      code,
      redirectUri: microsoftCallbackUrl(origin),
    });
    await signInWithProvider({
      provider: "microsoft",
      email: profile.email,
      linkAsMailbox: link,
    });
  } catch {
    redirect("/sign-in?microsoft=failed");
  }
  redirect("/sign-in");
}
