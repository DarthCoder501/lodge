"use client";

import { useActionState, useState } from "react";
import { signIn, signOutAction, type SignInFormState } from "./actions.ts";

const initialState: SignInFormState = {};

function SignInForm() {
  const [state, action, pending] = useActionState(signIn, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const fieldKey = state.id ?? "draft";
  const error = state.error;

  return (
    <>
      <h1>Sign in</h1>
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
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "sign-in-error" : undefined}
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <div className="password-row">
            <input
              key={`${fieldKey}-password`}
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              defaultValue={state.password ?? ""}
              required
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "sign-in-error" : undefined}
            />
            <button type="button" onClick={() => setShowPassword((current) => !current)}>
              {showPassword ? "Hide password" : "Show password"}
            </button>
          </div>
          {error ? (
            <p id="sign-in-error" role="alert">
              {error.code}. {error.message}
            </p>
          ) : null}
        </div>
        <button type="submit" disabled={pending}>
          {pending ? "Signing in" : "Sign in"}
        </button>
      </form>
    </>
  );
}

function SignedIn({ email }: { email: string }) {
  const [, action, pending] = useActionState(signOutAction, undefined);

  return (
    <>
      <h1>Signed in</h1>
      <p role="status">Signed in as {email}.</p>
      <form action={action}>
        <button type="submit" disabled={pending}>
          {pending ? "Signing out" : "Sign out"}
        </button>
      </form>
    </>
  );
}

export function SignInScreen({ email }: { email?: string }) {
  return (
    <main className="sign-in">
      {email ? <SignedIn email={email} /> : <SignInForm />}
      <style>{`
        .sign-in {
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
        .sign-in *, .sign-in *::before, .sign-in *::after { box-sizing: border-box; }
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
        [role="alert"] { margin: 0; color: var(--error); }
        [role="status"] { margin: 0 0 1rem; }
      `}</style>
    </main>
  );
}
