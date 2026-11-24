import { isPositiveStage, type ApplicationStage } from "./stages.ts";

export type MailMessage = {
  id: string;
  fromName: string;
  fromAddress: string;
  subject: string;
  snippet: string;
  url: string;
  at: Date;
};

export type ClassifiedMail = {
  company: string;
  role: string;
  dedupe: string;
  stage: ApplicationStage;
  event: string;
  needsReview: boolean;
  positive: boolean;
  cycle: string | null;
  roleSpecific: boolean;
};

const personalDomains = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "yahoo.com",
  "icloud.com",
]);

const mailboxLabels = new Set([
  "mail",
  "email",
  "emails",
  "jobs",
  "careers",
  "talent",
  "noreply",
  "no-reply",
  "notifications",
  "iam",
  "recruiting",
  "hire",
  "offers",
  "em",
  "scheduling",
  "alerts",
  "donotreply",
]);

const ignoredDomains = [
  "redditmail.com",
  "reddit.com",
  "leetcode.com",
  "hellointerview.com",
  "govdelivery.com",
  "hollisterco.com",
];

const atsHosts = new Set([
  "yello",
  "greenhouse",
  "lever",
  "myworkday",
  "icims",
  "smartrecruiters",
  "workday",
]);

const templates: {
  stage: ApplicationStage;
  event: string;
  test: (text: string) => boolean;
}[] = [
  {
    stage: "rejected",
    event: "Decision received",
    test: (text) =>
      /not moving forward|we regret|regret to inform|not selected|unsuccessful|will not be moving|decided not to proceed/i.test(
        text,
      ),
  },
  {
    stage: "offer",
    event: "Offer received",
    test: (text) =>
      /\bjob offer\b|\boffer letter\b|\bpleased to offer\b|\boffer (?:deadline|decision|extended)\b|\boffer awaiting\b|\boffer we extended\b/i.test(
        text,
      ) ||
      (/\byour offer\b|\boffer\b/i.test(text) &&
        /\b(role|position|intern|co-?op|start date|signature)\b/i.test(text)),
  },
  {
    stage: "in-progress",
    event: "Interview completed",
    test: (text) => /completed your interview|interview complete/i.test(text),
  },
  {
    stage: "oa-not-done",
    event: "Assessment received",
    test: (text) =>
      /online assessment|coding challenge|hackerrank|codility/i.test(text),
  },
  {
    stage: "interview-not-done",
    event: "Interview invitation",
    test: (text) =>
      /interview (?:invitation|confirmation|request|cancellation|availability)|behavioral interview|rsvp requested|invite you to (?:an )?interview|phone screen|schedule (?:an )?interview|set up a call|schedule a call/i.test(
        text,
      ),
  },
  {
    stage: "applied",
    event: "Application received",
    test: (text) =>
      /application (has been )?received|thank you for applying|we received your application|thanks for applying/i.test(
        text,
      ),
  },
];

function ignoredAddress(address: string): boolean {
  const domain = address.split("@")[1]?.toLowerCase() ?? "";
  return ignoredDomains.some(
    (item) => domain === item || domain.endsWith(`.${item}`),
  );
}

function orgLabel(domain: string): string {
  const labels = domain.toLowerCase().split(".").filter(Boolean);
  const host = labels.slice(0, -1);
  while (host.length > 1 && mailboxLabels.has(host[0] ?? "")) host.shift();
  return host[0] ?? "";
}

function companyName(fromAddress: string, text: string): string {
  const named = text.match(/^([A-Z][^:\n]{1,40}?)\s+Careers:/);
  if (named?.[1]) return named[1].trim();
  const domain = fromAddress.split("@")[1]?.toLowerCase() ?? "";
  const host = orgLabel(domain);
  if (!host || personalDomains.has(domain)) return "";
  if (atsHosts.has(host)) {
    const employer = text.match(
      /\binterest in ([A-Z][A-Za-z0-9&. ]{1,40}?)(?:!|\.|,|\n|$)/,
    );
    if (employer?.[1]) return employer[1].trim();
  }
  if (host.length <= 3) return host.toUpperCase();
  return host.slice(0, 1).toUpperCase() + host.slice(1);
}

function roleFrom(subject: string): { role: string; specific: boolean } {
  const cleaned = subject
    .replace(/^(?:(?:re|fw|fwd):\s*)+/i, "")
    .replace(/^\[external\]\s*/i, "")
    .trim();
  const seasonTitle = cleaned.match(
    /\b((?:Fall|Summer|Winter|Spring)\s+Intern[^,\n]{0,40}(?:,\s*[^,\n]{3,50})?)/,
  );
  if (seasonTitle?.[1] && seasonTitle[1].length < 80) {
    return { role: seasonTitle[1].trim(), specific: true };
  }
  const titled = cleaned.match(
    /\b(Intern(?:ship)?(?:\s+[A-Z][\w/+&-]*){1,5}|(?:[A-Z][\w/+&-]*\s+){1,5}(?:Intern(?:ship)?|Co-?op))\b/,
  );
  if (titled?.[1]) {
    const role = titled[1].replace(/\s+(?:offer|for|the)$/i, "").trim();
    if (role.length > 1 && role.length < 80) return { role, specific: true };
  }
  const patterns = [/for the (.+?) role/i, /for the (.+?) position/i];
  for (const pattern of patterns) {
    const value = cleaned.match(pattern)?.[1]?.trim();
    if (value && value.length > 0 && value.length < 80) {
      return { role: value, specific: true };
    }
  }
  return { role: "Internship", specific: false };
}

function seasonName(season: string, year: string): string {
  const full = year.length === 2 ? `20${year}` : year;
  const name = season.toLowerCase();
  if (name === "fall" || name === "autumn") return `Fall ${full}`;
  if (name === "summer") return `Summer ${full}`;
  return `Winter/Spring ${full}`;
}

export function cycleFrom(text: string): string | null {
  const named =
    text.match(/\b(fall|autumn|summer|winter|spring)['’]?\s*(20)?(\d{2})\b/i) ??
    text.match(/\b(20\d{2})\s+(fall|autumn|summer|winter|spring)\b/i);
  if (named?.[1] && named[3])
    return seasonName(named[1], `${named[2] ?? ""}${named[3]}`);
  if (
    named?.[1] &&
    named[2] &&
    /^(fall|autumn|summer|winter|spring)$/i.test(named[2])
  ) {
    return seasonName(named[2], named[1]);
  }
  const year =
    text.match(/\bintern(?:ship)?\b[^0-9]{0,40}(20\d{2})\b/i)?.[1] ??
    text.match(/\b(20\d{2})\b[^a-z]{0,24}intern/i)?.[1] ??
    text.match(/\bco-?op\b[^0-9]{0,24}(20\d{2})\b/i)?.[1] ??
    text.match(/\b(20\d{2})\b[^a-z]{0,24}co-?op/i)?.[1];
  if (year && /\b(may|june|july|august)\b/i.test(text)) return `Summer ${year}`;
  return null;
}

// shortcut: phrase templates still miss oddly worded mail. Widen them when a real process email is skipped.
export function classifyMail(
  message: MailMessage,
  mailboxAddress?: string,
): ClassifiedMail | null {
  if (
    mailboxAddress &&
    message.fromAddress.toLowerCase() === mailboxAddress.toLowerCase()
  ) {
    return null;
  }
  if (ignoredAddress(message.fromAddress)) return null;
  if (/^\s*automatic reply:/i.test(message.subject)) return null;
  const text = `${message.subject}\n${message.snippet}`;
  if (
    /\b(digest|newsletter|last chance|ads credit|black friday|tuition|student aid)\b/i.test(
      text,
    )
  ) {
    return null;
  }
  const template = templates.find((item) => item.test(text));
  const needsReview =
    !template && /\byour (?:application|candidacy)\b/i.test(message.subject);
  if (!template && !needsReview) return null;
  const company = companyName(message.fromAddress, text);
  if (!company) return null;
  const { role, specific } = roleFrom(message.subject);
  const stage = template?.stage ?? "applied";
  return {
    company,
    role,
    dedupe: `${company.toLowerCase()}|${role.toLowerCase()}`,
    stage,
    event: template?.event ?? "Needs a look",
    needsReview,
    positive: template ? isPositiveStage(template.stage) : false,
    cycle: cycleFrom(text),
    roleSpecific: specific,
  };
}
