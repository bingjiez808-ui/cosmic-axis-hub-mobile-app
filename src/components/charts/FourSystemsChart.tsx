/**
 * FourSystemsChart — the switchable "命盘 · 四大体系" viewer.
 *
 * One stage, four visualisations (Western wheel / Vedic mandala /
 * BaZi four pillars + Wu Xing / Zi Wei twelve palaces). The stage itself
 * is interactive: drag to rotate (or to pan in 拖拽 mode), wheel or the
 * ± buttons to zoom, arrow keys for fine rotation, and a reset control.
 *
 * All numbers come from the calculation snapshot; a system that cannot be
 * computed renders an explicit reason instead of invented data.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { NatalWheel } from "@/components/charts/DestinyCharts";
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
  ziweiCells,
  type SystemKey,
} from "@/lib/four-systems-view";

type Props = {
  snapshot: CalculationSnapshot;
  seed: string;
  lang: "en" | "zh";
  size?: number;
  selectedPlanet?: number | null;
  onSelectPlanet?: (idx: number | null) => void;
  /** Controlled active system (when the tab bar lives outside this component). */
  active?: SystemKey;
  onActiveChange?: (key: SystemKey) => void;
  /** Hide the built-in switcher — used when the tabs are rendered above. */
  hideTabs?: boolean;
  /** Force the stage height (defaults to size + 56). */
  stageHeight?: number;
};

type Mode = "rotate" | "drag";

const MIN_SCALE = 0.6;
const MAX_SCALE = 2.4;

export function FourSystemsChart({
  snapshot,
  seed,
  lang,
  size = 380,
  selectedPlanet = null,
  onSelectPlanet,
  active: activeProp,
  onActiveChange,
  hideTabs = false,
  stageHeight,
}: Props) {
  const zh = lang === "zh";
  const availability = useMemo(() => systemAvailability(snapshot), [snapshot]);
  const [activeLocal, setActiveLocal] = useState<SystemKey>("western");
  const active = activeProp ?? activeLocal;
  const setActive = useCallback(
    (k: SystemKey) => {
      setActiveLocal(k);
      onActiveChange?.(k);
    },
    [onActiveChange],
  );
  const [mode, setMode] = useState<Mode>("rotate");

  const [rotation, setRotation] = useState(0);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });


  const stageRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{
    id: number;
    startAngle: number;
    startRotation: number;
    startX: number;
    startY: number;
    startOffset: { x: number; y: number };
    moved: boolean;
  } | null>(null);
  const [dragging, setDragging] = useState(false);

  const reset = useCallback(() => {
    setRotation(0);
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  // Switching system starts from a neutral view.
  useEffect(() => {
    reset();
  }, [active, reset]);

  const angleFor = (e: { clientX: number; clientY: number }) => {
    const box = stageRef.current?.getBoundingClientRect();
    if (!box) return 0;
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    return (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI;
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    drag.current = {
      id: e.pointerId,
      startAngle: angleFor(e),
      startRotation: rotation,
      startX: e.clientX,
      startY: e.clientY,
      startOffset: offset,
      moved: false,
    };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < 5) return;
    if (!d.moved) {
      d.moved = true;
      setDragging(true);
      // Capture only once a real drag starts, so taps still reach the SVG.
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    const panMode = mode === "drag" || e.shiftKey;
    if (panMode) {
      setOffset({ x: d.startOffset.x + dx, y: d.startOffset.y + dy });
    } else {
      let delta = angleFor(e) - d.startAngle;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      setRotation(d.startRotation + delta);
    }
  };

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    if (d.moved && e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    drag.current = null;
    setDragging(false);
  };

  const onWheel = (e: ReactWheelEvent<HTMLDivElement>) => {
    if (!e.ctrlKey && !e.metaKey && Math.abs(e.deltaY) < 2) return;
    setScale((s) => clamp(s - e.deltaY * 0.0015, MIN_SCALE, MAX_SCALE));
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") { setRotation((r) => r - 5); e.preventDefault(); }
    if (e.key === "ArrowRight") { setRotation((r) => r + 5); e.preventDefault(); }
    if (e.key === "ArrowUp") { setScale((s) => clamp(s + 0.1, MIN_SCALE, MAX_SCALE)); e.preventDefault(); }
    if (e.key === "ArrowDown") { setScale((s) => clamp(s - 0.1, MIN_SCALE, MAX_SCALE)); e.preventDefault(); }
    if (e.key.toLowerCase() === "r") reset();
  };

  const body = (() => {
    if (!availability[active]) {
      return (
        <UnavailableCard text={unavailableReason(snapshot, active, lang)} lang={lang} />
      );
    }
    switch (active) {
      case "western":
        return (
          <NatalWheel
            lang={lang}
            seed={seed}
            size={size}
            selectedPlanet={selectedPlanet}
            onSelectPlanet={onSelectPlanet}
          />
        );
      case "vedic":
        return <VedicMandala view={vedicView(snapshot.vedic.chart)!} lang={lang} size={size} />;
      case "bazi":
        return <BaziPillars view={baziView(snapshot.bazi)!} lang={lang} size={size} />;
      case "ziwei":
        return <ZiweiSquare chart={snapshot.ziwei.chart!} lang={lang} size={size} />;
      default:
        return null;
    }
  })();

  return (
    <div className="w-full">
      {/* System switcher */}
      {!hideTabs && (
        <div
          role="tablist"
          aria-label={zh ? "四大体系可视化" : "Four systems"}
          className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4"
        >
          {SYSTEM_TABS.map((t) => {
            const on = active === t.key;
            const ready = availability[t.key];
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={on}
                onClick={() => setActive(t.key)}
                className={`rounded-2xl border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-light ${
                  on
                    ? "border-gold-dust/60 bg-gold-dust/10 text-gold-light"
                    : "border-white/10 bg-white/[0.02] text-stone-warm/70 hover:border-gold-dust/30 hover:text-stone-warm"
                }`}
              >
                <span className="block text-xs font-medium tracking-wide sm:text-sm">
                  {zh ? t.zh : t.en}
                </span>
                <span className="mt-0.5 block text-[10px] tracking-wide text-stone-warm/45">
                  {ready ? (zh ? t.hintZh : t.hintEn) : zh ? "数据不足" : "not available"}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Interactive stage */}
      <div
        ref={stageRef}
        role="application"
        tabIndex={0}
        aria-label={zh ? "命盘可视化：拖动旋转，滚轮缩放" : "Chart viewer: drag to rotate, scroll to zoom"}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onWheel={onWheel}
        onKeyDown={onKeyDown}
        className="relative mx-auto flex w-full touch-none select-none items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-light"
        style={{
          height: stageHeight ?? size + 56,
          cursor: dragging ? "grabbing" : mode === "drag" ? "grab" : "crosshair",
        }}
      >

        <div
          className="flex items-center justify-center"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) rotate(${rotation}deg) scale(${scale})`,
            transition: dragging ? "none" : "transform 220ms ease-out",
            transformOrigin: "center center",
          }}
        >
          {body}
        </div>
      </div>

      {/* Controls */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[10px] uppercase tracking-[0.24em] text-stone-warm/60">
        <div className="flex overflow-hidden rounded-full border border-white/12">
          {(["rotate", "drag"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`px-3 py-1.5 transition-colors ${
                mode === m ? "bg-gold-dust/15 text-gold-light" : "text-stone-warm/60 hover:text-stone-warm"
              }`}
            >
              {m === "rotate" ? (zh ? "旋转" : "Rotate") : zh ? "拖拽" : "Drag"}
            </button>
          ))}
        </div>
        <CtrlBtn onClick={() => setRotation((r) => r - 15)} label="⟲" />
        <CtrlBtn onClick={() => setRotation((r) => r + 15)} label="⟳" />
        <CtrlBtn onClick={() => setScale((s) => clamp(s - 0.15, MIN_SCALE, MAX_SCALE))} label="−" />
        <CtrlBtn onClick={() => setScale((s) => clamp(s + 0.15, MIN_SCALE, MAX_SCALE))} label="+" />
        <button
          onClick={reset}
          className="rounded-full border border-gold-dust/30 px-3 py-1.5 text-gold-dust/80 transition-colors hover:border-gold-light hover:text-gold-light"
        >
          {zh ? "复位" : "Reset"}
        </button>
      </div>
      <p className="mt-2 text-center text-[11px] leading-relaxed text-stone-warm/45">
        {zh
          ? "拖动盘面可旋转，切换到「拖拽」或按住 Shift 可平移；滚轮缩放，方向键微调，按 R 复位。"
          : "Drag the chart to rotate; switch to Drag (or hold Shift) to pan. Scroll to zoom, arrow keys to fine-tune, press R to reset."}
      </p>
    </div>
  );
}

function CtrlBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="h-8 w-8 rounded-full border border-white/12 text-sm text-stone-warm/70 transition-colors hover:border-gold-dust/50 hover:text-gold-light"
    >
      {label}
    </button>
  );
}

function UnavailableCard({ text, lang }: { text: string; lang: "en" | "zh" }) {
  return (
    <div className="mx-auto max-w-sm px-6 text-center">
      <p className="font-serif text-lg italic text-stone-warm/70">
        {lang === "zh" ? "这一体系尚未推算" : "Not computed yet"}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-stone-warm/50">{text}</p>
    </div>
  );
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/* ─────────────────────────────────────────────────────────────
 * Vedic mandala — sidereal zodiac ring + 27 nakshatra ticks.
 * ────────────────────────────────────────────────────────── */
function VedicMandala({
  view,
  lang,
  size,
}: {
  view: ReturnType<typeof vedicView> & object;
  lang: "en" | "zh";
  size: number;
}) {
  const zh = lang === "zh";
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size / 2 - 4;
  const rSign = size / 2 - 36;
  const rNak = size / 2 - 58;
  const rPlanet = size / 2 - 96;
  const [hover, setHover] = useState<string | null>(null);
  const pol = (r: number, deg: number) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as const;
  };
  const stacked: Record<number, number> = {};
  const active = view.planets.find((p) => p.key === hover) ?? null;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img"
      aria-label={zh ? "印度曼陀罗盘" : "Vedic mandala chart"}>
      <circle cx={cx} cy={cy} r={rOuter} fill="none" stroke="var(--gold-dust)" strokeOpacity={0.35} />
      <circle cx={cx} cy={cy} r={rSign} fill="none" stroke="currentColor" strokeOpacity={0.16} />
      <circle cx={cx} cy={cy} r={rNak} fill="none" stroke="currentColor" strokeOpacity={0.1} />

      {/* 27 nakshatra ticks */}
      {Array.from({ length: 27 }).map((_, i) => {
        const deg = i * (360 / 27);
        const [x1, y1] = pol(rSign, deg);
        const [x2, y2] = pol(rNak, deg);
        const on = view.nakshatra?.index === i;
        return (
          <line key={`nak-${i}`} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={on ? "var(--gold-light)" : "currentColor"}
            strokeOpacity={on ? 0.9 : 0.18} strokeWidth={on ? 2 : 1} />
        );
      })}

      {/* 12 sidereal signs */}
      {SIGNS.map((s, i) => {
        const mid = i * 30 + 15;
        const [x1, y1] = pol(rOuter, i * 30);
        const [x2, y2] = pol(rSign, i * 30);
        const [gx, gy] = pol((rOuter + rSign) / 2, mid);
        const isAsc = view.ascSign === i;
        return (
          <g key={s.en}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeOpacity={0.2} />
            <text x={gx} y={gy + 5} textAnchor="middle" fontSize={14}
              fill={isAsc ? "var(--gold-light)" : "var(--stone-warm)"} opacity={isAsc ? 1 : 0.6}>
              {s.g}
            </text>
          </g>
        );
      })}

      {/* Ascendant marker */}
      {view.ascLon != null && (() => {
        const [x, y] = pol(rOuter, view.ascLon);
        return <circle cx={x} cy={y} r={4} fill="var(--gold-light)" />;
      })()}

      {/* Planets */}
      {view.planets.map((p) => {
        const bucket = Math.floor(p.lon / 10);
        const n = stacked[bucket] ?? 0;
        stacked[bucket] = n + 1;
        const [x, y] = pol(rPlanet - n * 22, p.lon);
        const on = hover === p.key;
        return (
          <g key={p.key} onMouseEnter={() => setHover(p.key)} onMouseLeave={() => setHover(null)}
            onClick={() => setHover((h) => (h === p.key ? null : p.key))} style={{ cursor: "pointer" }}>
            <circle cx={x} cy={y} r={13} fill="var(--obsidian)" fillOpacity={on ? 0.95 : 0.75}
              stroke={on ? "var(--gold-light)" : "var(--gold-dust)"} strokeOpacity={on ? 1 : 0.4} />
            <text x={x} y={y + 5} textAnchor="middle" fontSize={13}
              fill={on ? "var(--gold-light)" : "var(--stone-warm)"}>{p.glyph}</text>
          </g>
        );
      })}

      {/* Centre readout */}
      <foreignObject x={cx - rPlanet + 20} y={cy - 52} width={(rPlanet - 20) * 2} height={104}>
        <div className="flex h-full flex-col items-center justify-center text-center">
          {active ? (
            <>
              <p className="text-[10px] uppercase tracking-[0.28em] text-gold-dust/70">
                {zh ? active.name[1] : active.name[0]}
              </p>
              <p className="mt-1 font-serif text-lg italic text-stone-warm">
                {SIGNS[active.sign].g} {zh ? SIGNS[active.sign].zh : SIGNS[active.sign].en}
              </p>
              <p className="mt-1 text-[10px] tracking-[0.2em] text-stone-warm/50">
                {active.degInSign.toFixed(1)}° {active.retro ? "℞" : ""}
              </p>
            </>
          ) : (
            <>
              <p className="font-serif text-base italic text-stone-warm/85">
                {zh ? "恒星黄道盘" : "Sidereal chart"}
              </p>
              {view.nakshatra && (
                <p className="mt-1 text-[10px] leading-relaxed tracking-[0.18em] text-stone-warm/50">
                  {zh ? "月宿" : "Nakshatra"} · {zh ? view.nakshatra.zh : view.nakshatra.en} · pada {view.nakshatra.pada}
                </p>
              )}
              <p className="mt-1 text-[9px] tracking-[0.18em] text-stone-warm/35">
                Ayanāṃśa {view.ayanamsa.toFixed(2)}°
              </p>
            </>
          )}
        </div>
      </foreignObject>
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────
 * BaZi — four pillars + Wu Xing pentagon.
 * ────────────────────────────────────────────────────────── */
function BaziPillars({
  view,
  lang,
  size,
}: {
  view: NonNullable<ReturnType<typeof baziView>>;
  lang: "en" | "zh";
  size: number;
}) {
  const zh = lang === "zh";
  const [hover, setHover] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-center gap-4" style={{ width: size }}>
      <div className="flex w-full justify-center gap-2">
        {view.pillars.map((p) => {
          const on = hover === p.slot;
          const stemColor = p.stemElement ? WUXING_LABEL[p.stemElement].color : "var(--stone-warm)";
          const branchColor = p.branchElement ? WUXING_LABEL[p.branchElement].color : "var(--stone-warm)";
          return (
            <button
              key={p.slot}
              onMouseEnter={() => setHover(p.slot)}
              onMouseLeave={() => setHover(null)}
              onClick={() => setHover((h) => (h === p.slot ? null : p.slot))}
              className={`flex flex-1 flex-col items-center gap-1 rounded-2xl border px-1 py-2 transition-colors ${
                p.isDayMaster
                  ? "border-gold-dust/55 bg-gold-dust/10"
                  : on
                    ? "border-gold-dust/35 bg-white/[0.04]"
                    : "border-white/10 bg-white/[0.02]"
              }`}
            >
              <span className="text-[9px] uppercase tracking-[0.2em] text-stone-warm/45">
                {zh ? p.label[1] : p.label[0]}
              </span>
              <span className="font-serif text-2xl" style={{ color: stemColor }}>{p.stem}</span>
              <span className="font-serif text-2xl" style={{ color: branchColor }}>{p.branch}</span>
              <span className="text-[9px] tracking-[0.16em] text-stone-warm/40">
                {p.animal ? (zh ? p.animal.zh : p.animal.en) : "—"}
              </span>
            </button>
          );
        })}
      </div>

      <WuXingPentagon strengths={view.strengths} counts={view.counts} lang={lang} size={Math.min(size, 250)} />

      <p className="px-2 text-center text-[11px] leading-relaxed text-stone-warm/55">
        {view.dayMaster
          ? zh
            ? `日主 ${view.dayMaster.stem}（${view.dayMaster.element ? WUXING_LABEL[view.dayMaster.element].zh : "—"}）`
            : `Day master ${view.dayMaster.stem} (${view.dayMaster.element ? WUXING_LABEL[view.dayMaster.element].en : "—"})`
          : ""}
        {view.missing.length > 0 &&
          (zh
            ? ` · 缺${view.missing.map((m) => WUXING_LABEL[m].zh).join("、")}`
            : ` · missing ${view.missing.map((m) => WUXING_LABEL[m].en).join(", ")}`)}
      </p>
    </div>
  );
}

function WuXingPentagon({
  strengths,
  counts,
  lang,
  size,
}: {
  strengths: [number, number, number, number, number];
  counts: Record<string, number>;
  lang: "en" | "zh";
  size: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 34;
  const pts = WUXING_ORDER.map((_, i) => {
    const a = ((i * 72 - 90) * Math.PI) / 180;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as const;
  });
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img"
      aria-label={lang === "zh" ? "五行强弱" : "Wu Xing balance"}>
      <polygon points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke="currentColor" strokeOpacity={0.15} />
      <polygon
        points={[pts[0], pts[2], pts[4], pts[1], pts[3]].map((p) => p.join(",")).join(" ")}
        fill="none" stroke="var(--gold-dust)" strokeOpacity={0.22} strokeDasharray="2 4"
      />
      {WUXING_ORDER.map((key, i) => {
        const [x, y] = pts[i];
        const meta = WUXING_LABEL[key];
        const s = strengths[i];
        return (
          <g key={key}>
            <circle cx={x} cy={y} r={7 + s * 17} fill={meta.color} fillOpacity={0.55}
              stroke={meta.color} strokeOpacity={0.9} />
            <text x={x} y={y + 5} textAnchor="middle" fontSize={13} fill="var(--obsidian)">{meta.zh}</text>
            <text x={x} y={y + 34} textAnchor="middle" fontSize={9} fill="var(--stone-warm)" opacity={0.55}>
              {(lang === "zh" ? meta.zh : meta.en) + " " + (counts[key] ?? 0)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Zi Wei — classical 4×4 square of twelve palaces.
 * ────────────────────────────────────────────────────────── */
function ZiweiSquare({
  chart,
  lang,
  size,
}: {
  chart: NonNullable<CalculationSnapshot["ziwei"]["chart"]>;
  lang: "en" | "zh";
  size: number;
}) {
  const zh = lang === "zh";
  const cells = useMemo(() => ziweiCells(chart), [chart]);
  const [active, setActive] = useState<number | null>(null);
  const cell = size / 4;
  const activePalace = cells.find((c) => c.palace.index === active)?.palace ?? null;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {cells.map((c) => {
        const on = active === c.palace.index;
        return (
          <button
            key={c.palace.index}
            onMouseEnter={() => setActive(c.palace.index)}
            onMouseLeave={() => setActive(null)}
            onClick={() => setActive((a) => (a === c.palace.index ? null : c.palace.index))}
            className={`absolute overflow-hidden rounded-lg border p-1 text-left transition-colors ${
              c.isSoul
                ? "border-gold-dust/60 bg-gold-dust/10"
                : on
                  ? "border-gold-dust/40 bg-white/[0.05]"
                  : "border-white/10 bg-white/[0.02]"
            }`}
            style={{ left: c.col * cell, top: c.row * cell, width: cell - 3, height: cell - 3 }}
          >
            <span className="block text-[9px] tracking-[0.12em] text-gold-dust/75">
              {c.palace.name}
              {c.palace.is_body_palace ? " ·身" : ""}
            </span>
            <span className="mt-0.5 block text-[8px] tracking-[0.1em] text-stone-warm/40">
              {c.palace.heavenly_stem}
              {c.palace.earthly_branch}
            </span>
            <span className="mt-1 block text-[9px] leading-tight text-stone-warm/75">
              {c.palace.major_stars.slice(0, 3).map((s) => s.name).join(" ") ||
                (zh ? "空宫" : "empty")}
            </span>
          </button>
        );
      })}

      {/* Centre plate */}
      <div
        className="pointer-events-none absolute flex flex-col items-center justify-center px-2 text-center"
        style={{ left: cell, top: cell, width: cell * 2 - 3, height: cell * 2 - 3 }}
      >
        {activePalace ? (
          <>
            <p className="text-[10px] uppercase tracking-[0.26em] text-gold-dust/75">{activePalace.name}</p>
            <p className="mt-1 font-serif text-base italic text-stone-warm">
              {activePalace.major_stars.map((s) => s.name).join(" · ") || (zh ? "空宫借对宫" : "empty palace")}
            </p>
            {activePalace.minor_stars.length > 0 && (
              <p className="mt-1 text-[9px] leading-relaxed text-stone-warm/45">
                {activePalace.minor_stars.slice(0, 6).join(" ")}
              </p>
            )}
          </>
        ) : (
          <>
            <p className="font-serif text-base italic text-stone-warm/85">
              {zh ? "紫微十二宫" : "Zi Wei palaces"}
            </p>
            <p className="mt-1 text-[10px] leading-relaxed tracking-[0.16em] text-stone-warm/50">
              {zh ? "命主" : "Soul"} {chart.soul} · {zh ? "身主" : "Body"} {chart.body}
            </p>
            <p className="mt-1 text-[10px] tracking-[0.16em] text-stone-warm/40">
              {chart.five_elements_class}
            </p>
            <p className="mt-1 text-[9px] tracking-[0.14em] text-stone-warm/30">{chart.lunar_date}</p>
          </>
        )}
      </div>
    </div>
  );
}
