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
};

const DICTS: Record<Lang, Dict> = { en, zh };

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: Dict };
const LangCtx = createContext<Ctx | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  // Client-side hydration from localStorage (avoids SSR hydration mismatch)
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
