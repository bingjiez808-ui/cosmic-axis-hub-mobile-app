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
