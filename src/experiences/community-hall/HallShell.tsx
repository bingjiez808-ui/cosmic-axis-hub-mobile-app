/**
 * 同门 · 众生之厅 — shared shell.
 *
 * Owns the page chrome every hall route shares: the parchment header, the
 * section nav (tabs on desktop, a compact bar on mobile) and the access gate.
 * The gate is a *soft* gate — signed-out and under-18 visitors still see the
 * hall's story and how it works, they only lose the write/read actions.
 */
import { Link, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { useCommunityHall } from "@/lib/i18n-community-hall";
import { useCommunityProfile, useSaveCommunityProfile } from "@/lib/community-hall-client";
import { useSupabaseSession } from "@/lib/session";

export function HallHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const c = useCommunityHall();
  return (
    <header className="mx-auto max-w-3xl text-center">
      <p className="text-[0.72rem] uppercase tracking-[0.42em] text-primary/70">{c.hallEyebrow}</p>
      <h1 className="mt-4 text-balance text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
        {title}
      </h1>
      {subtitle ? (
        <p className="mx-auto mt-4 max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
          {subtitle}
        </p>
      ) : null}
    </header>
  );
}

export function HallNav() {
  const c = useCommunityHall();
  const { pathname } = useLocation();
  const items = [
    { to: "/community", label: c.navHall },
    { to: "/community/write", label: c.navWrite },
    { to: "/community/inbox", label: c.navInbox },
    { to: "/community/outbox", label: c.sectionOutbox },
    { to: "/community/echoes", label: c.sectionEchoes },
  ] as const;
  return (
    <nav
      aria-label={c.hallEyebrow}
      className="mx-auto mt-8 flex max-w-3xl snap-x gap-2 overflow-x-auto rounded-full border border-primary/15 bg-background/50 p-1.5 backdrop-blur"
    >
      {items.map((item) => {
        const active = pathname === item.to;
        return (
          <Link
            key={item.to}
            to={item.to}
            className={`shrink-0 snap-start rounded-full px-4 py-2 text-xs font-medium transition sm:text-sm ${
              active
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-primary/5 hover:text-foreground"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function HallSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mx-auto mt-10 w-full max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground sm:text-xl">{title}</h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function HallEmpty({ text, cta }: { text: string; cta?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-primary/20 bg-background/40 p-8 text-center">
      <p className="text-pretty text-sm leading-relaxed text-muted-foreground">{text}</p>
      {cta ? <div className="mt-5 flex justify-center">{cta}</div> : null}
    </div>
  );
}

function GateCard({ text, cta }: { text: string; cta: ReactNode }) {
  return (
    <div className="mx-auto mt-10 max-w-xl rounded-2xl border border-primary/20 bg-background/60 p-7 text-center backdrop-blur">
      <p className="text-pretty text-sm leading-relaxed text-muted-foreground">{text}</p>
      <div className="mt-5 flex justify-center">{cta}</div>
    </div>
  );
}

/**
 * Renders `children` only when the traveler may actually take part:
 * signed in, 18+, and opted in. Each missing step gets its own explanation
 * and a single next action, so nobody hits a dead end.
 */
export function HallGate({ children }: { children: ReactNode }) {
  const c = useCommunityHall();
  const { user, loading } = useSupabaseSession();
  const profileQuery = useCommunityProfile(Boolean(user));
  const save = useSaveCommunityProfile();

  if (loading) {
    return <p className="mt-10 text-center text-sm text-muted-foreground">{c.loading}</p>;
  }

  if (!user) {
    return (
      <GateCard
        text={c.gateSignIn}
        cta={
          <Button asChild>
            <Link to="/auth">{c.gateSignInCta}</Link>
          </Button>
        }
      />
    );
  }

  if (profileQuery.isLoading) {
    return <p className="mt-10 text-center text-sm text-muted-foreground">{c.loading}</p>;
  }

  const state = profileQuery.data;
  if (state && !state.eligible) {
    return (
      <GateCard
        text={c.gateAdult}
        cta={
          <Button asChild variant="outline">
            <Link to="/me/profile">{c.gateAdultCta}</Link>
          </Button>
        }
      />
    );
  }

  if (!state?.profile?.optIn) {
    return (
      <GateCard
        text={c.gateOptIn}
        cta={
          <Button
            disabled={save.isPending}
            onClick={() =>
              save.mutate({
                alias: state?.profile?.alias ?? null,
                academy: state?.profile?.academy ?? null,
                element: state?.profile?.element ?? null,
                avatarUrl: state?.profile?.avatarUrl ?? null,
                quote: state?.profile?.quote ?? null,
                language: (state?.profile?.language as "zh" | "en") ?? c.lang,
                optIn: true,
                paused: false,
              })
            }
          >
            {c.gateOptInCta}
          </Button>
        }
      />
    );
  }

  return <>{children}</>;
}
