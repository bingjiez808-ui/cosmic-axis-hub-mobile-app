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
import { useMemo, useState } from "react";
import type { CalculationSnapshot } from "@/lib/calc-snapshot";
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

type DetailMode = "parameters" | "overview" | "explain";

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

function systemOverview(snapshot: CalculationSnapshot, system: SystemKey, lang: "en" | "zh") {
  const zh = lang === "zh";
  if (system === "western") {
    return {
      title: zh ? "西方星盘总体解读" : "Western overview",
      body: zh
        ? "西方星盘负责读你的心理结构：行星代表功能，星座代表表达方式，宫位代表发生场景，相位代表不同功能之间是顺流还是拉扯。它最适合回答：我为什么这样反应、我的动机从哪里来、哪些能力需要被看见。"
        : "The western wheel reads psychological architecture: planets are functions, signs are styles, houses are life arenas, and aspects show whether those functions flow or wrestle.",
      cues: zh
        ? ["先看太阳/月亮/上升，判断核心气质、情绪需求和外显姿态。", "再看金星/火星/水星，判断关系、行动与表达。", "最后看相位，找出天赋通道与成长压力。"]
        : ["Start with Sun, Moon and Ascendant.", "Then read Venus, Mars and Mercury.", "Use aspects to separate gifts from growth pressure."],
    };
  }
  if (system === "vedic") {
    const v = vedicView(snapshot.vedic.chart);
    const moon = v?.nakshatra ? (zh ? v.nakshatra.zh : v.nakshatra.en) : null;
    return {
      title: zh ? "印度占星总体解读" : "Vedic overview",
      body: zh
        ? `印度占星把同一片天空放回恒星背景，重点观察月亮、月宿与上升。它更像一张人生节奏图，适合看长期倾向、内在习性和阶段性课题${moon ? `；本盘月宿落在「${moon}」，优先提示情绪惯性与本能选择方式。` : "。"}`
        : `Vedic astrology reads the same sky against fixed stars, emphasizing Moon, Nakshatra and Ascendant${moon ? `; the Moon's nakshatra is ${moon}.` : "."}`,
      cues: zh
        ? ["月宿显示本能反应与安全感入口。", "上升与九曜落位显示人生课题落在哪些场域。", "逆行星或集中星座会成为长期反复阅读的重点。"]
        : ["Moon nakshatra shows instinct and safety needs.", "Ascendant and planets place themes into life arenas.", "Retrogrades or clusters deserve repeated attention."],
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
        ? `八字把出生时刻压缩成四柱，重点读日主、五行强弱与四柱之间的资源流动${day ? `；本盘日主为「${day}」，它是整张八字的中心。` : "。"}${missing ? ` 五行中较少见到「${missing}」，可作为后续阅读的补充线索。` : ""}`
        : `BaZi compresses birth time into four pillars, centering on the Day Master and the movement of five elements${day ? `; this chart's Day Master is ${day}.` : "."}`,
      cues: zh
        ? ["年柱偏外部环境与早年背景。", "月柱看成长压力、资源与社会节奏。", "日柱是自我核心，时柱延伸到行动方式与未来展开。"]
        : ["Year pillar frames background.", "Month pillar shows resources and social rhythm.", "Day is the self core; hour extends into action and future."],
    };
  }
  const z = snapshot.ziwei.chart;
  const soulPalace = z?.palaces[z.soul_palace_index];
  const stars = soulPalace?.major_stars.map((s) => s.name).join(" · ");
  return {
    title: zh ? "紫微斗数总体解读" : "Zi Wei overview",
    body: zh
      ? `紫微斗数把人生拆成十二个宫位，重点看命宫、身宫、主星组合与宫位之间的呼应${soulPalace ? `；本盘命宫在「${soulPalace.name}」${stars ? `，主星为「${stars}」` : ""}。` : "。"}它适合把抽象性格落到关系、事业、财帛、迁移等具体生活场景。`
      : `Zi Wei maps life into twelve palaces, emphasizing the soul palace, body palace and major stars${soulPalace ? `; the soul palace is ${soulPalace.name}${stars ? ` with ${stars}` : ""}.` : "."}`,
    cues: zh
      ? ["命宫看核心气质与人生主调。", "身宫看实际行动方式与后天落点。", "财帛、官禄、夫妻、迁移等宫位把问题拆到具体场景。"]
      : ["Soul palace shows the life tone.", "Body palace shows enacted behavior.", "Career, wealth, partner and travel palaces ground the reading."],
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

export function SystemDetailPanel({
  snapshot,
  lang,
  system,
  westernSlot,
  onSupplyGender,
}: Props) {
  const zh = lang === "zh";
  const [mode, setMode] = useState<DetailMode>("parameters");
  const tab = SYSTEM_TABS.find((t) => t.key === system)!;
  const ready = systemAvailability(snapshot)[system];
  const overview = useMemo(() => systemOverview(snapshot, system, lang), [snapshot, system, lang]);
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
            onClick={() => setMode(item.key as DetailMode)}
            className={`min-h-8 rounded-full px-2 text-[10px] font-medium tracking-[0.12em] transition-colors ${
              mode === item.key
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
    <div className="flex h-full min-h-0 flex-col rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
      {header}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">{body}</div>
    </div>
  );
}
