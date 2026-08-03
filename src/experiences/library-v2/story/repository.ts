/**
 * Guided Library V2 · Story chain — repository layer.
 *
 * The UI never talks to storage or Supabase directly; it goes through
 * this repository. In Demo mode ('fixture'), the backend is the local
 * storage helpers. When the pending migration is executed and cloud
 * mode is enabled, this file is the single seam that maps onto the
 * `v2_*` tables. All public serialization goes through `privacy.ts`.
 */
import { assertNoBirthLeak, toPublicNote, toPublicReply } from "./privacy";
import {
  loadActions,
  loadNotes,
  loadReplies,
  saveActions,
  saveNotes,
  saveReplies,
  type NoteAction,
} from "./storage";
import type { Note, NoteReply, ReaderProfile, StoryTopic } from "./types";
import { noteTraitsFor } from "./matching";

export type BackendMode = "fixture";
export const BACKEND_MODE: BackendMode = "fixture";

function randomId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}

export function listNotes(now: number): Note[] {
  return loadNotes(now).filter((n) => n.deleted_at === null);
}

export function getNote(id: string): Note | null {
  const now = Date.now();
  return loadNotes(now).find((n) => n.id === id) ?? null;
}

export interface CreateNoteInput {
  author_id: string;
  author_nickname: string;
  topic: StoryTopic;
  body: string;
  image_data_url: string | null;
  audience: Note["audience"];
  age_band: ReaderProfile["age_band"];
}

export function createNote(input: CreateNoteInput): Note {
  const now = Date.now();
  const traits = noteTraitsFor(input.topic, input.audience, input.age_band);
  const note: Note = {
    id: randomId("note"),
    author_id: input.author_id,
    author_nickname: input.author_nickname.slice(0, 20) || "匿名读者",
    topic: input.topic,
    body: input.body.trim(),
    image_data_url: input.image_data_url,
    audience: input.audience,
    status: "active",
    match_traits: traits,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
  // Guard the public serialization path at creation time.
  assertNoBirthLeak(toPublicNote(note));
  const notes = loadNotes(now);
  notes.unshift(note);
  saveNotes(notes);
  return note;
}

export function softDeleteNote(id: string, actorId: string): boolean {
  const now = Date.now();
  const notes = loadNotes(now);
  const idx = notes.findIndex((n) => n.id === id);
  if (idx < 0) return false;
  if (notes[idx].author_id !== actorId) return false;
  notes[idx] = { ...notes[idx], deleted_at: now, status: "removed" };
  saveNotes(notes);
  return true;
}

export function restoreNote(id: string, actorId: string): boolean {
  const now = Date.now();
  const notes = loadNotes(now);
  const idx = notes.findIndex((n) => n.id === id);
  if (idx < 0) return false;
  if (notes[idx].author_id !== actorId) return false;
  notes[idx] = { ...notes[idx], deleted_at: null, status: "active", updated_at: now };
  saveNotes(notes);
  return true;
}

export function listReplies(noteId: string): NoteReply[] {
  return loadReplies().filter(
    (r) => r.note_id === noteId && r.deleted_at === null,
  );
}

export interface CreateReplyInput {
  note_id: string;
  author_id: string;
  author_nickname: string;
  faced: string;
  chose: string;
  cost: string;
  if_again: string;
  one_consideration: string;
}

export function createReply(input: CreateReplyInput): NoteReply {
  const now = Date.now();
  const reply: NoteReply = {
    id: randomId("reply"),
    note_id: input.note_id,
    author_id: input.author_id,
    author_nickname: input.author_nickname.slice(0, 20) || "匿名读者",
    faced: input.faced.trim(),
    chose: input.chose.trim(),
    cost: input.cost.trim(),
    if_again: input.if_again.trim(),
    one_consideration: input.one_consideration.trim(),
    status: "active",
    created_at: now,
    deleted_at: null,
  };
  assertNoBirthLeak(toPublicReply(reply));
  const list = loadReplies();
  list.push(reply);
  saveReplies(list);
  return reply;
}

export function softDeleteReply(id: string, actorId: string): boolean {
  const list = loadReplies();
  const idx = list.findIndex((r) => r.id === id);
  if (idx < 0) return false;
  if (list[idx].author_id !== actorId) return false;
  list[idx] = { ...list[idx], deleted_at: Date.now(), status: "removed" };
  saveReplies(list);
  return true;
}

export function restoreReply(id: string, actorId: string): boolean {
  const list = loadReplies();
  const idx = list.findIndex((r) => r.id === id);
  if (idx < 0) return false;
  if (list[idx].author_id !== actorId) return false;
  list[idx] = { ...list[idx], deleted_at: null, status: "active" };
  saveReplies(list);
  return true;
}

export function toggleAction(
  actorId: string,
  targetKind: NoteAction["target_kind"],
  targetId: string,
  kind: NoteAction["kind"],
): boolean {
  const list = loadActions();
  const existing = list.findIndex(
    (a) =>
      a.actor_id === actorId
      && a.target_kind === targetKind
      && a.target_id === targetId
      && a.kind === kind,
  );
  if (existing >= 0) {
    list.splice(existing, 1);
    saveActions(list);
    return false;
  }
  list.push({
    id: randomId("act"),
    actor_id: actorId,
    target_kind: targetKind,
    target_id: targetId,
    kind,
    created_at: Date.now(),
  });
  saveActions(list);
  return true;
}

export function listActions(actorId: string): NoteAction[] {
  return loadActions().filter((a) => a.actor_id === actorId);
}
