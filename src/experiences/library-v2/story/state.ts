/**
 * Guided Library V2 · Story chain — pure state helpers.
 */
import type {
  AgeBand,
  ReaderProfile,
  StoryStateV1,
  StoryStep,
  StoryTopic,
} from "./types";

export const INITIAL_PROFILE: ReaderProfile = {
  nickname: "",
  gender: "",
  age_band: null,
  birth_year: "",
  birth_date: "",
  birth_time: "",
  time_unknown: false,
  place: "",
  topic: null,
  matching_opt_in: true,
};

export const INITIAL_STORY_STATE: StoryStateV1 = {
  version: 1,
  step: "gate",
  profile: INITIAL_PROFILE,
  active_book: null,
  active_figure_id: null,
  active_note_id: null,
  read_books: [],
  saved_items: [],
  history_filter: "all",
  reading_history: [],
  feedback_weights: {},
  first_visit_at: null,
  panorama: {
    selected_domain: null,
    tour_completed_at: null,
    nav_position: null,
  },
};

export const DEMO_PROFILE: ReaderProfile = {
  nickname: "青灯",
  gender: "female",
  age_band: "30-34",
  birth_year: "1993",
  birth_date: "1993-04-18",
  birth_time: "09:20",
  time_unknown: false,
  place: "杭州",
  topic: "career",
  matching_opt_in: true,
};

const INTAKE_ORDER: StoryStep[] = [
  "intake_name",
  "intake_birth",
  "intake_place",
];

export function intakeProgress(
  step: StoryStep,
): { index: number; total: number } | null {
  const i = INTAKE_ORDER.indexOf(step);
  if (i < 0) return null;
  return { index: i + 1, total: INTAKE_ORDER.length };
}

export function isIntakeStepValid(
  step: StoryStep,
  p: ReaderProfile,
): boolean {
  switch (step) {
    case "intake_name":
      return p.nickname.trim().length > 0 && p.gender !== "";
    case "intake_birth":
      // Date required. Time is optional if user checked "unknown".
      if (p.birth_date.trim().length === 0) return false;
      if (p.time_unknown) return true;
      return p.birth_time.trim().length > 0;
    case "intake_place":
      return p.place.trim().length > 0;
    default:
      return false;
  }
}

export function ageBandFromYear(year: string): AgeBand | null {
  const y = Number.parseInt(year, 10);
  if (!Number.isFinite(y) || y < 1900) return null;
  const now = new Date().getUTCFullYear();
  const age = now - y;
  if (age < 18) return "18-24";
  if (age <= 24) return "18-24";
  if (age <= 29) return "25-29";
  if (age <= 34) return "30-34";
  if (age <= 39) return "35-39";
  if (age <= 49) return "40-49";
  return "50+";
}

export function ageBandFromDate(date: string): AgeBand | null {
  const y = date.slice(0, 4);
  return ageBandFromYear(y);
}

export function nextIntakeStep(step: StoryStep): StoryStep {
  if (step === "intake_name") return "intake_birth";
  if (step === "intake_birth") return "intake_place";
  // After the 3-step intake, the reader enters the deterministic Panorama
  // Tour (four-signal overview → recommended first read). The old direct
  // path to `first_insight` is preserved as an internal branch off the
  // panorama for "跳过导览".
  if (step === "intake_place") return "panorama_entry";
  return step;
}

export function prevIntakeStep(step: StoryStep): StoryStep {
  if (step === "intake_place") return "intake_birth";
  if (step === "intake_birth") return "intake_name";
  if (step === "intake_name") return "focus";
  return step;
}

export function topicLabel(t: StoryTopic | "overview"): string {
  return {
    career: "事业",
    love: "情感",
    wealth: "财富",
    recent: "近况",
    overview: "全景",
  }[t];
}

export function topicQuestion(t: StoryTopic | "overview"): string {
  return {
    career: "我这一段路，走对了吗？",
    love: "为什么我总是被同一类人吸引？",
    wealth: "我的钱，为什么总是留不住？",
    recent: "最近发生的事，究竟是提醒还是巧合？",
    overview: "先不选择主题，浏览完整人生地图。",
  }[t];
}

export function topicPersonal(t: StoryTopic | "overview"): string {
  return {
    career:
      "接下来这本书会带你看清：你适合被推举的位置、你无法忍受的组织，以及你上一个岔口错过了什么。",
    love:
      "接下来这本书会带你看清：你重复被吸引的人是什么类型、你需要的其实是什么、以及你为什么总在同一个地方失望。",
    wealth:
      "接下来这本书会带你看清：钱在你身上流动的方式、你与风险的真实关系、以及哪一类财富适合你长期持有。",
    recent:
      "接下来这本书会带你先看清：最近这段的主线是什么、你正在被推着做什么决定、以及哪一个信号最值得回应。",
    overview:
      "接下来这本书会带你先看四体系的整体画像和你现在所处的时间段，再由你决定往哪一章深入。",
  }[t];
}
