import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export type Lang = "en" | "zh";

type Dict = {
  nav_traditions: string;
  nav_ritual: string;
  nav_about: string;
  nav_sign_in: string;
  nav_account: string;
  nav_today: string;
  ritual_pick_language: string;
  ritual_pick_language_hint: string;
  step_of: (i: number, n: number) => string;
  continue: string;
  back: string;
  invoke: string;
  progress: string;
  q_name: string;
  q_name_hint: string;
  q_name_ph: string;
  q_date: string;
  q_date_hint: string;
  q_time: string;
  q_time_hint: string;
  q_place: string;
  q_place_hint: string;
  q_place_ph: string;
  q_gender: string;
  q_gender_hint: string;
  q_gender_male: string;
  q_gender_female: string;
  q_gender_skip: string;
  q_gender_skip_warn: string;
  hero_lang_kicker: string;
  hero_lang_prompt: string;
  hero_lang_en: string;
  hero_lang_zh: string;
  // hero
 hero_kicker: string;
 hero_h1_a: string;
 hero_h1_b: string;
 hero_quote: string;
 hero_subtitle: string;
 hero_cta: string;
 hero_scroll: string;
  // philosophy
  philosophy_a: string;
  philosophy_em: string;
  // pillars
  pillars_kicker: string;
  pillars_title_a: string;
  pillars_title_em: string;
  pillars_archive: string;
  // showcase
  show_kicker: string;
  show_title: string;
  show_body: string;
  show_b1: string;
  show_b2: string;
  show_b3: string;
  show_b4: string;
  show_cta: string;
  show_tree: string;
  // dims preview
  dims_kicker: string;
  dims_title: string;
  dims_list: readonly string[];
  // final CTA
  cta_a: string;
  cta_em: string;
  cta_body: string;
  cta_btn: string;
  // focus
  focus_kicker: string;
  focus_title: string;
  focus_title_em: string;
  focus_hint: string;
  focus_dim_character: string;
  focus_dim_vocation: string;
  focus_dim_wealth: string;
  focus_dim_love: string;
  focus_dim_health: string;
  focus_dim_mission: string;
  focus_dim_family: string;
  nav_community: string;
  // report
  report_kicker: string;
  report_read_across: string;
  in_plain_words: string;
  strength_map: string;
  evidence_across: string;
  synthesis: string;
  read_another: string;
  return_archive: string;
  note_on_fate: string;
  note_body_1: string;
  note_body_2: string;
  four_traditions: readonly [string, string, string, string];
  // per-dimension details
  detail_industries: string;
  detail_roles: string;
  detail_health_focus: string;
  detail_love_portrait: string;
  detail_marriage_window: string;
  detail_wealth_channels: string;
  // timeline
  tl_kicker: string;
  tl_title: string;
  tl_hint: string;
  tl_now: string;
  tl_age: string;
  // key events (new yes/no flow)
  ke_kicker: string;
  ke_title: string;
  ke_hint: string;
  ke_prompt: string;
  ke_yes: string;
  ke_no: string;
  ke_story_prompt: string;
  ke_story_ph: string;
  ke_save_story: string;
  ke_saved: string;
  ke_verified: string;
  ke_note: string;
  // tarot
  tarot_kicker: string;
  tarot_title: string;
  tarot_hint: string;
  tarot_shuffle: string;
  tarot_pick: string;
  tarot_reset: string;
  tarot_pos_past: string;
  tarot_pos_present: string;
  tarot_pos_future: string;
  tarot_read: string;
  // future watchlist
  fw_kicker: string;
  fw_title: string;
  fw_hint: string;
  fw_locked: string;
  // membership
  mem_kicker: string;
  mem_title: string;
  mem_free: string;
  mem_free_desc: string;
  mem_sage: string;
  mem_sage_desc: string;
  mem_oracle: string;
  mem_oracle_desc: string;
  mem_current: string;
  mem_upgrade: string;
  mem_export_pdf: string;
  mem_ai_followup: string;
  mem_ai_followup_desc: string;
  mem_ai_locked: string;
  mem_ai_open: string;
  mem_ai_placeholder: string;
  mem_ai_send: string;
  mem_ai_upsell: string;
  mem_close: string;
  // account
  acc_title: string;
  acc_desc: string;
  acc_name: string;
  acc_email: string;
  acc_sign_in: string;
  acc_sign_out: string;
  acc_signed_as: string;
  acc_save_reading: string;
  acc_reading_saved: string;
  acc_view_saved: string;
  acc_no_saved: string;
  acc_open_reading: string;
  acc_privacy: string;
};

const en: Dict = {
 nav_traditions: "Traditions",
 nav_ritual: "The Ritual",
 nav_about: "About",
  nav_sign_in: "Sign in",
  nav_account: "Account",
  nav_today: "Today",
  ritual_pick_language: "In which tongue shall the library speak to you?",
  ritual_pick_language_hint: "Your reading will be composed in the language you choose.",
  step_of: (i, n) => `Step ${String(i).padStart(2, "0")} / ${String(n).padStart(2, "0")}`,
  continue: "Continue",
  back: "← Back",
  invoke: "Invoke synthesis",
  progress: "Progress",
  q_name: "What name has been given to this life?",
  q_name_hint: "The name is the first inscription of identity.",
  q_name_ph: "Your birth name",
  q_date: "On which day did the sky first receive you?",
  q_date_hint: "Your date of birth situates the stars.",
  q_time: "At what hour did the first breath arrive?",
  q_time_hint: "The hour tunes the four pillars.",
  q_place: "And where on the earth did it happen?",
  q_place_hint: "The place fixes the horizon of your chart.",
  q_place_ph: "Search a city — e.g. Shanghai",
  q_gender: "Which body did you enter this life through?",
  q_gender_hint: "Used only by traditional algorithms (Zi Wei Dou Shu 紫微斗数 requires it). Never displayed as your identity; you can change it later.",
  q_gender_male: "Male",
  q_gender_female: "Female",
  q_gender_skip: "Prefer not to say",
  q_gender_skip_warn: "Zi Wei Dou Shu and the Premium AI Deep Reading cannot be generated until you provide this. Your free reading still works.",
  hero_lang_kicker: "Choose your language",
  hero_lang_prompt: "The library will speak to you in —",
  hero_lang_en: "English",
  hero_lang_zh: "中文",
  hero_kicker: "An AI synthesis of human destiny",
  hero_h1_a: "Every civilization has tried to",
  hero_h1_b: "answer the same question.",
 hero_quote: "“Who are you?”",
 hero_subtitle: "Share your birth details — our AI weaves Western Astrology, Vedic Jyotish, Chinese BaZi and Zi Wei Dou Shu into one reading of who you are.",
 hero_cta: "Enter the Library",
  hero_scroll: "Scroll to explore",
  philosophy_a: "Four civilizations — separated by oceans and centuries — each built a language for the same silence inside a human being.",
  philosophy_em: "This library reads all four at once.",
  pillars_kicker: "I — IV",
  pillars_title_a: "The four pillars of the ",
  pillars_title_em: "reading",
  pillars_archive: "Read the archive →",
  show_kicker: "The Integrated Report",
  show_title: "A singular lens for a complex soul.",
  show_body: "Our AI does not paste four reports together. It reads each chart, clusters agreements, surfaces contradictions, and reasons across four civilizations to find the pattern of a single life.",
  show_b1: "Cross-tradition pattern recognition",
  show_b2: "Confidence rating on every conclusion",
  show_b3: "Conflicts surfaced, not hidden",
  show_b4: "Fifty-year cyclical timeline",
  show_cta: "Begin the ritual",
  show_tree: "The Tree of Destiny",
  dims_kicker: "The dimensions of a life",
  dims_title: "Eight facets, read across four traditions",
  dims_list: ["Character", "Vocation", "Wealth", "Love", "Family", "Health", "Life Mission", "Cycles"],
  cta_a: "Your reading is written",
  cta_em: "in a language older than language.",
  cta_body: "Four minutes of information. A lifetime of pattern. The library is patient — and it is waiting.",
  cta_btn: "Begin the reading",
  focus_kicker: "How the four traditions differ",
  focus_title: "Same question,",
  focus_title_em: "four instruments.",
  focus_hint: "Pick a life dimension. See what each tradition is best at reading.",
  focus_dim_character: "Character",
  focus_dim_vocation: "Vocation",
  focus_dim_wealth: "Wealth",
  focus_dim_love: "Love",
  focus_dim_health: "Health",
  focus_dim_mission: "Life Mission",
  focus_dim_family: "Family",
  nav_community: "Community",
  report_kicker: "The unified reading",
  report_read_across: "read across four traditions",
  in_plain_words: "In plain words",
  strength_map: "Signal across traditions",
  evidence_across: "Evidence across traditions",
  synthesis: "Synthesis",
  read_another: "Read another chart",
  return_archive: "Return to the archive",
  note_on_fate: "A note on reading fate",
  note_body_1: "These are tendencies, not sentences.",
  note_body_2: "The library reads the pattern — the choices remain yours.",
  four_traditions: ["Astrology", "Jyotish", "BaZi", "Zi Wei"],
  detail_industries: "Suitable industries",
  detail_roles: "Roles that fit",
  detail_health_focus: "Watch these systems",
  detail_love_portrait: "Portrait of a true partner",
  detail_marriage_window: "Likely marriage window",
  detail_wealth_channels: "Channels that flow",
  tl_kicker: "Life Timeline · 大运",
  tl_title: "The decades of your unfolding",
  tl_hint: "Hover a decade. Each ten-year cycle carries its own theme, drawn from the BaZi 大运 and the Jyotish Dashā.",
  tl_now: "You are here",
  tl_age: "Age",
  ke_kicker: "Key life events · verification",
  ke_title: "Does the chart's memory match yours?",
  ke_hint: "The library proposes moments it senses on your chart. Confirm or correct — this teaches the AI who you actually are.",
  ke_prompt: "The chart senses:",
  ke_yes: "Yes, this happened",
  ke_no: "No — here is what actually happened",
  ke_story_prompt: "Tell the library what really unfolded that year:",
  ke_story_ph: "e.g. That year I actually moved abroad and started over…",
  ke_save_story: "Save my version",
  ke_saved: "Thank you — the reading will re-tune to this.",
  ke_verified: "Confirmed · the chart carried this.",
  ke_note: "Stored privately on this device.",
  tarot_kicker: "Tarot · a second witness",
  tarot_title: "Draw three cards for a specific question",
  tarot_hint: "The chart reads the pattern of a lifetime; the tarot reads the pattern of a moment. Choose any three cards below.",
  tarot_shuffle: "Shuffle the deck",
  tarot_pick: "Pick a card",
  tarot_reset: "Draw again",
  tarot_pos_past: "Past",
  tarot_pos_present: "Present",
  tarot_pos_future: "Emerging",
  tarot_read: "The reading",
  fw_kicker: "Future watchlist · Oracle members",
  fw_title: "Windows to watch in the next five years",
  fw_hint: "Concrete moments the chart wants you to be awake for — flagged from the great cycles.",
  fw_locked: "Upgrade to see the full watchlist",
  mem_kicker: "Deepen the reading",
  mem_title: "Membership",
  mem_free: "Seeker",
  mem_free_desc: "The unified reading you are viewing. Free forever.",
  mem_sage: "Sage",
  mem_sage_desc: "In-app deep reading · full life timeline · synastry & relationships · 10 tarot AI readings / month.",
  mem_oracle: "Oracle",
  mem_oracle_desc: "Everything in Sage · unlimited AI follow-up · unlimited tarot readings · 90-day state & keystone windows.",
  mem_current: "Current plan",
  mem_upgrade: "Upgrade",
  mem_export_pdf: "Open deep reading",
  mem_ai_followup: "Ask the Oracle",
  mem_ai_followup_desc: "Have a private conversation with the AI that read your chart. Ask follow-up questions about any dimension.",
  mem_ai_locked: "Oracle members only",
  mem_ai_open: "Open the conversation",
  mem_ai_placeholder: "Ask a question about your reading…",
  mem_ai_send: "Send",
  mem_ai_upsell: "AI follow-up is part of the Oracle plan. Upgrade to continue the conversation with the library.",
  mem_close: "Close",
  acc_title: "Your account",
  acc_desc: "Sign in to save your readings and return to them from any device.",
  acc_name: "Your name",
  acc_email: "Email",
  acc_sign_in: "Sign in / Register",
  acc_sign_out: "Sign out",
  acc_signed_as: "Signed in as",
  acc_save_reading: "Save this reading",
  acc_reading_saved: "Saved to your account.",
  acc_view_saved: "Saved readings",
  acc_no_saved: "No readings saved yet.",
  acc_open_reading: "Open",
  acc_privacy: "Stored privately in this browser. Cloud sync arrives with the Sage plan.",
};

const zh: Dict = {
  nav_traditions: "四大体系",
  nav_ritual: "开启仪式",
  nav_about: "关于",
  nav_sign_in: "登录",
  nav_account: "我的",
  nav_today: "今日命运",
  ritual_pick_language: "图书馆应以何种语言与你对话？",
  ritual_pick_language_hint: "你的解读将以所选语言书写。",
  step_of: (i, n) => `第 ${String(i).padStart(2, "0")} 步 / 共 ${String(n).padStart(2, "0")} 步`,
  continue: "继续",
  back: "← 返回",
  invoke: "开启综合解读",
  progress: "进度",
  q_name: "这一生被赋予了怎样的名字？",
  q_name_hint: "姓名是身份最初的印记。",
  q_name_ph: "你的本名",
  q_date: "天空是在哪一天接住了你？",
  q_date_hint: "出生日期为群星定位。",
  q_time: "第一声呼吸在哪个时辰？",
  q_time_hint: "时辰调准四柱。",
  q_place: "又是在地球上哪一处发生的？",
  q_place_hint: "出生地点确定你星盘的地平线。",
  q_place_ph: "搜索城市 — 例如 上海",
  q_gender: "你是以怎样的身体进入这一生的？",
  q_gender_hint: "仅用于传统算法计算（紫微斗数需要此项）。不会作为身份显示，之后可以修改。",
  q_gender_male: "男",
  q_gender_female: "女",
  q_gender_skip: "暂不填写",
  q_gender_skip_warn: "紫微斗数与「高级 AI 深度报告」将无法生成；免费网页报告不受影响。",
  hero_lang_kicker: "选择你的语言",
  hero_lang_prompt: "图书馆将以此语言与你对话 —",
  hero_lang_en: "English",
  hero_lang_zh: "中文",
  hero_kicker: "以 AI 综合阅读的命运",
  hero_h1_a: "每一种文明，都在追问",
  hero_h1_b: "同一个问题。",
  hero_quote: "「你，是谁？」",
  hero_subtitle: "输入你的出生信息，AI 将融合西方占星、印度吠陀、中国八字与紫微斗数，为你合成一份关于「你是谁」的解读。",
  hero_cta: "步入图书馆",
  hero_scroll: "向下滚动继续",
  philosophy_a: "四种文明 —— 隔着大洋与千年 —— 各自为人内心的同一片寂静，谱写了一门语言。",
  philosophy_em: "这座图书馆同时阅读它们四种。",
  pillars_kicker: "壹 — 肆",
  pillars_title_a: "支撑这次阅读的",
  pillars_title_em: "四根梁柱",
  pillars_archive: "查阅典籍 →",
  show_kicker: "综合报告",
  show_title: "为复杂的一生，打磨一枚镜片。",
  show_body: "我们的 AI 不是把四份报告拼在一起。它会分别读盘、汇总一致、暴露冲突，并跨越四种文明，寻找同一个人真正的模式。",
  show_b1: "跨体系的模式识别",
  show_b2: "每条结论都附可信度",
  show_b3: "冲突不藏，直陈眼前",
  show_b4: "覆盖五十年的周期时间轴",
  show_cta: "开启仪式",
  show_tree: "命运之树",
  dims_kicker: "生命的维度",
  dims_title: "以四大体系读八个切面",
  dims_list: ["性格", "事业", "财富", "情感", "家庭", "健康", "人生使命", "周期"],
  cta_a: "你的解读，写在",
  cta_em: "比语言更古老的语言里。",
  cta_body: "四分钟的信息，一生的纹理。图书馆很有耐心 —— 它一直在等你。",
  cta_btn: "开始阅读",
  focus_kicker: "四大体系的不同侧重",
  focus_title: "同一个问题，",
  focus_title_em: "四种乐器。",
  focus_hint: "点击一个人生维度，看四大体系各自擅长阅读什么。",
  focus_dim_character: "性格",
  focus_dim_vocation: "事业",
  focus_dim_wealth: "财富",
  focus_dim_love: "情感",
  focus_dim_health: "健康",
  focus_dim_mission: "使命",
  focus_dim_family: "家庭",
  nav_community: "同门",
  report_kicker: "综合解读",
  report_read_across: "· 四大体系的合鸣",
  in_plain_words: "通俗解读",
  strength_map: "各体系信号强度",
  evidence_across: "四大体系的证据",
  synthesis: "综合结论",
  read_another: "换一张命盘",
  return_archive: "回到典籍",
  note_on_fate: "关于阅读命运",
  note_body_1: "这些是倾向，不是判决。",
  note_body_2: "图书馆读出的是纹理 —— 选择依然属于你。",
  four_traditions: ["西方占星", "印度占星", "八字", "紫微"],
  detail_industries: "适合的行业",
  detail_roles: "适配的岗位",
  detail_health_focus: "值得留意的系统",
  detail_love_portrait: "正缘的画像",
  detail_marriage_window: "较可能的婚期",
  detail_wealth_channels: "顺畅的进财通道",
  tl_kicker: "生命时间轴 · 大运",
  tl_title: "你人生展开的十年",
  tl_hint: "悬停任一十年段。每个大运周期都有自己的主题，源自八字大运与印度占星 Dashā。",
  tl_now: "你现在在这里",
  tl_age: "岁",
  ke_kicker: "关键节点 · 反向验证",
  ke_title: "命盘的记忆，和你的一致吗？",
  ke_hint: "图书馆先抛出它感知到的时点。你确认或纠正 —— AI 会据此重新调准你的解读。",
  ke_prompt: "命盘感知到：",
  ke_yes: "是，发生过",
  ke_no: "不是 —— 我告诉你真实的",
  ke_story_prompt: "请把那一年真正发生的写给图书馆：",
  ke_story_ph: "例如：那一年我其实出国重新开始…",
  ke_save_story: "保存我的版本",
  ke_saved: "谢谢 —— 解读会据此重新调准。",
  ke_verified: "已确认 · 命盘承载了这一节点。",
  ke_note: "内容仅保存在此设备。",
  tarot_kicker: "塔罗 · 第二位证人",
  tarot_title: "为一个具体问题抽三张牌",
  tarot_hint: "命盘读一生的模式，塔罗读此刻的模式。从下面选任意三张。",
  tarot_shuffle: "洗牌",
  tarot_pick: "选一张",
  tarot_reset: "再抽一次",
  tarot_pos_past: "过去",
  tarot_pos_present: "此刻",
  tarot_pos_future: "正在生成",
  tarot_read: "解读",
  fw_kicker: "未来观察名单 · 神谕者专属",
  fw_title: "未来五年，命盘请你保持觉察的窗口",
  fw_hint: "从大运里挑出的、值得你提前醒着的时刻。",
  fw_locked: "升级后可查看完整名单",
  mem_kicker: "让解读更深一层",
  mem_title: "会员计划",
  mem_free: "求索者",
  mem_free_desc: "你正在查看的综合解读。永久免费。",
  mem_sage: "贤者",
  mem_sage_desc: "站内深度阅读 · 完整生命时间轴 · 合盘与关系分析 · 每月 10 次塔罗 AI 解读。",
  mem_oracle: "神谕者",
  mem_oracle_desc: "包含贤者所有权益 · 无限 AI 追问 · 无限塔罗解读 · 近 90 天状态与关键时间节点。",
  mem_current: "当前计划",
  mem_upgrade: "升级",
  mem_export_pdf: "打开深度报告",
  mem_ai_followup: "向神谕者提问",
  mem_ai_followup_desc: "与阅读过你命盘的 AI 私下对话。就任一维度追问下去。",
  mem_ai_locked: "神谕者会员专属",
  mem_ai_open: "开启对话",
  mem_ai_placeholder: "对你的解读提一个问题…",
  mem_ai_send: "发送",
  mem_ai_upsell: "AI 追问是「神谕者」会员的权益。升级后即可继续与图书馆对话。",
  mem_close: "关闭",
  acc_title: "我的账户",
  acc_desc: "登录后可保存你的解读，并在任意设备上继续查看。",
  acc_name: "你的名字",
  acc_email: "邮箱",
  acc_sign_in: "登录 / 注册",
  acc_sign_out: "退出登录",
  acc_signed_as: "已登录为",
  acc_save_reading: "保存这次解读",
  acc_reading_saved: "已保存到你的账户。",
  acc_view_saved: "已保存的解读",
  acc_no_saved: "还没有保存任何解读。",
  acc_open_reading: "打开",
  acc_privacy: "当前仅保存在本浏览器；云端同步将随「贤者」计划开放。",
};

const DICTS: Record<Lang, Dict> = { en, zh };

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: Dict };
const LangCtx = createContext<Ctx | null>(null);
const LANGUAGE_STORAGE_KEY = "lod.lang";
const LANGUAGE_CHANGE_EVENT = "lod:lang-change";
let languageSnapshot: Lang = "zh";
const languageListeners = new Set<() => void>();

function normalizeLang(value: unknown): Lang | null {
  return value === "en" || value === "zh" ? value : null;
}

function readStoredLanguage(): Lang {
  if (typeof window === "undefined") return languageSnapshot;
  try {
    return normalizeLang(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)) ?? languageSnapshot;
  } catch {
    return languageSnapshot;
  }
}

function getLanguageSnapshot(): Lang {
  languageSnapshot = readStoredLanguage();
  return languageSnapshot;
}

function getServerLanguageSnapshot(): Lang {
  return "zh";
}

function subscribeLanguageStore(onStoreChange: () => void): () => void {
  languageListeners.add(onStoreChange);
  if (typeof window === "undefined") {
    return () => languageListeners.delete(onStoreChange);
  }
  if (
    typeof window.addEventListener !== "function" ||
    typeof window.removeEventListener !== "function"
  ) {
    return () => languageListeners.delete(onStoreChange);
  }

  const notify = () => onStoreChange();
  const onStorage = (event: StorageEvent) => {
    if (event.key === LANGUAGE_STORAGE_KEY) notify();
  };

  window.addEventListener(LANGUAGE_CHANGE_EVENT, notify);
  window.addEventListener("storage", onStorage);
  return () => {
    languageListeners.delete(onStoreChange);
    window.removeEventListener(LANGUAGE_CHANGE_EVENT, notify);
    window.removeEventListener("storage", onStorage);
  };
}

function notifyLanguageListeners(): void {
  for (const listener of [...languageListeners]) listener();
}

function persistLanguage(lang: Lang): void {
  if (languageSnapshot === lang) {
    syncDocumentLang(lang);
  }
  languageSnapshot = lang;
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    }
  } catch {}
  syncDocumentLang(lang);
  notifyLanguageListeners();
  if (typeof window !== "undefined") {
    if (typeof window.dispatchEvent === "function") {
      const event =
        typeof CustomEvent !== "undefined"
          ? new CustomEvent(LANGUAGE_CHANGE_EVENT, { detail: lang })
          : new Event(LANGUAGE_CHANGE_EVENT);
      window.dispatchEvent(event);
    }
  }
}

/** Public: the BCP-47 tag we render on `<html lang>` for a given app lang. */
export function htmlLangFor(lang: Lang): "zh-CN" | "en" {
  return lang === "zh" ? "zh-CN" : "en";
}

/** Sync `document.documentElement.lang` so screen readers, spell-check and
 *  CSS `:lang()` selectors match the visible UI. */
export function syncDocumentLang(lang: Lang): void {
  if (typeof document === "undefined") return;
  const tag = htmlLangFor(lang);
  const el = document.documentElement;
  if (el.getAttribute("lang") !== tag) el.setAttribute("lang", tag);
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const lang = useSyncExternalStore(
    subscribeLanguageStore,
    getLanguageSnapshot,
    getServerLanguageSnapshot,
  );

  // Keep <html lang> aligned with the active UI language after mount.
  // Runs client-only, so it never diverges from the SSR shell attribute.
  useEffect(() => {
    const stored = readStoredLanguage();
    if (stored !== lang) {
      persistLanguage(stored);
      return;
    }
    syncDocumentLang(lang);
  }, [lang]);

  const setLang = useCallback((l: Lang) => persistLanguage(l), []);

  return (
    <LangCtx.Provider value={{ lang, setLang, t: DICTS[lang] }}>{children}</LangCtx.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LangCtx);
  if (!ctx) throw new Error("useLang must be used within LanguageProvider");
  return ctx;
}

// Re-export for tests
export { DICTS };
