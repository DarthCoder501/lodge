import { requireUser } from "../../../identity/session.ts";
import { resendVerificationLink } from "../../../identity/verify-email.ts";
import { AlertBolt, AlertsRow, type AlertView } from "./alert-bolt.tsx";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function alertView(value: string | undefined): AlertView | null {
  if (
    value === "off" ||
    value === "on" ||
    value === "denied" ||
    value === "ask" ||
    value === "pending"
  ) {
    return value;
  }
  return null;
}

async function sendLink() {
  "use server";
  const user = await requireUser();
  if (!user.emailVerified) await resendVerificationLink(user.email);
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ alerts?: string | string[] }>;
}) {
  const user = await requireUser();
  const view = alertView(first((await searchParams).alerts));

  return (
    <>
      {view ? (
        <AlertBolt email={user.email} view={view} />
      ) : (
        <div className="account">
          <h1>Your account</h1>
          <div className="slab identity">
            <span className="inlay" aria-hidden="true" />
            <div className="copy">
              <p className="address">{user.email}</p>
              <p className="meta">
                {user.emailVerified ? "Verified" : "Not verified"}
              </p>
            </div>
          </div>
          <p className="quiet">Ends this session.</p>
          {user.emailVerified ? null : (
            <>
              <p className="note">
                A link is with {user.email}. It lasts 24 hours.
              </p>
              <form action={sendLink}>
                <button className="primary" type="submit">
                  Send a new link
                </button>
              </form>
            </>
          )}
          <a className="slab" href="/mailboxes">
            <span className="inlay" aria-hidden="true" />
            <span className="copy">
              <span className="row-title">Mailboxes</span>
              <span className="meta">
                {user.emailVerified
                  ? "Gmail and Outlook"
                  : "Verify your email before connecting one"}
              </span>
            </span>
          </a>
          <AlertsRow email={user.email} />
          <a className="back" href="/applications">
            Back to applications
          </a>
        </div>
      )}
      <style>{`
        .account {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 16px;
          max-width: 440px;
        }
        .desk .account h1 {
          margin: 0;
          color: var(--espresso);
          font-size: 32px;
          font-weight: 600;
          line-height: 42px;
        }
        .col {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 16px;
          width: min(100%, 440px);
          min-width: 0;
        }
        .slab {
          display: flex;
          align-items: center;
          gap: 12px;
          box-sizing: border-box;
          width: 100%;
          min-height: 64px;
          padding: 12px 14px;
          border-radius: 4px;
          background: var(--travertine);
          color: inherit;
          text-decoration: none;
        }
        .slab.identity { min-height: 80px; }
        a.slab .row-title { text-decoration: underline; text-underline-offset: 0.15em; }
        .inlay {
          width: 4px;
          height: 24px;
          border-radius: 1px;
          background: var(--pine);
          flex: none;
        }
        .copy { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
        .address, .row-title, .meta, .note, .quiet, .warn, .kicker, .prompt-ask { margin: 0; }
        .address {
          color: var(--espresso);
          font-size: 22px;
          font-weight: 600;
          line-height: 28px;
          overflow-wrap: anywhere;
        }
        .row-title { color: var(--espresso); font-size: 16px; font-weight: 500; line-height: 21px; }
        .meta, .kicker { color: var(--mute); font-size: 13px; line-height: 17px; }
        .quiet { color: var(--mute); font-size: 14px; line-height: 18px; }
        .note { color: var(--mute); font-size: 16px; line-height: 21px; }
        .warn { color: var(--error-ink); font-size: 16px; line-height: 21px; }
        .account form, .primary { width: 100%; margin: 0; }
        .primary, .bolt, .quiet, .back {
          border: 0;
          font: inherit;
          cursor: pointer;
        }
        .primary {
          display: flex;
          align-items: center;
          justify-content: center;
          box-sizing: border-box;
          height: 48px;
          border-radius: 4px;
          background: var(--hearth);
          color: var(--on-hearth);
          font-size: 16px;
          font-weight: 600;
          line-height: 21px;
          text-decoration: none;
        }
        .bolt {
          position: relative;
          width: 64px;
          height: 44px;
          flex: none;
          border-radius: 4px;
          background: var(--stone);
        }
        .bolt[aria-pressed="true"] { background: var(--hearth); }
        .bolt:disabled { cursor: not-allowed; }
        .knob, .gap { position: absolute; border-radius: 2px; }
        .knob { top: 8px; width: 22px; height: 28px; background: var(--parchment); }
        .bolt[aria-pressed="false"] .knob { left: 6px; }
        .bolt[aria-pressed="true"] .knob { left: 36px; }
        .gap { top: 18px; width: 8px; height: 8px; background: var(--mute); }
        .bolt[aria-pressed="false"] .gap { left: 50px; }
        .bolt[aria-pressed="true"] .gap { left: 6px; background: var(--on-hearth); }
        .back, .quiet {
          min-height: 44px;
          padding: 0;
          background: transparent;
          font-size: 15px;
          font-weight: 500;
          line-height: 44px;
          text-decoration: none;
        }
        .back { color: var(--hearth); }
        .quiet { color: var(--mute); }
        .prompt {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 12px;
          box-sizing: border-box;
          width: 100%;
          padding: 16px;
          border-radius: 4px;
          background: var(--travertine);
        }
        .prompt-ask { color: var(--espresso); font-size: 16px; line-height: 21px; }
        .prompt-actions { display: flex; gap: 16px; align-items: center; }
        .prompt .primary { width: auto; min-width: 88px; padding: 0 16px; }
        .ticks { display: inline-flex; align-items: center; gap: 4px; height: 14px; }
        .ticks span { width: 4px; background: var(--hearth); border-radius: 1px; }
        .ticks span:nth-child(odd) { height: 8px; }
        .ticks span:nth-child(2) { height: 14px; }
        .sheet {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 12px;
          box-sizing: border-box;
          width: 100%;
          padding: 24px;
          background: var(--travertine);
        }
        .sheet h2 {
          margin: 0;
          color: var(--espresso);
          font-size: 22px;
          font-weight: 600;
          line-height: 29px;
        }
        .bolt:focus-visible, .primary:focus-visible, .quiet:focus-visible,
        .back:focus-visible, a.slab:focus-visible {
          outline: 2px solid var(--hearth);
          outline-offset: 2px;
        }
        .account.with-sheet {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          align-items: start;
          gap: 24px;
          width: 100%;
          max-width: none;
        }
        @media (min-width: 768px) {
          .account.with-sheet {
            grid-template-columns: minmax(0, 440px) minmax(16rem, 25rem);
            gap: 0;
          }
          .sheet { padding: 0 24px 24px; }
        }
      `}</style>
    </>
  );
}
