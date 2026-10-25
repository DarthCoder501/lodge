"use client";

import { useActionState, useState } from "react";
import { signUp, type SignUpFormState } from "./actions.ts";

const initialState: SignUpFormState = {};

export default function SignUpPage() {
  const [state, action, pending] = useActionState(signUp, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const fieldKey = state.id ?? "draft";
  const emailError =
    state.error && (state.error.code === "EMAIL_TAKEN" || (state.email ?? "").trim() === "")
      ? state.error
      : undefined;
  const passwordError = state.error && !emailError ? state.error : undefined;

  return (
    <main className="sign-up">
      <h1>Create account</h1>
      <form action={action}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            key={`${fieldKey}-email`}
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={state.email ?? ""}
            required
            aria-invalid={emailError ? true : undefined}
            aria-describedby={emailError ? "email-error" : undefined}
          />
          {emailError ? (
            <p id="email-error" role="alert">
              {emailError.code}. {emailError.message}
            </p>
          ) : null}
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <div className="password-row">
            <input
              key={`${fieldKey}-password`}
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              defaultValue={state.password ?? ""}
              required
              aria-invalid={passwordError ? true : undefined}
              aria-describedby={passwordError ? "password-error" : "password-hint"}
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
            >
              {showPassword ? "Hide password" : "Show password"}
            </button>
          </div>
          {passwordError ? (
            <p id="password-error" role="alert">
              {passwordError.code}. {passwordError.message}
            </p>
          ) : (
            <p id="password-hint">At least 10 characters.</p>
          )}
        </div>
        <button type="submit" disabled={pending}>
          {pending ? "Creating account" : "Create account"}
        </button>
      </form>
      {state.createdEmail ? (
        <p role="status">Account created for {state.createdEmail}.</p>
      ) : null}
      <style>{`
        .sign-up {
          box-sizing: border-box;
          max-width: 24rem;
          margin: 0 auto;
          padding: 1rem;
          color: var(--ink);
          background: var(--paper);
          font-size: 1rem;
          line-height: 1.5;
          min-height: 100vh;
        }
        .sign-up *, .sign-up *::before, .sign-up *::after { box-sizing: border-box; }
        h1 {
          font-family: var(--font-display), serif;
          font-size: 1.75rem;
          font-weight: 500;
          margin: 0 0 1rem;
        }
        form {
          display: grid;
          gap: 0.75rem;
          padding: 1rem;
          background: var(--card);
          border: 1px solid var(--line);
          border-radius: 2px;
        }
        .field { display: grid; gap: 0.25rem; }
        label { font-weight: 600; }
        input {
          width: 100%;
          min-height: 44px;
          padding: 0.5rem;
          border: 1px solid var(--line);
          border-radius: 2px;
          font: inherit;
          color: inherit;
          background: var(--card);
        }
        .password-row { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: stretch; }
        .password-row input { flex: 1 1 12rem; min-width: 0; }
        button {
          min-height: 44px;
          min-width: 44px;
          padding: 0.5rem 1rem;
          border-radius: 2px;
          font: inherit;
          cursor: pointer;
        }
        button[type="submit"] {
          border: 0;
          background: var(--wood);
          color: #fff;
        }
        button[type="button"] {
          background: var(--card);
          color: var(--ink);
          border: 1px solid var(--line);
        }
        @media (prefers-reduced-motion: no-preference) {
          button { transition: background-color 150ms ease; }
        }
        button[type="submit"]:hover { background: var(--wood-pressed); }
        button:focus-visible, input:focus-visible {
          outline: 2px solid var(--wood);
          outline-offset: 2px;
        }
        #password-hint { margin: 0; color: var(--pencil); }
        [role="alert"] { margin: 0; color: var(--error); }
        [role="status"] { margin: 1rem 0 0; }
      `}</style>
    </main>
  );
}
