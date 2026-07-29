import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { BookMarked } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { HallDetailModal } from "@/components/destiny-commons/HallDetailModal";
import { DESTINY_COMMONS_HALLS, type DestinyCommonsHall } from "@/lib/destiny-commons";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLang } from "@/lib/i18n";

/**
 * CommonsHallNav — 命运通识馆 sub-navigation.
 *
 * Design (2026-07 refactor):
 *  - The full nav bar renders INLINE in normal document flow — no more
 *    fixed / sticky bar that covers Hero and body.
 *  - An IntersectionObserver watches the inline nav. When it scrolls
 *    fully above the viewport we mount a small floating "hall directory"
 *    bookmark on the right (bottom-right on mobile) that opens a drawer.
 *  - Full nav visible → no side bookmark, no floating chrome.
 *  - Scrolled past → side bookmark only, drawer on demand.
 *  - Back to top → side bookmark disappears; open drawer auto-closes.
 *  - Coming-soon halls never navigate; they open the shared
 *    HallDetailModal preview instead.
 *
 * No component-level fixed positioning of the full bar; the only fixed
 * elements are the side bookmark and the drawer overlay.
 */

type ActivePath = "/life-studies" | "/life-studies/math" | "/me/literature";

const CURRENT_LABEL: Record<string, { zh: string; en: string }> = {
  "/life-studies": { zh: "六馆目录", en: "Six Halls" },
  "/life-studies/math": { zh: "数学馆 · 目录", en: "Mathematics · Directory" },
  "/me/literature": { zh: "语文馆 · 目录", en: "Literature · Directory" },
};

export function CommonsHallNav({ active }: { active?: ActivePath }) {
  const { lang } = useLang();
  const isZh = lang === "zh";
  const isMobile = useIsMobile();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const current = (active ?? (pathname as ActivePath)) as ActivePath;

  const navRef = useRef<HTMLDivElement | null>(null);
  const [pastNav, setPastNav] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [previewHall, setPreviewHall] = useState<DestinyCommonsHall | null>(null);

  // Route change closes any open drawer / preview.
  useEffect(() => {
    setDrawerOpen(false);
    setPreviewHall(null);
  }, [pathname]);

  // Watch the inline nav; show the side bookmark only when it's above
  // the viewport (user scrolled past). Never show it before the user
  // has reached it (top >= 0) — that would mean the bar is still below.
  useEffect(() => {
    const el = navRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => {
        const past = !entry.isIntersecting && entry.boundingClientRect.top < 0;
        setPastNav(past);
      },
      { threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // If the full nav becomes visible again, auto-close the drawer.
  useEffect(() => {
    if (!pastNav) setDrawerOpen(false);
  }, [pastNav]);

  const openHalls = DESTINY_COMMONS_HALLS.filter((h) => h.status === "open");
  const comingHalls = DESTINY_COMMONS_HALLS.filter((h) => h.status === "coming");
  const currentLabel = CURRENT_LABEL[current] ?? { zh: "馆室目录", en: "Hall Directory" };

  return (
    <>
      {/* ── Full inline nav (participates in normal document flow) ─── */}
      <div
        ref={navRef}
        data-testid="commons-hall-nav"
        className="mx-auto w-full max-w-[1100px] px-4 py-3 md:px-8"
      >
        <nav
          role="navigation"
          aria-label={isZh ? "命运通识馆导航" : "Commons of Destiny"}
          className="flex flex-wrap items-center gap-2 rounded-2xl border border-amber-400/15 bg-[#0a0a12]/60 px-3 py-2 backdrop-blur"
        >
          <PillLink to="/life-studies" active={current === "/life-studies"} testId="chn-home">
            {isZh ? "通识馆首页" : "Commons Home"}
          </PillLink>
          {openHalls.map((h) => {
            const to = h.route as ActivePath;
            return (
              <PillLink
                key={h.id}
                to={to}
                active={current === to}
                testId={`chn-${h.id}`}
              >
                {isZh ? h.nameZh : h.nameEn}
              </PillLink>
            );
          })}

          {/* Coming pills — visible only at xl+ so 900–1279px stays compact. */}
          <span aria-hidden className="mx-1 hidden h-4 w-px bg-amber-400/20 xl:inline-block" />
          {comingHalls.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => setPreviewHall(h)}
              data-testid={`chn-${h.id}`}
              className="hidden xl:inline-flex min-h-11 items-center rounded-full border border-amber-400/10 px-4 py-2 text-xs text-amber-200/55 hover:border-amber-300/40 hover:text-amber-100"
            >
              {isZh ? h.nameZh : h.nameEn} · {isZh ? "整理中" : "soon"}
            </button>
          ))}

          {/* Directory trigger — always visible below xl (holds the 4 coming halls). */}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            data-testid="chn-open-directory-inline"
            className="xl:hidden ml-auto inline-flex min-h-11 items-center gap-2 rounded-full border border-amber-400/30 px-4 py-2 text-xs text-amber-200 hover:border-amber-300/70 hover:text-amber-100"
          >
            <BookMarked className="h-3.5 w-3.5" aria-hidden />
            {isZh ? "馆室目录" : "Hall Directory"}
          </button>
        </nav>
      </div>

      {/* ── Floating side bookmark — only after full nav scrolled out ─── */}
      {pastNav ? (
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          data-testid="commons-side-bookmark"
          aria-label={isZh ? `打开${currentLabel.zh}` : `Open ${currentLabel.en}`}
          className={[
            "fixed z-40 border border-amber-300/40 bg-[#0a0a12]/85 text-amber-100/90",
            "shadow-[0_10px_30px_-8px_rgba(0,0,0,0.6)] backdrop-blur",
            "transition-transform duration-200 motion-reduce:transition-none",
            "animate-in fade-in slide-in-from-right-4 motion-reduce:animate-none",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300",
            // Mobile: small round bookmark bottom-right, above safe-area & sage tree hole.
            "flex sm:hidden right-3 h-12 w-12 items-center justify-center rounded-full",
            // Desktop: vertical bookmark, right middle, keep 16px+ from scrollbar.
            "sm:flex sm:flex-col sm:items-center sm:justify-center sm:gap-2",
            "sm:right-4 sm:top-1/2 sm:-translate-y-1/2 sm:h-[136px] sm:w-[52px]",
            "sm:rounded-l-2xl sm:rounded-r-md hover:sm:translate-x-[-2px]",
          ].join(" ")}
          style={{ bottom: "max(6rem, env(safe-area-inset-bottom))" }}
        >
          <BookMarked className="h-4 w-4" aria-hidden />
          <span className="hidden sm:block text-[10px] uppercase tracking-[0.24em] [writing-mode:vertical-rl]">
            {isZh ? currentLabel.zh : currentLabel.en}
          </span>
        </button>
      ) : null}

      {/* ── Directory drawer (right-side on ≥sm, bottom sheet on mobile) ─── */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          data-testid="commons-hall-drawer"
          className={[
            "border-amber-400/25 bg-[#0a0a12] text-amber-50 p-6",
            isMobile
              ? "max-h-[82dvh] overflow-y-auto rounded-t-2xl"
              : "w-[min(420px,90vw)] sm:max-w-[420px] overflow-y-auto",
          ].join(" ")}
        >
          <SheetHeader className="text-left">
            <SheetTitle className="font-serif text-lg text-amber-50">
              {isZh ? "馆室目录" : "Hall Directory"}
            </SheetTitle>
            <SheetDescription className="text-[12px] text-amber-100/60">
              {isZh ? `当前：${currentLabel.zh}` : `Current: ${currentLabel.en}`}
            </SheetDescription>
          </SheetHeader>

          <ul className="mt-4 space-y-2">
            <li>
              <DrawerItem
                code="00"
                title={isZh ? "通识馆首页" : "Commons Home"}
                status={isZh ? "总览" : "Overview"}
                one={isZh ? "六馆入口与说明" : "Entry to all six halls"}
                active={current === "/life-studies"}
                to="/life-studies"
                isZh={isZh}
                onNavigate={() => setDrawerOpen(false)}
              />
            </li>
            {DESTINY_COMMONS_HALLS.map((h) => {
              const isOpen = h.status === "open";
              const to = isOpen ? (h.route as ActivePath) : undefined;
              const isActive = isOpen && current === to;
              return (
                <li key={h.id}>
                  <DrawerItem
                    code={h.code}
                    title={isZh ? h.nameZh : h.nameEn}
                    status={
                      isOpen
                        ? isZh
                          ? "已开放"
                          : "Open"
                        : isZh
                          ? "馆藏整理中"
                          : "In progress"
                    }
                    one={isZh ? h.subtitleZh : h.subtitleEn}
                    active={!!isActive}
                    to={to}
                    isZh={isZh}
                    onNavigate={() => setDrawerOpen(false)}
                    onPreview={
                      !isOpen
                        ? () => {
                            setDrawerOpen(false);
                            setPreviewHall(h);
                          }
                        : undefined
                    }
                  />
                </li>
              );
            })}
          </ul>
        </SheetContent>
      </Sheet>

      {/* ── Shared preview modal for coming-soon halls ─── */}
      <HallDetailModal
        hall={previewHall}
        isZh={isZh}
        onOpenChange={(o) => {
          if (!o) setPreviewHall(null);
        }}
      />
    </>
  );
}

function PillLink({
  to,
  active,
  testId,
  children,
}: {
  to: ActivePath;
  active: boolean;
  testId: string;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      data-testid={testId}
      aria-current={active ? "page" : undefined}
      className={`inline-flex min-h-11 items-center rounded-full px-4 py-2 text-xs transition ${
        active
          ? "border border-amber-300 bg-amber-300/10 text-amber-100"
          : "border border-amber-400/25 text-amber-200/80 hover:border-amber-300/60 hover:text-amber-100"
      }`}
    >
      {children}
    </Link>
  );
}

function DrawerItem({
  code,
  title,
  status,
  one,
  active,
  to,
  isZh,
  onNavigate,
  onPreview,
}: {
  code: string;
  title: string;
  status: string;
  one: string;
  active: boolean;
  to?: ActivePath;
  isZh: boolean;
  onNavigate: () => void;
  onPreview?: () => void;
}) {
  const base =
    "flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition min-h-[56px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300";
  const cls = active
    ? "border-amber-300/70 bg-amber-300/10 text-amber-50"
    : "border-white/10 text-amber-100/85 hover:border-amber-300/40 hover:bg-amber-300/5";

  const body = (
    <>
      <span className="mt-0.5 shrink-0 rounded-md border border-amber-400/25 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.2em] text-amber-200/70">
        {code}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="font-serif text-sm text-amber-50">{title}</span>
          <span className="text-[10px] uppercase tracking-[0.22em] text-amber-200/60">
            {status}
          </span>
          {active ? (
            <span className="rounded-full border border-amber-300/60 px-1.5 py-[1px] text-[10px] text-amber-200">
              {isZh ? "当前" : "here"}
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block text-[12px] leading-snug text-amber-100/65">{one}</span>
      </span>
    </>
  );

  if (to) {
    return (
      <Link to={to} onClick={onNavigate} className={`${base} ${cls}`}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onPreview} className={`${base} ${cls}`}>
      {body}
    </button>
  );
}

export default CommonsHallNav;
