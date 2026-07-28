/**
 * RoomPreviewModal — lightweight demo/preview dialog shown when a user
 * clicks a card in PostRitualRoomsSection. Never navigates on its own;
 * shows an animated visual + short description, and delegates the real
 * "open the room" action to the caller (which uses resolveCta).
 */

import * as Dialog from "@radix-ui/react-dialog";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { ctaMicroCopy, type CtaState } from "@/lib/home-cta";

export type RoomPreviewKind = "corridor" | "verification" | "second-witness" | "private";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kind: RoomPreviewKind;
  titleZh: string;
  titleEn: string;
  answersZh: string;
  answersEn: string;
  ctaHref: string | null;
  ctaState: CtaState;
  ctaLabelZh: string;
  ctaLabelEn: string;
  targetLabelZh: string;
  targetLabelEn: string;
};

function CorridorDemo() {
  const lines = [
    { color: "#f5c26b", d: "M0,70 C60,50 120,80 180,55 C240,35 300,60 360,45" },
    { color: "#a3b8ff", d: "M0,90 C60,75 120,100 180,80 C240,55 300,90 360,70" },
    { color: "#c7a3ff", d: "M0,55 C60,80 120,45 180,70 C240,90 300,55 360,85" },
    { color: "#7dd3c0", d: "M0,110 C60,95 120,120 180,100 C240,80 300,115 360,95" },
  ];
  return (
    <svg viewBox="0 0 360 160" className="w-full">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <line key={i} x1={i * 60} y1="0" x2={i * 60} y2="160" stroke="rgba(255,255,255,0.05)" />
      ))}
      {lines.map((l, i) => (
        <motion.path
          key={i}
          d={l.d}
          fill="none"
          stroke={l.color}
          strokeWidth="1.5"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.85 }}
          transition={{ duration: 1.6, delay: i * 0.15, ease: "easeInOut" }}
        />
      ))}
      <motion.circle
        cx="180"
        cy="70"
        r="4"
        fill="#f5c26b"
        initial={{ scale: 0 }}
        animate={{ scale: [0, 1.4, 1] }}
        transition={{ duration: 1.2, delay: 1.6 }}
      />
    </svg>
  );
}

function VerificationDemo() {
  const marks = [
    { x: 40, y: 60, kind: "yes" },
    { x: 100, y: 90, kind: "partial" },
    { x: 160, y: 50, kind: "yes" },
    { x: 220, y: 100, kind: "no" },
    { x: 280, y: 70, kind: "yes" },
  ];
  const color = (k: string) =>
    k === "yes" ? "#7dd3c0" : k === "partial" ? "#f5c26b" : k === "no" ? "#e07272" : "#8a8a8a";
  return (
    <svg viewBox="0 0 360 160" className="w-full">
      <line x1="20" y1="130" x2="340" y2="130" stroke="rgba(255,255,255,0.15)" />
      {marks.map((m, i) => (
        <g key={i}>
          <motion.line
            x1={m.x + 20}
            y1="130"
            x2={m.x + 20}
            y2={m.y}
            stroke={color(m.kind)}
            strokeOpacity="0.6"
            strokeDasharray="3 3"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.2 + i * 0.15, duration: 0.6 }}
          />
          <motion.circle
            cx={m.x + 20}
            cy={m.y}
            r="7"
            fill={color(m.kind)}
            fillOpacity="0.25"
            stroke={color(m.kind)}
            strokeWidth="1.5"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.4 + i * 0.15, type: "spring", stiffness: 200 }}
          />
        </g>
      ))}
    </svg>
  );
}

function TarotDemo() {
  const cards = [
    { rot: -8, x: 90, label: "☉" },
    { rot: 0, x: 170, label: "✦" },
    { rot: 8, x: 250, label: "☾" },
  ];
  return (
    <svg viewBox="0 0 360 160" className="w-full">
      {cards.map((c, i) => (
        <motion.g
          key={i}
          initial={{ y: -30, opacity: 0, rotate: c.rot - 20 }}
          animate={{ y: 0, opacity: 1, rotate: c.rot }}
          transition={{ delay: i * 0.25, type: "spring", stiffness: 120 }}
          style={{ transformOrigin: `${c.x + 20}px 80px` }}
        >
          <rect
            x={c.x}
            y="30"
            width="40"
            height="100"
            rx="4"
            fill="#0f0d1c"
            stroke="#f5c26b"
            strokeWidth="1"
          />
          <rect
            x={c.x + 4}
            y="34"
            width="32"
            height="92"
            rx="2"
            fill="none"
            stroke="#f5c26b"
            strokeOpacity="0.3"
          />
          <text
            x={c.x + 20}
            y="86"
            textAnchor="middle"
            fill="#f5c26b"
            fontSize="20"
            fontFamily="serif"
          >
            {c.label}
          </text>
        </motion.g>
      ))}
    </svg>
  );
}

function PrivateRoomDemo() {
  return (
    <svg viewBox="0 0 360 160" className="w-full">
      <defs>
        <radialGradient id="lamp" cx="50%" cy="30%" r="60%">
          <stop offset="0%" stopColor="#f5c26b" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#f5c26b" stopOpacity="0" />
        </radialGradient>
      </defs>
      <motion.rect
        x="0"
        y="0"
        width="360"
        height="160"
        fill="url(#lamp)"
        animate={{ opacity: [0.6, 0.9, 0.6] }}
        transition={{ duration: 3, repeat: Infinity }}
      />
      {/* bookshelf */}
      {[0, 1, 2].map((r) => (
        <g key={r}>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((b) => (
            <rect
              key={b}
              x={20 + b * 40}
              y={20 + r * 40}
              width={6 + (b % 3) * 3}
              height={30}
              fill={b % 2 === 0 ? "#5a4a7a" : "#7a5c4a"}
              opacity="0.7"
            />
          ))}
          <line
            x1="15"
            y1={54 + r * 40}
            x2="345"
            y2={54 + r * 40}
            stroke="#f5c26b"
            strokeOpacity="0.3"
          />
        </g>
      ))}
      <motion.circle
        cx="180"
        cy="20"
        r="6"
        fill="#f5c26b"
        animate={{ opacity: [0.8, 1, 0.8] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
    </svg>
  );
}

function Demo({ kind }: { kind: RoomPreviewKind }) {
  const map = {
    corridor: <CorridorDemo />,
    verification: <VerificationDemo />,
    "second-witness": <TarotDemo />,
    private: <PrivateRoomDemo />,
  };
  return (
    <div className="relative overflow-hidden rounded-xl border border-gold-dust/20 bg-gradient-to-br from-obsidian/80 via-[#141028]/90 to-obsidian/80 p-4">
      {map[kind]}
    </div>
  );
}

export function RoomPreviewModal(props: Props) {
  const { lang } = useLang();
  const isZh = lang === "zh";
  const title = isZh ? props.titleZh : props.titleEn;
  const answers = isZh ? props.answersZh : props.answersEn;
  const ctaLabel = isZh ? props.ctaLabelZh : props.ctaLabelEn;
  const micro = ctaMicroCopy(
    props.ctaState,
    { zh: props.targetLabelZh, en: props.targetLabelEn },
    isZh,
  );

  return (
    <Dialog.Root open={props.open} onOpenChange={props.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[81] w-[min(94vw,560px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-gold-dust/25 bg-obsidian/95 p-5 shadow-2xl sm:p-7 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
                {isZh ? "示例预览" : "Preview demo"}
              </p>
              <Dialog.Title className="mt-2 font-serif text-xl leading-snug text-stone-warm sm:text-2xl">
                {title}
              </Dialog.Title>
            </div>
            <Dialog.Close
              aria-label={isZh ? "关闭" : "Close"}
              className="rounded-full border border-white/10 p-1.5 text-stone-warm/60 hover:border-gold-dust/40 hover:text-gold-dust"
            >
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          <div className="mt-4">
            <Demo kind={props.kind} />
          </div>

          <Dialog.Description asChild>
            <p className="mt-4 text-sm italic leading-relaxed text-stone-warm/75">{answers}</p>
          </Dialog.Description>

          <p className="mt-2 text-[11px] leading-relaxed text-stone-warm/50">
            {isZh
              ? "以上为示例演示。真实内容会根据你的主命盘生成，并在对应藏室中呈现。"
              : "This is a sample demo. Real content is generated from your primary chart inside the room."}
          </p>

          <div className="mt-5 flex flex-col-reverse gap-2 border-t border-white/5 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-[11px] leading-relaxed text-stone-warm/55">{micro}</span>
            {props.ctaHref && (
              <Link
                to={props.ctaHref}
                onClick={() => props.onOpenChange(false)}
                className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-gold-dust/50 bg-gold-dust/10 px-5 py-2.5 text-[11px] uppercase tracking-[0.28em] text-gold-light transition hover:bg-gold-dust/20"
              >
                {ctaLabel}
              </Link>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
