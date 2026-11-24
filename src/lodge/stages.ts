export const reviewStages = [
  { id: "applied", label: "Applied" },
  { id: "oa-not-done", label: "OA not done" },
  { id: "interview-not-done", label: "Interview not done" },
  { id: "in-progress", label: "In progress" },
  { id: "offer", label: "Offer" },
  { id: "rejected", label: "Rejected" },
] as const;

export type ApplicationStage = (typeof reviewStages)[number]["id"];

const positive = new Set<ApplicationStage>([
  "oa-not-done",
  "interview-not-done",
  "offer",
]);

export function isStage(value: string): value is ApplicationStage {
  return reviewStages.some((stage) => stage.id === value);
}

export function stageLabel(stage: ApplicationStage): string {
  return reviewStages.find((item) => item.id === stage)?.label ?? stage;
}

export function stageIndex(stage: ApplicationStage): number {
  const index = reviewStages.findIndex((item) => item.id === stage);
  return index < 0 ? 0 : index;
}

export function isPositiveStage(stage: ApplicationStage): boolean {
  return positive.has(stage);
}

export type MailProvider = "gmail" | "outlook";

export function isMailProvider(value: string): value is MailProvider {
  return value === "gmail" || value === "outlook";
}

export function providerLabel(provider: MailProvider): "Gmail" | "Outlook" {
  return provider === "gmail" ? "Gmail" : "Outlook";
}
