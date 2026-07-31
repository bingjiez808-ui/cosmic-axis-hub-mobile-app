import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * DomainDetailDialog — the per-domain plain-language reading, shown in a modal
 * instead of an inline <details> so opening a domain never reflows the page.
 */

export type DomainDetailPayload = {
  key: string;
  label: string;
  score: number;
  bandLabel: string;
  bandClass: string;
  confidenceLabel: string;
  headline: string;
  mayShowAs: string;
  doToday: string[];
  avoidToday: string[];
  weekTrend: string;
  breakdown: Array<{ direction: number; weight: number; orb: number; delta_applied: number }>;
};

export function DomainDetailDialog({
  lang,
  payload,
  onOpenChange,
}: {
  lang: "en" | "zh";
  payload: DomainDetailPayload | null;
  onOpenChange: (open: boolean) => void;
}) {
  const zh = lang === "zh";
  return (
    <Dialog open={payload !== null} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="domain-detail-dialog"
        className="max-h-[85vh] overflow-y-auto border-amber-400/30 bg-[#0d0b12]/95 text-amber-50 sm:max-w-lg"
      >
        {payload && (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-baseline gap-2 font-serif text-xl text-amber-100">
                {payload.label}
                <span className="text-sm text-amber-300/80">{payload.score}</span>
                <span
                  className={`inline-block rounded-full border px-2 py-0.5 text-[10px] ${payload.bandClass}`}
                >
                  {payload.bandLabel}
                </span>
              </DialogTitle>
              <DialogDescription className="text-sm leading-relaxed text-amber-100/85">
                {payload.headline}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 text-sm">
              <p className="text-amber-100/70">{payload.mayShowAs}</p>

              {payload.doToday.length > 0 && (
                <div>
                  <div className="text-[11px] uppercase tracking-widest text-emerald-200/80">
                    {zh ? "建议做" : "Do today"}
                  </div>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-emerald-50/90">
                    {payload.doToday.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}

              {payload.avoidToday.length > 0 && (
                <div>
                  <div className="text-[11px] uppercase tracking-widest text-rose-200/80">
                    {zh ? "注意避免" : "Avoid today"}
                  </div>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-rose-50/90">
                    {payload.avoidToday.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="text-[11px] text-amber-200/60">{payload.weekTrend}</div>

              <div className="border-t border-amber-400/10 pt-3">
                <div className="text-[11px] uppercase tracking-widest text-amber-200/70">
                  {zh ? "本日加减分账单" : "Today's score ledger"}
                </div>
                <div className="mt-1 text-[11px] text-amber-100/70">
                  {zh ? "基础分 50" : "Base 50"}
                </div>
                {payload.breakdown.length === 0 ? (
                  <div className="mt-1 text-[11px] text-amber-100/60">
                    {zh
                      ? "今天没有足够强的单项信号，保持中性观察。"
                      : "No strong single signal today — stay observant."}
                  </div>
                ) : (
                  <ul className="mt-1 space-y-0.5">
                    {payload.breakdown.slice(0, 6).map((b, i) => (
                      <li key={i} className="flex justify-between gap-3 text-[11px] text-amber-100/75">
                        <span>
                          {b.direction > 0
                            ? zh
                              ? "和谐信号"
                              : "Harmonious"
                            : zh
                              ? "紧张信号"
                              : "Straining"}
                          {" · "}
                          {zh ? "权重" : "w"} {b.weight} · orb {b.orb.toFixed(1)}°
                        </span>
                        <span className={b.delta_applied >= 0 ? "text-emerald-300" : "text-rose-300"}>
                          {b.delta_applied >= 0 ? "+" : ""}
                          {b.delta_applied}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-1 text-[11px] text-amber-200/70">
                  {zh ? "最终分" : "Final"} · {payload.score} ·{" "}
                  {zh ? "置信度" : "confidence"} {payload.confidenceLabel}
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
