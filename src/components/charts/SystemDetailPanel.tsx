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

export function SystemDetailPanel({
  snapshot,
  lang,
  system,
  westernSlot,
  onSupplyGender,
}: Props) {
  const zh = lang === "zh";
  const tab = SYSTEM_TABS.find((t) => t.key === system)!;
  const ready = systemAvailability(snapshot)[system];

  const header = (
    <div className="mb-3 shrink-0">
      <Label>{zh ? "参数解读" : "Parameters"}</Label>
      <p className="mt-1.5 font-serif text-lg italic text-stone-warm">{zh ? tab.zh : tab.en}</p>
      <p className="mt-0.5 text-[11px] tracking-[0.16em] text-stone-warm/45">
        {zh ? tab.hintZh : tab.hintEn}
      </p>
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
