/**
 * 同门 · 众生之厅 — shared shell.
 *
 * Owns the page chrome every hall route shares: the parchment header, the
 * section nav (tabs on desktop, a sticky courier bar on mobile) and the
 * access gate. The gate is a *soft* gate — signed-out and under-18 visitors
 * still see the hall's story and how it works, they only lose the actions.
 */
import { Link, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { useCommunityHall } from "@/lib/i18n-community-hall";
import { useCommunityProfile, useSaveCommunityProfile } from "@/lib/community-hall-client";
import { hallErrorMessage } from "@/lib/community-hall-errors";
import { useSupabaseSession } from "@/lib/session";
import { useInView } from "@/lib/use-in-view";
import { CourierEchoToast } from "./CourierEchoToast";
import "./hall.css";

export function HallHeader({
  title,
  subtitle,
  lines,
}: {
  title?: string;
  subtitle?: string;
  /** Optional two-line hero headline used on the hall landing page. */
  lines?: [string, string];
}) {
  const c = useCommunityHall();
  return (
    <header className="mx-auto max-w-3xl text-center">
      <p className="hall-eyebrow">{c.hallEyebrow}</p>
      <h1 className="mt-4 text-balance text-[clamp(1.6rem,5.4vw,2.6rem)] font-semibold leading-[1.28] text-foreground">
        {lines ? (
          <>
            <span className="block">{lines[0]}</span>
            <span className="block text-primary/90">{lines[1]}</span>
          </>
        ) : (
          title
        )}
      </h1>
      {subtitle ? (
        <p className="mx-auto mt-4 max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
          {subtitle}
        </p>
      ) : null}
    </header>
  );
}

function useHallNavItems() {
  const c = useCommunityHall();
  return [
    { to: "/community", label: c.navHall },
    { to: "/community/write", label: c.navWrite },
    { to: "/community/wall", label: c.lang === "en" ? "Wall" : "信墙" },
    { to: "/community/sages", label: c.lang === "en" ? "Sages" : "先贤" },
    { to: "/community/errands", label: c.lang === "en" ? "Entrusted" : "受托" },
    { to: "/community/inbox", label: c.navInbox },
    { to: "/community/outbox", label: c.sectionOutbox },
    { to: "/community/echoes", label: c.sectionEchoes },
  ] as const;
}

/** Desktop / tablet section tabs. Hidden on phones in favour of the bar below. */
export function HallNav() {
  const c = useCommunityHall();
  const { pathname } = useLocation();
  const items = useHallNavItems();
  return (
    <nav
      aria-label={c.hallEyebrow}
      className="mx-auto mt-8 hidden w-full max-w-3xl snap-x gap-2 overflow-x-auto rounded-full border border-primary/15 bg-background/50 p-1.5 backdrop-blur sm:flex"
    >
      {items.map((item) => {
        const active = pathname === item.to;
        return (
          <Link
            key={item.to}
            to={item.to}
            aria-current={active ? "page" : undefined}
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

/** Phone-only sticky section bar; one-handed, 48px targets, safe-area aware. */
export function HallMobileBar() {
  const c = useCommunityHall();
  const { pathname } = useLocation();
  const items = useHallNavItems();
  return (
    <>
    {/* Mounted here because every hall route renders the bar: the knock is a
        fixed-position note, so it appears on desktop too without extra wiring. */}
    <CourierEchoToast />
    <nav
      aria-label={c.hallEyebrow}
      className="hall-mobile-bar -mx-4 mt-8 grid grid-cols-4 sm:hidden"
    >
      {items.map((item) => {
        const active = pathname === item.to;
        return (
          <Link
            key={item.to}
            to={item.to}
            aria-current={active ? "page" : undefined}
            className={`flex items-center justify-center px-1 text-center text-[0.68rem] font-medium leading-tight transition ${
              active ? "text-primary" : "text-muted-foreground"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
    </>
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
  const { ref, inView } = useInView<HTMLElement>();
  return (
    <section
      ref={ref}
      data-visible={inView ? "true" : "false"}
      className="hall-reveal mx-auto mt-12 w-full max-w-3xl"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="hall-section-title">{title}</h2>
        {action}
      </div>
      <span className="hall-heading-rule mt-3" aria-hidden="true" />
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function HallEmpty({ text, cta }: { text: string; cta?: ReactNode }) {
  return (
    <div className="hall-empty p-8 text-center">
      <p className="text-pretty text-sm leading-relaxed text-muted-foreground">{text}</p>
      {cta ? <div className="mt-5 flex justify-center">{cta}</div> : null}
    </div>
  );
}

function GateCard({ text, cta }: { text: string; cta: ReactNode }) {
  return (
    <div className="hall-paper mx-auto mt-10 max-w-xl p-7 text-center">
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
    return <p className="mt-10 text-center text-sm text-muted-foreground">{c.stateLoadingHall}</p>;
  }

  if (!user) {
    return (
      <GateCard
        text={c.gateSignIn}
        cta={
          <Button asChild className="hall-tap">
            <Link to="/auth">{c.gateSignInCta}</Link>
          </Button>
        }
      />
    );
  }

  if (profileQuery.isLoading) {
    return <p className="mt-10 text-center text-sm text-muted-foreground">{c.stateLoadingHall}</p>;
  }

  if (profileQuery.error) {
    return <GateCard text={hallErrorMessage(profileQuery.error, c.lang)} cta={
      <Button className="hall-tap" variant="outline" onClick={() => void profileQuery.refetch()}>
        {c.stateRetry}
      </Button>
    } />;
  }

  const state = profileQuery.data;
  if (state && !state.eligible) {
    return (
      <GateCard
        text={c.gateAdult}
        cta={
          <Button asChild variant="outline" className="hall-tap">
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
            className="hall-tap"
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
