import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { HallGate, HallHeader, HallNav } from "@/experiences/community-hall/HallShell";
import { useSendLetter } from "@/lib/community-hall-client";
import { useCommunityHall, type AgeBand } from "@/lib/i18n-community-hall";

/**
 * /community/write — the three-step writing desk.
 * Step 1 writes the question, step 2 chooses which chapter of life should
 * read it, step 3 previews the sealed envelope and sends. Validation is
 * inline and never blocks with a modal.
 */
export const Route = createFileRoute("/community/write")({
  head: () => ({
    meta: [
      { title: "寄信台 · 众生之厅 — Write a letter | Library of Destiny" },
      {
        name: "description",
        content: "写下此刻的问题，选择你想询问的人生阶段，匿名寄出。Write a question and send it anonymously to a chapter of life.",
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
    <main className="mx-auto w-full max-w-3xl px-4 pb-24 pt-12 sm:px-6">
      <HallHeader title={c.writeTitle} subtitle={c.hallSubtitle} />
      <HallNav />
      <HallGate>
        <WriteFlow />
      </HallGate>
    </main>
  );
}

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

  function goStepTwo() {
    if (body.trim().length < 20) {
      setError(c.tooShort);
      return;
    }
    if (body.trim().length > 4000) {
      setError(c.tooLong);
      return;
    }
    setError(null);
    setStep(2);
  }

  function goStepThree() {
    if (!band) {
      setError(c.required);
      return;
    }
    setError(null);
    setStep(3);
  }

  async function submit() {
    if (!band || !agree) {
      setError(c.required);
      return;
    }
    try {
      await send.mutateAsync({
        subject: subject.trim() || null,
        body: body.trim(),
        topic,
        targetAgeBand: band,
      });
      toast.success(c.sentTitle, { description: c.pendingReview });
      void navigate({ to: "/community/outbox" });
    } catch (err) {
      setError(err instanceof Error ? err.message : c.required);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-primary/15 bg-background/50 p-6 backdrop-blur">
      <ol className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {[c.stepOne, c.stepTwo, c.stepThree].map((label, i) => (
          <li
            key={label}
            className={`rounded-full px-3 py-1 ${
              step === i + 1 ? "bg-primary/15 text-primary" : "bg-background/60"
            }`}
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      {step === 1 ? (
        <div className="mt-6 space-y-5">
          <label className="block">
            <span className="text-sm font-medium text-foreground">{c.fieldSubject}</span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value.slice(0, 80))}
              placeholder={c.fieldSubjectHint}
              className="mt-2 w-full rounded-xl border border-primary/20 bg-background/70 px-4 py-3 text-sm outline-none focus:border-primary/50"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-foreground">{c.fieldBody}</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, 4000))}
              rows={9}
              placeholder={c.fieldBodyHint}
              className="mt-2 w-full resize-y rounded-xl border border-primary/20 bg-background/70 px-4 py-3 text-sm leading-relaxed outline-none focus:border-primary/50"
            />
            <span className="mt-1 block text-right text-xs text-muted-foreground">
              {body.trim().length} / 4000
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
                  className={`rounded-full border px-3 py-1.5 text-xs transition ${
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
          <Button onClick={goStepTwo}>{c.next}</Button>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="mt-6 space-y-5">
          <p className="text-sm font-medium text-foreground">{c.chooseBand}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {c.bands.map((b) => (
              <button
                key={b.key}
                type="button"
                onClick={() => setBand(b.key)}
                className={`rounded-2xl border p-4 text-left transition ${
                  band === b.key
                    ? "border-primary/50 bg-primary/10"
                    : "border-primary/15 bg-background/60 hover:border-primary/30"
                }`}
              >
                <span className="block text-sm font-semibold text-foreground">{b.label}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{b.chapter}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{c.autoExpire}</p>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setStep(1)}>
              {c.back}
            </Button>
            <Button onClick={goStepThree}>{c.next}</Button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="mt-6 space-y-5">
          <div className="rounded-2xl border border-primary/25 bg-primary/[0.06] p-5">
            <p className="text-xs text-muted-foreground">
              {c.toChapter} {c.ageBand(band)} · {c.topic(topic)}
            </p>
            <h3 className="mt-2 text-base font-semibold text-foreground">
              {subject.trim() || c.topic(topic)}
            </h3>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {body.trim()}
            </p>
          </div>
          <label className="flex items-start gap-3 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
              className="mt-1"
            />
            <span>{c.agreeRules}</span>
          </label>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setStep(2)}>
              {c.back}
            </Button>
            <Button disabled={!agree || send.isPending} onClick={() => void submit()}>
              {send.isPending ? c.sending : c.seal}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
