import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "zh";

type Dict = {
  // nav
  nav_traditions: string;
  nav_ritual: string;
  nav_about: string;
  // ritual
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
  // landing hero language chooser
  hero_lang_kicker: string;
  hero_lang_prompt: string;
  hero_lang_en: string;
  hero_lang_zh: string;
  // focus comparison
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
  // timeline
  tl_kicker: string;
  tl_title: string;
  tl_hint: string;
  tl_now: string;
  tl_age: string;
  // key events
  ke_kicker: string;
  ke_title: string;
  ke_hint: string;
  ke_year: string;
  ke_event_ph: string;
  ke_add: string;
  ke_verify: string;
  ke_verified: string;
  ke_note: string;
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
};

const en: Dict = {
  nav_traditions: "Four Pillars",
  nav_ritual: "The Ritual",
  nav_about: "About",
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
  hero_lang_kicker: "Choose your language",
  hero_lang_prompt: "The library will speak to you in —",
  hero_lang_en: "English",
  hero_lang_zh: "中文",
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
  tl_kicker: "Life Timeline · 大运",
  tl_title: "The decades of your unfolding",
  tl_hint: "Hover a decade. Each ten-year cycle carries its own theme, drawn from the BaZi 大运 and the Jyotish Dashā.",
  tl_now: "You are here",
  tl_age: "Age",
  ke_kicker: "Key life events",
  ke_title: "Cross-check the reading against your life",
  ke_hint: "Enter two or three real turning points. The library will note how the chart already carried them.",
  ke_year: "Year",
  ke_event_ph: "e.g. Left home country, changed career, met partner…",
  ke_add: "+ Add another",
  ke_verify: "Verify against my chart",
  ke_verified: "The chart's cycles align with this event.",
  ke_note: "This is a private cross-check. Nothing is sent until you invoke it.",
  mem_kicker: "Deepen the reading",
  mem_title: "Membership",
  mem_free: "Seeker",
  mem_free_desc: "The unified reading you are viewing. Free forever.",
  mem_sage: "Sage",
  mem_sage_desc: "Full PDF export · life-timeline analysis · 12-month forecast.",
  mem_oracle: "Oracle",
  mem_oracle_desc: "Everything in Sage · unlimited AI follow-up conversation · priority calculations.",
  mem_current: "Current plan",
  mem_upgrade: "Upgrade",
  mem_export_pdf: "Export PDF report",
  mem_ai_followup: "Ask the Oracle",
  mem_ai_followup_desc: "Have a private conversation with the AI that read your chart. Ask follow-up questions about any dimension.",
  mem_ai_locked: "Oracle members only",
  mem_ai_open: "Open the conversation",
  mem_ai_placeholder: "Ask a question about your reading…",
  mem_ai_send: "Send",
  mem_ai_upsell: "AI follow-up is part of the Oracle plan. Upgrade to continue the conversation with the library.",
  mem_close: "Close",
};

const zh: Dict = {
  nav_traditions: "四大体系",
  nav_ritual: "开启仪式",
  nav_about: "关于",
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
  hero_lang_kicker: "选择你的语言",
  hero_lang_prompt: "图书馆将以此语言与你对话 —",
  hero_lang_en: "English",
  hero_lang_zh: "中文",
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
  tl_kicker: "生命时间轴 · 大运",
  tl_title: "你人生展开的十年",
  tl_hint: "悬停任一十年段。每个大运周期都有自己的主题，源自八字大运与印度占星 Dashā。",
  tl_now: "你现在在这里",
  tl_age: "岁",
  ke_kicker: "人生关键节点",
  ke_title: "用你真实的人生验证命盘",
  ke_hint: "输入两到三个真实转折点，图书馆会指出命盘早已承载它们的方式。",
  ke_year: "年份",
  ke_event_ph: "例：离开家乡 / 转行 / 遇见伴侣…",
  ke_add: "+ 再加一条",
  ke_verify: "与我的命盘核对",
  ke_verified: "命盘的运势节奏与此事件吻合。",
  ke_note: "这是一次私密的核对。除非你主动核对，任何内容都不会外传。",
  mem_kicker: "让解读更深一层",
  mem_title: "会员计划",
  mem_free: "求索者",
  mem_free_desc: "你正在查看的综合解读。永久免费。",
  mem_sage: "贤者",
  mem_sage_desc: "完整 PDF 报告 · 生命时间轴精解 · 12 个月运势推演。",
  mem_oracle: "神谕者",
  mem_oracle_desc: "包含贤者所有权益 · 无限 AI 追问对话 · 优先计算。",
  mem_current: "当前计划",
  mem_upgrade: "升级",
  mem_export_pdf: "导出 PDF 报告",
  mem_ai_followup: "向神谕者提问",
  mem_ai_followup_desc: "与阅读过你命盘的 AI 私下对话。就任一维度追问下去。",
  mem_ai_locked: "神谕者会员专属",
  mem_ai_open: "开启对话",
  mem_ai_placeholder: "对你的解读提一个问题…",
  mem_ai_send: "发送",
  mem_ai_upsell: "AI 追问是「神谕者」会员的权益。升级后即可继续与图书馆对话。",
  mem_close: "关闭",
};

const DICTS: Record<Lang, Dict> = { en, zh };

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: Dict };
const LangCtx = createContext<Ctx | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("lod.lang");
      if (stored === "en" || stored === "zh") setLangState(stored);
    } catch {}
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem("lod.lang", l);
    } catch {}
  };

  return (
    <LangCtx.Provider value={{ lang, setLang, t: DICTS[lang] }}>{children}</LangCtx.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LangCtx);
  if (!ctx) throw new Error("useLang must be used within LanguageProvider");
  return ctx;
}
