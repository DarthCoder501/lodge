import assert from "node:assert/strict";
import test from "node:test";
import { disconnectLines, mailboxes } from "../../src/fixtures/mailboxes.ts";

test("disconnect copy names the mailbox that stays", () => {
  const gmail = mailboxes[0];
  const outlook = mailboxes[1];
  assert.ok(gmail);
  assert.ok(outlook);

  assert.equal(
    disconnectLines(gmail, [outlook]).sheet,
    "Sync stops. Applications stay. Outlook stays connected.",
  );
  assert.equal(
    disconnectLines(gmail, [outlook]).done,
    "Gmail stopped syncing. Applications stay. Outlook is still connected.",
  );
  assert.equal(
    disconnectLines(outlook, []).sheet,
    "Sync stops. Applications stay.",
  );
  assert.equal(
    disconnectLines(outlook, []).done,
    "Outlook stopped syncing. Applications stay.",
  );
});
