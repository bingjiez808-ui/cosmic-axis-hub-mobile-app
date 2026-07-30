import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  HallGate,
  HallHeader,
  HallMobileBar,
  HallNav,
} from "@/experiences/community-hall/HallShell";
import { useSendLetter } from "@/lib/community-hall-client";
import { hallErrorMessage } from "@/lib/community-hall-errors";
import { useCommunityHall, type AgeBand } from "@/lib/i18n-community-hall";
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
    <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-12 sm:px-6 sm:pb-24">
      <HallHeader title={c.writeTitle} subtitle={c.writeIntro} />
      <HallNav />
      <HallGate>
        <WriteFlow />
      </HallGate>
      <HallMobileBar />
    </main>
  );
}

type Sent = { pendingReview: boolean; delivered: number };

function WriteFlow() {
  const c = useCommunityHall();
  const navigate = useNavigate();
  const send = useSendLetter();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [topic, setTopic] = useState<string>("self");
  const [band, setBand] = useState<AgeBand | null>(null);
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<Sent | null>(null);

  const length = body.trim().length;

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
      });
      setError(null);
      setSent({ pendingReview: result.pendingReview, delivered: result.delivered });
    } catch (err) {
      setError(hallErrorMessage(err, c.lang));
    }
  }

  if (sent) {
    return (
      <section className="hall-paper hall-open-in mt-8 p-8 text-center">
        <p className="text-[0.72rem] uppercase tracking-[0.4em] text-primary/70">{c.hallEyebrow}</p>
        <h2 className="mt-4 text-2xl font-semibold text-foreground">{c.sentTitle}</h2>
        <p className="mx-auto mt-4 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
          {sent.pendingReview ? c.pendingReview : c.sentBody}
        </p>
        {!sent.pendingReview ? (
          <p className="mt-3 text-xs text-primary/80">
            {c.deliveredCount} {sent.delivered} {c.people}
          </p>
        ) : null}
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Button asChild className="hall-tap">
            <Link to="/community/echoes">{c.sentGoEchoes}</Link>
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

      {step === 1 ? (
        <div className="hall-rise mt-6 space-y-5">
          <label className="block">
            <span className="text-sm font-medium text-foreground">{c.fieldSubject}</span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value.slice(0, 80))}
              placeholder={c.fieldSubjectHint}
              className="hall-tap mt-2 w-full rounded-xl border border-primary/20 bg-background/70 px-4 py-3 text-base outline-none focus:border-primary/50 sm:text-sm"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-foreground">{c.fieldBody}</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, BODY_MAX))}
              rows={9}
              placeholder={c.echoPlaceholder}
              className="mt-2 w-full resize-y rounded-xl border border-primary/20 bg-background/70 px-4 py-3 text-base leading-relaxed outline-none focus:border-primary/50 sm:text-sm"
            />
            <span
              className={`mt-1 block text-right text-xs ${
                length > 0 && length < BODY_MIN ? "text-primary/80" : "text-muted-foreground"
              }`}
            >
              {c.bodyCounter(length, BODY_MAX)}
            </span>
          </label>
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
              {c.previewTo} {c.ageBand(band)} · {c.topic(topic)}
            </p>
            <h3 className="mt-2 text-base font-semibold text-foreground">
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
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
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
