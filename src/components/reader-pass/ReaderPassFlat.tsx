/**
 * ReaderPassFlat — 2D fallback for the Reader's Pass. Rendered on
 * mobile, when prefers-reduced-motion is set, when saveData is on,
 * when WebGL is unavailable, or when the 3D Canvas crashes.
 *
 * Pointer-drag interaction: drag the card sideways, release, and it
 * swings back with a spring easing so the 2D card still feels physical
 * without a physics engine. Tap (no drag) opens the drawer.
 */
import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useLang } from "@/lib/i18n";
import type { ReaderPassData } from "./useReaderPassData";
import { useReaderPassSvg } from "./useReaderPassSvg";

type Props = {
  data: ReaderPassData;
  onOpen: () => void;
};

export function ReaderPassFlat({ data, onOpen }: Props) {
  const { lang } = useLang();
  const isZh = lang === "zh";
  const { frontUrl, backUrl } = useReaderPassSvg(data, isZh);
  const [flipped, setFlipped] = useState(false);
  const [offset, setOffset] = useState({ x: 0, rot: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; moved: boolean }>({
    startX: 0,
    startY: 0,
    moved: false,
  });

  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    dragRef.current = { startX: e.clientX, startY: e.clientY, moved: false };
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!dragging) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragRef.current.moved = true;
    setOffset({ x: dx * 0.55, rot: Math.max(-14, Math.min(14, dx * 0.08)) });
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!dragging) return;
    setDragging(false);
    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    } catch {
      /* noop */
    }
    setOffset({ x: 0, rot: 0 });
    if (!dragRef.current.moved) onOpen();
  };

  // Spring-back easing (cubic-bezier with slight overshoot) used only on release.
  const releaseTransition =
    "transform 900ms cubic-bezier(0.22, 1.4, 0.36, 1)";

  return (
    <div className="pointer-events-auto relative flex flex-col items-end gap-2">
      <button
        type="button"
        aria-label={isZh ? "打开我的借阅证" : "Open my reader's pass"}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onMouseEnter={() => setFlipped(true)}
        onMouseLeave={() => setFlipped(false)}
        className="group relative block h-[clamp(200px,36vw,300px)] w-[clamp(140px,24vw,200px)] cursor-grab touch-none select-none rounded-[18px] border border-gold-dust/25 bg-obsidian/50 p-0 shadow-[0_18px_40px_-14px_rgba(0,0,0,0.75)] active:cursor-grabbing"
        style={{
          perspective: "1200px",
          transform: `translateX(${offset.x}px) rotate(${offset.rot}deg)`,
          transformOrigin: "top center",
          transition: dragging ? "none" : releaseTransition,
          willChange: "transform",
        }}
      >
        <div
          className="relative h-full w-full transition-transform duration-700 ease-out"
          style={{
            transformStyle: "preserve-3d",
            transform: flipped ? "rotateY(180deg) rotate(-1deg)" : "rotateY(0deg) rotate(1deg)",
          }}
        >
          <FlatFace url={frontUrl} />
          <FlatFace url={backUrl} back />
        </div>
        {/* Cord stub that tilts with the drag to hint at the lanyard. */}
        <span
          aria-hidden
          className="absolute -top-6 left-1/2 h-6 w-[3px] rounded-full bg-gradient-to-b from-gold-dust/60 to-obsidian"
          style={{
            transform: `translateX(-50%) translateX(${-offset.x * 0.3}px) rotate(${-offset.rot * 0.4}deg)`,
            transformOrigin: "top center",
            transition: dragging ? "none" : releaseTransition,
          }}
        />
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
        <img
          src={url}
          alt=""
          className="h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <div className="h-full w-full animate-pulse bg-gradient-to-b from-obsidian/60 to-obsidian" />
      )}
    </div>
  );
}
