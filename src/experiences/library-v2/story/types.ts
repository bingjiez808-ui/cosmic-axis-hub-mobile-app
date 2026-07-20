/**
 * Guided Library V2 · Story chain — types.
 *
 * DEMO ONLY. None of these types touch V1 tables directly. When cloud
 * mode is enabled, the repository maps this shape onto the `v2_*` tables
 * defined in supabase/pending/20260720_library_v2.sql.
 */

export type StoryTopic = "career" | "love" | "wealth" | "recent";
export type AgeBand = "18-24" | "25-29" | "30-34" | "35-39" | "40-49" | "50+";
export type Gender = "female" | "male" | "other" | "";

export type StoryStep =
  | "gate"
  | "focus"
  | "intake_name"
  | "intake_birth"
  | "intake_place"
  | "first_insight"
  | "shelf"
  | "book"
  | "history"
  | "figure"
  | "recommendations"
  | "notes"
  | "note_compose"
  | "note_detail";

export interface ReaderProfile {
  nickname: string;
  gender: Gender;
  age_band: AgeBand | null;
  birth_year: string; // YYYY  (Demo: derived to age_band; raw stays local)
  birth_date: string; // YYYY-MM-DD
  birth_time: string; // HH:MM
  time_unknown: boolean;
  place: string;
  topic: StoryTopic | null;
  matching_opt_in: boolean;
}

export interface StoryStateV1 {
  version: 1;
  step: StoryStep;
  profile: ReaderProfile;
  active_book: BookRef | null;
  active_figure_id: string | null;
  active_note_id: string | null;
  read_books: BookRef[];
  saved_items: SavedItem[];
  history_filter: HistoryFilter;
  reading_history: ReadingEvent[];
  /**
   * Per-topic weight nudged by the "像我 / 不太像 / 想继续了解" buttons
   * under the first insight. Reweights local recommendation order only.
   * No AI or facts pipeline is invoked when this changes.
   */
  feedback_weights: Partial<Record<StoryTopic, number>>;
  /**
   * Set to the wall-clock millis of the *first* gate visit. Missing on
   * first mount, present on every subsequent one, so the gate can skip
   * the long ceremony animation and greet returning readers.
   */
  first_visit_at: number | null;
}

export type BookRef =
  | "self"
  | "career"
  | "love"
  | "wealth"
  | "timeline"
  | "premium"
  | "sage";

export type HistoryFilter = "all" | "east" | "west" | "different_choice";

export interface SavedItem {
  kind: "figure" | "book" | "note";
  ref: string;
  saved_at: number;
}

export interface ReadingEvent {
  kind: "book_opened" | "figure_opened" | "note_opened" | "recommendation_clicked";
  ref: string;
  topic?: StoryTopic;
  at: number;
}

export type NoteAudience =
  | "similar" // 同页者
  | "opposite" // 对页者
  | "experienced" // 经历过这件事的人
  | "librarian"; // 交给图书馆选择

export interface Note {
  id: string;
  author_id: string;
  author_nickname: string;
  topic: StoryTopic;
  body: string;
  image_data_url: string | null; // Demo: local blob, never uploaded
  audience: NoteAudience;
  status: "active" | "reported" | "removed";
  match_traits: string[]; // abstract only — never raw chart
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

export interface NoteReply {
  id: string;
  note_id: string;
  author_id: string;
  author_nickname: string;
  faced: string;
  chose: string;
  cost: string;
  if_again: string;
  one_consideration: string;
  status: "active" | "reported" | "removed";
  created_at: number;
  deleted_at: number | null;
}

export interface HistoricalFigure {
  id: string;
  name: string;
  tradition: "east" | "west";
  age_band: AgeBand;
  topics: StoryTopic[];
  situation: string;
  choice: string;
  outcome: string;
  cost: string;
  transferable: string;
  source_title: string;
  source_url: string;
  warning: string;
  different_choice: boolean;
}

export interface Insight {
  headline: string;
  why: string;
  next: string;
  when: string;
}

export interface RecommendedItem {
  id: string;
  kind: "book" | "figure" | "note";
  ref: string;
  title: string;
  reason: string;
  topic: StoryTopic;
}
