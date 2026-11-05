import { IdentityError } from "./errors.ts";
import type { CurrentUser } from "./types.ts";

export function assertCanConnectMailbox(user: CurrentUser): void {
  if (!user.emailVerified) {
    throw new IdentityError(
      "EMAIL_UNVERIFIED",
      "Verify your email before connecting a mailbox",
    );
  }
}
