"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import {
  parseReviews,
  reviewStages,
  type ReviewSave,
} from "../../../fixtures/applications.ts";

export function reviewKey(email: string) {
  return `lodge-application-reviews:${email}`;
}

export function readReviews(email: string): Record<string, ReviewSave> {
  try {
    return parseReviews(
      JSON.parse(sessionStorage.getItem(reviewKey(email)) ?? "{}"),
    );
  } catch {
    return {};
  }
}

export function ReviewSheet({
  company,
  excerpt,
  keptLabel,
  index,
  saving,
  onMove,
  onConfirm,
  onStay,
}: {
  company: string;
  excerpt: string;
  keptLabel: string;
  index: number;
  saving: "confirm" | "stay" | null;
  onMove: (step: number) => void;
  onConfirm: () => void;
  onStay: () => void;
}) {
  const center = useRef<HTMLButtonElement>(null);
  const count = reviewStages.length;
  function wrap(offset: number) {
    return (((index + offset) % count) + count) % count;
  }
  const selected = reviewStages[wrap(0)] ?? reviewStages[0];
  const stops = [-2, -1, 0, 1, 2].map((offset) => {
    const stage = reviewStages[wrap(offset)] ?? reviewStages[0];
    return { ...stage, offset };
  });

  useEffect(() => {
    center.current?.focus();
  }, []);

  function onKey(event: KeyboardEvent) {
    if (saving) return;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      onMove(1);
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      onMove(-1);
    }
  }

  return (
    <aside
      className="sheet review"
      aria-labelledby="move-stage"
      onKeyDown={onKey}
    >
      <p id="move-stage" className="review-move">
        Move this stage?
      </p>
      <p className="review-company">{company}</p>
      <div className="review-wheel">
        {stops.map((stop) =>
          stop.offset === 0 ? (
            <button
              key="center"
              ref={center}
              type="button"
              className="review-stop center"
              aria-label={saving ? selected.label : `Confirm ${selected.label}`}
              aria-busy={saving ? true : undefined}
              onClick={() => {
                if (saving) return;
                onConfirm();
              }}
            >
              <span className="detent" aria-hidden="true" />
              <span className="stop-label">{selected.label}</span>
              {saving ? (
                <span className="ticks" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
              ) : null}
            </button>
          ) : (
            <div
              key={stop.offset}
              className={
                Math.abs(stop.offset) === 1
                  ? "review-stop near"
                  : "review-stop far"
              }
            >
              <span className="detent" aria-hidden="true" />
              <span className="stop-label">{stop.label}</span>
            </div>
          ),
        )}
      </div>
      <p className="review-excerpt">{excerpt}</p>
      {saving === "stay" ? (
        <p className="review-stays">{keptLabel} stays until this finishes.</p>
      ) : saving === "confirm" ? null : (
        <button
          type="button"
          className="review-not"
          onClick={() => {
            if (saving) return;
            onStay();
          }}
        >
          Not a move
        </button>
      )}
      <style>{`
        .sheet.review {
          background: var(--travertine);
          padding: 56px 24px 24px;
        }
        .review-move, .review-company, .review-excerpt, .review-stays { margin: 0; }
        .review-move, .review-excerpt {
          color: var(--mute);
          font-size: 14px;
          line-height: 16px;
        }
        .review-company { color: var(--mute); font-size: 13px; line-height: 15px; }
        .review-stays {
          color: var(--espresso);
          font-size: 15px;
          font-weight: 500;
          line-height: 17px;
        }
        .review-wheel {
          display: flex;
          flex-direction: column;
          gap: 4px;
          width: 100%;
        }
        .review-stop {
          display: flex;
          align-items: center;
          gap: 10px;
          box-sizing: border-box;
          width: 100%;
          min-width: 0;
          margin: 0;
          padding: 0 12px;
          border: 0;
          border-radius: 4px;
          font: inherit;
          text-align: left;
        }
        .review-stop.far {
          height: 36px;
          background: var(--well);
          color: var(--mute);
          font-size: 14px;
          line-height: 16px;
        }
        .review-stop.near {
          height: 44px;
          background: transparent;
          color: var(--espresso);
          font-size: 18px;
          line-height: 21px;
        }
        .review-stop.center {
          height: 72px;
          background: var(--hearth);
          color: var(--on-hearth);
          font-size: 28px;
          font-weight: 600;
          line-height: 32px;
          cursor: pointer;
        }
        .review-stop.center .stop-label { font-variant-numeric: tabular-nums; }
        .review-stop.center:focus-visible, .review-not:focus-visible {
          outline: 2px solid var(--hearth);
          outline-offset: 2px;
        }
        .review-stop .detent {
          flex: none;
          width: 3px;
          height: 14px;
          border-radius: 1px;
          background: var(--stone);
        }
        .review-stop.center .detent {
          width: 6px;
          height: 28px;
          background: var(--on-hearth);
        }
        .stop-label { white-space: nowrap; }
        .review-wheel .ticks { height: 16px; }
        .review-wheel .ticks span { background: var(--on-hearth); }
        .review-wheel .ticks span:nth-child(2) { height: 16px; }
        .review-not {
          display: flex;
          align-items: flex-start;
          align-self: flex-start;
          min-width: 44px;
          min-height: 44px;
          padding: 0;
          border: 0;
          background: transparent;
          color: var(--espresso);
          font: inherit;
          font-size: 15px;
          font-weight: 500;
          line-height: 17px;
          cursor: pointer;
        }
      `}</style>
    </aside>
  );
}
