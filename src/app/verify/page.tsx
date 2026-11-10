import { Suspense } from "react";
import { openVerification } from "../../identity/verify-email.ts";
import { Desk, Invalid, Opening, Used, Verified } from "./desk.tsx";
import { ResendNotice } from "./resend.tsx";

// shortcut: rendering this page spends a valid link, so a mail scanner can consume it. Ask for a confirm step when a mail vendor is approved.

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const token = first((await searchParams).token);
  return (
    <Desk>
      {token.trim() ? (
        <Suspense fallback={<Opening />}>
          <Resolved token={token} />
        </Suspense>
      ) : (
        <Invalid />
      )}
    </Desk>
  );
}

async function Resolved({ token }: { token: string }) {
  const opened = await openVerification(token);
  if (opened.kind === "verified") return <Verified email={opened.email} />;
  if (opened.kind === "expired")
    return <ResendNotice email={opened.email} mode="expired" />;
  if (opened.kind === "used") return <Used />;
  return <Invalid />;
}
