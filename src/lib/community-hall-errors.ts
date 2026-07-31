/**
 * 同门 · 众生之厅 — error vocabulary.
 *
 * The server layer only ever throws a stable code (`HALL_ERR:<code>`); this
 * module is the single place that turns a code into human, bilingual copy.
 * Nothing user-facing may render a raw Postgres message, an RPC name, an
 * enum value or a snake_case field.
 */
import type { Lang } from "@/lib/i18n";

export const HALL_ERROR_PREFIX = "HALL_ERR:";

export type HallErrorCode =
  | "auth_required"
  | "adult_required"
  | "not_opted_in"
  | "invalid_age_band"
  | "invalid_body_length"
  | "empty_body"
  | "rate_limited"
  | "daily_letter_limit"
  | "hourly_reply_limit"
  | "hourly_report_limit"
  | "duplicate_submission"
  | "already_replied"
  | "not_a_recipient"
  | "letter_not_found"
  | "letter_expired"
  | "letter_closed"
  | "content_contact"
  | "content_solicitation"
  | "content_rejected"
  | "content_political"
  | "content_sexual"
  | "content_illegal"
  | "content_in_review"
  | "not_allowed"
  | "sage_required"
  | "no_reply_credits"
  | "invalid_rating"
  | "offline"
  | "unknown";

type Pair = { zh: string; en: string };

const MESSAGES: Record<HallErrorCode, Pair> = {
  auth_required: {
    zh: "请先登录，再走进众生之厅。",
    en: "Please sign in before entering the hall.",
  },
  adult_required: {
    zh: "众生之厅只向年满 18 周岁的旅者开放。请先在个人书架补全出生日期。",
    en: "The hall is open to travelers aged 18 and over. Add your birth date in your library first.",
  },
  not_opted_in: {
    zh: "你还没有加入同门。开启后，馆内信使才会把信送到你手中。",
    en: "You have not joined the fellowship yet. Turn it on and the courier can start delivering.",
  },
  invalid_age_band: {
    zh: "请选择一个人生阶段，再继续。",
    en: "Choose a chapter of life before continuing.",
  },
  invalid_body_length: {
    zh: "正文长度不合适：太短对方看不懂，太长信封装不下。",
    en: "That length will not do — too short to understand, too long for the envelope.",
  },
  empty_body: {
    zh: "这封信还是空的。写下你真正想问的一件事吧。",
    en: "The page is still blank. Write the one thing you really want to ask.",
  },
  rate_limited: {
    zh: "信使今天已经替你寄出了不少信，请稍后再试。",
    en: "The courier has carried a lot for you today. Please try again later.",
  },
  daily_letter_limit: {
    zh: "今天的信已经寄满了。明天信使会再来。",
    en: "Today's letters are all sent. The courier returns tomorrow.",
  },
  hourly_reply_limit: {
    zh: "这一个时辰的回音已经写得够多了，先歇一歇。",
    en: "That is a lot of echoes for one hour. Rest a moment.",
  },
  hourly_report_limit: {
    zh: "举报提交得有些频繁，请稍后再试。",
    en: "That is a lot of reports in a short time. Please try again later.",
  },
  duplicate_submission: {
    zh: "这封信刚刚已经交给信使了，不必重复寄出。",
    en: "The courier already has this one — no need to send it twice.",
  },
  already_replied: {
    zh: "你已经给这封信写过回音了。每封信只收一次回信。",
    en: "You have already written an echo to this letter. One echo per letter.",
  },
  not_a_recipient: {
    zh: "只有收到这封信的旅者才能写下回音。",
    en: "Only the traveler this letter reached can write an echo.",
  },
  letter_not_found: {
    zh: "这封信不在你的书架上，可能已被取走或从未寄给你。",
    en: "This letter is not on your shelf — it may have been withdrawn, or was never sent to you.",
  },
  letter_expired: {
    zh: "这封信已经过了收信期限。",
    en: "This letter has passed its closing date.",
  },
  letter_closed: {
    zh: "写信人已经结束了这封信的收信。",
    en: "The writer has closed this letter to new echoes.",
  },
  content_contact: {
    zh: "这封信中可能含有联系方式或身份信息。为保护双方，请去掉手机号、微信、邮箱、二维码和外部链接后再寄出。",
    en: "This letter seems to contain contact or identifying details. Remove phone numbers, handles, emails, QR codes and links before sending.",
  },
  content_solicitation: {
    zh: "信中不能出现金钱往来、投资招揽或商业推广的内容，请修改后再寄出。",
    en: "Letters cannot carry money requests, investment pitches or promotions. Please revise and send again.",
  },
  content_rejected: {
    zh: "这封信中可能含有联系方式、身份信息或不适合公开投递的内容，请修改后再寄出。",
    en: "This letter may contain contact details, identifying information, or content unsuited to anonymous delivery. Please revise it.",
  },
  content_in_review: {
    zh: "这封信需要馆员先过目，通过后会自动开始投递。",
    en: "A librarian will read this one first; delivery begins once it is approved.",
  },
  content_political: {
    zh: "这封信涉及违反法律法规的政治内容或煽动性言论，无法寄出。请只写你自己的人生困惑。",
    en: "This letter touches political content or incitement that breaks the law and cannot be sent. Please write only about your own life.",
  },
  content_sexual: {
    zh: "这封信涉及色情、性交易或性骚扰内容，无法寄出。众生之厅是安全的地方。",
    en: "This letter contains sexual, solicitation or harassment content and cannot be sent. The hall is meant to stay safe.",
  },
  content_illegal: {
    zh: "这封信涉及违法交易、伪造证件、赌博或毒品等内容，无法寄出。",
    en: "This letter involves illegal trade, forgery, gambling or drugs and cannot be sent.",
  },
  not_allowed: {
    zh: "你没有权限做这件事。",
    en: "You do not have permission to do this.",
  },
  sage_required: {
    zh: "先贤回信与图书管理员亲自回信，都属于「贤者」会员的权益。",
    en: "Sage letters and the librarian's personal reply are both part of the Sage membership.",
  },
  no_reply_credits: {
    zh: "赠送的三次真人回复已经用完了。这三次为开通「贤者」时一次性赠送，不会每月重置。",
    en: "Your three gifted human replies are used up. They are a one-time gift with the Sage membership, not a monthly grant.",
  },
  invalid_rating: {
    zh: "评分需要在 1 到 5 星之间。",
    en: "A rating must be between 1 and 5 stars.",
  },

  offline: {
    zh: "看起来暂时连不上图书馆。请检查网络后重试。",
    en: "The library seems unreachable. Check your connection and try again.",
  },
  unknown: {
    zh: "书架那边出了点状况，请稍后再试。",
    en: "Something went wrong on the shelves. Please try again shortly.",
  },
};

/** Wrap a code so the server can throw it across the RPC boundary. */
export function hallError(code: HallErrorCode): Error {
  return new Error(`${HALL_ERROR_PREFIX}${code}`);
}

/** Extract a code from anything the transport threw at us. */
export function hallErrorCode(error: unknown): HallErrorCode {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return "offline";
  const raw =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (!raw) return "unknown";
  const index = raw.indexOf(HALL_ERROR_PREFIX);
  if (index >= 0) {
    const code = raw.slice(index + HALL_ERROR_PREFIX.length).split(/[^a-z_]/)[0];
    if (code in MESSAGES) return code as HallErrorCode;
  }
  // Fall back to matching a bare code (older RPC surfaces, direct Postgres text).
  const hit = (Object.keys(MESSAGES) as HallErrorCode[]).find((code) => raw.includes(code));
  if (hit) return hit;
  if (/failed to fetch|networkerror|load failed/i.test(raw)) return "offline";
  return "unknown";
}

/** Human copy for an error, in the reader's language. */
export function hallErrorMessage(error: unknown, lang: Lang): string {
  const pair = MESSAGES[hallErrorCode(error)];
  return lang === "zh" ? pair.zh : pair.en;
}
