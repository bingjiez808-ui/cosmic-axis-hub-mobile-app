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
  // Life-lines chart: six domain trajectories across an age axis with a
  // "today" cursor. Reads as a real polyline chart, not four decorative arcs.
  const W = 360;
  const H = 180;
  const padL = 34;
  const padR = 14;
  const padT = 14;
  const padB = 30;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const ages = [0, 15, 30, 45, 60, 75];
  const domains: { key: string; labelZh: string; labelEn: string; color: string; samples: number[] }[] = [
    { key: "career", labelZh: "事业", labelEn: "Career", color: "#f5c26b", samples: [0.32, 0.52, 0.8, 0.72, 0.55, 0.42] },
    { key: "health", labelZh: "健康", labelEn: "Health", color: "#7dd3c0", samples: [0.62, 0.74, 0.6, 0.5, 0.6, 0.7] },
    { key: "love", labelZh: "爱情", labelEn: "Love", color: "#c7a3ff", samples: [0.48, 0.7, 0.74, 0.66, 0.55, 0.46] },
    { key: "family", labelZh: "家庭", labelEn: "Family", color: "#f88fa2", samples: [0.4, 0.58, 0.5, 0.64, 0.72, 0.6] },
    { key: "study", labelZh: "学业", labelEn: "Study", color: "#8ab8ff", samples: [0.72, 0.8, 0.6, 0.46, 0.38, 0.34] },
    { key: "wealth", labelZh: "财富", labelEn: "Wealth", color: "#e6d27a", samples: [0.28, 0.44, 0.6, 0.74, 0.68, 0.58] },
  ];
  const x = (i: number) => padL + (i / (ages.length - 1)) * innerW;
  const y = (v: number) => padT + (1 - v) * innerH;
  const pathFor = (s: number[]) =>
    s.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const { lang } = useLang();
  const isZh = lang === "zh";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {/* horizontal gridlines */}
      {[0, 0.25, 0.5, 0.75, 1].map((g) => (
        <line
          key={g}
          x1={padL}
          x2={W - padR}
          y1={y(g)}
          y2={y(g)}
          stroke={g === 0.5 ? "rgba(245,194,107,0.18)" : "rgba(255,255,255,0.06)"}
          strokeDasharray={g === 0.5 ? "3 4" : undefined}
        />
      ))}
      {/* y axis marks */}
      {[0, 50, 100].map((v) => (
        <text
          key={v}
          x={padL - 6}
          y={y(v / 100)}
          textAnchor="end"
          dominantBaseline="middle"
          fontSize="8"
          fill="rgba(232,220,196,0.45)"
        >
          {v}
        </text>
      ))}
      {/* x axis ticks */}
      {ages.map((a, i) => (
        <g key={a}>
          <line x1={x(i)} x2={x(i)} y1={H - padB} y2={H - padB + 3} stroke="rgba(255,255,255,0.15)" />
          <text x={x(i)} y={H - padB + 12} textAnchor="middle" fontSize="9" fill="rgba(232,220,196,0.55)">
            {a}
          </text>
        </g>
      ))}
      <text
        x={W - padR}
        y={H - 4}
        textAnchor="end"
        fontSize="8"
        fill="rgba(232,220,196,0.4)"
      >
        {isZh ? "年龄" : "age"}
      </text>
      {/* life lines */}
      {domains.map((d, i) => (
        <motion.path
          key={d.key}
          d={pathFor(d.samples)}
          fill="none"
          stroke={d.color}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.9 }}
          transition={{ duration: 1.6, delay: i * 0.12, ease: "easeInOut" }}
        />
      ))}
      {/* "today" cursor at age 30 */}
      <motion.line
        x1={x(2)}
        x2={x(2)}
        y1={padT}
        y2={H - padB}
        stroke="#f5c26b"
        strokeOpacity="0.55"
        strokeDasharray="3 3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4, duration: 0.6 }}
      />
      <motion.circle
        cx={x(2)}
        cy={y(0.8)}
        r="4"
        fill="#f5c26b"
        initial={{ scale: 0 }}
        animate={{ scale: [0, 1.4, 1] }}
        transition={{ duration: 1, delay: 1.6 }}
        style={{ filter: "drop-shadow(0 0 4px #f5c26b)" }}
      />
      <text
        x={x(2)}
        y={padT + 8}
        textAnchor="middle"
        fontSize="8"
        fill="#f5c26b"
      >
        {isZh ? "此刻" : "today"}
      </text>
      {/* legend */}
      <g>
        {domains.map((d, i) => {
          const col = i % 3;
          const row = Math.floor(i / 3);
          const lx = padL + col * 100;
          const ly = padT - 4 + row * 0; // legend sits above; use two rows if needed
          return (
            <g key={d.key} transform={`translate(${lx}, ${ly})`}>
              <circle cx={0} cy={0} r={2.4} fill={d.color} />
              <text x={6} y={2.6} fontSize="7.5" fill="rgba(232,220,196,0.7)">
                {isZh ? d.labelZh : d.labelEn}
              </text>
            </g>
          );
        })}
      </g>
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
