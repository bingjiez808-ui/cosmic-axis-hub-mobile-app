import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

import treeImg from "@/assets/tree-of-destiny.jpg";
import { generateReport } from "@/lib/report.functions";
import { buildReportCacheKey, buildReportFingerprint, buildReportRequest } from "@/lib/report-input";
import { useHydratedChartSearch } from "@/lib/chart-hydration";
import { missingFields, type RitualState } from "@/lib/ritual-validation";

type SearchParams = {
  name?: string;
  date?: string;
  time?: string;
  place?: string;
  lang?: "en" | "zh";
  quiz?: string;
  bazi?: string;
  zodiac?: string;
  lunar?: string;
  readingId?: string;
  gender?: "male" | "female";
  role?: "self" | "other";
  relationship?: string;
  relationshipLabel?: string;
  primaryIntent?: "replace" | "keep" | "auto";
};

export const Route = createFileRoute("/synthesis")({
  head: () => ({
    meta: [
      { title: "Synthesis in progress — Library of Destiny" },
      {
        name: "description",
        content:
          "The AI is weaving four traditions into a single reading of your life.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): SearchParams => ({
    name: typeof s.name === "string" ? s.name : undefined,
    date: typeof s.date === "string" ? s.date : undefined,
    time: typeof s.time === "string" ? s.time : undefined,
    place: typeof s.place === "string" ? s.place : undefined,
    lang: s.lang === "zh" ? "zh" : s.lang === "en" ? "en" : undefined,
    quiz: typeof s.quiz === "string" ? s.quiz : undefined,
    bazi: typeof s.bazi === "string" ? s.bazi : undefined,
    zodiac: typeof s.zodiac === "string" ? s.zodiac : undefined,
    lunar: typeof s.lunar === "string" ? s.lunar : undefined,
    readingId: typeof s.readingId === "string" ? s.readingId : undefined,
    gender: s.gender === "male" ? "male" : s.gender === "female" ? "female" : undefined,
    role: s.role === "self" ? "self" : s.role === "other" ? "other" : undefined,
    relationship: typeof s.relationship === "string" ? s.relationship : undefined,
    relationshipLabel: typeof s.relationshipLabel === "string" ? s.relationshipLabel : undefined,
    primaryIntent:
      s.primaryIntent === "replace" || s.primaryIntent === "keep" || s.primaryIntent === "auto"
        ? s.primaryIntent
        : undefined,
  }),
  component: SynthesisPage,
});


const PHASES_EN = [
  { label: "Lighting the four candles", detail: "The elders take their seats around the table" },
  { label: "The Western elder unrolls the wheel", detail: "Sun, Moon and Ascendant answer their names" },
  { label: "The Vedic elder draws the mandala", detail: "27 lunar mansions kneel into the circle" },
  { label: "The Chinese elder casts the four pillars", detail: "Ten stems, twelve branches, five breaths" },
  { label: "The purple elder opens the twelve palaces", detail: "Fourteen stars step through the gates" },
  { label: "The four voices become one whisper", detail: "Your reading is being written by candlelight" },
];

const PHASES_ZH = [
  { label: "四盏烛火依次亮起", detail: "四方长者围坐入席" },
  { label: "西方长者展开命轮", detail: "日月上升,一一应名" },
  { label: "印度长者绘制曼陀罗", detail: "二十七宿俯身入圈" },
  { label: "中原长者摆布四柱", detail: "十干十二支,五行相应" },
  { label: "紫微长者开启十二宫", detail: "十四主星,依次入宫" },
  { label: "四方之声化作低语", detail: "你的命盘正被烛下缓缓写就" },
];

const HEADLINE = {
  en: "The four elders are speaking your name…",
  zh: "四方长者正在低声唤你之名……",
};
const KICKER = {
  en: (name?: string) => (name ? `Summoning ${name}` : "Summoning the reading"),
  zh: (name?: string) => (name ? `召唤 ${name} 的命盘` : "召唤命盘"),
};
const PASSAGES = { en: "rites", zh: "礼" };

function SynthesisPage() {
  const rawSearch = Route.useSearch();
  const search = (useHydratedChartSearch(rawSearch) ?? rawSearch) as typeof rawSearch;
  const navigate = useNavigate();
  const [phase, setPhase] = useState(0);
  const [reportReady, setReportReady] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const lang: "en" | "zh" = search.lang === "zh" ? "zh" : "en";
  const phases = lang === "zh" ? PHASES_ZH : PHASES_EN;
  const reportFingerprint = buildReportFingerprint(search, lang);

  // URL-level guard: even if a user bookmarks /synthesis, refreshes,
  // pastes an incomplete URL, or manipulates state to skip the ritual,
  // re-run the same missingFields validator here and bounce back to
  // /ritual before we ever call the generator or persist anything.
  useEffect(() => {
    const state: RitualState = {
      ownerRole: search.role === "self" || search.role === "other" ? search.role : "",
      relationship: (search.relationship as RitualState["relationship"]) ?? "",
      name: search.name ?? "",
      date: search.date ?? "",
      time: search.time ?? "",
      place: search.place ?? "",
      gender: search.gender ?? "",
      genderChosen: search.gender === "male" || search.gender === "female" || search.gender === undefined ? search.gender !== undefined || false : true,
    };
    // gender: allow undefined only if the ritual explicitly stored a
    // "prefer not to say" choice; the ritual only omits `gender` for
    // that case, so we can't tell here — accept it and rely on the
    // ritual's own explicit-pick UX.
    state.genderChosen = true;
    if (missingFields(state, lang).length > 0) {
      navigate({ to: "/ritual", replace: true } as never);
    }
  }, [search, lang, navigate]);

  useEffect(() => {
    if (!search.date) {
      setReportReady(true);
      return;
    }

    let cancelled = false;
    setReportReady(false);
    setReportError(null);
    const cacheKey = buildReportCacheKey(search, lang);
    const cached = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(cacheKey) : null;
    if (cached && retryTick === 0) {
      setReportReady(true);
      return;
    }
    if (retryTick > 0) {
      try { sessionStorage.removeItem(cacheKey); } catch {}
    }

    generateReport({ data: buildReportRequest(search, lang) })
      .then((res) => {
        if (cancelled) return;
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(res));
        } catch {
          /* ignore quota */
        }
        setReportReady(true);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setReportError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      cancelled = true;
    };
  }, [lang, reportFingerprint, search, retryTick]);

  useEffect(() => {
    const total = phases.length;
    const perPhase = 1800;
    const interval = setInterval(() => {
      setPhase((p) => {
        if (p >= total - 1) {
          clearInterval(interval);
          return p;
        }
        return p + 1;
      });
    }, perPhase);
    return () => clearInterval(interval);
  }, [phases.length]);

  useEffect(() => {
    if (phase < phases.length - 1 || !reportReady) return;
    const timer = setTimeout(() => {
      navigate({
        to: "/report",
        search: () => search as never,
      });
    }, 900);
    return () => clearTimeout(timer);
  }, [navigate, phase, phases.length, reportReady, search]);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pt-32 pb-24 text-center">
      {/* Rotating rings */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="h-[720px] w-[720px] rounded-full border border-white/5 animate-slow-rotate" />
        <div className="absolute left-1/2 top-1/2 h-[540px] w-[540px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-gold-dust/15 animate-slow-rotate-reverse" />
        <div className="absolute left-1/2 top-1/2 h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-nebula-purple/25 animate-slow-rotate" />
      </div>

      {/* Tree */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 2, ease: [0.32, 0.72, 0, 1] }}
        className="relative z-10 mb-12"
      >
        <div className="relative size-72 md:size-96">
          <div className="absolute inset-0 rounded-full bg-gold-dust/10 blur-3xl animate-pulse-gold" />
          <img
            src={treeImg}
            alt=""
            width={1280}
            height={1280}
            decoding="async"
            fetchPriority="high"
            className="relative size-full rounded-full object-cover opacity-80"
          />
        </div>
      </motion.div>

      <div className="relative z-10 max-w-xl">
        <p className="mb-4 text-[10px] uppercase tracking-[0.42em] text-gold-dust">
          {KICKER[lang](search.name)}
        </p>
        <h1 className="mb-14 font-serif text-3xl italic leading-tight text-stone-warm md:text-4xl">
          {HEADLINE[lang]}
        </h1>

        <div className="mb-10 h-16">
          <AnimatePresence mode="wait">
            <motion.div
              key={phase}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.6 }}
            >
              <p className="mb-1 font-serif text-lg text-gold-light">
                {phases[phase].label}
              </p>
              <p className="text-xs uppercase tracking-[0.32em] text-stone-warm/40">
                {phases[phase].detail}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Progress bar */}
        <div className="mx-auto h-px w-64 overflow-hidden bg-white/10">
          <motion.div
            className="h-full bg-gold-dust"
            initial={{ width: 0 }}
            animate={{ width: `${((phase + 1) / phases.length) * 100}%` }}
            transition={{ duration: 1.2, ease: [0.32, 0.72, 0, 1] }}
          />
        </div>
        <p className="mt-4 text-[10px] uppercase tracking-[0.32em] text-stone-warm/40">
          {phase + 1} / {phases.length} {PASSAGES[lang]}
        </p>

        {reportError && (
          <div className="mx-auto mt-10 max-w-md rounded-2xl border border-red-300/30 bg-red-500/5 p-5 text-left">
            <p className="text-[10px] uppercase tracking-[0.32em] text-red-300/80">
              {lang === "zh" ? "召唤未能完成" : "The rite was interrupted"}
            </p>
            <p className="mt-2 text-sm italic text-stone-warm/70">
              {lang === "zh"
                ? "长者的低语被风打断了。你可以再次尝试，或先看通用模板。"
                : "The elders' whisper was broken by wind. Try again, or continue with the template."}
            </p>
            <p className="mt-2 text-[10px] tracking-[0.14em] text-stone-warm/40">{reportError}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setRetryTick((n) => n + 1)}
                className="rounded-full border border-gold-dust/40 px-5 py-2 text-[10px] uppercase tracking-[0.28em] text-gold-dust transition-colors hover:bg-gold-dust/10"
              >
                {lang === "zh" ? "重新召唤" : "Retry"}
              </button>
              <button
                type="button"
                onClick={() => setReportReady(true)}
                className="rounded-full border border-white/15 px-5 py-2 text-[10px] uppercase tracking-[0.28em] text-stone-warm/70 transition-colors hover:border-gold-dust/40 hover:text-gold-dust"
              >
                {lang === "zh" ? "先看通用模板" : "Continue with template"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


