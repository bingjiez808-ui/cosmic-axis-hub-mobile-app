import type { ReactNode } from "react";

/**
 * Central place for legal / contact constants.
 * Update these values here to propagate across every legal page.
 */
export const LEGAL_CONTACT = {
  effectiveDate: "2026-07-16",
  entityName: "Serena Zhang, operating as Fate Nexus Studio",
  email: "fatenexus.studio@gmail.com",
  privacyEmail: "fatenexus.studio@gmail.com",
  siteUrl: "https://fate-nexus-ai.lovable.app",
} as const;

export const legalCanonical = (path: string) => `${LEGAL_CONTACT.siteUrl}${path}`;

/**
 * Render a text line, turning any occurrence of `email` into a mailto anchor.
 */
export function renderWithMailto(line: string, email: string): ReactNode {
  const idx = line.indexOf(email);
  if (idx === -1) return line;
  const before = line.slice(0, idx);
  const after = line.slice(idx + email.length);
  return (
    <>
      {before}
      <a
        href={`mailto:${email}`}
        className="text-gold-dust underline decoration-gold-dust/40 underline-offset-2 hover:text-gold-light"
      >
        {email}
      </a>
      {after}
    </>
  );
}
