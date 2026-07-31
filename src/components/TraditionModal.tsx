import { useMemo } from "react";
import { useModalA11y } from "@/lib/use-modal-a11y";

import { PLANETS, ZODIAC_SIGNS, computePlanetSigns } from "@/components/charts/DestinyCharts";
import { useAccount, type SavedReading } from "@/lib/account";
import { useLang, type Lang } from "@/lib/i18n";

/**
 * Modal shown when a user clicks a tradition card on the landing page.
 *
 * When signed-out: shows the general primer for that tradition — key
 * concepts, how to read it, and how it's calculated.
 *
 * When signed-in with a saved reading: also shows a personalised panel
 * derived from the most recent saved reading.
 */

export type TraditionId = "astrology" | "jyotish" | "bazi" | "ziwei";

type Section = {
  label: [string, string];
  body: [string, string];
};

type Primer = {
  title: [string, string];
  subtitle: [string, string];
  concepts: { name: [string, string]; gloss: [string, string] }[];
  howToRead: [string, string];
  math: [string, string];
};

const PRIMERS: Record<TraditionId, Primer> = {
  astrology: {
    title: ["Western Astrology", "西方占星"],
    subtitle: [
      "Tropical zodiac · planets · houses · aspects",
      "回归黄道 · 十大行星 · 十二宫位 · 相位",
    ],
    concepts: [
      { name: ["Sun", "太阳"], gloss: ["core self, what you shine as", "核心自我 · 你所闪耀的部分"] },
      { name: ["Moon", "月亮"], gloss: ["inner life, emotional needs", "内在情感 · 你如何感到安全"] },
      { name: ["Ascendant", "上升"], gloss: ["the mask of arrival, first impression", "你面向世界的面具"] },
      { name: ["Houses 1–12", "十二宫位"], gloss: ["twelve fields of life the planets act in", "行星运作的十二个人生领域"] },
      { name: ["Aspects", "相位"], gloss: ["angular dialogue between planets (0°/60°/90°/120°/180°)", "行星之间的角度对话"] },
    ],
    howToRead: [
      "Read Sun–Moon–Ascendant first as a triad of identity, feeling, and persona. Then locate each planet in its sign (how it acts) and its house (where it acts). Finally, weigh the aspects between them — harmony aspects (60°, 120°) flow, tension aspects (90°, 180°) push growth.",
      "先读「太阳—月亮—上升」三位一体：本质、情感、外显。再看每颗行星「落在哪个星座」（如何行动）与「落在哪个宫位」（在哪里行动）。最后权衡相位：60°/120° 顺畅流动，90°/180° 张力推动成长。",
    ],
    math: [
      "Planetary longitudes are computed from Keplerian orbital elements referenced to J2000.0, then converted from heliocentric to geocentric ecliptic coordinates. Each 30° arc = one zodiac sign. The Ascendant is derived from Greenwich Mean Sidereal Time at birth.",
      "以 J2000.0 为参考，用开普勒轨道要素计算各行星的日心黄经，再变换为地心黄经；每 30° 对应一个星座。上升点由出生时的格林尼治平恒星时推算。",
    ],
  },
  jyotish: {
    title: ["Jyotish · Vedic Astrology", "印度占星 · Jyotish"],
    subtitle: [
      "Sidereal zodiac · 27 Nakshatras · Dashā time-lords",
      "恒星黄道 · 二十七宿 · Dashā 大运",
    ],
    concepts: [
      { name: ["Lagna", "上升 Lagna"], gloss: ["rising sign — the vehicle of the soul", "灵魂的载具"] },
      { name: ["Rāśi", "星座 Rāśi"], gloss: ["twelve sidereal signs (offset ≈ 24° from tropical)", "恒星十二宫（较回归黄道约偏 24°）"] },
      { name: ["Nakshatra", "二十七宿"], gloss: ["27 lunar mansions of 13°20′ each — the karmic texture", "每宿 13°20′，业力质地"] },
      { name: ["Bhāva", "十二宫 Bhāva"], gloss: ["twelve life-fields, similar to houses", "十二人生领域"] },
      { name: ["Dashā", "大运"], gloss: ["planetary time-lord periods that time events", "行星主管的时段，用以定时"] },
    ],
    howToRead: [
      "Anchor on the Moon's Nakshatra — Vedic astrology reads the psyche from the Moon, not the Sun. Then read the Lagna (rising sign) as the life's vehicle, the placement of the nine grahas, and the sequence of Dashā periods to see when the seeds of the chart ripen.",
      "以「月亮所在的 Nakshatra」为核心 —— 吠陀以月亮为主，而非太阳。再读上升（Lagna）作为此生的载具，观察九曜落宫，最后以 Dashā 大运的顺序判断种子何时开花。",
    ],
    math: [
      "The Vedic system uses the sidereal zodiac, subtracting the Lahiri ayanāṁśa (≈ 24° today) from tropical longitudes. Nakshatra index = floor(sidereal Moon longitude ÷ 13°20′). Dashā uses the Vimśottarī 120-year cycle, keyed to the Moon's Nakshatra at birth.",
      "采用恒星黄道 —— 从回归黄经减去 Lahiri 岁差（当代约 24°）。Nakshatra 序号 = ⌊恒星月亮黄经 ÷ 13°20′⌋。Dashā 使用 120 年的 Vimśottarī 循环，起点由出生时月亮所在宿决定。",
    ],
  },
  bazi: {
    title: ["BaZi · Four Pillars 八字", "八字 · 四柱"],
    subtitle: [
      "Ten Heavenly Stems · Twelve Earthly Branches · Five Elements",
      "十天干 · 十二地支 · 五行",
    ],
    concepts: [
      { name: ["日主 Day Master", "日主"], gloss: ["the stem of the day pillar — you", "日柱天干，代表本人"] },
      { name: ["五行", "五行"], gloss: ["Wood · Fire · Earth · Metal · Water — the elemental balance", "木火土金水的强弱配比"] },
      { name: ["十神", "十神"], gloss: ["ten roles around the Day Master (Officer, Wealth, Output…)", "围绕日主的十种角色（官/财/食伤…）"] },
      { name: ["格局", "格局"], gloss: ["the structural pattern the chart forms", "八字所呈现的结构形态"] },
      { name: ["大运", "大运"], gloss: ["ten-year luck cycles carrying life forward", "十年一步的运程节律"] },
    ],
    howToRead: [
      "Identify the Day Master (day-pillar stem) and its strength — that is you. Read what elements support or drain it. Locate the Ten Gods around the Day Master to see roles in life (career, wealth, spouse, output). Overlay the ten-year Great Luck pillars to see when each part of the chart activates.",
      "先定「日主」（日柱天干）——那就是你，再看其他七字对日主的生克：谁在生你、谁在耗你。以「十神」看人生角色（官/财/食伤…）。最后叠加十年一步的「大运」，看每一部分何时启动。",
    ],
    math: [
      "The moment of birth is expressed as four pillars — year, month, day, hour — each a pairing of one Heavenly Stem (10-cycle) and one Earthly Branch (12-cycle). The year pillar changes at the solar term 立春 (≈ Feb 4), not at Jan 1. The hour pillar's stem is derived from the day-stem via the 五鼠遁 rule.",
      "将出生时刻化为「年月日时」四柱，每柱是一天干（10 循环）配一地支（12 循环）。年柱以「立春」（约 2 月 4 日）为界，而非公历元旦。时柱的天干由日干通过「五鼠遁」推得。",
    ],
  },
  ziwei: {
    title: ["Zi Wei Dou Shu · Purple Star 紫微斗数", "紫微斗数"],
    subtitle: [
      "Twelve palaces · Fourteen major stars · Four transformations",
      "十二宫 · 十四主星 · 四化",
    ],
    concepts: [
      { name: ["命宫", "命宫"], gloss: ["Palace of Self — the anchor of the chart", "命盘的锚点"] },
      { name: ["身宫", "身宫"], gloss: ["Palace of Body — the emphasis of later life", "后半生的着力点"] },
      { name: ["十四主星", "十四主星"], gloss: ["fourteen main stars led by 紫微 Zi Wei", "以紫微为首的十四颗主星"] },
      { name: ["四化", "四化"], gloss: ["Lu 禄 · Quan 权 · Ke 科 · Ji 忌 — how energies transform", "禄权科忌四种转化"] },
      { name: ["大限 · 流年", "大限 · 流年"], gloss: ["ten-year Great Limits and yearly flows", "十年大限与流年"] },
    ],
    howToRead: [
      "Locate 命宫 (Palace of Self) and the main star seated there — this is the grain of your life. Then scan the twelve palaces (Wealth, Career, Marriage, Children, Health, Migration…) for their main stars and 四化 transformations. Great Limits (大限) show which palace hosts the current decade.",
      "先定「命宫」与坐守其中的主星 —— 这是你的底色。再环视十二宫（财帛、官禄、夫妻、子女、疾厄、迁移…），读它们的主星与「四化」的走向。「大限」告诉你当下十年停在哪个宫。",
    ],
    math: [
      "命宫 palace is placed by counting from 寅 (Yin) backwards through the lunar birth-month, then forwards through the birth-hour branch. The fourteen main stars are placed relative to 紫微 Zi Wei, which itself is placed from the lunar day of birth. Modern engines use the Chinese lunar calendar, not the solar year.",
      "命宫定位法：由「寅」宫起正月，逆数至农历生月；再由该月起子时顺数至生时。十四主星以「紫微」为准依表安放，紫微本身则由农历生日推得。以农历为准，而非公历。",
    ],
  },
};

// ── Personalised reading ────────────────────────────────────────────────

function personalAstrology(seed: string, lang: Lang) {
  const signs = computePlanetSigns(seed);
  const sunI = 0, moonI = 1, ascI = 11;
  const zn = (i: number) => (lang === "zh" ? ZODIAC_SIGNS[i].zh : ZODIAC_SIGNS[i].en);
  const rows: [string, string][] = [
    [
      lang === "zh" ? "太阳 · 核心自我" : "Sun · core self",
      `${PLANETS[sunI].glyph}  ${zn(signs[sunI])}`,
    ],
    [
      lang === "zh" ? "月亮 · 内在情感" : "Moon · inner life",
      `${PLANETS[moonI].glyph}  ${zn(signs[moonI])}`,
    ],
    [
      lang === "zh" ? "上升 · 外显面具" : "Ascendant · persona",
      `${PLANETS[ascI].glyph}  ${zn(signs[ascI])}`,
    ],
  ];
  return rows;
}

function personalJyotish(seed: string, lang: Lang) {
  const signs = computePlanetSigns(seed);
  // Rough Lahiri sidereal shift ≈ 24° = 0.8 sign; conservatively step back one sign.
  const moonSid = (signs[1] - 1 + 12) % 12;
  const sunSid = (signs[0] - 1 + 12) % 12;
  const zn = (i: number) => (lang === "zh" ? ZODIAC_SIGNS[i].zh : ZODIAC_SIGNS[i].en);
  return [
    [
      lang === "zh" ? "月亮 · 恒星 Rāśi" : "Moon · sidereal Rāśi",
      `☽  ${zn(moonSid)}`,
    ],
    [
      lang === "zh" ? "太阳 · 恒星 Rāśi" : "Sun · sidereal Rāśi",
      `☉  ${zn(sunSid)}`,
    ],
  ] satisfies [string, string][];
}

const STEMS_EN = ["Jia", "Yi", "Bing", "Ding", "Wu", "Ji", "Geng", "Xin", "Ren", "Gui"];
const STEMS_ZH = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const BRANCHES_EN = ["Zi", "Chou", "Yin", "Mao", "Chen", "Si", "Wu", "Wei", "Shen", "You", "Xu", "Hai"];
const BRANCHES_ZH = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];

function parseBirth(seed: string) {
  const parts = (seed || "").split("|");
  const dateStr = parts[1] ?? "";
  const timeStr = parts[2] ?? "";
  const dm = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const tm = timeStr.match(/^(\d{1,2}):(\d{2})/);
  if (!dm) return null;
  return {
    y: +dm[1],
    mo: +dm[2],
    da: +dm[3],
    hh: tm ? +tm[1] : 12,
    mi: tm ? +tm[2] : 0,
  };
}

function personalBazi(seed: string, lang: Lang): [string, string][] | null {
  const b = parseBirth(seed);
  if (!b) return null;
  // Solar new year (立春 ≈ Feb 4) delimits the year pillar.
  let y = b.y;
  if (b.mo === 1 || (b.mo === 2 && b.da < 4)) y -= 1;
  const stemIdx = ((y - 4) % 10 + 10) % 10;
  const branchIdx = ((y - 4) % 12 + 12) % 12;
  // Hour branch: 子 = 23:00–01:00.
  const hourBranch = Math.floor(((b.hh + 1) % 24) / 2);
  const stem = lang === "zh" ? STEMS_ZH[stemIdx] : STEMS_EN[stemIdx];
  const branch = lang === "zh" ? BRANCHES_ZH[branchIdx] : BRANCHES_EN[branchIdx];
  const hourB = lang === "zh" ? BRANCHES_ZH[hourBranch] : BRANCHES_EN[hourBranch];
  return [
    [lang === "zh" ? "年柱（依立春）" : "Year pillar (from 立春)", `${stem} ${branch}`],
    [lang === "zh" ? "时支" : "Hour branch", hourB],
    [
      lang === "zh" ? "备注" : "Note",
      lang === "zh"
        ? "月柱与日柱需万年历精算，此处仅示年柱与时支。"
        : "Month and day pillars require an almanac; only year pillar and hour branch shown.",
    ],
  ];
}

function personalZiwei(seed: string, lang: Lang): [string, string][] | null {
  const b = parseBirth(seed);
  if (!b) return null;
  // Approximation using solar month for the lunar month (real Ziwei uses lunar calendar).
  const hourBranch = Math.floor(((b.hh + 1) % 24) / 2);
  // 命宫 = 寅 (index 2) − (month − 1) + hourBranch (mod 12)
  const mingIdx = ((2 - (b.mo - 1) + hourBranch) % 12 + 12) % 12;
  const shenIdx = ((2 - (b.mo - 1) - hourBranch) % 12 + 12) % 12;
  const bn = (i: number) => (lang === "zh" ? BRANCHES_ZH[i] : BRANCHES_EN[i]);
  return [
    [lang === "zh" ? "命宫（近似）" : "Palace of Self (approx.)", bn(mingIdx)],
    [lang === "zh" ? "身宫（近似）" : "Palace of Body (approx.)", bn(shenIdx)],
    [
      lang === "zh" ? "备注" : "Note",
      lang === "zh"
        ? "精确紫微斗数须以农历生辰起盘，此处以公历近似。"
        : "Exact Zi Wei requires the lunar calendar; solar-date approximation shown.",
    ],
  ];
}

function personalFor(id: TraditionId, seed: string, lang: Lang): [string, string][] | null {
  if (id === "astrology") return personalAstrology(seed, lang);
  if (id === "jyotish") return personalJyotish(seed, lang);
  if (id === "bazi") return personalBazi(seed, lang);
  if (id === "ziwei") return personalZiwei(seed, lang);
  return null;
}

// Short personalized analysis paragraph derived from placements.
function personalAnalysis(id: TraditionId, seed: string, lang: Lang): string | null {
  const b = parseBirth(seed);
  if (id === "astrology") {
    const s = computePlanetSigns(seed);
    const elements = ["fire", "earth", "air", "water"] as const;
    const elEn = ["fire", "earth", "air", "water"];
    const elZh = ["火", "土", "风", "水"];
    const sunEl = elements[s[0] % 4];
    const moonEl = elements[s[1] % 4];
    const ascEl = elements[s[11] % 4];
    if (lang === "zh") {
      return `你的太阳属${elZh[s[0] % 4]}、月亮属${elZh[s[1] % 4]}、上升属${elZh[s[11] % 4]}。这意味着你外显的行动力与内在情感来自不同元素 —— 表达时锐利，感受时却柔软。上升为${elZh[s[11] % 4]}让世界最先看到的是你的这一层「面具」，而真正驱动你的核心，仍是太阳与月亮的对话。`;
    }
    return `Your Sun is ${sunEl}, Moon is ${moonEl}, Ascendant is ${ascEl}. That means the way you act and the way you feel are drawn from different elements — sharper on the outside, softer within. The world first meets the ${ascEl} mask; the real engine is the dialogue between your ${sunEl} Sun and ${moonEl} Moon.`;
  }
  if (id === "jyotish") {
    const s = computePlanetSigns(seed);
    const moonSid = (s[1] - 1 + 12) % 12;
    const nakIdx = ((moonSid * 9) / 4) | 0; // rough index 0-26
    if (lang === "zh") {
      return `你的月亮落在恒星黄道的第 ${moonSid + 1} 宫，对应约第 ${nakIdx + 1} 宿。此宿的能量偏向内省与深耕 —— 命盘倾向于把你的心理生活安放在「守」而非「取」的一面。Vimśottarī 大运的起点与月宿一致，因此你的运程节律，从出生那一刻就已被这颗月亮定下节拍。`;
    }
    return `Your Moon sits in sidereal sign #${moonSid + 1}, roughly Nakshatra #${nakIdx + 1}. That mansion leans toward inwardness and slow cultivation — the chart places your psychological life on the "holding" side rather than the "grasping" one. Because Vimśottarī Dashā keys off the Moon's Nakshatra, this single placement sets the rhythm of your entire life's timing.`;
  }
  if (id === "bazi") {
    if (!b) return null;
    let y = b.y;
    if (b.mo === 1 || (b.mo === 2 && b.da < 4)) y -= 1;
    const stemIdx = ((y - 4) % 10 + 10) % 10;
    const yang = stemIdx % 2 === 0;
    const elIdx = Math.floor(stemIdx / 2);
    const elEn = ["Wood", "Fire", "Earth", "Metal", "Water"][elIdx];
    const elZh = ["木", "火", "土", "金", "水"][elIdx];
    if (lang === "zh") {
      return `你的年干显示为${yang ? "阳" : "阴"}${elZh} —— 这是一枚倾向${yang ? "外扩、行动" : "内敛、蓄势"}的种子。${elZh}性主${elIdx === 0 ? "生长与规划" : elIdx === 1 ? "热情与表达" : elIdx === 2 ? "承载与稳定" : elIdx === 3 ? "决断与结构" : "流动与直觉"}，配合你的时支落位，大运会在青壮年段先启用${yang ? "官星与财星" : "食伤与印星"}的一面。`;
    }
    return `Your year stem shows ${yang ? "yang" : "yin"} ${elEn} — a seed that leans toward ${yang ? "outward action" : "inward gathering"}. ${elEn} governs ${elIdx === 0 ? "growth and planning" : elIdx === 1 ? "warmth and expression" : elIdx === 2 ? "carrying and stability" : elIdx === 3 ? "decisiveness and structure" : "flow and intuition"}. Paired with your hour branch, the great luck cycles tend to activate ${yang ? "Officer / Wealth" : "Output / Resource"} stars first through your middle years.`;
  }
  if (id === "ziwei") {
    if (!b) return null;
    const hourBranch = Math.floor(((b.hh + 1) % 24) / 2);
    const mingIdx = ((2 - (b.mo - 1) + hourBranch) % 12 + 12) % 12;
    const branchEn = BRANCHES_EN[mingIdx];
    const branchZh = BRANCHES_ZH[mingIdx];
    if (lang === "zh") {
      return `你的命宫近似落在「${branchZh}」宫。此位偏向${mingIdx < 4 ? "稳重、根基型的自我" : mingIdx < 8 ? "外扩、社交型的自我" : "内省、修持型的自我"}。紫微斗数把「命宫」视为你人生剧本的锚点，其他十一宫都以此为坐标。大限每十年顺行一宫，故你能透过命宫主星预判每个十年的主题走向。`;
    }
    return `Your Palace of Self falls near the ${branchEn} branch. That position leans toward ${mingIdx < 4 ? "a rooted, grounded self" : mingIdx < 8 ? "an outward, socially engaged self" : "an inward, reflective self"}. Zi Wei treats 命宫 as the anchor of the chart — every other palace is read against it. Great Limits advance one palace per decade, so this single placement lets you preview the theme of every ten-year chapter.`;
  }
  return null;
}


// ────────────────────────────────────────────────────────────────────────

export function TraditionModal({
  id,
  onClose,
}: {
  id: TraditionId | null;
  onClose: () => void;
}) {
  const { lang } = useLang();
  const { account, saved } = useAccount();
  const li = lang === "zh" ? 1 : 0;

  const reading: SavedReading | undefined = saved[0];
  const seed = useMemo(() => {
    if (!reading) return "";
    return `${reading.name || ""}|${reading.date || ""}|${reading.time || ""}|${reading.place || ""}`;
  }, [reading]);

  const dialogRef = useModalA11y<HTMLDivElement>({ open: !!id, onClose });


  if (!id) return null;
  const p = PRIMERS[id];
  const personal = account && seed ? personalFor(id, seed, lang) : null;
  const analysis = account && seed ? personalAnalysis(id, seed, lang) : null;

  const sections: Section[] = [
    {
      label: [`How to read`, `如何解读`],
      body: p.howToRead,
    },
    {
      label: [`How it's calculated`, `如何推算`],
      body: p.math,
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tradition-modal-title"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-obsidian/85 px-4 py-8 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-gold-dust/25 bg-void-blue/95 p-6 md:p-10"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={lang === "zh" ? "关闭" : "Close"}
          className="absolute right-4 top-4 grid size-9 place-items-center rounded-full border border-white/10 text-stone-warm/70 hover:border-gold-dust hover:text-gold-dust"
        >
          ✕
        </button>

        <p className="mb-3 text-[10px] uppercase tracking-[0.42em] text-gold-dust">
          {p.subtitle[li]}
        </p>
        <h2
          id="tradition-modal-title"
          className="mb-8 font-serif text-3xl italic text-stone-warm md:text-4xl"
        >
          {p.title[li]}
        </h2>

        {/* Personal panel — only when signed in with a saved reading */}
        {personal && (
          <div className="mb-8 rounded-2xl border border-gold-dust/40 bg-gold-dust/[0.05] p-5">
            <p className="mb-3 text-[10px] uppercase tracking-[0.32em] text-gold-light">
              {lang === "zh"
                ? `你的解读 · ${reading?.name || "本命"}`
                : `Your reading · ${reading?.name || "you"}`}
            </p>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm md:grid-cols-2">
              {personal.map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-4 border-b border-white/5 py-1.5">
                  <dt className="text-stone-warm/55">{k}</dt>
                  <dd className="text-right font-serif text-gold-light">{v}</dd>
                </div>
              ))}
            </dl>
            {analysis && (
              <div className="mt-5 rounded-xl border border-white/10 bg-obsidian/40 p-4">
                <p className="mb-2 text-[9px] uppercase tracking-[0.32em] text-gold-dust/70">
                  {lang === "zh" ? "简短分析" : "Short analysis"}
                </p>
                <p className="text-sm leading-relaxed text-stone-warm/85">{analysis}</p>
              </div>
            )}
          </div>
        )}


        {!account && (
          <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-nebula-purple/35 bg-nebula-purple/[0.08] px-5 py-3 text-sm text-stone-warm/75">
            <span>
              {lang === "zh"
                ? "登录后，这里会显示你在此体系下的具体落位。"
                : "Sign in to see your own placements inside this tradition here."}
            </span>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined")
                  window.dispatchEvent(new Event("lod:open-account"));
              }}
              className="rounded-full border border-gold-dust/40 px-4 py-1.5 text-[10px] uppercase tracking-[0.32em] text-gold-dust hover:bg-gold-dust/10"
            >
              {lang === "zh" ? "登录 / 创建" : "Sign in / Create"}
            </button>
          </div>
        )}

        {account && !seed && (
          <div className="mb-8 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm text-stone-warm/70">
            {lang === "zh"
              ? "尚未保存过解读 —— 完成一次仪式后，这里会自动填入你的落位。"
              : "No saved reading yet — complete the ritual once and your placements will appear here."}
          </div>
        )}

        {/* Key concepts */}
        <p className="mb-3 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
          {lang === "zh" ? "核心概念" : "Key concepts"}
        </p>
        <ul className="mb-8 space-y-2 text-sm text-stone-warm/80">
          {p.concepts.map((c) => (
            <li key={c.name[0]} className="flex justify-between gap-6 border-b border-white/5 pb-2">
              <span className="font-serif text-gold-light">{c.name[li]}</span>
              <span className="text-right text-stone-warm/60">{c.gloss[li]}</span>
            </li>
          ))}
        </ul>

        {sections.map((s) => (
          <section key={s.label[0]} className="mb-6">
            <p className="mb-2 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
              {s.label[li]}
            </p>
            <p className="text-sm leading-relaxed text-stone-warm/75">{s.body[li]}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
