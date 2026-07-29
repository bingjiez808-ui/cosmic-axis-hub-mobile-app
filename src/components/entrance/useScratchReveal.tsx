/**
 * useScratchReveal — accumulating "erase the foggy glass" interaction.
 *
 * Rendering model (single visible canvas + offscreen stroke mask):
 *   1. On each animation frame we paint the foggy-glass canvas by drawing
 *      the underlying <video> (or poster <img>) with a blur filter, then
 *      overlay a soft cool-white fog tint.
 *   2. We then composite an offscreen "stroke mask" canvas (which stores
 *      the accumulated erase strokes as opaque radial gradients) using
 *      `destination-out`. Wherever the stroke mask has ink, the glass
 *      pixels become transparent, revealing the clear layer below.
 *
 * Interaction:
 *   - Only pointer-DOWN drags erase (plain hover is a no-op; the caller
 *     shows an unrelated cursor glow).
 *   - Strokes are captured with pointer events + rAF throttling to stay
 *     off the React render path.
 *   - Erased pixels persist for the whole session — the stroke mask is
 *     never cleared until the entrance unmounts.
 *
 * The hook returns refs the component attaches to the visible glass
 * canvas and the transparent scratch surface, plus a getter for the
 * approximate reveal ratio (sampled at ~4Hz for the "馆门已经看见" hint).
 */
import { useCallback, useEffect, useRef, useState } from "react";

export interface UseScratchRevealOptions {
  /** Source element re-painted into the glass each frame. */
  getSource: () => HTMLVideoElement | HTMLImageElement | null;
  brushRadius?: number;   // desktop
  brushRadiusMobile?: number;
  /** Called once when the user starts scratching. */
  onFirstStroke?: () => void;
  disabled?: boolean;
}

export function useScratchReveal(opts: UseScratchRevealOptions) {
  const glassRef = useRef<HTMLCanvasElement | null>(null);
  const scratchRef = useRef<HTMLDivElement | null>(null);
  const maskRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const startedRef = useRef(false);
  const [revealRatio, setRevealRatio] = useState(0);

  // --- Sizing ----------------------------------------------------------
  const resize = useCallback(() => {
    const glass = glassRef.current;
    const mask = maskRef.current;
    if (!glass || !mask) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    sizeRef.current = { w, h, dpr };

    // Preserve prior mask by copying before resize.
    const prev = document.createElement("canvas");
    prev.width = mask.width;
    prev.height = mask.height;
    prev.getContext("2d")?.drawImage(mask, 0, 0);

    for (const c of [glass, mask]) {
      c.width = Math.floor(w * dpr);
      c.height = Math.floor(h * dpr);
      c.style.width = `${w}px`;
      c.style.height = `${h}px`;
    }
    const mctx = mask.getContext("2d");
    if (mctx && prev.width > 0) {
      mctx.setTransform(1, 0, 0, 1, 0, 0);
      mctx.drawImage(prev, 0, 0, prev.width, prev.height, 0, 0, mask.width, mask.height);
    }
  }, []);

  // --- Frame paint -----------------------------------------------------
  const paint = useCallback(() => {
    rafRef.current = null;
    const glass = glassRef.current;
    const mask = maskRef.current;
    if (!glass || !mask) return;
    const ctx = glass.getContext("2d");
    if (!ctx) return;
    const src = opts.getSource();
    const { w, h, dpr } = sizeRef.current;
    if (w === 0 || h === 0) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // Blurred + slightly desaturated source.
    if (src) {
      try {
        ctx.save();
        ctx.filter = "blur(13px) brightness(0.72) saturate(0.6) contrast(0.95)";
        // Scale up slightly to hide blur bleed at edges.
        const scale = 1.045;
        const dw = w * scale;
        const dh = h * scale;
        const dx = (w - dw) / 2;
        const dy = (h - dh) / 2;
        ctx.drawImage(src, dx, dy, dw, dh);
        ctx.restore();
      } catch {
        /* video not ready — skip this frame */
      }
    }

    // Cool-white fog tint (never black).
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "rgba(205,202,195,0.18)");
    grad.addColorStop(0.5, "rgba(130,126,136,0.13)");
    grad.addColorStop(1, "rgba(55,51,62,0.20)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Apply accumulated erase strokes.
    ctx.globalCompositeOperation = "destination-out";
    ctx.setTransform(1, 0, 0, 1, 0, 0); // draw mask 1:1 in device px
    ctx.drawImage(mask, 0, 0);
    ctx.globalCompositeOperation = "source-over";
  }, [opts]);

  // Continuous rAF loop while enabled — needed because video plays.
  useEffect(() => {
    if (opts.disabled) return;
    let alive = true;
    let last = 0;
    const loop = (t: number) => {
      if (!alive) return;
      if (t - last > 33) {
        last = t;
        paint();
      }
      rafRef.current = window.requestAnimationFrame(loop);
    };
    rafRef.current = window.requestAnimationFrame(loop);
    return () => {
      alive = false;
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [paint, opts.disabled]);

  // --- Strokes ---------------------------------------------------------
  const brushAt = useCallback(
    (x: number, y: number) => {
      const mask = maskRef.current;
      if (!mask) return;
      const mctx = mask.getContext("2d");
      if (!mctx) return;
      const isMobile = window.matchMedia("(max-width: 640px)").matches;
      const r =
        (isMobile ? opts.brushRadiusMobile ?? 110 : opts.brushRadius ?? 130) *
        sizeRef.current.dpr;

      const drawStamp = (px: number, py: number) => {
        const g = mctx.createRadialGradient(px, py, 0, px, py, r);
        g.addColorStop(0, "rgba(0,0,0,1)");
        g.addColorStop(0.55, "rgba(0,0,0,0.85)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        mctx.fillStyle = g;
        mctx.beginPath();
        mctx.arc(px, py, r, 0, Math.PI * 2);
        mctx.fill();
      };

      const dpr = sizeRef.current.dpr;
      const px = x * dpr;
      const py = y * dpr;
      const last = lastPointRef.current;
      if (last) {
        const dx = px - last.x * dpr;
        const dy = py - last.y * dpr;
        const dist = Math.hypot(dx, dy);
        const step = Math.max(r * 0.35, 6);
        const n = Math.ceil(dist / step);
        for (let i = 1; i <= n; i++) {
          const t = i / n;
          drawStamp(last.x * dpr + dx * t, last.y * dpr + dy * t);
        }
      } else {
        drawStamp(px, py);
      }
      lastPointRef.current = { x, y };
    },
    [opts.brushRadius, opts.brushRadiusMobile]
  );

  useEffect(() => {
    if (opts.disabled) return;
    const surface = scratchRef.current;
    if (!surface) return;

    const onDown = (e: PointerEvent) => {
      drawingRef.current = true;
      lastPointRef.current = null;
      (e.target as Element).setPointerCapture?.(e.pointerId);
      brushAt(e.clientX, e.clientY);
      if (!startedRef.current) {
        startedRef.current = true;
        opts.onFirstStroke?.();
      }
    };
    const onMove = (e: PointerEvent) => {
      if (!drawingRef.current) return;
      brushAt(e.clientX, e.clientY);
    };
    const onUp = (e: PointerEvent) => {
      drawingRef.current = false;
      lastPointRef.current = null;
      try { (e.target as Element).releasePointerCapture?.(e.pointerId); } catch { /* noop */ }
    };
    surface.addEventListener("pointerdown", onDown);
    surface.addEventListener("pointermove", onMove);
    surface.addEventListener("pointerup", onUp);
    surface.addEventListener("pointercancel", onUp);
    surface.addEventListener("pointerleave", onUp);
    return () => {
      surface.removeEventListener("pointerdown", onDown);
      surface.removeEventListener("pointermove", onMove);
      surface.removeEventListener("pointerup", onUp);
      surface.removeEventListener("pointercancel", onUp);
      surface.removeEventListener("pointerleave", onUp);
    };
  }, [brushAt, opts]);

  // --- Resize ----------------------------------------------------------
  useEffect(() => {
    resize();
    const onResize = () => resize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [resize]);

  // --- Reveal ratio sampling (approx, cheap) --------------------------
  useEffect(() => {
    if (opts.disabled) return;
    const id = window.setInterval(() => {
      const mask = maskRef.current;
      if (!mask) return;
      const mctx = mask.getContext("2d");
      if (!mctx) return;
      // Sample a 64x64 grid from the mask alpha channel.
      const sw = 64;
      const sh = 64;
      const off = document.createElement("canvas");
      off.width = sw;
      off.height = sh;
      const octx = off.getContext("2d");
      if (!octx) return;
      octx.drawImage(mask, 0, 0, sw, sh);
      const data = octx.getImageData(0, 0, sw, sh).data;
      let ink = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i] > 24) ink++;
      setRevealRatio(ink / (sw * sh));
    }, 250);
    return () => window.clearInterval(id);
  }, [opts.disabled]);

  // Full erase animation for the enter transition.
  const eraseAll = useCallback((durationMs = 550) => {
    const mask = maskRef.current;
    if (!mask) return;
    const mctx = mask.getContext("2d");
    if (!mctx) return;
    const start = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / durationMs);
      mctx.setTransform(1, 0, 0, 1, 0, 0);
      mctx.fillStyle = `rgba(0,0,0,${0.35 + 0.65 * p})`;
      mctx.fillRect(0, 0, mask.width, mask.height);
      if (p < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
  }, []);

  // The offscreen mask element (kept in DOM but hidden).
  const maskCanvas = (
    <canvas ref={maskRef} style={{ display: "none" }} aria-hidden="true" />
  );

  return { glassRef, scratchRef, maskCanvas, revealRatio, eraseAll };
}
