/**
 * LibraryEntrance — session-gated immersive "Lantern at the Gate" entrance.
 *
 * Composition (bottom → top):
 *   1. Clear media (Layer A) — untouched poster / video, warm library tones.
 *   2. Dimmed media (Layer B) — same source, brightness+saturate+blur, plus
 *      a CSS radial mask driven by the pointer. Where the mask is opaque the
 *      dim layer is visible (fog); where the mask fades to transparent, the
 *      clear layer beneath shows through — the "lantern" reveal.
 *   3. Parallax layer group — subtle depth response for background/mid/front.
 *   4. Door overlay pair — two clip-path halves that split on enter animation.
 *   5. UI content (title, sub, CTA, language toggle) — always above effects.
 *
 * No canvases, no persistent click marks, no starfield. Interaction is
 * expressed entirely via CSS variables + transforms, updated in a single
 * rAF loop so React never re-renders on pointer movement.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLang } from "@/lib/i18n";
import desktopVideoAsset from "@/assets/entrance/entrance-desktop.mp4.asset.json";
import mobileVideoAsset from "@/assets/entrance/entrance-mobile.mp4.asset.json";
import desktopPosterAsset from "@/assets/entrance/entrance-desktop-poster.webp.asset.json";
import mobilePosterAsset from "@/assets/entrance/entrance-mobile-poster.png.asset.json";
import { useEntranceSequence } from "./useEntranceSequence";
import "./library-entrance.css";

const COPY = {
  zh: {
    brand: "DESTINY LIBRARY · 命运图书馆",
    title: "万卷命运之中，\n有一本以你为名。",
    sub: "这里不收藏既定的答案，\n只陪你照亮那些尚未读懂的自己。",
    cta: "推开馆门",
    skip: "直接进入",
    hint: "移动鼠标，让提灯照亮馆门",
    langHint: "图书馆将以此语言与你对话",
  },
  en: {
    brand: "DESTINY LIBRARY",
    title: "Among countless stories of fate,\none bears your name.",
    sub: "This library does not preserve predetermined answers.\nIt helps illuminate the parts of yourself not yet understood.",
    cta: "Open the Library",
    skip: "Enter directly",
    hint: "Move your lantern across the gate",
    langHint: "The library will speak with you in this language",
  },
} as const;

export function LibraryEntrance() {
  const { phase, enter, skip } = useEntranceSequence();
  const { lang, setLang } = useLang();
  const copy = COPY[lang];

  const rootRef = useRef<HTMLDivElement | null>(null);
  const videoRefA = useRef<HTMLVideoElement | null>(null);
  const videoRefB = useRef<HTMLVideoElement | null>(null);
  const ctaRef = useRef<HTMLButtonElement | null>(null);

  const overlayVisible =
    phase === "visible" || phase === "exiting-enter" || phase === "exiting-skip";

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
    return (
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
    );
  }, []);

  const isCoarse = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia?.("(pointer: coarse)").matches ?? false;
  }, []);

  // Body scroll lock + global chrome hide.
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

  // Keep the two synced videos aligned + respect tab visibility.
  useEffect(() => {
    if (!overlayVisible || reducedMotion) return;
    const a = videoRefA.current;
    const b = videoRefB.current;
    if (!a || !b) return;
    const sync = () => {
      if (document.hidden) {
        a.pause();
        b.pause();
      } else {
        a.play().catch(() => {});
        b.play().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, [overlayVisible, reducedMotion]);

  // Pointer → CSS variable pump. Drives lantern mask, parallax, magnet.
  useEffect(() => {
    if (!overlayVisible) return;
    const root = rootRef.current;
    if (!root) return;

    // Desktop: interactive lantern; mobile: gentle drifting spotlight.
    if (isCoarse || reducedMotion) {
      root.style.setProperty("--le-lantern-opacity", "1");
      const w = window.innerWidth;
      const h = window.innerHeight;
      root.style.setProperty("--le-lx", `${w / 2}px`);
      root.style.setProperty("--le-ly", `${h * 0.55}px`);
      if (reducedMotion) return;
      // Slow autonomous drift so mobile still feels alive.
      let raf = 0;
      const start = performance.now();
      const loop = (t: number) => {
        const dt = (t - start) / 1000;
        const cx = w / 2 + Math.sin(dt * 0.4) * (w * 0.08);
        const cy = h * 0.55 + Math.cos(dt * 0.32) * (h * 0.05);
        root.style.setProperty("--le-lx", `${cx}px`);
        root.style.setProperty("--le-ly", `${cy}px`);
        raf = window.requestAnimationFrame(loop);
      };
      raf = window.requestAnimationFrame(loop);
      return () => window.cancelAnimationFrame(raf);
    }

    let tx = window.innerWidth / 2;
    let ty = window.innerHeight / 2;
    let cx = tx;
    let cy = ty;
    let targetOpacity = 0;
    let opacity = 0;
    let raf = 0;
    let pending = false;
    let idleTimer: number | null = null;

    const loop = () => {
      pending = false;
      cx += (tx - cx) * 0.18; // low-pass, ~soft spring
      cy += (ty - cy) * 0.18;
      opacity += (targetOpacity - opacity) * 0.12;
      root.style.setProperty("--le-lx", `${cx}px`);
      root.style.setProperty("--le-ly", `${cy}px`);
      root.style.setProperty("--le-lantern-opacity", opacity.toFixed(3));

      // Parallax: normalized offset from center.
      const w = window.innerWidth;
      const h = window.innerHeight;
      const nx = (cx / w - 0.5) * 2;
      const ny = (cy / h - 0.5) * 2;
      root.style.setProperty("--le-px", nx.toFixed(3));
      root.style.setProperty("--le-py", ny.toFixed(3));

      // Central gate detection (35% zone).
      const distX = Math.abs(cx - w / 2) / w;
      const distY = Math.abs(cy - h * 0.55) / h;
      const centered = distX < 0.175 && distY < 0.175;
      if (centered) root.setAttribute("data-le-centered", "true");
      else root.removeAttribute("data-le-centered");

      // Magnetic button.
      const cta = ctaRef.current;
      if (cta) {
        const rect = cta.getBoundingClientRect();
        const bx = rect.left + rect.width / 2;
        const by = rect.top + rect.height / 2;
        const dx = cx - bx;
        const dy = cy - by;
        const dist = Math.hypot(dx, dy);
        const range = 140;
        if (dist < range) {
          const strength = (1 - dist / range) * 10; // max ~10px
          cta.style.setProperty("--le-mag-x", `${(dx / dist) * strength}px`);
          cta.style.setProperty("--le-mag-y", `${(dy / dist) * strength}px`);
        } else {
          cta.style.setProperty("--le-mag-x", "0px");
          cta.style.setProperty("--le-mag-y", "0px");
        }
      }

      const still =
        Math.abs(tx - cx) < 0.4 &&
        Math.abs(ty - cy) < 0.4 &&
        Math.abs(targetOpacity - opacity) < 0.005;
      if (!still) {
        raf = window.requestAnimationFrame(loop);
        pending = true;
      }
    };
    const kick = () => {
      if (!pending) {
        pending = true;
        raf = window.requestAnimationFrame(loop);
      }
    };
    const onMove = (e: PointerEvent) => {
      tx = e.clientX;
      ty = e.clientY;
      targetOpacity = 1;
      if (idleTimer) window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        targetOpacity = 0;
        kick();
      }, 550);
      kick();
    };
    const onLeave = () => {
      targetOpacity = 0;
      kick();
    };
    root.addEventListener("pointermove", onMove, { passive: true });
    root.addEventListener("pointerleave", onLeave);
    kick();
    return () => {
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
      if (raf) window.cancelAnimationFrame(raf);
      if (idleTimer) window.clearTimeout(idleTimer);
    };
  }, [overlayVisible, isCoarse, reducedMotion]);

  useEffect(() => {
    if (phase !== "visible") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        skip();
        return;
      }
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

  const [locked, setLocked] = useState(false);
  const handleCta = useCallback(() => {
    if (phase !== "visible" || locked) return;
    setLocked(true);
    enter();
  }, [phase, enter, locked]);

  if (!overlayVisible) return null;

  const useVideo = !reducedMotion;

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
      {/* Layer A — clear media */}
      <div className="le-media le-media-clear" aria-hidden="true">
        {useVideo ? (
          <video
            ref={videoRefA}
            src={media.video}
            poster={media.poster}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
          />
        ) : (
          <img src={media.poster} alt="" />
        )}
      </div>

      {/* Layer B — dimmed media, punched by lantern mask */}
      <div className="le-media le-media-dim" aria-hidden="true">
        {useVideo ? (
          <video
            ref={videoRefB}
            src={media.video}
            poster={media.poster}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
          />
        ) : (
          <img src={media.poster} alt="" />
        )}
        <div className="le-media-tint" />
      </div>

      {/* Door split overlays (used during enter animation) */}
      <div className="le-door le-door-left" aria-hidden="true">
        {useVideo ? (
          <img src={media.poster} alt="" />
        ) : (
          <img src={media.poster} alt="" />
        )}
      </div>
      <div className="le-door le-door-right" aria-hidden="true">
        <img src={media.poster} alt="" />
      </div>
      <div className="le-doorlight" aria-hidden="true" />

      {/* Gate accents (seam + astrolabe pulse when centered) */}
      <div className="le-seam" aria-hidden="true" />
      <div className="le-vignette" aria-hidden="true" />
      <div className="le-breathe" aria-hidden="true" />

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
            disabled={phase !== "visible" || locked}
            data-le-action="enter"
            autoFocus
          >
            <span className="le-cta-shine" aria-hidden="true" />
            <span className="le-cta-label">{copy.cta}</span>
          </button>
          <button
            type="button"
            className="le-skip"
            onClick={skip}
            disabled={phase !== "visible" || locked}
            data-le-action="skip"
          >
            {copy.skip}
          </button>
        </div>

        {!isCoarse && !reducedMotion && (
          <p className="le-hint" aria-hidden="true">
            {copy.hint}
          </p>
        )}
      </div>
    </div>
  );
}
