/**
 * LibraryEntrance — session-gated immersive scratch-glass entrance.
 *
 * Composition (bottom → top):
 *   1. Clear video / poster (Layer A) — always visible, slightly dimmed.
 *   2. Foggy-glass <canvas> (Layer B) — blurred source + fog tint, with
 *      transient hover mask (temporary reveal) and permanent scratch mask
 *      (click + drag) composited via `destination-out`.
 *   3. Transparent scratch surface (captures pointer / touch).
 *   4. Starmarks + connection SVG (persistent click sparks).
 *   5. Custom lantern cursor (desktop only).
 *   6. Edge vignette + door seam (enter transition).
 *   7. UI content — brand, language toggle, title, sub, CTA, secondary entry.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
    brand: "DESTINY LIBRARY · 命运图书馆",
    title: "万卷命运之中，\n有一本以你为名。",
    sub: "这里不收藏既定的答案，\n只陪你照亮那些尚未读懂的自己。",
    cta: "推开馆门",
    skip: "直接进入",
    hint1: "移动提灯，看看雾后藏着什么",
    hint2: "点击留下光 · 按住移动可以拭去雾气",
    langHint: "图书馆将以此语言与你对话",
  },
  en: {
    brand: "DESTINY LIBRARY",
    title: "Among countless stories of fate,\none bears your name.",
    sub: "This library does not preserve predetermined answers.\nIt helps illuminate the parts of yourself not yet understood.",
    cta: "Open the Library",
    skip: "Enter directly",
    hint1: "Move the lantern to see beyond the mist",
    hint2: "Click to leave a light · hold and drag to clear the glass",
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
  const lanternRef = useRef<HTMLDivElement | null>(null);
  const ctaRef = useRef<HTMLButtonElement | null>(null);
  const [connecting, setConnecting] = useState(false);
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

  const isCoarse = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia?.("(pointer: coarse)").matches ?? false;
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
    stars,
    starsVersion,
  } = useScratchReveal({
    getSource,
    disabled: !overlayVisible,
    brushRadius: 210,
    brushRadiusMobile: 150,
    reducedMotion,
    onFirstStroke: () => {
      rootRef.current?.classList.add("le-scratched");
    },
  });

  // Lantern cursor tracking (desktop only).
  useEffect(() => {
    if (!overlayVisible || isCoarse || reducedMotion) return;
    const root = rootRef.current;
    const lantern = lanternRef.current;
    if (!root || !lantern) return;
    let raf = 0;
    let tx = window.innerWidth / 2;
    let ty = window.innerHeight / 2;
    let cx = tx;
    let cy = ty;
    let pending = false;
    const loop = () => {
      pending = false;
      // Soft follow (~80ms trailing).
      cx += (tx - cx) * 0.25;
      cy += (ty - cy) * 0.25;
      lantern.style.transform = `translate3d(${cx}px, ${cy}px, 0) translate(-50%, -50%)`;
      if (Math.abs(tx - cx) > 0.5 || Math.abs(ty - cy) > 0.5) {
        raf = window.requestAnimationFrame(loop);
        pending = true;
      }
    };
    const onMove = (e: PointerEvent) => {
      tx = e.clientX;
      ty = e.clientY;
      root.classList.add("le-hovering");
      if (!pending) {
        pending = true;
        raf = window.requestAnimationFrame(loop);
      }
    };
    const onLeave = () => root.classList.remove("le-hovering");
    root.addEventListener("pointermove", onMove, { passive: true });
    root.addEventListener("pointerleave", onLeave);
    return () => {
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [overlayVisible, isCoarse, reducedMotion]);

  // Magnetic CTA — subtle spring pull (max 10px), desktop + motion only.
  useEffect(() => {
    if (!overlayVisible || isCoarse || reducedMotion) return;
    const el = ctaRef.current;
    if (!el) return;
    const MAX = 10;
    const ACTIVATE = 90; // px beyond bounding box where pull begins
    let raf = 0;
    let tx = 0, ty = 0, cx = 0, cy = 0;
    const tick = () => {
      cx += (tx - cx) * 0.18;
      cy += (ty - cy) * 0.18;
      el.style.transform = `translate3d(${cx.toFixed(2)}px, ${cy.toFixed(2)}px, 0)`;
      if (Math.abs(tx - cx) > 0.05 || Math.abs(ty - cy) > 0.05) {
        raf = window.requestAnimationFrame(tick);
      } else {
        raf = 0;
      }
    };
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const mx = r.left + r.width / 2;
      const my = r.top + r.height / 2;
      const dx = e.clientX - mx;
      const dy = e.clientY - my;
      // Distance from button edge (approx via inset rect).
      const edgeDx = Math.max(0, Math.abs(dx) - r.width / 2);
      const edgeDy = Math.max(0, Math.abs(dy) - r.height / 2);
      const edgeDist = Math.hypot(edgeDx, edgeDy);
      if (edgeDist > ACTIVATE) {
        tx = 0; ty = 0;
      } else {
        const strength = 1 - edgeDist / ACTIVATE; // 0..1
        tx = dx * 0.18 * strength;
        ty = dy * 0.18 * strength;
        const m = Math.hypot(tx, ty);
        if (m > MAX) { tx = (tx / m) * MAX; ty = (ty / m) * MAX; }
      }
      if (!raf) raf = window.requestAnimationFrame(tick);
    };
    const onLeaveWin = () => {
      tx = 0; ty = 0;
      if (!raf) raf = window.requestAnimationFrame(tick);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeaveWin);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeaveWin);
      if (raf) window.cancelAnimationFrame(raf);
      el.style.transform = "";
    };
  }, [overlayVisible, isCoarse, reducedMotion]);

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

  useEffect(() => {
    if (!overlayVisible) return;
    const v = videoRef.current;
    if (!v) return;
    const sync = () => {
      if (document.hidden) v.pause();
      else v.play().catch(() => { /* noop */ });
    };
    document.addEventListener("visibilitychange", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      // Fully release the media element so decoders/GPU buffers are freed.
      try {
        v.pause();
        v.removeAttribute("src");
        v.load();
      } catch { /* noop */ }
    };
  }, [overlayVisible]);


  // Auto-hide first-run hint once the user interacts.
  const [hintDismissed, setHintDismissed] = useState(false);
  useEffect(() => {
    if (revealRatio > 0.02 || starsVersion > 0) {
      const t = window.setTimeout(() => setHintDismissed(true), 500);
      return () => window.clearTimeout(t);
    }
  }, [revealRatio, starsVersion]);

  useEffect(() => {
    if (revealRatio >= 0.25) rootRef.current?.classList.add("le-cta-glow");
    else rootRef.current?.classList.remove("le-cta-glow");
  }, [revealRatio]);

  const handleCta = useCallback(() => {
    if (phase !== "visible") return;
    if (stars.length >= 2 && !reducedMotion) {
      setConnecting(true);
      window.setTimeout(() => {
        eraseAll(500);
        enter();
      }, 420);
    } else {
      eraseAll(500);
      enter();
    }
  }, [phase, enter, eraseAll, stars.length, reducedMotion]);

  if (!overlayVisible) return null;

  // Build connection lines between stars for enter animation.
  const starLines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  if (connecting && stars.length >= 2) {
    for (let i = 0; i < stars.length - 1; i++) {
      starLines.push({
        x1: stars[i].x,
        y1: stars[i].y,
        x2: stars[i + 1].x,
        y2: stars[i + 1].y,
      });
    }
  }

  return (
    <div
      ref={rootRef}
      className="le-root"
      data-phase={phase}
      data-connecting={connecting ? "true" : "false"}
      role="dialog"
      aria-modal="true"
      aria-labelledby="le-title"
      aria-describedby="le-sub"
    >
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

      <canvas ref={glassRef} className="le-glass" aria-hidden="true" />
      {maskCanvas}

      <div ref={scratchRef} className="le-scratch" aria-hidden="true" />

      {/* Persistent starmarks + connection SVG */}
      <svg
        className="le-stars"
        aria-hidden="true"
        width="100%"
        height="100%"
        viewBox={`0 0 ${typeof window !== "undefined" ? window.innerWidth : 1280} ${typeof window !== "undefined" ? window.innerHeight : 800}`}
        preserveAspectRatio="none"
      >
        {starLines.map((l, i) => (
          <line
            key={i}
            className="le-star-line"
            x1={l.x1}
            y1={l.y1}
            x2={l.x2}
            y2={l.y2}
          />
        ))}
        {stars.map((s) => (
          <g key={s.id} className="le-star" transform={`translate(${s.x} ${s.y})`}>
            <circle r={5} className="le-star-halo" />
            <circle r={1.6} className="le-star-core" />
          </g>
        ))}
      </svg>

      {/* Lantern cursor (desktop) */}
      {!isCoarse && !reducedMotion && (
        <div ref={lanternRef} className="le-lantern" aria-hidden="true">
          <div className="le-lantern-outer" />
          <div className="le-lantern-mid" />
          <div className="le-lantern-core" />
        </div>
      )}

      <div className="le-vignette" aria-hidden="true" />
      <div className="le-seam" aria-hidden="true" />

      {/* Top bar */}
      <div className="le-top">
        <div className="le-brand-center">{copy.brand}</div>
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

      {/* Title & CTA */}
      <div className="le-content">
        <div className="le-inner">
          <div className="le-title-block">
            <h1
              id="le-title"
              className="le-title"
              data-lang={lang}
              style={{ whiteSpace: "pre-line" }}
            >
              {copy.title}
            </h1>
            <p
              id="le-sub"
              className="le-sub"
              style={{ whiteSpace: "pre-line" }}
            >
              {copy.sub}
            </p>
          </div>
        </div>

        <div className="le-actions">
          <button
            ref={ctaRef}
            type="button"
            className="le-cta"
            onClick={handleCta}
            disabled={phase !== "visible"}
            data-le-action="enter"
            autoFocus
          >
            {copy.cta}
          </button>
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

        <div
          className="le-hint"
          data-dismissed={hintDismissed ? "true" : "false"}
          aria-live="polite"
        >
          <p className="le-hint-line1">
            <span className="le-hint-dot" aria-hidden="true" />
            {copy.hint1}
          </p>
          <p className="le-hint-line2">{copy.hint2}</p>
        </div>
      </div>
    </div>
  );
}
