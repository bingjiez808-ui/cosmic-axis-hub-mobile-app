import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

/**
 * ElderCompanion — a floating "sage" avatar fixed in the bottom-left corner.
 * On idle it gently pulses; on click it opens a small speech bubble with a
 * rotating aphorism drawn from the four-tradition reading vocabulary. Purely
 * decorative interaction — no side-effects on the report data.
 */

const TIPS_ZH = [
  "四大体系 · 只是四面镜子。你才是被照见的人。",
  "命盘不是终点，它是你今日选择的地形图。",
  "『通道』先走，『警惕』后守 —— 顺序决定节奏。",
  "阅读得慢一点。金句藏在你多看一眼的段落里。",
  "同一颗星，落在不同人身上，会长出不同的果实。",
  "所谓吉凶，只是能量还未被你安放的位置。",
  "点开『查看详情』，那里是四体系的具体佐证。",
];

const TIPS_EN = [
  "Four traditions · four mirrors. You are the one being reflected.",
  "The chart is not a destination — it is today's terrain map.",
  "Take the channels first, guard the cautions second. Order sets the rhythm.",
  "Read slowly. The key line is hidden in the paragraph you almost skipped.",
  "The same star grows different fruit in different lives.",
  "Fortune and misfortune are only energies you have not yet placed.",
  "Open 'view detail' — that is where the four systems corroborate.",
];

export function ElderCompanion({ lang }: { lang: "en" | "zh" }) {
  const tips = lang === "zh" ? TIPS_ZH : TIPS_EN;
  const [open, setOpen] = useState(false);
  const [tipIdx, setTipIdx] = useState(() => Math.floor(Math.random() * tips.length));

  // Rotate the idle-state tip every ~14s so an ambient user notices a change.
  useEffect(() => {
    if (open) return;
    const id = setInterval(() => {
      setTipIdx((i) => (i + 1) % tips.length);
    }, 14000);
    return () => clearInterval(id);
  }, [open, tips.length]);

  const currentTip = useMemo(() => tips[tipIdx % tips.length], [tips, tipIdx]);

  return (
    <div className="pointer-events-none fixed bottom-6 left-4 z-40 flex items-end gap-3 print:hidden sm:bottom-8 sm:left-6">
      {/* Sage avatar — always visible, clickable */}
      <motion.button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) setTipIdx((i) => (i + 1) % tips.length);
        }}
        aria-label={lang === "zh" ? "智者" : "The elder"}
        className="pointer-events-auto relative grid size-16 place-items-center rounded-full border border-gold-dust/40 bg-obsidian/80 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.6)] backdrop-blur-md transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-light sm:size-20"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
      >
        {/* Halo */}
        <span
          className="absolute inset-0 rounded-full animate-pulse-gold"
          style={{
            background:
              "radial-gradient(circle at 50% 40%, color-mix(in oklab, var(--gold-dust) 45%, transparent) 0%, transparent 65%)",
          }}
          aria-hidden="true"
        />
        {/* Face — a stylised SVG sage silhouette */}
        <svg viewBox="0 0 64 64" className="relative size-11 sm:size-14" aria-hidden="true">
          <defs>
            <linearGradient id="sage-robe" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="color-mix(in oklab, var(--gold-light) 80%, transparent)" />
              <stop offset="100%" stopColor="color-mix(in oklab, var(--gold-dust) 20%, transparent)" />
            </linearGradient>
          </defs>
          {/* Robe */}
          <path
            d="M12 60 C 16 44, 20 38, 32 38 C 44 38, 48 44, 52 60 Z"
            fill="url(#sage-robe)"
            opacity="0.85"
          />
          {/* Beard */}
          <path
            d="M22 34 C 24 46, 28 52, 32 54 C 36 52, 40 46, 42 34 Z"
            fill="color-mix(in oklab, var(--stone-warm) 85%, transparent)"
            opacity="0.9"
          />
          {/* Head */}
          <circle cx="32" cy="26" r="9" fill="color-mix(in oklab, var(--gold-light) 70%, transparent)" />
          {/* Hat / hood */}
          <path
            d="M20 26 C 22 14, 30 10, 32 10 C 34 10, 42 14, 44 26 Z"
            fill="color-mix(in oklab, var(--nebula-purple) 60%, transparent)"
          />
          {/* Star on hat */}
          <path
            d="M32 15 l1 2.5 l2.6 0.3 l-1.9 1.8 l0.5 2.6 l-2.2 -1.3 l-2.2 1.3 l0.5 -2.6 l-1.9 -1.8 l2.6 -0.3 z"
            fill="var(--gold-light)"
          />
          {/* Eyes */}
          <circle cx="29" cy="26" r="0.9" fill="var(--obsidian)" />
          <circle cx="35" cy="26" r="0.9" fill="var(--obsidian)" />
        </svg>
        {/* Idle "listening" dot */}
        <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-gold-light shadow-[0_0_8px_var(--gold-light)] animate-pulse-gold" />
      </motion.button>

      {/* Speech bubble */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="bubble"
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            className="pointer-events-auto relative mb-2 max-w-[74vw] rounded-2xl border border-gold-dust/30 bg-obsidian/90 px-4 py-3 pr-8 shadow-2xl backdrop-blur-md sm:max-w-xs"
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-2 top-2 rounded-full p-1 text-stone-warm/60 hover:text-gold-light"
              aria-label="close"
            >
              <X size={12} />
            </button>
            <p className="mb-1 text-[9px] uppercase tracking-[0.32em] text-gold-dust/80">
              {lang === "zh" ? "智者 · 一句话" : "The elder whispers"}
            </p>
            <p className="font-serif text-[13px] italic leading-relaxed text-stone-warm/95">
              {currentTip}
            </p>
            <button
              type="button"
              onClick={() => setTipIdx((i) => (i + 1) % tips.length)}
              className="mt-2 text-[10px] uppercase tracking-[0.28em] text-gold-dust/70 transition-colors hover:text-gold-light"
            >
              {lang === "zh" ? "再听一句 →" : "One more →"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
