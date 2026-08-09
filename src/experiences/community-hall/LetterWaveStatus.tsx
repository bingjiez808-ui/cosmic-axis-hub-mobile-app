/**
 * 同门 · 众生之厅 — author-side delivery telemetry for one sent letter.
 *
 * Shows how far the letter travelled (waves, opened, echoes) and lets the
 * author release the next wave once the cooldown window has passed. Every
 * limit is enforced server-side inside `dispatch_community_letter`.
 */
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useLetterDispatchState, useRequestLetterWave } from "@/lib/community-hall-client";
import { hallErrorMessage } from "@/lib/community-hall-errors";
import { useCommunityHall } from "@/lib/i18n-community-hall";

function formatTime(value: string | null, lang: "zh" | "en") {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(lang === "zh" ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function LetterWaveStatus({ letterId, closed }: { letterId: string; closed?: boolean }) {
  const c = useCommunityHall();
  const [open, setOpen] = useState(false);
  const state = useLetterDispatchState(letterId, open);
  const wave = useRequestLetterWave();

  async function sendWave() {
    try {
      const result = await wave.mutateAsync({ letterId });
      toast.success(result.delivered > 0 ? c.waveRequested : c.waveNoOne);
    } catch (err) {
      toast.error(hallErrorMessage(err, c.lang));
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hall-tap text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        {c.waveLabel}
      </button>
    );
  }

  const data = state.data;

  return (
    <div className="hall-inset p-3 text-xs">
      {state.isLoading || !data ? (
        <p className="text-muted-foreground">…</p>
      ) : (
        <>
          <dl className="flex flex-wrap gap-x-5 gap-y-1 text-muted-foreground">
            <div className="flex gap-1">
              <dt>{c.waveLabel}</dt>
              <dd className="text-foreground">
                {data.wave} / {data.maxRecipients}
              </dd>
            </div>
            <div className="flex gap-1">
              <dt>{c.waveDelivered}</dt>
              <dd className="text-foreground">{data.deliveredCount}</dd>
            </div>
            <div className="flex gap-1">
              <dt>{c.waveRead}</dt>
              <dd className="text-foreground">{data.readCount}</dd>
            </div>
            <div className="flex gap-1">
              <dt>{c.waveReplied}</dt>
              <dd className="text-foreground">
                {data.replyCount} / {data.maxReplies}
              </dd>
            </div>
          </dl>

          <p className="mt-2 text-muted-foreground">
            {data.deliveredCount >= data.maxRecipients
              ? c.waveFull
              : data.waiting
                ? c.waveWaiting
                : c.waveHint}
          </p>

          {!closed && data.canRequestWave ? (
            <Button
              size="sm"
              variant="outline"
              className="hall-tap mt-3"
              disabled={wave.isPending}
              onClick={() => void sendWave()}
            >
              {c.waveRequest}
            </Button>
          ) : !closed && data.nextWaveAt && data.deliveredCount < data.maxRecipients ? (
            <p className="mt-2 text-muted-foreground">
              {c.waveCooldown.replace("{time}", formatTime(data.nextWaveAt, c.lang))}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
