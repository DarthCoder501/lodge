// shortcut: fixture until the module spec exists

export type ApplicationStage =
  | "offer"
  | "interview-not-done"
  | "oa-not-done"
  | "in-progress"
  | "applied"
  | "rejected";

export type ApplicationFixture = {
  id: string;
  stage: ApplicationStage;
  stageLabel: string;
  role: string;
  company: string;
  event: string;
  mailbox: string;
  time: string;
  sourceUrl: string;
  fresh: boolean;
  stageUnchanged?: boolean;
};

export const applicationsSyncedAt = "Synced today, 9:45 AM";
export const changesSince = "Since yesterday, 5:00 PM";

export const deskStatuses = [
  "empty",
  "recognized",
  "loading",
  "running",
  "finished",
  "return",
  "failed",
] as const;

export type DeskStatus = (typeof deskStatuses)[number] | "ready";

export function deskStatus(value: string | undefined): DeskStatus {
  if (value && (deskStatuses as readonly string[]).includes(value)) {
    return value as DeskStatus;
  }
  return "ready";
}

export function showsApplications(status: DeskStatus) {
  return (
    status === "ready" ||
    status === "running" ||
    status === "finished" ||
    status === "return" ||
    status === "failed"
  );
}

export function syncLine(status: DeskStatus) {
  if (status === "running") return "Syncing";
  if (status === "finished") return "Synced just now";
  return applicationsSyncedAt;
}

function mail(id: string) {
  return `https://example.com/mail/${id}`;
}

export const applications: ApplicationFixture[] = [
  {
    id: "fable",
    stage: "offer",
    stageLabel: "Offer",
    role: "Product Designer",
    company: "Fable",
    event: "Offer received",
    mailbox: "Gmail personal",
    time: "Today, 9:42 AM",
    sourceUrl: mail("fable"),
    fresh: true,
  },
  {
    id: "linear",
    stage: "interview-not-done",
    stageLabel: "Interview not done",
    role: "Product Design Intern",
    company: "Linear",
    event: "Interview invitation",
    mailbox: "Outlook school",
    time: "Today, 8:15 AM",
    sourceUrl: mail("linear"),
    fresh: true,
  },
  {
    id: "notion",
    stage: "oa-not-done",
    stageLabel: "OA not done",
    role: "Design Engineer",
    company: "Notion",
    event: "Assessment received",
    mailbox: "Gmail personal",
    time: "Yesterday, 6:30 PM",
    sourceUrl: mail("notion"),
    fresh: true,
  },
  {
    id: "arena",
    stage: "in-progress",
    stageLabel: "In progress",
    role: "Product Designer",
    company: "Are.na",
    event: "Interview completed",
    mailbox: "Gmail personal",
    time: "Nov 3, 11:10 AM",
    sourceUrl: mail("arena"),
    fresh: false,
  },
  {
    id: "browser-company",
    stage: "applied",
    stageLabel: "Applied",
    role: "Product Design Intern",
    company: "The Browser Company",
    event: "Application received",
    mailbox: "Outlook school",
    time: "Nov 2, 2:05 PM",
    sourceUrl: mail("browser-company"),
    fresh: false,
    stageUnchanged: true,
  },
  {
    id: "dropbox",
    stage: "rejected",
    stageLabel: "Rejected",
    role: "Product Designer",
    company: "Dropbox",
    event: "Decision received",
    mailbox: "Gmail personal",
    time: "Nov 1, 10:20 AM",
    sourceUrl: mail("dropbox"),
    fresh: false,
  },
];
