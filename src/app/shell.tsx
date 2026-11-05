"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { signOutForm } from "./sign-in/actions.ts";

const links = [
  { href: "/applications", label: "Applications" },
  { href: "/mailboxes", label: "Mailboxes" },
  { href: "/account", label: "Account" },
] as const;

export function Shell({
  email,
  children,
}: {
  email: string;
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="lodge">
      <div className="wall">
        <p className="mark">Lodge</p>
        <nav aria-label="Lodge">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              aria-current={pathname === link.href ? "page" : undefined}
            >
              {link.label}
            </a>
          ))}
        </nav>
        <p className="session">{email}</p>
        <form className="sign-out" action={signOutForm}>
          <button type="submit">Sign out</button>
        </form>
      </div>
      <main className="desk">{children}</main>
      <style>{`
        .lodge {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
        }
        .wall {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          box-sizing: border-box;
          padding: 1.25rem 1rem 1rem;
          background: var(--timber);
          color: var(--on-timber);
        }
        .mark, .session { margin: 0; }
        .mark { font-size: 1.25rem; font-weight: 600; }
        .session {
          color: var(--on-timber-mute);
          overflow-wrap: anywhere;
        }
        nav { display: flex; flex-direction: column; gap: 0.5rem; }
        .wall a, .wall button {
          display: flex;
          align-items: center;
          box-sizing: border-box;
          min-height: 44px;
          padding: 0 0.75rem;
          color: var(--on-timber);
          background: transparent;
          border: 0;
          font: inherit;
          text-align: left;
          text-decoration: underline;
          text-underline-offset: 0.2em;
          cursor: pointer;
        }
        .wall a[aria-current="page"] {
          background: var(--hearth);
          color: var(--on-hearth);
          text-decoration: none;
        }
        .wall a:focus-visible, .wall button:focus-visible {
          outline: 2px solid var(--on-timber);
          outline-offset: 2px;
        }
        .sign-out { margin: 0; }
        .desk {
          flex: 1;
          box-sizing: border-box;
          padding: 1.5rem 1rem;
          background: var(--parchment);
          color: var(--timber);
        }
        .desk h1 {
          margin: 0 0 1rem;
          font-size: 1.75rem;
          font-weight: 500;
        }
        @media (min-width: 768px) {
          .lodge { flex-direction: row; }
          .wall { width: 15rem; flex: none; }
          .sign-out { margin-top: auto; }
          .desk { padding: 2rem; }
        }
      `}</style>
    </div>
  );
}
