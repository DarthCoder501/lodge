import type { ReactNode } from "react";

type ResendAction = (formData: FormData) => void;

export function Desk({ children }: { children: ReactNode }) {
  return (
    <div className="access">
      <div className="wall">
        <p className="mark">Lodge</p>
        <p className="place">A private place for your applications</p>
        <p className="privacy">
          Private to you. A mailbox connects only if you allow it.
        </p>
      </div>
      <main className="desk">
        <div className="column">{children}</div>
      </main>
      <style>{`
        .access { display: flex; flex-direction: column; min-height: 100vh; }
        .wall, .desk, .column, .field, .well { box-sizing: border-box; }
        .wall {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          padding: 1.5rem 1rem;
          background: var(--timber);
          color: var(--on-timber);
        }
        .mark, .place, .privacy, .note { margin: 0; }
        .mark { font-size: 18px; font-weight: 600; line-height: 24px; }
        .place { max-width: 390px; font-size: 32px; font-weight: 400; line-height: 43px; }
        .privacy { max-width: 390px; font-size: 14px; line-height: 19px; color: var(--on-timber-mute); }
        .desk {
          flex: 1;
          min-width: 0;
          padding: 2rem 1rem 3rem;
          background: var(--parchment);
          color: var(--timber);
        }
        .column {
          width: min(440px, 100%);
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 18px;
        }
        h1 {
          margin: 0;
          color: var(--espresso);
          font-size: 34px;
          font-weight: 600;
          line-height: 46px;
        }
        .note { color: var(--mute); font-size: 16px; line-height: 22px; }
        .field { display: flex; flex-direction: column; gap: 8px; }
        .label { margin: 0; font-size: 14px; line-height: 19px; font-weight: 500; color: var(--espresso); }
        .well {
          display: flex;
          align-items: center;
          height: 64px;
          padding: 0 16px 0 14px;
          gap: 12px;
          background: var(--pine-surface);
          border-radius: 4px;
        }
        .inlay { width: 4px; height: 28px; border-radius: 1px; background: var(--pine); flex: none; }
        .value { color: var(--pine); font-size: 20px; line-height: 28px; }
        form.resend { display: contents; margin: 0; }
        .primary, .quiet { font: inherit; cursor: pointer; }
        .primary {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 48px;
          border: 0;
          border-radius: 4px;
          background: var(--hearth);
          color: var(--on-hearth);
          font-size: 16px;
          font-weight: 600;
          text-decoration: none;
        }
        .primary.pine { background: var(--pine); }
        .quiet {
          display: inline-flex;
          align-items: center;
          width: fit-content;
          min-height: 44px;
          padding: 0;
          border: 0;
          background: transparent;
          color: var(--hearth);
          font-size: 15px;
          font-weight: 500;
          line-height: 20px;
          text-decoration: none;
        }
        .ticks { display: inline-flex; align-items: center; gap: 6px; height: 44px; }
        .ticks span { width: 6px; height: 10px; background: var(--hearth); border-radius: 1px; }
        .ticks span:nth-child(2) { height: 18px; }
        a:focus-visible, button:focus-visible {
          outline: 2px solid var(--hearth);
          outline-offset: 2px;
        }
        @media (min-width: 960px) {
          .access { flex-direction: row; }
          .wall {
            width: 480px;
            flex: none;
            justify-content: space-between;
            gap: 2rem;
            min-height: 100vh;
            padding: 36px 36px 32px;
          }
          .desk { padding: 72px 24px 48px; }
        }
      `}</style>
    </div>
  );
}

function Ticks() {
  return (
    <span className="ticks" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

function Pending({ title, body }: { title: string; body: string }) {
  return (
    <>
      <h1>{title}</h1>
      <p className="note" role="status">
        {body}
      </p>
      <Ticks />
    </>
  );
}

export function Opening() {
  return (
    <Pending
      title="Checking your link"
      body="Your email stays unverified until this finishes."
    />
  );
}

export function Sending({ email }: { email: string }) {
  return (
    <Pending
      title="Sending a new link"
      body={`Sending to ${email}. The previous link will stop working.`}
    />
  );
}

function SentLink({
  title,
  body,
  email,
  action,
}: {
  title: string;
  body: string;
  email: string;
  action: ResendAction;
}) {
  return (
    <>
      <h1>{title}</h1>
      <p className="note" role="status">
        {body}
      </p>
      <a className="primary" href="/sign-in">
        Keep using Lodge
      </a>
      <form className="resend" action={action}>
        <input type="hidden" name="email" value={email} />
        <button className="quiet" type="submit">
          Send a new link
        </button>
      </form>
    </>
  );
}

export function CheckEmail({
  email,
  action,
}: {
  email: string;
  action: ResendAction;
}) {
  return (
    <SentLink
      title="Check your email"
      body={`A link is on its way to ${email}. It lasts 24 hours. Open it before connecting a mailbox.`}
      email={email}
      action={action}
    />
  );
}

export function Resent({
  email,
  action,
}: {
  email: string;
  action: ResendAction;
}) {
  return (
    <SentLink
      title="A new link is on its way"
      body={`Sent to ${email}. It lasts 24 hours, and the previous link no longer works.`}
      email={email}
      action={action}
    />
  );
}

export function Expired({
  email,
  action,
}: {
  email: string;
  action: ResendAction;
}) {
  return (
    <>
      <h1>This link has expired</h1>
      <p className="note" role="alert">
        Links last 24 hours. Send a new one to {email}.
      </p>
      <form className="resend" action={action}>
        <input type="hidden" name="email" value={email} />
        <button className="primary" type="submit">
          Send a new link
        </button>
      </form>
    </>
  );
}

export function Verified({ email }: { email: string }) {
  return (
    <>
      <h1>Your email is verified</h1>
      <div className="field">
        <p className="label">Email</p>
        <div className="well">
          <span className="inlay" aria-hidden="true" />
          <span className="value">{email}</span>
        </div>
      </div>
      <p className="note" role="status">
        Connecting a mailbox is optional.
      </p>
      <a className="primary pine" href="/mailboxes">
        Go to mailboxes
      </a>
      <a className="quiet" href="/applications">
        Go to applications
      </a>
    </>
  );
}

export function Used() {
  return (
    <>
      <h1>This link was already used</h1>
      <p className="note" role="alert">
        Sign in to see whether this email is verified.
      </p>
      <a className="primary" href="/sign-in">
        Go to sign in
      </a>
    </>
  );
}

export function Invalid() {
  return (
    <>
      <h1>This link doesn’t look right</h1>
      <p className="note" role="alert">
        Open the latest verification email, or sign in and send a new one.
      </p>
      <a className="primary" href="/sign-in">
        Go to sign in
      </a>
      <a className="quiet" href="/sign-in">
        Request a new link
      </a>
    </>
  );
}
