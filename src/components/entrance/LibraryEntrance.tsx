/**
 * LibraryEntrance — session-gated immersive scratch-glass entrance.
 *
 * Composition (bottom → top):
 *   1. Clear video / poster (Layer A) — always visible, only slightly dimmed.
 *   2. Foggy-glass <canvas> (Layer B) — every frame is repainted with the
 *      blurred video + cool-white fog tint, then the accumulated stroke
 *      mask is composited via `destination-out` to reveal Layer A wherever
 *      the user has dragged.
 *   3. Transparent scratch surface (captures pointer/touch drags).
 *   4. Cursor-follow soft glow hint (visible only until first stroke).
 *   5. Edge vignette + door-seam (for enter transition).
 *   6. UI content — brand, language toggle, kicker, title, sub, CTA, skip.
 *
 * All UI text is in its own layer above every visual layer; the blur only
 * touches the glass canvas, never the text. See `useScratchReveal`.
 */
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useLang } from "@/lib/i18n";
import desktopVideoAsset from "@/assets/entrance/entrance-desktop.mp4.asset.json";
import mobileVideoAsset from "@/assets/entrance/entrance-mobile.mp4.asset.json";
import desktopPosterAsset from "@/assets/entrance/entrance-desktop-poster.webp.asset.json";
import mobilePosterAsset from "@/assets/entrance/entrance-mobile-poster.png.asset.json";
import { useEntranceSequence } from "./useEntranceSequence";
import { useScratchReveal } from "./useScratchReveal";
import "./library-entrance.css";

const COPY = {
  zh: {
    brand: "命运图书馆 · Destiny Library",
    kicker: "序 · Prologue",
    title: "每一种文明，\n都在追问同一个问题。",
    sub: "这里不替你决定命运，\n而是陪你读懂自己正在书写的那一页。",
    cta: "推开馆门",
    skip: "跳过序幕",
    scratchHint: "按住并移动，拭去门前的雾",
    doorSeen: "馆门已经看见",
    langHint: "图书馆将以此语言与你对话",
  },
  en: {
    brand: "Destiny Library",
    kicker: "Prologue",
    title: "Every civilization\nhas asked the same question.",
    sub: "This library does not decide your fate.\nIt helps you read the page you are writing.",
    cta: "Enter the Library",
    skip: "Skip Introduction",
    scratchHint: "Press and drag to wipe the fog away",
    doorSeen: "The door is in sight",
    langHint: "The library will speak with you in this language",
  },
} as const;

export function LibraryEntrance() {
  const { phase, enter, skip } = useEntranceSequence();
  const { lang, setLang } = useLang();
  const copy = COPY[lang];

  const rootRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const hintGlowRef = useRef<HTMLDivElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);
  const overlayVisible = phase === "visible" || phase === "exiting-enter" || phase === "exiting-skip";

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

  const getSource = useCallback(
    () => (reducedMotion ? imgRef.current : videoRef.current) as
      | HTMLVideoElement
      | HTMLImageElement
      | null,
    [reducedMotion]
  );

  const {
    glassRef,
    scratchRef,
    maskCanvas,
    revealRatio,
    eraseAll,
  } = useScratchReveal({
    getSource,
    disabled: !overlayVisible,
    brushRadius: 130,
    brushRadiusMobile: 110,
    onFirstStroke: () => {
      rootRef.current?.classList.add("le-scratched");
    },
  });

  // Cursor-follow hint glow (before first stroke).
  useEffect(() => {
    if (!overlayVisible) return;
    const root = rootRef.current;
    const glow = hintGlowRef.current;
    if (!root || !glow) return;
    let raf = 0;
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let pending = false;
    const flush = () => {
      pending = false;
      glow.style.setProperty("--le-mx", `${x}px`);
      glow.style.setProperty("--le-my", `${y}px`);
    };
    const onMove = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (!pending) {
        pending = true;
        raf = window.requestAnimationFrame(flush);
      }
      root.classList.add("le-hovering");
    };
    const onLeave = () => root.classList.remove("le-hovering");
    root.addEventListener("pointermove", onMove, { passive: true });
    root.addEventListener("pointerleave", onLeave);
    return () => {
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [overlayVisible]);

  // Toggle global body attribute so root layout hides its own nav/footer/companion.
  useEffect(() => {
    if (!overlayVisible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.setAttribute("data-le-active", "true");
    return () => {
      document.body.style.overflow = prev;
      document.body.removeAttribute("data-le-active");
    };
  }, [overlayVisible]);

  // Keyboard: Escape → skip, Enter → enter (unless focus is on skip).
  useEffect(() => {
    if (phase !== "visible") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); skip(); return; }
      if (e.key === "Enter") {
        const target = e.target as HTMLElement | null;
        if (target?.dataset?.leAction === "skip") return;
        e.preventDefault();
        enter();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, enter, skip]);

  // Pause video when tab hidden.
  useEffect(() => {
    if (!overlayVisible) return;
    const v = videoRef.current;
    if (!v) return;
    const sync = () => {
      if (document.hidden) v.pause();
      else v.play().catch(() => { /* noop */ });
    };
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, [overlayVisible]);

  // Reveal-ratio hint text (imperative — avoids re-rendering the whole overlay).
  useEffect(() => {
    const el = progressRef.current;
    if (!el) return;
    if (revealRatio >= 0.35) {
      el.textContent = copy.doorSeen;
      el.style.opacity = "1";
      rootRef.current?.classList.add("le-cta-glow");
    } else if (revealRatio >= 0.25) {
      el.textContent = "";
      el.style.opacity = "0";
      rootRef.current?.classList.add("le-cta-glow");
    } else {
      el.textContent = "";
      el.style.opacity = "0";
      rootRef.current?.classList.remove("le-cta-glow");
    }
  }, [revealRatio, copy.doorSeen]);

  const handleCta = useCallback(() => {
    if (phase !== "visible") return;
    eraseAll(500);
    enter();
  }, [phase, enter, eraseAll]);

  if (!overlayVisible) return null;

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
      {/* Layer A — clear video / poster */}
      <div className="le-clear" aria-hidden="true">
        {reducedMotion ? (
          <img ref={imgRef} src={media.poster} alt="" />
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
              const t = e.currentTarget;
              t.style.display = "none";
              const img = document.createElement("img");
              img.src = media.poster;
              img.alt = "";
              
              imgRef.current = img;
              t.parentElement?.appendChild(img);
            }}
          />
        )}
      </div>

      {/* Layer B — foggy glass canvas (repainted every frame) */}
      <canvas ref={glassRef} className="le-glass" aria-hidden="true" />
      {maskCanvas}

      {/* Scratch input surface */}
      <div ref={scratchRef} className="le-scratch" aria-hidden="true" />

      {/* Cursor-follow hint glow */}
      <div ref={hintGlowRef} className="le-hint-glow" aria-hidden="true" />

      {/* Edge vignette */}
      <div className="le-vignette" aria-hidden="true" />

      {/* Door-seam glow (only lights up during enter transition) */}
      <div className="le-seam" aria-hidden="true" />

      {/* Top bar */}
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

      {/* UI content */}
      <div className="le-content">
        <div className="le-inner">
          <div className="le-title-halo">
            <p className="le-kicker">{copy.kicker}</p>
            <h1
              id="le-title"
              className="le-title"
              data-lang={lang}
              style={{ whiteSpace: "pre-line", marginTop: 18 }}
            >
              {copy.title}
            </h1>
            <p
              id="le-sub"
              className="le-sub"
              style={{ whiteSpace: "pre-line", marginTop: 22 }}
            >
              {copy.sub}
            </p>
          </div>
          <p className="le-scratch-hint">{copy.scratchHint}</p>
          <button
            type="button"
            className="le-cta"
            onClick={handleCta}
            disabled={phase !== "visible"}
            data-le-action="enter"
            autoFocus
          >
            {copy.cta}
          </button>
          <div ref={progressRef} className="le-progress" aria-live="polite" />
          <button
            type="button"
            className="le-skip"
            onClick={skip}
            disabled={phase !== "visible"}
            data-le-action="skip"
          >
            {copy.skip}
          </button>
        </div>
      </div>
    </div>
  );
}
