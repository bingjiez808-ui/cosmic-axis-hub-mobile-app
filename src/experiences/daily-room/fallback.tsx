/**
 * Non-blank pending / error fallbacks for the "Today's Reading Room"
 * (/me/home, /me/friends, /me/match) route chunk loads.
 *
 * Rendered by TanStack Router's `pendingComponent` / `errorComponent`
 * hooks. These fallbacks must be safe even when TanStack renders them
 * before the normal route subtree has fully hydrated.
 *
 * Why context, not `document.lang`?
 *   The server shell always emits `<html lang="en">`. If a fallback reads
 *   `document.documentElement.lang` or localStorage during the first client
 *   render, returning zh-CN visitors hydrate Chinese text over server English
 *   text and React reports a mismatch. Therefore this component intentionally
 *   renders English for SSR AND the first client render, then switches to the
 *   persisted language from an effect after mount. No suppressHydrationWarning.
 */
import { useEffect, useState } from "react";

type FallbackLang = "zh" | "en";
const HYDRATION_SAFE_INITIAL_LANG: FallbackLang = "en";

function readClientFallbackLang(): FallbackLang {
  if (typeof window === "undefined") return "en";
  try {
    const stored = window.localStorage.getItem("lod.lang");
    if (stored === "zh" || stored === "en") return stored;
  } catch {
    /* ignore */
  }
  const htmlLang = document.documentElement.getAttribute("lang") ?? "en";
  return htmlLang.toLowerCase().startsWith("zh") ? "zh" : "en";
}

function useHydrationSafeFallbackLang(): FallbackLang {
  // Critical: this initializer must stay a constant. It is evaluated during
  // the first client render while React is hydrating the server's English HTML.
  const [lang, setLang] = useState<FallbackLang>(HYDRATION_SAFE_INITIAL_LANG);

  useEffect(() => {
    const sync = () => setLang(readClientFallbackLang());
    sync();
    window.addEventListener("lod:lang-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("lod:lang-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return lang;
}

function useFallbackCopy(): {
  lang: "zh" | "en";
  kicker: string;
  title: string;
  hint: string;
  errKicker: string;
  errTitle: string;
  errBody: string;
  retry: string;
  home: string;
} {
  const lang = useHydrationSafeFallbackLang();
  if (lang === "zh") {
    return {
      lang,
      kicker: "今日阅览室",
      title: "正在翻开今日篇章…",
      hint: "命盘数据加载中，稍候即可开始阅览。",
      errKicker: "阅览室提示",
      errTitle: "今日阅览室暂时无法打开",
      errBody: "加载过程中出现意外。你可以重试，或返回其它页面。",
      retry: "重试",
      home: "返回首页",
    };
  }
  return {
    lang,
    kicker: "Today’s Reading Room",
    title: "Opening today’s reading room…",
    hint: "Loading your chart of the day, please hold.",
    errKicker: "Notice",
    errTitle: "The reading room didn’t open",
    errBody: "Something went wrong while loading. You can retry or go back.",
    retry: "Try again",
    home: "Return home",
  };
}

export function DailyRoomPending() {
  const c = useFallbackCopy();
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="daily-room-pending"
      data-lang={c.lang}
      className="min-h-screen bg-[#0a0a12]/35 text-amber-50"
    >
      <div className="mx-auto flex w-full max-w-[1100px] flex-col items-center px-4 py-16 md:px-8 md:py-24">
        <div className="text-xs uppercase tracking-[0.3em] text-amber-300/60">{c.kicker}</div>
        <h1 className="mt-3 font-serif text-2xl text-amber-100 md:text-3xl">{c.title}</h1>
        <p className="mt-2 text-sm text-amber-200/70">{c.hint}</p>
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
  const c = useFallbackCopy();
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[/me/home] route error:", error);
  }, [error]);
  return (
    <div
      role="alert"
      data-testid="daily-room-error"
      data-lang={c.lang}
      className="min-h-screen bg-[#0a0a12]/35 text-amber-50"
    >
      <div className="mx-auto flex w-full max-w-[720px] flex-col items-center px-4 py-16 text-center md:py-24">
        <div className="text-xs uppercase tracking-[0.3em] text-rose-300/70">{c.errKicker}</div>
        <h1 className="mt-3 font-serif text-2xl text-amber-100 md:text-3xl">{c.errTitle}</h1>
        <p className="mt-3 text-sm text-amber-200/70">{c.errBody}</p>
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
            {c.retry}
          </button>
          <a
            href="/"
            className="rounded-full border border-amber-400/25 px-4 py-2 text-xs text-amber-200/80 hover:border-amber-300/60"
          >
            {c.home}
          </a>
        </div>
      </div>
    </div>
  );
}
