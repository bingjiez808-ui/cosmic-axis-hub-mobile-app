/**
 * 同门 · 众生之厅 — first-visit onboarding.
 *
 * Three cards shown once per traveler: what the hall is, how to protect
 * yourself, and how to answer gently. The "seen" flag lives on the community
 * profile, so it follows the account rather than the browser.
 */
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useCommunityProfile, useMarkOnboarded } from "@/lib/community-hall-client";
import { useCommunityHall } from "@/lib/i18n-community-hall";
import { useSupabaseSession } from "@/lib/session";

export function HallOnboarding() {
  const c = useCommunityHall();
  const { user } = useSupabaseSession();
  const profile = useCommunityProfile(Boolean(user));
  const mark = useMarkOnboarded();
  const [step, setStep] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  const seen = Boolean(profile.data?.profile?.onboardedAt);
  if (!user || profile.isLoading || seen || dismissed) return null;

  const cards = c.onboardCards;
  const card = cards[step];
  const last = step === cards.length - 1;

  function finish() {
    setDismissed(true);
    mark.mutate();
  }

  return (
    <section
      aria-label={c.onboardTitle}
      className="hall-paper mx-auto mt-8 max-w-3xl p-5 sm:p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.7rem] uppercase tracking-[0.3em] text-primary/70">{c.onboardTitle}</p>
        <span className="text-xs text-muted-foreground">
          {step + 1} / {cards.length}
        </span>
      </div>

      <h3 className="hall-card-title mt-3">{card.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{card.body}</p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {step > 0 ? (
          <Button
            size="sm"
            variant="ghost"
            className="hall-tap"
            onClick={() => setStep(step - 1)}
          >
            ←
          </Button>
        ) : null}
        {last ? (
          <Button size="sm" className="hall-tap" disabled={mark.isPending} onClick={finish}>
            {c.onboardDone}
          </Button>
        ) : (
          <Button size="sm" className="hall-tap" onClick={() => setStep(step + 1)}>
            {c.onboardNext}
          </Button>
        )}
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="hall-tap text-xs text-muted-foreground hover:text-foreground"
        >
          {c.onboardSkip}
        </button>
        <span className="ml-auto flex gap-1.5">
          {cards.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`${i + 1} / ${cards.length}`}
              aria-current={i === step ? "step" : undefined}
              onClick={() => setStep(i)}
              className="hall-tap flex h-6 w-4 items-center justify-center"
            >
              <span
                className={`h-1.5 w-1.5 rounded-full transition ${i === step ? "bg-primary" : "bg-primary/25"}`}
              />
            </button>
          ))}
        </span>
      </div>

    </section>
  );
}
