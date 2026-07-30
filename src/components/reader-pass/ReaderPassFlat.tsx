/**
 * ReaderPassFlat — 2D fallback for the Reader's Pass.
 *
 * Full 2D pointer drag on both axes with a spring-back release that
 * simulates gravity: after release the card overshoots slightly on Y,
 * then settles. Tap (no drag) opens the drawer.
 */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useLang } from "@/lib/i18n";
import type { ReaderPassData } from "./useReaderPassData";
import { useReaderPassSvg } from "./useReaderPassSvg";

type Props = {
  data: ReaderPassData;
  onOpen: () => void;
};

type Offset = { x: number; y: number; rot: number };

export function ReaderPassFlat({ data, onOpen }: Props) {
  const { lang } = useLang();
  const isZh = lang === "zh";
  const { frontUrl, backUrl } = useReaderPassSvg(data, isZh);
  const [flipped, setFlipped] = useState(false);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0, rot: 0 });
  const [dragging, setDragging] = useState(false);
  const [settling, setSettling] = useState<"none" | "bounce" | "rest">("none");
  const dragRef = useRef<{ startX: number; startY: number; moved: boolean }>({
    startX: 0,
    startY: 0,
    moved: false,
  });
  const settleTimer = useRef<number | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const clearSettle = () => {
    if (settleTimer.current !== null) {
      window.clearTimeout(settleTimer.current);
      settleTimer.current = null;
    }
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    clearSettle();
    setSettling("none");
    dragRef.current = { startX: e.clientX, startY: e.clientY, moved: false };
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!dragging) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) dragRef.current.moved = true;
    // Horizontal: follow with a damped factor + small rotation for a pendulum feel.
    // Vertical: down easier than up (gravity feel), clamped so it doesn't run away.
    const px = dx * 0.55;
    const py = dy > 0 ? Math.min(dy * 0.7, 180) : Math.max(dy * 0.35, -80);
    setOffset({
      x: px,
      y: py,
      rot: Math.max(-16, Math.min(16, dx * 0.09 - dy * 0.02)),
    });
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!dragging) return;
    setDragging(false);
    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    } catch {
      /* noop */
    }
    if (!dragRef.current.moved) {
      // Tap (< 6px travel) flips the pass in place; drags never flip.
      setOffset({ x: 0, y: 0, rot: 0 });
      setFlipped((v) => !v);
      return;
    }
    // Two-stage settle: quick overshoot (bounce) then a soft rest, so the
    // card feels like it swings past origin under gravity, then relaxes.
    const overshootY = offset.y > 0 ? -12 : 6;
    const overshootRot = offset.rot * -0.25;
    setSettling("bounce");
    setOffset({ x: 0, y: overshootY, rot: overshootRot });
    settleTimer.current = window.setTimeout(() => {
      setSettling("rest");
      setOffset({ x: 0, y: 0, rot: 0 });
      settleTimer.current = window.setTimeout(() => setSettling("none"), 420);
    }, 340);
  };

  const releaseTransition =
    settling === "bounce"
      ? "transform 340ms cubic-bezier(0.34, 1.56, 0.64, 1)"
      : "transform 420ms cubic-bezier(0.22, 1, 0.36, 1)";

  return (
    <div className="pointer-events-auto relative flex flex-col items-start gap-2">
      <button
        type="button"
        aria-label={
          flipped
            ? isZh
              ? "查看借阅证正面"
              : "View the front of the reader's pass"
            : isZh
              ? "查看借阅证背面"
              : "View the back of the reader's pass"
        }
        aria-pressed={flipped}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setFlipped((v) => !v);
          }
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="group relative block cursor-grab touch-none select-none rounded-[18px] border border-gold-dust/25 bg-obsidian/50 p-0 shadow-[0_18px_40px_-14px_rgba(0,0,0,0.75)] active:cursor-grabbing"
        style={{
          width: "clamp(92px, 20vw, 168px)",
          aspectRatio: "0.7",
          perspective: "1200px",
          transform: `translate3d(${offset.x}px, ${offset.y}px, 0) rotate(${offset.rot}deg)`,
          transformOrigin: "top center",
          transition: dragging ? "none" : releaseTransition,
          willChange: "transform",
        }}
      >
        <div
          className="library-card relative h-full w-full"
          data-flipped={flipped ? "true" : "false"}
          style={{
            transformStyle: "preserve-3d",
            transition: reducedMotion
              ? "opacity 220ms ease"
              : "transform 600ms cubic-bezier(.2,.75,.25,1)",
            transform: reducedMotion
              ? undefined
              : flipped
                ? "rotateY(180deg) rotate(-1deg)"
                : "rotateY(0deg) rotate(1deg)",
          }}
        >
          {reducedMotion ? (
            <FlatFace url={flipped ? backUrl : frontUrl} />
          ) : (
            <>
              <FlatFace url={frontUrl} />
              <FlatFace url={backUrl} back />
            </>
          )}
        </div>
        {/* Cord stub that swings with the card. */}
        <span
          aria-hidden
          className="absolute -top-6 left-1/2 h-6 w-[3px] rounded-full bg-gradient-to-b from-gold-dust/60 to-obsidian"
          style={{
            transform: `translateX(-50%) translateX(${-offset.x * 0.3}px) translateY(${-Math.max(0, offset.y * 0.15)}px) rotate(${-offset.rot * 0.4}deg)`,
            transformOrigin: "top center",
            transition: dragging ? "none" : releaseTransition,
          }}
        />
      </button>
      <button
        type="button"
        onClick={onOpen}
        className="hidden rounded-full border border-gold-dust/30 sm:inline-flex bg-obsidian/70 px-3 py-1 text-[9px] uppercase tracking-[0.24em] text-gold-light/80 transition hover:border-gold-dust/60"
      >
        {isZh ? "馆内索引" : "Library index"}
      </button>
    </div>
  );
}

function FlatFace({ url, back }: { url: string; back?: boolean }) {
  return (
    <div
      className="absolute inset-0 overflow-hidden rounded-[18px]"
      style={{
        backfaceVisibility: "hidden",
        transform: back ? "rotateY(180deg)" : undefined,
      }}
    >
      {url ? (
        <img src={url} alt="" className="h-full w-full object-cover" draggable={false} />
      ) : (
        <div className="h-full w-full animate-pulse bg-gradient-to-b from-obsidian/60 to-obsidian" />
      )}
    </div>
  );
}
