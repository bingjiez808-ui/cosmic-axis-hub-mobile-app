import { useLang } from "@/lib/i18n";

/**
 * "How we generate a subject-room reading" — always visible on the
 * 命运通识馆 home and inside each room, so users understand the pipeline
 * before they scroll into any visualization.
 *
 * The pipeline is fixed:
 *   1) deterministic chart facts (local calculators),
 *   2) subject-specific fixed translation rules (also local),
 *   3) local visualization,
 *   4) optional one-shot curator commentary (disabled this phase).
 */
export function GenerationMethod() {
  const { lang } = useLang();
  const isZh = lang === "zh";
  const steps = isZh
    ? [
        { k: "1", t: "确定性命盘事实", d: "全部由本地计算器产生，不来自 AI。" },
        { k: "2", t: "固定学科翻译规则", d: "每一馆用自己的规则把事实翻译成通俗语言。" },
        { k: "3", t: "本地可视化", d: "图表在你的浏览器中计算与绘制。" },
        { k: "4", t: "可选一次性 AI 馆长解说", d: "本阶段未启用；启用后仅解释事实，不改事实。" },
      ]
    : [
        { k: "1", t: "Deterministic chart facts", d: "All facts come from local calculators, never from an LLM." },
        { k: "2", t: "Fixed per-subject translation rules", d: "Each room applies its own rules to the same facts." },
        { k: "3", t: "Local visualization", d: "Charts are computed and drawn in your browser." },
        { k: "4", t: "Optional one-shot curator note", d: "Disabled in this phase. When enabled it only explains facts." },
      ];
  return (
    <section
      data-testid="how-we-generate"
      aria-label={isZh ? "我们如何生成" : "How we generate"}
      className="mt-10 rounded-2xl border border-amber-400/15 bg-[#0b0b14]/70 p-5 md:p-6"
    >
      <div className="text-[11px] uppercase tracking-[0.28em] text-amber-200/60">
        {isZh ? "我们如何生成" : "How we generate"}
      </div>
      <h2 className="mt-1 font-serif text-lg text-amber-50 md:text-xl">
        {isZh ? "同一份命盘事实，五种可复用的读法" : "One set of chart facts, five reusable readings"}
      </h2>
      <ol className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s) => (
          <li
            key={s.k}
            className="rounded-lg border border-amber-400/10 bg-[#0f0f1a]/70 p-3"
          >
            <div className="text-[10px] uppercase tracking-[0.24em] text-amber-200/50">
              {isZh ? "步骤" : "Step"} {s.k}
            </div>
            <div className="mt-1 text-sm text-amber-100">{s.t}</div>
            <p className="mt-1 text-[11px] leading-relaxed text-amber-100/60">{s.d}</p>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-[11px] leading-relaxed text-amber-200/60">
        {isZh
          ? "缓存后重复打开同一馆同一情景，不会再调用 AI。这里的读法是解释与自我反思的语言，不是科学证明或决定论。"
          : "Reopening the same room with the same scenario is cached and does not call AI. These readings are interpretive and reflective, not scientific proof and not deterministic."}
      </p>
    </section>
  );
}
