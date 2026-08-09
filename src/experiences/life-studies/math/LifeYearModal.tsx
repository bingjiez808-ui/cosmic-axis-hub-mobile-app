import { useModalA11y } from "@/lib/use-modal-a11y";

import { DOMAIN_COLORS, DOMAIN_LABELS, type DomainKey } from "./domains";
import { crossDomainEffects, type AgeSnapshot } from "./LifeDomainModel";

/**
 * "这一年可能怎样" modal — condition-language only.
 * Kept local to the math room to avoid touching the global YearInsightModal.
 */
export function LifeYearModal({
  snapshot,
  onClose,
  onOpenLab,
  lang,
}: {
  snapshot: AgeSnapshot | null;
  onClose: () => void;
  onOpenLab: () => void;
  lang: "zh" | "en";
}) {
  const dialogRef = useModalA11y<HTMLDivElement>({ open: !!snapshot, onClose });

  if (!snapshot) return null;
  const isZh = lang === "zh";
  const arrows = crossDomainEffects(snapshot);

  const domains = Object.entries(snapshot.domains) as Array<[DomainKey, AgeSnapshot["domains"][DomainKey]]>;
  const opportunities = domains.filter(([, v]) => v.score >= 58).sort((a, b) => b[1].score - a[1].score).slice(0, 3);
  const drains = domains.filter(([, v]) => v.score <= 45).sort((a, b) => a[1].score - b[1].score).slice(0, 3);

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={isZh ? `${snapshot.age} 岁 可能怎样` : `Age ${snapshot.age} outlook`}
        tabIndex={-1}
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-amber-400/20 bg-[#0b0b14] shadow-2xl focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >

        <header className="flex items-start justify-between gap-3 border-b border-amber-400/15 px-5 py-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.28em] text-amber-200/60">
              {isZh ? "这一年 · 条件式解读" : "This year · conditional read"}
            </div>
            <h2 className="mt-1 font-serif text-xl text-amber-50">
              {isZh ? `${snapshot.age} 岁` : `Age ${snapshot.age}`}
              <span className="ml-2 text-xs text-amber-200/70">
                {isZh ? "综合指数" : "composite"} {snapshot.composite.toFixed(1)}
              </span>
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-amber-400/25 px-3 py-1 text-xs text-amber-200 hover:bg-amber-300/10"
          >
            {isZh ? "关闭" : "Close"}
          </button>
        </header>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4 text-sm text-amber-100/90">
          <Block title={isZh ? "机会：资源相对集中" : "Opportunities: resources cluster here"}>
            {opportunities.length === 0 && (
              <p className="text-xs text-amber-200/60">{isZh ? "无强烈机会信号，整体持平。" : "No strong opportunity signal — mostly neutral."}</p>
            )}
            {opportunities.map(([k, v]) => (
              <SignalRow key={k} domain={k} score={v.score} text={v.positiveSignals[0]?.text} lang={lang} />
            ))}
          </Block>

          <Block title={isZh ? "损耗：更容易付出成本" : "Drains: costlier this year"}>
            {drains.length === 0 && (
              <p className="text-xs text-amber-200/60">{isZh ? "无明显损耗信号。" : "No clear drain signal."}</p>
            )}
            {drains.map(([k, v]) => (
              <SignalRow key={k} domain={k} score={v.score} text={v.frictionSignals[0]?.text} lang={lang} />
            ))}
          </Block>

          <Block title={isZh ? "警惕：条件式提示" : "Watch-outs: conditional prompts"}>
            <ul className="space-y-1.5 text-xs">
              <li>· {isZh
                ? "若合作长时间不透明，更容易出现权责不清或信息不对称，不代表某个人有恶意。"
                : "If collaboration stays opaque for long, unclear ownership or information asymmetry is more likely — this does not imply anyone acted maliciously."}</li>
              <li>· {isZh
                ? "若同时提高风险暴露并挤压恢复时间，事业机会的可兑现度会下降。"
                : "If you raise risk exposure while squeezing recovery, career opportunities become harder to realise."}</li>
              <li>· {isZh
                ? "健康与就医只作为提醒，请以专业医生诊断为准。"
                : "Health notes are reminders only; defer to your physician for any diagnosis."}</li>
            </ul>
          </Block>

          <Block title={isZh ? "跨维影响" : "Cross-domain effects"}>
            {arrows.length === 0 && (
              <p className="text-xs text-amber-200/60">{isZh ? "本年无明显跨维联动。" : "No notable cross-domain link this year."}</p>
            )}
            <ul className="space-y-1.5 text-xs">
              {arrows.map((a, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: DOMAIN_COLORS[a.from] }} />
                  <span>{a.label[lang]}</span>
                  <span className={a.delta >= 0 ? "text-emerald-300" : "text-rose-300"}>
                    {a.delta >= 0 ? "+" : ""}{a.delta}
                  </span>
                </li>
              ))}
            </ul>
          </Block>

          <Block title={isZh ? "证据（哪些体系支持这一年的读数）" : "Evidence (which systems back this year)"}>
            <ul className="grid grid-cols-1 gap-1 text-[11px] text-amber-200/70 sm:grid-cols-2">
              {(Object.keys(snapshot.domains) as DomainKey[]).slice(0, 4).flatMap((k) =>
                snapshot.domains[k].evidenceRefs.slice(0, 1).map((r) => (
                  <li key={`${k}-${r}`} className="font-mono">{DOMAIN_LABELS[k][lang]} · {r}</li>
                )),
              )}
            </ul>
            <p className="mt-2 text-[10px] text-amber-200/60">
              {isZh
                ? `数据覆盖：${snapshot.dataCoverage}。西方系统仅提供本命底色，不提供行运加权。`
                : `Coverage: ${snapshot.dataCoverage}. Western system contributes natal-only tone (no transit weighting).`}
            </p>
          </Block>

          <div className="mt-4 border-t border-amber-400/10 pt-3">
            <button
              type="button"
              onClick={() => { onOpenLab(); onClose(); }}
              className="rounded-full border border-cyan-300/50 bg-cyan-300/10 px-4 py-2 text-xs text-cyan-100 hover:bg-cyan-300/20"
            >
              {isZh ? "进入选择实验室 →" : "Open Choice Lab →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4">
      <h3 className="text-[11px] uppercase tracking-[0.24em] text-amber-200/60">{title}</h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function SignalRow({
  domain, score, text, lang,
}: {
  domain: DomainKey;
  score: number;
  text?: { zh: string; en: string };
  lang: "zh" | "en";
}) {
  return (
    <div className="mb-1.5 flex items-start gap-2 text-xs">
      <span aria-hidden className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: DOMAIN_COLORS[domain] }} />
      <span className="w-28 shrink-0 text-amber-100">{DOMAIN_LABELS[domain][lang]} <span className="font-mono text-[10px] text-amber-200/60">{score.toFixed(0)}</span></span>
      <span className="text-amber-100/85">{text ? text[lang] : (lang === "zh" ? "-" : "-")}</span>
    </div>
  );
}
