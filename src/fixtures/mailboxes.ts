// shortcut: fixture until the module spec exists

export type MailboxFixture = {
  id: string;
  address: string;
  provider: "Gmail" | "Outlook";
};

export const mailboxes: MailboxFixture[] = [
  {
    id: "gmail",
    address: "maya.chen@gmail.com",
    provider: "Gmail",
  },
  {
    id: "outlook",
    address: "mchen@northwestern.edu",
    provider: "Outlook",
  },
];

const mailboxStatuses = ["one", "none", "loading"] as const;

export type MailboxStatus = (typeof mailboxStatuses)[number] | "two";

export function mailboxStatus(value: string | undefined): MailboxStatus {
  if (value && (mailboxStatuses as readonly string[]).includes(value)) {
    return value as MailboxStatus;
  }
  return "two";
}

export function listedMailboxes(status: MailboxStatus): MailboxFixture[] {
  if (status === "one") return mailboxes.slice(0, 1);
  if (status === "two") return mailboxes;
  return [];
}

export function disconnectLines(gone: MailboxFixture, kept: MailboxFixture[]) {
  const names = kept.map((mailbox) => mailbox.provider);
  const list = names.join(" and ");
  const still =
    names.length === 0
      ? ""
      : ` ${list} ${names.length === 1 ? "stays" : "stay"} connected.`;
  const left =
    names.length === 0
      ? ""
      : ` ${list} ${names.length === 1 ? "is" : "are"} still connected.`;
  return {
    sheet: `Sync stops. Applications stay.${still}`,
    done: `${gone.provider} stopped syncing. Applications stay.${left}`,
  };
}
