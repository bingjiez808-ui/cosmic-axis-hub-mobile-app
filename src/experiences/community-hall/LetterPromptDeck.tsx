import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useLang } from "@/lib/i18n";
import { letterPromptsFor, type ResolvedPrompt } from "@/lib/letter-prompts";

const VISIBLE = 3;

/**
 * A small deck of clickable starter letters. Travelers who freeze at the empty
 * page can drop a ready question into the desk with one tap, then edit it.
 * "换一批" rotates through the rest of the prompts for the chosen topic.
 */
export function LetterPromptDeck({
  topic,
  onPick,
}: {
  topic: string;
  onPick: (prompt: ResolvedPrompt) => void;
}) {
  const { lang } = useLang();
  const zh = lang === "zh";
  const prompts = useMemo(() => letterPromptsFor(topic, lang), [topic, lang]);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    setOffset(0);
  }, [topic]);

  const shown = useMemo(
    () =>
      Array.from({ length: Math.min(VISIBLE, prompts.length) }, (_, i) => {
        const index = (offset + i) % prompts.length;
        return { ...prompts[index], index };
      }),
    [prompts, offset],
  );

  return (
    <div className="rounded-2xl border border-primary/15 bg-background/50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">
            {zh ? "不知道怎么开口？" : "Not sure how to begin?"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {zh
              ? "点一个示例直接填入，再改成你自己的话。"
              : "Tap an example to fill the desk, then make it yours."}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="hall-tap shrink-0 gap-1.5 text-xs"
          onClick={() => setOffset((o) => (o + VISIBLE) % prompts.length)}
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          {zh ? "换一批" : "Shuffle"}
        </Button>
      </div>

      <ul className="mt-3 grid gap-2">
        {shown.map((p) => (
          <li key={p.index}>
            <button
              type="button"
              onClick={() => onPick(p)}
              className="hall-tap w-full rounded-xl border border-primary/15 bg-background/60 p-3 text-left transition hover:border-primary/40 hover:bg-primary/5"
            >
              <span className="block text-sm font-medium text-foreground">{p.subject}</span>
              <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-muted-foreground">
                {p.body}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
