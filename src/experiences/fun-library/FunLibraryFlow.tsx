/**
 * Fun Library · FunLibraryFlow — the intro → quiz → result state machine.
 *
 * localStorage is the only persistence for V1. Key includes user id,
 * primary chart id, quiz version, scoring version — swapping the
 * primary chart yields a new key so old results stay pinned to the
 * old primary and never leak across charts.
 */

import { useEffect, useMemo, useState } from "react";
import type { ChartRow } from "@/lib/reports-store.functions";
import { useLang } from "@/lib/i18n";
import { QUIZ, QUIZ_VERSION } from "./personality/quiz";
import { SCORING_VERSION, scoreReadingPersonality } from "./personality/scoring";
import type { Answers, PersonalityResult } from "./personality/types";
import { QuizStep } from "./QuizStep";
import { ResultView } from "./ResultView";

type Stored = {
  answers: Answers;
  savedAt: number;
  chartId: string;
  quizVersion: string;
  scoringVersion: string;
};

function storageKey(userId: string, chartId: string) {
  return `funlib:${userId}:${chartId}:${QUIZ_VERSION}:${SCORING_VERSION}`;
}

function readStored(userId: string, chartId: string): Stored | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(userId, chartId));
    if (!raw) return null;
    const p = JSON.parse(raw) as Stored;
    if (!Array.isArray(p.answers) || p.answers.length !== QUIZ.length) return null;
    return p;
  } catch {
    return null;
  }
}

function writeStored(userId: string, chartId: string, s: Stored) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(userId, chartId), JSON.stringify(s));
  } catch {
    /* quota — silent */
  }
}

export function FunLibraryFlow({
  userId,
  chart,
}: {
  userId: string;
  chart: ChartRow;
}) {
  const { lang } = useLang();
  const isZh = lang === "zh";

  const [answers, setAnswers] = useState<(string | null)[]>(
    () => new Array(QUIZ.length).fill(null),
  );
  const [phase, setPhase] = useState<"intro" | "quiz" | "result">("intro");
  const [idx, setIdx] = useState(0);

  // Rehydrate saved result.
  useEffect(() => {
    const stored = readStored(userId, chart.id);
    if (stored) {
      setAnswers(stored.answers);
      setPhase("result");
    }
  }, [userId, chart.id]);

  const allAnswered = answers.every((a) => a);
  const result: PersonalityResult | null = useMemo(() => {
    if (!allAnswered) return null;
    return scoreReadingPersonality(answers as string[]);
  }, [answers, allAnswered]);

  const pick = (optionId: string) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[idx] = optionId;
      return next;
    });
    // Advance
    if (idx < QUIZ.length - 1) {
      setIdx(idx + 1);
    } else {
      // final answer — persist and reveal
      const finalized = [...answers];
      finalized[idx] = optionId;
      writeStored(userId, chart.id, {
        answers: finalized as string[],
        savedAt: Date.now(),
        chartId: chart.id,
        quizVersion: QUIZ_VERSION,
        scoringVersion: SCORING_VERSION,
      });
      setPhase("result");
    }
  };

  const restart = () => {
    setAnswers(new Array(QUIZ.length).fill(null));
    setIdx(0);
    setPhase("intro");
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(storageKey(userId, chart.id));
      } catch {
        /* noop */
      }
    }
  };

  if (phase === "intro") {
    return (
      <section
        aria-labelledby="funlib-intro-heading"
        className="mx-auto max-w-2xl rounded-2xl border border-amber-300/20 bg-[#100c1c]/70 p-6 md:p-10"
      >
        <p className="text-[10px] uppercase tracking-[0.34em] text-amber-200/70">
          {isZh ? "趣味图书馆 · 第一册" : "Fun Library · Volume One"}
        </p>
        <h1
          id="funlib-intro-heading"
          className="mt-3 text-3xl font-serif text-amber-100 md:text-4xl"
        >
          {isZh ? "领取属于你的那本书" : "Claim the Book Meant for You"}
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-stone-200/80">
          {isZh
            ? "在图书馆的十二个荒诞夜晚，你会做出十二个小小的选择。它们看似无关，加起来却会告诉你——你是一个怎样的读书人。没有对错。全程不超过五分钟。"
            : "Twelve absurd nights inside a library. Twelve small choices. Together they reveal what kind of reader you are. No right answers. About five minutes."}
        </p>
        <p className="mt-3 text-xs text-stone-300/60">
          {isZh
            ? `将基于你的主命盘《${chart.name ?? "未署名"}》进行阅读。`
            : `Reading in the light of your primary chart: ${chart.name ?? "unnamed"}.`}
        </p>
        <button
          type="button"
          onClick={() => {
            setPhase("quiz");
            setIdx(0);
          }}
          className="mt-6 inline-flex min-h-11 items-center rounded-full border border-amber-300 bg-amber-300/10 px-6 py-2 text-sm text-amber-100 transition hover:bg-amber-300/20"
        >
          {isZh ? "推开图书馆的门" : "Push open the library door"}
        </button>
      </section>
    );
  }

  if (phase === "result" && result) {
    return (
      <ResultView
        result={result}
        chart={chart}
        onRestart={restart}
      />
    );
  }

  // quiz
  const q = QUIZ[idx];
  return (
    <QuizStep
      question={q}
      index={idx}
      total={QUIZ.length}
      selected={answers[idx]}
      onPick={pick}
      onBack={idx > 0 ? () => setIdx(idx - 1) : undefined}
    />
  );
}
