import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";

import { CityCombobox } from "@/components/CityCombobox";
import { useLang, type Lang } from "@/lib/i18n";

export const Route = createFileRoute("/ritual")({
  head: () => ({
    meta: [
      { title: "The Ritual — Library of Destiny" },
      {
        name: "description",
        content:
          "The intake ritual for your unified reading. Choose your language, answer five calibration questions, then share the coordinates of your first breath.",
      },
    ],
  }),
  component: RitualPage,
});

type FieldKey = "name" | "date" | "time" | "place";

// -------- 5 psychology-inspired calibration questions --------
// Not tests, no right answers — used to nudge the AI reading toward the user.
type QuizOption = { id: string; label: [string, string] };
type QuizQ = {
  key: "character" | "study" | "vocation" | "love" | "health";
  kicker: [string, string];
  prompt: [string, string];
  options: QuizOption[]; // 4 options each
};

const QUIZ: QuizQ[] = [
  {
    key: "character",
    kicker: ["Q1 · Character", "第一题 · 性格"],
    prompt: [
      "Late at night, alone, you are most often —",
      "深夜独处时，你更常做的是 ——",
    ],
    options: [
      { id: "A", label: ["Replaying today's conversations, wondering how they could have gone better.", "回放白天的对话，想哪里可以更好。"] },
      { id: "B", label: ["Writing tomorrow's plan or to-do list.", "为明天写清单或计划。"] },
      { id: "C", label: ["Going straight to sleep, no need to review anything.", "直接入睡，不必复盘。"] },
      { id: "D", label: ["Reading something unrelated to quiet the mind.", "读点无关的东西让脑子安静下来。"] },
    ],
  },
  {
    key: "study",
    kicker: ["Q2 · How you learn", "第二题 · 学习方式"],
    prompt: [
      "Facing a field you don't know, you first —",
      "面对完全不熟的领域，你第一反应是 ——",
    ],
    options: [
      { id: "A", label: ["Pick the thickest book and read from the beginning.", "找最厚的一本书从头读。"] },
      { id: "B", label: ["Just start doing it and fix mistakes as they come.", "直接动手，出错再修。"] },
      { id: "C", label: ["Find someone who already gets it and ask for directions.", "找懂的人问路。"] },
      { id: "D", label: ["Observe quietly for a while before committing.", "先观察一阵子再决定。"] },
    ],
  },
  {
    key: "vocation",
    kicker: ["Q3 · Vocation", "第三题 · 事业"],
    prompt: [
      "You're pushed to lead something important that you're not good at yet —",
      "你被推去负责一件重要但不擅长的事，你 ——",
    ],
    options: [
      { id: "A", label: ["Accept it and study all night to catch up.", "接下来，连夜恶补。"] },
      { id: "B", label: ["Negotiate conditions and resources first.", "先谈条件与资源。"] },
      { id: "C", label: ["Decline politely and hand it to someone better suited.", "婉拒，让更合适的人做。"] },
      { id: "D", label: ["Accept, but quietly stay anxious for a long time.", "接下来，但暗自焦虑很久。"] },
    ],
  },
  {
    key: "love",
    kicker: ["Q4 · Love", "第四题 · 情感"],
    prompt: [
      "Someone you like hasn't replied for a few days —",
      "喜欢的人几天没回消息，你 ——",
    ],
    options: [
      { id: "A", label: ["Act as if nothing happened, wait for them to speak first.", "假装若无其事，等对方先开口。"] },
      { id: "B", label: ["Ask them directly what's going on.", "直接问：发生什么了。"] },
      { id: "C", label: ["Re-read every message wondering if you said something wrong.", "反复回看是不是自己说错了。"] },
      { id: "D", label: ["Redirect your attention elsewhere and let it unfold.", "把注意力挪到别处，让它自己发展。"] },
    ],
  },
  {
    key: "health",
    kicker: ["Q5 · Health & pressure", "第五题 · 健康与压力"],
    prompt: [
      "In your most stressful week you're most likely to —",
      "压力最大的那一周，你更可能 ——",
    ],
    options: [
      { id: "A", label: ["Push through, sleeping less until the project is done.", "熬夜硬撑到项目结束。"] },
      { id: "B", label: ["Force yourself to sleep on time but drift in the daytime.", "强迫自己按时睡，白天却走神。"] },
      { id: "C", label: ["Only recover after venting to someone you trust.", "找人倾诉之后才缓过来。"] },
      { id: "D", label: ["Reset fast through exercise or solitude.", "用运动 / 独处快速清零。"] },
    ],
  },
];

function RitualPage() {
  const navigate = useNavigate();
  const { lang, setLang, t } = useLang();
  const li = lang === "zh" ? 1 : 0;

  const [values, setValues] = useState<Record<FieldKey, string>>({
    name: "",
    date: "",
    time: "",
    place: "",
  });
  const [quiz, setQuiz] = useState<string[]>(["", "", "", "", ""]);
  // 0 = language, 1..5 = quiz Q1..Q5, 6..9 = intake
  const [step, setStep] = useState(0);

  const totalSteps = 1 + QUIZ.length + 4; // 10

  const questionSteps: {
    key: FieldKey;
    prompt: string;
    hint: string;
    placeholder: string;
    input: "text" | "date" | "time";
  }[] = [
    { key: "name", prompt: t.q_name, hint: t.q_name_hint, placeholder: t.q_name_ph, input: "text" },
    { key: "date", prompt: t.q_date, hint: t.q_date_hint, placeholder: "", input: "date" },
    { key: "time", prompt: t.q_time, hint: t.q_time_hint, placeholder: "", input: "time" },
    { key: "place", prompt: t.q_place, hint: t.q_place_hint, placeholder: t.q_place_ph, input: "text" },
  ];

  const progress = useMemo(() => (step + 1) / totalSteps, [step, totalSteps]);
  const isLast = step === totalSteps - 1;
  const isLanguageStep = step === 0;
  const isQuizStep = step >= 1 && step <= QUIZ.length;
  const quizIdx = isQuizStep ? step - 1 : -1;
  const isIntakeStep = step >= 1 + QUIZ.length;
  const intakeIdx = isIntakeStep ? step - (1 + QUIZ.length) : -1;
  const currentQ = isIntakeStep ? questionSteps[intakeIdx] : null;

  const canAdvance = isLanguageStep
    ? true
    : isQuizStep
    ? !!quiz[quizIdx]
    : (values[currentQ!.key] ?? "").trim().length > 0;

  const advance = () => {
    if (!canAdvance) return;
    if (isLast) {
      const params = new URLSearchParams({
        ...values,
        lang,
        quiz: quiz.join(""),
      });
      navigate({ to: "/synthesis", search: () => Object.fromEntries(params) as never });
    } else {
      setStep((s) => s + 1);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-6 pt-32 pb-24">
      {/* Ceremonial rings */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div
          className="rounded-full border border-gold-dust/20 transition-all duration-1000"
          style={{ width: `${520 + step * 60}px`, height: `${520 + step * 60}px` }}
        />
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-nebula-purple/25 transition-all duration-1000"
          style={{ width: `${340 + step * 40}px`, height: `${340 + step * 40}px` }}
        />
      </div>

      <div className="relative z-10 w-full max-w-2xl text-center">
        {/* Progress — language dot · single quiz bar (5 segs) · intake dots */}
        <div className="mb-14 flex items-center justify-center gap-3">
          {/* language */}
          <div
            className={`h-px transition-all duration-700 ${
              step >= 0 ? "w-10 bg-gold-dust" : "w-6 bg-white/15"
            }`}
          />
          <span className="text-[8px] uppercase tracking-[0.32em] text-stone-warm/30">·</span>
          {/* single 5-segment quiz bar */}
          <div className="flex overflow-hidden rounded-full border border-white/10">
            {Array.from({ length: QUIZ.length }).map((_, i) => {
              const reached = step >= 1 + i;
              return (
                <div
                  key={i}
                  className={`h-1.5 w-6 border-r border-white/10 last:border-r-0 transition-all duration-500 ${
                    reached ? "bg-gold-dust" : "bg-white/[0.04]"
                  }`}
                />
              );
            })}
          </div>
          <span className="text-[8px] uppercase tracking-[0.32em] text-stone-warm/30">·</span>
          {/* intake dots */}
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className={`h-px transition-all duration-700 ${
                step >= 1 + QUIZ.length + i ? "w-10 bg-gold-dust" : "w-6 bg-white/15"
              }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
          >
            <p className="mb-6 text-[10px] uppercase tracking-[0.42em] text-gold-dust">
              {t.step_of(step + 1, totalSteps)}
            </p>

            {isLanguageStep && (
              <>
                <h1 className="mx-auto mb-4 max-w-xl font-serif text-3xl italic leading-tight text-stone-warm md:text-5xl">
                  {t.ritual_pick_language}
                </h1>
                <p className="mb-14 text-sm text-stone-warm/50">
                  {t.ritual_pick_language_hint}
                </p>
                <div className="mx-auto flex max-w-md flex-col gap-4">
                  {(
                    [
                      { code: "en", label: "English", native: "The library will speak in English." },
                      { code: "zh", label: "中文", native: "图书馆将以中文与你对话。" },
                    ] as { code: Lang; label: string; native: string }[]
                  ).map((opt) => {
                    const active = lang === opt.code;
                    return (
                      <button
                        key={opt.code}
                        onClick={() => setLang(opt.code)}
                        className={`glass-card flex items-center justify-between rounded-2xl px-6 py-5 text-left transition-all ${
                          active
                            ? "border-gold-dust/60 bg-gold-dust/10"
                            : "hover:border-gold-dust/30"
                        }`}
                      >
                        <div>
                          <p className="font-serif text-xl text-stone-warm">{opt.label}</p>
                          <p className="mt-1 text-xs italic text-stone-warm/50">{opt.native}</p>
                        </div>
                        <span
                          className={`grid size-6 place-items-center rounded-full border transition-colors ${
                            active
                              ? "border-gold-dust bg-gold-dust text-obsidian"
                              : "border-white/20 text-transparent"
                          }`}
                        >
                          ✓
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {isQuizIntro && (
              <>
                <p className="mb-4 text-[10px] uppercase tracking-[0.42em] text-gold-dust">
                  {lang === "zh" ? "校准 · 五题" : "Calibration · five questions"}
                </p>
                <h1 className="mx-auto mb-6 max-w-xl font-serif text-3xl italic leading-tight text-stone-warm md:text-5xl">
                  {lang === "zh"
                    ? "在读你的命盘之前，先读一读你自己。"
                    : "Before we read your chart, let it read you."}
                </h1>
                <p className="mx-auto mb-4 max-w-lg text-sm leading-relaxed text-stone-warm/70">
                  {lang === "zh"
                    ? "接下来五题不是测验，也没有对错。它们的用意，是让 AI 在综合四大体系解读之后，能对你个人的偏差做一次微调 —— 你回答得越诚实，最终的解读就越贴近真正的你。"
                    : "The next five questions are not a test, and there are no right answers. Their only purpose is to let the AI fine-tune the reading against your personal deviations after synthesizing the four traditions — the more honestly you answer, the closer the final reading lands to who you actually are."}
                </p>
                <p className="mx-auto mb-8 max-w-lg text-xs italic text-stone-warm/40">
                  {lang === "zh"
                    ? "问题借鉴心理学的角度设计，看起来平常，实际上在观察你处理压力、亲密与不确定性的默认方式。"
                    : "The questions are borrowed from psychology — they look ordinary, but they quietly reveal how you handle pressure, intimacy, and uncertainty by default."}
                </p>
              </>
            )}

            {isQuizStep && (() => {
              const q = QUIZ[quizIdx];
              return (
                <>
                  <p className="mb-4 text-[10px] uppercase tracking-[0.42em] text-gold-dust">
                    {q.kicker[li]}
                  </p>
                  <h1 className="mx-auto mb-4 max-w-xl font-serif text-2xl italic leading-tight text-stone-warm md:text-4xl">
                    {q.prompt[li]}
                  </h1>
                  <p className="mx-auto mb-10 max-w-md text-xs italic text-stone-warm/40">
                    {lang === "zh"
                      ? "凭第一直觉选一个 —— 用于稍后对解读做偏差修正。"
                      : "Pick the one that feels truest — used later to bias-correct your reading."}
                  </p>
                  <div className="mx-auto flex max-w-lg flex-col gap-3 text-left">
                    {q.options.map((opt) => {
                      const active = quiz[quizIdx] === opt.id;
                      return (
                        <button
                          key={opt.id}
                          onClick={() =>
                            setQuiz((s) => {
                              const next = [...s];
                              next[quizIdx] = opt.id;
                              return next;
                            })
                          }
                          className={`glass-card flex items-start gap-4 rounded-2xl px-5 py-4 text-left transition-all ${
                            active
                              ? "border-gold-dust/60 bg-gold-dust/10"
                              : "hover:border-gold-dust/30"
                          }`}
                        >
                          <span
                            className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border text-[10px] tracking-widest transition-colors ${
                              active
                                ? "border-gold-dust bg-gold-dust text-obsidian"
                                : "border-white/20 text-stone-warm/60"
                            }`}
                          >
                            {opt.id}
                          </span>
                          <span className="text-sm leading-relaxed text-stone-warm/85">
                            {opt.label[li]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              );
            })()}

            {isIntakeStep && currentQ && (
              <>
                <h1 className="mx-auto mb-4 max-w-xl font-serif text-3xl italic leading-tight text-stone-warm md:text-5xl">
                  {currentQ.prompt}
                </h1>
                <p className="mb-14 text-sm text-stone-warm/50">{currentQ.hint}</p>

                {currentQ.key === "place" ? (
                  <CityCombobox
                    value={values.place}
                    onChange={(v) => setValues((s) => ({ ...s, place: v }))}
                    placeholder={currentQ.placeholder}
                    onCommit={advance}
                  />
                ) : (
                  <input
                    key={currentQ.key}
                    autoFocus
                    type={currentQ.input}
                    placeholder={currentQ.placeholder}
                    className="ritual-input mx-auto max-w-md"
                    min={currentQ.input === "date" ? "1900-01-01" : undefined}
                    max={currentQ.input === "date" ? "2099-12-31" : undefined}
                    value={values[currentQ.key]}
                    onChange={(e) => {
                      let val = e.target.value;
                      if (currentQ.input === "date") {
                        const m = val.match(/^(\d+)(-\d{2}-\d{2})?$/);
                        if (m && m[1].length > 4) val = m[1].slice(0, 4) + (m[2] || "");
                      }
                      setValues((v) => ({ ...v, [currentQ.key]: val }));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") advance();
                    }}
                    style={{ colorScheme: "dark" }}
                  />
                )}
              </>
            )}

            <div className="mt-14 flex items-center justify-center gap-4">
              {step > 0 && (
                <button
                  onClick={() => setStep((s) => s - 1)}
                  className="rounded-full border border-white/10 px-6 py-3 text-[10px] uppercase tracking-[0.32em] text-stone-warm/60 transition-colors hover:border-gold-dust/40 hover:text-gold-dust"
                >
                  {t.back}
                </button>
              )}
              <button
                onClick={advance}
                disabled={!canAdvance}
                className="group relative overflow-hidden rounded-full border border-gold-dust/40 px-10 py-3 text-[10px] uppercase tracking-[0.32em] text-gold-dust transition-all hover:border-gold-dust disabled:cursor-not-allowed disabled:opacity-30"
              >
                <span className="relative z-10">
                  {isLast
                    ? t.invoke
                    : isQuizIntro
                    ? lang === "zh"
                      ? "开始五题"
                      : "Begin the five"
                    : t.continue}
                </span>
                <span className="absolute inset-0 translate-y-full bg-gold-dust/10 transition-transform duration-500 group-hover:translate-y-0" />
              </button>
            </div>
          </motion.div>
        </AnimatePresence>

        <p className="mt-24 font-serif text-xs italic text-stone-warm/40">
          {t.progress} · {Math.round(progress * 100)}%
        </p>
      </div>
    </div>
  );
}
