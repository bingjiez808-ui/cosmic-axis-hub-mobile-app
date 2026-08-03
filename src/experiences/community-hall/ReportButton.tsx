/**
 * 举报 — a small parchment popover any traveler can open on a public letter
 * or echo. Reports land in `community_reports` and surface in the librarian's
 * moderation console; the reporter stays anonymous to the reported party.
 */
import { useState } from "react";
import { toast } from "sonner";

import { useReportContent } from "@/lib/community-hall-client";
import { hallErrorMessage } from "@/lib/community-hall-errors";
import { useCommunityHall } from "@/lib/i18n-community-hall";

export function ReportButton({
  targetType,
  targetId,
  label,
}: {
  targetType: "letter" | "reply" | "profile";
  targetId: string;
  label?: string;
}) {
  const c = useCommunityHall();
  const zh = c.lang !== "en";
  const report = useReportContent();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [reason, setReason] = useState(c.reportReasons[0]?.key ?? "other");
  const [details, setDetails] = useState("");

  async function submit() {
    try {
      await report.mutateAsync({
        targetType,
        targetId,
        reason,
        details: details.trim() ? details.trim().slice(0, 1000) : null,
      });
      setDone(true);
      setOpen(false);
      setDetails("");
      toast.success(c.reportSent);
    } catch (err) {
      toast.error(hallErrorMessage(err, c.lang));
    }
  }

  if (done) {
    return (
      <span className="text-xs text-muted-foreground">
        {zh ? "已举报，馆员会尽快处理" : "Reported — a librarian will review it"}
      </span>
    );
  }

  return (
    <div className="inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="hall-tap text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        {label ?? (zh ? "举报" : "Report")}
      </button>
      {open ? (
        <div className="hall-inset mt-2 space-y-2 p-3">
          <p className="text-xs text-muted-foreground">
            {zh
              ? "请选择原因。涉政违规、违法、涉黄与骚扰内容会被优先处理。"
              : "Choose a reason. Political, illegal, sexual and harassment reports are handled first."}
          </p>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as typeof reason)}
            className="hall-field w-full text-sm"
          >
            {c.reportReasons.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value.slice(0, 500))}
            rows={2}
            placeholder={zh ? "补充说明（可留空）" : "Anything to add (optional)"}
            className="hall-field w-full resize-y text-sm"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={report.isPending}
              onClick={() => void submit()}
              className="hall-tap rounded-full border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs text-foreground"
            >
              {report.isPending ? (zh ? "提交中…" : "Sending…") : zh ? "提交举报" : "Send report"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="hall-tap rounded-full border border-primary/15 px-3 py-1.5 text-xs text-muted-foreground"
            >
              {zh ? "取消" : "Cancel"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
