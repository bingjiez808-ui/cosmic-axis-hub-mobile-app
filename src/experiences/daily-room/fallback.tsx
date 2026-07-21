/**
 * Non-blank pending / error fallbacks for the "Today's Reading Room"
 * (/me/home, /me/friends, /me/match) route chunk loads.
 *
 * Rendered by TanStack Router's `pendingComponent` / `errorComponent`
 * hooks — these run outside the route's own React tree, but still inside
 * <LanguageProvider> at the __root. They are also safe to render before
 * hydration: we detect language from `document.documentElement.lang`
 * with an "en" fallback so we never depend on context timing.
 */
import { Link } from "@tanstack/react-router";
import { useEffect } from "react";

function detectLang(): "zh" | "en" {
  if (typeof document === "undefined") return "en";
  const l = document.documentElement.getAttribute("lang") ?? "en";
  return l.toLowerCase().startsWith("zh") ? "zh" : "en";
}

export function DailyRoomPending() {
  const lang = detectLang();
  const title = lang === "zh" ? "正在打开今日阅览室…" : "Opening today’s reading room…";
  const hint =
    lang === "zh"
      ? "命盘数据加载中，稍候即可开始阅览。"
      : "Loading your chart of the day, please hold.";
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="daily-room-pending"
      className="min-h-screen bg-[#0a0a12] text-amber-50"
    >
      <div className="mx-auto flex w-full max-w-[1100px] flex-col items-center px-4 py-16 md:px-8 md:py-24">
        <div className="text-xs uppercase tracking-[0.3em] text-amber-300/60">
          {lang === "zh" ? "今日阅览室" : "Today’s Reading Room"}
        </div>
        <h1 className="mt-3 font-serif text-2xl text-amber-100 md:text-3xl">{title}</h1>
        <p className="mt-2 text-sm text-amber-200/70">{hint}</p>
        <div
          aria-hidden
          className="mt-8 h-8 w-8 animate-spin rounded-full border-2 border-amber-300/30 border-t-amber-200"
        />
      </div>
    </div>
  );
}

export function DailyRoomError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  const lang = detectLang();
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[/me/home] route error:", error);
  }, [error]);
  const title = lang === "zh" ? "今日阅览室暂时无法打开" : "The reading room didn’t open";
  const body =
    lang === "zh"
      ? "加载过程中出现意外。你可以重试，或返回其它页面。"
      : "Something went wrong while loading. You can retry or go back.";
  const retry = lang === "zh" ? "重试" : "Try again";
  const homeLbl = lang === "zh" ? "返回首页" : "Return home";
  return (
    <div
      role="alert"
      data-testid="daily-room-error"
      className="min-h-screen bg-[#0a0a12] text-amber-50"
    >
      <div className="mx-auto flex w-full max-w-[720px] flex-col items-center px-4 py-16 text-center md:py-24">
        <div className="text-xs uppercase tracking-[0.3em] text-rose-300/70">
          {lang === "zh" ? "阅览室提示" : "Notice"}
        </div>
        <h1 className="mt-3 font-serif text-2xl text-amber-100 md:text-3xl">{title}</h1>
        <p className="mt-3 text-sm text-amber-200/70">{body}</p>
        {error?.message ? (
          <pre className="mt-4 max-w-full overflow-x-auto rounded-md border border-amber-400/20 bg-black/40 px-3 py-2 text-left text-[11px] text-amber-100/60">
            {error.message}
          </pre>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-full border border-amber-300/60 bg-amber-300/10 px-4 py-2 text-xs text-amber-100 hover:bg-amber-300/20"
          >
            {retry}
          </button>
          <Link
            to="/"
            className="rounded-full border border-amber-400/25 px-4 py-2 text-xs text-amber-200/80 hover:border-amber-300/60"
          >
            {homeLbl}
          </Link>
        </div>
      </div>
    </div>
  );
}
