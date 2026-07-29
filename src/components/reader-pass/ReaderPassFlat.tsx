/**
 * ReaderPassFlat — 2D fallback for the Reader's Pass. Rendered on
 * mobile, when prefers-reduced-motion is set, when saveData is on,
 * when WebGL is unavailable, or when the 3D Canvas crashes.
 *
 * Reuses the SAME SVG texture generator as the 3D version so game
 * data and copy stay in sync. Adds a tiny hover/tilt so the card
 * still feels alive without a physics engine.
 */
import { useState } from "react";
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
  const { frontUrl } = useReaderPassSvg(data, isZh);
  const [flipped, setFlipped] = useState(false);
  const { backUrl } = useReaderPassSvg(data, isZh);

  return (
    <div className="pointer-events-auto relative flex flex-col items-end gap-2">
      <button
        type="button"
        aria-label={isZh ? "打开我的借阅证" : "Open my reader's pass"}
        onClick={onOpen}
        onMouseEnter={() => setFlipped(true)}
        onMouseLeave={() => setFlipped(false)}
        className="group relative block h-[clamp(260px,42vw,320px)] w-[clamp(180px,30vw,220px)] cursor-pointer select-none rounded-[18px] border border-gold-dust/25 bg-obsidian/50 p-0 shadow-[0_18px_40px_-14px_rgba(0,0,0,0.75)] transition-transform duration-500"
        style={{
          perspective: "1200px",
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
        {/* Thin cord stub to hint at the lanyard. */}
        <span
          aria-hidden
          className="absolute -top-6 left-1/2 h-6 w-[3px] -translate-x-1/2 rounded-full bg-gradient-to-b from-gold-dust/60 to-obsidian"
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
        // eslint-disable-next-line @next/next/no-img-element
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
