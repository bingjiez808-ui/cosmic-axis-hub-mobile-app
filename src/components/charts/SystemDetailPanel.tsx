/**
 * SystemDetailPanel — the left-hand reading column of the
 * "命盘 · 四大盘总览" module.
 *
 * It mirrors whichever system tab is active above the module and lists the
 * real parameters behind that chart (Vedic placements, BaZi pillars, Zi Wei
 * palaces). When a system cannot be computed it names the exact missing
 * birth field and — for Zi Wei's gender parameter — lets the visitor supply
 * it inline so the chart completes without redoing the ritual.
 */
import { useEffect, useMemo, useState } from "react";
import type { CalculationSnapshot } from "@/lib/calc-snapshot";
import { localBirthToUTC } from "@/lib/city-geo";
import {
  SIGNS,
  SYSTEM_TABS,
  WUXING_LABEL,
  WUXING_ORDER,
  baziView,
  systemAvailability,
  unavailableReason,
  vedicView,
  type SystemKey,
} from "@/lib/four-systems-view";
import { computeWesternChart, type WesternAspect, type WesternBodyKey, type WesternChart, type WesternPlanet } from "@/lib/western-natal";

type DetailMode = "parameters" | "overview" | "explain";

type OverviewCard = {
  title: string;
  body: string;
  tone?: "green" | "rose" | "gold";
  meta?: string;
};

type PersonalOverview = {
  title: string;
  headline: string;
  paragraphs: string[];
  cards: OverviewCard[];
  aspectCards: OverviewCard[];
};

const WESTERN_BODY_META: Record<WesternBodyKey, { glyph: string; zh: string; en: string; meaningZh: string; meaningEn: string }> = {
  sun: { glyph: "☉", zh: "太阳", en: "Sun", meaningZh: "核心意志", meaningEn: "core will" },
  moon: { glyph: "☽", zh: "月亮", en: "Moon", meaningZh: "情绪需求", meaningEn: "emotional need" },
  mercury: { glyph: "☿", zh: "水星", en: "Mercury", meaningZh: "思考表达", meaningEn: "thinking and speech" },
  venus: { glyph: "♀", zh: "金星", en: "Venus", meaningZh: "关系品味", meaningEn: "relating and taste" },
  mars: { glyph: "♂", zh: "火星", en: "Mars", meaningZh: "行动欲望", meaningEn: "drive" },
  jupiter: { glyph: "♃", zh: "木星", en: "Jupiter", meaningZh: "扩张信念", meaningEn: "growth and belief" },
  saturn: { glyph: "♄", zh: "土星", en: "Saturn", meaningZh: "边界责任", meaningEn: "limits and discipline" },
  uranus: { glyph: "♅", zh: "天王星", en: "Uranus", meaningZh: "突变自由", meaningEn: "change and freedom" },
  neptune: { glyph: "♆", zh: "海王星", en: "Neptune", meaningZh: "理想感受", meaningEn: "ideal and feeling" },
};

const WESTERN_ASPECT_META: Record<WesternAspect["kind"], { zh: string; en: string; tone: OverviewCard["tone"]; qualityZh: string; qualityEn: string }> = {
  conjunction: { zh: "合相", en: "Conjunction", tone: "green", qualityZh: "融合 · 强烈聚焦", qualityEn: "fusion · focused" },
  opposition: { zh: "对分", en: "Opposition", tone: "rose", qualityZh: "拉扯 · 需要整合", qualityEn: "polarity · integration" },
  trine: { zh: "三分", en: "Trine", tone: "green", qualityZh: "顺流 · 天赋通道", qualityEn: "flow · gift" },
  square: { zh: "刑相", en: "Square", tone: "rose", qualityZh: "摩擦 · 成长压力", qualityEn: "friction · growth pressure" },
  sextile: { zh: "六合", en: "Sextile", tone: "green", qualityZh: "可用 · 需要主动开启", qualityEn: "usable · needs activation" },
};

const ELEMENT_META = {
  fire: { zh: "火象", en: "fire", noteZh: "行动、热情、即时反应", noteEn: "action, heat and immediacy" },
  earth: { zh: "土象", en: "earth", noteZh: "落地、秩序、现实感", noteEn: "grounding, order and realism" },
  air: { zh: "风象", en: "air", noteZh: "理解、沟通、抽离观察", noteEn: "thinking, dialogue and perspective" },
  water: { zh: "水象", en: "water", noteZh: "感受、记忆、共情深度", noteEn: "feeling, memory and empathy" },
} as const;

type Props = {
  snapshot: CalculationSnapshot;
  lang: "en" | "zh";
  system: SystemKey;
  /** Rendered for the western tab (the existing planet reading panel). */
  westernSlot?: React.ReactNode;
  /** Supply the missing Zi Wei gender parameter in place. */
  onSupplyGender?: (gender: "male" | "female") => void;
};

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">{children}</p>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-white/5 py-1.5 last:border-b-0">
      <span className="shrink-0 text-[11px] tracking-[0.16em] text-stone-warm/50">{k}</span>
      <span className="min-w-0 text-right font-serif text-[13px] italic text-stone-warm/90">{v}</span>
    </div>
  );
}

function ToneCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-gold-dust/20 bg-gold-dust/[0.055] p-4">
      <p className="font-serif text-base italic text-stone-warm">{title}</p>
      <p className="mt-2 text-[13px] leading-relaxed text-stone-warm/72">{body}</p>
    </div>
  );
}

function NoteList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
      <Label>{title}</Label>
      <ul className="mt-3 space-y-2">
        {items.map((item, i) => (
          <li
            key={`${item}-${i}`}
            className="rounded-xl border border-white/5 bg-obsidian/35 px-3 py-2 text-[12px] leading-relaxed text-stone-warm/70"
          >
            <span className="mr-2 font-serif text-gold-light">{String(i + 1).padStart(2, "0")}</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function bodyName(key: WesternBodyKey, lang: "en" | "zh") {
  const meta = WESTERN_BODY_META[key];
  return lang === "zh" ? meta.zh : meta.en;
}

function signName(sign: number, lang: "en" | "zh") {
  const s = SIGNS[((sign % 12) + 12) % 12];
  return lang === "zh" ? s.zh : s.en;
}

function planetPhrase(planet: WesternPlanet | undefined, lang: "en" | "zh") {
  if (!planet) return null;
  const meta = WESTERN_BODY_META[planet.key];
  const name = lang === "zh" ? meta.zh : meta.en;
  return lang === "zh"
    ? `${meta.glyph} ${name}在${planet.sign_zh}`
    : `${meta.glyph} ${name} in ${planet.sign_en}`;
}

function dominantElement(planets: WesternPlanet[] | undefined, lang: "en" | "zh") {
  if (!planets?.length) return null;
  const counts = { fire: 0, earth: 0, air: 0, water: 0 };
  for (const p of planets) {
    const key = p.sign % 4 === 0 ? "fire" : p.sign % 4 === 1 ? "earth" : p.sign % 4 === 2 ? "air" : "water";
    counts[key] += ["sun", "moon", "mercury", "venus", "mars"].includes(p.key) ? 2 : 1;
  }
  const [topKey, topValue] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] as [keyof typeof counts, number];
  if (!topValue) return null;
  const meta = ELEMENT_META[topKey];
  return {
    label: lang === "zh" ? meta.zh : meta.en,
    note: lang === "zh" ? meta.noteZh : meta.noteEn,
    counts,
  };
}

function aspectTitle(a: WesternAspect, lang: "en" | "zh") {
  const meta = WESTERN_ASPECT_META[a.kind];
  return `${WESTERN_BODY_META[a.a].glyph} ${bodyName(a.a, lang)} ${meta.zh === "合相" && lang === "zh" ? "合" : lang === "zh" ? meta.zh : meta.en} ${WESTERN_BODY_META[a.b].glyph} ${bodyName(a.b, lang)}`;
}

function aspectBody(a: WesternAspect, lang: "en" | "zh") {
  const left = WESTERN_BODY_META[a.a];
  const right = WESTERN_BODY_META[a.b];
  const meta = WESTERN_ASPECT_META[a.kind];
  if (lang !== "zh") {
    if (a.kind === "square" || a.kind === "opposition") {
      return `${left.en} brings ${left.meaningEn}, while ${right.en} brings ${right.meaningEn}. This aspect shows a real inner negotiation: neither side disappears, and growth comes from giving both a workable place.`;
    }
    if (a.kind === "conjunction") {
      return `${left.en} and ${right.en} operate almost as one current. It can create strong focus and charisma, while also making this theme hard to see from the outside.`;
    }
    return `${left.en} and ${right.en} form a supportive channel. The ability is already present, but it becomes useful only when this person actively practices it.`;
  }
  if (a.kind === "square" || a.kind === "opposition") {
    return `${left.zh}代表${left.meaningZh}，${right.zh}代表${right.meaningZh}。这不是坏相位，而是这张盘里必须被看见的拉扯：一边想这样做，另一边又有不同需求，成熟点在于让两边都有位置。`;
  }
  if (a.kind === "conjunction") {
    return `${left.zh}与${right.zh}像被拧在同一束光里，${left.meaningZh}和${right.meaningZh}会同时启动。优势是聚焦强，卡点是容易把这件事看得过重。`;
  }
  return `${left.zh}与${right.zh}之间有一条比较顺的通道，${left.meaningZh}可以自然带动${right.meaningZh}。它不是自动发生的好运，更像一项越用越顺的能力。`;
}

function buildWesternFullChart(snapshot: CalculationSnapshot): WesternChart | null {
  if (!snapshot.input.date || !snapshot.input.time || !snapshot.geo) return null;
  const utc = localBirthToUTC(snapshot.input.date, snapshot.input.time, snapshot.geo.tz);
  if (!utc) return null;
  return computeWesternChart({ utc, lat: snapshot.geo.lat, lng: snapshot.geo.lng });
}

function buildPersonalOverview(
  snapshot: CalculationSnapshot,
  system: SystemKey,
  lang: "en" | "zh",
  westernChart: WesternChart | null,
): PersonalOverview {
  const zh = lang === "zh";
  if (system === "western") {
    const planets = westernChart?.planets;
    const sun = planets?.find((p) => p.key === "sun");
    const moon = planets?.find((p) => p.key === "moon");
    const asc = westernChart?.ascendant;
    const element = dominantElement(planets, lang);
    const retro = planets?.filter((p) => p.retro).map((p) => bodyName(p.key, lang)) ?? [];
    const aspects = (westernChart?.aspects ?? [])
      .slice()
      .sort((a, b) => a.orb - b.orb)
      .slice(0, 5);
    const fallbackSun = snapshot.western.sun;
    const headline = zh
      ? sun
        ? `太阳在${sun.sign_zh}：深潜，只信经过验证的东西`
        : fallbackSun
          ? `太阳在${fallbackSun.sign_zh}：先从核心自我开始阅读`
          : "先补全出生信息，才能打开完整星盘"
      : sun
        ? `Sun in ${sun.sign_en}: depth before certainty`
        : fallbackSun
          ? `Sun in ${fallbackSun.sign_en}: start from the core self`
          : "Complete birth data to unlock the full chart";
    const paragraphs = zh
      ? [
          sun
            ? `太阳落在${sun.sign_zh}，这是这张盘的主轴：你最想成为的样子并不浅显，常常需要确认事实、信任和真实动机之后才会投入。`
            : fallbackSun
              ? `目前能确认太阳在${fallbackSun.sign_zh}，可先阅读核心自我；出生时间与地点补全后，会进一步打开月亮、上升与相位结构。`
              : "当前缺少出生日期，西方星盘无法形成可读的主轴。",
          moon
            ? `月亮在${moon.sign_zh}，说明情绪补给方式偏向${moon.sign % 4 === 2 ? "理解、公平和关系中的平衡感" : moon.sign % 4 === 3 ? "深度共鸣和被认真接住" : moon.sign % 4 === 1 ? "稳定、可控和现实承诺" : "热度、回应和即时行动"}。压力大时，你会先回到这一层需求。`
            : "没有出生时间时，月亮细节会变得不完整；它通常用来判断安全感、情绪节奏和关系里的本能反应。",
          asc
            ? `上升在${signName(asc.sign, lang)}，别人第一眼感受到的不是你的全部，而是你进入世界的姿态：它决定你如何开场、如何防御，也影响整张盘的阅读顺序。`
            : "上升需要准确出生时间和地点；缺少它时，报告仍能看核心倾向，但人生场景的定位会少一层。",
          element
            ? `元素分布里${element.label}最醒目，代表这张盘更习惯通过${element.note}来处理问题。它是优势，也会成为反复使用的默认模式。`
            : "元素比例会在完整盘面中显示这个人最熟悉的反应方式，以及需要刻意补位的能力。",
          retro.length
            ? `逆行行星包括${retro.join("、")}，这些主题更像需要反复内化的功课：不是不能做，而是会慢一点、深一点，常常先在内心完成校准。`
            : "这张盘没有明显逆行重点，行星主题更倾向直接外显，阅读时可优先看相位张力。",
        ]
      : [
          sun ? `Sun in ${sun.sign_en} anchors the chart: identity forms through depth, proof and tested trust.` : "The Sun is the first stable entry point.",
          moon ? `Moon in ${moon.sign_en} describes the emotional fuel and safety pattern.` : "The Moon needs birth time for fuller precision.",
          asc ? `Ascendant in ${signName(asc.sign, lang)} shows how this person enters the world.` : "Ascendant requires exact time and place.",
          element ? `${element.label} is dominant, so this chart defaults to ${element.note}.` : "Element balance appears with a full chart.",
          retro.length ? `Retrogrades: ${retro.join(", ")}.` : "No strong retrograde emphasis appears in the available data.",
        ];
    return {
      title: zh ? "西方星盘 · 总体解读" : "Western chart · overview",
      headline,
      paragraphs,
      cards: [
        { title: planetPhrase(sun, lang) ?? (zh ? `太阳在${fallbackSun?.sign_zh ?? "未知"}` : `Sun in ${fallbackSun?.sign_en ?? "unknown"}`), body: paragraphs[0], tone: "gold" },
        ...(moon ? [{ title: planetPhrase(moon, lang)!, body: paragraphs[1], tone: "green" as const }] : []),
        ...(asc ? [{ title: zh ? `Asc 上升在${signName(asc.sign, lang)}` : `Ascendant in ${signName(asc.sign, lang)}`, body: paragraphs[2], tone: "green" as const }] : []),
      ],
      aspectCards: aspects.map((a) => ({
        title: aspectTitle(a, lang),
        body: aspectBody(a, lang),
        tone: WESTERN_ASPECT_META[a.kind].tone,
        meta: zh
          ? `${WESTERN_ASPECT_META[a.kind].qualityZh} · 容许度 ${a.orb.toFixed(1)}°`
          : `${WESTERN_ASPECT_META[a.kind].qualityEn} · orb ${a.orb.toFixed(1)}°`,
      })),
    };
  }

  const overview = systemOverview(snapshot, system, lang);
  return {
    title: overview.title,
    headline: overview.body.split("。")[0] || overview.title,
    paragraphs: [overview.body],
    cards: overview.cues.map((cue, i) => ({
      title: zh ? `线索 ${String(i + 1).padStart(2, "0")}` : `Cue ${String(i + 1).padStart(2, "0")}`,
      body: cue,
      tone: i === 0 ? "gold" : "green",
    })),
    aspectCards: [],
  };
}

function systemOverview(snapshot: CalculationSnapshot, system: SystemKey, lang: "en" | "zh") {
  const zh = lang === "zh";
  if (system === "western") {
    const sun = snapshot.western.planets?.find((p) => p.key === "sun");
    const moon = snapshot.western.planets?.find((p) => p.key === "moon");
    const asc = snapshot.western.planets?.find((p) => p.key === "asc");
    const sunSign = sun?.sign != null ? (zh ? SIGNS[sun.sign].zh : SIGNS[sun.sign].en) : null;
    const moonSign = moon?.sign != null ? (zh ? SIGNS[moon.sign].zh : SIGNS[moon.sign].en) : null;
    const ascSign = asc?.sign != null ? (zh ? SIGNS[asc.sign].zh : SIGNS[asc.sign].en) : null;
    return {
      title: zh ? "西方星盘总体解读" : "Western overview",
      body: zh
        ? `这个人的西方星盘核心不是“泛泛性格”，而是由${sunSign ? `太阳${sunSign}` : "太阳位置"}、${moonSign ? `月亮${moonSign}` : "月亮位置"}${ascSign ? `和上升${ascSign}` : ""}共同组成：太阳说明他习惯用什么方式确认自我，月亮说明安全感和情绪需求，上升说明外界第一眼感受到的姿态。总体上，这一盘适合先读“我为什么这样反应”，再延伸到关系表达、行动节奏和长期压力点。`
        : `This person's western chart is anchored by ${sunSign ? `Sun in ${sunSign}` : "the Sun"}, ${moonSign ? `Moon in ${moonSign}` : "the Moon"}${ascSign ? ` and Ascendant in ${ascSign}` : ""}. It describes identity style, emotional needs and the outer posture others meet first.`,
      cues: zh
        ? [
            sunSign ? `自我主轴：太阳${sunSign}，优先观察他如何定义价值、目标和存在感。` : "自我主轴：先看太阳，判断他如何确认目标与存在感。",
            moonSign ? `情绪底色：月亮${moonSign}，说明他在压力下会本能寻找怎样的安全感。` : "情绪底色：月亮用于判断压力下的本能需求。",
            ascSign ? `外在入口：上升${ascSign}，决定别人最先看到的行动姿态与防御方式。` : "外在入口：上升能补足他在关系中的第一反应。",
          ]
        : [
            sunSign ? `Identity axis: Sun in ${sunSign}.` : "Identity axis: start from the Sun.",
            moonSign ? `Emotional ground: Moon in ${moonSign}.` : "Emotional ground: read the Moon.",
            ascSign ? `Outer gate: Ascendant in ${ascSign}.` : "Outer gate: read the Ascendant when birth time is known.",
          ],
    };
  }
  if (system === "vedic") {
    const v = vedicView(snapshot.vedic.chart);
    const moon = v?.nakshatra ? (zh ? v.nakshatra.zh : v.nakshatra.en) : null;
    const asc = v?.ascSign != null ? (zh ? SIGNS[v.ascSign].zh : SIGNS[v.ascSign].en) : null;
    const retro = v?.planets.filter((p) => p.retro).map((p) => (zh ? p.name[1] : p.name[0])).slice(0, 3);
    return {
      title: zh ? "印度占星总体解读" : "Vedic overview",
      body: zh
        ? `这个人的印度占星重点落在“内在惯性与人生节奏”。${moon ? `月宿为「${moon}」，说明他做选择时更容易先被情绪记忆、熟悉感和本能偏好推动。` : ""}${asc ? `上升为「${asc}」，表示人生课题常从这个上升气质进入现实。` : ""}${retro && retro.length > 0 ? `盘中逆行重点包括「${retro.join("、")}」，这些主题往往不是一次解决，而是反复校准。` : ""}`
        : `This person's Vedic view emphasizes instinct and life rhythm${moon ? `, with Moon in ${moon}` : ""}${asc ? ` and Ascendant in ${asc}` : ""}.`,
      cues: zh
        ? [
            moon ? `本能入口：月宿「${moon}」优先解释他的情绪惯性和安全感来源。` : "本能入口：月宿用于判断情绪惯性。",
            asc ? `现实入口：上升「${asc}」提示人生经验如何展开。` : "现实入口：上升提示经验如何展开。",
            retro && retro.length > 0 ? `反复课题：${retro.join("、")}逆行，相关能力需要长期内化。` : "反复课题：看逆行与星体集中处。",
          ]
        : [
            moon ? `Instinct: Moon nakshatra ${moon}.` : "Instinct: read the Moon nakshatra.",
            asc ? `Life entry: Ascendant ${asc}.` : "Life entry: read the Ascendant.",
            retro && retro.length > 0 ? `Repeated lessons: ${retro.join(", ")} retrograde.` : "Repeated lessons: inspect retrogrades and clusters.",
          ],
    };
  }
  if (system === "bazi") {
    const b = baziView(snapshot.bazi);
    const day = b?.dayMaster?.stem
      ? `${b.dayMaster.stem}${b.dayMaster.element ? ` ${zh ? WUXING_LABEL[b.dayMaster.element].zh : WUXING_LABEL[b.dayMaster.element].en}` : ""}`
      : null;
    const missing = b?.missing.map((m) => (zh ? WUXING_LABEL[m].zh : WUXING_LABEL[m].en)).join(zh ? "、" : ", ");
    return {
      title: zh ? "八字总体解读" : "BaZi overview",
      body: zh
        ? `这个人的八字核心从日主展开${day ? `：日主为「${day}」，代表他最底层的自我运作方式。` : "。"}四柱不是在判断好坏，而是在看资源、压力、表达和关系如何围绕日主流动。${missing ? `盘中较少显现「${missing}」，这些元素相关的能力通常需要通过环境、选择和训练来补足。` : ""}`
        : `This person's BaZi centers on the Day Master${day ? ` ${day}` : ""}, showing how resources, pressure, output and relationships move around the self.`,
      cues: zh
        ? [
            day ? `人格核心：日主「${day}」决定其它五行如何作用到本人。` : "人格核心：先找日主，再看其它五行如何作用。",
            missing ? `待补能力：较弱或缺少的「${missing}」不是缺陷，而是需要借助环境补位。` : "结构优势：五行比例显示这个人熟悉和不熟悉的应对方式。",
            "现实落点：月柱看社会节奏，日柱看亲密与自我，时柱看行动余地和未来展开。",
          ]
        : [
            day ? `Core self: Day Master ${day}.` : "Core self: start with the Day Master.",
            missing ? `Support needed: less visible ${missing}.` : "Element balance shows familiar and unfamiliar responses.",
            "Month shows social rhythm; day shows self/intimacy; hour shows agency and future.",
          ],
    };
  }
  const z = snapshot.ziwei.chart;
  const soulPalace = z?.palaces[z.soul_palace_index];
  const bodyPalace = z?.palaces[z.body_palace_index];
  const stars = soulPalace?.major_stars.map((s) => s.name).join(" · ");
  const bodyStars = bodyPalace?.major_stars.map((s) => s.name).join(" · ");
  return {
    title: zh ? "紫微斗数总体解读" : "Zi Wei overview",
    body: zh
      ? `这个人的紫微盘适合看“人生场景里的自己”。${soulPalace ? `命宫在「${soulPalace.name}」${stars ? `，主星为「${stars}」` : ""}，这是他的核心气质和人生主调。` : ""}${bodyPalace ? `身宫在「${bodyPalace.name}」${bodyStars ? `，主星为「${bodyStars}」` : ""}，更接近他实际做事时呈现出来的样子。` : ""}因此紫微部分应优先回答：事业、关系、财富、迁移等具体场景中，他会怎么选择、哪里容易卡住。`
      : `This person's Zi Wei chart grounds the self in life arenas${soulPalace ? `: soul palace ${soulPalace.name}${stars ? ` with ${stars}` : ""}` : ""}${bodyPalace ? `; body palace ${bodyPalace.name}${bodyStars ? ` with ${bodyStars}` : ""}` : ""}.`,
    cues: zh
      ? [
          soulPalace ? `命宫重点：「${soulPalace.name}」${stars ? ` / ${stars}` : ""}，看核心气质。` : "命宫重点：看核心气质和人生主调。",
          bodyPalace ? `身宫重点：「${bodyPalace.name}」${bodyStars ? ` / ${bodyStars}` : ""}，看后天行动方式。` : "身宫重点：看实际行动方式。",
          "问题落点：事业看官禄，关系看夫妻/交友，财富看财帛，移动与变化看迁移。",
        ]
      : [
          soulPalace ? `Soul palace: ${soulPalace.name}${stars ? ` / ${stars}` : ""}.` : "Soul palace: core life tone.",
          bodyPalace ? `Body palace: ${bodyPalace.name}${bodyStars ? ` / ${bodyStars}` : ""}.` : "Body palace: enacted behavior.",
          "Career, partner, friends, wealth and travel palaces answer concrete life questions.",
        ],
  };
}

function systemExplanation(snapshot: CalculationSnapshot, system: SystemKey, lang: "en" | "zh") {
  const zh = lang === "zh";
  if (system === "western") {
    return {
      title: zh ? "相位与落位怎么读" : "How to read placements and aspects",
      items: zh
        ? [
            "落位 = 行星 + 星座 + 宫位：例如月亮说明情绪需求，星座说明表达方式，宫位说明它主要在哪类生活场景出现。",
            "合相/三分/六分通常更像可调用的能力，四分/对分更像需要练习的关系或内在张力。",
            "点击右侧任一行星，会在这里显示该行星的落位解读与主要相位说明。",
          ]
        : [
            "Placement = planet + sign + house: function, style and arena.",
            "Conjunction/trine/sextile usually read as usable channels; square/opposition as growth pressure.",
            "Tap a planet on the chart to see its placement and aspect notes here.",
          ],
    };
  }
  if (system === "vedic") {
    const v = vedicView(snapshot.vedic.chart);
    return {
      title: zh ? "印度参数怎么读" : "How to read Vedic parameters",
      items: [
        ...(v?.nakshatra
          ? [
              zh
                ? `月宿「${v.nakshatra.zh}」pada ${v.nakshatra.pada}：优先读情绪惯性、选择偏好和安全感入口。`
                : `Moon in ${v.nakshatra.en} pada ${v.nakshatra.pada}: instinct, preference and safety needs.`,
            ]
          : []),
        ...(v?.ascSign != null
          ? [
              zh
                ? `上升「${SIGNS[v.ascSign].zh}」：说明人生经验从哪里进入，以及九曜落位如何被组织。`
                : `Ascendant in ${SIGNS[v.ascSign].en}: the entry point through which the planets organize.`,
            ]
          : []),
        zh
          ? "九曜落位用于判断主题集中在哪里；逆行标记表示该功能更容易内化、反复校准。"
          : "Planetary placements show theme concentration; retrogrades often internalize and repeat the lesson.",
      ],
    };
  }
  if (system === "bazi") {
    const b = baziView(snapshot.bazi);
    return {
      title: zh ? "四柱与五行怎么读" : "How to read pillars and elements",
      items: [
        ...(b?.dayMaster
          ? [
              zh
                ? `日主「${b.dayMaster.stem}」是全盘中心：其它干支都围绕它形成资源、压力、输出与关系。`
                : `The Day Master ${b.dayMaster.stem} is the center; other stems and branches relate to it.`,
            ]
          : []),
        zh
          ? "五行条不是好坏分数，而是结构比例：偏多处代表熟悉的反应方式，偏少处代表需要借环境补足。"
          : "Element bars are proportions, not good/bad scores: high means familiar response; low means needs support.",
        zh
          ? "逐柱阅读时，年看背景，月看社会节奏，日看自我与亲密，时看行动余地与未来展开。"
          : "Read year as background, month as social rhythm, day as self/intimacy, hour as agency and future.",
      ],
    };
  }
  const z = snapshot.ziwei.chart;
  const soul = z?.palaces[z.soul_palace_index];
  return {
    title: zh ? "十二宫与主星怎么读" : "How to read palaces and stars",
    items: [
      ...(soul
        ? [
            zh
              ? `命宫「${soul.name}」是整张紫微盘的入口；其中主星越明确，个性主调越容易被辨认。`
              : `The soul palace ${soul.name} is the entry point; clear major stars make the life tone easier to read.`,
          ]
        : []),
      zh
        ? "空宫不是没有内容，而是需要借对宫、三方四正与流年触发来阅读。"
        : "An empty palace is not empty life; it is read through opposite palace, triads and timing triggers.",
      zh
        ? "命宫看核心，身宫看后天行动；其它宫位用于回答事业、关系、财富、迁移等具体问题。"
        : "Soul palace shows core tone; body palace shows action; other palaces answer concrete domains.",
    ],
  };
}

function OverviewDrawer({
  open,
  onClose,
  overview,
  lang,
}: {
  open: boolean;
  onClose: () => void;
  overview: PersonalOverview;
  lang: "en" | "zh";
}) {
  const zh = lang === "zh";
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-obsidian/82 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-[calc(env(safe-area-inset-top)+1rem)] backdrop-blur-md sm:items-center sm:p-5">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label={zh ? "关闭总体解读" : "Close overview"}
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={overview.title}
        className="relative flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] border border-white/12 bg-[#10110f]/96 shadow-[0_28px_90px_-34px_rgba(0,0,0,0.9)] sm:max-h-[86vh]"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_22%_0%,rgba(207,177,91,0.18),transparent_48%),radial-gradient(circle_at_90%_10%,rgba(113,216,194,0.10),transparent_34%)]" />
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 grid h-11 w-11 place-items-center rounded-full border border-gold-dust/35 bg-obsidian/70 text-2xl leading-none text-stone-warm/70 transition hover:border-gold-light hover:text-gold-light"
          aria-label={zh ? "关闭" : "Close"}
        >
          ×
        </button>
        <div className="relative border-b border-white/8 px-5 pb-4 pt-6 sm:px-7 sm:pt-7">
          <Label>{zh ? "总体解读" : "Overview"}</Label>
          <h3 className="mt-2 pr-14 font-serif text-2xl italic leading-tight text-stone-warm sm:text-3xl">
            {overview.title}
          </h3>
          <p className="mt-4 rounded-2xl border border-gold-dust/25 bg-gold-dust/[0.055] px-4 py-3 font-serif text-lg italic leading-relaxed text-gold-light">
            {overview.headline}
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-5 sm:px-7">
          <div className="space-y-3 text-[13px] leading-relaxed text-stone-warm/74">
            {overview.paragraphs.map((paragraph, i) => (
              <p key={`${paragraph}-${i}`}>{paragraph}</p>
            ))}
          </div>

          {overview.cards.length > 0 && (
            <section className="mt-6">
              <Label>{zh ? "关键落位" : "Key placements"}</Label>
              <div className="mt-3 grid gap-3">
                {overview.cards.map((card) => (
                  <OverviewMiniCard key={card.title} card={card} />
                ))}
              </div>
            </section>
          )}

          <section className="mt-6">
            <Label>{zh ? "具体相位逐条解释" : "Aspect notes"}</Label>
            {overview.aspectCards.length > 0 ? (
              <div className="mt-3 grid gap-3">
                {overview.aspectCards.map((card) => (
                  <OverviewMiniCard key={card.title} card={card} />
                ))}
              </div>
            ) : (
              <p className="mt-3 rounded-2xl border border-white/8 bg-white/[0.025] p-4 text-[12px] leading-relaxed text-stone-warm/58">
                {zh
                  ? "当前资料不足以生成逐条相位。补全准确出生时间和地点后，这里会显示每一组主要相位的个人化解释。"
                  : "There is not enough data for aspect-by-aspect notes yet. Add exact time and place to unlock them."}
              </p>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}

function OverviewMiniCard({ card }: { card: OverviewCard }) {
  const tone =
    card.tone === "rose"
      ? "border-rose-300/24 bg-rose-300/[0.045]"
      : card.tone === "green"
        ? "border-teal-200/22 bg-teal-200/[0.045]"
        : "border-gold-dust/24 bg-gold-dust/[0.045]";
  return (
    <article className={`rounded-2xl border p-4 ${tone}`}>
      <div className="flex items-start justify-between gap-3">
        <h4 className="font-serif text-base italic leading-snug text-stone-warm">{card.title}</h4>
        {card.meta && (
          <span className="shrink-0 rounded-full border border-gold-dust/20 px-2 py-1 text-[10px] tracking-[0.14em] text-gold-dust/80">
            {card.meta}
          </span>
        )}
      </div>
      <p className="mt-2 text-[12.5px] leading-relaxed text-stone-warm/70">{card.body}</p>
    </article>
  );
}

export function SystemDetailPanel({
  snapshot,
  lang,
  system,
  westernSlot,
  onSupplyGender,
}: Props) {
  const zh = lang === "zh";
  const [mode, setMode] = useState<DetailMode>("parameters");
  const [overviewOpen, setOverviewOpen] = useState(false);
  const tab = SYSTEM_TABS.find((t) => t.key === system)!;
  const ready = systemAvailability(snapshot)[system];
  const westernChart = useMemo(() => buildWesternFullChart(snapshot), [snapshot]);
  const overview = useMemo(() => systemOverview(snapshot, system, lang), [snapshot, system, lang]);
  const personalOverview = useMemo(
    () => buildPersonalOverview(snapshot, system, lang, westernChart),
    [snapshot, system, lang, westernChart],
  );
  const explanation = useMemo(() => systemExplanation(snapshot, system, lang), [snapshot, system, lang]);

  const header = (
    <div className="mb-3 shrink-0">
      <Label>{zh ? "参数解读" : "Parameters"}</Label>
      <p className="mt-1.5 font-serif text-lg italic text-stone-warm">{zh ? tab.zh : tab.en}</p>
      <p className="mt-0.5 text-[11px] tracking-[0.16em] text-stone-warm/45">
        {zh ? tab.hintZh : tab.hintEn}
      </p>
      <div className="mt-3 grid grid-cols-3 gap-1.5 rounded-full border border-white/8 bg-obsidian/35 p-1">
        {[
          { key: "parameters", label: zh ? "参数" : "Params" },
          { key: "overview", label: zh ? "总体解读" : "Overview" },
          { key: "explain", label: zh ? "具体解释" : "Explain" },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => {
              if (item.key === "overview") {
                setOverviewOpen(true);
                return;
              }
              setMode(item.key as DetailMode);
            }}
            className={`min-h-8 rounded-full px-2 text-[10px] font-medium tracking-[0.12em] transition-colors ${
              (item.key === "overview" ? overviewOpen : mode === item.key)
                ? "bg-gold-dust text-obsidian"
                : "text-stone-warm/55 hover:bg-white/[0.05] hover:text-stone-warm"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );

  const missingGender = system === "ziwei" && snapshot.ziwei.reason === "gender_missing";

  const body = (() => {
    if (!ready) {
      return (
        <div className="rounded-2xl border border-dashed border-gold-dust/25 bg-white/[0.02] p-4">
          <p className="font-serif text-base italic text-stone-warm/80">
            {zh ? "这一体系尚缺参数" : "Missing parameters"}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-stone-warm/60">
            {unavailableReason(snapshot, system, lang)}
          </p>
          <div className="mt-3 space-y-1 text-[11px] text-stone-warm/50">
            <p>
              {zh ? "出生日期" : "Birth date"}：{snapshot.input.date || (zh ? "缺失" : "missing")}
            </p>
            <p>
              {zh ? "出生时刻" : "Birth time"}：{snapshot.input.time || (zh ? "缺失" : "missing")}
            </p>
            <p>
              {zh ? "出生地" : "Birthplace"}：{snapshot.input.place || (zh ? "缺失" : "missing")}
              {snapshot.input.place && !snapshot.geo ? (zh ? "（无法识别）" : " (unresolved)") : ""}
            </p>
            {system === "ziwei" && (
              <p>
                {zh ? "性别参数" : "Gender"}：
                {snapshot.ziwei.chart?.gender ?? (zh ? "缺失" : "missing")}
              </p>
            )}
          </div>
          {missingGender && onSupplyGender && (
            <div className="mt-4">
              <Label>{zh ? "在此补全性别，立即排盘" : "Supply gender to compute now"}</Label>
              <div className="mt-2 flex gap-2">
                {(["male", "female"] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => onSupplyGender(g)}
                    className="rounded-full border border-gold-dust/35 px-4 py-1.5 text-[11px] uppercase tracking-[0.24em] text-gold-dust transition-colors hover:border-gold-light hover:bg-gold-dust/10 hover:text-gold-light"
                  >
                    {g === "male" ? (zh ? "男" : "Male") : zh ? "女" : "Female"}
                  </button>
                ))}
              </div>
            </div>
          )}
          <a
            href="/ritual"
            className="mt-4 inline-block rounded-full border border-white/12 px-4 py-1.5 text-[10px] uppercase tracking-[0.28em] text-stone-warm/60 transition-colors hover:border-gold-dust/40 hover:text-gold-dust"
          >
            {zh ? "补全出生信息" : "Complete birth data"}
          </a>
        </div>
      );
    }

    if (mode === "overview") {
      return (
        <div className="space-y-4">
          <ToneCard title={overview.title} body={overview.body} />
          <NoteList title={zh ? "优先阅读线索" : "Reading priorities"} items={overview.cues} />
        </div>
      );
    }

    if (mode === "explain") {
      if (system === "western" && westernSlot) {
        return (
          <div className="space-y-4">
            <NoteList title={explanation.title} items={explanation.items} />
            {westernSlot}
          </div>
        );
      }
      return <NoteList title={explanation.title} items={explanation.items} />;
    }

    if (system === "western") {
      return westernSlot ?? null;
    }

    if (system === "vedic") {
      const v = vedicView(snapshot.vedic.chart)!;
      return (
        <div className="space-y-4">
          <div className="rounded-2xl border border-gold-dust/20 bg-obsidian/40 p-4">
            <Label>{zh ? "恒星黄道基准" : "Sidereal frame"}</Label>
            <div className="mt-2">
              <Row
                k={zh ? "上升" : "Ascendant"}
                v={
                  v.ascSign != null
                    ? `${SIGNS[v.ascSign].g} ${zh ? SIGNS[v.ascSign].zh : SIGNS[v.ascSign].en}`
                    : "—"
                }
              />
              <Row
                k={zh ? "月宿" : "Nakshatra"}
                v={
                  v.nakshatra
                    ? `${zh ? v.nakshatra.zh : v.nakshatra.en} · pada ${v.nakshatra.pada}`
                    : "—"
                }
              />
              <Row k="Ayanāṃśa" v={`${v.ayanamsa.toFixed(2)}°`} />
            </div>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
            <Label>{zh ? "九曜落位" : "Planetary placements"}</Label>
            <ul className="mt-2 space-y-1.5">
              {v.planets.map((p) => (
                <li
                  key={p.key}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-[12px]"
                >
                  <span className="text-stone-warm/70">
                    <span className="mr-2 text-gold-light">{p.glyph}</span>
                    {zh ? p.name[1] : p.name[0]}
                  </span>
                  <span className="text-right font-serif italic text-stone-warm/90">
                    {SIGNS[p.sign].g} {zh ? SIGNS[p.sign].zh : SIGNS[p.sign].en}
                    <span className="ml-1.5 not-italic text-[10px] tracking-[0.18em] text-gold-dust/70">
                      {p.degInSign.toFixed(1)}°{p.retro ? " ℞" : ""}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      );
    }

    if (system === "bazi") {
      const b = baziView(snapshot.bazi)!;
      return (
        <div className="space-y-4">
          <div className="rounded-2xl border border-gold-dust/20 bg-obsidian/40 p-4">
            <Label>{zh ? "四柱" : "Four pillars"}</Label>
            <div className="mt-2">
              {b.pillars.map((p) => (
                <Row
                  key={p.slot}
                  k={zh ? p.label[1] : p.label[0]}
                  v={
                    <>
                      {p.stem}
                      {p.branch}
                      <span className="ml-1.5 not-italic text-[10px] tracking-[0.18em] text-gold-dust/70">
                        {p.stemElement ? (zh ? WUXING_LABEL[p.stemElement].zh : WUXING_LABEL[p.stemElement].en) : "—"}
                        {" / "}
                        {p.branchElement ? (zh ? WUXING_LABEL[p.branchElement].zh : WUXING_LABEL[p.branchElement].en) : "—"}
                        {p.animal ? ` · ${zh ? p.animal.zh : p.animal.en}` : ""}
                      </span>
                    </>
                  }
                />
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
            <Label>{zh ? "五行强弱" : "Element balance"}</Label>
            <ul className="mt-3 space-y-2">
              {WUXING_ORDER.map((k, i) => {
                const meta = WUXING_LABEL[k];
                const pct = Math.round(b.strengths[i] * 100);
                return (
                  <li key={k} className="flex items-center gap-3">
                    <span className="w-10 shrink-0 text-[11px] tracking-[0.18em] text-stone-warm/60">
                      {zh ? meta.zh : meta.en}
                    </span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/8">
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${Math.max(4, pct)}%`, background: meta.color }}
                      />
                    </span>
                    <span className="w-8 shrink-0 text-right text-[11px] text-stone-warm/50">
                      ×{b.counts[k]}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-[11px] leading-relaxed text-stone-warm/55">
              {zh ? "日主" : "Day master"}：
              <span className="text-gold-light">
                {b.dayMaster?.stem ?? "—"}
                {b.dayMaster?.element
                  ? `（${zh ? WUXING_LABEL[b.dayMaster.element].zh : WUXING_LABEL[b.dayMaster.element].en}）`
                  : ""}
              </span>
              {b.missing.length > 0 && (
                <>
                  {" · "}
                  {zh ? "缺" : "absent"}{" "}
                  {b.missing.map((m) => (zh ? WUXING_LABEL[m].zh : WUXING_LABEL[m].en)).join(zh ? "、" : ", ")}
                </>
              )}
            </p>
          </div>
        </div>
      );
    }

    const z = snapshot.ziwei.chart!;
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-gold-dust/20 bg-obsidian/40 p-4">
          <Label>{zh ? "命盘基准" : "Chart basis"}</Label>
          <div className="mt-2">
            <Row k={zh ? "阳历" : "Solar"} v={z.solar_date} />
            <Row k={zh ? "农历" : "Lunar"} v={z.lunar_date} />
            <Row k={zh ? "性别" : "Gender"} v={z.gender === "male" ? (zh ? "男" : "Male") : zh ? "女" : "Female"} />
            <Row k={zh ? "五行局" : "Element class"} v={z.five_elements_class} />
            <Row k={zh ? "命主" : "Soul star"} v={z.soul} />
            <Row k={zh ? "身主" : "Body star"} v={z.body} />
          </div>
        </div>
        <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
          <Label>{zh ? "十二宫主星" : "Twelve palaces"}</Label>
          <ul className="mt-2 space-y-1.5">
            {z.palaces.slice(0, 12).map((p, i) => (
              <li
                key={`${p.name}-${i}`}
                className={`flex items-start justify-between gap-3 rounded-xl border px-3 py-2 text-[12px] ${
                  i === z.soul_palace_index
                    ? "border-gold-dust/45 bg-gold-dust/[0.07]"
                    : "border-white/5 bg-white/[0.02]"
                }`}
              >
                <span className="shrink-0 text-stone-warm/70">
                  {p.name}
                  <span className="ml-1.5 text-[10px] tracking-[0.18em] text-stone-warm/40">
                    {p.heavenly_stem ?? ""}
                    {p.earthly_branch ?? ""}

                  </span>
                </span>
                <span className="text-right font-serif italic text-stone-warm/90">
                  {p.major_stars.length > 0
                    ? p.major_stars.map((s) => s.name).join(" · ")
                    : zh
                      ? "空宫"
                      : "empty"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  })();

  return (
    <>
      <div className="flex h-full min-h-0 flex-col rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
        {header}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">{body}</div>
      </div>
      <OverviewDrawer
        open={overviewOpen}
        onClose={() => setOverviewOpen(false)}
        overview={personalOverview}
        lang={lang}
      />
    </>
  );
}
