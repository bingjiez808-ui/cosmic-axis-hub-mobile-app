/**
 * ReaderPassCard — routes between the full 3D Lanyard and the 2D
 * fallback based on device / OS / GPU capability. Owns the Drawer
 * open state, the first-session hint, and the IntersectionObserver
 * that dims + unmounts the card as the guide-desk hero leaves view.
 *
 * Rendered ONLY inside GuideDeskHero. Never appears in the entrance
 * overlay, Scroll Stack, or any other page.
 */
import {
  Component,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { useLang } from "@/lib/i18n";
import { ReaderPassDrawer } from "./ReaderPassDrawer";
import { ReaderPassFlat } from "./ReaderPassFlat";
import { ReaderPassLanyard } from "./ReaderPassLanyard";
import { markHintSeen, readHintSeen } from "./hint-storage";
import { useReaderPassData } from "./useReaderPassData";

type Mode = "loading" | "flat" | "three";

function detectMode(): Mode {
  if (typeof window === "undefined") return "loading";
  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean };
    deviceMemory?: number;
  };
  if (window.innerWidth < 640) return "flat";
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "flat";
  if (nav.connection?.saveData) return "flat";
  if (nav.deviceMemory && nav.deviceMemory < 4) return "flat";
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl");
    if (!gl) return "flat";
  } catch {
    return "flat";
  }
  return "three";
}

// Small ErrorBoundary so a WebGL/Rapier crash silently falls back to 2D.
class ThreeErrorBoundary extends Component<
  { fallback: ReactNode; onError: () => void; children: ReactNode },
  { crashed: boolean }
> {
  state = { crashed: false };
  static getDerivedStateFromError() {
    return { crashed: true };
  }
  componentDidCatch(_err: Error, _info: ErrorInfo) {
    this.props.onError();
  }
  render() {
    if (this.state.crashed) return this.props.fallback;
    return this.props.children;
  }
}

export function ReaderPassCard() {
  const data = useReaderPassData();
  const [mode, setMode] = useState<Mode>("loading");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dimmed, setDimmed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { lang } = useLang();
  const isZh = lang === "zh";

  // Choose mode once the client is ready. Delay 3D mount until idle so
  // the guide-desk headline paints first.
  useEffect(() => {
    setMode(detectMode());
    setIsMobile(window.innerWidth < 640);
    const onResize = () => {
      setMode(detectMode());
      setIsMobile(window.innerWidth < 640);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (mode === "loading") return;
    const idle =
      (window as unknown as { requestIdleCallback?: (cb: () => void) => number })
        .requestIdleCallback ??
      ((cb: () => void) => window.setTimeout(cb, 400));
    const handle = idle(() => setMounted(true));
    return () => {
      if (typeof handle === "number") {
        window.clearTimeout(handle);
      }
    };
  }, [mode]);

  // First-session hint.
  useEffect(() => {
    if (!mounted) return;
    if (readHintSeen()) return;
    setShowHint(true);
    const t = window.setTimeout(() => {
      setShowHint(false);
      markHintSeen();
    }, 4500);
    return () => window.clearTimeout(t);
  }, [mounted]);

  // Fade out and unmount when the guide-desk hero has left ~65% of the
  // viewport. Re-mount when the user scrolls back.
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          setDimmed(entry.intersectionRatio < 0.35);
        }
      },
      { threshold: [0, 0.15, 0.35, 0.6, 1] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const onTap = useCallback(() => {
    setShowHint(false);
    markHintSeen();
    setDrawerOpen(true);
  }, []);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute z-20 transition-all duration-500 ease-out"
      onPointerDown={() => setExpanded(true)}
      style={
        isMobile
          ? {
              // Docked at the top-right corner, only ~28% of the card showing
              // until the reader taps or drags it out. Never covers the hero.
              top: "clamp(8px, 2vh, 28px)",
              right: 0,
              width: "min(78vw, 280px)",
              maxWidth: "min(78vw, 280px)",
              height: "min(112vw, 400px)",
              opacity: dimmed ? 0 : 1,
              transform: dimmed
                ? "scale(0.92)"
                : expanded
                  ? "translateX(-8px)"
                  : "translateX(72%)",
            }
          : {
              top: "clamp(8px, 3vh, 40px)",
              left: "clamp(2px, 0.6vw, 14px)",
              width: mode === "flat" ? "clamp(120px, 18vw, 172px)" : "clamp(180px, 16vw, 260px)",
              height: mode === "flat" ? "clamp(180px, 28vw, 260px)" : "clamp(280px, 52vh, 560px)",
              opacity: dimmed ? 0 : 1,
              transform: dimmed ? "scale(0.92)" : "scale(1)",
            }
      }
      aria-hidden={dimmed}
    >
      {mounted && !dimmed && mode === "three" ? (
        <ThreeErrorBoundary
          onError={() => setMode("flat")}
          fallback={
            <div className="pointer-events-auto flex h-full items-start justify-start">
              <ReaderPassFlat data={data} onOpen={onTap} />
            </div>
          }
        >
          <ReaderPassLanyard data={data} onTap={onTap} paused={dimmed} />
        </ThreeErrorBoundary>
      ) : mounted && !dimmed && mode === "flat" ? (
        <div className="pointer-events-auto flex h-full items-start justify-start">
          <ReaderPassFlat data={data} onOpen={onTap} />
        </div>
      ) : null}

      {showHint && (!isMobile || expanded) ? (
        <div
          className="pointer-events-none absolute right-2 top-full mt-3 w-max max-w-[62vw] sm:left-1/2 sm:right-auto sm:max-w-[240px] sm:-translate-x-1/2 rounded-full border border-gold-dust/40 bg-obsidian/85 px-4 py-2 text-center text-[10px] uppercase tracking-[0.28em] text-gold-light shadow-lg"
          role="status"
        >
          {isZh
            ? "拖动借阅证看看 · 点击打开馆内索引"
            : "Drag the pass · Tap to open the index"}
        </div>
      ) : null}

      <ReaderPassDrawer open={drawerOpen} onOpenChange={setDrawerOpen} data={data} />
    </div>
  );
}
