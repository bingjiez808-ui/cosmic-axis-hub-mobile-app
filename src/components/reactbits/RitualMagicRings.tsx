/**
 * RitualMagicRings — single WebGL MagicRings instance for the ritual page.
 *
 * - Sits between the library backdrop and the ritual form (z-index handled by parent).
 * - Uses a horizontal CSS mask on desktop so light concentrates on the LEFT/RIGHT of
 *   the reading column and never crosses the center form area.
 * - On <768px collapses to a soft ambient halo around the card (no dual rings).
 * - Falls back to a static SVG dual-ring when WebGL2 is unavailable or the user
 *   prefers reduced motion.
 */
import { lazy, Suspense, useEffect, useState } from "react";

const MagicRings = lazy(() => import("./MagicRings.jsx"));

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);
  return reduced;
}

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => setMobile(mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);
  return mobile;
}

/**
 * Capability probe. WebGL2 alone is not enough: on low-memory / low-core
 * phones the three.js ring shader is the single heaviest thing on the
 * ritual page and is what makes the tab stall or die. Those devices get
 * the static SVG instead. The probe canvas is explicitly released so we
 * never leak a second GL context.
 */
function useCanRender3d() {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    try {
      const nav = navigator as Navigator & { deviceMemory?: number };
      if ((nav.deviceMemory ?? 8) <= 4 || (nav.hardwareConcurrency ?? 8) <= 4) {
        setOk(false);
        return;
      }
      const c = document.createElement("canvas");
      const gl = c.getContext("webgl2");
      const good = !!gl;
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
      setOk(good);
    } catch {
      setOk(false);
    }
  }, []);
  return ok;
}

/** Defer mounting the heavy scene until the browser is actually idle. */
function useIdle(delay = 600) {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(() => setIdle(true));
      return () => (window as unknown as { cancelIdleCallback?: (h: number) => void })
        .cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(() => setIdle(true), delay);
    return () => window.clearTimeout(t);
  }, [delay]);
  return idle;
}


function StaticFallback({ mobile }: { mobile: boolean }) {
  const size = mobile ? 320 : 560;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div
        aria-hidden
        className="rounded-full border border-[#D7B867]/25"
        style={{ width: size, height: size }}
      />
      <div
        aria-hidden
        className="absolute rounded-full border border-[#6756B8]/30"
        style={{ width: size * 0.62, height: size * 0.62 }}
      />
    </div>
  );
}

interface Props {
  currentStep: number;
}

export default function RitualMagicRings({ currentStep }: Props) {
  const reduced = useReducedMotion();
  const mobile = useIsMobile();
  const webgl2 = useWebGL2();

  if (webgl2 === null) {
    // First paint — render nothing (avoids SSR/hydration mismatch on webgl probe).
    return null;
  }

  if (reduced || webgl2 === false) {
    return <StaticFallback mobile={mobile} />;
  }

  // Desktop: strong horizontal mask keeping brightness on left/right; center clear.
  // Mobile: soft radial mask forming an ambient halo around the card.
  const maskImage = mobile
    ? "radial-gradient(circle at center, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.4) 55%, transparent 78%)"
    : "linear-gradient(90deg, rgba(0,0,0,1) 0%, rgba(0,0,0,0.9) 30%, transparent 44%, transparent 56%, rgba(0,0,0,0.9) 70%, rgba(0,0,0,1) 100%)";

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{
        WebkitMaskImage: maskImage,
        maskImage,
      }}
      aria-hidden
    >
      <Suspense fallback={null}>
        <MagicRings
          color="#D7B867"
          colorTwo="#6756B8"
          ringCount={mobile ? 3 : 5}
          speed={mobile ? 0.22 : 0.32}
          attenuation={13}
          lineThickness={mobile ? 0.9 : 1.15}
          baseRadius={0.28}
          radiusStep={0.115}
          scaleRate={0.035}
          opacity={mobile ? 0.26 : 0.58}
          blur={0.35}
          noiseAmount={0.015}
          rotation={currentStep * 5}
          ringGap={1.35}
          fadeIn={0.8}
          fadeOut={0.65}
          followMouse={false}
          mouseInfluence={0}
          hoverScale={1.02}
          parallax={0.015}
          clickBurst={false}
          maxDpr={mobile ? 1.25 : 1.5}
        />
      </Suspense>
    </div>
  );
}
