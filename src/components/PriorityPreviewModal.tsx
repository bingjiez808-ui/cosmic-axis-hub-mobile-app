/**
 * PriorityPreviewModal — post-ritual "priority preview" on /report.
 *
 * When the visitor arrives at /report with `?concern=<key>` and the AI
 * report has hydrated, we show a one-shot modal that:
 *   - names the concern they picked on the homepage,
 *   - previews the matching dimension's real headline + plain synthesis
 *     (drawn from the just-generated report, not from a template),
 *   - offers a CTA that scrolls to the matching section anchor.
 *
 * "Only once per report generation" is enforced with a sessionStorage
 * key that combines the report identity (chart id or seed) with the
 * report AI version — a fresh AI run bumps the version and the modal
 * shows again for that new generation.
 */
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  CONCERNS,
  reportSectionAnchor,
  type ConcernKey,
} from "@/lib/concern-guidance-v1";

type DisplayedDim = {
  key: string;
  title: [string, string];
  headline: [string, string];
  plain: [string, string];
  synthesis: [string, string];
};

type Props = {
  concern: ConcernKey;
  lang: "zh" | "en";
  /** Merged dimensions (base + AI) rendered on the page. */
  displayed: DisplayedDim[];
  /** Stable identity for THIS report generation (chart id + AI version). */
  reportKey: string | null;
  /** Whether the AI content has actually hydrated. */
  ready: boolean;
};

const STORAGE_PREFIX = "fate.priority-preview.seen.";

function excerpt(text: string, max = 220): string {
  const t = (text ?? "").trim();
  if (t.length <= max) return t;
  return t.slice(0, max).replace(/[，,。.；;：: ]+\S*$/, "") + "…";
}

export function PriorityPreviewModal({
  concern,
  lang,
  displayed,
  reportKey,
  ready,
}: Props) {
  const [open, setOpen] = useState(false);
  const li = lang === "zh" ? 1 : 0;

  const rec = CONCERNS[concern];
  const anchorId = useMemo(() => reportSectionAnchor(rec.targetSection), [rec]);
  const matchedDim = useMemo(
    () => displayed.find((d) => d.key === anchorId) ?? displayed[0] ?? null,
    [displayed, anchorId],
  );

  const storageKey = reportKey ? `${STORAGE_PREFIX}${reportKey}` : null;

  useEffect(() => {
    if (!ready || !reportKey || !storageKey) return;
    if (typeof window === "undefined") return;
    try {
      if (window.sessionStorage.getItem(storageKey) === "1") return;
    } catch {
      /* ignore */
    }
    // Small delay so the reader paints first.
    const t = window.setTimeout(() => setOpen(true), 400);
    return () => window.clearTimeout(t);
  }, [ready, reportKey, storageKey]);

  const markSeen = () => {
    if (!storageKey || typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(storageKey, "1");
    } catch {
      /* ignore */
    }
  };

  const close = () => {
    markSeen();
    setOpen(false);
  };

  const jump = () => {
    markSeen();
    setOpen(false);
    if (typeof window === "undefined") return;
    // Wait for the modal close animation before scrolling.
    window.setTimeout(() => {
      const el = document.getElementById(anchorId);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  };

  if (!matchedDim) return null;

  const H = {
    kicker: {
      zh: "带着你的问题，先读这一章",
      en: "Read this chapter first — it holds your question",
    },
    preview: { zh: "本章节选", en: "Chapter excerpt" },
    cta: { zh: "打开这一章", en: "Open this chapter" },
    later: { zh: "稍后再看，先浏览全部", en: "Later — browse everything first" },
    note: {
      zh: "本提示仅本次生成显示一次；随时可从左侧目录返回本章。",
      en: "Shown once per report generation; use the side rail to return here anytime.",
    },
  };

  const previewText =
    excerpt(matchedDim.plain[li]) ||
    excerpt(matchedDim.synthesis[li]) ||
    excerpt(matchedDim.headline[li]);

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogContent className="max-w-lg border border-amber-200/25 bg-[#100a06] text-amber-50">
        <p className="text-[10px] uppercase tracking-[0.28em] text-amber-300/70">
          {H.kicker[lang]}
        </p>
        <DialogTitle className="mt-2 font-serif text-xl text-amber-100">
          {rec.chip[lang]} · {matchedDim.title[li]}
        </DialogTitle>
        <DialogDescription className="text-sm leading-relaxed text-amber-100/75">
          {matchedDim.headline[li]}
        </DialogDescription>

        <div className="mt-4 rounded-lg border border-amber-100/10 bg-black/30 p-4">
          <div className="mb-1 text-[11px] uppercase tracking-[0.2em] text-amber-200/60">
            {H.preview[lang]}
          </div>
          <p className="text-[13.5px] italic leading-relaxed text-amber-100/85">
            {previewText}
          </p>
        </div>

        <p className="mt-4 text-[11px] leading-snug text-amber-100/45">{H.note[lang]}</p>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={close}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-amber-200/25 px-4 text-sm text-amber-100/80 hover:border-amber-200/50"
          >
            {H.later[lang]}
          </button>
          <button
            type="button"
            onClick={jump}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-gradient-to-r from-amber-300 to-amber-500 px-5 text-sm font-medium text-black shadow-[0_10px_30px_rgba(251,191,36,0.25)] hover:brightness-110"
          >
            {H.cta[lang]}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default PriorityPreviewModal;
