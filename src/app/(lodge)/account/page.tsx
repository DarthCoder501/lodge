import { requireUser } from "../../../identity/session.ts";

export default async function AccountPage() {
  const email = (await requireUser()).email;

  return (
    <>
      <h1>Account</h1>
      <p role="status">Signed in as {email}.</p>
    </>
  );
}
