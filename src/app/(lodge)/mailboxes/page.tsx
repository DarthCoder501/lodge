import { listedMailboxes, mailboxStatus } from "../../../fixtures/mailboxes.ts";
import { requireUser } from "../../../identity/session.ts";
import { resendVerificationLink } from "../../../identity/verify-email.ts";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function sendLink() {
  "use server";
  const user = await requireUser();
  if (!user.emailVerified) await resendVerificationLink(user.email);
}

export default async function MailboxesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const status = mailboxStatus(first(params.status));
  const rows = user.emailVerified ? listedMailboxes(status) : [];

  return (
    <div className="mail">
      <h1>Your mailboxes</h1>
      {!user.emailVerified ? (
        <>
          <p className="gate" role="alert">
            Verify your email before a mailbox can connect.
          </p>
          <p className="note">
            A link is with {user.email}. It lasts 24 hours.
          </p>
          <form action={sendLink}>
            <button className="primary" type="submit">
              Send a new link
            </button>
          </form>
          <a className="back" href="/applications">
            Back to applications
          </a>
          <p className="optional held">Another inbox is optional.</p>
          <button className="connect" type="button" disabled>
            Connect Gmail
          </button>
          <button className="connect" type="button" disabled>
            Connect Outlook
          </button>
        </>
      ) : status === "loading" ? (
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
          {rows.length === 0 ? (
            <>
              <p className="note">Your email is verified.</p>
              <div className="empty">
                <h2>No mailbox yet</h2>
                <p>
                  Connect one when you want. Disconnecting never deletes
                  applications.
                </p>
              </div>
            </>
          ) : (
            <ul className="rows">
              {rows.map((mailbox) => (
                <li key={mailbox.id} className="row">
                  <span className="inlay" aria-hidden="true" />
                  <div className="identity">
                    <p className="address">{mailbox.address}</p>
                    <p className="meta">{mailbox.provider} · Connected</p>
                  </div>
                  {/* shortcut: label only, disconnect sheet is the next task */}
                  <button
                    type="button"
                    className="disconnect"
                    aria-label={`Disconnect ${mailbox.address}`}
                  >
                    Disconnect
                  </button>
                </li>
              ))}
            </ul>
          )}
          {rows.length > 0 ? (
            <p className="optional">Another inbox is optional.</p>
          ) : null}
          {/* shortcut: no provider request until connect has a spec */}
          <button
            className={rows.length === 0 ? "connect center" : "connect"}
            type="button"
          >
            Connect Gmail
          </button>
          <button
            className={rows.length === 0 ? "connect center" : "connect"}
            type="button"
          >
            Connect Outlook
          </button>
        </>
      )}
      <style>{`
        .mail {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 16px;
          max-width: 440px;
        }
        .desk .mail h1 {
          margin: 0;
          color: var(--espresso);
          font-size: 32px;
          font-weight: 600;
          line-height: 42px;
        }
        .gate, .note, .optional, .address, .meta, .loading-line { margin: 0; }
        .gate { color: var(--error-ink); font-size: 16px; line-height: 21px; }
        .note { color: var(--mute); font-size: 16px; line-height: 21px; }
        .optional { color: var(--mute); font-size: 14px; line-height: 18px; }
        .optional.held { color: var(--disabled); }
        .rows {
          display: flex;
          flex-direction: column;
          gap: 16px;
          width: 100%;
          margin: 0;
          padding: 0;
          list-style: none;
        }
        .row {
          display: flex;
          align-items: center;
          gap: 12px;
          box-sizing: border-box;
          width: 100%;
          padding: 14px 12px 14px 14px;
          border-radius: 4px;
          background: var(--travertine);
        }
        .inlay {
          width: 4px;
          height: 28px;
          border-radius: 1px;
          background: var(--pine);
          flex: none;
        }
        .identity { flex: 1; min-width: 0; }
        .address {
          color: var(--espresso);
          font-size: 20px;
          font-weight: 600;
          line-height: 26px;
          overflow-wrap: anywhere;
        }
        .meta { color: var(--mute); font-size: 13px; line-height: 17px; }
        .disconnect, .back {
          border: 0;
          background: transparent;
          color: var(--hearth);
          font: inherit;
          font-weight: 500;
          text-decoration: none;
          cursor: pointer;
        }
        .disconnect {
          flex: none;
          min-height: 24px;
          padding: 0;
          font-size: 14px;
          line-height: 18px;
        }
        .back { min-height: 44px; font-size: 15px; line-height: 44px; }
        .disconnect:focus-visible, .back:focus-visible,
        .primary:focus-visible, .connect:focus-visible {
          outline: 2px solid var(--hearth);
          outline-offset: 2px;
        }
        .mail form, .primary, .connect, .empty { width: 100%; }
        .mail form { margin: 0; }
        .primary, .connect {
          display: flex;
          align-items: center;
          box-sizing: border-box;
          border: 0;
          border-radius: 4px;
          font: inherit;
          font-size: 16px;
          font-weight: 500;
          line-height: 21px;
        }
        .primary {
          justify-content: center;
          height: 48px;
          background: var(--hearth);
          color: var(--on-hearth);
          font-weight: 600;
          cursor: pointer;
        }
        .connect {
          height: 52px;
          padding: 0 16px;
          justify-content: flex-start;
          background: var(--travertine);
          color: var(--espresso);
          cursor: pointer;
        }
        .connect.center { height: 48px; justify-content: center; padding: 0; }
        .connect:disabled {
          background: var(--stone);
          color: var(--disabled);
          cursor: not-allowed;
        }
        .empty {
          display: flex;
          flex-direction: column;
          gap: 12px;
          box-sizing: border-box;
          padding: 24px 20px;
          border-radius: 4px;
          background: var(--travertine);
        }
        .empty h2 {
          margin: 0;
          color: var(--espresso);
          font-size: 28px;
          font-weight: 600;
          line-height: 36px;
        }
        .empty p { margin: 0; color: var(--mute); font-size: 16px; line-height: 21px; }
        .loading { display: flex; flex-direction: column; align-items: flex-start; gap: 16px; }
        .loading-line { color: var(--mute); font-size: 16px; line-height: 21px; }
        .ticks { display: inline-flex; align-items: center; gap: 4px; height: 14px; }
        .ticks span { width: 4px; background: var(--hearth); border-radius: 1px; }
        .ticks span:nth-child(odd) { height: 8px; }
        .ticks span:nth-child(2) { height: 14px; }
      `}</style>
    </div>
  );
}
