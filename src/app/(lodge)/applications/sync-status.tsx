import type { DeskStatus } from "../../../fixtures/applications.ts";

const emptyCopy = {
  empty: {
    title: "A quiet start",
    body: "Connect Gmail or Outlook to find applications.",
    action: "Go to mailboxes",
    kicker: "No mailbox connected",
  },
  recognized: {
    title: "Nothing recognized yet",
    body: "This mailbox is connected. No applications yet.",
    action: "View connected mailbox",
    kicker: null,
  },
} as const;

export function SyncStatus({ status }: { status: DeskStatus }) {
  if (status === "loading") {
    return (
      <div className="loading" role="status" aria-busy="true">
        <p className="loading-line">Loading your applications</p>
        <span className="ticks" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </div>
    );
  }

  if (status === "empty" || status === "recognized") {
    const copy = emptyCopy[status];
    return (
      <div className="quiet">
        {copy.kicker ? <p className="kicker">{copy.kicker}</p> : null}
        <div className="empty">
          <h2>{copy.title}</h2>
          <p>{copy.body}</p>
        </div>
        <a className="primary" href="/mailboxes">
          {copy.action}
        </a>
      </div>
    );
  }

  if (status === "running") {
    return (
      <p className="sync-note" role="status">
        Syncing mailboxes. You can keep working.
      </p>
    );
  }

  if (status === "finished") {
    return (
      <p className="sync-note" role="status">
        Your list is up to date.
      </p>
    );
  }

  if (status === "failed") {
    return (
      <>
        <p className="sync-note bad" role="alert">
          Sync couldn’t finish. Saved applications are unchanged.
        </p>
        {/* shortcut: fixture control, no provider until sync has a spec */}
        <button type="button" className="primary">
          Retry sync
        </button>
      </>
    );
  }

  return null;
}
