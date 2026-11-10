import { query } from "../../../identity/db.ts";
import { readDevVerificationLink } from "../../../identity/verify-email.ts";

// shortcut: dev-only peek at the latest link and verification flag. Remove when a mail vendor sends the link.

export async function GET(request: Request): Promise<Response> {
  if (process.env.NODE_ENV === "production") {
    return new Response(null, { status: 404 });
  }
  const email = new URL(request.url).searchParams.get("email") ?? "";
  const rows = await query<{ email_verified: boolean }>(
    "select email_verified from identity.accounts where email = $1",
    [email],
  );
  return Response.json({
    link: readDevVerificationLink(email),
    verified: rows[0]?.email_verified ?? null,
  });
}

export async function POST(request: Request): Promise<Response> {
  if (process.env.NODE_ENV === "production") {
    return new Response(null, { status: 404 });
  }
  const email = new URL(request.url).searchParams.get("email") ?? "";
  await query(
    `update identity.email_verifications v
     set sent_at = now() - interval '24 hours 1 second'
     from identity.accounts a
     where a.id = v.account_id and a.email = $1`,
    [email],
  );
  return new Response(null, { status: 204 });
}
