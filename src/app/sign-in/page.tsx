import { IdentityError } from "../../identity/errors.ts";
import { requireUser } from "../../identity/session.ts";
import { SignInScreen } from "./sign-in-screen.tsx";

export default async function SignInPage() {
  try {
    const user = await requireUser();
    return <SignInScreen email={user.email} />;
  } catch (error) {
    if (error instanceof IdentityError && error.code === "UNAUTHENTICATED") {
      return <SignInScreen />;
    }
    throw error;
  }
}
