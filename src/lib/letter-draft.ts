/**
 * Local draft persistence for the community writing desk.
 * Keeps the traveler's unsent letter safe across accidental refreshes,
 * tab closes, or navigation away. Browser-only; never touches the server.
 */

const KEY = "hall.letter.draft.v1";

export type LetterDraft = {
  step: 1 | 2 | 3;
  subject: string;
  body: string;
  topic: string;
  band: string | null;
  savedAt: number;
};

function hasStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}

export function loadLetterDraft(): LetterDraft | null {
  if (!hasStorage()) return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LetterDraft>;
    if (typeof parsed?.body !== "string") return null;
    // Drafts older than 14 days are dropped rather than resurrected.
    if (typeof parsed.savedAt === "number" && Date.now() - parsed.savedAt > 14 * 864e5) {
      window.localStorage.removeItem(KEY);
      return null;
    }
    return {
      step: parsed.step === 2 || parsed.step === 3 ? parsed.step : 1,
      subject: typeof parsed.subject === "string" ? parsed.subject : "",
      body: parsed.body,
      topic: typeof parsed.topic === "string" ? parsed.topic : "self",
      band: typeof parsed.band === "string" ? parsed.band : null,
      savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

export function saveLetterDraft(draft: Omit<LetterDraft, "savedAt">): number | null {
  if (!hasStorage()) return null;
  const savedAt = Date.now();
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...draft, savedAt }));
    notifyDraftChange();
    return savedAt;
  } catch {
    return null;
  }
}

export function clearLetterDraft() {
  if (!hasStorage()) return;
  try {
    window.localStorage.removeItem(KEY);
    notifyDraftChange();
  } catch {
    /* storage disabled — nothing to clear */
  }
}

/* ── Live subscription ──────────────────────────────────────────
 * Lets quiet UI (the courier progress strip) mirror the writing desk
 * without polling: same-tab writes fire a custom event, other tabs
 * arrive through the native `storage` event.
 */

const EVENT = "hall:letter-draft";

function notifyDraftChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EVENT));
}

export function subscribeLetterDraft(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (!e.key || e.key === KEY) onChange();
  };
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}
