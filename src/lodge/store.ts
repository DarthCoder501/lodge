import { query } from "../identity/db.ts";
import { classifyMail, type MailMessage } from "./classify.ts";
import { gmailApiEnableUrl, GmailApiDisabled, readInbox } from "./mail.ts";
import {
  isMailProvider,
  isPositiveStage,
  isStage,
  providerLabel,
  stageLabel,
  type ApplicationStage,
  type MailProvider,
} from "./stages.ts";

export type ListedMailbox = {
  id: string;
  address: string;
  provider: MailProvider;
  label: "Gmail" | "Outlook";
  syncing: boolean;
};

export type DeskApplication = {
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
  pinned: boolean;
  needsReview: boolean;
  excerpt: string;
  cycle: string | null;
};

export type DeskStatus =
  | "empty"
  | "recognized"
  | "running"
  | "finished"
  | "failed"
  | "ready";

export type Desk = {
  status: DeskStatus;
  synced: string;
  since: string;
  items: DeskApplication[];
  notice: string | null;
  pings: { id: string; title: string }[];
  gmailApiUrl: string | null;
};

function uniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

export async function connectMailbox(input: {
  accountId: string;
  address: string;
  provider: MailProvider;
  refreshToken: string;
}): Promise<string> {
  const address = input.address.trim().toLowerCase();
  if (!address || !input.refreshToken) {
    throw new Error("Mailbox is missing an address or token");
  }
  const rows = await query<{ id: string }>(
    `insert into lodge.mailboxes (account_id, address, provider, refresh_token, disconnected_at)
     values ($1::bigint, $2, $3, $4, null)
     on conflict (account_id, address) do update
       set provider = excluded.provider,
           refresh_token = excluded.refresh_token,
           disconnected_at = null
     returning id::text as id`,
    [input.accountId, address, input.provider, input.refreshToken],
  );
  const id = rows[0]?.id;
  if (!id) throw new Error("Mailbox was not stored");
  return id;
}

export async function listMailboxes(
  accountId: string,
): Promise<ListedMailbox[]> {
  const rows = await query<{
    id: string;
    address: string;
    provider: string;
    syncing: boolean;
  }>(
    `select m.id::text as id, m.address, m.provider,
            exists (
              select 1 from lodge.sync_runs r
              where r.mailbox_id = m.id
                and r.status in ('running', 'reading')
                and r.started_at > now() - interval '2 minutes'
            ) as syncing
     from lodge.mailboxes m
     where m.account_id = $1::bigint
       and m.disconnected_at is null
     order by m.created_at, m.id`,
    [accountId],
  );
  return rows.flatMap((row) => {
    if (!isMailProvider(row.provider)) return [];
    return [
      {
        id: row.id,
        address: row.address,
        provider: row.provider,
        label: providerLabel(row.provider),
        syncing: row.syncing,
      },
    ];
  });
}

export async function disconnectMailbox(
  accountId: string,
  mailboxId: string,
): Promise<"Gmail" | "Outlook" | null> {
  const rows = await query<{ provider: string }>(
    `update lodge.mailboxes
     set disconnected_at = now(), refresh_token = null
     where id = $1::bigint
       and account_id = $2::bigint
       and disconnected_at is null
     returning provider`,
    [mailboxId, accountId],
  );
  const provider = rows[0]?.provider;
  if (!provider || !isMailProvider(provider)) return null;
  await query(
    `update lodge.sync_runs
     set status = 'failed', finished_at = now()
     where mailbox_id = $1::bigint
       and status in ('running', 'reading')`,
    [mailboxId],
  );
  return providerLabel(provider);
}

async function failStale(): Promise<void> {
  await query(
    `update lodge.sync_runs
     set status = 'failed', finished_at = now()
     where status in ('running', 'reading')
       and started_at < now() - interval '2 minutes'`,
  );
}

export async function beginSync(mailboxId: string): Promise<string | null> {
  await failStale();
  try {
    const rows = await query<{ id: string }>(
      `insert into lodge.sync_runs (mailbox_id, status)
       select $1::bigint, 'running'
       where not exists (
         select 1 from lodge.sync_runs
         where mailbox_id = $1::bigint
           and status in ('running', 'reading')
       )
       and not exists (
         select 1 from lodge.sync_runs
         where mailbox_id = $1::bigint
           and status in ('finished', 'failed')
           and started_at > now() - interval '15 minutes'
       )
       returning id::text as id`,
      [mailboxId],
    );
    return rows[0]?.id ?? null;
  } catch (error) {
    if (uniqueViolation(error)) return null;
    throw error;
  }
}

async function applyMessage(
  accountId: string,
  mailboxId: string,
  message: MailMessage,
  mailboxAddress: string,
): Promise<void> {
  const classified = classifyMail(message, mailboxAddress);
  const seen = await query<{ id: string }>(
    `select id::text as id from lodge.applications
     where mailbox_id = $1::bigint and message_id = $2`,
    [mailboxId, message.id],
  );
  if (seen[0]) {
    if (!classified) {
      await query(
        `update lodge.applications
         set dismissed = true
         where mailbox_id = $1::bigint
           and message_id = $2
           and event <> 'Stage confirmed by you'`,
        [mailboxId, message.id],
      );
    }
    return;
  }
  if (!classified) return;
  const excerpt = message.snippet.slice(0, 280);
  const sourceUrl = message.url.startsWith("https://")
    ? message.url
    : "https://mail.google.com/";
  const existing = await query<{
    id: string;
    needs_review: boolean;
    dismissed: boolean;
    role: string;
    dedupe: string;
    cycle: string;
    occurred_at: Date | string;
  }>(
    `select id::text as id, needs_review, dismissed, role, dedupe, cycle, occurred_at
     from lodge.applications
     where account_id = $1::bigint and dedupe = $2`,
    [accountId, classified.dedupe],
  );
  let current = existing[0];
  if (!current && !classified.roleSpecific) {
    const sameCompany = await query<{
      id: string;
      needs_review: boolean;
      dismissed: boolean;
      role: string;
      dedupe: string;
      cycle: string;
      occurred_at: Date | string;
    }>(
      `select id::text as id, needs_review, dismissed, role, dedupe, cycle, occurred_at
       from lodge.applications
       where account_id = $1::bigint and company = $2 and dismissed = false`,
      [accountId, classified.company],
    );
    if (sameCompany.length === 1) current = sameCompany[0];
  }
  if (!current && classified.roleSpecific) {
    const weak = await query<{
      id: string;
      needs_review: boolean;
      dismissed: boolean;
      role: string;
      dedupe: string;
      cycle: string;
      occurred_at: Date | string;
    }>(
      `select id::text as id, needs_review, dismissed, role, dedupe, cycle, occurred_at
       from lodge.applications
       where account_id = $1::bigint and company = $2 and role = 'Internship'`,
      [accountId, classified.company],
    );
    current = weak[0];
  }
  const cycle = classified.cycle ?? "";
  if (!current) {
    await query(
      `insert into lodge.applications (
         account_id, mailbox_id, company, role, dedupe, stage, event,
         source_url, excerpt, message_id, needs_review, occurred_at, cycle
       ) values (
         $1::bigint, $2::bigint, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
       )`,
      [
        accountId,
        mailboxId,
        classified.company,
        classified.role,
        classified.dedupe,
        classified.stage,
        classified.event,
        sourceUrl,
        excerpt,
        message.id,
        classified.needsReview,
        message.at.toISOString(),
        cycle,
      ],
    );
    return;
  }
  if (current.dismissed && classified.needsReview) return;
  if (!current.needs_review && classified.needsReview) return;
  const newer = message.at.getTime() >= new Date(current.occurred_at).getTime();
  const promoteRole = classified.roleSpecific && current.role === "Internship";
  if (!newer) {
    if (!promoteRole && (current.cycle || !cycle)) return;
    await query(
      `update lodge.applications
       set role = case when $2 then $3 else role end,
           dedupe = case when $2 then $4 else dedupe end,
           cycle = case when cycle = '' and $5 <> '' then $5 else cycle end
       where id = $1::bigint and account_id = $6::bigint`,
      [
        current.id,
        promoteRole,
        classified.role,
        classified.dedupe,
        cycle,
        accountId,
      ],
    );
    return;
  }
  await query(
    `update lodge.applications
     set mailbox_id = $2::bigint,
         stage = $3,
         event = $4,
         source_url = $5,
         excerpt = $6,
         message_id = $7,
         needs_review = $8,
         dismissed = false,
         occurred_at = $9,
         found_at = now(),
         notified_at = null,
         role = case when $11 then $12 else role end,
         dedupe = case when $11 then $13 else dedupe end,
         cycle = case when $14 <> '' then $14 else cycle end
     where id = $1::bigint and account_id = $10::bigint`,
    [
      current.id,
      mailboxId,
      classified.stage,
      classified.event,
      sourceUrl,
      excerpt,
      message.id,
      classified.needsReview,
      message.at.toISOString(),
      accountId,
      promoteRole,
      classified.role,
      classified.dedupe,
      cycle,
    ],
  );
}

export async function finishSync(
  runId: string,
  read: (
    provider: MailProvider,
    refreshToken: string,
  ) => Promise<MailMessage[]> = readInbox,
): Promise<void> {
  const claimed = await query<{
    mailbox_id: string;
    account_id: string;
    provider: string;
    refresh_token: string | null;
    address: string;
  }>(
    `update lodge.sync_runs r
     set status = 'reading'
     from lodge.mailboxes m
     where r.id = $1::bigint
       and r.status = 'running'
       and m.id = r.mailbox_id
       and m.disconnected_at is null
     returning m.id::text as mailbox_id,
               m.account_id::text as account_id,
               m.provider,
               m.refresh_token,
               m.address`,
    [runId],
  );
  const run = claimed[0];
  if (!run) return;
  if (!isMailProvider(run.provider) || !run.refresh_token) {
    await query(
      `update lodge.sync_runs
       set status = 'failed', finished_at = now(), failure = null
       where id = $1::bigint and status = 'reading'`,
      [runId],
    );
    return;
  }
  try {
    let messages = await read(run.provider, run.refresh_token);
    if (read === readInbox) {
      const pending = await query<{ message_id: string }>(
        `select message_id from lodge.applications
         where mailbox_id = $1::bigint
           and dismissed = false
           and event <> 'Stage confirmed by you'`,
        [run.mailbox_id],
      );
      const have = new Set(messages.map((message) => message.id));
      const missing = pending
        .map((row) => row.message_id)
        .filter((id) => !have.has(id));
      if (missing.length > 0) {
        messages = messages.concat(
          await readInbox(run.provider, run.refresh_token, missing),
        );
      }
    }
    for (const message of messages) {
      await applyMessage(run.account_id, run.mailbox_id, message, run.address);
    }
    await query(
      `update lodge.sync_runs
       set status = 'finished', finished_at = now(), failure = null
       where id = $1::bigint and status = 'reading'`,
      [runId],
    );
  } catch (error) {
    const failure =
      error instanceof GmailApiDisabled
        ? gmailApiEnableUrl(error.enableUrl)
        : null;
    console.error(
      "sync failed",
      error instanceof Error ? error.message : "unknown",
    );
    await query(
      `update lodge.sync_runs
       set status = 'failed', finished_at = now(), failure = $2
       where id = $1::bigint and status = 'reading'`,
      [runId, failure],
    );
  }
}

// shortcut: the Node server finishes the run after the response. A freeze after the response needs a scheduled route.
export function startSync(runId: string): void {
  void finishSync(runId);
}

export async function ensureSync(accountId: string): Promise<void> {
  await failStale();
  const due = await query<{ id: string }>(
    `select m.id::text as id
     from lodge.mailboxes m
     where m.account_id = $1::bigint
       and m.disconnected_at is null
       and m.refresh_token is not null
       and not exists (
         select 1 from lodge.sync_runs r
         where r.mailbox_id = m.id
           and r.status in ('running', 'reading')
       )
       and not exists (
         select 1 from lodge.sync_runs r
         where r.mailbox_id = m.id
           and r.status in ('finished', 'failed')
           and r.started_at > now() - interval '15 minutes'
       )`,
    [accountId],
  );
  for (const mailbox of due) {
    const runId = await beginSync(mailbox.id);
    if (runId) startSync(runId);
  }
}

export async function retrySync(accountId: string): Promise<void> {
  await query(
    `update lodge.sync_runs r
     set status = 'failed', finished_at = coalesce(r.finished_at, now())
     from lodge.mailboxes m
     where r.mailbox_id = m.id
       and m.account_id = $1::bigint
       and r.status in ('failed', 'running', 'reading')`,
    [accountId],
  );
  const mailboxes = await query<{ id: string }>(
    `select id::text as id from lodge.mailboxes
     where account_id = $1::bigint
       and disconnected_at is null
       and refresh_token is not null`,
    [accountId],
  );
  for (const mailbox of mailboxes) {
    const rows = await query<{ id: string }>(
      `insert into lodge.sync_runs (mailbox_id, status)
       select $1::bigint, 'running'
       where not exists (
         select 1 from lodge.sync_runs
         where mailbox_id = $1::bigint and status in ('running', 'reading')
       )
       returning id::text as id`,
      [mailbox.id],
    );
    const runId = rows[0]?.id;
    if (runId) startSync(runId);
  }
}

function whenLabel(value: Date): string {
  const age = Date.now() - value.getTime();
  if (age >= 0 && age < 2 * 60 * 1000) return "Just now";
  return value.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export async function loadDesk(accountId: string): Promise<Desk> {
  const seen = await query<{ seen_at: Date | string }>(
    `select seen_at from lodge.visits where account_id = $1::bigint`,
    [accountId],
  );
  const seenAt = seen[0]?.seen_at ? new Date(seen[0].seen_at) : null;
  const rows = await query<{
    id: string;
    company: string;
    role: string;
    stage: string;
    event: string;
    source_url: string;
    excerpt: string;
    pinned: boolean;
    needs_review: boolean;
    occurred_at: Date | string;
    found_at: Date | string;
    provider: string;
    address: string;
    notified_at: Date | string | null;
    cycle: string;
  }>(
    `select a.id::text as id, a.company, a.role, a.stage, a.event, a.source_url,
            a.excerpt, a.pinned, a.needs_review, a.occurred_at, a.found_at,
            a.notified_at, a.cycle,
            m.provider, m.address
     from lodge.applications a
     join lodge.mailboxes m on m.id = a.mailbox_id
     where a.account_id = $1::bigint
       and a.dismissed = false
     order by a.occurred_at desc, a.id desc`,
    [accountId],
  );
  const items: DeskApplication[] = [];
  for (const row of rows) {
    if (!isStage(row.stage) || !isMailProvider(row.provider)) continue;
    const occurred = new Date(row.occurred_at);
    const found = new Date(row.found_at);
    items.push({
      id: row.id,
      stage: row.stage,
      stageLabel: stageLabel(row.stage),
      role: row.role,
      company: row.company,
      event: row.event,
      mailbox: `${providerLabel(row.provider)} · ${row.address}`,
      time: whenLabel(occurred),
      sourceUrl: row.source_url,
      fresh: !seenAt || found.getTime() > seenAt.getTime(),
      pinned: row.pinned,
      needsReview: row.needs_review,
      excerpt: row.excerpt,
      cycle: row.cycle || null,
    });
  }

  const choice = await alertChoice(accountId);
  const pings: { id: string; title: string }[] = [];
  if (choice === "on") {
    for (const row of rows) {
      if (
        !isStage(row.stage) ||
        !isPositiveStage(row.stage) ||
        row.notified_at
      ) {
        continue;
      }
      if (row.needs_review) continue;
      const found = new Date(row.found_at);
      if (Date.now() - found.getTime() > 2 * 60 * 1000) continue;
      pings.push({
        id: row.id,
        title: `${row.company} moved to ${stageLabel(row.stage)}`,
      });
    }
    if (pings.length > 0) {
      await query(
        `update lodge.applications
         set notified_at = now()
         where account_id = $1::bigint
           and id = any($2::bigint[])`,
        [accountId, pings.map((ping) => ping.id)],
      );
    }
  }

  await query(
    `insert into lodge.visits (account_id, seen_at)
     values ($1::bigint, now())
     on conflict (account_id) do update set seen_at = now()`,
    [accountId],
  );

  const mailboxes = await listMailboxes(accountId);
  const runs = await query<{
    status: string;
    finished_at: Date | string | null;
    failure: string | null;
  }>(
    `select r.status, r.finished_at, r.failure
     from lodge.sync_runs r
     join lodge.mailboxes m on m.id = r.mailbox_id
     where m.account_id = $1::bigint
       and m.disconnected_at is null
     order by r.started_at desc
     limit 1`,
    [accountId],
  );
  const latest = runs[0];
  const syncing = mailboxes.some((mailbox) => mailbox.syncing);
  let status: DeskStatus = "ready";
  if (mailboxes.length === 0) status = "empty";
  else if (
    syncing ||
    latest?.status === "running" ||
    latest?.status === "reading"
  ) {
    status = "running";
  } else if (latest?.status === "failed") status = "failed";
  else if (items.length === 0) status = "recognized";
  else if (
    latest?.finished_at &&
    Date.now() - new Date(latest.finished_at).getTime() < 60 * 1000
  ) {
    status = "finished";
  }

  const finishedAt = latest?.finished_at ? new Date(latest.finished_at) : null;
  const synced =
    status === "running"
      ? "Syncing"
      : status === "finished"
        ? "Synced just now"
        : finishedAt
          ? `Synced ${whenLabel(finishedAt) === "Just now" ? "just now" : whenLabel(finishedAt)}`
          : "Not synced yet";
  const noticeItem = items.find(
    (item) => item.fresh && isPositiveStage(item.stage) && !item.needsReview,
  );
  return {
    status,
    synced,
    since: seenAt ? `Since ${whenLabel(seenAt)}` : "Since you opened this desk",
    items,
    notice: noticeItem
      ? `${noticeItem.company} moved to ${noticeItem.stageLabel} from a recognized email.`
      : null,
    pings,
    gmailApiUrl:
      status === "failed" ? gmailApiEnableUrl(latest?.failure) : null,
  };
}

export async function confirmStage(
  accountId: string,
  applicationId: string,
  stage: ApplicationStage,
): Promise<void> {
  await query(
    `update lodge.applications
     set stage = $3,
         event = 'Stage confirmed by you',
         needs_review = false,
         occurred_at = now()
     where id = $1::bigint
       and account_id = $2::bigint
       and dismissed = false`,
    [applicationId, accountId, stage],
  );
}

export async function keepStage(
  accountId: string,
  applicationId: string,
): Promise<void> {
  await query(
    `update lodge.applications
     set needs_review = false
     where id = $1::bigint and account_id = $2::bigint`,
    [applicationId, accountId],
  );
}

export async function setPin(
  accountId: string,
  applicationId: string,
  pinned: boolean,
): Promise<void> {
  await query(
    `update lodge.applications
     set pinned = $3
     where id = $1::bigint and account_id = $2::bigint`,
    [applicationId, accountId, pinned],
  );
}

export type AlertChoice = "off" | "on" | "denied";

export function isAlertChoice(value: string): value is AlertChoice {
  return value === "off" || value === "on" || value === "denied";
}

export async function alertChoice(accountId: string): Promise<AlertChoice> {
  const rows = await query<{ choice: string }>(
    `select choice from lodge.alert_choices where account_id = $1::bigint`,
    [accountId],
  );
  const choice = rows[0]?.choice;
  return choice && isAlertChoice(choice) ? choice : "off";
}

export async function saveAlertChoice(
  accountId: string,
  choice: AlertChoice,
): Promise<void> {
  await query(
    `insert into lodge.alert_choices (account_id, choice)
     values ($1::bigint, $2)
     on conflict (account_id) do update set choice = excluded.choice`,
    [accountId, choice],
  );
}
