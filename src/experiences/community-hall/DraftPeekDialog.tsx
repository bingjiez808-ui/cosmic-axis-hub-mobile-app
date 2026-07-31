/**
 * 同门 · 众生之厅 — the unsent draft, lifted in place.
 *
 * The progress strip should never yank the traveler out of the room they are
 * reading. Tapping "打开草稿" unfolds the saved letter in the same paper-sheet
 * modal the samples use: they can re-read it, discard it, or choose to walk
 * back to the writing desk — but only on purpose, never by accident.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useCommunityHall } from "@/lib/i18n-community-hall";
import { clearLetterDraft, type LetterDraft } from "@/lib/letter-draft";

const STEP_LABEL: Record<1 | 2 | 3, { zh: string; en: string }> = {
  1: { zh: "第一步 · 落笔", en: "Step 1 · Writing" },
  2: { zh: "第二步 · 选择去处", en: "Step 2 · Destination" },
  3: { zh: "第三步 · 封蜡待寄", en: "Step 3 · Ready to seal" },
};

export function DraftPeekDialog({
  draft,
  open,
  onOpenChange,
}: {
  draft: LetterDraft | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const c = useCommunityHall();
  const zh = c.lang !== "en";
  const navigate = useNavigate();
  const [unsealed, setUnsealed] = useState(false);

  useEffect(() => {
    if (!open) {
      setUnsealed(false);
      return;
    }
    const t = window.setTimeout(() => setUnsealed(true), 380);
    return () => window.clearTimeout(t);
  }, [open]);

  const step = draft?.step ?? 1;

  return (
    <Dialog open={open && Boolean(draft)} onOpenChange={onOpenChange}>
      <DialogContent className="hall-letter-modal max-h-[86vh] w-[min(34rem,92vw)] max-w-none gap-0 overflow-hidden border-0 bg-transparent p-0 shadow-none">
        {draft ? (
          <div className="hall-letter-sheet" data-unsealed={unsealed ? "true" : "false"}>
            <span className="hall-letter-wax" aria-hidden="true">
              <span className="hall-letter-wax-mark">✒</span>
            </span>

            <div className="hall-letter-scroll max-h-[86vh] overflow-y-auto px-6 pb-6 pt-10 sm:px-9 sm:pb-8">
              <span className="hall-letter-badge">{zh ? "未寄出的草稿" : "Unsent draft"}</span>

              <DialogTitle className="hall-letter-title mt-4">
                {draft.subject?.trim() || (zh ? "尚未署名的一封信" : "A letter without a title")}
              </DialogTitle>

              <p className="mt-1.5 text-[0.7rem] uppercase tracking-[0.24em] text-muted-foreground">
                {zh ? STEP_LABEL[step].zh : STEP_LABEL[step].en}
                {draft.topic ? ` · ${c.topic(draft.topic)}` : ""}
                {draft.band ? ` · ${c.ageBand(draft.band)}` : ""}
              </p>

              <span className="hall-letter-rule mt-5" aria-hidden="true" />

              <p className="hall-letter-body mt-5 whitespace-pre-line">
                {draft.body.trim() ||
                  (zh ? "（这封信还只有标题。）" : "(This letter is still only a title.)")}
              </p>

              <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    clearLetterDraft();
                    onOpenChange(false);
                  }}
                >
                  {zh ? "丢弃草稿" : "Discard draft"}
                </Button>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                    {zh ? "稍后再说" : "Not now"}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      onOpenChange(false);
                      void navigate({ to: "/community/write" });
                    }}
                  >
                    {zh ? "继续写完 →" : "Continue writing →"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
