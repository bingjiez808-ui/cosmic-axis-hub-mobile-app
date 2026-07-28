import { Link } from "@tanstack/react-router";

import { useLang } from "@/lib/i18n";
import type { SubjectRoomMeta } from "./types";

/**
 * One 阅览室 card on the 命运通识馆 home. Displays the room's own
 * question, visualization, read time, data requirement, AI usage and
 * open/next-phase status — so users know before they click what the
 * room will (and will not) do.
 */
export function SubjectRoomCard({ meta, signedIn }: { meta: SubjectRoomMeta; signedIn: boolean }) {
  const { lang } = useLang();
  const isZh = lang === "zh";
  const isOpen = meta.status === "open";

  const statusBadge = (() => {
    if (meta.status === "open") return { zh: "现已开放", en: "Open now", tone: "open" as const };
    if (meta.status === "requires-integration")
      return { zh: "待接入", en: "Awaiting integration", tone: "wait" as const };
    return { zh: "下一阶段开放", en: "Next phase", tone: "next" as const };
  })();

  const badgeCls =
    statusBadge.tone === "open"
      ? "border-amber-300/60 bg-amber-300/10 text-amber-100"
      : statusBadge.tone === "wait"
        ? "border-stone-warm/30 bg-stone-warm/5 text-stone-warm/70"
        : "border-amber-400/25 bg-amber-400/5 text-amber-200/70";

  const savedState = !signedIn
    ? isZh
      ? "体验模式"
      : "Demo mode"
    : isZh
      ? "未保存"
      : "Not saved";

  const Body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.28em] text-amber-200/60">
            {isZh ? "阅览室" : "Reading room"}
          </div>
          <h3 className="mt-1 font-serif text-xl leading-tight text-amber-50">
            {isZh ? meta.title.zh : meta.title.en}
          </h3>
          <p className="mt-1 text-sm text-amber-100/70">
            {isZh ? meta.subtitle.zh : meta.subtitle.en}
          </p>
        </div>
        <span
          className={`shrink-0 whitespace-nowrap rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.2em] ${badgeCls}`}
        >
          {isZh ? statusBadge.zh : statusBadge.en}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-2 text-xs text-amber-100/70 sm:grid-cols-2">
        <div>
          <dt className="text-[10px] uppercase tracking-[0.22em] text-amber-200/50">
            {isZh ? "它回答的问题" : "Question"}
          </dt>
          <dd className="mt-0.5 text-amber-100/80">{isZh ? meta.question.zh : meta.question.en}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-[0.22em] text-amber-200/50">
            {isZh ? "核心可视化" : "Visualization"}
          </dt>
          <dd className="mt-0.5">{isZh ? meta.visualization.zh : meta.visualization.en}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-[0.22em] text-amber-200/50">
            {isZh ? "预计阅读" : "Reading time"}
          </dt>
          <dd className="mt-0.5">{meta.readMinutes} min</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-[0.22em] text-amber-200/50">
            {isZh ? "数据要求" : "Data requirement"}
          </dt>
          <dd className="mt-0.5">{isZh ? meta.dataRequirement.zh : meta.dataRequirement.en}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-[0.22em] text-amber-200/50">
            {isZh ? "是否使用 AI" : "Uses AI"}
          </dt>
          <dd className="mt-0.5">
            {meta.usesAI
              ? isZh
                ? "可选一次性馆长解说"
                : "Optional one-shot curator note"
              : isZh
                ? "本地规则生成，不调用 AI"
                : "Local rule-based, no AI"}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-[0.22em] text-amber-200/50">
            {isZh ? "完成状态" : "Progress"}
          </dt>
          <dd className="mt-0.5">{savedState}</dd>
        </div>
      </dl>

      {meta.statusNote && !isOpen && (
        <p className="mt-3 rounded-md border border-amber-400/15 bg-amber-400/5 px-3 py-2 text-[11px] leading-relaxed text-amber-200/70">
          {isZh ? meta.statusNote.zh : meta.statusNote.en}
        </p>
      )}

      <div className="mt-5 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.24em] text-amber-200/50">
          {isZh ? "命运通识馆" : "Life Studies"}
        </span>
        {isOpen ? (
          <span className="text-xs text-amber-100">
            {isZh ? "进入 →" : "Enter →"}
          </span>
        ) : (
          <span className="text-xs text-amber-200/50">
            {isZh ? "即将开放" : "Coming soon"}
          </span>
        )}
      </div>
    </>
  );

  const baseCls =
    "block rounded-2xl border border-amber-400/15 bg-[#0f0f1a]/70 p-5 transition hover:border-amber-300/40 md:p-6";

  if (!isOpen) {
    return (
      <div
        data-testid={`subject-room-${meta.id}`}
        aria-disabled
        className={`${baseCls} cursor-not-allowed opacity-90`}
      >
        {Body}
      </div>
    );
  }

  return (
    <Link
      to={meta.route}
      data-testid={`subject-room-${meta.id}`}
      className={`${baseCls} hover:bg-[#141422]/80`}
    >
      {Body}
    </Link>
  );
}
