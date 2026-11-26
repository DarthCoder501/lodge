"use server";

import { redirect } from "next/navigation";
import { requireUser } from "../../identity/session.ts";
import { isStage } from "../../lodge/stages.ts";
import {
  confirmStage,
  disconnectMailbox,
  isAlertChoice,
  keepStage,
  listMailboxes,
  retrySync,
  saveAlertChoice,
  setPin,
} from "../../lodge/store.ts";

export async function disconnectMailboxAction(
  formData: FormData,
): Promise<void> {
  const user = await requireUser();
  const id = formData.get("id");
  if (typeof id !== "string" || !/^\d+$/.test(id)) redirect("/mailboxes");
  const gone = await disconnectMailbox(user.id, id);
  if (!gone) redirect("/mailboxes");
  const kept = (await listMailboxes(user.id))
    .map((mailbox) => mailbox.provider)
    .join(",");
  const params = new URLSearchParams({
    gone: gone === "Gmail" ? "gmail" : "outlook",
  });
  if (kept) params.set("kept", kept);
  redirect(`/mailboxes?${params.toString()}`);
}

export async function confirmStageAction(
  id: string,
  stage: string,
): Promise<void> {
  const user = await requireUser();
  if (!/^\d+$/.test(id) || !isStage(stage)) return;
  await confirmStage(user.id, id, stage);
}

export async function keepStageAction(id: string): Promise<void> {
  const user = await requireUser();
  if (!/^\d+$/.test(id)) return;
  await keepStage(user.id, id);
}

export async function setPinAction(id: string, pinned: boolean): Promise<void> {
  const user = await requireUser();
  if (!/^\d+$/.test(id)) return;
  await setPin(user.id, id, pinned);
}

export async function retrySyncAction(): Promise<void> {
  const user = await requireUser();
  await retrySync(user.id);
  redirect("/applications");
}

export async function saveAlertChoiceAction(choice: string): Promise<void> {
  const user = await requireUser();
  if (!isAlertChoice(choice)) return;
  await saveAlertChoice(user.id, choice);
}
