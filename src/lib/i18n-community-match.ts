/**
 * Bilingual copy for the Community Anonymous Match Pool.
 * All UI text lives here; no PII, no debug IDs.
 */
import { useLang } from "@/lib/i18n";

type Lang = "zh" | "en";

const DICT = {
  tab_personal: { zh: "我的命盘适配", en: "My Chart Match" },
  tab_community: { zh: "社区匿名匹配", en: "Community Anonymous Match" },

  intro_title: { zh: "社区匿名匹配", en: "Community Anonymous Match" },
  intro_body: {
    zh: "系统会根据你的主命盘，向池中其他已授权的成员匿名推荐潜在契合。匹配不是关系成功率也不是命运判断；你可以随时暂停、退出或撤回授权。",
    en: "We anonymously suggest other opt-in members based on your primary chart. Match is not a success rate or a fate verdict; you can pause, opt out, or revoke consent at any time.",
  },

  opt_in_headline: { zh: "加入匿名匹配池", en: "Join the anonymous pool" },
  opt_in_req_age: { zh: "已满 18 岁", en: "18 or older" },
  opt_in_req_primary: { zh: "已设置我的主命盘", en: "Primary chart set" },
  opt_in_req_missing: { zh: "去设置主命盘 →", en: "Set primary chart →" },
  opt_in_age_band_label: { zh: "年龄区间（可选，用于筛选）", en: "Age band (optional, for filtering)" },
  opt_in_age_band_hide: { zh: "不向匿名候选显示我的年龄区间", en: "Hide my age band from candidates" },
  opt_in_consent: {
    zh: "我确认已满 18 岁，允许系统匿名计算并把我加入匹配池。",
    en: "I confirm I am 18+ and allow the system to anonymously calculate compatibility and add me to the pool.",
  },
  opt_in_cta: { zh: "加入匿名匹配池", en: "Join the pool" },
  opt_in_privacy_hint: {
    zh: "匹配池不会向他人展示你的姓名、生日、出生时间、地点或邮箱。",
    en: "The pool never shows your name, birth date/time, place, or email to others.",
  },

  pool_alias_you: { zh: "我的匿名代号", en: "Your anonymous alias" },
  pool_paused: { zh: "已暂停（不会出现在他人推荐中）", en: "Paused (not shown to others)" },
  pool_pause: { zh: "暂停", en: "Pause" },
  pool_resume: { zh: "恢复", en: "Resume" },
  pool_leave: { zh: "退出匹配池", en: "Leave the pool" },
  pool_leave_confirm: { zh: "确认退出？已同意的匹配将保留在你的记录中，但不再更新。", en: "Leave the pool? Existing matches stay in your history but stop updating." },
  pool_toggle_age: { zh: "对外显示我的年龄区间", en: "Show my age band to others" },

  tab_candidates: { zh: "推荐候选", en: "Candidates" },
  tab_invites: { zh: "我的邀请", en: "Invites" },
  tab_matches: { zh: "已匹配", en: "Matches" },
  tab_privacy: { zh: "隐私设置", en: "Privacy" },

  candidates_refresh: { zh: "刷新候选", en: "Refresh candidates" },
  candidates_cooldown: { zh: "刷新过于频繁，请稍候。", en: "Too many refreshes — please wait a moment." },
  candidates_daily_limit: { zh: "今日推荐已达上限。", en: "Daily recommendation limit reached." },
  candidates_empty: { zh: "暂无候选，稍后再来看看。", en: "No candidates yet. Check back later." },
  candidates_partial: { zh: "部分数据缺失", en: "Partial data" },

  card_overall: { zh: "综合契合", en: "Overall fit" },
  card_facet_communication: { zh: "沟通", en: "Communication" },
  card_facet_emotional_support: { zh: "情绪支持", en: "Emotional support" },
  card_facet_action_rhythm: { zh: "行动节奏", en: "Action rhythm" },
  card_facet_boundary_repair: { zh: "边界修复", en: "Boundary repair" },
  card_facet_shared_growth: { zh: "共同成长", en: "Shared growth" },
  card_invite: { zh: "邀请匹配", en: "Invite" },
  card_block: { zh: "屏蔽", en: "Block" },
  card_report: { zh: "举报", en: "Report" },
  card_evidence_title: { zh: "共同点 / 互补点", en: "Resonances & complements" },
  card_age_hidden: { zh: "年龄未公开", en: "Age hidden" },

  invite_status_pending: { zh: "待处理", en: "Pending" },
  invite_status_accepted: { zh: "已接受", en: "Accepted" },
  invite_status_declined: { zh: "已拒绝", en: "Declined" },
  invite_status_expired: { zh: "已过期", en: "Expired" },
  invite_status_revoked: { zh: "已撤回", en: "Revoked" },
  invite_status_blocked: { zh: "已屏蔽", en: "Blocked" },
  invite_sent_empty: { zh: "尚未发出邀请。", en: "No invites sent yet." },
  invite_received_empty: { zh: "暂无收到的邀请。", en: "No invites received." },
  invite_action_accept: { zh: "接受", en: "Accept" },
  invite_action_decline: { zh: "拒绝", en: "Decline" },
  invite_action_block: { zh: "屏蔽并拒绝", en: "Block & decline" },
  invite_action_revoke: { zh: "撤回", en: "Revoke" },
  invite_expires_at: (iso: string) => ({ zh: `过期时间：${iso.slice(0, 10)}`, en: `Expires ${iso.slice(0, 10)}` }),

  matches_empty: { zh: "暂无已匹配对象。接受邀请后会出现在这里。", en: "No matches yet. Accepted invites will appear here." },
  matches_grant_locked: {
    zh: "对方或你已撤回授权，完整结果暂不可读。",
    en: "One side has revoked consent. Full result is temporarily locked.",
  },
  matches_open: { zh: "查看详情", en: "View details" },
  matches_revoke: { zh: "撤回我的授权", en: "Revoke my consent" },
  matches_invite_friend: { zh: "邀请成为好友", en: "Invite as friend" },
  matches_chat_coming: { zh: "聊天入口即将开放（需双方成为好友）。", en: "Chat coming soon (both sides must become friends)." },

  privacy_title: { zh: "隐私设置", en: "Privacy" },
  privacy_body: {
    zh: "退出后你的匿名代号将立即从池中移除；已建立的匹配记录会保留在你的历史中，但双方可随时撤回单个匹配授权。",
    en: "Leaving removes your alias from the pool immediately. Existing matches remain in your history; either side can revoke a single grant at any time.",
  },

  err_generic: { zh: "操作失败，请稍后再试。", en: "Something went wrong. Please try again." },
  err_primary_required: { zh: "请先在“我的主命盘”页面设置一张主命盘。", en: "Please set a primary chart first." },
  err_duplicate_pending: { zh: "已经存在待处理的邀请。", en: "There is already a pending invite." },
  err_blocked: { zh: "无法与该用户互动。", en: "Cannot interact with this user." },
  err_candidate_unavailable: { zh: "该候选暂不可用。", en: "This candidate is unavailable." },
  err_expired: { zh: "该邀请已过期。", en: "This invite has expired." },
  err_rate_limited: { zh: "操作过于频繁，请稍候。", en: "Too many actions — please wait." },
  err_daily_limit: { zh: "今日额度已用完。", en: "Daily quota exhausted." },
  err_not_in_pool: { zh: "你尚未加入匹配池。", en: "You have not joined the pool." },

  band_high: { zh: "高", en: "High" },
  band_mid: { zh: "中", en: "Mid" },
  band_low: { zh: "低", en: "Low" },

  hero_title: {
    zh: "在茫茫书页中，寻找与你共振的另一段注脚。",
    en: "Somewhere in the endless pages, another footnote resonates with yours.",
  },
  hero_body: {
    zh: "共鸣星图并非配对成功率，而是命运图书馆为你点亮的可能。",
    en: "The resonance atlas is not a compatibility score — it is a lantern the Library lifts for you.",
  },
  ritual_step1: { zh: "点亮匿名代号", en: "Kindle your anonymous mark" },
  ritual_step2: { zh: "在星图上倾听共鸣", en: "Listen for resonance in the atlas" },
  ritual_step3: { zh: "递出书签，等待回音", en: "Send a bookmark, await the echo" },

  view_atlas: { zh: "星图视图", en: "Atlas view" },
  view_list: { zh: "列表视图", en: "List view" },

  atlas_center_you: { zh: "你在此处", en: "You are here" },
  atlas_scanning: { zh: "星图正在校准…", en: "The atlas is calibrating…" },
  atlas_focus_hint: {
    zh: "点亮一颗星，展开命运注脚。",
    en: "Kindle a star to open its footnote.",
  },
  atlas_pending_pulse: { zh: "书签已递出，等待回音", en: "Bookmark sent, awaiting reply" },
  atlas_none_yet: {
    zh: "星图暂无共鸣者。稍后再来，也许有新的注脚。",
    en: "No resonant stars yet. Return soon — new footnotes may arrive.",
  },

  drawer_close: { zh: "关闭", en: "Close" },
  drawer_radar_self: { zh: "你", en: "You" },
  drawer_radar_other: { zh: "对方", en: "Them" },
  drawer_radar_disclaimer: {
    zh: "四维雷达是共鸣意象，并非关系成功率。",
    en: "The four axes are a resonance picture, not a relationship success rate.",
  },
  drawer_group_resonance: { zh: "产生共鸣的地方", en: "Where you resonate" },
  drawer_group_complement: { zh: "形成互补的地方", en: "Where you complement" },

  invite_ritual_title: { zh: "递出一枚书签", en: "Offer a bookmark" },
  invite_ritual_body: {
    zh: "书签将沿光线飞向对方星点。ta 若接受，两颗星核之间会连起一条金紫细线。",
    en: "Your bookmark drifts along a beam of light. If accepted, a slender gold-violet thread will bind your two stars.",
  },
  invite_delivered: { zh: "书签已抵达对方灯下。", en: "The bookmark has reached their lamp." },

  primary_missing_title: { zh: "需要先设定主命盘", en: "A primary chart is required" },
  primary_missing_cta: { zh: "前往「今日阅览室」设置 →", en: "Open Today’s Reading Room →" },
} as const;

type Key = keyof typeof DICT;

/**
 * Cached per language. The returned object is used inside `useCallback`
 * dependency arrays; returning a fresh object on every render caused an
 * infinite refresh loop in the Community Match panel.
 */
const COPY_CACHE = new Map<Lang, ReturnType<typeof buildCommunityMatchCopy>>();

export function useCommunityMatchCopy() {
  const { lang } = useLang();
  return communityMatchCopy(lang);
}

export function communityMatchCopy(lang: Lang) {
  const cached = COPY_CACHE.get(lang);
  if (cached) return cached;
  const built = buildCommunityMatchCopy(lang);
  COPY_CACHE.set(lang, built);
  return built;
}

function buildCommunityMatchCopy(lang: Lang) {
  const t = <K extends Key>(k: K): string => {
    const v = DICT[k] as unknown;
    if (typeof v === "function") return "";
    return (v as Record<Lang, string>)[lang];
  };
  return {
    t,
    expiresAt: (iso: string) => DICT.invite_expires_at(iso)[lang],
    band: (b: string): string =>
      b === "high" ? DICT.band_high[lang] : b === "low" ? DICT.band_low[lang] : DICT.band_mid[lang],
    errFor: (message: string): string => {
      const map: Record<string, Key> = {
        primary_chart_required: "err_primary_required",
        duplicate_pending: "err_duplicate_pending",
        blocked: "err_blocked",
        candidate_unavailable: "err_candidate_unavailable",
        expired: "err_expired",
        rate_limited: "err_rate_limited",
        daily_limit: "err_daily_limit",
        not_in_pool: "err_not_in_pool",
      };
      const key = Object.keys(map).find((k) => message.includes(k));
      return t(key ? map[key] : "err_generic");
    },
    facetLabel: (k: string): string => {
      switch (k) {
        case "communication": return t("card_facet_communication");
        case "emotional_support": return t("card_facet_emotional_support");
        case "action_rhythm": return t("card_facet_action_rhythm");
        case "boundary_repair": return t("card_facet_boundary_repair");
        case "shared_growth": return t("card_facet_shared_growth");
        default: return k;
      }
    },
  };
}
