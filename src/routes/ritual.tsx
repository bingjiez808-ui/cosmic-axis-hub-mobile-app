import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

import { CityCombobox } from "@/components/CityCombobox";
import { useLang } from "@/lib/i18n";
import { solarToLunarInfo } from "@/lib/lunar";
import { noOrphan } from "@/lib/typography";
import { listUserCharts } from "@/lib/reports-store.functions";
import {
  FIELD_STEP,
  firstMissingStep,
  missingFields,
  nameStepCopy,
  validateField,
  type RitualState,
} from "@/lib/ritual-validation";


const RITUAL_STATE_KEY = "lod:ritual-draft-v2";

export const Route = createFileRoute("/ritual")({
  head: () => ({
    meta: [
      { title: "The Ritual — Library of Destiny" },
      {
        name: "description",
        content:
          "The intake ritual for your unified reading. Choose your language, answer five calibration questions, then share the coordinates of your first breath.",
      },
      { property: "og:title", content: "The Ritual — Library of Destiny" },
      { property: "og:description", content: "Begin the intake ritual for your unified reading." },
      { property: "og:url", content: "https://fate-nexus-ai.lovable.app/ritual" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "The Ritual — Library of Destiny" },
      { name: "twitter:description", content: "Begin the intake ritual for your unified reading." },
    ],
    links: [{ rel: "canonical", href: "https://fate-nexus-ai.lovable.app/ritual" }],
  }),
  component: RitualPage,
});

type FieldKey = "name" | "date" | "time" | "place" | "gender";
type Gender = "male" | "female" | "";
type OwnerRole = "self" | "other" | "";
type Relationship = "partner" | "family" | "friend" | "colleague" | "other" | "";

const RELATIONSHIP_LABELS: Record<Exclude<Relationship, "">, [string, string]> = {
  partner: ["Partner", "伴侣"],
  family: ["Family", "家人"],
  friend: ["Friend", "朋友"],
  colleague: ["Colleague", "同事"],
  other: ["Other", "其他"],
};

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
  const { lang, t } = useLang();
  const li = lang === "zh" ? 1 : 0;

  const [values, setValues] = useState<Record<FieldKey, string>>({
    name: "",
    date: "",
    time: "",
    place: "",
    gender: "",
  });
  // `gender: ""` in `values` starts unset. Users must click an explicit
  // option — including "prefer not to say" — before advancing.
  const [genderChosen, setGenderChosen] = useState(false);
  // Ownership: this chart is mine, or someone else's? Never defaults —
  // must be explicitly chosen so the DB row is filed correctly.
  const [ownerRole, setOwnerRole] = useState<OwnerRole>("");
  const [relationship, setRelationship] = useState<Relationship>("");
  const [quiz] = useState<string[]>(["", "", "", "", ""]);
  const [step, setStep] = useState(0);
  const skipQuiz = true;
  const [restored, setRestored] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [primaryConflict, setPrimaryConflict] = useState<URLSearchParams | null>(null);
  const [submitting, setSubmitting] = useState(false);


  // Restore draft from sessionStorage (client-only, avoids hydration mismatch)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(RITUAL_STATE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && typeof s === "object") {
          if (s.values) setValues((v) => ({ ...v, ...s.values }));
          if (typeof s.step === "number") setStep(Math.max(0, Math.min(s.step, 5)));
          if (s.ownerRole === "self" || s.ownerRole === "other") setOwnerRole(s.ownerRole);
          if (typeof s.relationship === "string" && s.relationship in RELATIONSHIP_LABELS) {
            setRelationship(s.relationship as Relationship);
          }
          if (s.genderChosen === true) setGenderChosen(true);
        }
      }
    } catch {}
    setRestored(true);
  }, []);

  // Persist on change
  useEffect(() => {
    if (!restored) return;
    try {
      sessionStorage.setItem(
        RITUAL_STATE_KEY,
        JSON.stringify({ values, quiz, step, skipQuiz, ownerRole, relationship, genderChosen }),
      );
    } catch {}
  }, [values, quiz, step, skipQuiz, restored, ownerRole, relationship, genderChosen]);

  const OWNERSHIP_STEP_COUNT = 1;
  const totalSteps = OWNERSHIP_STEP_COUNT + 5;

  const ritualState: RitualState = {
    ownerRole,
    relationship,
    name: values.name,
    date: values.date,
    time: values.time,
    place: values.place,
    gender: values.gender as RitualState["gender"],
    genderChosen,
  };

  const questionSteps: {
    key: FieldKey;
    prompt: string;
    hint: string;
    placeholder: string;
    input: "text" | "date" | "time" | "gender";
  }[] = [
    {
      key: "name",
      // Dynamic: for "other" this becomes a private-nickname prompt so
      // the user doesn't feel forced to type the other person's real name.
      prompt: nameStepCopy(lang, ownerRole).prompt,
      hint: nameStepCopy(lang, ownerRole).hint,
      placeholder: nameStepCopy(lang, ownerRole).placeholder,
      input: "text",
    },
    { key: "date", prompt: t.q_date, hint: t.q_date_hint, placeholder: "", input: "date" },
    { key: "time", prompt: t.q_time, hint: t.q_time_hint, placeholder: "", input: "time" },
    { key: "gender", prompt: t.q_gender, hint: t.q_gender_hint, placeholder: "", input: "gender" },
    { key: "place", prompt: t.q_place, hint: t.q_place_hint, placeholder: t.q_place_ph, input: "text" },
  ];

  const progress = useMemo(() => (step + 1) / totalSteps, [step, totalSteps]);
  const isLast = step === totalSteps - 1;
  const isOwnershipStep = step === 0;
  const isIntakeStep = step >= OWNERSHIP_STEP_COUNT;
  const intakeIdx = isIntakeStep ? step - OWNERSHIP_STEP_COUNT : -1;
  const currentQ = isIntakeStep ? questionSteps[intakeIdx] : null;
  // Quiz retired — retained variables to preserve existing render/progress code.
  const isQuizStep = false;

  /**
   * Per-step validation. Ownership step checks owner then relationship
   * in that order so the message reflects the first *actually* missing
   * field — clicking "other" without a relationship must NOT keep
   * showing "please pick ownership".
   */
  const validateCurrentStep = (): string | null => {
    if (isOwnershipStep) {
      return (
        validateField("owner", ritualState, lang) ??
        validateField("relationship", ritualState, lang)
      );
    }
    if (isQuizStep) return null;
    if (!currentQ) return null;
    return validateField(currentQ.key as never, ritualState, lang);
  };

  const canAdvance = validateCurrentStep() === null;

  const advance = async () => {
    const err = validateCurrentStep();
    if (err) {
      setFieldError(err);
      requestAnimationFrame(() => {
        const el = document.querySelector<HTMLElement>("[data-ritual-field]");
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      return;
    }
    setFieldError(null);
    if (isLast) {
      if (submitting) return;
      const miss = missingFields(ritualState, lang);
      if (miss.length > 0) {
        const jumpTo = firstMissingStep(ritualState, lang);
        const firstMsg = validateField(miss[0], ritualState, lang);
        setFieldError(
          (lang === "zh"
            ? `还有 ${miss.length} 项需要补充。`
            : `${miss.length} field${miss.length > 1 ? "s" : ""} still need attention.`) +
            (firstMsg ? " " + firstMsg : ""),
        );
        if (jumpTo >= 0 && jumpTo !== step) setStep(jumpTo);
        return;
      }
      const info = solarToLunarInfo(values.date, values.time);
      const gender = values.gender === "male" || values.gender === "female" ? values.gender : "";
      const relLabel = ownerRole === "other" && relationship
        ? RELATIONSHIP_LABELS[relationship as Exclude<Relationship, "">][li]
        : "";
      const params = new URLSearchParams({
        name: values.name,
        date: values.date,
        time: values.time,
        place: values.place,
        ...(gender ? { gender } : {}),
        lang,
        quiz: quiz.join(""),
        role: ownerRole,
        ...(relationship ? { relationship } : {}),
        ...(relLabel ? { relationshipLabel: relLabel } : {}),
        readingId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        ...(info
          ? {
              bazi: info.bazi,
              ganzhiYear: info.ganzhiYear,
              ganzhiMonth: info.ganzhiMonth,
              ganzhiDay: info.ganzhiDay,
              ganzhiHour: info.ganzhiHour ?? "",
              zodiac: info.zodiac,
              lunar: info.lunarZh,
            }
          : {}),
      });

      // If claiming this as "my chart" and a primary self-chart already
      // exists, ask the user how to resolve the collision instead of
      // silently overriding. Anonymous users / errors → proceed normally
      // (they'll auth on /report; no primary yet).
      if (ownerRole === "self") {
        setSubmitting(true);
        try {
          const charts = await listUserCharts();
          const hasPrimarySelf = charts.some(
            (c) => c.is_primary && c.chart_role === "self",
          );
          if (hasPrimarySelf) {
            setPrimaryConflict(params);
            setSubmitting(false);
            return;
          }
        } catch {
          /* anonymous or transient — fall through to normal navigation */
        }
        setSubmitting(false);
      }

      try { sessionStorage.removeItem(RITUAL_STATE_KEY); } catch {}
      navigate({ to: "/synthesis", search: () => Object.fromEntries(params) as never });
    } else {
      setStep((s) => s + 1);
    }
  };

  const resolvePrimaryConflict = (intent: "replace" | "keep") => {
    if (!primaryConflict) return;
    const params = new URLSearchParams(primaryConflict);
    params.set("primaryIntent", intent);
    try { sessionStorage.removeItem(RITUAL_STATE_KEY); } catch {}
    setPrimaryConflict(null);
    navigate({ to: "/synthesis", search: () => Object.fromEntries(params) as never });
  };


  // Clear stale error when the user moves to a different step. Errors
  // should never survive step navigation.
  useEffect(() => {
    setFieldError(null);
  }, [step]);
  // When ANY field on the current step changes, recompute the current
  // step's error. Previously this only cleared — leaving a stale
  // "please pick ownership" message visible after the user picked
  // "other" but hadn't yet picked a relationship. Now the message
  // always reflects the current first-missing field on this step, and
  // clears entirely once the step is fully valid.
  useEffect(() => {
    if (!fieldError) return;
    setFieldError(validateCurrentStep());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, genderChosen, ownerRole, relationship]);
  // Suppress unused warning for FIELD_STEP re-export used only in tests.
  void FIELD_STEP;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-x-hidden px-6 pt-32 pb-24">
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
        {/* Progress — quiz bar (5 segs, hidden if skipped) · intake dots */}
        <div className="mb-14 flex items-center justify-center gap-3">
          {!skipQuiz && (
            <>
              <div className="flex overflow-hidden rounded-full border border-white/10">
                {Array.from({ length: QUIZ.length }).map((_, i) => {
                  const reached = step >= i;
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
            </>
          )}
          {/* intake dots */}
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-px transition-all duration-700 ${
                step >= i ? "w-10 bg-gold-dust" : "w-6 bg-white/15"
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



            {/* Quiz retired — intake step only. */}

            {isOwnershipStep && (
              <div data-ritual-field>
                <h1 className="mx-auto mb-4 max-w-xl text-balance font-serif text-3xl italic leading-tight text-stone-warm md:text-5xl">
                  {lang === "zh" ? "这张命盘属于谁？" : "Whose chart is this?"}
                </h1>
                <p className="mx-auto mb-10 max-w-md text-sm text-stone-warm/50">
                  {lang === "zh"
                    ? "此选择只保存在你的个人书架里；不会通知对方，也不会公开数据。真正的好友、聊天、共享与匹配仍需双方授权。"
                    : "Your choice is kept privately in your personal library. Nobody is notified and no data is shared. Real friends, chat, sharing and matching still require both parties to consent."}
                </p>
                <div role="radiogroup" aria-label={lang === "zh" ? "命盘归属" : "Chart ownership"} className="mx-auto flex max-w-md flex-col gap-3">
                  {(["self", "other"] as const).map((r) => {
                    const active = ownerRole === r;
                    const label = r === "self"
                      ? (lang === "zh" ? "我的命盘（首次生成将设为我的主命盘）" : "My chart (first one becomes my primary)")
                      : (lang === "zh" ? "他人命盘（保存到关系与适配）" : "Someone else's chart (saved to Relationships)");
                    return (
                      <button
                        key={r}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setOwnerRole(r)}
                        className={`min-h-[48px] rounded-2xl border px-5 py-3 text-left text-[12px] leading-relaxed transition-colors ${
                          active
                            ? "border-gold-dust bg-gold-dust/10 text-gold-light"
                            : "border-white/15 text-stone-warm/70 hover:border-gold-dust/40 hover:text-gold-dust"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                {ownerRole === "other" && (
                  <div className="mx-auto mt-6 max-w-md">
                    <p className="mb-3 text-[11px] uppercase tracking-[0.28em] text-stone-warm/60">
                      {lang === "zh" ? "关系（必选）" : "Relationship (required)"}
                    </p>
                    <div role="radiogroup" aria-label={lang === "zh" ? "关系类型" : "Relationship type"} className="flex flex-wrap justify-center gap-2">
                      {(Object.keys(RELATIONSHIP_LABELS) as Array<Exclude<Relationship, "">>).map((rel) => {
                        const active = relationship === rel;
                        return (
                          <button
                            key={rel}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => setRelationship(rel)}
                            className={`min-h-[40px] rounded-full border px-4 py-2 text-[11px] uppercase tracking-[0.24em] transition-colors ${
                              active
                                ? "border-gold-dust bg-gold-dust/10 text-gold-light"
                                : "border-white/15 text-stone-warm/70 hover:border-gold-dust/40 hover:text-gold-dust"
                            }`}
                          >
                            {RELATIONSHIP_LABELS[rel][li]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {fieldError && (
                  <p role="alert" data-testid="ritual-field-error" className="mx-auto mt-6 max-w-md rounded-lg border border-rose-400/40 bg-rose-500/10 px-4 py-2 text-left text-[12px] leading-relaxed text-rose-100">
                    {fieldError}
                  </p>
                )}
              </div>
            )}

            {isIntakeStep && currentQ && (
              <>
                <h1 className="mx-auto mb-4 max-w-xl text-balance font-serif text-3xl italic leading-tight text-stone-warm md:text-5xl" style={{ wordBreak: "keep-all", overflowWrap: "break-word" }}>
                  {noOrphan(currentQ.prompt)}
                </h1>
                <p className="mb-14 text-sm text-stone-warm/50">{currentQ.hint}</p>

                {currentQ.key === "place" ? (
                  <div data-ritual-field>
                    <CityCombobox
                      value={values.place}
                      onChange={(v) => setValues((s) => ({ ...s, place: v }))}
                      placeholder={currentQ.placeholder}
                      onCommit={advance}
                    />
                  </div>
                ) : currentQ.key === "gender" ? (
                  <div className="mx-auto max-w-md" data-ritual-field>
                    <div role="radiogroup" aria-label={t.q_gender} className="flex flex-wrap justify-center gap-3">
                      {(["male", "female", ""] as Gender[]).map((g) => {
                        const label =
                          g === "male" ? t.q_gender_male : g === "female" ? t.q_gender_female : t.q_gender_skip;
                        const active = genderChosen && values.gender === g;
                        return (
                          <button
                            key={g || "skip"}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => {
                              setValues((v) => ({ ...v, gender: g }));
                              setGenderChosen(true);
                            }}
                            className={`min-h-[44px] rounded-full border px-6 py-2.5 text-[11px] uppercase tracking-[0.28em] transition-colors ${
                              active
                                ? "border-gold-dust bg-gold-dust/10 text-gold-light"
                                : "border-white/15 text-stone-warm/70 hover:border-gold-dust/40 hover:text-gold-dust"
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                    {genderChosen && values.gender === "" && (
                      <p className="mx-auto mt-4 max-w-md rounded-2xl border border-nebula-purple/30 bg-nebula-purple/[0.06] p-3 text-left text-[11.5px] leading-relaxed text-stone-warm/70">
                        ⚠ {t.q_gender_skip_warn}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="mx-auto max-w-md" data-ritual-field>
                    <input
                      key={currentQ.key}
                      autoFocus
                      type={currentQ.input}
                      placeholder={currentQ.placeholder}
                      className="ritual-input w-full"
                      aria-invalid={fieldError ? true : undefined}
                      aria-describedby={fieldError ? "ritual-error" : undefined}
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
                    {currentQ.key === "time" && (
                      <p className="mt-3 text-[10px] uppercase tracking-[0.32em] text-stone-warm/40">
                        {lang === "zh"
                          ? "准确出生时间是生成完整四体系报告的前提。"
                          : "An accurate birth time is required for the full four-tradition reading."}
                      </p>
                    )}
                    {currentQ.input === "date" && (() => {
                      const info = solarToLunarInfo(values.date, values.time);
                      if (!info) {
                        return (
                          <p className="mt-3 text-[10px] uppercase tracking-[0.32em] text-stone-warm/40">
                            {lang === "zh" ? "默认为阳历 · 输入后自动换算农历" : "Solar (Gregorian) by default · lunar auto-derived"}
                          </p>
                        );
                      }
                      return (
                        <div className="mt-4 rounded-2xl border border-gold-dust/25 bg-gold-dust/[0.05] p-3 text-left">
                          <p className="text-[10px] uppercase tracking-[0.32em] text-gold-dust/80">
                            {lang === "zh" ? "农历自动换算" : "Lunar (auto-converted)"}
                          </p>
                          <p className="mt-1 font-serif text-sm italic text-stone-warm/90">
                            {lang === "zh" ? info.lunarZh : info.lunarEn}
                          </p>
                          <p className="mt-1 text-[11px] tracking-[0.14em] text-stone-warm/60">
                            {lang === "zh" ? "生肖" : "Zodiac"} · {info.zodiac} / {info.zodiacEn}
                          </p>
                          <p className="mt-1 text-[11px] tracking-[0.14em] text-stone-warm/60">
                            {lang === "zh" ? "八字（干支）" : "BaZi pillars"} · {info.bazi}
                            {!info.ganzhiHour && (lang === "zh" ? "（时柱需出生时刻）" : " (hour pillar needs birth time)")}
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                )}
                {fieldError && (
                  <p
                    role="alert"
                    data-testid="ritual-field-error"
                    className="mx-auto mt-4 max-w-md rounded-lg border border-rose-400/40 bg-rose-500/10 px-4 py-2 text-left text-[12px] leading-relaxed text-rose-100"
                  >
                    {fieldError}
                  </p>
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
                
                className="group relative overflow-hidden rounded-full border border-gold-dust/40 px-10 py-3 text-[10px] uppercase tracking-[0.32em] text-gold-dust transition-all hover:border-gold-dust "
              >
                <span className="relative z-10">
                  {isLast ? t.invoke : t.continue}
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
      {primaryConflict && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="primary-conflict-title"
          data-testid="ritual-primary-conflict"
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-4"
          onKeyDown={(e) => { if (e.key === "Escape") setPrimaryConflict(null); }}
        >
          <div className="w-full max-w-md rounded-2xl border border-gold-dust/30 bg-[#0a0a12] p-6 text-stone-warm shadow-2xl">
            <h2 id="primary-conflict-title" className="font-serif text-lg text-gold-light">
              {lang === "zh" ? "你已有一张主命盘" : "You already have a primary chart"}
            </h2>
            <p className="mt-2 text-sm text-stone-warm/75">
              {lang === "zh"
                ? "这张新的「我的命盘」希望如何处理？旧的主命盘不会被删除，只会被降级为其他命盘。"
                : "How should this new 'my chart' be filed? Your existing primary won't be deleted — it will be kept as one of your other charts."}
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                data-testid="ritual-conflict-replace"
                onClick={() => resolvePrimaryConflict("replace")}
                className="min-h-11 rounded-full border border-gold-dust/50 bg-gold-dust/10 px-5 py-2 text-sm text-gold-dust hover:bg-gold-dust/20"
              >
                {lang === "zh" ? "替换主命盘（旧的降为其他命盘）" : "Replace primary (demote the old one)"}
              </button>
              <button
                type="button"
                data-testid="ritual-conflict-keep"
                onClick={() => resolvePrimaryConflict("keep")}
                className="min-h-11 rounded-full border border-white/15 px-5 py-2 text-sm text-stone-warm/80 hover:border-gold-dust/40 hover:text-gold-dust"
              >
                {lang === "zh" ? "另存为我的其他命盘" : "Save as one of my other charts"}
              </button>
              <button
                type="button"
                data-testid="ritual-conflict-cancel"
                onClick={() => setPrimaryConflict(null)}
                className="min-h-11 rounded-full border border-transparent px-5 py-2 text-xs text-stone-warm/50 hover:text-stone-warm/80"
              >
                {lang === "zh" ? "返回修改" : "Back to edit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

