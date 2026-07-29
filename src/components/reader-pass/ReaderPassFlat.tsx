/**
 * ReaderPassFlat — 2D fallback for the Reader's Pass. Rendered on
 * mobile, when prefers-reduced-motion is set, when saveData is on,
 * when WebGL is unavailable, or when the 3D Canvas crashes.
 *
 * Includes a pointer-drag interaction: drag the card sideways, release
 * and it swings back with a damped spring so the 2D card still feels
 * physical without a physics engine.
 */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useLang } from "@/lib/i18n";
import type { ReaderPassData } from "./useReaderPassData";
import { useReaderPassSvg } from "./useReaderPassSvg";

type Props = {
  data: ReaderPassData;
  onOpen: () => void;
};

// Simple critically-damped-ish spring loop returning to (0,0).
function useSpringBack(target: { x: number; rot: number }, setTarget: (v: { x: number; rot: number }) => void) {
  const rafRef = useRef<number | null>(null);
  const velRef = useRef({ x: 0, rot: 0 });
  const runningRef = useRef(false);

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const start = () => {
    if (runningRef.current) return;
    runningRef.current = true;
    const stiffness = 0.18;
    const damping = 0.72;
    let last = performance.now();
    const step = (t: number) => {
      const dt = Math.min(32, t - last) / 16;
      last = t;
      // read latest state via functional update
      setTarget((current) => {
        const ax = -current.x * stiffness;
        const arot = -current.rot * stiffness;
        velRef.current.x = (velRef.current.x + ax) * damping;
        velRef.current.rot = (velRef.current.rot + arot) * damping;
        const nx = current.x + velRef.current.x * dt;
        const nrot = current.rot + velRef.current.rot * dt;
        if (Math.abs(nx) < 0.3 && Math.abs(nrot) < 0.05 && Math.abs(velRef.current.x) < 0.3) {
          runningRef.current = false;
          velRef.current = { x: 0, rot: 0 };
          return { x: 0, rot: 0 };
        }
        rafRef.current = requestAnimationFrame(step);
        return { x: nx, rot: nrot };
      } as unknown as { x: number; rot: number });
    };
    rafRef.current = requestAnimationFrame(step);
  };

  return { start, velRef };
}

export function ReaderPassFlat({ data, onOpen }: Props) {
  const { lang } = useLang();
  const isZh = lang === "zh";
  const { frontUrl, backUrl } = useReaderPassSvg(data, isZh);
  const [flipped, setFlipped] = useState(false);
  const [offset, setOffset] = useState<{ x: number; rot: number }>({ x: 0, rot: 0 });
  // Wrap setter to accept function too.
  const setOffsetAny = (v: { x: number; rot: number } | ((c: { x: number; rot: number }) => { x: number; rot: number })) => {
    setOffset(typeof v === "function" ? (v as (c: { x: number; rot: number }) => { x: number; rot: number }) : () => v);
  };
  const dragRef = useRef<{ active: boolean; startX: number; startY: number; moved: boolean; pointerId: number | null }>({
    active: false,
    startX: 0,
    startY: 0,
    moved: false,
    pointerId: null,
  });
  const { start } = useSpringBack(offset, setOffsetAny);

  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    dragRef.current = { active: true, startX: e.clientX, startY: e.clientY, moved: false, pointerId: e.pointerId };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d.active) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) d.moved = true;
    setOffset({ x: dx * 0.55, rot: Math.max(-14, Math.min(14, dx * 0.08)) });
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d.active) return;
    d.active = false;
    try { e.currentTarget.releasePointerCapture?.(e.pointerId); } catch { /* noop */ }
    // spring back
    start();
    // tap (no meaningful movement) opens the drawer
    if (!d.moved) {
      onOpen();
    }
  };

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
          transition: dragRef.current.active ? "none" : undefined,
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
        {/* Cord stub that stretches/tilts with drag to hint at the lanyard. */}
        <span
          aria-hidden
          className="absolute -top-6 left-1/2 h-6 w-[3px] rounded-full bg-gradient-to-b from-gold-dust/60 to-obsidian"
          style={{
            transform: `translateX(-50%) translateX(${-offset.x * 0.3}px) rotate(${-offset.rot * 0.4}deg)`,
            transformOrigin: "top center",
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
