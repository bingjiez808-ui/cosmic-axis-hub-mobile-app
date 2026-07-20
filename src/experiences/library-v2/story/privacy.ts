/**
 * Guided Library V2 · Story chain — public serialization.
 *
 * The public payload of a note MUST NEVER contain raw birth data, city,
 * gender, or any chart JSON. This helper enforces that at serialize time.
 * All V2 tables that face the public (`v2_notes`, `v2_note_match_traits`,
 * `v2_note_replies`) get their public representation through this file.
 */
import type { Note, NoteReply, ReaderProfile } from "./types";

const FORBIDDEN_KEYS = [
  "birth_date",
  "birth_time",
  "birth_year",
  "place",
  "gender",
  "chart",
  "chart_id",
  "chart_json",
];

export interface PublicNote {
  id: string;
  author_nickname: string;
  topic: Note["topic"];
  body: string;
  image_data_url: string | null;
  audience: Note["audience"];
  match_traits: string[];
  created_at: number;
}

export interface PublicReply {
  id: string;
  note_id: string;
  author_nickname: string;
  faced: string;
  chose: string;
  cost: string;
  if_again: string;
  one_consideration: string;
  created_at: number;
}

export function toPublicNote(n: Note): PublicNote {
  const out: PublicNote = {
    id: n.id,
    author_nickname: n.author_nickname,
    topic: n.topic,
    body: n.body,
    image_data_url: n.image_data_url,
    audience: n.audience,
    match_traits: [...n.match_traits],
    created_at: n.created_at,
  };
  assertNoBirthLeak(out);
  return out;
}

export function toPublicReply(r: NoteReply): PublicReply {
  const out: PublicReply = {
    id: r.id,
    note_id: r.note_id,
    author_nickname: r.author_nickname,
    faced: r.faced,
    chose: r.chose,
    cost: r.cost,
    if_again: r.if_again,
    one_consideration: r.one_consideration,
    created_at: r.created_at,
  };
  assertNoBirthLeak(out);
  return out;
}

export function assertNoBirthLeak(payload: unknown): void {
  const blob = JSON.stringify(payload).toLowerCase();
  for (const key of FORBIDDEN_KEYS) {
    if (blob.includes(`"${key}"`)) {
      throw new Error(`v2_privacy_leak: public payload contains ${key}`);
    }
  }
}

/** Nickname is the ONLY reader-supplied identifier that reaches other users. */
export function readerPublicNickname(p: ReaderProfile): string {
  const n = p.nickname.trim();
  if (!n) return "匿名读者";
  return n.slice(0, 20);
}
