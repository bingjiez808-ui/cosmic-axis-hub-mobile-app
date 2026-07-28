import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { CommonsHallNav } from "@/components/CommonsHallNav";
import { useLang } from "@/lib/i18n";

/**
 * Shared header + back-affordance for every subject room. Ensures no
 * room becomes a dead-end: every page carries a visible path back to
 * 命运通识馆 and a subtitle explaining the room's angle.
 *
 * Renders the fixed CommonsHallNav and reserves enough top padding so
 * neither the global site-nav nor the commons sub-nav can overlap the
 * Hero on any viewport.
 */
export function SubjectRoomShell({
  eyebrow,
  title,
  subtitle,
  children,
  active,
}: {
  eyebrow: { zh: string; en: string };
  title: { zh: string; en: string };
  subtitle: { zh: string; en: string };
  children: ReactNode;
  active?: "/life-studies" | "/life-studies/math" | "/me/literature";
}) {
  const { lang } = useLang();
  const isZh = lang === "zh";
  return (
    <>
      <CommonsHallNav active={active} />
      <div
        className="mx-auto w-full max-w-[1100px] px-4 pb-24 md:px-8"
        style={{
          paddingTop:
            "calc(var(--site-nav-height, 96px) + var(--commons-nav-height, 64px) + 24px)",
        }}
      >
        <div className="mb-6 flex items-center gap-3 text-[11px] uppercase tracking-[0.28em] text-amber-200/70">
          <Link
            to="/life-studies"
            className="inline-flex min-h-9 items-center rounded-full border border-amber-400/25 px-3 py-1 text-amber-200/80 transition hover:border-amber-300/60 hover:text-amber-100"
            data-testid="subject-room-back"
          >
            ← {isZh ? "命运通识馆" : "Life Studies"}
          </Link>
          <span aria-hidden className="text-amber-300/40">·</span>
          <span>{isZh ? eyebrow.zh : eyebrow.en}</span>
        </div>
        <header className="mb-10 max-w-3xl">
          <h1 className="font-serif text-3xl leading-tight text-amber-50 md:text-4xl">
            {isZh ? title.zh : title.en}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-amber-100/70 md:text-base">
            {isZh ? subtitle.zh : subtitle.en}
          </p>
        </header>
        {children}
      </div>
    </>
  );
}

