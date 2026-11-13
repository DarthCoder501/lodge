import {
  changesSince,
  type ApplicationFixture,
} from "../../../fixtures/applications.ts";

export function WhatsNew({
  changes,
  onClose,
}: {
  changes: ApplicationFixture[];
  onClose: () => void;
}) {
  return (
    <aside className="sheet" aria-labelledby="what-changed">
      <div className="sheet-head">
        <h2 id="what-changed">What changed</h2>
        <button type="button" className="close" autoFocus onClick={onClose}>
          Close
        </button>
      </div>
      <p className="since">{changesSince}</p>
      <ul className="changes">
        {changes.map((change) => (
          <li key={change.id} className="change">
            <p className="who">
              {change.company} · {change.role}
            </p>
            <p className="stage-word">{change.stageLabel}</p>
            <p className="when">{change.time}</p>
          </li>
        ))}
      </ul>
    </aside>
  );
}
