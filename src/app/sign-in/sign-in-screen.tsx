"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import { signIn, signOutAction, type SignInFormState } from "./actions.ts";

const initialState: SignInFormState = {};

function frameMessage(error: NonNullable<SignInFormState["error"]>): string {
  if (error.code === "INVALID_LOGIN") return "Email or password is incorrect.";
  return error.message;
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

function Access({ children }: { children: ReactNode }) {
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
        .wall, .desk, .column, .field, .well, .provider, .latch { box-sizing: border-box; }
        .wall {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          padding: 1.5rem 1rem;
          background: var(--timber);
          color: var(--on-timber);
        }
        .mark, .place, .privacy, .note, .error, .status, .leave { margin: 0; }
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
        .error { color: var(--error-ink); font-size: 16px; line-height: 22px; }
        .status { color: var(--espresso); font-size: 16px; line-height: 22px; }
        form.account { display: flex; flex-direction: column; gap: 18px; margin: 0; }
        .field { display: flex; flex-direction: column; gap: 8px; }
        label { font-size: 14px; line-height: 19px; font-weight: 500; color: var(--espresso); }
        .well {
          display: flex;
          align-items: center;
          height: 64px;
          padding: 0 16px 0 14px;
          gap: 12px;
          overflow: hidden;
          background: var(--well);
          border-radius: 4px;
        }
        .well.error { background: var(--well-error); }
        .well.pending { background: var(--travertine); }
        .well:focus-within:not(.error):not(.pending) { background: var(--well-focus); }
        .inlay { width: 4px; height: 28px; border-radius: 1px; background: transparent; flex: none; }
        .well.error .inlay { background: var(--error-ink); }
        .well:focus-within:not(.error):not(.pending) .inlay { background: var(--hearth); }
        .well input {
          width: 0;
          flex: 1;
          align-self: stretch;
          min-width: 0;
          border: 0;
          padding: 0;
          background: transparent;
          color: var(--espresso);
          font: inherit;
          font-size: 20px;
          line-height: 28px;
        }
        .well input:focus { outline: none; }
        .well input:disabled { color: var(--disabled); }
        .well input:-webkit-autofill {
          -webkit-text-fill-color: var(--espresso);
          caret-color: var(--espresso);
          box-shadow: 0 0 0 64px var(--well) inset;
        }
        .well:focus-within:not(.error):not(.pending) input:-webkit-autofill {
          box-shadow: 0 0 0 64px var(--well-focus) inset;
        }
        .well.error input:-webkit-autofill { box-shadow: 0 0 0 64px var(--well-error) inset; }
        .show {
          position: relative;
          z-index: 1;
          flex: none;
          min-width: 44px;
          height: 44px;
          padding: 0 0 0 8px;
          border: 0;
          background: transparent;
          color: var(--hearth);
          font: inherit;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
        }
        .primary {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          width: 100%;
          height: 48px;
          border: 0;
          border-radius: 4px;
          background: var(--hearth);
          color: var(--on-hearth);
          font: inherit;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
        }
        .primary:disabled { cursor: progress; }
        .ticks { display: inline-flex; align-items: center; gap: 4px; height: 14px; }
        .ticks span { width: 4px; background: var(--hearth); border-radius: 1px; }
        .primary .ticks span { background: var(--on-hearth); }
        .ticks span:nth-child(odd) { height: 8px; }
        .ticks span:nth-child(2) { height: 14px; }
        .alternate, .quiet {
          display: flex;
          align-items: center;
          gap: 8px;
          min-height: 44px;
          margin: 0;
          color: var(--mute);
          font-size: 15px;
          line-height: 20px;
        }
        .alternate a, .quiet {
          color: var(--hearth);
          font-weight: 500;
          font: inherit;
          font-size: 15px;
          font-weight: 500;
        }
        .quiet {
          width: fit-content;
          padding: 0;
          border: 0;
          background: transparent;
          cursor: pointer;
        }
        .providers { display: flex; flex-direction: column; gap: 8px; padding-top: 8px; }
        .provider {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          margin: 0;
          padding: 12px 12px 12px 16px;
          background: var(--travertine);
          border: 0;
          border-radius: 4px;
          color: inherit;
          font: inherit;
        }
        .provider button {
          flex: 1;
          min-width: 0;
          min-height: 44px;
          padding: 0;
          border: 0;
          background: transparent;
          color: inherit;
          font: inherit;
          text-align: left;
          cursor: pointer;
        }
        .provider-title, .provider-note { display: block; }
        .provider-title { color: var(--espresso); font-size: 16px; font-weight: 500; line-height: 22px; }
        .provider-note { color: var(--mute); font-size: 13px; line-height: 18px; }
        .latch {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: flex-start;
          width: 64px;
          height: 44px;
          padding: 0 6px;
          background: var(--stone);
          border-radius: 4px;
          flex: none;
        }
        .latch input {
          position: absolute;
          inset: 0;
          margin: 0;
          opacity: 0;
          cursor: pointer;
        }
        .latch:has(input:checked) { justify-content: flex-end; background: var(--hearth); }
        .bolt { width: 22px; height: 28px; border-radius: 2px; background: var(--on-hearth); pointer-events: none; }
        .leave { color: var(--mute); font-size: 13px; line-height: 18px; }
        a:focus-visible, button:focus-visible, .latch:focus-within {
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

function Leave({
  title,
  body,
  onBack,
}: {
  title: string;
  body: string;
  onBack: () => void;
}) {
  return (
    <Access>
      <h1>{title}</h1>
      <p className="status" role="status">
        {body}
      </p>
      <Ticks />
      <button type="button" className="quiet" onClick={onBack}>
        Back to sign in
      </button>
    </Access>
  );
}

function SignInForm({
  notice,
  signedOut,
}: {
  notice?: string;
  signedOut?: boolean;
}) {
  const [state, action, pending] = useActionState(signIn, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const [leave, setLeave] = useState<"google" | "microsoft" | null>(null);
  const [googleHref, setGoogleHref] = useState("/sign-in/google");
  const fieldKey = state.id ?? "draft";
  const serverPassword = state.password ?? "";
  const [draft, setDraft] = useState({ id: fieldKey, value: serverPassword });
  const passwordValue = draft.id === fieldKey ? draft.value : serverPassword;
  const error = state.error;
  const showLatch = passwordValue.length > 0 && !pending;

  useEffect(() => {
    if (leave !== "google") return;
    const id = window.setTimeout(() => {
      window.location.assign(googleHref);
    }, 0);
    return () => window.clearTimeout(id);
  }, [googleHref, leave]);

  if (leave === "google") {
    return (
      <Leave
        title="Continuing to Google"
        body={
          googleHref.includes("linkAsMailbox")
            ? "Finish on Google’s page. Lodge never asks for that password. This inbox will be read for applications."
            : "Finish on Google’s page. Lodge never asks for that password. Inbox linking is off, so this will not read mail."
        }
        onBack={() => setLeave(null)}
      />
    );
  }

  if (leave === "microsoft") {
    return (
      <Leave
        title="Continuing to Microsoft"
        body="Finish on Microsoft’s page. Lodge never asks for that password. Inbox linking is off, so this will not read mail."
        onBack={() => setLeave(null)}
      />
    );
  }

  return (
    <Access>
      <h1>Welcome back</h1>
      {signedOut ? (
        <p className="note" role="status">
          You’re signed out.
        </p>
      ) : null}
      {notice ? (
        <p className="error" role="alert">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p id="sign-in-error" className="error" role="alert">
          {frameMessage(error)}
        </p>
      ) : null}
      <form className="account" action={action}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <div className={`well${error ? " error" : ""}${pending ? " pending" : ""}`}>
            <span className="inlay" aria-hidden="true" />
            <input
              key={`${fieldKey}-email`}
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              defaultValue={state.email ?? ""}
              required
              disabled={pending}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "sign-in-error" : undefined}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <div className={`well${error ? " error" : ""}${pending ? " pending" : ""}`}>
            <span className="inlay" aria-hidden="true" />
            <input
              key={`${fieldKey}-password`}
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              defaultValue={passwordValue}
              required
              disabled={pending}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "sign-in-error" : undefined}
              onChange={(event) =>
                setDraft({ id: fieldKey, value: event.target.value })
              }
            />
            {showLatch ? (
              <button
                type="button"
                className="show"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            ) : null}
          </div>
        </div>
        <button className="primary" type="submit" disabled={pending}>
          {pending ? "Signing in" : "Sign in"}
          {pending ? <Ticks /> : null}
        </button>
      </form>
      <p className="alternate">
        <span>New to Lodge?</span>
        <a href="/sign-up">Create account</a>
      </p>
      <div className="providers">
        <form
          className="provider"
          action="/sign-in/google"
          method="get"
          onSubmit={(event) => {
            event.preventDefault();
            const link =
              new FormData(event.currentTarget).get("linkAsMailbox") ===
              "true";
            setGoogleHref(
              link ? "/sign-in/google?linkAsMailbox=true" : "/sign-in/google",
            );
            setLeave("google");
          }}
        >
          <button type="submit">
            <span className="provider-title">Continue with Google</span>
            <span className="provider-note">Read Gmail for applications</span>
          </button>
          <label className="latch">
            <input
              type="checkbox"
              name="linkAsMailbox"
              value="true"
              aria-label="Read Gmail for applications"
            />
            <span className="bolt" aria-hidden="true" />
          </label>
        </form>
        <div className="provider">
          <button type="button" onClick={() => setLeave("microsoft")}>
            <span className="provider-title">Continue with Microsoft</span>
            <span className="provider-note">
              Read Outlook for applications
            </span>
          </button>
          <label className="latch">
            <input
              type="checkbox"
              name="linkAsMailbox"
              value="true"
              aria-label="Read Outlook for applications"
              disabled
            />
            <span className="bolt" aria-hidden="true" />
          </label>
        </div>
        <p className="leave">Leave these off to sign in without reading mail.</p>
      </div>
    </Access>
  );
}

function SignedIn({ email }: { email: string }) {
  const [, action, pending] = useActionState(signOutAction, undefined);

  return (
    <Access>
      <h1>Signed in</h1>
      <p className="status" role="status">
        Signed in as {email}.
      </p>
      <form action={action}>
        <button className="primary" type="submit" disabled={pending}>
          {pending ? "Signing out" : "Sign out"}
        </button>
      </form>
    </Access>
  );
}

export function SignInScreen({
  email,
  notice,
  signedOut,
  returning,
}: {
  email?: string;
  notice?: string;
  signedOut?: boolean;
  returning?: boolean;
}) {
  if (email) return <SignedIn email={email} />;
  if (returning) {
    return (
      <Access>
        <h1>Finishing sign-in</h1>
        <p className="status" role="status">
          If this email already has an account, your applications stay.
        </p>
        <Ticks />
      </Access>
    );
  }
  return <SignInForm notice={notice} signedOut={signedOut} />;
}
