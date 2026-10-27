import { redirect } from "next/navigation";
import { IdentityError } from "../../identity/errors.ts";
import { requireUser } from "../../identity/session.ts";

export default async function AccountPage() {
  let email: string | undefined;
  try {
    email = (await requireUser()).email;
  } catch (error) {
    if (!(error instanceof IdentityError) || error.code !== "UNAUTHENTICATED") throw error;
  }
  if (!email) redirect("/sign-in");

  return (
    <main className="account">
      <h1>Account</h1>
      <p role="status">Signed in as {email}.</p>
      <style>{`
        .account {
          box-sizing: border-box;
          max-width: 24rem;
          margin: 0 auto;
          padding: 1rem;
          min-height: 100vh;
        }
        h1 {
          font-family: var(--font-display), serif;
          font-size: 1.75rem;
          font-weight: 500;
          margin: 0 0 1rem;
        }
        [role="status"] { margin: 0; }
      `}</style>
    </main>
  );
}
