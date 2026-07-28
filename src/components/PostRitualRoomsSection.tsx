/**
 * PostRitualRoomsSection — "仪式之后，图书馆会为你打开四间特别藏室"
 *
 * Four in-app rooms unlocked by having a primary chart. Each card explains
 * what it is, what it answers, what the user will see, its access tier and
 * where the CTA leads. Real routes only; the paid room (Private Reading
 * Room) delegates its upgrade prompt to the destination page — the home
 * page never hosts a second payment surface.
 */

import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import {
  accessTagLabel,
  accessTagTooltip,
  ctaMicroCopy,
  resolveCta,
  type AccessTag,
} from "@/lib/home-cta";
import { useLang } from "@/lib/i18n";
import { useSupabaseSession } from "@/lib/session";
import { listUserCharts } from "@/lib/reports-store.functions";
import { useMembershipTier } from "@/lib/use-membership-tier";

type RoomDef = {
  id: "corridor" | "verification" | "second-witness" | "private";
  target: string;
  requiresTier?: "sage" | "oracle";
  accessTag: AccessTag;
  titleZh: string;
  titleEn: string;
  answersZh: string;
  answersEn: string;
  seeZh: string;
  seeEn: string;
  targetLabelZh: string;
  targetLabelEn: string;
  ctaZh: string;
  ctaEn: string;
  ornament: string;
};

const ROOMS: RoomDef[] = [
  {
    id: "corridor",
    target: "/report#life-timeline",
    accessTag: "basic",
    titleZh: "时间回廊 · 生命时间轴 · 大运",
    titleEn: "Time Corridor · The Life Timeline",
    answersZh: "「不同年龄，我的事业、学业、关系、财富、家庭与健康会经历什么？」",
    answersEn: "\"What does each age hold for study, career, love, wealth, family and health?\"",
    seeZh: "六条并列的多维折线；点击某个年龄可展开当年主题、支持与消耗。",
    seeEn: "Six parallel multi-dimension lines; open any age to see themes, supports and drains.",
    targetLabelZh: "时间回廊",
    targetLabelEn: "the Time Corridor",
    ctaZh: "打开时间回廊",
    ctaEn: "Open the corridor",
    ornament: "◷",
  },
  {
    id: "verification",
    target: "/report#key-events",
    accessTag: "basic",
    titleZh: "验证档案室 · 关键节点 · 反向验证",
    titleEn: "Verification Archive · Reverse-check Life Events",
    answersZh: "「命盘对我过去发生的事，说得对吗？」",
    answersEn: "\"Does the chart actually describe what already happened in my life?\"",
    seeZh: "标记过去若干节点为「符合、部分符合、不符合、记不清」，并显示置信度。",
    seeEn: "Mark past turning points as matching, partial, off or unclear, and see the confidence score.",
    targetLabelZh: "验证档案室",
    targetLabelEn: "the Verification Archive",
    ctaZh: "开始反向验证",
    ctaEn: "Start reverse-check",
    ornament: "❋",
  },
  {
    id: "second-witness",
    target: "/report#tarot",
    accessTag: "basic",
    titleZh: "第二证人室 · 塔罗 · 第二位证人",
    titleEn: "Second Witness · Tarot as a Second Voice",
    answersZh: "「命盘讲长期结构，那么此刻这个具体问题呢？」",
    answersEn: "\"The chart speaks in long arcs — what about this one question, right now?\"",
    seeZh: "三张卡与命盘章节的共同证词与分歧之处；只作反思工具，不做承诺。",
    seeEn: "Three cards read alongside the chart — where they agree, where they diverge. A reflection tool, not a promise.",
    targetLabelZh: "第二证人室",
    targetLabelEn: "the Second Witness",
    ctaZh: "召唤三张卡",
    ctaEn: "Draw three cards",
    ornament: "✦",
  },
  {
    id: "private",
    target: "/me/sage",
    requiresTier: "sage",
    accessTag: "sage",
    titleZh: "私人阅览室 · 贤者与神谕者",
    titleEn: "Private Reading Room · Sage & Oracle",
    answersZh: "「我想要更深、更长时间的私人阅读，能不能拥有一个属于自己的阅览角落？」",
    answersEn: "\"Can I have a private, deeper, longer reading room of my own?\"",
    seeZh: "两种阅读深度：贤者聚焦当下三十天、神谕者展开全年季度地图。首页不重复价格；进入后决定是否开通。",
    seeEn: "Two depths: Sage focuses the next 30 days; Oracle opens a full-year quarterly map. Pricing lives inside the room, not here.",
    targetLabelZh: "私人阅览室",
    targetLabelEn: "the Private Reading Room",
    ctaZh: "预览私人阅览室",
    ctaEn: "Preview the reading room",
    ornament: "❦",
  },
];

function AccessChip({ tag, isZh }: { tag: AccessTag; isZh: boolean }) {
  const tone =
    tag === "basic"
      ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
      : tag === "sage"
        ? "border-gold-dust/40 bg-gold-dust/10 text-gold-light"
        : tag === "oracle"
          ? "border-nebula-purple/40 bg-nebula-purple/15 text-stone-warm"
          : "border-white/10 bg-white/5 text-stone-warm/60";
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

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {ROOMS.map((room) => {
          const cta = resolveCta({
            target: room.target,
            requiresPrimaryChart: true,
            requiresTier: room.requiresTier,
            isSignedIn,
            hasPrimaryChart,
            tier,
          });
          const title = isZh ? room.titleZh : room.titleEn;
          const answers = isZh ? room.answersZh : room.answersEn;
          const see = isZh ? room.seeZh : room.seeEn;
          const ctaLabel = isZh ? room.ctaZh : room.ctaEn;
          return (
            <article
              key={room.id}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-obsidian/60 p-6 transition hover:border-gold-dust/30"
            >
              <div
                aria-hidden
                className="pointer-events-none absolute right-4 top-4 font-serif text-4xl text-gold-dust/25"
              >
                {room.ornament}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <AccessChip tag={room.accessTag} isZh={isZh} />
              </div>
              <h3 className="mt-3 font-serif text-xl leading-snug text-stone-warm">{title}</h3>
              <dl className="mt-4 space-y-3 text-sm leading-relaxed text-stone-warm/70">
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.32em] text-stone-warm/40">
                    {isZh ? "回答什么" : "It answers"}
                  </dt>
                  <dd className="mt-1 italic text-stone-warm/80">{answers}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.32em] text-stone-warm/40">
                    {isZh ? "你会看到" : "You will see"}
                  </dt>
                  <dd className="mt-1">{see}</dd>
                </div>
              </dl>
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-4">
                <span className="text-[11px] leading-relaxed text-stone-warm/50">
                  {ctaMicroCopy(
                    cta.state,
                    { zh: room.targetLabelZh, en: room.targetLabelEn },
                    isZh,
                  )}
                </span>
                {cta.href && (
                  <Link
                    to={cta.href}
                    className="inline-flex min-h-[44px] items-center rounded-full border border-gold-dust/40 bg-obsidian/70 px-5 py-2.5 text-[11px] uppercase tracking-[0.28em] text-gold-dust transition hover:bg-gold-dust/10"
                  >
                    {ctaLabel}
                  </Link>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
