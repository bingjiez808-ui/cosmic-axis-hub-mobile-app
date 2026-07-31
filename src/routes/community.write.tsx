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

  // Restore any unsent draft synchronously on first client render so a refresh
  // never loses what the traveler already wrote.
  const [restored] = useState(() => loadLetterDraft());

  const [step, setStep] = useState<1 | 2 | 3>(restored?.step ?? 1);
  const [subject, setSubject] = useState(restored?.subject ?? "");
  const [body, setBody] = useState(restored?.body ?? "");
  const [topic, setTopic] = useState<string>(restored?.topic ?? "self");
  const [band, setBand] = useState<AgeBand | null>((restored?.band as AgeBand | null) ?? null);
  const [visibility, setVisibility] = useState<Visibility>("delivered_only");
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

  function goStepThree() {
    if (!band) return setError(c.required);
    setError(null);
    setStep(3);
  }

  async function submit() {
    if (!band || !agree) return setError(c.required);
    try {
      const result = await send.mutateAsync({
        subject: subject.trim() || null,
        body: body.trim(),
        topic,
        targetAgeBand: band,
        visibility,
      });
      setError(null);
      setErrorCode(null);
      sentRef.current = true;
      clearLetterDraft();
      setSavedAt(null);
      setDraftRestored(false);
      setSent({
        pendingReview: result.pendingReview,
        delivered: result.delivered,
        visibility,
      });
    } catch (err) {
      setErrorCode(hallErrorCode(err));
      setError(hallErrorMessage(err, c.lang));
    }
  }


  if (sent) {
    return (
      <section className="hall-paper hall-open-in mt-8 p-8 text-center">
        <p className="hall-eyebrow">{c.hallEyebrow}</p>
        <h2 className="hall-section-title mt-4">{c.sentTitle}</h2>
        <p className="mx-auto mt-4 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
          {sent.pendingReview
            ? c.pendingReview
            : sent.visibility === "wall"
              ? c.lang === "en"
                ? "Your letter is now pinned on the public wall. Anyone in the hall may read it and choose to answer."
                : "你的信已经张贴在公共信墙上，厅中任何人都能读到，并选择是否回信。"
              : c.sentBody}
        </p>
        {!sent.pendingReview ? (
          <p className="mt-3 text-xs text-primary/80">
            {sent.visibility === "wall"
              ? c.lang === "en"
                ? "Visible to everyone in the hall"
                : "全厅可见"
              : `${c.deliveredCount} ${sent.delivered} ${c.people}`}
          </p>
        ) : null}
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Button asChild className="hall-tap">
            <Link to={sent.visibility === "wall" ? "/community/wall" : "/community/echoes"}>
              {sent.visibility === "wall"
                ? c.lang === "en"
                  ? "See it on the wall"
                  : "去信墙看看"
                : c.sentGoEchoes}
            </Link>
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
              {c.lang === "en" ? "How should this letter travel?" : "这封信怎么走？"}
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {(
                [
                  {
                    key: "delivered_only" as const,
                    title: c.lang === "en" ? "Hand it to the courier" : "交给信使定向投递",
                    body:
                      c.lang === "en"
                        ? "Private. The courier delivers it to a few strangers in the chapter of life you chose; only they can answer."
                        : "私密。信使会把它分批送给你选定人生阶段中的少数陌生旅者，只有收到的人能回信。",
                  },
                  {
                    key: "wall" as const,
                    title: c.lang === "en" ? "Pin it on the public wall" : "张贴到公共信墙",
                    body:
                      c.lang === "en"
                        ? "Open. Everyone in the hall can read it and decide whether to answer. Still anonymous — only your traveler alias shows."
                        : "公开。厅中所有人都能读到，谁想回就回。依然匿名，只显示你的旅者代号。",
                  },
                ]
              ).map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setVisibility(option.key)}
                  aria-pressed={visibility === option.key}
                  className={`hall-tap rounded-2xl border p-4 text-left transition ${
                    visibility === option.key
                      ? "border-primary/50 bg-primary/10"
                      : "border-primary/15 bg-background/60 hover:border-primary/30"
                  }`}
                >
                  <span className="block text-sm font-semibold text-foreground">{option.title}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                    {option.body}
                  </span>
                </button>
              ))}
            </div>
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
                {visibility === "wall"
                  ? c.lang === "en"
                    ? "public wall"
                    : "公共信墙"
                  : c.lang === "en"
                    ? "courier delivery"
                    : "信使定向投递"}
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
              disabled={!agree || send.isPending}
              onClick={() => void submit()}
            >
              {send.isPending ? c.sending : c.seal}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
