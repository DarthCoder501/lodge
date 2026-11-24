import { providerLabel, type MailProvider } from "./stages.ts";

export function mailboxNotice(
  gone: string | undefined,
  kept: string | undefined,
): string {
  if (gone !== "gmail" && gone !== "outlook") return "";
  const labels = (kept ?? "")
    .split(",")
    .flatMap((item) =>
      item === "gmail" || item === "outlook"
        ? [providerLabel(item as MailProvider)]
        : [],
    );
  return disconnectLines(providerLabel(gone), labels).done;
}

export function disconnectLines(
  gone: "Gmail" | "Outlook",
  kept: ("Gmail" | "Outlook")[],
) {
  const list = kept.join(" and ");
  const still =
    kept.length === 0
      ? ""
      : ` ${list} ${kept.length === 1 ? "stays" : "stay"} connected.`;
  const left =
    kept.length === 0
      ? ""
      : ` ${list} ${kept.length === 1 ? "is" : "are"} still connected.`;
  return {
    sheet: `Sync stops. Applications stay.${still}`,
    done: `${gone} stopped syncing. Applications stay.${left}`,
  };
}
