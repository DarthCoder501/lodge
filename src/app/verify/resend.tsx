"use client";

import { useActionState } from "react";
import { resendVerification, type ResendState } from "./actions.ts";
import { CheckEmail, Expired, Resent, Sending } from "./desk.tsx";

const initialState: ResendState = { sent: false };

export function ResendNotice({
  email,
  mode,
}: {
  email: string;
  mode: "check" | "expired";
}) {
  const [state, action, pending] = useActionState(
    resendVerification,
    initialState,
  );
  if (pending) return <Sending email={email} />;
  if (state.sent) return <Resent email={email} action={action} />;
  if (mode === "expired") return <Expired email={email} action={action} />;
  return <CheckEmail email={email} action={action} />;
}
