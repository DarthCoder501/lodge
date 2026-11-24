"use client";

import { useEffect, useState } from "react";

export type AlertView = "off" | "on" | "denied" | "ask" | "pending";

type Choice = "off" | "on" | "denied";

// shortcut: this browser only, until alerts have a spec
function choiceKey(email: string) {
  return `lodge-alerts:${email}`;
}

function readChoice(email: string): Choice {
  try {
    const value = localStorage.getItem(choiceKey(email));
    if (value === "on" || value === "denied") return value;
  } catch {
    return "off";
  }
  return "off";
}

function writeChoice(email: string, choice: Choice) {
  localStorage.setItem(choiceKey(email), choice);
}

const scope =
  "Assessment, interview, a call, or an offer. Not rejections, reviews, or ordinary mail.";

function boltCopy(view: AlertView) {
  if (view === "on") {
    return { title: "On", meta: "The browser allowed notifications" };
  }
  if (view === "denied") {
    return { title: "Off", meta: "The browser blocked notifications" };
  }
  if (view === "pending") {
    return { title: "Permission pending", meta: "Still off" };
  }
  return { title: "Off until you turn them on", meta: "You choose" };
}

export function AlertsRow({ email }: { email: string }) {
  const [choice, setChoice] = useState<Choice>("off");

  useEffect(() => {
    setChoice(readChoice(email));
  }, [email]);

  const meta =
    choice === "on"
      ? "On"
      : choice === "denied"
        ? "The browser blocked notifications"
        : "Off until you turn them on";

  return (
    <a className="slab" href={`/account?alerts=${choice}`}>
      <span className="inlay" aria-hidden="true" />
      <span className="copy">
        <span className="row-title">Push alerts</span>
        <span className="meta">{meta}</span>
      </span>
    </a>
  );
}

export function AlertBolt({
  email,
  view: initial,
}: {
  email: string;
  view: AlertView;
}) {
  const [view, setView] = useState(initial);
  const [back, setBack] = useState<Choice>("off");
  const copy = boltCopy(view);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && view === "ask") setView(back);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, back]);

  function save(choice: Choice) {
    writeChoice(email, choice);
    setView(choice);
  }

  function pressBolt() {
    if (view === "on") {
      save("off");
      return;
    }
    setBack(view === "denied" ? "denied" : "off");
    setView("ask");
  }

  const held = view === "ask" || view === "pending";

  return (
    <div className={view === "ask" ? "account with-sheet" : "account"}>
      <div className="col">
        <h1>Push alerts</h1>
        {view === "pending" ? (
          <div role="status" aria-busy="true">
            <p className="note">Waiting on the browser. Alerts stay off.</p>
            <span className="ticks" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </div>
        ) : null}
        <div className="slab">
          <div className="copy" id="bolt-copy">
            <p className="row-title">{copy.title}</p>
            <p className="meta">{copy.meta}</p>
          </div>
          <button
            type="button"
            className="bolt"
            aria-pressed={view === "on"}
            aria-labelledby="bolt-copy"
            disabled={held}
            onClick={pressBolt}
          >
            <span className="knob" aria-hidden="true" />
            <span className="gap" aria-hidden="true" />
          </button>
        </div>
        {view === "denied" ? (
          <p className="warn">
            Allow notifications in the browser, then check again.
          </p>
        ) : null}
        {view === "pending" ? null : <p className="note">{scope}</p>}
        {view === "off" || view === "on" ? (
          <p className="note">Alerts never include the email.</p>
        ) : null}
        {view === "on" ? (
          <p className="note">Turning this off keeps applications syncing.</p>
        ) : null}
        {view === "denied" ? (
          <button
            type="button"
            className="primary"
            onClick={() => setView("pending")}
          >
            Check permission again
          </button>
        ) : null}
        {view === "pending" ? (
          <div className="prompt">
            <p className="kicker">Browser</p>
            <p className="prompt-ask">Show notifications</p>
            <div className="prompt-actions">
              <button
                type="button"
                className="quiet"
                onClick={() => save("denied")}
              >
                Block
              </button>
              <button
                type="button"
                className="primary"
                onClick={() => save("on")}
              >
                Allow
              </button>
            </div>
            <p className="note">This prompt belongs to the browser.</p>
          </div>
        ) : null}
        {view === "ask" ? null : (
          <a className="back" href="/account">
            Back to account
          </a>
        )}
      </div>
      {view === "ask" ? (
        <aside className="sheet" aria-labelledby="browser-ask">
          <h2 id="browser-ask">The browser will ask</h2>
          <p className="note">Alerts stay off unless you allow them.</p>
          <button
            type="button"
            className="primary"
            autoFocus
            onClick={() => setView("pending")}
          >
            Continue
          </button>
          <button type="button" className="quiet" onClick={() => setView(back)}>
            Cancel
          </button>
        </aside>
      ) : null}
    </div>
  );
}
