/**
 * "Life Math Bookmarks" — eight fixed cards.
 *
 * These are DECISION-REFLECTION HEURISTICS, not fortune predictions:
 *   • Rule-based recommendation only (no AI).
 *   • Local-only favourites and reflections (localStorage).
 *   • Copy-share as plain text.
 */

import { useEffect, useMemo, useState } from "react";

import type { DomainKey } from "./domains";

export type BookmarkId =
  | "law-of-large-numbers"
  | "simpson"
  | "survivorship"
  | "murphy"
  | "regression-to-mean"
  | "bayes"
  | "opportunity-cost"
  | "compounding";

export type Bookmark = {
  id: BookmarkId;
  concept: { zh: string; en: string };
  translation: { zh: string; en: string };
  action: { zh: string; en: string };
  guard: { zh: string; en: string };
  glyph: React.ReactNode;
};

const svg = (children: React.ReactNode) => (
  <svg viewBox="0 0 60 60" className="h-12 w-12" aria-hidden="true">
    {children}
  </svg>
);

export const BOOKMARKS: Bookmark[] = [
  {
    id: "law-of-large-numbers",
    concept: { zh: "大数定律", en: "Law of Large Numbers" },
    translation: {
      zh: "一次结果噪声很大；只有足够多次可重复行动，你的真实水平才会显现。",
      en: "A single outcome is noisy; your real level only shows through many repeatable attempts.",
    },
    action: {
      zh: "把目标改成可累计的 20 次尝试，复盘命中率，而不是一次的成败。",
      en: "Reframe the goal as 20 cumulative attempts and review the hit rate — not a single win or loss.",
    },
    guard: {
      zh: "不是“做得越多一定成功”。",
      en: "Not \"more attempts guarantees success\".",
    },
    glyph: svg(
      <>
        <circle cx="30" cy="30" r="22" fill="none" stroke="#a78bfa" strokeWidth="1" opacity="0.4" />
        {Array.from({ length: 12 }).map((_, i) => {
          const a = (i / 12) * Math.PI * 2;
          return <circle key={i} cx={30 + Math.cos(a) * 18} cy={30 + Math.sin(a) * 18} r={1.6} fill="#a78bfa" />;
        })}
      </>,
    ),
  },
  {
    id: "simpson",
    concept: { zh: "辛普森悖论", en: "Simpson's Paradox" },
    translation: {
      zh: "总体趋势可能掩盖分组后的真相；一年“很差”里可能藏着某一维的进步。",
      en: "An overall trend can mask what happens inside subgroups; a \"bad year\" may hide gains in one area.",
    },
    action: {
      zh: "不要只看“今年很差”，拆成学习 / 事业 / 关系 / 健康分别评估。",
      en: "Don't just say \"this year was bad\" — break it into study / career / relationships / health and score each.",
    },
    guard: {
      zh: "分组要在事前定义，不要事后挑对你有利的。",
      en: "Define subgroups in advance — do not cherry-pick after the fact.",
    },
    glyph: svg(
      <>
        <path d="M8 44 L52 20" stroke="#f59e0b" strokeWidth="1.5" fill="none" />
        <path d="M10 30 L26 22" stroke="#38bdf8" strokeWidth="1.3" fill="none" />
        <path d="M32 40 L52 28" stroke="#38bdf8" strokeWidth="1.3" fill="none" />
      </>,
    ),
  },
  {
    id: "survivorship",
    concept: { zh: "幸存者偏差", en: "Survivorship Bias" },
    translation: {
      zh: "你看见的成功样本不等于全部样本；退出者往往沉默。",
      en: "The success stories you see are not the whole sample; those who dropped out stay silent.",
    },
    action: {
      zh: "做选择前主动记录失败案例、退出成本与放弃时机。",
      en: "Before choosing, actively record failed cases, exit costs, and give-up thresholds.",
    },
    guard: {
      zh: "不用来否定所有成功经验，只是提醒样本不完整。",
      en: "Not a reason to dismiss every success story — just a reminder that the sample is incomplete.",
    },
    glyph: svg(
      <>
        {[10, 20, 30, 40, 50].map((x, i) => (
          <rect key={i} x={x - 3} y={i === 2 ? 20 : 40} width="6" height={i === 2 ? 25 : 5} fill={i === 2 ? "#facc15" : "#facc15"} opacity={i === 2 ? 1 : 0.35} />
        ))}
      </>,
    ),
  },
  {
    id: "murphy",
    concept: { zh: "墨菲定律", en: "Murphy's Law" },
    translation: {
      zh: "可能出错的环节值得预留缓冲——不是说坏事一定发生。",
      en: "The parts that can go wrong deserve a buffer — not a claim that bad things must happen.",
    },
    action: {
      zh: "为重要决定准备备份、截止提前量与明确退出方案。",
      en: "For important decisions prepare backups, earlier deadlines, and a clear exit plan.",
    },
    guard: {
      zh: "不是宿命论，也不是拖延理由。",
      en: "Not fatalism, and not an excuse to procrastinate.",
    },
    glyph: svg(
      <>
        <path d="M10 45 L30 12 L50 45 Z" fill="none" stroke="#fb923c" strokeWidth="1.5" />
        <text x="30" y="38" fontSize="14" textAnchor="middle" fill="#fb923c">!</text>
      </>,
    ),
  },
  {
    id: "regression-to-mean",
    concept: { zh: "回归均值", en: "Regression to the Mean" },
    translation: {
      zh: "极端好坏通常不会永远维持；下一次多半靠近平均。",
      en: "Extreme highs and lows rarely last; the next data point usually sits closer to average.",
    },
    action: {
      zh: "高潮不盲目扩张，低谷不把暂时状态当作永久身份。",
      en: "In the peak, don't over-expand; in the trough, don't treat a temporary state as an identity.",
    },
    guard: {
      zh: "不是命运反转的保证。",
      en: "Not a promise that fortunes will flip.",
    },
    glyph: svg(
      <>
        <path d="M5 30 Q20 5 30 30 T55 30" fill="none" stroke="#34d399" strokeWidth="1.5" />
        <line x1="5" y1="30" x2="55" y2="30" stroke="#34d399" strokeDasharray="2 3" opacity="0.5" />
      </>,
    ),
  },
  {
    id: "bayes",
    concept: { zh: "贝叶斯更新", en: "Bayesian Updating" },
    translation: {
      zh: "新证据出现时允许修正判断，而不是坚守旧结论。",
      en: "When new evidence arrives, update your judgement instead of clinging to prior conclusions.",
    },
    action: {
      zh: "先写下：“什么证据会让我改变主意？”再做决定。",
      en: "Write down: \"What evidence would change my mind?\" before deciding.",
    },
    guard: {
      zh: "不是任何风吹草动都要转向。",
      en: "Not an excuse to flip on every rumour.",
    },
    glyph: svg(
      <>
        <circle cx="20" cy="30" r="12" fill="none" stroke="#38bdf8" strokeWidth="1.3" />
        <circle cx="38" cy="30" r="12" fill="none" stroke="#a78bfa" strokeWidth="1.3" />
      </>,
    ),
  },
  {
    id: "opportunity-cost",
    concept: { zh: "机会成本", en: "Opportunity Cost" },
    translation: {
      zh: "选择一条路，也意味着暂时放下另一条路。",
      en: "Choosing one path means temporarily setting the other paths aside.",
    },
    action: {
      zh: "比较未来三个月被占用的时间、金钱与恢复资源。",
      en: "Compare the next three months of occupied time, money, and recovery bandwidth.",
    },
    guard: {
      zh: "不是让你什么都不选，只是让代价被看见。",
      en: "Not an argument to pick nothing — just a way to make the cost visible.",
    },
    glyph: svg(
      <>
        <path d="M30 10 L30 30 L10 45" fill="none" stroke="#f472b6" strokeWidth="1.5" />
        <path d="M30 30 L50 45" fill="none" stroke="#f472b6" strokeWidth="1.5" strokeDasharray="2 3" opacity="0.5" />
      </>,
    ),
  },
  {
    id: "compounding",
    concept: { zh: "复利", en: "Compounding" },
    translation: {
      zh: "小而持续的积累会改变长期斜率。",
      en: "Small, steady accumulation reshapes the long-run slope.",
    },
    action: {
      zh: "选一个每天都能重复、失败后容易重启的最小动作。",
      en: "Pick one minimal action you can repeat daily and restart easily after a miss.",
    },
    guard: {
      zh: "复利不是免检金牌，一次断裂需要重启，不是重来。",
      en: "Compounding isn't a free pass — a break means restart, not reset to zero.",
    },
    glyph: svg(
      <>
        <path d="M8 50 C 20 48, 30 40, 40 24 S 52 8, 55 8" fill="none" stroke="#fde68a" strokeWidth="1.5" />
      </>,
    ),
  },
];

export type RecommendInput = {
  activeBranchCount: number;
  ageVarianceHigh: boolean;
  wealthRiskScore: number;
  studyOrLongTerm: boolean;
};

export type Recommendation = {
  id: BookmarkId;
  reason: { zh: string; en: string };
};

/**
 * Pick which bookmark to highlight given the current page state.
 * Rule-based; deterministic; safe to call server-side.
 */
export function recommendBookmark(input: RecommendInput): Recommendation {
  if (input.activeBranchCount > 1) {
    return {
      id: "opportunity-cost",
      reason: {
        zh: `你正在比较 ${input.activeBranchCount} 条人生分支，所以先看机会成本。`,
        en: `You are comparing ${input.activeBranchCount} life branches, so start with opportunity cost.`,
      },
    };
  }
  if (input.activeBranchCount === 1) {
    return {
      id: "bayes",
      reason: {
        zh: "你在观察一个新分支，先想清楚“什么证据会让我改变主意”。",
        en: "You are watching a new branch — clarify \"what evidence would change my mind\" first.",
      },
    };
  }
  if (input.wealthRiskScore >= 65) {
    return {
      id: "survivorship",
      reason: {
        zh: "当前财富与风险指数较高，先用幸存者偏差检验样本是否完整。",
        en: "Your wealth-risk index is elevated; use survivorship bias to check the sample is complete.",
      },
    };
  }
  if (input.wealthRiskScore <= 40) {
    return {
      id: "murphy",
      reason: {
        zh: "当前风险承受空间偏窄，先为重要决定准备缓冲与退出。",
        en: "Risk-tolerance headroom is narrow; prepare buffers and exits for important decisions.",
      },
    };
  }
  if (input.ageVarianceHigh) {
    return {
      id: "simpson",
      reason: {
        zh: "本年度各领域波动较大，先拆分再判断。",
        en: "This year swings across domains — break it apart before judging.",
      },
    };
  }
  if (input.studyOrLongTerm) {
    return {
      id: "compounding",
      reason: {
        zh: "你正处于学业或长期积累阶段，复利视角更合适。",
        en: "You're in a study or long-run phase — the compounding lens fits.",
      },
    };
  }
  return {
    id: "regression-to-mean",
    reason: {
      zh: "没有特别的信号，先用回归均值提醒自己不要把状态当身份。",
      en: "No strong signals — regression to the mean reminds you not to treat state as identity.",
    },
  };
}

/* ----------------------------------------------------------------- */
/* UI                                                                 */
/* ----------------------------------------------------------------- */

const FAV_KEY = "life-math-bookmark-favorites";
const REFLECT_KEY = (id: BookmarkId) => `life-math-reflection-${id}`;

function useFavorites(): [Set<BookmarkId>, (id: BookmarkId) => void] {
  const [set, setSet] = useState<Set<BookmarkId>>(new Set());
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(FAV_KEY);
      if (raw) setSet(new Set(JSON.parse(raw)));
    } catch { /* ignore */ }
  }, []);
  const toggle = (id: BookmarkId) => {
    setSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(FAV_KEY, JSON.stringify([...next]));
        }
      } catch { /* ignore */ }
      return next;
    });
  };
  return [set, toggle];
}

const REFLECT_QUESTIONS: Record<BookmarkId, { zh: string[]; en: string[] }> = {
  "law-of-large-numbers": {
    zh: ["这件事你打算重复多少次？", "怎样让每一次都被记录、可复盘？", "多少次之后你才允许判断“不适合”？"],
    en: ["How many times will you repeat this?", "How will each attempt be logged and reviewed?", "After how many attempts will you allow \"not a fit\"?"],
  },
  simpson: {
    zh: ["把这一年拆成哪 3–5 个子领域？", "哪一个子领域其实在进步？", "你是否用整体判断掩盖了某一维的努力？"],
    en: ["Which 3–5 sub-domains split this year?", "Which sub-domain is actually improving?", "Have you let the aggregate mask progress in one part?"],
  },
  survivorship: {
    zh: ["你参考的成功案例，退出者去哪了？", "你打算用什么方式记录自己的失败样本？", "有没有你从未听说的“沉默同行”？"],
    en: ["Where did the drop-outs go among your success references?", "How will you record your own failed attempts?", "Are there \"silent peers\" you never hear from?"],
  },
  murphy: {
    zh: ["这次最容易出错的一步是什么？", "你为它预留了多少缓冲时间/资金？", "触发什么信号你就切换到退出方案？"],
    en: ["Which step is most likely to go wrong?", "How much buffer time / cash have you reserved?", "Which signal triggers your exit plan?"],
  },
  "regression-to-mean": {
    zh: ["最近的极端结果，你打算维持多久假设？", "怎样区分“真的好转/变差”和“回归均值”？", "你会为极端状态改哪三件事？"],
    en: ["How long will you assume the extreme result lasts?", "How will you distinguish real trend from mean reversion?", "Which three things would you change based on the extreme?"],
  },
  bayes: {
    zh: ["现在你相信的核心假设是什么？", "什么具体证据会让你放弃它？", "多久检查一次这些证据？"],
    en: ["What core assumption do you currently believe?", "Which specific evidence would make you abandon it?", "How often will you check that evidence?"],
  },
  "opportunity-cost": {
    zh: ["选它意味着三个月内放下什么？", "放下的那件事恢复起来容易吗？", "如果三个月后回头，你希望多留哪一样？"],
    en: ["Choosing this means setting aside what in the next 3 months?", "How easy is that set-aside item to restart?", "Looking back in 3 months, which would you rather have kept?"],
  },
  compounding: {
    zh: ["每天最小的可重复动作是什么？", "断掉一次后怎样最快重启？", "半年后想看到哪条曲线在变斜？"],
    en: ["What's the smallest daily repeatable action?", "How will you restart fastest after a miss?", "Which curve do you want to see steepening in 6 months?"],
  },
};

function ReflectionModal({
  id,
  onClose,
  lang,
}: {
  id: BookmarkId;
  onClose: () => void;
  lang: "zh" | "en";
}) {
  const isZh = lang === "zh";
  const questions = REFLECT_QUESTIONS[id][lang];
  const [answers, setAnswers] = useState<string[]>(() => {
    if (typeof window === "undefined") return ["", "", ""];
    try {
      const raw = window.localStorage.getItem(REFLECT_KEY(id));
      if (raw) return JSON.parse(raw) as string[];
    } catch { /* ignore */ }
    return ["", "", ""];
  });

  const save = () => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(REFLECT_KEY(id), JSON.stringify(answers));
      } catch { /* ignore */ }
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl border border-amber-400/25 bg-[#0b0b14] p-5">
        <h3 className="font-serif text-lg text-amber-50">
          {isZh ? "用这张书签检查当前选择" : "Check your current choice with this bookmark"}
        </h3>
        <p className="mt-1 text-[11px] text-amber-200/60">
          {isZh ? "答案只保存在本地，不会上传，也不改变命盘。" : "Answers stay in your browser only — nothing is uploaded or changed on your chart."}
        </p>
        <ul className="mt-3 space-y-3">
          {questions.map((q, i) => (
            <li key={i}>
              <label className="text-[12px] text-amber-100">{q}</label>
              <textarea
                value={answers[i] ?? ""}
                onChange={(e) => setAnswers((prev) => {
                  const next = [...prev];
                  next[i] = e.target.value;
                  return next;
                })}
                rows={2}
                className="mt-1 w-full rounded-md border border-amber-400/20 bg-[#0f0f1a] p-2 text-[12px] text-amber-50"
              />
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-full border border-amber-400/25 px-3 py-1.5 text-xs text-amber-200/80">
            {isZh ? "取消" : "Cancel"}
          </button>
          <button type="button" onClick={save} className="rounded-full border border-cyan-300/50 bg-cyan-300/15 px-3 py-1.5 text-xs text-cyan-50">
            {isZh ? "保存到本地" : "Save locally"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function LifeMathBookmarks({
  input,
  lang,
}: {
  input: RecommendInput;
  lang: "zh" | "en";
}) {
  const isZh = lang === "zh";
  const rec = useMemo(() => recommendBookmark(input), [input]);
  const ordered = useMemo(() => {
    const first = BOOKMARKS.find((b) => b.id === rec.id)!;
    const rest = BOOKMARKS.filter((b) => b.id !== rec.id);
    return [first, ...rest];
  }, [rec]);
  const [favorites, toggleFav] = useFavorites();
  const [reflectId, setReflectId] = useState<BookmarkId | null>(null);
  const [copiedId, setCopiedId] = useState<BookmarkId | null>(null);

  const copyShare = async (b: Bookmark) => {
    const text = isZh
      ? `【人生数学书签 · ${b.concept.zh}】\n${b.translation.zh}\n今天能做的一件事：${b.action.zh}\n（${b.guard.zh}）`
      : `[Life-math bookmark · ${b.concept.en}]\n${b.translation.en}\nOne thing to do today: ${b.action.en}\n(${b.guard.en})`;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setCopiedId(b.id);
        setTimeout(() => setCopiedId(null), 1500);
      }
    } catch { /* ignore */ }
  };

  return (
    <section
      id="life-math-bookmarks"
      className="rounded-2xl border border-amber-400/15 bg-[#0b0b14]/70 p-5"
      data-testid="life-math-bookmarks"
    >
      <div>
        <div className="text-[11px] uppercase tracking-[0.28em] text-amber-200/60">
          {isZh ? "人生数学书签" : "Life-math Bookmarks"}
        </div>
        <h3 className="mt-1 font-serif text-lg text-amber-50">
          {isZh ? "人生数学书签" : "Life-math Bookmarks"}
        </h3>
        <p className="mt-1 max-w-3xl text-[12px] leading-relaxed text-amber-100/80">
          {isZh
            ? "有些数学不是用来算答案，而是提醒我们怎样少被一次结果骗到。"
            : "Some maths isn't for computing answers — it's for keeping a single result from fooling you."}
        </p>
      </div>

      <div
        className="mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-3 md:overflow-visible"
        data-testid="bookmarks-scroll"
      >
        {ordered.map((b, i) => {
          const isFocus = i === 0;
          const isFav = favorites.has(b.id);
          return (
            <article
              key={b.id}
              data-testid={`bookmark-${b.id}`}
              className={`relative snap-start shrink-0 basis-[85%] rounded-xl border p-4 md:basis-auto ${
                isFocus
                  ? "border-cyan-300/60 bg-cyan-300/5 shadow-[0_0_0_1px_rgba(103,232,249,0.25)]"
                  : "border-amber-400/15 bg-[#0f0f1a]/70"
              }`}
              style={{
                // bookmark-tag silhouette
                clipPath: "polygon(0 0, 100% 0, 100% calc(100% - 12px), 50% 100%, 0 calc(100% - 12px))",
              }}
            >
              {isFocus && (
                <div className="mb-2 text-[10px] uppercase tracking-[0.24em] text-cyan-200">
                  {isZh ? "此刻更适合你的书签" : "Best fit right now"}
                </div>
              )}
              <div className="flex items-start gap-3">
                {b.glyph}
                <div>
                  <div className="font-serif text-base text-amber-50">{b.concept[lang]}</div>
                  <p className="mt-1 text-[12px] leading-relaxed text-amber-100/85">{b.translation[lang]}</p>
                </div>
              </div>
              <div className="mt-3 rounded-md border border-amber-400/15 bg-[#0b0b14]/70 p-2 text-[11px] text-amber-100">
                <span className="text-amber-200/60">{isZh ? "今天能做的一件事：" : "One thing to do today: "}</span>
                {b.action[lang]}
              </div>
              {isFocus && (
                <p className="mt-2 text-[10px] text-cyan-200/70">
                  {isZh ? "推荐原因：" : "Why: "}{rec.reason[lang]}
                </p>
              )}
              <p className="mt-2 text-[10px] text-amber-200/50">{b.guard[lang]}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => toggleFav(b.id)}
                  data-testid={`bookmark-fav-${b.id}`}
                  className={`rounded-full border px-2 py-1 text-[10px] ${
                    isFav ? "border-amber-300/60 bg-amber-300/10 text-amber-50" : "border-amber-400/25 text-amber-200/80"
                  }`}
                >
                  {isFav ? (isZh ? "★ 已收藏" : "★ Saved") : (isZh ? "☆ 收藏" : "☆ Save")}
                </button>
                <button
                  type="button"
                  onClick={() => copyShare(b)}
                  data-testid={`bookmark-share-${b.id}`}
                  className="rounded-full border border-amber-400/25 px-2 py-1 text-[10px] text-amber-200/80"
                >
                  {copiedId === b.id ? (isZh ? "已复制" : "Copied") : (isZh ? "复制分享文本" : "Copy share text")}
                </button>
                <button
                  type="button"
                  onClick={() => setReflectId(b.id)}
                  data-testid={`bookmark-reflect-${b.id}`}
                  className="rounded-full border border-cyan-300/40 px-2 py-1 text-[10px] text-cyan-100"
                >
                  {isZh ? "用这张书签检查当前选择" : "Use to check my choice"}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <p className="mt-3 text-[10px] text-amber-200/50">
        {isZh
          ? "数学隐喻用于决策反思，不是人生定律或结果预测；不构成投资 / 医疗 / 婚姻建议。"
          : "Math metaphors for reflection — not laws of life or outcome forecasts; not investment / medical / relationship advice."}
      </p>

      {reflectId && <ReflectionModal id={reflectId} onClose={() => setReflectId(null)} lang={lang} />}
    </section>
  );
}

// Only used by tests / other modules that need the fixed list.
export function bookmarkById(id: BookmarkId): Bookmark | undefined {
  return BOOKMARKS.find((b) => b.id === id);
}

// Domain hint helper if callers need to compute variance elsewhere.
export function ageDomainVariance(scores: Record<DomainKey, number>): number {
  const values = Object.values(scores);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return variance;
}
