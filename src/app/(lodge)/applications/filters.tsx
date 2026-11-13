"use client";

import { useEffect, useRef, useState } from "react";
import {
  applications,
  applicationsSyncedAt,
  type ApplicationFixture,
} from "../../../fixtures/applications.ts";
import { ApplicationRow } from "./application-row.tsx";
import { WhatsNew } from "./whats-new.tsx";

const filters = [
  { id: "all", label: "All" },
  { id: "since", label: "Since last visit" },
  { id: "pinned", label: "Pinned" },
] as const;

type FilterId = (typeof filters)[number]["id"];

function pinKey(email: string) {
  return `lodge-application-pins:${email}`;
}

function readPins(email: string): string[] {
  try {
    const parsed = JSON.parse(
      sessionStorage.getItem(pinKey(email)) ?? "[]",
    ) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id) => typeof id === "string");
  } catch {
    return [];
  }
}

function visibleApplications(
  filter: FilterId,
  pins: string[],
): ApplicationFixture[] {
  if (filter === "since") return applications.filter((item) => item.fresh);
  if (filter === "pinned")
    return applications.filter((item) => pins.includes(item.id));
  return applications;
}

export function ApplicationsDesk({
  email,
  entered,
}: {
  email: string;
  entered: boolean;
}) {
  const [filter, setFilter] = useState<FilterId>("all");
  const [open, setOpen] = useState(false);
  const [pins, setPins] = useState<string[] | null>(null);
  const openButton = useRef<HTMLButtonElement>(null);
  const pinned = pins ?? [];
  const changes = applications.filter((item) => item.fresh);

  useEffect(() => {
    setPins(readPins(email));
  }, [email]);

  function closeSheet() {
    setOpen(false);
    openButton.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") closeSheet();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function togglePin(id: string) {
    setPins((current) => {
      const base = current ?? readPins(email);
      const next = base.includes(id)
        ? base.filter((item) => item !== id)
        : [...base, id];
      // shortcut: this tab only, until pins have a spec
      sessionStorage.setItem(pinKey(email), JSON.stringify(next));
      return next;
    });
  }

  return (
    <div className={open ? "home with-sheet" : "home"}>
      <div className="list">
        <header className="home-head">
          <h1>Your applications</h1>
          <div className="head-side">
            <p className="synced">{applicationsSyncedAt}</p>
            <button
              ref={openButton}
              type="button"
              className="whats-new"
              aria-expanded={open}
              onClick={() => setOpen(true)}
            >
              What’s new
            </button>
          </div>
        </header>
        {entered ? (
          <p className="notice" role="status">
            Signed in as {email}. Your applications are already here.
          </p>
        ) : null}
        {pins !== null && pins.length === 0 && !entered ? (
          <p className="notice">Nothing is pinned.</p>
        ) : null}
        <nav className="filters" aria-label="Filters">
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-current={filter === item.id ? "true" : undefined}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
              {filter === item.id ? (
                <span className="tick" aria-hidden="true" />
              ) : null}
            </button>
          ))}
        </nav>
        <ul className="rows">
          {visibleApplications(filter, pinned).map((application) => (
            <ApplicationRow
              key={application.id}
              application={application}
              pinned={pinned.includes(application.id)}
              onPin={() => togglePin(application.id)}
            />
          ))}
        </ul>
      </div>
      {open ? <WhatsNew changes={changes} onClose={closeSheet} /> : null}
      <style>{`
        .home { display: flex; flex-direction: column; gap: 16px; }
        .home.with-sheet {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          align-items: start;
        }
        .list { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
        .home-head {
          display: flex;
          flex-wrap: wrap;
          align-items: baseline;
          justify-content: space-between;
          gap: 8px 24px;
        }
        .head-side {
          display: flex;
          flex-wrap: wrap;
          align-items: baseline;
          gap: 8px 16px;
        }
        .desk .home h1 {
          margin: 0;
          color: var(--espresso);
          font-size: 32px;
          font-weight: 600;
          line-height: 42px;
        }
        .synced, .since, .who, .notice { margin: 0; }
        .synced, .since { color: var(--mute); font-size: 13px; line-height: 17px; }
        .notice { color: var(--espresso); font-size: 16px; line-height: 20px; }
        .whats-new, .close, .pin {
          border: 0;
          background: transparent;
          color: var(--hearth);
          font: inherit;
          font-weight: 500;
          cursor: pointer;
        }
        .whats-new, .close { font-size: 14px; line-height: 18px; }
        .whats-new { min-height: 24px; padding: 0; }
        .close { min-width: 44px; min-height: 44px; padding: 0 4px; }
        .whats-new:focus-visible, .close:focus-visible, .pin:focus-visible,
        .filters button:focus-visible {
          outline: 2px solid var(--hearth);
          outline-offset: 2px;
        }
        .home .filters {
          display: flex;
          flex-direction: row;
          flex-wrap: wrap;
          gap: 8px 16px;
        }
        .filters button {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 6px;
          min-width: 24px;
          min-height: 35px;
          padding: 8px 0 0;
          border: 0;
          background: transparent;
          color: var(--mute);
          font: inherit;
          font-size: 14px;
          line-height: 18px;
          cursor: pointer;
        }
        .filters button[aria-current="true"] {
          color: var(--espresso);
          font-weight: 600;
        }
        .tick { width: 24px; height: 3px; border-radius: 1px; background: var(--hearth); }
        .rows, .changes {
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin: 0;
          padding: 0;
          list-style: none;
        }
        .changes { gap: 12px; }
        .row {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 12px;
          padding: 12px 10px 12px 12px;
          border-radius: 4px;
          background: var(--well);
        }
        .row.fresh { background: var(--travertine); }
        .inlay {
          width: 4px;
          height: 28px;
          border-radius: 1px;
          background: var(--parchment);
          flex: none;
        }
        .row.fresh .inlay { background: var(--hearth); }
        .pin {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          padding: 0;
          flex: none;
        }
        .pin-mark {
          width: 10px;
          height: 10px;
          border-radius: 1px;
          background: var(--stone);
        }
        .row.fresh .pin-mark { background: var(--well); }
        .pin.on .pin-mark { background: var(--hearth); }
        .identity {
          flex: 1 1 16rem;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .role, .meta, .unchanged, .stage-word, .when, .who { margin: 0; }
        .role, .who { color: var(--espresso); font-size: 16px; line-height: 21px; }
        .who { font-size: 14px; line-height: 18px; }
        .row.fresh .role { font-weight: 600; }
        .meta, .when { color: var(--mute); font-size: 13px; line-height: 17px; }
        .unchanged { color: var(--hearth); font-size: 13px; line-height: 17px; font-weight: 500; }
        .stage {
          display: flex;
          flex: none;
          flex-direction: column;
          gap: 2px;
          width: 11rem;
        }
        .stage-word {
          color: var(--espresso);
          font-size: 20px;
          font-weight: 600;
          line-height: 26px;
          font-variant-numeric: tabular-nums;
        }
        .when { font-variant-numeric: tabular-nums; }
        .source {
          display: inline-flex;
          align-items: center;
          min-height: 24px;
          color: var(--hearth);
          font-size: 14px;
          font-weight: 500;
          line-height: 18px;
          text-decoration: none;
        }
        .source:focus-visible {
          outline: 2px solid var(--hearth);
          outline-offset: 2px;
        }
        .sheet {
          display: flex;
          flex-direction: column;
          gap: 12px;
          box-sizing: border-box;
          padding: 24px;
          background: var(--stone);
        }
        .sheet-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }
        .sheet h2 {
          margin: 0;
          color: var(--espresso);
          font-size: 22px;
          font-weight: 600;
          line-height: 29px;
        }
        .change {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 12px;
          border-radius: 4px;
          background: var(--travertine);
        }
        @media (min-width: 768px) {
          .home.with-sheet { grid-template-columns: minmax(0, 1fr) minmax(16rem, 25rem); }
        }
      `}</style>
    </div>
  );
}
