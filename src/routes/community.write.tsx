import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  HallGate,
  HallHeader,
  HallMobileBar,
  HallNav,
} from "@/experiences/community-hall/HallShell";
import { LetterPromptDeck } from "@/experiences/community-hall/LetterPromptDeck";

import { useSendLetter } from "@/lib/community-hall-client";
import { hallErrorCode, hallErrorMessage, type HallErrorCode } from "@/lib/community-hall-errors";
import { useCommunityHall, type AgeBand } from "@/lib/i18n-community-hall";
import { clearLetterDraft, loadLetterDraft, saveLetterDraft } from "@/lib/letter-draft";
import { useAskSage, useSageEntitlement, useSendToLibrarian } from "@/lib/sage-council-client";
import { SAGE_DOMAIN_LABEL, SAGE_PERSONAS } from "@/lib/sage-personas";
import "@/experiences/community-hall/hall.css";

const BODY_MIN = 30;
const BODY_MAX = 1200;

/**
 * /community/write — the three-step writing desk.
 * Step 1 writes the question, step 2 chooses which chapter of life should
 * read it, step 3 previews the sealed envelope and sends. Validation is
 * inline; the send result gets its own screen rather than a toast, so the
 * traveler always knows where the letter went.
 */
export const Route = createFileRoute("/community/write")({
  head: () => ({
    meta: [
      { title: "寄信台 · 众生之厅 — Write a letter | Library of Destiny" },
      {
        name: "description",
        content:
          "写下此刻的问题，选择你想询问的人生阶段，匿名寄出。Write a question and send it anonymously to a chapter of life.",
      },
      { property: "og:title", content: "寄信台 · 众生之厅" },
      { property: "og:description", content: "把一个问题，寄给走过这段路的人。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: WriteLetterPage,
});

function WriteLetterPage() {
  const c = useCommunityHall();
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-28 sm:px-6 sm:pb-24 sm:pt-32">
      <HallHeader title={c.writeTitle} subtitle={c.writeIntro} />
      <HallNav />
      <HallGate>
        <WriteFlow />
      </HallGate>
      <HallMobileBar />
    </main>
  );
}

type Sent = { pendingReview: boolean; delivered: number; dest: Destination; reply?: string | null };

/**
 * Where the letter goes. Four doors, chosen in step 2:
 *   courier   — private delivery to a few strangers in the chosen chapter
 *   wall      — pinned on the public board, anyone may answer
 *   sage      — a distilled historical persona answers (贤者 membership)
 *   librarian — lands on the librarian's desk, who answers or entrusts it
 */
type Destination = "courier" | "wall" | "sage" | "librarian";

function WriteFlow() {
  const c = useCommunityHall();
  const navigate = useNavigate();
  const send = useSendLetter();
  const askSage = useAskSage();
  const sendLibrarian = useSendToLibrarian();
  const entitlement = useSageEntitlement();

  // Restore any unsent draft synchronously on first client render so a refresh
  // never loses what the traveler already wrote.
  const [restored] = useState(() => loadLetterDraft());

  const [step, setStep] = useState<1 | 2 | 3>(restored?.step ?? 1);
  const [subject, setSubject] = useState(restored?.subject ?? "");
  const [body, setBody] = useState(restored?.body ?? "");
  const [topic, setTopic] = useState<string>(restored?.topic ?? "self");
  const [band, setBand] = useState<AgeBand | null>((restored?.band as AgeBand | null) ?? null);
  const [dest, setDest] = useState<Destination>("courier");
  const [personaId, setPersonaId] = useState<string>(SAGE_PERSONAS[0].id);
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<HallErrorCode | null>(null);
  const [sent, setSent] = useState<Sent | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(restored?.savedAt ?? null);
  const [draftRestored, setDraftRestored] = useState(Boolean(restored?.body));
  const sentRef = useRef(false);
  sentRef.current = Boolean(sent);

  const length = body.trim().length;

  // Debounced autosave of the in-progress letter.
  useEffect(() => {
    if (sentRef.current) return;
    if (!subject && !body && !band && step === 1) return;
    const t = window.setTimeout(() => {
      const at = saveLetterDraft({ step, subject, body, topic, band });
      if (at) setSavedAt(at);
    }, 500);
    return () => window.clearTimeout(t);
  }, [step, subject, body, topic, band]);

  function discardDraft() {
    clearLetterDraft();
    setSubject("");
    setBody("");
    setBand(null);
    setStep(1);
    setSavedAt(null);
    setDraftRestored(false);
    setError(null);
  }

  const savedLabel =
    savedAt === null
      ? null
      : c.lang === "en"
        ? `Draft saved ${new Date(savedAt).toLocaleTimeString()}`
        : `草稿已保存 ${new Date(savedAt).toLocaleTimeString()}`;


  function goStepTwo() {
    if (length < BODY_MIN) return setError(c.bodyTooShort(BODY_MIN));
    if (length > BODY_MAX) return setError(c.tooLong);
    setError(null);
    setStep(2);
  }

  const zh = c.lang !== "en";
  const entitledForSage = Boolean(entitlement.data?.entitled);
  const humanCredits = entitlement.data?.credits?.remaining ?? 0;
  const busy = send.isPending || askSage.isPending || sendLibrarian.isPending;

  function goStepThree() {
    if (!band) return setError(c.required);
    if ((dest === "sage" || dest === "librarian") && !entitledForSage) {
      return setError(
        zh
          ? "先贤回信与图书管理员亲自回信，都需要开通「贤者」会员。"
          : "Sage letters and the librarian's personal reply both require the Sage membership.",
      );
    }
    if (dest === "librarian" && humanCredits <= 0) {
      return setError(
        zh
          ? "本月的三次真人回复已经用完了。可以先寄给信使或张贴到信墙。"
          : "This month's three human-reply grants are used up. Try the courier or the public wall.",
      );
    }
    setError(null);
    setStep(3);
  }

  async function submit() {
    if (!band || !agree) return setError(c.required);
    try {
      setErrorCode(null);
      if (dest === "sage") {
        const result = await askSage.mutateAsync({
          personaId,
          subject: subject.trim() || null,
          body: body.trim(),
          topic,
          targetAgeBand: band,
          lang: zh ? "zh" : "en",
        });
        finishSend({ pendingReview: result.pendingReview, delivered: 0, dest, reply: result.reply });
        return;
      }
      if (dest === "librarian") {
        const result = await sendLibrarian.mutateAsync({
          subject: subject.trim() || null,
          body: body.trim(),
          topic,
          targetAgeBand: band,
        });
        finishSend({ pendingReview: result.pendingReview, delivered: 0, dest });
        return;
      }
      const result = await send.mutateAsync({
        subject: subject.trim() || null,
        body: body.trim(),
        topic,
        targetAgeBand: band,
        visibility: dest === "wall" ? "wall" : "delivered_only",
      });
      finishSend({ pendingReview: result.pendingReview, delivered: result.delivered, dest });
    } catch (err) {
      setErrorCode(hallErrorCode(err));
      setError(hallErrorMessage(err, c.lang));
    }
  }

  function finishSend(next: Sent) {
    setError(null);
    sentRef.current = true;
    clearLetterDraft();
    setSavedAt(null);
    setDraftRestored(false);
    setSent(next);
  }

  if (sent) {
    const outcome: Record<Destination, { body: string; note: string; to: string; cta: string }> = {
      courier: {
        body: c.sentBody,
        note: `${c.deliveredCount} ${sent.delivered} ${c.people}`,
        to: "/community/echoes",
        cta: c.sentGoEchoes,
      },
      wall: {
        body: zh
          ? "你的信已经张贴在公共信墙上，厅中任何人都能读到，并选择是否回信。"
          : "Your letter is now pinned on the public wall. Anyone in the hall may read it and choose to answer.",
        note: zh ? "全厅可见" : "Visible to everyone in the hall",
        to: "/community/wall",
        cta: zh ? "去信墙看看" : "See it on the wall",
      },
      sage: {
        body: zh
          ? "先贤已就着自己的生平与主张，为你写下一封回信。"
          : "The sage has written back, drawing on their own documented life and arguments.",
        note: zh ? "回信已在先贤案前" : "The reply is waiting at the sages' desk",
        to: "/community/sages",
        cta: zh ? "读这封回信" : "Read the reply",
      },
      librarian: {
        body: zh
          ? "信已经放在图书管理员的案头。他会亲自回信，或把它托付给一位愿意接信的旅者。"
          : "Your letter is on the librarian's desk. They will answer it themselves, or entrust it to a traveler who has offered to help.",
        note: zh ? "等待图书管理员处理" : "Waiting on the librarian",
        to: "/community/sages",
        cta: zh ? "去我的案前查看" : "See my desk",
      },
    };
    const o = outcome[sent.dest];
    return (
      <section className="hall-paper hall-open-in mt-8 p-8 text-center">
        <p className="hall-eyebrow">{c.hallEyebrow}</p>
        <h2 className="hall-section-title mt-4">{c.sentTitle}</h2>
        <p className="mx-auto mt-4 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
          {sent.pendingReview ? c.pendingReview : o.body}
        </p>
        {!sent.pendingReview ? (
          <p className="mt-3 text-xs text-primary/80">{o.note}</p>
        ) : null}
        {sent.reply ? (
          <div className="hall-paper hall-envelope mt-6 p-5 text-left">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{sent.reply}</p>
          </div>
        ) : null}
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Button asChild className="hall-tap">
            <Link to={o.to}>{o.cta}</Link>
          </Button>
          <Button
            variant="outline"
            className="hall-tap"
            onClick={() => {
              setSent(null);
              setSubject("");
              setBody("");
              setBand(null);
              setAgree(false);
              setStep(1);
            }}
          >
            {c.sentWriteAnother}
          </Button>
          <Button variant="ghost" className="hall-tap" onClick={() => void navigate({ to: "/community/outbox" })}>
            {c.sectionOutbox}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="hall-paper mt-8 p-5 sm:p-6">
      <p className="text-[0.7rem] uppercase tracking-[0.3em] text-primary/70">{c.stepOfThree(step)}</p>
      <ol className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
        {[c.stepOne, c.stepTwo, c.stepThree].map((label, i) => (
          <li
            key={label}
            className={`rounded-full px-3 py-1 transition ${
              step === i + 1 ? "bg-primary/15 text-primary" : "bg-background/60"
            }`}
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      {savedLabel ? (
        <div className="hall-inset mt-3 flex flex-wrap items-center gap-3 px-3 py-2 text-xs text-muted-foreground">
          <span className="text-primary/80">
            {draftRestored
              ? c.lang === "en"
                ? "Unsent draft restored."
                : "已恢复上次未寄出的草稿。"
              : savedLabel}
          </span>
          <button type="button" onClick={discardDraft} className="hall-tap underline underline-offset-4 hover:text-foreground">
            {c.lang === "en" ? "Discard draft" : "清除草稿"}
          </button>
        </div>
      ) : null}


      {step === 1 ? (
        <div className="hall-rise mt-6 space-y-5">
          <div>
            <span className="text-sm font-medium text-foreground">{c.fieldTopic}</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {c.topics.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTopic(t.key)}
                  className={`hall-tap rounded-full border px-3.5 py-2 text-xs transition ${
                    topic === t.key
                      ? "border-primary/50 bg-primary/15 text-primary"
                      : "border-primary/15 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <LetterPromptDeck
            topic={topic}
            onPick={(p) => {
              setSubject(p.subject.slice(0, 80));
              setBody(p.body.slice(0, BODY_MAX));
              setError(null);
            }}
          />
          <label className="block">
            <span className="text-sm font-medium text-foreground">{c.fieldSubject}</span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value.slice(0, 80))}
              placeholder={c.fieldSubjectHint}
              className="hall-field hall-tap mt-2 text-base sm:text-sm"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-foreground">{c.fieldBody}</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, BODY_MAX))}
              rows={9}
              placeholder={c.echoPlaceholder}
              className="hall-field mt-2 resize-y text-base sm:text-sm"
            />
            <span
              className={`mt-1 block text-right text-xs ${
                length > 0 && length < BODY_MIN ? "text-primary/80" : "text-muted-foreground"
              }`}
            >
              {c.bodyCounter(length, BODY_MAX)}
            </span>
          </label>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button className="hall-tap w-full sm:w-auto" onClick={goStepTwo}>
            {c.next}
          </Button>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="hall-rise mt-6 space-y-5">
          <p className="text-sm font-medium text-foreground">{c.chooseBand}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {c.bands.map((b) => (
              <button
                key={b.key}
                type="button"
                onClick={() => setBand(b.key)}
                aria-pressed={band === b.key}
                className={`hall-tap rounded-2xl border p-4 text-left transition ${
                  band === b.key
                    ? "border-primary/50 bg-primary/10"
                    : "border-primary/15 bg-background/60 hover:border-primary/30"
                }`}
              >
                <span className="block text-sm font-semibold text-foreground">{b.label}</span>
                <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                  {b.invite}
                </span>
              </button>
            ))}
          </div>
          <div className="pt-2">
            <p className="text-sm font-medium text-foreground">
              {zh ? "这封信寄给谁？" : "Who should receive this letter?"}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {zh
                ? "无论寄往哪一扇门，来往都只以旅者身份署名——对方看到的永远是你的代号，不是你的账号。"
                : "Whichever door you choose, every letter travels under your traveler identity — the other side only ever sees your alias, never your account."}
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {(
                [
                  {
                    key: "courier" as const,
                    title: zh ? "交给信使定向投递" : "Hand it to the courier",
                    body: zh
                      ? "私密。信使会把它分批送给你选定人生阶段中的少数陌生旅者，只有收到的人能回信。免费。"
                      : "Private. The courier delivers it to a few strangers in the chapter of life you chose; only they can answer. Free.",
                    locked: false,
                  },
                  {
                    key: "wall" as const,
                    title: zh ? "张贴到公共信墙" : "Pin it on the public wall",
                    body: zh
                      ? "公开。厅中所有人都能读到，谁想回就回。依然匿名，只显示你的旅者代号。免费。"
                      : "Open. Everyone in the hall can read it and decide whether to answer. Still anonymous — only your traveler alias shows. Free.",
                    locked: false,
                  },
                  {
                    key: "sage" as const,
                    title: zh ? "请一位历代先贤回信" : "Ask a sage of the past",
                    body: zh
                      ? "十二位已故思想者依其生平与语气回信。需「贤者」会员，回信不限次。"
                      : "One of twelve long-dead thinkers answers in their own documented voice. Requires the Sage membership; unlimited.",
                    locked: !entitledForSage,
                  },
                  {
                    key: "librarian" as const,
                    title: zh ? "请图书管理员亲自回信" : "Ask the librarian to write back",
                    body: zh
                      ? `真人回信。图书管理员亲自读信并回复，或托付给一位愿意接信的旅者。需「贤者」会员，每月赠三次（本月剩 ${humanCredits} 次）。`
                      : `A real person answers. The librarian reads it and replies, or entrusts it to a traveler who offered to help. Requires the Sage membership; three grants a month (${humanCredits} left).`,
                    locked: !entitledForSage || humanCredits <= 0,
                  },
                ]
              ).map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setDest(option.key)}
                  aria-pressed={dest === option.key}
                  className={`hall-tap rounded-2xl border p-4 text-left transition ${
                    dest === option.key
                      ? "border-primary/50 bg-primary/10"
                      : "border-primary/15 bg-background/60 hover:border-primary/30"
                  }`}
                >
                  <span className="block text-sm font-semibold text-foreground">
                    {option.title}
                    {option.locked ? (
                      <span className="ml-2 rounded-full border border-primary/30 px-2 py-0.5 text-[0.62rem] text-primary/80">
                        {!entitledForSage
                          ? zh
                            ? "贤者会员"
                            : "Sage only"
                          : zh
                            ? "本月已用完"
                            : "No grants left"}
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                    {option.body}
                  </span>
                </button>
              ))}
            </div>
            {dest === "sage" ? (
              entitledForSage ? (
                <div className="mt-4">
                  <p className="text-sm font-medium text-foreground">
                    {zh ? "选择一位先贤" : "Choose a sage"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {SAGE_PERSONAS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPersonaId(p.id)}
                        aria-pressed={personaId === p.id}
                        className={`hall-tap rounded-full border px-3.5 py-2 text-xs transition ${
                          personaId === p.id
                            ? "border-primary/50 bg-primary/15 text-primary"
                            : "border-primary/15 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {zh ? p.name.zh : p.name.en}
                        <span className="ml-1 opacity-60">
                          {SAGE_DOMAIN_LABEL[p.domain][zh ? "zh" : "en"]}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="hall-inset mt-4 flex flex-wrap items-center gap-3 px-4 py-3 text-xs text-muted-foreground">
                  <span>
                    {zh
                      ? "先贤回信为「贤者」会员权益。"
                      : "Sage replies are part of the Sage membership."}
                  </span>
                  <Link
                    to="/me/membership"
                    className="hall-tap underline underline-offset-4 hover:text-foreground"
                  >
                    {zh ? "了解贤者会员" : "See the Sage membership"}
                  </Link>
                </div>
              )
            ) : null}
            {dest === "librarian" ? (
              <div className="hall-inset mt-4 flex flex-wrap items-center gap-3 px-4 py-3 text-xs text-muted-foreground">
                <span>
                  {!entitledForSage
                    ? zh
                      ? "图书管理员亲自回信为「贤者」会员权益，每月赠三次真人回复。"
                      : "A personal reply from the librarian is a Sage membership benefit, with three human replies a month."
                    : zh
                      ? `本月还剩 ${humanCredits} 次真人回复。寄出后会立即扣除一次。`
                      : `${humanCredits} human replies left this month. Sending spends one right away.`}
                </span>
                {!entitledForSage ? (
                  <Link
                    to="/me/membership"
                    className="hall-tap underline underline-offset-4 hover:text-foreground"
                  >
                    {zh ? "了解贤者会员" : "See the Sage membership"}
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">{c.autoExpire}</p>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex gap-3">
            <Button variant="ghost" className="hall-tap" onClick={() => setStep(1)}>
              {c.back}
            </Button>
            <Button className="hall-tap flex-1 sm:flex-none" onClick={goStepThree}>
              {c.next}
            </Button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="hall-rise mt-6 space-y-5">
          <div className="hall-paper hall-envelope p-5" data-unread="true">
            <p className="text-xs text-muted-foreground">
              {c.previewTo} {c.ageBand(band)} · {c.topic(topic)} ·{" "}
              <span className="text-primary/80">
                {dest === "wall"
                  ? zh
                    ? "公共信墙"
                    : "public wall"
                  : dest === "sage"
                    ? (zh ? "先贤 · " : "Sage · ") +
                      (SAGE_PERSONAS.find((p) => p.id === personaId)?.name[zh ? "zh" : "en"] ?? "")
                    : dest === "librarian"
                      ? zh
                        ? "图书管理员"
                        : "the librarian"
                      : zh
                        ? "信使定向投递"
                        : "courier delivery"}
              </span>
            </p>
            <h3 className="hall-card-title mt-2">
              {subject.trim() || c.topic(topic)}
            </h3>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {body.trim()}
            </p>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">{c.previewSealHint}</p>
          <label className="flex items-start gap-3 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
              className="mt-1 h-4 w-4"
            />
            <span>{c.agreeRules}</span>
          </label>
          {error ? (
            <div className="space-y-2">
              <p className="text-sm text-destructive">{error}</p>
              {errorCode === "duplicate_submission" || errorCode === "daily_letter_limit" ? (
                <Button asChild variant="outline" size="sm" className="hall-tap">
                  <Link to="/community/outbox">{c.sectionOutbox}</Link>
                </Button>
              ) : null}
            </div>
          ) : null}
          <div className="flex gap-3">
            <Button variant="ghost" className="hall-tap" onClick={() => setStep(2)}>
              {c.back}
            </Button>
            <Button
              className="hall-tap flex-1 sm:flex-none"
              disabled={!agree || busy}
              onClick={() => void submit()}
            >
              {busy ? c.sending : c.seal}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
