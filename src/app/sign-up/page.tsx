"use client";

import { useActionState, useState } from "react";
import { signUp, type SignUpFormState } from "./actions.ts";

const initialState: SignUpFormState = {};

function fieldMessage(error: NonNullable<SignUpFormState["error"]>): string {
  if (error.code === "EMAIL_TAKEN") return "This email already has an account.";
  if (error.message === "Password must be at least 10 characters") {
    return "Use at least 10 characters. Nothing was created.";
  }
  return error.message;
}

export default function SignUpPage() {
  const [state, action, pending] = useActionState(signUp, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const fieldKey = state.id ?? "draft";
  const serverPassword = state.password ?? "";
  const [draft, setDraft] = useState({ id: fieldKey, value: serverPassword });
  const passwordValue = draft.id === fieldKey ? draft.value : serverPassword;
  const emailError =
    state.error &&
    (state.error.code === "EMAIL_TAKEN" || (state.email ?? "").trim() === "")
      ? state.error
      : undefined;
  const passwordError = state.error && !emailError ? state.error : undefined;
  const showLatch = passwordValue.length > 0 && !pending;

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
        <div className="column">
          <h1>Create account</h1>
          <form className="account" action={action}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <div
                className={`well${emailError ? " error" : ""}${pending ? " pending" : ""}`}
              >
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
                  aria-invalid={emailError ? true : undefined}
                  aria-describedby={emailError ? "email-error" : undefined}
                />
              </div>
              {emailError ? (
                <p id="email-error" className="error" role="alert">
                  {fieldMessage(emailError)}
                </p>
              ) : null}
            </div>
            <div className="field">
              <div className="label-row">
                <label htmlFor="password">Password</label>
                {passwordError ? null : (
                  <span id="password-hint">10 characters</span>
                )}
              </div>
              <div
                className={`well${passwordError ? " error" : ""}${pending ? " pending" : ""}`}
              >
                <span className="inlay" aria-hidden="true" />
                <input
                  key={`${fieldKey}-password`}
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  defaultValue={passwordValue}
                  required
                  disabled={pending}
                  aria-invalid={passwordError ? true : undefined}
                  aria-describedby={
                    passwordError ? "password-error" : "password-hint"
                  }
                  onChange={(event) =>
                    setDraft({ id: fieldKey, value: event.target.value })
                  }
                />
                {showLatch ? (
                  <button
                    type="button"
                    className="show"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    onClick={() => setShowPassword((current) => !current)}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                ) : null}
              </div>
              {passwordError ? (
                <p id="password-error" className="error" role="alert">
                  {fieldMessage(passwordError)}
                </p>
              ) : null}
            </div>
            <button className="primary" type="submit" disabled={pending}>
              {pending ? "Creating account" : "Create account"}
              {pending ? (
                <span className="ticks" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
              ) : null}
            </button>
          </form>
          <p className="alternate">
            <span>Already have an account?</span>
            <a href="/sign-in">Sign in instead</a>
          </p>
          <div className="providers">
            <form className="provider" action="/sign-in/google" method="get">
              <button type="submit">
                <span className="provider-title">Continue with Google</span>
                <span className="provider-note">
                  Read Gmail for applications
                </span>
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
            <form className="provider" action="/sign-in/microsoft" method="get">
              <button type="submit">
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
                />
                <span className="bolt" aria-hidden="true" />
              </label>
            </form>
            <p className="leave">
              Leave these off to sign in without reading mail.
            </p>
          </div>
          {state.createdEmail ? (
            <p className="status" role="status">
              Account created for {state.createdEmail}.
            </p>
          ) : null}
        </div>
      </main>
      <style>{`
        .access { display: flex; flex-direction: column; min-height: 100vh; }
        .wall, .desk, .column, .field, .well, .label-row, .provider, .latch { box-sizing: border-box; }
        .wall {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          padding: 1.5rem 1rem;
          background: var(--timber);
          color: var(--on-timber);
        }
        .mark, .place, .privacy { margin: 0; }
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
        form.account { display: flex; flex-direction: column; gap: 18px; margin: 0; }
        .field { display: flex; flex-direction: column; gap: 8px; }
        .label-row { display: flex; justify-content: space-between; gap: 8px; }
        label, #password-hint { font-size: 14px; line-height: 19px; }
        label { font-weight: 500; color: var(--espresso); }
        #password-hint { color: var(--mute); }
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
        .well.pending .inlay { background: transparent; }
        .well:focus-within:not(.error):not(.pending) .inlay { background: var(--hearth); }
        .well input {
          width: 0; /* shrink so Show stays clickable */
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
        .ticks span { width: 4px; background: var(--on-hearth); border-radius: 1px; }
        .ticks span:nth-child(odd) { height: 8px; }
        .ticks span:nth-child(2) { height: 14px; }
        .alternate {
          display: flex;
          align-items: center;
          gap: 8px;
          min-height: 44px;
          margin: 0;
          color: var(--mute);
          font-size: 15px;
          line-height: 20px;
        }
        .alternate a { color: var(--hearth); font-weight: 500; }
        .error { margin: 0; color: var(--error-ink); font-size: 14px; line-height: 19px; }
        .status { margin: 0; color: var(--espresso); }
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
          text-align: left;
          cursor: pointer;
        }
        form.provider button {
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
        .leave { margin: 0; color: var(--mute); font-size: 13px; line-height: 18px; }
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
