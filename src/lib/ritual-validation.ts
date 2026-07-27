/**
 * Pure validation helpers for the intake ritual.
 *
 * Extracted so we can unit-test:
 *   - per-field validation (owner, relationship, name, date, time, place, gender)
 *   - dynamic name-step prompt when the chart is for someone else
 *   - "which step is the first missing field" jump target
 *
 * All strings are pre-localized here to keep the UI thin.
 */

export type Lang = "en" | "zh";
export type OwnerRole = "self" | "other" | "";
export type Relationship =
  | "partner"
  | "family"
  | "friend"
  | "colleague"
  | "other"
  | "";
export type Gender = "male" | "female" | "";

export type RitualFieldKey =
  | "owner"
  | "relationship"
  | "name"
  | "date"
  | "time"
  | "gender"
  | "place";

export interface RitualState {
  ownerRole: OwnerRole;
  relationship: Relationship;
  name: string;
  date: string;
  time: string;
  place: string;
  gender: Gender;
  genderChosen: boolean;
}

/** Which step index a given field lives on (ownership=0, then 5 intake steps). */
export const FIELD_STEP: Record<RitualFieldKey, number> = {
  owner: 0,
  relationship: 0,
  name: 1,
  date: 2,
  time: 3,
  gender: 4,
  place: 5,
};

/**
 * The intake step "name" changes meaning based on ownerRole:
 *   - self:  "your birth name"
 *   - other: "a private nickname for THIS other-person chart"
 *
 * For "other" we deliberately do NOT request their real name — only a
 * private note kept in the user's own library.
 */
export function nameStepCopy(
  lang: Lang,
  ownerRole: OwnerRole,
): { prompt: string; hint: string; placeholder: string } {
  if (ownerRole === "other") {
    return lang === "zh"
      ? {
          prompt: "如何称呼这张他人命盘？",
          hint: "只保存在你的个人书架，作为你自己的备注（不必是对方真实姓名）。",
          placeholder: "备注名，例如 「阿舟」「妈妈」",
        }
      : {
          prompt: "How should this other-person chart be labeled?",
          hint: "A private nickname kept only in your library — no need to use their real name.",
          placeholder: "Nickname, e.g. \"A-Zhou\" or \"Mom\"",
        };
  }
  return lang === "zh"
    ? {
        prompt: "这一生被赋予了怎样的名字？",
        hint: "姓名是身份最初的印记。",
        placeholder: "你的本名",
      }
    : {
        prompt: "What name has been given to this life?",
        hint: "The name is the first inscription of identity.",
        placeholder: "Your birth name",
      };
}

function trimStr(v: string) {
  return (v ?? "").trim();
}

/** Validates a single field, returning null when OK or a localized message. */
export function validateField(
  key: RitualFieldKey,
  state: RitualState,
  lang: Lang,
): string | null {
  switch (key) {
    case "owner":
      if (state.ownerRole !== "self" && state.ownerRole !== "other") {
        return lang === "zh"
          ? "请先选择这张命盘属于「我」还是「他人」。"
          : "Please pick whether this chart is for you or someone else.";
      }
      return null;
    case "relationship":
      if (state.ownerRole === "other" && !state.relationship) {
        return lang === "zh"
          ? "请选择你与对方的关系（仅保存在你的个人书架，不通知对方，不公开）。"
          : "Please pick the relationship (kept privately in your library — never notified or public).";
      }
      return null;
    case "name": {
      const raw = trimStr(state.name);
      if (raw.length === 0) {
        return state.ownerRole === "other"
          ? lang === "zh"
            ? "请为这张他人命盘写一个备注名（仅你自己可见）。"
            : "Please add a private nickname for this other-person chart."
          : lang === "zh"
            ? "请为这张命盘写下一个称呼。"
            : "Please write a name for this chart.";
      }
      if (raw.length > 80)
        return lang === "zh" ? "称呼过长（最多 80 字）。" : "Too long (80 characters max).";
      return null;
    }
    case "date": {
      const raw = trimStr(state.date);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(raw))
        return lang === "zh"
          ? "请填写完整的出生日期（YYYY-MM-DD）。"
          : "Please enter a full birth date (YYYY-MM-DD).";
      const d = new Date(raw + "T00:00:00");
      if (Number.isNaN(d.getTime()))
        return lang === "zh" ? "日期无效，请再检查。" : "Invalid date.";
      if (d > new Date())
        return lang === "zh" ? "出生日期不能是未来。" : "Birth date can't be in the future.";
      const year = d.getFullYear();
      if (year < 1900 || year > 2099)
        return lang === "zh" ? "年份需在 1900–2099 之间。" : "Year must be between 1900 and 2099.";
      return null;
    }
    case "time": {
      const raw = trimStr(state.time);
      if (!/^\d{2}:\d{2}$/.test(raw))
        return lang === "zh"
          ? "准确出生时间是生成四体系报告的前提，请填写 HH:MM。"
          : "An accurate birth time is required for the full four-tradition reading. Please enter HH:MM.";
      const [hh, mm] = raw.split(":").map(Number);
      if (hh < 0 || hh > 23 || mm < 0 || mm > 59)
        return lang === "zh" ? "时间无效。" : "Invalid time.";
      return null;
    }
    case "place":
      if (trimStr(state.place).length < 2)
        return lang === "zh"
          ? "请选择或输入可解析的出生地点（国家 + 城市）。"
          : "Please pick or enter a resolvable birth place (country + city).";
      return null;
    case "gender":
      if (!state.genderChosen)
        return lang === "zh"
          ? "请明确选择一项——包含「暂不填写」。这不会被公开显示。"
          : "Please explicitly pick one option — including 'prefer not to say'. This is never shown publicly.";
      return null;
  }
}

/** Validates every field required to submit. Returns the ordered list of misses. */
export function missingFields(state: RitualState, lang: Lang): RitualFieldKey[] {
  const order: RitualFieldKey[] = [
    "owner",
    "relationship",
    "name",
    "date",
    "time",
    "gender",
    "place",
  ];
  return order.filter((k) => validateField(k, state, lang) !== null);
}

/** Step index (0-5) of the first missing field, or -1 when complete. */
export function firstMissingStep(state: RitualState, lang: Lang): number {
  const miss = missingFields(state, lang);
  if (miss.length === 0) return -1;
  return FIELD_STEP[miss[0]];
}
