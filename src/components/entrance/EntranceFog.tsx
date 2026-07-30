/**
 * EntranceFog — drifting mist layers over the entrance backdrop, cleared by a
 * soft radial mask that follows the lantern (desktop pointer) or the finger
 * (touch drag). Pointer position is written straight into CSS variables from a
 * single rAF loop; no React state updates while moving.
 */
import { useEffect, useRef } from "react";
import "./entrance-fog.css";

type Props = {
  active: boolean;
  reducedMotion: boolean;
  isCoarse: boolean;
  /** Selector of the element the resting clear spot hugs on touch devices. */
  restAnchor?: string;
};

export function EntranceFog({ active, reducedMotion, isCoarse, restAnchor }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !active) return;

    const isMobile = isCoarse || window.innerWidth < 640;
    const radius = isMobile ? 130 : Math.min(260, Math.max(180, window.innerWidth * 0.16));
    el.style.setProperty("--le-fog-r", `${radius}px`);

    // Resting clear spot: near the CTA on touch, centre-ish on desktop.
    const restPoint = () => {
      const anchor = restAnchor ? document.querySelector(restAnchor) : null;
      if (anchor) {
        const r = anchor.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }
      return { x: window.innerWidth / 2, y: window.innerHeight * 0.62 };
    };

    const rest = restPoint();
    let tx = rest.x;
    let ty = rest.y;
    let cx = tx;
    let cy = ty;
    let raf = 0;

    const write = () => {
      el.style.setProperty("--le-fog-x", `${cx.toFixed(1)}px`);
      el.style.setProperty("--le-fog-y", `${cy.toFixed(1)}px`);
    };
    write();
    // Touch devices keep a faint resting halo so the CTA reads as interactive.
    el.style.setProperty("--le-fog-clear", isMobile ? "0.35" : "0");

    const loop = () => {
      raf = 0;
      if (reducedMotion) {
        cx = tx;
        cy = ty;
      } else {
        cx += (tx - cx) * 0.18;
        cy += (ty - cy) * 0.18;
      }
      write();
      if (!reducedMotion && (Math.abs(tx - cx) > 0.4 || Math.abs(ty - cy) > 0.4)) {
        raf = window.requestAnimationFrame(loop);
      }
    };

    const track = (x: number, y: number) => {
      tx = x;
      ty = y;
      if (!raf) raf = window.requestAnimationFrame(loop);
    };

    const setClear = (v: number, ms: number) => {
      el.style.setProperty("transition", `opacity 700ms ease, --le-fog-clear ${ms}ms ease`);
      el.style.setProperty("--le-fog-clear", String(v));
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return; // touch handled by drag below
      track(e.clientX, e.clientY);
      setClear(1, reducedMotion ? 0 : 260);
    };
    const onPointerLeave = () => {
      // Mist flows back over ~1.5s; the clear spot stays where it was.
      setClear(isMobile ? 0.35 : 0, reducedMotion ? 0 : 1500);
    };
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      track(t.clientX, t.clientY);
      setClear(1, 200);
    };
    const onTouchEnd = () => {
      const p = restPoint();
      track(p.x, p.y);
      setClear(0.35, 1500);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("touchstart", onTouchMove, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("touchstart", onTouchMove);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [active, reducedMotion, isCoarse, restAnchor]);

  const lite =
    typeof navigator !== "undefined" &&
    ((navigator as { deviceMemory?: number }).deviceMemory ?? 8) <= 4;

  return (
    <>
      <div ref={ref} className="le-fog" data-lite={lite ? "true" : "false"} aria-hidden="true">
        <div className="le-fog-layer le-fog-1" />
        <div className="le-fog-layer le-fog-2" />
        <div className="le-fog-layer le-fog-3" />
      </div>
      <div className="le-fog-scrim" aria-hidden="true" />
    </>
  );
}
