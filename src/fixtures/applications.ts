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
export const recognizedNotice = "Fable moved to Offer from a recognized email.";

export const reviewStages: { id: ApplicationStage; label: string }[] = [
  { id: "applied", label: "Applied" },
  { id: "oa-not-done", label: "OA not done" },
  { id: "interview-not-done", label: "Interview not done" },
  { id: "in-progress", label: "In progress" },
  { id: "offer", label: "Offer" },
  { id: "rejected", label: "Rejected" },
];

export const reviewPrompt = {
  id: "browser-company",
  suggested: "interview-not-done" as const,
  excerpt: "We’d love a little time to hear about your process.",
};

export type ReviewSave =
  | { kind: "confirm"; stage: ApplicationStage }
  | { kind: "stay" };

export function stageIndex(stage: ApplicationStage) {
  const index = reviewStages.findIndex((item) => item.id === stage);
  return index < 0 ? 0 : index;
}

export function parseReviews(value: unknown): Record<string, ReviewSave> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const saves: Record<string, ReviewSave> = {};
  for (const [id, save] of Object.entries(value)) {
    if (!save || typeof save !== "object") continue;
    const kind = (save as { kind?: unknown }).kind;
    if (kind === "stay") {
      saves[id] = { kind: "stay" };
      continue;
    }
    const stage = (save as { stage?: unknown }).stage;
    const match = reviewStages.find((item) => item.id === stage);
    if (kind === "confirm" && match) {
      saves[id] = { kind: "confirm", stage: match.id };
    }
  }
  return saves;
}

export function withReviews(
  items: ApplicationFixture[],
  saves: Record<string, ReviewSave>,
): ApplicationFixture[] {
  const next = items.map((item) => {
    const save = saves[item.id];
    if (!save) return item;
    if (save.kind === "stay") return { ...item, stageUnchanged: false };
    const stage = reviewStages.find((entry) => entry.id === save.stage);
    if (!stage) return item;
    return {
      ...item,
      stage: stage.id,
      stageLabel: stage.label,
      event: "Stage confirmed by you",
      time: "Just now",
      stageUnchanged: false,
    };
  });
  const confirmed = new Set(
    Object.entries(saves)
      .filter(([, save]) => save.kind === "confirm")
      .map(([id]) => id),
  );
  return [
    ...next.filter((item) => confirmed.has(item.id)),
    ...next.filter((item) => !confirmed.has(item.id)),
  ];
}

export const deskStatuses = [
  "empty",
  "recognized",
  "loading",
  "running",
  "finished",
  "return",
  "failed",
] as const;

export const reviewFrames = [
  "recognized",
  "saving-confirm",
  "saving-not-a-move",
] as const;

export type ReviewFrame = (typeof reviewFrames)[number];

export type DeskStatus = (typeof deskStatuses)[number] | "ready";

export function reviewFrame(value: string | undefined): ReviewFrame | null {
  if (value && (reviewFrames as readonly string[]).includes(value)) {
    return value as ReviewFrame;
  }
  return null;
}

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
