import { BRAND } from '@gramify/shared';
import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Logo, ThemeToggle } from '../components/TopBar';
import { useAppConfig } from '../lib/auth';

function Shell({ title, children }: { title: string; children: ReactNode }) {
  const config = useAppConfig();
  const contact = config.data?.contactEmail;
  useEffect(() => {
    document.title = `${title} · ${BRAND.name}`;
  }, [title]);
  return (
    <div className="min-h-full bg-bg">
      <header className="flex h-12 items-center justify-between border-b border-border bg-surface px-4">
        <Logo />
        <ThemeToggle />
      </header>
      <main className="mx-auto max-w-2xl px-4 py-10 text-sm leading-6 [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:my-3">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-muted">Last updated: November 1, 2026</p>
        {children}
        <h2>Contact</h2>
        <p>
          {contact ? (
            <>
              Questions or requests:{' '}
              <a className="text-accent underline" href={`mailto:${contact}`}>
                {contact}
              </a>
              .
            </>
          ) : (
            <>Questions or requests: contact the administrator of this {BRAND.name} instance.</>
          )}
        </p>
        <p className="mt-10 text-muted">
          <Link to="/privacy" className="hover:text-accent">
            Privacy policy
          </Link>{' '}
          ·{' '}
          <Link to="/terms" className="hover:text-accent">
            Terms of service
          </Link>{' '}
          ·{' '}
          <Link to="/" className="hover:text-accent">
            Back to {BRAND.name}
          </Link>
        </p>
      </main>
    </div>
  );
}

export function PrivacyPage() {
  const n = BRAND.name;
  return (
    <Shell title="Privacy policy">
      <p>
        {n} is a collaborative diagram editor. This page explains what information it stores when
        you use it and why.
      </p>
      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Your Google account basics:</strong> when you sign in with Google we receive your
          name, email address and profile picture. We use them to identify you, show who is editing
          a board, and let board owners share boards with you by email. We do not receive your
          Google password and do not access any other Google data (no Gmail, Drive or Contacts).
        </li>
        <li>
          <strong>Your content:</strong> the diagrams you create or edit, their titles, folders,
          version history, and the list of people a board is shared with.
        </li>
        <li>
          <strong>Activity needed for the product to work:</strong> which boards you opened recently
          or starred, and a session cookie that keeps you signed in. While a board is open, your
          cursor position and selection are shared live with the other people on that board.
        </li>
      </ul>
      <h2>How it is used and shared</h2>
      <p>
        Your information is used only to run {n}. A board is visible only to its owner and the
        people the owner adds. We do not sell your data, show ads, or share it with third parties,
        apart from the hosting provider that runs the servers and database on our behalf.
      </p>
      <h2>Cookies</h2>
      <p>
        {n} uses a single sign-in session cookie. It does not use advertising or analytics cookies.
      </p>
      <h2>Retention and deletion</h2>
      <p>
        Your data is kept while your account exists. You can delete your boards at any time (they
        move to the trash and can then be deleted forever). To delete your account and everything
        you own, contact us using the address below.
      </p>
      <h2>Exports</h2>
      <p>
        Using “mermaid.live” from the editor opens a copy of a diagram on the public mermaid.live
        website; nothing is sent there unless you choose that option.
      </p>
    </Shell>
  );
}

export function TermsPage() {
  const n = BRAND.name;
  return (
    <Shell title="Terms of service">
      <p>By signing in to {n} you agree to these terms.</p>
      <h2>Your content</h2>
      <p>
        You own the diagrams you create. You are responsible for what you put in them and for whom
        you share them with. Owners decide who can view or edit their boards and can remove access
        at any time.
      </p>
      <h2>Acceptable use</h2>
      <ul>
        <li>
          Don’t use {n} for anything unlawful, or to store content you don’t have the right to
          share.
        </li>
        <li>
          Don’t try to access boards that weren’t shared with you or disrupt the service for others.
        </li>
      </ul>
      <h2>Availability</h2>
      <p>
        {n} is provided “as is”, without warranties. We may change or stop the service and will try
        to give notice so you can export your diagrams (PNG, SVG or .mmd) first.
      </p>
      <h2>Accounts</h2>
      <p>
        We may suspend accounts that break these terms. You can stop using {n} at any time and ask
        for your data to be deleted.
      </p>
    </Shell>
  );
}
