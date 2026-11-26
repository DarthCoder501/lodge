import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { after, before, beforeEach, test } from "node:test";
import { exec, query } from "../../src/identity/db.ts";
import { signInWithProvider } from "../../src/identity/provider-sign-in.ts";
import { signOut } from "../../src/identity/session.ts";
import type { MailMessage } from "../../src/lodge/classify.ts";
import {
  failureFromGmail,
  GmailApiDisabled,
  gmailApiEnableUrl,
} from "../../src/lodge/mail.ts";
import {
  beginSync,
  confirmStage,
  connectMailbox,
  finishSync,
  listMailboxes,
  loadDesk,
} from "../../src/lodge/store.ts";

process.env.IDENTITY_COOKIE_STORE = "memory";

const owner = "sync.owner@example.com";
const other = "sync.other@example.com";

const offer: MailMessage = {
  id: "offer-1",
  fromName: "Hiring",
  fromAddress: "jobs@acme.com",
  subject: "Your offer for the Design role",
  snippet: "We are pleased to offer you the role.",
  url: "https://mail.google.com/mail/u/0/#all/offer-1",
  at: new Date("2026-11-01T15:00:00Z"),
};

async function removePeople(): Promise<void> {
  await query("delete from identity.accounts where email = any($1::text[])", [
    [owner, other],
  ]);
}

before(async () => {
  const dir = join("supabase", "migrations");
  for (const name of readdirSync(dir)
    .filter((file) => file.endsWith(".sql"))
    .sort()) {
    await exec(readFileSync(join(dir, name), "utf8"));
  }
  await removePeople();
});

after(async () => {
  await signOut();
  await removePeople();
});

beforeEach(async () => {
  await signOut();
  await removePeople();
});

test("sync stores one application and another account cannot see or confirm it", async () => {
  const user = await signInWithProvider({
    provider: "google",
    email: owner,
    linkAsMailbox: false,
  });
  const mailboxId = await connectMailbox({
    accountId: user.id,
    address: "ada@gmail.com",
    provider: "gmail",
    refreshToken: "refresh-token",
  });
  const runId = await beginSync(mailboxId);
  assert.ok(runId);
  await finishSync(runId, async () => [
    offer,
    {
      ...offer,
      id: "lunch",
      subject: "Lunch tomorrow",
      snippet: "See you at noon",
      fromAddress: "friend@gmail.com",
    },
  ]);

  const rows = await query<{
    company: string;
    stage: string;
    source_url: string;
  }>(
    `select company, stage, source_url
     from lodge.applications where account_id = $1::bigint`,
    [user.id],
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.company, "Acme");
  assert.equal(rows[0]?.stage, "offer");
  assert.equal(rows[0]?.source_url, offer.url);

  const again = await beginSync(mailboxId);
  assert.equal(again, null);

  await signOut();
  const stranger = await signInWithProvider({
    provider: "google",
    email: other,
    linkAsMailbox: false,
  });
  assert.equal((await listMailboxes(stranger.id)).length, 0);
  assert.equal((await loadDesk(stranger.id)).items.length, 0);
  const application = await query<{ id: string }>(
    `select id::text as id from lodge.applications where account_id = $1::bigint`,
    [user.id],
  );
  await confirmStage(stranger.id, application[0].id, "rejected");
  const stage = await query<{ stage: string }>(
    `select stage from lodge.applications where id = $1::bigint`,
    [application[0].id],
  );
  assert.equal(stage[0]?.stage, "offer");
});

const enableUrl =
  "https://console.developers.google.com/apis/api/gmail.googleapis.com/overview?project=248305072341";

test("a disabled Gmail API keeps the console link and other failures do not", async () => {
  const off = failureFromGmail(403, {
    error: {
      message: `Gmail API has not been used in project 248305072341 before or it is disabled. Enable it by visiting ${enableUrl} then retry.`,
    },
  });
  assert.ok(off instanceof GmailApiDisabled);
  assert.equal(off.enableUrl, enableUrl);
  assert.equal(
    failureFromGmail(403, { error: { message: "insufficient scopes" } }).message,
    "Gmail list failed",
  );
  assert.equal(gmailApiEnableUrl("https://evil.example/project=1"), null);

  const user = await signInWithProvider({
    provider: "google",
    email: owner,
    linkAsMailbox: false,
  });
  const mailboxId = await connectMailbox({
    accountId: user.id,
    address: "ada@gmail.com",
    provider: "gmail",
    refreshToken: "refresh-token",
  });
  const runId = await beginSync(mailboxId);
  assert.ok(runId);
  await finishSync(runId, async () => {
    throw off;
  });
  const desk = await loadDesk(user.id);
  assert.equal(desk.status, "failed");
  assert.equal(desk.gmailApiUrl, enableUrl);
  assert.equal(desk.items.length, 0);

  const otherId = await connectMailbox({
    accountId: user.id,
    address: "ada.other@gmail.com",
    provider: "gmail",
    refreshToken: "refresh-token",
  });
  const otherRun = await beginSync(otherId);
  assert.ok(otherRun);
  await finishSync(otherRun, async () => {
    throw new Error("Gmail list failed");
  });
  const later = await loadDesk(user.id);
  assert.equal(later.status, "failed");
  assert.equal(later.gmailApiUrl, null);
});

test("a job alert is dropped and an IBM thread becomes one summer offer", async () => {
  const user = await signInWithProvider({
    provider: "google",
    email: owner,
    linkAsMailbox: false,
  });
  const mailboxId = await connectMailbox({
    accountId: user.id,
    address: "ada@gmail.com",
    provider: "gmail",
    refreshToken: "refresh-token",
  });
  const runId = await beginSync(mailboxId);
  assert.ok(runId);
  await finishSync(runId, async () => [
    {
      id: "lensa",
      fromName: "Lensa",
      fromAddress: "lensa24@lensa.com",
      subject: "Data Science Intern jobs in New York, NY, posted November 22",
      snippet: "CapitalG and NYU Langone Health are hiring now",
      url: "https://mail.google.com/mail/u/0/#all/lensa",
      at: new Date("2026-11-23T22:13:16Z"),
    },
    {
      id: "ibm-deadline",
      fromName: "Belinda Williams",
      fromAddress: "belindaw@ibm.com",
      subject:
        "Action Required: IBM Job Offer Decision Deadline - 11/27/2026 (Intern Data Scientist 2027)",
      snippet: "I wanted to follow up regarding your outstanding job offer.",
      url: "https://mail.google.com/mail/u/0/#all/ibm-deadline",
      at: new Date("2026-11-23T18:00:00Z"),
    },
    {
      id: "ibm-start",
      fromName: "Belinda Williams",
      fromAddress: "belindaw@ibm.com",
      subject: "RE: Intern Data Scientist 2027 Offer: Question About Start Date",
      snippet:
        "Unfortunately, May 24 is the only cohort start date available for our interns",
      url: "https://mail.google.com/mail/u/0/#all/ibm-start",
      at: new Date("2026-11-17T15:00:00Z"),
    },
    {
      id: "own",
      fromName: "Ada",
      fromAddress: "ada@gmail.com",
      subject: "Intern Data Scientist 2027 Offer: Question About Start Date",
      snippet: "Thank you for the offer to join IBM",
      url: "https://mail.google.com/mail/u/0/#all/own",
      at: new Date("2026-11-16T15:00:00Z"),
    },
  ]);
  const rows = await query<{
    company: string;
    role: string;
    stage: string;
    cycle: string;
  }>(
    `select company, role, stage, cycle
     from lodge.applications where account_id = $1::bigint and dismissed = false`,
    [user.id],
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.company, "IBM");
  assert.equal(rows[0]?.role, "Intern Data Scientist");
  assert.equal(rows[0]?.stage, "offer");
  assert.equal(rows[0]?.cycle, "Summer 2027");
});

test("a refresh token on sign-in stores that inbox and no token does not", async () => {
  const linked = await signInWithProvider({
    provider: "google",
    email: owner,
    linkAsMailbox: true,
    refreshToken: "refresh-token",
  });
  const rows = await listMailboxes(linked.id);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.address, owner);
  assert.equal(rows[0]?.provider, "gmail");

  await signOut();
  const plain = await signInWithProvider({
    provider: "microsoft",
    email: other,
    linkAsMailbox: true,
  });
  assert.equal((await listMailboxes(plain.id)).length, 0);
});
