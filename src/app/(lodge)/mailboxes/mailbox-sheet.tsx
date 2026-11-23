"use client";

import { useEffect, useRef, useState } from "react";
import {
  disconnectLines,
  listedMailboxes,
  type MailboxStatus,
} from "../../../fixtures/mailboxes.ts";

type Off = { ids: string[]; notice: string };

const emptyOff: Off = { ids: [], notice: "" };

function offKey(email: string) {
  return `lodge-mailboxes-off:${email}`;
}

function readOff(email: string): Off {
  try {
    const value = JSON.parse(sessionStorage.getItem(offKey(email)) ?? "{}") as {
      ids?: unknown;
      notice?: unknown;
    };
    const ids = Array.isArray(value.ids)
      ? value.ids.filter(
          (id): id is string => id === "gmail" || id === "outlook",
        )
      : [];
    return {
      ids,
      notice: typeof value.notice === "string" ? value.notice : "",
    };
  } catch {
    return emptyOff;
  }
}

export function MailboxesDesk({
  email,
  status,
  connect,
  disconnectId,
  disconnectingId,
  link,
}: {
  email: string;
  status: MailboxStatus;
  connect: "Gmail" | "Outlook" | null;
  disconnectId: string | null;
  disconnectingId: string | null;
  link: "in" | "off" | null;
}) {
  const [connecting, setConnecting] = useState(connect);
  const [targetId, setTargetId] = useState<string | null>(
    disconnectingId ?? disconnectId,
  );
  const [busy, setBusy] = useState(disconnectingId !== null);
  const [off, setOff] = useState<Off>(emptyOff);
  const [live, setLive] = useState(false);
  const openers = useRef<Record<string, HTMLButtonElement | null>>({});
  const connects = useRef<
    Partial<Record<"Gmail" | "Outlook", HTMLButtonElement>>
  >({});
  const restore = useRef<"Gmail" | "Outlook" | null>(null);
  const held =
    connect !== null ||
    disconnectId !== null ||
    disconnectingId !== null ||
    link !== null;
  const freeze = held && !live;

  useEffect(() => {
    setOff(readOff(email));
  }, [email]);

  useEffect(() => {
    if (connecting || !restore.current) return;
    const provider = restore.current;
    restore.current = null;
    connects.current[provider]?.focus();
  }, [connecting]);

  function closeSheet() {
    if (!targetId || busy) return;
    openers.current[targetId]?.focus();
    setTargetId(null);
  }

  useEffect(() => {
    if (!targetId || busy) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") closeSheet();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [targetId, busy]);

  if (connecting) {
    const host = connecting === "Gmail" ? "Google" : "Microsoft";
    return (
      <div className="mail" role="status" aria-busy="true">
        <h1>Connecting {connecting}</h1>
        <p className="note">
          Finish at {host}. This inbox is not connected yet.
        </p>
        <span className="ticks" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <button
          type="button"
          className="back"
          autoFocus
          onClick={() => {
            restore.current = connecting;
            setConnecting(null);
          }}
        >
          Cancel connection
        </button>
      </div>
    );
  }

  const shown = (() => {
    if (link === "in") return listedMailboxes("one");
    if (link === "off" || status === "none" || status === "loading") return [];
    const list = listedMailboxes(status);
    if (freeze) return list;
    return list.filter((mailbox) => !off.ids.includes(mailbox.id));
  })();
  const target = shown.find((mailbox) => mailbox.id === targetId) ?? null;
  const notice =
    !freeze && status !== "none" && status !== "loading" && off.ids.length > 0
      ? off.notice
      : "";
  const lines = target
    ? disconnectLines(
        target,
        shown.filter((mailbox) => mailbox.id !== target.id),
      )
    : null;

  function confirm() {
    if (!target || !lines || busy) return;
    const ids = off.ids.includes(target.id) ? off.ids : [...off.ids, target.id];
    const next = { ids, notice: lines.done };
    // shortcut: this tab only, until mailboxes have a spec
    sessionStorage.setItem(offKey(email), JSON.stringify(next));
    setOff(next);
    setLive(true);
    setBusy(false);
    setTargetId(null);
  }

  return (
    <div className={target ? "mail with-sheet" : "mail"}>
      <div className="col">
        <h1>Your mailboxes</h1>
        {status === "loading" ? (
          <div className="loading" role="status" aria-busy="true">
            <p className="loading-line">Loading your mailboxes</p>
            <span className="ticks" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </div>
        ) : (
          <>
            {link === "in" ? (
              <p className="note">
                Gmail is connected and syncing. You can leave this page.
              </p>
            ) : null}
            {link === "off" ? (
              <p className="note">
                Signed in as {email}. No mailbox is linked.
              </p>
            ) : null}
            {status === "none" && !link ? (
              <p className="note">Your email is verified.</p>
            ) : null}
            {notice ? (
              <p className="note pine" role="status">
                {notice}
              </p>
            ) : null}
            {shown.length === 0 ? (
              <div className="empty">
                <h2>No mailbox yet</h2>
                <p>
                  Connect one when you want. Disconnecting never deletes
                  applications.
                </p>
              </div>
            ) : (
              <ul className="rows">
                {shown.map((mailbox) => {
                  const syncing = link === "in";
                  const dropping = busy && mailbox.id === target?.id;
                  return (
                    <li key={mailbox.id} className="row">
                      <span
                        className={syncing ? "inlay hot" : "inlay"}
                        aria-hidden="true"
                      />
                      <div className="identity">
                        <p className="address">{mailbox.address}</p>
                        <p className="meta">
                          {mailbox.provider} ·{" "}
                          {syncing
                            ? "Syncing"
                            : dropping
                              ? "Disconnecting"
                              : "Connected"}
                        </p>
                      </div>
                      {syncing || dropping ? (
                        <span className="ticks" aria-hidden="true">
                          <span />
                          <span />
                          <span />
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="disconnect"
                          aria-label={`Disconnect ${mailbox.address}`}
                          ref={(node) => {
                            openers.current[mailbox.id] = node;
                          }}
                          onClick={() => {
                            setBusy(false);
                            setTargetId(mailbox.id);
                          }}
                        >
                          Disconnect
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {shown.length > 0 && !target ? (
              <p className="optional">Another inbox is optional.</p>
            ) : null}
            {target ? null : (
              <>
                {/* shortcut: no provider request until connect has a spec */}
                {(["Gmail", "Outlook"] as const).map((provider) => (
                  <button
                    key={provider}
                    type="button"
                    className={
                      shown.length === 0 ? "connect center" : "connect"
                    }
                    ref={(node) => {
                      connects.current[provider] = node ?? undefined;
                    }}
                    onClick={() => {
                      setTargetId(null);
                      setConnecting(provider);
                    }}
                  >
                    Connect {provider}
                  </button>
                ))}
              </>
            )}
          </>
        )}
      </div>
      {target && lines ? (
        <aside className="sheet" aria-labelledby="disconnect-ask">
          <p id="disconnect-ask" className="sheet-ask">
            Disconnect this mailbox?
          </p>
          <p className="sheet-address">{target.address}</p>
          <p className="sheet-stay">{lines.sheet}</p>
          <button
            type="button"
            className="drop"
            autoFocus
            aria-busy={busy ? true : undefined}
            onClick={confirm}
          >
            {busy ? "Disconnecting" : "Disconnect mailbox"}
            {busy ? (
              <span className="ticks" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            ) : null}
          </button>
          {busy ? null : (
            <button type="button" className="quiet-cancel" onClick={closeSheet}>
              Cancel
            </button>
          )}
        </aside>
      ) : null}
    </div>
  );
}
