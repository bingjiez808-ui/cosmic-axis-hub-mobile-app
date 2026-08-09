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
  // Match the real "Life Timeline · 大运能量趋势" chart on /report:
  // a single golden energy line across the user's current decade with an
  // area gradient, dot markers, a dashed "此刻" cursor + tooltip, and a
  // yearly theme list underneath.
  const { lang } = useLang();
  const isZh = lang === "zh";

  const decadeStart = 20;
  const themesZh = [
    "播种 —— 安静的起点",
    "开门 —— 第一次机会",
    "扎根 —— 一项能力落地",
    "磨合 —— 阻力中习得的功课",
    "突破 —— 可见度上升",
    "收获 —— 被看见与回响",
    "巩固 —— 留下真正有用的",
    "剥离 —— 放下不再合身的",
    "转向 —— 方向悄然改变",
    "整合 —— 十年的收束",
  ];
  const themesEn = [
    "seeding — a quiet beginning",
    "opening — a first door",
    "learning — a skill takes root",
    "friction — a lesson through resistance",
    "breakthrough — visibility rises",
    "harvest — recognition and return",
    "consolidation — you keep what works",
    "shedding — release what no longer fits",
    "pivot — direction quietly changes",
    "integration — the decade completes",
  ];
  const themes = isZh ? themesZh : themesEn;
  const scores = [49, 52, 54, 49, 46, 55, 48, 51, 54, 50];
  const years = scores.map((s, i) => ({
    age: decadeStart + i,
    score: s,
    theme: themes[i],
  }));
  const nowIdx = 3; // age 23 — matches the tooltip in the real screenshot

  const W = 360;
  const H = 180;
  const padL = 26;
  const padR = 14;
  const padT = 18;
  const padB = 26;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const minS = Math.min(...scores) - 6;
  const maxS = Math.max(...scores) + 6;
  const span = Math.max(1, maxS - minS);
  const x = (i: number) => padL + (i / (years.length - 1)) * innerW;
  const y = (v: number) => padT + ((maxS - v) / span) * innerH;
  const linePath = years
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.score).toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L${x(years.length - 1).toFixed(1)},${H - padB} L${x(0).toFixed(1)},${H - padB} Z`;
  const nowP = { x: x(nowIdx), y: y(years[nowIdx].score) };
  const tipX = Math.min(W - padR - 148, Math.max(padL, nowP.x + 8));
  const tipY = Math.max(padT, nowP.y - 32);

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <p className="text-[10px] uppercase tracking-[0.28em] text-gold-dust/70">
          {isZh ? "生命时间轴 · 大运能量趋势" : "Life timeline · relative energy trend"}
        </p>
        <p className="text-[10px] uppercase tracking-[0.22em] text-stone-warm/45">
          {decadeStart}–{decadeStart + 9}
        </p>
      </div>
      <p className="text-[11px] leading-relaxed text-stone-warm/55">
        {isZh
          ? "仅为相对趋势，用于观察阶段变化，不代表绝对吉凶。"
          : "Relative trend only — for observing phase shifts, not absolute fortune."}
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="corridor-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#f5c26b" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#f5c26b" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((g) => (
          <line
            key={g}
            x1={padL}
            x2={W - padR}
            y1={padT + g * innerH}
            y2={padT + g * innerH}
            stroke="rgba(255,255,255,0.06)"
            strokeDasharray={g === 0.5 ? "3 4" : undefined}
          />
        ))}
        <line x1={padL} x2={W - padR} y1={H - padB} y2={H - padB} stroke="rgba(255,255,255,0.1)" />
        <motion.line
          x1={nowP.x}
          x2={nowP.x}
          y1={padT - 2}
          y2={H - padB}
          stroke="#f5c26b"
          strokeOpacity="0.5"
          strokeDasharray="3 4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.3, duration: 0.5 }}
        />
        <motion.path
          d={areaPath}
          fill="url(#corridor-area)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.6 }}
        />
        <motion.path
          d={linePath}
          fill="none"
          stroke="#f5c26b"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.4, ease: "easeInOut" }}
        />
        {years.map((p, i) => (
          <circle
            key={p.age}
            cx={x(i)}
            cy={y(p.score)}
            r={i === nowIdx ? 4 : 2.4}
            fill="#f5c26b"
            fillOpacity={i === nowIdx ? 1 : 0.7}
            style={i === nowIdx ? { filter: "drop-shadow(0 0 4px #f5c26b)" } : undefined}
          />
        ))}
        {years.map((p, i) => (
          <text
            key={p.age}
            x={x(i)}
            y={H - padB + 12}
            textAnchor="middle"
            fontSize="9"
            fill={i === nowIdx ? "#f5c26b" : "rgba(232,220,196,0.5)"}
          >
            {p.age}
          </text>
        ))}
        <motion.g
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.7, duration: 0.4 }}
        >
          <rect
            x={tipX}
            y={tipY}
            width="140"
            height="28"
            rx="4"
            fill="rgba(15,13,28,0.92)"
            stroke="rgba(245,194,107,0.4)"
          />
          <text x={tipX + 8} y={tipY + 11} fontSize="8" fill="rgba(245,194,107,0.85)">
            {isZh
              ? `${years[nowIdx].age} 岁 · 能量 ${years[nowIdx].score}`
              : `age ${years[nowIdx].age} · energy ${years[nowIdx].score}`}
          </text>
          <text x={tipX + 8} y={tipY + 22} fontSize="7.5" fill="rgba(232,220,196,0.7)">
            {years[nowIdx].theme}
          </text>
        </motion.g>
      </svg>

      <div className="grid grid-cols-1 gap-1 text-[11px] sm:grid-cols-2">
        {years.map((p, i) => (
          <div
            key={p.age}
            className={`flex items-center justify-between gap-2 rounded border px-2 py-1 ${
              i === nowIdx
                ? "border-gold-dust/40 bg-gold-dust/10 text-gold-light"
                : "border-white/5 bg-white/[0.02] text-stone-warm/70"
            }`}
          >
            <span className="shrink-0 tabular-nums text-stone-warm/55">
              {p.age}
              {isZh ? " 岁" : ""}
            </span>
            <span className="flex-1 truncate">{p.theme}</span>
            <span className="shrink-0 tabular-nums text-stone-warm/45">{p.score}</span>
          </div>
        ))}
      </div>
    </div>
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
