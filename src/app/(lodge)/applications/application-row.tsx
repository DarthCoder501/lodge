import type { ApplicationFixture } from "../../../fixtures/applications.ts";

export function ApplicationRow({
  application,
  pinned,
  onPin,
}: {
  application: ApplicationFixture;
  pinned: boolean;
  onPin: () => void;
}) {
  return (
    <li className={application.fresh && !pinned ? "row fresh" : "row"}>
      <span className="inlay" aria-hidden="true" />
      <button
        type="button"
        className={pinned ? "pin on" : "pin"}
        aria-pressed={pinned}
        aria-label={`${pinned ? "Unpin" : "Pin"} ${application.company}`}
        onClick={onPin}
      >
        <span className="pin-mark" aria-hidden="true" />
      </button>
      <div className="identity">
        <p className="role">{application.role}</p>
        <p className="meta">
          {application.company} · {application.event} · {application.mailbox}
        </p>
        {application.stageUnchanged ? (
          <p className="unchanged">Stage unchanged</p>
        ) : null}
      </div>
      <div className="stage">
        <p className="stage-word">{application.stageLabel}</p>
        <p className="when">{application.time}</p>
      </div>
      <a
        className="source"
        href={application.sourceUrl}
        aria-label={`Source for ${application.company}`}
      >
        Source
      </a>
    </li>
  );
}
