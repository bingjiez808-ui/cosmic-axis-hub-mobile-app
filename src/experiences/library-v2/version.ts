/**
 * Guided Library V2 — isolated experience version.
 *
 * V2 lives entirely under src/experiences/library-v2/ and is only reachable
 * from the DEV-only route /dev/guided-library-v2. It must never write to
 * customer data and must never invoke real AI/payment providers.
 *
 * The V1 marketing/product surface (/, /ritual, /report and the rest of
 * src/routes/*) is intentionally untouched by V2 code.
 */
export const LIBRARY_EXPERIENCE_VERSION = "library-v2-guided-2026-07" as const;

export type LibraryFocus = "career" | "love" | "wealth" | "self" | "unsure";
