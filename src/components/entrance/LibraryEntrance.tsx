/**
 * LibraryEntrance — full-screen immersive entrance overlay shown once
 * per session before the Destiny Library guide-hall landing page.
 *
 * Non-goals: this component does NOT replace the landing page. It is a
 * fixed overlay that mounts above `LandingPage` and unmounts after the
 * user enters or skips. All landing-page logic (nav, i18n, auth,
 * sections) is preserved untouched.
 *
 * Architecture:
 *   - Session gate + phase machine live in `useEntranceSequence`.
 *   - Media (video + poster) is served from Lovable CDN pointer files
 *     in `src/assets/entrance/`.
 *   - Fog + reveal spotlight are CSS-only for reliable degradation:
 *     WebGL failure would only affect richer variants (out of scope).
 *   - Pointer reveal is RAF-throttled and writes CSS variables — no
 *     React re-renders on mousemove.
 *   - Reduced-motion & document.hidden are honored (fog disabled;
 *     video paused).
 */
import { useEffect, useMemo, useRef, useCallback } from "react";
import { useLang } from "@/lib/i18n";
import desktopVideoAsset from "@/assets/entrance/entrance-desktop.mp4.asset.json";
import mobileVideoAsset from "@/assets/entrance/entrance-mobile.mp4.asset.json";
import desktopPosterAsset from "@/assets/entrance/entrance-desktop-poster.webp.asset.json";
import mobilePosterAsset from "@/assets/entrance/entrance-mobile-poster.png.asset.json";
import { useEntranceSequence } from "./useEntranceSequence";
import "./library-entrance.css";

const COPY = {
  zh: {
    brand: "命运图书馆 · Destiny Library",
    kicker: "序 · Prologue",
    title: "每一种文明，都在追问同一个问题。",
    sub: "这里不替你决定命运，而是陪你读懂自己正在书写的那一页。",
    cta: "推开馆门",
    skip: "跳过序幕",
    langHint: "图书馆将以此语言与你对话",
  },
  en: {
    brand: "Destiny Library",
    kicker: "Prologue",
    title: "Every civilization has asked the same question.",
    sub: "This library does not decide your fate. It helps you read the page you are writing.",
    cta: "Enter the Library",
    skip: "Skip Introduction",
    langHint: "The library will speak with you in this language",
  },
} as const;

export function LibraryEntrance() {
  const { phase, enter, skip } = useEntranceSequence();
  const { lang, setLang } = useLang();
  const copy = COPY[lang];

  const rootRef = useRef<HTMLDivElement | null>(null);
  const revealRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const leaveRafRef = useRef<number | null>(null);

  // Pick media by viewport once, at mount, so we never double-download.
  const media = useMemo(() => {
    const isMobile =
      typeof window !== "undefined" &&
      window.matchMedia?.("(max-width: 640px)").matches;
    return isMobile
      ? { video: mobileVideoAsset.url, poster: mobilePosterAsset.url }
      : { video: desktopVideoAsset.url, poster: desktopPosterAsset.url };
  }, []);

  const reducedMotion = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  }, []);

  // Pointer reveal — RAF-throttled, mutates CSS vars only.
  useEffect(() => {
    if (phase !== "visible") return;
    const root = rootRef.current;
    const reveal = revealRef.current;
    if (!root || !reveal) return;

    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let pending = false;

    const flush = () => {
      pending = false;
      reveal.style.setProperty("--le-mx", `${x}px`);
      reveal.style.setProperty("--le-my", `${y}px`);
    };
    const onMove = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (!pending) {
        pending = true;
        rafRef.current = window.requestAnimationFrame(flush);
      }
      root.classList.add("le-hovering");
      if (leaveRafRef.current) {
        window.clearTimeout(leaveRafRef.current);
        leaveRafRef.current = null;
      }
    };
    const onLeave = () => {
      // fog gradually reconvenes via CSS opacity transition on .le-reveal
      leaveRafRef.current = window.setTimeout(() => {
        root.classList.remove("le-hovering");
      }, 120) as unknown as number;
    };

    root.addEventListener("pointermove", onMove, { passive: true });
    root.addEventListener("pointerleave", onLeave);
    root.addEventListener("pointercancel", onLeave);
    return () => {
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
      root.removeEventListener("pointercancel", onLeave);
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
      if (leaveRafRef.current) window.clearTimeout(leaveRafRef.current);
    };
  }, [phase]);

  // Lock body scroll while overlay is visible.
  useEffect(() => {
    if (phase === "idle" || phase === "done") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [phase]);

  // Keyboard: Escape → skip, Enter/Space → enter (when not on skip button).
  useEffect(() => {
    if (phase !== "visible") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        skip();
      } else if (e.key === "Enter") {
        const target = e.target as HTMLElement | null;
        if (target?.dataset?.leAction === "skip") return; // let skip button handle
        e.preventDefault();
        enter();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, enter, skip]);

  // Pause/resume video with page visibility.
  useEffect(() => {
    if (phase === "idle" || phase === "done") return;
    const v = videoRef.current;
    if (!v) return;
    const sync = () => {
      if (document.hidden) v.pause();
      else v.play().catch(() => { /* autoplay may fail — poster still visible */ });
    };
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, [phase]);

  // Restore focus to landing page main content after unmount.
  useEffect(() => {
    if (phase !== "done") return;
    // Give the landing page a tick to be interactive, then focus its hero.
    const t = window.setTimeout(() => {
      const target =
        (document.querySelector('[data-testid="hero-h1"]') as HTMLElement | null) ??
        (document.querySelector("main h1") as HTMLElement | null);
      if (target) {
        target.setAttribute("tabindex", "-1");
        target.focus({ preventScroll: true });
      }
    }, 60);
    return () => window.clearTimeout(t);
  }, [phase]);

  const handleCta = useCallback(() => {
    if (phase !== "visible") return;
    enter();
  }, [phase, enter]);

  if (phase === "idle" || phase === "done") return null;

  const disabled = phase !== "visible";

  return (
    <div
      ref={rootRef}
      className="le-root"
      data-phase={phase}
      role="dialog"
      aria-modal="true"
      aria-labelledby="le-title"
      aria-describedby="le-sub"
    >
      {/* Layer 1 — video/poster */}
      <div className="le-video-wrap" aria-hidden="true">
        {reducedMotion ? (
          <img src={media.poster} alt="" />
        ) : (
          <video
            ref={videoRef}
            src={media.video}
            poster={media.poster}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            onError={(e) => {
              // Hide broken video element; poster on wrap remains via fallback img.
              const target = e.currentTarget;
              target.style.display = "none";
              const img = document.createElement("img");
              img.src = media.poster;
              img.alt = "";
              target.parentElement?.appendChild(img);
            }}
          />
        )}
      </div>

      {/* Layer 2 — vignette */}
      <div className="le-vignette" aria-hidden="true" />

      {/* Layer 3 — fog + Layer 4 — reveal spotlight (grouped for blend) */}
      <div className="le-fog" aria-hidden="true" />
      <div ref={revealRef} className="le-reveal" aria-hidden="true" />

      {/* Layer 5 — dust */}
      <div className="le-dust" aria-hidden="true" />

      {/* Layer 7 — door seam (revealed during enter transition) */}
      <div className="le-seam" aria-hidden="true" />

      {/* Top bar: brand + language */}
      <div className="le-top">
        <span className="le-brand">{copy.brand}</span>
        <div className="le-lang" role="group" aria-label={copy.langHint}>
          {(["zh", "en"] as const).map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={lang === l}
              onClick={() => setLang(l)}
            >
              {l === "zh" ? "中" : "EN"}
            </button>
          ))}
        </div>
      </div>

      {/* Layer 6 — content */}
      <div className="le-content">
        <div className="le-inner">
          <p className="le-kicker">{copy.kicker}</p>
          <h1 id="le-title" className="le-title" data-lang={lang}>
            {copy.title}
          </h1>
          <p id="le-sub" className="le-sub">
            {copy.sub}
          </p>
          <button
            type="button"
            className="le-cta"
            onClick={handleCta}
            disabled={disabled}
            data-le-action="enter"
            autoFocus
          >
            {copy.cta}
          </button>
          <button
            type="button"
            className="le-skip"
            onClick={skip}
            disabled={disabled}
            data-le-action="skip"
          >
            {copy.skip}
          </button>
        </div>
      </div>
    </div>
  );
}
