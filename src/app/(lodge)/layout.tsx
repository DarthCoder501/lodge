import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { IdentityError } from "../../identity/errors.ts";
import { requireUser } from "../../identity/session.ts";
import { Shell } from "../shell.tsx";

export default async function LodgeLayout({
  children,
}: {
  children: ReactNode;
}) {
  let email: string | undefined;
  try {
    email = (await requireUser()).email;
  } catch (error) {
    if (!(error instanceof IdentityError) || error.code !== "UNAUTHENTICATED")
      throw error;
  }
  if (!email) redirect("/sign-in");

  return <Shell email={email}>{children}</Shell>;
}
