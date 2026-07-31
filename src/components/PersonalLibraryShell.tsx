import type { ReactNode } from "react";

import { PersonalWorkspaceNav } from "@/components/PersonalWorkspaceNav";
import { useStableMotion } from "@/lib/motion-preference";
import "@/components/personal-library.css";

/**
 * PersonalLibraryShell — one skin for every `/me/*` page.
 *
 * Owns the lamplit page frame, the shelf nav, and the animated page
 * header so the Personal Library reads as a single room instead of a
 * pile of differently-styled screens. Motion collapses automatically
 * under `prefers-reduced-motion` or the app's stable-motion setting.
 */
export function PersonalLibraryShell({
  active,
  kicker,
  title,
  intro,
  aside,
  width = "wide",
  children,
}: {
  active?: string;
  kicker?: ReactNode;
  title?: ReactNode;
  intro?: ReactNode;
  /** Right-hand slot in the header row (badges, quick actions). */
  aside?: ReactNode;
  width?: "wide" | "narrow";
  children: ReactNode;
}) {
  const { stable } = useStableMotion();
  const max = width === "narrow" ? "max-w-[900px]" : "max-w-[1100px]";

  return (
    <div
      className="pl-shell min-h-screen bg-[#0a0a12]/25 text-amber-50"
      data-pl-motion={stable ? "stable" : "smooth"}
    >
      <div className={`mx-auto w-full ${max} px-4 py-8 md:px-8 md:py-12`}>
        <PersonalWorkspaceNav active={active} />

        {(title || kicker || intro || aside) && (
          <header className="pl-header mb-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="min-w-0">
                {kicker && <div className="pl-kicker">{kicker}</div>}
                {title && (
                  <h1 className="mt-2 font-serif text-3xl tracking-wide text-amber-50 md:text-4xl">
                    {title}
                  </h1>
                )}
              </div>
              {aside && <div className="shrink-0">{aside}</div>}
            </div>
            <div className="pl-rule mt-4" />
            {intro && <p className="mt-3 max-w-2xl text-sm text-amber-100/70">{intro}</p>}
          </header>
        )}

        {children}
      </div>
    </div>
  );
}

/** A lamplit panel — the shelf's standard container for any block. */
export function ShelfPanel({
  children,
  className = "",
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
}) {
  return (
    <section
      className={`pl-panel ${interactive ? "pl-panel-interactive" : ""} p-5 ${className}`}
    >
      {children}
    </section>
  );
}
