import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  beginSync,
  connectMailbox,
  startSync,
} from "../../../../lodge/store.ts";
import { requireUser } from "../../../../identity/session.ts";
import {
  MICROSOFT_INTENT_COOKIE,
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
  const connect = jar.get(MICROSOFT_INTENT_COOKIE)?.value === "connect";
  jar.delete(MICROSOFT_STATE_COOKIE);
  jar.delete(MICROSOFT_LINK_COOKIE);
  jar.delete(MICROSOFT_INTENT_COOKIE);

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
  let destination = "/applications";
  try {
    const profile = await exchangeAuthorizationCode({
      provider: "microsoft",
      code,
      redirectUri: microsoftCallbackUrl(origin),
      readMail: link,
    });
    if (connect) {
      const user = await requireUser();
      if (!profile.refreshToken) {
        destination = "/mailboxes?notice=unread";
      } else {
        const mailboxId = await connectMailbox({
          accountId: user.id,
          address: profile.email,
          provider: "outlook",
          refreshToken: profile.refreshToken,
        });
        const runId = await beginSync(mailboxId);
        if (runId) startSync(runId);
        destination = "/mailboxes";
      }
    } else {
      await signInWithProvider({
        provider: "microsoft",
        email: profile.email,
        linkAsMailbox: link,
        refreshToken: profile.refreshToken,
      });
    }
  } catch {
    redirect(
      connect ? "/mailboxes?notice=unread" : "/sign-in?microsoft=failed",
    );
  }
  redirect(destination);
}
