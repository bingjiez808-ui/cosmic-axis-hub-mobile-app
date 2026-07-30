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
  if (window.innerWidth < 900) return "flat";
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
    setIsMobile(window.innerWidth < 768);
    const onResize = () => {
      setMode(detectMode());
      setIsMobile(window.innerWidth < 768);
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

  // Below 768px the pass never hangs beside the hero title: it collapses into
  // a small corner "pass" chip that opens the full card inside the drawer.
  if (isMobile) {
    return (
      <div ref={containerRef} className="absolute right-3 top-3 z-20">
        <button
          type="button"
          onClick={onTap}
          aria-label={isZh ? "打开借阅证" : "Open reader pass"}
          className="flex min-h-[40px] items-center gap-2 rounded-full border border-emerald-300/40 bg-emerald-950/70 px-3 py-1.5 text-[11px] tracking-[0.18em] text-emerald-100 backdrop-blur-md"
        >
          <span
            aria-hidden
            className="block h-4 w-3 rounded-[2px] border border-emerald-300/60 bg-emerald-800/80"
          />
          <span className="whitespace-nowrap">{isZh ? "借阅证" : "Pass"}</span>
        </button>
        <ReaderPassDrawer open={drawerOpen} onOpenChange={setDrawerOpen} data={data} />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute z-20 transition-all duration-500 ease-out"
      onPointerDown={() => setExpanded(true)}
      style={{
        top: "clamp(92px, 12vh, 150px)",
        left: "clamp(24px, 4vw, 72px)",
        width:
          mode === "flat"
            ? "clamp(110px, 13vw, 168px)"
            : "clamp(150px, 14vw, 240px)",
        maxWidth: "22vw",
        height:
          mode === "flat"
            ? "clamp(170px, 22vw, 250px)"
            : "clamp(260px, 46vh, 520px)",
        opacity: dimmed ? 0 : 1,
        transform: dimmed ? "scale(0.92)" : "scale(1)",
      }}
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

      {showHint ? (
        <div
          className="pointer-events-none absolute left-1/2 top-full mt-3 w-max max-w-[240px] -translate-x-1/2 rounded-full border border-gold-dust/40 bg-obsidian/85 px-4 py-2 text-center text-[10px] uppercase tracking-[0.28em] text-gold-light shadow-lg"
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

