/**
 * 回音评分 — the letter author rates a human echo 1–5 stars.
 *
 * Only the author of the letter sees this, and only once per echo. The rating
 * is what feeds the entrusted-helper reward: consistently well-received
 * helpers earn a month of 「神谕者」membership.
 */
import { useState } from "react";
import { toast } from "sonner";

import { hallErrorMessage } from "@/lib/community-hall-errors";
import { useCommunityHall } from "@/lib/i18n-community-hall";
import { useMyEchoRatings, useRateEcho } from "@/lib/sage-council-client";

export function EchoRating({ replyId }: { replyId: string }) {
  const c = useCommunityHall();
  const zh = c.lang !== "en";
  const ratings = useMyEchoRatings();
  const rate = useRateEcho();
  const [hover, setHover] = useState(0);
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);

  const given = ratings.data?.[replyId] ?? null;

  async function submit(stars: number) {
    try {
      const res = await rate.mutateAsync({ replyId, stars, note: note.trim() || null });
      toast.success(
        res.helperRewarded
          ? zh
            ? "评分已送达——这位受托旅者因长期好评获赠了一个月「神谕者」。"
            : "Rated — this helper's steady praise just earned them a month of Oracle."
          : zh
            ? "评分已送达，谢谢你让回信人知道。"
            : "Rated. Thank you for letting them know.",
      );
      setOpen(false);
    } catch (err) {
      toast.error(hallErrorMessage(err, c.lang));
    }
  }

  if (given) {
    return (
      <p className="mt-3 text-[0.7rem] text-primary/80">
        {zh ? "你的评分" : "Your rating"}: {"★".repeat(given.stars)}
        <span className="opacity-40">{"★".repeat(5 - given.stars)}</span>
        {given.note ? <span className="ml-2 text-muted-foreground">「{given.note}」</span> : null}
      </p>
    );
  }

  return (
    <div className="mt-3 border-t border-primary/10 pt-3">
      <p className="text-[0.7rem] text-muted-foreground">
        {zh
          ? "这封回音帮到你了吗？评分只有回信人看得到匿名结果。"
          : "Did this echo help? Only the anonymous result reaches the writer."}
      </p>
      <div className="mt-1.5 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={zh ? `${n} 星` : `${n} stars`}
            disabled={rate.isPending}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => {
              setHover(n);
              setOpen(true);
            }}
            className={`hall-tap text-lg leading-none transition ${
              n <= hover ? "text-primary" : "text-primary/25 hover:text-primary/60"
            }`}
          >
            ★
          </button>
        ))}
      </div>
      {open ? (
        <div className="mt-2 space-y-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={120}
            placeholder={zh ? "一句悄悄话（可留空）" : "A quiet line back (optional)"}
            className="w-full rounded-lg border border-primary/15 bg-background/70 px-3 py-2 text-xs"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={rate.isPending}
              onClick={() => void submit(hover || 5)}
              className="hall-tap rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs text-foreground"
            >
              {rate.isPending
                ? zh
                  ? "送出中…"
                  : "Sending…"
                : zh
                  ? `确认 ${hover || 5} 星`
                  : `Confirm ${hover || 5}★`}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="hall-tap rounded-full border border-primary/15 px-3 py-1.5 text-xs text-muted-foreground"
            >
              {zh ? "再想想" : "Not yet"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
