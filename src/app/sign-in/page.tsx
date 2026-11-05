import { IdentityError } from "../../identity/errors.ts";
import { requireUser } from "../../identity/session.ts";
import { SignInScreen } from "./sign-in-screen.tsx";

function googleNotice(
  value: string | string[] | undefined,
): string | undefined {
  const code = Array.isArray(value) ? value[0] : value;
  if (code === "unconfigured") return "Google sign-in is not configured.";
  if (code === "failed") return "Google sign-in did not finish. Try again.";
  return undefined;
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string | string[] }>;
}) {
  const notice = googleNotice((await searchParams).google);
  try {
    const user = await requireUser();
    return <SignInScreen email={user.email} />;
  } catch (error) {
    if (error instanceof IdentityError && error.code === "UNAUTHENTICATED") {
      return <SignInScreen notice={notice} />;
    }
    throw error;
  }
}
