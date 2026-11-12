import { ApplicationRow } from "./application-row.tsx";
import {
  applications,
  applicationsSyncedAt,
} from "../../../fixtures/applications.ts";

export default function ApplicationsPage() {
  return (
    <div className="home">
      <header className="home-head">
        <h1>Your applications</h1>
        <p className="synced">{applicationsSyncedAt}</p>
      </header>
      {/* shortcut: labels only, task 7 switches the list */}
      <nav className="filters" aria-label="Filters">
        <span className="on" aria-current="true">
          All
          <span className="tick" aria-hidden="true" />
        </span>
        <span>Since last visit</span>
        <span>Pinned</span>
      </nav>
      <ul className="rows">
        {applications.map((application) => (
          <ApplicationRow key={application.id} application={application} />
        ))}
      </ul>
      <style>{`
        .home { display: flex; flex-direction: column; gap: 16px; }
        .home-head {
          display: flex;
          flex-wrap: wrap;
          align-items: baseline;
          justify-content: space-between;
          gap: 8px 24px;
        }
        .desk .home h1 {
          margin: 0;
          color: var(--espresso);
          font-size: 32px;
          font-weight: 600;
          line-height: 42px;
        }
        .synced { margin: 0; color: var(--mute); font-size: 13px; line-height: 17px; }
        .home .filters {
          display: flex;
          flex-direction: row;
          flex-wrap: wrap;
          gap: 8px 16px;
        }
        .filters > span {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding-top: 8px;
          color: var(--mute);
          font-size: 14px;
          line-height: 18px;
        }
        .filters .on { color: var(--espresso); font-weight: 600; }
        .tick { width: 24px; height: 3px; border-radius: 1px; background: var(--hearth); }
        .rows {
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin: 0;
          padding: 0;
          list-style: none;
        }
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
        .identity {
          flex: 1 1 16rem;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .role, .meta, .unchanged, .stage-word, .when { margin: 0; }
        .role { color: var(--espresso); font-size: 16px; line-height: 21px; }
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
      `}</style>
    </div>
  );
}
