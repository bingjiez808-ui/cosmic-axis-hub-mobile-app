/**
 * 写信须知 — the rules panel shown at the writing desk, plus a live client-side
 * pre-check. The same `screenCommunityText` runs on the server before anything
 * is persisted; this only saves the traveler a rejected send.
 */
import { useMemo } from "react";

import { safetyMessage, screenCommunityText } from "@/lib/community-hall-safety";
import { useCommunityHall } from "@/lib/i18n-community-hall";

export function useLetterPrecheck(text: string) {
  return useMemo(() => {
    const trimmed = (text ?? "").trim();
    if (trimmed.length < 12) return null;
    const verdict = screenCommunityText(trimmed);
    if (verdict.action === "allow") return null;
    return verdict;
  }, [text]);
}

export function LetterRulesNotice() {
  const c = useCommunityHall();
  const zh = c.lang !== "en";
  const rules = zh
    ? [
        "遵守所在地法律法规：不得发表违反政治法规、煽动或极端主义的言论。",
        "不得涉及任何违法事项：毒品、枪支、赌博、伪造证件、洗钱、盗取信息等。",
        "不得涉黄：色情内容、性交易、性骚扰与任何涉及未成年人的性相关内容一律禁止。",
        "不得辱骂、威胁、人肉或歧视他人；言论应正当、真诚、就事论事。",
        "不得留下手机号、微信、邮箱、二维码或外部链接——全程匿名是这里的底线。",
      ]
    : [
        "Follow the law where you live: no political content that breaks regulations, no incitement, no extremism.",
        "Nothing illegal: drugs, weapons, gambling, forged documents, money laundering, stolen data.",
        "Nothing sexual: pornography, sex trade, harassment, and absolutely nothing involving minors.",
        "No insults, threats, doxxing or discrimination. Speak honestly, and to the point.",
        "No phone numbers, chat IDs, emails, QR codes or links — anonymity is the floor here.",
      ];

  return (
    <details className="hall-inset mt-4 p-4" open>
      <summary className="cursor-pointer text-sm font-medium text-foreground">
        {zh ? "写信须知 · 内容规范与法规提示" : "Before you write · rules and legal notice"}
      </summary>
      <ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
        {rules.map((r) => (
          <li key={r}>· {r}</li>
        ))}
      </ul>
      <p className="mt-3 text-xs leading-relaxed text-primary/80">
        {zh
          ? "每封信在寄出前都会经过自动审查；命中禁止内容会被直接拦下，涉及危机或高风险的信会先由馆员人工复核后再投递。任何旅者都可以对信件和回音发起举报。"
          : "Every letter is screened before it is sent. Forbidden content is refused outright; crisis or high-risk letters wait for a librarian to review them first. Any traveler may report a letter or an echo."}
      </p>
    </details>
  );
}

export function PrecheckWarning({ text }: { text: string }) {
  const c = useCommunityHall();
  const zh = c.lang !== "en";
  const verdict = useLetterPrecheck(text);
  if (!verdict) return null;

  const blocked = verdict.action === "block";
  return (
    <p
      className={`mt-2 rounded-xl border p-3 text-xs leading-relaxed ${
        blocked
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-primary/25 bg-primary/5 text-foreground/85"
      }`}
    >
      {blocked
        ? zh
          ? safetyMessage(verdict.categories)
          : "This letter contains content the hall cannot carry. Please revise it before sending."
        : zh
          ? "这封信涉及高风险内容，寄出后会先由馆员人工复核，通过后才会投递。"
          : "This letter touches high-risk content. A librarian will read it before it is delivered."}
    </p>
  );
}
