import type { MailMessage } from "./classify.ts";
import type { MailProvider } from "./stages.ts";

const gmailList = "https://gmail.googleapis.com/gmail/v1/users/me/messages";
const gmailEnable =
  /https:\/\/console\.developers\.google\.com\/apis\/api\/gmail\.googleapis\.com\/overview\?project=\d{1,20}(?!\d)/;

export class GmailApiDisabled extends Error {
  readonly enableUrl: string;

  constructor(enableUrl: string) {
    super("Gmail API is disabled");
    this.enableUrl = enableUrl;
  }
}

export function gmailApiEnableUrl(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const found = value.match(gmailEnable)?.[0];
  return found === value ? found : null;
}

export function failureFromGmail(status: number, body: unknown): Error {
  const message =
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof body.error === "object" &&
    body.error !== null &&
    "message" in body.error &&
    typeof body.error.message === "string"
      ? body.error.message
      : "";
  const enableUrl = message.match(gmailEnable)?.[0];
  if (
    status === 403 &&
    enableUrl &&
    /has not been used|is disabled/i.test(message)
  ) {
    return new GmailApiDisabled(enableUrl);
  }
  return new Error("Gmail list failed");
}
const googleToken = "https://oauth2.googleapis.com/token";
const graphMessages = "https://graph.microsoft.com/v1.0/me/messages";
const microsoftToken =
  "https://login.microsoftonline.com/common/oauth2/v2.0/token";

async function postForm(url: string, body: URLSearchParams): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) throw new Error("Mail token refresh failed");
  return response.json();
}

async function googleAccessToken(refreshToken: string): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret)
    throw new Error("Google mail is not configured");
  const token = (await postForm(
    googleToken,
    new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  )) as { access_token?: unknown };
  if (typeof token.access_token !== "string" || token.access_token === "") {
    throw new Error("Mail token refresh failed");
  }
  return token.access_token;
}

function header(
  headers: { name?: string; value?: string }[] | undefined,
  name: string,
): string {
  return (
    headers?.find((item) => item.name?.toLowerCase() === name)?.value ?? ""
  );
}

function fromHeader(value: string): { name: string; address: string } {
  const match = value.match(/^(.*)<([^>]+)>\s*$/);
  if (!match) return { name: "", address: value.trim() };
  return {
    name: match[1].replaceAll('"', "").trim(),
    address: match[2].trim(),
  };
}

const processQuery = [
  "newer_than:400d",
  '("thank you for applying" OR "thanks for applying" OR "application received" OR "your application" OR "interview invitation" OR "interview confirmation" OR "interview request" OR "behavioral interview" OR "coding challenge" OR "online assessment" OR hackerrank OR "job offer" OR "your offer" OR "offer letter" OR (offer (intern OR internship OR "co-op")))',
  "-from:lensa.com -from:ripplematch.com -from:jobalerts-noreply@linkedin.com -from:jobs-noreply@linkedin.com",
].join(" ");

async function gmailMessage(
  access: string,
  id: string,
): Promise<MailMessage | null> {
  const detailUrl = new URL(`${gmailList}/${encodeURIComponent(id)}`);
  detailUrl.searchParams.set("format", "metadata");
  detailUrl.searchParams.append("metadataHeaders", "From");
  detailUrl.searchParams.append("metadataHeaders", "Subject");
  const detailResponse = await fetch(detailUrl, {
    headers: { authorization: `Bearer ${access}` },
  });
  if (!detailResponse.ok) return null;
  const detail = (await detailResponse.json()) as {
    id?: string;
    snippet?: string;
    internalDate?: string;
    payload?: { headers?: { name?: string; value?: string }[] };
  };
  if (!detail.id) return null;
  const from = fromHeader(header(detail.payload?.headers, "from"));
  const at = Number(detail.internalDate);
  return {
    id: detail.id,
    fromName: from.name,
    fromAddress: from.address,
    subject: header(detail.payload?.headers, "subject"),
    snippet: detail.snippet ?? "",
    url: `https://mail.google.com/mail/u/0/#all/${encodeURIComponent(detail.id)}`,
    at: Number.isFinite(at) ? new Date(at) : new Date(),
  };
}

async function readGmail(
  refreshToken: string,
  onlyIds?: string[],
): Promise<MailMessage[]> {
  const access = await googleAccessToken(refreshToken);
  const ids: string[] = [];
  if (onlyIds) {
    ids.push(...onlyIds);
  } else {
    let page: string | undefined;
    for (let attempt = 0; attempt < 4 && ids.length < 200; attempt += 1) {
      const listUrl = new URL(gmailList);
      listUrl.searchParams.set("maxResults", "50");
      listUrl.searchParams.set("q", processQuery);
      if (page) listUrl.searchParams.set("pageToken", page);
      const listResponse = await fetch(listUrl, {
        headers: { authorization: `Bearer ${access}` },
      });
      if (!listResponse.ok) {
        let body: unknown = null;
        try {
          body = await listResponse.json();
        } catch {
          body = null;
        }
        throw failureFromGmail(listResponse.status, body);
      }
      const list = (await listResponse.json()) as {
        messages?: { id?: string }[];
        nextPageToken?: string;
      };
      for (const item of list.messages ?? []) {
        if (item.id) ids.push(item.id);
      }
      page = list.nextPageToken;
      if (!page) break;
    }
  }
  const messages: MailMessage[] = [];
  for (const id of ids) {
    const message = await gmailMessage(access, id);
    if (message) messages.push(message);
  }
  return messages;
}

async function microsoftAccessToken(refreshToken: string): Promise<string> {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Microsoft mail is not configured");
  }
  const token = (await postForm(
    microsoftToken,
    new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
      scope:
        "openid email offline_access https://graph.microsoft.com/Mail.Read",
    }),
  )) as { access_token?: unknown };
  if (typeof token.access_token !== "string" || token.access_token === "") {
    throw new Error("Mail token refresh failed");
  }
  return token.access_token;
}

type OutlookItem = {
  id?: string;
  subject?: string;
  bodyPreview?: string;
  webLink?: string;
  receivedDateTime?: string;
  from?: { emailAddress?: { name?: string; address?: string } };
};

function outlookMessage(item: OutlookItem): MailMessage | null {
  if (!item.id) return null;
  const at = item.receivedDateTime
    ? new Date(item.receivedDateTime)
    : new Date();
  return {
    id: item.id,
    fromName: item.from?.emailAddress?.name ?? "",
    fromAddress: item.from?.emailAddress?.address ?? "",
    subject: item.subject ?? "",
    snippet: item.bodyPreview ?? "",
    url: item.webLink ?? "https://outlook.office.com/mail/",
    at: Number.isNaN(at.getTime()) ? new Date() : at,
  };
}

async function readOutlook(refreshToken: string): Promise<MailMessage[]> {
  const access = await microsoftAccessToken(refreshToken);
  const url = new URL(graphMessages);
  // shortcut: newest 50. Use a process search, as Gmail does, when retail mail crowds this page.
  url.searchParams.set("$top", "50");
  url.searchParams.set(
    "$select",
    "id,subject,from,receivedDateTime,webLink,bodyPreview",
  );
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${access}` },
  });
  if (!response.ok) throw new Error("Outlook list failed");
  const body = (await response.json()) as { value?: OutlookItem[] };
  return (body.value ?? []).flatMap((item) => {
    const message = outlookMessage(item);
    return message ? [message] : [];
  });
}

async function readOutlookMessages(
  refreshToken: string,
  ids: string[],
): Promise<MailMessage[]> {
  const access = await microsoftAccessToken(refreshToken);
  const messages: MailMessage[] = [];
  for (const id of ids) {
    const response = await fetch(
      `${graphMessages}/${encodeURIComponent(id)}?$select=id,subject,from,receivedDateTime,webLink,bodyPreview`,
      { headers: { authorization: `Bearer ${access}` } },
    );
    if (!response.ok) continue;
    const message = outlookMessage((await response.json()) as OutlookItem);
    if (message) messages.push(message);
  }
  return messages;
}

export function readInbox(
  provider: MailProvider,
  refreshToken: string,
  onlyIds?: string[],
): Promise<MailMessage[]> {
  if (provider === "gmail") return readGmail(refreshToken, onlyIds);
  if (onlyIds) return readOutlookMessages(refreshToken, onlyIds);
  return readOutlook(refreshToken);
}
