import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLang, type Lang } from "@/lib/i18n";

/* ═══════════════════════════════════════════
   Life Timeline — 大运 / Dashā decades
═══════════════════════════════════════════ */

type Decade = {
  from: number;
  to: number;
  theme: [string, string];
  detail: [string, string];
};

const DECADES: Decade[] = [
  {
    from: 0,
    to: 10,
    theme: ["Root", "扎根"],
    detail: [
      "Family shapes the temperament — the chart lays its foundation quietly.",
      "家庭塑造性情 —— 命盘在此静静打地基。",
    ],
  },
  {
    from: 10,
    to: 20,
    theme: ["Sprout", "萌发"],
    detail: [
      "Mind opens, first attractions and ambitions surface.",
      "心智开启，第一批渴望与野心浮现。",
    ],
  },
  {
    from: 20,
    to: 30,
    theme: ["Search", "求索"],
    detail: [
      "Career takes its first real shape; relationships teach more than they last.",
      "事业初具雏形；感情多在教你，而非陪你走远。",
    ],
  },
  {
    from: 30,
    to: 40,
    theme: ["Forge", "锻造"],
    detail: [
      "The chart's Officer/Wealth cycle turns — the years you build who you are.",
      "官运财运齐动的十年 —— 你在此炼成真正的自己。",
    ],
  },
  {
    from: 40,
    to: 50,
    theme: ["Bloom", "盛放"],
    detail: [
      "Peak of vocation and public influence. The library reads this decade brightest.",
      "事业与影响力的顶峰。此十年最为明亮。",
    ],
  },
  {
    from: 50,
    to: 60,
    theme: ["Harvest", "收获"],
    detail: [
      "Wealth compounds, teaching begins. Time to translate — not to prove.",
      "财富开始复利，教学之时。宜翻译传承，不再证明。",
    ],
  },
  {
    from: 60,
    to: 70,
    theme: ["Return", "回归"],
    detail: [
      "Inward turn. Relationships and meaning outweigh position and title.",
      "向内回转。关系与意义，重于位置与头衔。",
    ],
  },
  {
    from: 70,
    to: 80,
    theme: ["Distill", "凝定"],
    detail: [
      "The chart's quiet chapter — health and legacy come into focus.",
      "命盘中安静的一章 —— 健康与传承，成为主线。",
    ],
  },
];

function computeCurrentAge(birthISO?: string): number | null {
  if (!birthISO) return null;
  const d = new Date(birthISO);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return Math.max(0, Math.min(age, 90));
}

export function LifeTimeline({ birthISO }: { birthISO?: string }) {
  const { lang, t } = useLang();
  const li = lang === "zh" ? 1 : 0;
  const age = computeCurrentAge(birthISO);
  const [active, setActive] = useState<number>(() => {
    if (age == null) return 3;
    return Math.min(DECADES.length - 1, Math.floor(age / 10));
  });

  const nowPct = age == null ? null : Math.min(100, (age / 80) * 100);
  const activeDecade = DECADES[active];

  return (
    <section className="mx-auto max-w-5xl px-6 pb-24 md:px-12">
      <div className="glass-card rounded-3xl p-8 md:p-12">
        <div className="mb-8 flex flex-wrap items-baseline justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <p className="mb-2 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
              {t.tl_kicker}
            </p>
            <h2 className="font-serif text-2xl italic text-stone-warm md:text-3xl">
              {t.tl_title}
            </h2>
          </div>
          {age != null && (
            <span className="rounded-full border border-gold-dust/40 px-4 py-1.5 text-[10px] uppercase tracking-[0.28em] text-gold-light">
              {t.tl_now} · {age} {lang === "zh" ? "岁" : ""}
            </span>
          )}
        </div>

        <p className="mb-8 max-w-3xl text-sm text-stone-warm/60">{t.tl_hint}</p>

        {/* Track */}
        <div className="relative mb-10">
          <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-gold-dust/40 to-transparent" />
          {nowPct != null && (
            <motion.div
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.9, ease: [0.32, 0.72, 0, 1] }}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
              style={{ left: `${nowPct}%` }}
            >
              <span className="block size-3 animate-pulse-gold rounded-full bg-gold-dust shadow-[0_0_20px_hsl(45_70%_60%/0.7)]" />
            </motion.div>
          )}
          <div className="relative grid grid-cols-8 gap-2">
            {DECADES.map((d, i) => {
              const isActive = i === active;
              const isPast = age != null && age >= d.to;
              const isNow = age != null && age >= d.from && age < d.to;
              return (
                <button
                  key={d.from}
                  type="button"
                  onClick={() => setActive(i)}
                  className="group flex flex-col items-center gap-3 py-2"
                >
                  <span
                    className={`size-4 rounded-full border transition-all ${
                      isActive
                        ? "border-gold-dust bg-gold-dust scale-125"
                        : isNow
                          ? "border-gold-dust bg-gold-dust/40"
                          : isPast
                            ? "border-gold-dust/40 bg-gold-dust/20"
                            : "border-white/20 bg-transparent group-hover:border-gold-dust/60"
                    }`}
                  />
                  <span
                    className={`text-[10px] uppercase tracking-[0.22em] transition-colors ${
                      isActive ? "text-gold-light" : "text-stone-warm/50 group-hover:text-gold-dust"
                    }`}
                  >
                    {d.from}–{d.to}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Detail */}
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4 }}
            className="rounded-2xl border border-gold-dust/20 bg-gold-dust/[0.04] p-6 md:p-8"
          >
            <p className="mb-2 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
              {t.tl_age} {activeDecade.from}–{activeDecade.to}
            </p>
            <h3 className="mb-4 font-serif text-2xl italic text-gold-light">
              {activeDecade.theme[li]}
            </h3>
            <p className="font-serif text-lg leading-relaxed text-stone-warm/85">
              {activeDecade.detail[li]}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════
   Key Events verification
═══════════════════════════════════════════ */

type EventRow = { id: number; year: string; text: string; verified: boolean };

export function KeyEventsVerification() {
  const { t } = useLang();
  const [rows, setRows] = useState<EventRow[]>([
    { id: 1, year: "", text: "", verified: false },
    { id: 2, year: "", text: "", verified: false },
  ]);

  const update = (id: number, patch: Partial<EventRow>) =>
    setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const verify = () =>
    setRows((r) => r.map((x) => (x.year && x.text ? { ...x, verified: true } : x)));

  return (
    <section className="mx-auto max-w-5xl px-6 pb-24 md:px-12">
      <div className="glass-card rounded-3xl p-8 md:p-12">
        <p className="mb-2 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
          {t.ke_kicker}
        </p>
        <h2 className="mb-3 font-serif text-2xl italic text-stone-warm md:text-3xl">
          {t.ke_title}
        </h2>
        <p className="mb-8 max-w-3xl text-sm text-stone-warm/60">{t.ke_hint}</p>

        <div className="space-y-3">
          {rows.map((r) => (
            <div
              key={r.id}
              className="grid grid-cols-1 gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4 md:grid-cols-[120px_1fr_auto] md:items-center"
            >
              <input
                type="text"
                inputMode="numeric"
                placeholder={t.ke_year}
                value={r.year}
                onChange={(e) => update(r.id, { year: e.target.value, verified: false })}
                className="ritual-input !py-2 !text-base"
                style={{ colorScheme: "dark" }}
              />
              <input
                type="text"
                placeholder={t.ke_event_ph}
                value={r.text}
                onChange={(e) => update(r.id, { text: e.target.value, verified: false })}
                className="ritual-input !py-2 !text-base"
                style={{ colorScheme: "dark" }}
              />
              <AnimatePresence>
                {r.verified && (
                  <motion.span
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-gold-light"
                  >
                    <span className="size-1.5 rounded-full bg-gold-dust" />
                    {t.ke_verified}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={() =>
              setRows((r) => [...r, { id: Date.now(), year: "", text: "", verified: false }])
            }
            className="text-[10px] uppercase tracking-[0.32em] text-stone-warm/60 transition-colors hover:text-gold-dust"
          >
            {t.ke_add}
          </button>
          <button
            type="button"
            onClick={verify}
            className="rounded-full bg-gold-dust px-8 py-3 text-[10px] uppercase tracking-[0.32em] text-obsidian transition-colors hover:bg-gold-light"
          >
            {t.ke_verify}
          </button>
        </div>

        <p className="mt-6 text-[10px] uppercase tracking-[0.24em] text-stone-warm/30">
          {t.ke_note}
        </p>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════
   Membership + PDF export + AI follow-up
═══════════════════════════════════════════ */

type Plan = "free" | "sage" | "oracle";

export function MembershipSection() {
  const { lang, t } = useLang();
  const li = lang === "zh" ? 1 : 0;
  const [plan] = useState<Plan>("free");
  const [chatOpen, setChatOpen] = useState(false);

  const plans = useMemo(
    () => [
      {
        id: "free" as const,
        name: t.mem_free,
        desc: t.mem_free_desc,
        price: [`$0`, `¥0`][li],
        highlight: false,
      },
      {
        id: "sage" as const,
        name: t.mem_sage,
        desc: t.mem_sage_desc,
        price: [`$9 / mo`, `¥68 / 月`][li],
        highlight: true,
      },
      {
        id: "oracle" as const,
        name: t.mem_oracle,
        desc: t.mem_oracle_desc,
        price: [`$24 / mo`, `¥168 / 月`][li],
        highlight: false,
      },
    ],
    [t, li],
  );

  const exportPdf = () => {
    if (typeof window !== "undefined") window.print();
  };

  return (
    <section className="mx-auto max-w-5xl px-6 pb-24 md:px-12 print:hidden">
      <div className="glass-card rounded-3xl p-8 md:p-12">
        <p className="mb-2 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
          {t.mem_kicker}
        </p>
        <h2 className="mb-10 font-serif text-2xl italic text-stone-warm md:text-3xl">
          {t.mem_title}
        </h2>

        <div className="mb-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          {plans.map((p) => {
            const isCurrent = p.id === plan;
            return (
              <div
                key={p.id}
                className={`relative flex flex-col rounded-2xl border p-6 transition-colors ${
                  p.highlight
                    ? "border-gold-dust/50 bg-gold-dust/[0.06]"
                    : "border-white/10 bg-white/[0.02]"
                }`}
              >
                {p.highlight && (
                  <span className="absolute -top-3 left-6 rounded-full bg-gold-dust px-3 py-0.5 text-[9px] uppercase tracking-[0.32em] text-obsidian">
                    ★
                  </span>
                )}
                <p className="mb-1 font-serif text-xl text-stone-warm">{p.name}</p>
                <p className="mb-4 text-[10px] uppercase tracking-[0.28em] text-gold-dust/70">
                  {p.price}
                </p>
                <p className="mb-6 flex-1 text-sm leading-relaxed text-stone-warm/60">
                  {p.desc}
                </p>
                <button
                  type="button"
                  disabled={isCurrent}
                  className={`rounded-full px-5 py-2.5 text-[10px] uppercase tracking-[0.28em] transition-colors ${
                    isCurrent
                      ? "cursor-default border border-white/10 text-stone-warm/40"
                      : p.highlight
                        ? "bg-gold-dust text-obsidian hover:bg-gold-light"
                        : "border border-gold-dust/40 text-gold-dust hover:bg-gold-dust/10"
                  }`}
                >
                  {isCurrent ? t.mem_current : t.mem_upgrade}
                </button>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <button
            type="button"
            onClick={exportPdf}
            className="glass-card group flex items-center justify-between rounded-2xl p-6 text-left transition-colors hover:border-gold-dust/40"
          >
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
                {t.mem_export_pdf}
              </p>
              <p className="font-serif text-lg text-stone-warm">
                {lang === "zh" ? "打印或另存为 PDF" : "Print or save as PDF"}
              </p>
            </div>
            <span className="grid size-10 place-items-center rounded-full border border-gold-dust/40 text-gold-dust transition-colors group-hover:bg-gold-dust group-hover:text-obsidian">
              ↓
            </span>
          </button>

          <button
            type="button"
            onClick={() => setChatOpen(true)}
            className="glass-card group flex items-center justify-between rounded-2xl p-6 text-left transition-colors hover:border-gold-dust/40"
          >
            <div>
              <p className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
                {t.mem_ai_followup}
                <span className="rounded-full border border-gold-dust/40 px-2 py-0.5 text-[8px] tracking-[0.28em] text-gold-light">
                  {t.mem_ai_locked}
                </span>
              </p>
              <p className="font-serif text-lg text-stone-warm">{t.mem_ai_followup_desc}</p>
            </div>
            <span className="grid size-10 place-items-center rounded-full border border-gold-dust/40 text-gold-dust transition-colors group-hover:bg-gold-dust group-hover:text-obsidian">
              ✦
            </span>
          </button>
        </div>
      </div>

      <AIFollowupModal open={chatOpen} onClose={() => setChatOpen(false)} lang={lang} />
    </section>
  );
}

function AIFollowupModal({
  open,
  onClose,
  lang,
}: {
  open: boolean;
  onClose: () => void;
  lang: Lang;
}) {
  const { t } = useLang();
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-end justify-center bg-obsidian/70 backdrop-blur-md md:items-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.98 }}
            transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
            className="glass-card relative m-4 w-full max-w-lg rounded-3xl p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 text-[10px] uppercase tracking-[0.28em] text-stone-warm/50 hover:text-gold-dust"
            >
              {t.mem_close}
            </button>
            <p className="mb-2 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
              {t.mem_ai_followup}
            </p>
            <h3 className="mb-6 font-serif text-2xl italic text-stone-warm">
              {lang === "zh" ? "开启一场私密对话" : "Open a private conversation"}
            </h3>

            <div className="mb-6 space-y-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-stone-warm/70">
                {lang === "zh"
                  ? "「你的太阳落火象、日主为阳火 —— 想追问哪一维度？」"
                  : "“Your Sun sits in Fire and your Day Master is Yang Fire — which dimension would you like to explore?”"}
              </div>
            </div>

            <div className="mb-6 flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-4 py-2">
              <input
                disabled
                placeholder={t.mem_ai_placeholder}
                className="flex-1 bg-transparent text-sm text-stone-warm/70 outline-none placeholder:text-stone-warm/30"
              />
              <button
                disabled
                className="rounded-full bg-gold-dust/40 px-4 py-1.5 text-[10px] uppercase tracking-[0.28em] text-obsidian/50"
              >
                {t.mem_ai_send}
              </button>
            </div>

            <div className="rounded-2xl border border-gold-dust/30 bg-gold-dust/[0.06] p-5">
              <p className="mb-4 font-serif text-base italic leading-relaxed text-stone-warm/85">
                {t.mem_ai_upsell}
              </p>
              <button
                type="button"
                className="w-full rounded-full bg-gold-dust px-6 py-3 text-[10px] uppercase tracking-[0.32em] text-obsidian transition-colors hover:bg-gold-light"
              >
                {t.mem_upgrade} → {t.mem_oracle}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
