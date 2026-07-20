/**
 * Pure state helpers for Guided Library V2.
 *
 * Kept as plain functions so the state machine can be unit-tested without
 * mounting React. The route wires these into useState/useReducer.
 */
import type { LibraryFocus } from "./version";
import type { BookKey } from "./fixtures";

export type Step =
  | "home"
  | "card_name"
  | "card_birth"
  | "card_place"
  | "card_confirm"
  | "archive"
  | "library"
  | "book"
  | "premium_note";

export interface BorrowCard {
  name: string;
  birth_date: string; // YYYY-MM-DD (demo — validated only for non-empty)
  birth_time: string; // HH:MM
  place: string;
  gender: "female" | "male" | "other" | "";
}

export interface GuidedState {
  step: Step;
  focus: LibraryFocus | null;
  card: BorrowCard;
  read: Set<BookKey>;
  activeBook: BookKey | null;
  tourSeen: boolean; // in-memory only; the route mirrors to localStorage
  mode: "quick" | "deep";
}

export const INITIAL_STATE: GuidedState = {
  step: "home",
  focus: null,
  card: { name: "", birth_date: "", birth_time: "", place: "", gender: "" },
  read: new Set<BookKey>(),
  activeBook: null,
  tourSeen: false,
  mode: "quick",
};

const CARD_STEPS: Step[] = ["card_name", "card_birth", "card_place", "card_confirm"];

export function cardProgress(step: Step): { index: number; total: number } | null {
  const i = CARD_STEPS.indexOf(step);
  if (i < 0) return null;
  return { index: i + 1, total: CARD_STEPS.length };
}

export function isCardStepValid(step: Step, card: BorrowCard): boolean {
  switch (step) {
    case "card_name":
      return card.name.trim().length > 0;
    case "card_birth":
      return card.birth_date.trim().length > 0 && card.birth_time.trim().length > 0;
    case "card_place":
      return card.place.trim().length > 0 && card.gender !== "";
    case "card_confirm":
      return true;
    default:
      return false;
  }
}

export function nextStep(step: Step): Step {
  const order: Step[] = [
    "home",
    "card_name",
    "card_birth",
    "card_place",
    "card_confirm",
    "archive",
    "library",
  ];
  const i = order.indexOf(step);
  if (i < 0 || i >= order.length - 1) return step;
  return order[i + 1];
}

export function prevStep(step: Step): Step {
  const order: Step[] = [
    "home",
    "card_name",
    "card_birth",
    "card_place",
    "card_confirm",
  ];
  const i = order.indexOf(step);
  if (i <= 0) return "home";
  return order[i - 1];
}
