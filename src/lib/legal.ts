/**
 * Central place for legal / contact placeholders.
 * Replace these once before public launch — every legal page references them.
 */
export const LEGAL_CONTACT = {
  effectiveDate: "2026-07-16",
  // Displayed prominently on privacy / terms / delete pages until real values
  // are supplied. Do NOT invent an entity name, address or email.
  entityName: "[上线前补充法律主体 · Legal entity to be added before launch]",
  address: "[上线前补充地址 · Postal address to be added before launch]",
  email: "[上线前补充联系邮箱 · contact email to be added before launch]",
  privacyEmail: "[上线前补充联系邮箱 · privacy contact email to be added before launch]",
  siteUrl: "https://fate-nexus-ai.lovable.app",
} as const;

export const legalCanonical = (path: string) => `${LEGAL_CONTACT.siteUrl}${path}`;
