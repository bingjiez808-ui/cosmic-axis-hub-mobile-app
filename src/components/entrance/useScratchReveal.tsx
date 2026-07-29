/**
 * useScratchReveal — "lantern & scratch glass" interaction for the
 * Destiny Library entrance.
 *
 * Three distinct pointer interactions:
 *   • Hover  → transient soft reveal (~55–70% clear) that fades after ~800ms.
 *              Written to `hoverMaskRef` and cleared every frame with a
 *              partial fade so the fog re-forms naturally.
 *   • Click  → permanent radial reveal + a small starmark stamped into
 *              `stampMaskRef`. Recent star points are kept in `starsRef`
 *              (capped at MAX_STARS) so the enter animation can connect
 *              them with faint golden lines.
 *   • Drag   → permanent continuous erase along the pointer path (persistent
 *              scratch mask, same behavior as before).
 *
 * The visible <canvas> is repainted each frame:
 *   blurred source → fog tint → destination-out hover mask (partial α)
 *                              → destination-out permanent mask (full α)
 */
import { useCallback, useEffect, useRef, useState } from "react";

export interface UseScratchRevealOptions {
  getSource: () => HTMLVideoElement | HTMLImageElement | null;
  brushRadius?: number;
  brushRadiusMobile?: number;
  onFirstStroke?: () => void;
  disabled?: boolean;
  reducedMotion?: boolean;
}

export interface StarPoint {
  x: number; // CSS px
  y: number;
  id: number;
}

const MAX_STARS = 8;

export function useScratchReveal(opts: UseScratchRevealOptions) {
  const glassRef = useRef<HTMLCanvasElement | null>(null);
  const scratchRef = useRef<HTMLDivElement | null>(null);
  const maskRef = useRef<HTMLCanvasElement | null>(null); // permanent
  const hoverMaskRef = useRef<HTMLCanvasElement | null>(null); // transient
  const rafRef = useRef<number | null>(null);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });
  const drawingRef = useRef(false);
  const movedRef = useRef(false);
  const downPtRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const hoverPtRef = useRef<{ x: number; y: number } | null>(null);
  const startedRef = useRef(false);
  const [revealRatio, setRevealRatio] = useState(0);
  const starsRef = useRef<StarPoint[]>([]);
  const starIdRef = useRef(1);
  const [starsVersion, setStarsVersion] = useState(0);

  const resize = useCallback(() => {
    const glass = glassRef.current;
    const mask = maskRef.current;
    const hover = hoverMaskRef.current;
    if (!glass || !mask || !hover) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    sizeRef.current = { w, h, dpr };

    const prev = document.createElement("canvas");
    prev.width = mask.width;
    prev.height = mask.height;
    prev.getContext("2d")?.drawImage(mask, 0, 0);

    for (const c of [glass, mask, hover]) {
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

  const paint = useCallback(() => {
    rafRef.current = null;
    const glass = glassRef.current;
    const mask = maskRef.current;
    const hover = hoverMaskRef.current;
    if (!glass || !mask || !hover) return;
    const ctx = glass.getContext("2d");
    if (!ctx) return;
    const src = opts.getSource();
    const { w, h, dpr } = sizeRef.current;
    if (w === 0 || h === 0) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    if (src) {
      try {
        ctx.save();
        ctx.filter = "blur(11px) brightness(0.68) saturate(0.62) contrast(0.96)";
        const scale = 1.045;
        const dw = w * scale;
        const dh = h * scale;
        const dx = (w - dw) / 2;
        const dy = (h - dh) / 2;
        ctx.drawImage(src, dx, dy, dw, dh);
        ctx.restore();
      } catch {
        /* skip frame */
      }
    }

    // Warm-grey fog tint (never black).
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "rgba(205,202,195,0.12)");
    grad.addColorStop(0.5, "rgba(128,122,135,0.09)");
    grad.addColorStop(1, "rgba(65,60,70,0.10)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Continuously repaint hover mask so old spots fade.
    const hctx = hover.getContext("2d");
    if (hctx) {
      // Fade existing hover ink each frame (~800ms half-life).
      hctx.setTransform(1, 0, 0, 1, 0, 0);
      hctx.globalCompositeOperation = "destination-out";
      hctx.fillStyle = "rgba(0,0,0,0.06)";
      hctx.fillRect(0, 0, hover.width, hover.height);
      hctx.globalCompositeOperation = "source-over";

      const hp = hoverPtRef.current;
      if (hp && !drawingRef.current) {
        const r = 200 * dpr;
        const px = hp.x * dpr;
        const py = hp.y * dpr;
        const g = hctx.createRadialGradient(px, py, 0, px, py, r);
        g.addColorStop(0, "rgba(0,0,0,0.55)");
        g.addColorStop(0.55, "rgba(0,0,0,0.28)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        hctx.fillStyle = g;
        hctx.beginPath();
        hctx.arc(px, py, r, 0, Math.PI * 2);
        hctx.fill();
      }
    }

    // Apply transient hover reveal (partial).
    ctx.globalCompositeOperation = "destination-out";
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(hover, 0, 0);
    // Apply permanent scratch mask (full).
    ctx.drawImage(mask, 0, 0);
    ctx.globalCompositeOperation = "source-over";
  }, [opts]);

  useEffect(() => {
    if (opts.disabled) return;
    let alive = true;
    let last = 0;
    const loop = (t: number) => {
      if (!alive) return;
      if (document.hidden) {
        rafRef.current = window.requestAnimationFrame(loop);
        return;
      }
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

  const brushAt = useCallback(
    (x: number, y: number, opts2?: { radiusScale?: number; alpha?: number }) => {
      const mask = maskRef.current;
      if (!mask) return;
      const mctx = mask.getContext("2d");
      if (!mctx) return;
      const isMobile = window.matchMedia("(max-width: 640px)").matches;
      const baseR = isMobile ? opts.brushRadiusMobile ?? 110 : opts.brushRadius ?? 130;
      const r = baseR * (opts2?.radiusScale ?? 1) * sizeRef.current.dpr;
      const a = opts2?.alpha ?? 1;

      const drawStamp = (px: number, py: number) => {
        const g = mctx.createRadialGradient(px, py, 0, px, py, r);
        g.addColorStop(0, `rgba(0,0,0,${a})`);
        g.addColorStop(0.55, `rgba(0,0,0,${a * 0.82})`);
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

  const clickRevealAt = useCallback(
    (x: number, y: number) => {
      const mask = maskRef.current;
      if (!mask) return;
      const mctx = mask.getContext("2d");
      if (!mctx) return;
      const dpr = sizeRef.current.dpr;
      const px = x * dpr;
      const py = y * dpr;
      const r = 210 * dpr;
      const g = mctx.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, "rgba(0,0,0,1)");
      g.addColorStop(0.5, "rgba(0,0,0,0.8)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      mctx.fillStyle = g;
      mctx.beginPath();
      mctx.arc(px, py, r, 0, Math.PI * 2);
      mctx.fill();

      // Record star
      starsRef.current.push({ x, y, id: starIdRef.current++ });
      if (starsRef.current.length > MAX_STARS) {
        starsRef.current.splice(0, starsRef.current.length - MAX_STARS);
      }
      setStarsVersion((v) => v + 1);
    },
    []
  );

  useEffect(() => {
    if (opts.disabled) return;
    const surface = scratchRef.current;
    if (!surface) return;

    const onHoverMove = (e: PointerEvent) => {
      if (drawingRef.current) return;
      if (opts.reducedMotion) return;
      hoverPtRef.current = { x: e.clientX, y: e.clientY };
    };
    const onHoverLeave = () => {
      hoverPtRef.current = null;
    };
    const onDown = (e: PointerEvent) => {
      drawingRef.current = true;
      movedRef.current = false;
      lastPointRef.current = null;
      downPtRef.current = { x: e.clientX, y: e.clientY, t: performance.now() };
      (e.target as Element).setPointerCapture?.(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!drawingRef.current) {
        onHoverMove(e);
        return;
      }
      const d0 = downPtRef.current;
      if (d0) {
        const dist = Math.hypot(e.clientX - d0.x, e.clientY - d0.y);
        if (dist > 6) movedRef.current = true;
      }
      if (movedRef.current) {
        brushAt(e.clientX, e.clientY);
        if (!startedRef.current) {
          startedRef.current = true;
          opts.onFirstStroke?.();
        }
      }
    };
    const onUp = (e: PointerEvent) => {
      const wasDrawing = drawingRef.current;
      drawingRef.current = false;
      lastPointRef.current = null;
      try { (e.target as Element).releasePointerCapture?.(e.pointerId); } catch { /* noop */ }
      if (!wasDrawing) return;
      const d0 = downPtRef.current;
      downPtRef.current = null;
      // Click (short, low movement) → reveal + star
      if (d0 && !movedRef.current && performance.now() - d0.t < 400) {
        clickRevealAt(e.clientX, e.clientY);
        if (!startedRef.current) {
          startedRef.current = true;
          opts.onFirstStroke?.();
        }
      }
    };

    surface.addEventListener("pointerdown", onDown);
    surface.addEventListener("pointermove", onMove);
    surface.addEventListener("pointerup", onUp);
    surface.addEventListener("pointercancel", onUp);
    surface.addEventListener("pointerleave", (e) => { onHoverLeave(); onUp(e); });
    return () => {
      surface.removeEventListener("pointerdown", onDown);
      surface.removeEventListener("pointermove", onMove);
      surface.removeEventListener("pointerup", onUp);
      surface.removeEventListener("pointercancel", onUp);
    };
  }, [brushAt, clickRevealAt, opts]);

  useEffect(() => {
    resize();
    const onResize = () => resize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [resize]);

  useEffect(() => {
    if (opts.disabled) return;
    const id = window.setInterval(() => {
      const mask = maskRef.current;
      if (!mask) return;
      const mctx = mask.getContext("2d");
      if (!mctx) return;
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

  const maskCanvas = (
    <>
      <canvas ref={maskRef} style={{ display: "none" }} aria-hidden="true" />
      <canvas ref={hoverMaskRef} style={{ display: "none" }} aria-hidden="true" />
    </>
  );

  return {
    glassRef,
    scratchRef,
    maskCanvas,
    revealRatio,
    eraseAll,
    stars: starsRef.current,
    starsVersion,
  };
}
