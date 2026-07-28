/**
 * PostRitualRoomsSection — "仪式之后，图书馆会为你打开四间特别藏室"
 *
 * Cards no longer navigate directly. Clicking a card (or its CTA button)
 * opens a lightweight RoomPreviewModal showing an animated demo of what
 * lives inside. The modal has the real "open the room" button — routed
 * through resolveCta — so the "how to unlock" logic (sign-in → ritual →
 * open chart) stays in one place.
 *
 * Above the grid we show a live status banner telling the visitor how
 * to unlock these rooms, with a single direct CTA that jumps to the
 * right next step (sign in / start ritual / open personal library).
 */

import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

import {
  accessTagLabel,
  accessTagTooltip,
  resolveCta,
  type AccessTag,
} from "@/lib/home-cta";
import { useLang } from "@/lib/i18n";
import { useSupabaseSession } from "@/lib/session";
import { listUserCharts } from "@/lib/reports-store.functions";
import { useMembershipTier } from "@/lib/use-membership-tier";
import { RoomPreviewModal, type RoomPreviewKind } from "./RoomPreviewModal";

type RoomDef = {
  id: RoomPreviewKind;
  target: string;
  requiresTier?: "sage" | "oracle";
  accessTag: AccessTag;
  titleZh: string;
  titleEn: string;
  taglineZh: string;
  taglineEn: string;
  answersZh: string;
  answersEn: string;
  targetLabelZh: string;
  targetLabelEn: string;
  ctaZh: string;
  ctaEn: string;
  accent: string; // border/glow tint
};

const ROOMS: RoomDef[] = [
  {
    id: "corridor",
    target: "/report#life-timeline",
    accessTag: "basic",
    titleZh: "时间回廊",
    titleEn: "Time Corridor",
    taglineZh: "六条并行的生命曲线，随年龄流动。",
    taglineEn: "Six life lines flowing across the years.",
    answersZh: "「不同年龄，我的事业、学业、关系、财富、家庭与健康会经历什么？」",
    answersEn: "\"What does each age hold for study, career, love, wealth, family and health?\"",
    targetLabelZh: "时间回廊",
    targetLabelEn: "the Time Corridor",
    ctaZh: "打开时间回廊",
    ctaEn: "Open the corridor",
    accent: "#f5c26b",
  },
  {
    id: "verification",
    target: "/report#key-events",
    accessTag: "basic",
    titleZh: "验证档案室",
    titleEn: "Verification Archive",
    taglineZh: "把命盘讲的事，一件件对回过往。",
    taglineEn: "Check what the chart says against your past.",
    answersZh: "「命盘对我过去发生的事，说得对吗？」",
    answersEn: "\"Does the chart actually describe what already happened in my life?\"",
    targetLabelZh: "验证档案室",
    targetLabelEn: "the Verification Archive",
    ctaZh: "开始反向验证",
    ctaEn: "Start reverse-check",
    accent: "#7dd3c0",
  },
  {
    id: "second-witness",
    target: "/report#tarot",
    accessTag: "basic",
    titleZh: "第二证人室",
    titleEn: "Second Witness",
    taglineZh: "三张塔罗与命盘并列作证。",
    taglineEn: "Three cards read alongside the chart.",
    answersZh: "「命盘讲长期结构，那么此刻这个具体问题呢？」",
    answersEn: "\"The chart speaks in long arcs — what about this one question, right now?\"",
    targetLabelZh: "第二证人室",
    targetLabelEn: "the Second Witness",
    ctaZh: "召唤三张卡",
    ctaEn: "Draw three cards",
    accent: "#c7a3ff",
  },
  {
    id: "private",
    target: "/me/sage",
    requiresTier: "sage",
    accessTag: "sage",
    titleZh: "私人阅览室",
    titleEn: "Private Reading Room",
    taglineZh: "贤者聚焦当下，神谕者展开全年。",
    taglineEn: "Sage for the near term, Oracle for the year.",
    answersZh: "「我想要更深、更长时间的私人阅读，能不能拥有一个属于自己的阅览角落？」",
    answersEn: "\"Can I have a private, deeper, longer reading room of my own?\"",
    targetLabelZh: "私人阅览室",
    targetLabelEn: "the Private Reading Room",
    ctaZh: "预览私人阅览室",
    ctaEn: "Preview the reading room",
    accent: "#f5c26b",
  },
];

function AccessChip({ tag, isZh }: { tag: AccessTag; isZh: boolean }) {
  const tone =
    tag === "basic"
      ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
      : tag === "sage"
        ? "border-gold-dust/40 bg-gold-dust/10 text-gold-light"
        : "border-nebula-purple/40 bg-nebula-purple/15 text-stone-warm";
  return (
    <span
      title={accessTagTooltip(tag, isZh)}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.24em] ${tone}`}
    >
      <span aria-hidden className="h-1 w-1 rounded-full bg-current" />
      {accessTagLabel(tag, isZh)}
    </span>
  );
}

/** Tiny per-card visual — a stylised, quiet SVG loop themed to the room. */
function CardVisual({ kind, accent }: { kind: RoomPreviewKind; accent: string }) {
  if (kind === "corridor") {
    return (
      <svg viewBox="0 0 200 80" className="h-full w-full">
        {[0, 1, 2, 3].map((i) => (
          <motion.path
            key={i}
            d={`M0,${20 + i * 12} C50,${10 + i * 12} 100,${30 + i * 10} 150,${18 + i * 12} L200,${22 + i * 12}`}
            fill="none"
            stroke={accent}
            strokeOpacity={0.5 - i * 0.08}
            strokeWidth="1.2"
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.4, delay: i * 0.15 }}
          />
        ))}
      </svg>
    );
  }
  if (kind === "verification") {
    return (
      <svg viewBox="0 0 200 80" className="h-full w-full">
        <line x1="0" y1="70" x2="200" y2="70" stroke="rgba(255,255,255,0.15)" />
        {[20, 60, 100, 140, 180].map((x, i) => (
          <motion.circle
            key={i}
            cx={x}
            cy={60 - (i % 3) * 15}
            r="5"
            fill={accent}
            fillOpacity="0.3"
            stroke={accent}
            strokeWidth="1"
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.12, type: "spring" }}
          />
        ))}
      </svg>
    );
  }
  if (kind === "second-witness") {
    return (
      <svg viewBox="0 0 200 80" className="h-full w-full">
        {[
          { x: 55, r: -8 },
          { x: 90, r: 0 },
          { x: 125, r: 8 },
        ].map((c, i) => (
          <motion.rect
            key={i}
            x={c.x}
            y="15"
            width="28"
            height="50"
            rx="3"
            fill="rgba(15,13,28,0.9)"
            stroke={accent}
            strokeWidth="1"
            initial={{ y: -20, opacity: 0, rotate: c.r - 15 }}
            whileInView={{ y: 15, opacity: 1, rotate: c.r }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.2, type: "spring", stiffness: 120 }}
            style={{ transformOrigin: `${c.x + 14}px 40px` }}
          />
        ))}
      </svg>
    );
  }
  // private reading room
  return (
    <svg viewBox="0 0 200 80" className="h-full w-full">
      <motion.circle
        cx="100"
        cy="40"
        r="30"
        fill={accent}
        fillOpacity="0.12"
        animate={{ r: [28, 34, 28], opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 3, repeat: Infinity }}
      />
      {[0, 1, 2].map((row) => (
        <g key={row}>
          {[0, 1, 2, 3, 4, 5].map((b) => (
            <rect
              key={b}
              x={30 + b * 24}
              y={18 + row * 18}
              width={4 + (b % 3) * 2}
              height={12}
              fill={accent}
              opacity={0.4 + (b % 2) * 0.2}
            />
          ))}
        </g>
      ))}
    </svg>
  );
}

type UnlockState = "signed_out" | "no_primary" | "ready";

function UnlockBanner({
  state,
  isZh,
}: {
  state: UnlockState;
  isZh: boolean;
}) {
  const step = (n: number, active: boolean, label: string) => (
    <div className="flex items-center gap-2">
      <span
        className={`grid h-6 w-6 place-items-center rounded-full border text-[10px] ${
          active
            ? "border-gold-dust bg-gold-dust/20 text-gold-light"
            : "border-white/15 bg-white/5 text-stone-warm/50"
        }`}
      >
        {n}
      </span>
      <span
        className={`text-[11px] uppercase tracking-[0.22em] ${
          active ? "text-gold-dust" : "text-stone-warm/50"
        }`}
      >
        {label}
      </span>
    </div>
  );

  const activeIdx = state === "signed_out" ? 0 : state === "no_primary" ? 1 : 2;

  const cta =
    state === "signed_out"
      ? {
          href: "/auth?redirect=/report",
          label: isZh ? "登录以打开藏室" : "Sign in to open the rooms",
        }
      : state === "no_primary"
        ? {
            href: "/ritual?redirect=/report",
            label: isZh ? "开启仪式 · 建立主命盘" : "Start the ritual · set my chart",
          }
        : {
            href: "/report",
            label: isZh ? "打开我的综合解读" : "Open my panorama reading",
          };

  const headline =
    state === "signed_out"
      ? isZh
        ? "先完成两步，四间藏室就会向你打开。"
        : "Two steps unlock all four rooms."
      : state === "no_primary"
        ? isZh
          ? "再完成一步：把生成的命盘设为主命盘。"
          : "One step left: set the generated chart as your primary."
        : isZh
          ? "四间藏室已为你打开 —— 直接进入或先看示例。"
          : "All four rooms are open — jump straight in, or preview each demo first.";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="mx-auto mt-8 max-w-3xl rounded-2xl border border-gold-dust/20 bg-gradient-to-br from-obsidian/70 via-[#151028]/70 to-obsidian/70 p-5 backdrop-blur-sm sm:p-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
            {isZh ? "如何打开这四间藏室" : "How to unlock these rooms"}
          </p>
          <p className="mt-2 font-serif text-base leading-snug text-stone-warm sm:text-lg">
            {headline}
          </p>
        </div>
        <Link
          to={cta.href}
          className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-full border border-gold-dust/50 bg-gold-dust/10 px-5 py-2.5 text-[11px] uppercase tracking-[0.28em] text-gold-light transition hover:bg-gold-dust/20"
        >
          {cta.label}
        </Link>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/5 pt-4">
        {step(1, activeIdx >= 0, isZh ? "登录" : "Sign in")}
        <span aria-hidden className="text-stone-warm/25">
          →
        </span>
        {step(2, activeIdx >= 1, isZh ? "开启仪式 · 主命盘" : "Ritual · primary chart")}
        <span aria-hidden className="text-stone-warm/25">
          →
        </span>
        {step(3, activeIdx >= 2, isZh ? "打开藏室" : "Open the rooms")}
      </div>
    </motion.div>
  );
}

export function PostRitualRoomsSection() {
  const { lang } = useLang();
  const isZh = lang === "zh";
  const { session } = useSupabaseSession();
  const isSignedIn = !!session;
  const membership = useMembershipTier();
  const tier: "none" | "sage" | "oracle" =
    membership.kind === "ready" ? membership.tier : "none";

  const [hasPrimaryChart, setHasPrimaryChart] = useState(false);
  useEffect(() => {
    if (!isSignedIn) {
      setHasPrimaryChart(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const rows = await listUserCharts();
        if (!cancelled) setHasPrimaryChart(rows.some((c) => c.is_primary));
      } catch {
        if (!cancelled) setHasPrimaryChart(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn]);

  const unlockState: UnlockState = !isSignedIn
    ? "signed_out"
    : !hasPrimaryChart
      ? "no_primary"
      : "ready";

  const [activeRoom, setActiveRoom] = useState<RoomDef | null>(null);
  const activeCta = useMemo(() => {
    if (!activeRoom) return null;
    return resolveCta({
      target: activeRoom.target,
      requiresPrimaryChart: true,
      requiresTier: activeRoom.requiresTier,
      isSignedIn,
      hasPrimaryChart,
      tier,
    });
  }, [activeRoom, isSignedIn, hasPrimaryChart, tier]);

  return (
    <section
      id="post-ritual-rooms"
      data-testid="post-ritual-rooms"
      className="relative z-10 mx-auto max-w-6xl px-5 py-24 sm:px-6"
    >
      <header className="mx-auto max-w-3xl text-center">
        <p className="text-[10px] uppercase tracking-[0.42em] text-gold-dust/80">
          {isZh ? "仪式之后" : "After the ritual"}
        </p>
        <h2 className="mt-3 font-serif text-3xl leading-tight text-stone-warm md:text-4xl">
          {isZh
            ? "仪式之后，图书馆会为你打开四间特别藏室"
            : "After the ritual, four private rooms open in the library"}
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-stone-warm/60">
          {isZh
            ? "命盘不只是一张结论。它可以被展开成时间、证据、另一种视角，以及一场持续的私人阅读。"
            : "The chart isn't a single conclusion. It can unfold into time, evidence, a second voice, and a long private reading of your own."}
        </p>
      </header>

      <UnlockBanner state={unlockState} isZh={isZh} />

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {ROOMS.map((room, i) => {
          const title = isZh ? room.titleZh : room.titleEn;
          const tagline = isZh ? room.taglineZh : room.taglineEn;
          const ctaLabel = isZh ? room.ctaZh : room.ctaEn;
          return (
            <motion.article
              key={room.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-obsidian/60 transition-all duration-300 hover:-translate-y-0.5 hover:border-gold-dust/40 hover:shadow-[0_10px_40px_-20px_rgba(245,194,107,0.4)]"
            >
              {/* Visual banner */}
              <button
                type="button"
                onClick={() => setActiveRoom(room)}
                className="relative block h-32 w-full overflow-hidden border-b border-white/5 bg-gradient-to-br from-[#0d0b1c] via-[#141028] to-[#0d0b1c] p-4 text-left transition-transform group-hover:scale-[1.02]"
                aria-label={isZh ? `预览 ${title}` : `Preview ${title}`}
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 opacity-70"
                  style={{
                    background: `radial-gradient(circle at 30% 30%, ${room.accent}22, transparent 60%)`,
                  }}
                />
                <div className="relative h-full w-full">
                  <CardVisual kind={room.id} accent={room.accent} />
                </div>
                <span className="absolute right-3 top-3 rounded-full border border-white/10 bg-obsidian/70 px-2.5 py-1 text-[9px] uppercase tracking-[0.28em] text-stone-warm/60 backdrop-blur-sm">
                  {isZh ? "点击预览" : "Tap preview"}
                </span>
              </button>

              <div className="flex flex-1 flex-col p-5 sm:p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <AccessChip tag={room.accessTag} isZh={isZh} />
                </div>
                <h3 className="mt-3 font-serif text-xl leading-snug text-stone-warm">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-stone-warm/70">{tagline}</p>

                <div className="mt-auto flex flex-wrap items-center gap-3 pt-5">
                  <button
                    type="button"
                    onClick={() => setActiveRoom(room)}
                    className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-full border border-gold-dust/40 bg-obsidian/70 px-5 py-2.5 text-[11px] uppercase tracking-[0.28em] text-gold-dust transition hover:bg-gold-dust/10"
                  >
                    {isZh ? "查看示例" : "See sample"}
                  </button>
                  <span className="text-[11px] uppercase tracking-[0.24em] text-stone-warm/45">
                    {ctaLabel}
                  </span>
                </div>
              </div>
            </motion.article>
          );
        })}
      </div>

      {activeRoom && activeCta && (
        <RoomPreviewModal
          open={!!activeRoom}
          onOpenChange={(v) => !v && setActiveRoom(null)}
          kind={activeRoom.id}
          titleZh={activeRoom.titleZh}
          titleEn={activeRoom.titleEn}
          answersZh={activeRoom.answersZh}
          answersEn={activeRoom.answersEn}
          ctaHref={activeCta.href}
          ctaState={activeCta.state}
          ctaLabelZh={activeRoom.ctaZh}
          ctaLabelEn={activeRoom.ctaEn}
          targetLabelZh={activeRoom.targetLabelZh}
          targetLabelEn={activeRoom.targetLabelEn}
        />
      )}
    </section>
  );
}
