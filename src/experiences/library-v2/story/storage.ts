/**
 * Guided Library V2 · Story chain — versioned local persistence.
 *
 * Demo data is per-browser only. When the envelope version bumps we run
 * a lossless migration in memory rather than dropping the blob, so
 * returning readers keep their nickname, saved items and reading
 * history without ever being asked to clear cache.
 */
import type { Note, NoteReply, StoryStateV1, StoryStep } from "./types";
import { INITIAL_STORY_STATE } from "./state";
import { seedNotes } from "./fixtures";

const STORY_KEY = "lod:library-v2:story-state:v1";
const NOTES_KEY = "lod:library-v2:notes:v1";
const REPLIES_KEY = "lod:library-v2:replies:v1";
const ACTIONS_KEY = "lod:library-v2:actions:v1";

/** Current envelope version. Bump on breaking shape changes and add a
 *  migration branch in `migrateStory` — never drop the persisted blob. */
export const STORY_STATE_VERSION = 2 as const;

interface Persisted<T> {
  version: number;
  value: T;
}

function safeReadEnvelope<T>(key: string): Persisted<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Persisted<T>;
    if (typeof parsed !== "object" || parsed === null) return null;
    if (typeof parsed.version !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function safeRead<T>(key: string, expected: number): T | null {
  const env = safeReadEnvelope<T>(key);
  if (!env) return null;
  if (env.version !== expected) return null;
  return env.value;
}

function safeWrite<T>(key: string, value: T, version = 1): void {
  if (typeof window === "undefined") return;
  try {
    const payload: Persisted<T> = { version, value };
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // ignore quota errors — Demo state is disposable
  }
}

/**
 * Bring an old-shape story blob forward without asking the reader to
 * clear cache. Every branch here documents the exact real-world state
 * it repairs:
 *   - `step === "focus"` (v1 destiny picker before intake) → send the
 *     reader back into intake if the profile is still empty, or
 *     forward into the panorama tour if intake was already completed.
 *   - `step === "first_insight"` (v1 first-insight screen after intake)
 *     → forward into the panorama tour, which now replaces it.
 *   - `panorama.selected_domain === "recent"` (never a real domain in
 *     v2) → normalise to `"overview"`. The map's "当下与变化" node was
 *     removed; timing lives inside each domain and the timeline now.
 */
function migrateStory(raw: Record<string, unknown>): StoryStateV1 {
  const merged = { ...INITIAL_STORY_STATE, ...(raw as Partial<StoryStateV1>) };

  const step = merged.step as StoryStep;
  const hasIntake =
    !!merged.profile?.nickname
    && !!merged.profile?.birth_date
    && !!merged.profile?.place;

  let nextStep: StoryStep = step;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((step as any) === "focus") {
    nextStep = hasIntake ? "panorama_entry" : (merged.profile.nickname ? "intake_birth" : "intake_name");
  } else if (step === "first_insight") {
    nextStep = "panorama_entry";
  }

  // Normalise old panorama sub-state.
  const pano = merged.panorama ?? {
    selected_domain: null,
    tour_completed_at: null,
    nav_position: null,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sd = (pano.selected_domain as any) ?? null;
  const normalizedDomain =
    sd === "recent" ? "overview" : sd;

  return {
    ...merged,
    version: STORY_STATE_VERSION,
    step: nextStep,
    panorama: {
      selected_domain: normalizedDomain,
      tour_completed_at: pano.tour_completed_at ?? null,
      nav_position: pano.nav_position ?? null,
    },
  };
}

export function loadStoryState(): StoryStateV1 {
  const env = safeReadEnvelope<StoryStateV1>(STORY_KEY);
  if (!env) return { ...INITIAL_STORY_STATE };
  const migrated = migrateStory(env.value as unknown as Record<string, unknown>);
  // Persist migration eagerly so the next read is on the new shape.
  if (env.version !== STORY_STATE_VERSION) {
    safeWrite(STORY_KEY, migrated, STORY_STATE_VERSION);
  }
  return migrated;
}

export function saveStoryState(state: StoryStateV1): void {
  safeWrite(STORY_KEY, state, STORY_STATE_VERSION);
}

export function clearStoryState(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORY_KEY);
  window.localStorage.removeItem(NOTES_KEY);
  window.localStorage.removeItem(REPLIES_KEY);
  window.localStorage.removeItem(ACTIONS_KEY);
}

export function loadNotes(now: number): Note[] {
  const raw = safeRead<Note[]>(NOTES_KEY, 1);
  if (raw && Array.isArray(raw)) return raw;
  const seeded = seedNotes(now);
  safeWrite(NOTES_KEY, seeded);
  return seeded;
}

export function saveNotes(notes: Note[]): void {
  safeWrite(NOTES_KEY, notes);
}

export function loadReplies(): NoteReply[] {
  return safeRead<NoteReply[]>(REPLIES_KEY, 1) ?? [];
}

export function saveReplies(rs: NoteReply[]): void {
  safeWrite(REPLIES_KEY, rs);
}

export interface NoteAction {
  id: string;
  actor_id: string;
  target_kind: "note" | "reply";
  target_id: string;
  kind: "save" | "report";
  created_at: number;
}

export function loadActions(): NoteAction[] {
  return safeRead<NoteAction[]>(ACTIONS_KEY, 1) ?? [];
}

export function saveActions(a: NoteAction[]): void {
  safeWrite(ACTIONS_KEY, a);
}
