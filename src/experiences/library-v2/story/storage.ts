/**
 * Guided Library V2 · Story chain — versioned local persistence.
 *
 * Demo data is per-browser only. When the schema version changes, the
 * old blob is dropped rather than migrated, because the Demo does not
 * carry account-critical state.
 */
import type { Note, NoteReply, StoryStateV1 } from "./types";
import { INITIAL_STORY_STATE } from "./state";
import { seedNotes } from "./fixtures";

const STORY_KEY = "lod:library-v2:story-state:v1";
const NOTES_KEY = "lod:library-v2:notes:v1";
const REPLIES_KEY = "lod:library-v2:replies:v1";
const ACTIONS_KEY = "lod:library-v2:actions:v1";

interface Persisted<T> {
  version: 1;
  value: T;
}

function safeRead<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Persisted<T>;
    if (parsed.version !== 1) return null;
    return parsed.value;
  } catch {
    return null;
  }
}

function safeWrite<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    const payload: Persisted<T> = { version: 1, value };
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // ignore quota errors — Demo state is disposable
  }
}

export function loadStoryState(): StoryStateV1 {
  const raw = safeRead<StoryStateV1>(STORY_KEY);
  if (!raw) return { ...INITIAL_STORY_STATE };
  return { ...INITIAL_STORY_STATE, ...raw };
}

export function saveStoryState(state: StoryStateV1): void {
  safeWrite(STORY_KEY, state);
}

export function clearStoryState(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORY_KEY);
  window.localStorage.removeItem(NOTES_KEY);
  window.localStorage.removeItem(REPLIES_KEY);
  window.localStorage.removeItem(ACTIONS_KEY);
}

export function loadNotes(now: number): Note[] {
  const raw = safeRead<Note[]>(NOTES_KEY);
  if (raw && Array.isArray(raw)) return raw;
  const seeded = seedNotes(now);
  safeWrite(NOTES_KEY, seeded);
  return seeded;
}

export function saveNotes(notes: Note[]): void {
  safeWrite(NOTES_KEY, notes);
}

export function loadReplies(): NoteReply[] {
  return safeRead<NoteReply[]>(REPLIES_KEY) ?? [];
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
  return safeRead<NoteAction[]>(ACTIONS_KEY) ?? [];
}

export function saveActions(a: NoteAction[]): void {
  safeWrite(ACTIONS_KEY, a);
}
