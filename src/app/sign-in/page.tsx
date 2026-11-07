import { IdentityError } from "../../identity/errors.ts";
import { requireUser } from "../../identity/session.ts";
import { SignInScreen } from "./sign-in-screen.tsx";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function googleNotice(value: string | undefined): string | undefined {
  if (value === "unconfigured") return "Google sign-in is not configured.";
  if (value === "failed") return "Google sign-in did not finish. Try again.";
  return undefined;
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{
    google?: string | string[];
    out?: string | string[];
    return?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const notice = googleNotice(first(params.google));
  const signedOut = first(params.out) === "1";
  const returning = first(params.return) === "1";
  try {
    const user = await requireUser();
    return <SignInScreen email={user.email} />;
  } catch (error) {
    if (error instanceof IdentityError && error.code === "UNAUTHENTICATED") {
      return (
        <SignInScreen
          notice={notice}
          signedOut={signedOut}
          returning={returning}
        />
      );
    }
    throw error;
  }
}
