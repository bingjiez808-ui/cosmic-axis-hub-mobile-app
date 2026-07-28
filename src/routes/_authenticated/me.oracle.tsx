import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";

import { PersonalWorkspaceNav } from "@/components/PersonalWorkspaceNav";

import { DailyRoomError } from "@/experiences/daily-room/fallback";
import { PersonalShellPending } from "@/experiences/daily-room/personal-shell-pending";
import { supabase } from "@/integrations/supabase/client";
import { listUserCharts, type ChartRow } from "@/lib/reports-store.functions";
import { askOracle } from "@/lib/oracle.functions";
import { sageChat } from "@/lib/sage.functions";
import { useLang } from "@/lib/i18n";

/**
 * /me/oracle — the authenticated Oracle Reading Room.
 *
 * Server-side truth:
 *   - the caller's active Oracle tier is checked by `askOracle` on every
 *     request; hiding the input is a UX affordance, not the gate.
 *   - the caller can only ask against a chart they own; `askOracle`
 *     re-validates ownership by chartId before doing anything.
 *
 * When the caller flips into "companion mode" the request is routed
 * through `sageChat` instead, and no chart is read.
 */
export const Route = createFileRoute("/_authenticated/me/oracle")({
  head: () => ({
    meta: [
      { title: "Oracle Reading Room · Library of Destiny" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  validateSearch: (raw: Record<string, unknown>) => ({
    source: typeof raw.source === "string" ? raw.source : undefined,
  }),
  pendingMs: 0,
  pendingComponent: PersonalShellPending,
  errorComponent: DailyRoomError,
  component: OraclePage,
});

type MembershipView =
  | { kind: "loading" }
  | { kind: "no-oracle"; tier: "none" | "sage"; expiresAt: string | null }
  | { kind: "oracle"; expiresAt: string | null };

type ChatMsg = { role: "user" | "assistant"; content: string };

const T = {
  kicker: { zh: "神谕者阅读室", en: "Oracle Reading Room" },
  title: {
    zh: "神谕者 · 命理与合盘",
    en: "Oracle · Chart & Synastry",
  },
  loading: { zh: "读取权限中…", en: "Checking your access…" },
  expired: {
    zh: "月度会员已到期，已自动降级。",
    en: "Monthly membership expired — auto-downgraded.",
  },
  active_until: { zh: "有效期至", en: "Valid until" },
  no_access_title: {
    zh: "神谕者是月度会员能力",
    en: "Oracle is a monthly-membership capability",
  },
  no_access_body: {
    zh: "开通后可在这里选择自己的命盘，进行四体系交叉解读、90 天窗口分析与合盘对照。到期后自动降级，不会未经确认扣款。",
    en: "Once active, this room lets you pick one of your own charts and receive cross-tradition readings, 90-day windows and synastry. It lapses automatically at expiry — no silent renewal.",
  },
  mock_notice: {
    zh: "本阶段仍为模拟支付，不会产生真实扣款。",
    en: "Payments are still simulated in this build — no real charge is made.",
  },
  select_chart: { zh: "本次读取哪一张命盘？", en: "Which chart to read?" },
  none_chart: { zh: "不读取命盘 · 陪伴模式", en: "Don't read a chart · companion mode" },
  companion_note: {
    zh: "陪伴模式下我不会读取任何命盘，只做情绪陪伴。",
    en: "In companion mode I won't read any chart — only offer support.",
  },
  reading_note: {
    zh: "本次读取：",
    en: "Reading this chart:",
  },
  no_charts: {
    zh: "你还没有保存的命盘。请先在个人主页登记一张。",
    en: "You don't have any saved charts yet — register one on your profile first.",
  },
  open_profile: { zh: "去个人主页", en: "Open my profile" },
  placeholder_oracle: {
    zh: "向智者发问（命理、合盘、近 90 天窗口）…",
    en: "Ask the Sage (charts, synastry, 90-day windows)…",
  },
  placeholder_companion: {
    zh: "说点什么，我在这里听你说…",
    en: "Say something — I'm here to listen…",
  },
  send: { zh: "发送", en: "Send" },
  thinking_oracle: { zh: "智者正在展开你的星图…", en: "The Sage is opening your chart…" },
  thinking_companion: { zh: "智者正在听你说…", en: "The Sage is listening…" },
  chart_from_db: { zh: "（来源：你保存的命盘）", en: "(source: your saved chart)" },
  primary_hint: { zh: "主命盘", en: "Primary" },
  select_hint: {
    zh: "默认建议主命盘，但不会静默读取——你需要在下面明确选一份。",
    en: "We suggest your primary chart by default, but nothing is read silently — please pick one below explicitly.",
  },
  member_kicker: { zh: "会员状态", en: "Membership" },
  intent_forwarded: {
    zh: "已把订单反馈记入后台（工单号 %ID%）。",
    en: "Your note has been filed (ticket %ID%).",
  },
};

function fmt(iso: string | null, lang: "en" | "zh"): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function OraclePage() {
  const { lang } = useLang();
  const t = (k: keyof typeof T) => T[k][lang];
  const [mem, setMem] = useState<MembershipView>({ kind: "loading" });
  const [charts, setCharts] = useState<ChartRow[]>([]);
  const [selectedChartId, setSelectedChartId] = useState<string | "companion" | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) return; // route guard already redirects
      const { data } = await supabase
        .from("profiles")
        .select("membership_tier, membership_expires_at")
        .eq("id", sess.session.user.id)
        .maybeSingle();
      const rawTier = (data?.membership_tier ?? "none") as string;
      const exp = (data?.membership_expires_at as string | null) ?? null;
      const expTs = exp ? new Date(exp).getTime() : null;
      const active = rawTier === "oracle" && !!expTs && expTs > Date.now();
      if (cancelled) return;
      if (active) {
        setMem({ kind: "oracle", expiresAt: exp });
        try {
          const list = await listUserCharts();
          if (!cancelled) {
            setCharts(list);
            const primary = list.find((c) => c.is_primary && c.chart_role === "self");
            // Do NOT auto-select — we require an explicit choice.
            void primary;
          }
        } catch {
          if (!cancelled) setCharts([]);
        }
      } else {
        const tier: "none" | "sage" = rawTier === "sage" ? "sage" : "none";
        setMem({ kind: "no-oracle", tier, expiresAt: exp });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, busy]);

  const isCompanion = selectedChartId === "companion";
  const chartRow = useMemo(
    () =>
      selectedChartId && selectedChartId !== "companion"
        ? (charts.find((c) => c.id === selectedChartId) ?? null)
        : null,
    [charts, selectedChartId],
  );

  const send = async () => {
    const text = draft.trim();
    if (!text || busy || !selectedChartId) return;
    setDraft("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setBusy(true);
    try {
      if (isCompanion) {
        const res = await sageChat({
          data: {
            message: text,
            lang,
            history: messages.slice(-10),
          },
        });
        setMessages((prev) => [...prev, { role: "assistant", content: res.text }]);
      } else if (chartRow) {
        const res = await askOracle({
          data: {
            question: text,
            lang,
            feature: "oracle_chat",
            chartId: chartRow.id,
          },
        });
        setMessages((prev) => [...prev, { role: "assistant", content: res.text }]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            lang === "zh"
              ? `智者此刻没接住这一问，稍后再试一次好吗？（${msg}）`
              : `The Sage couldn't reach that just now. Try again in a moment? (${msg})`,
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a12] text-amber-50">
      <div className="mx-auto w-full max-w-[900px] px-4 py-8 md:px-8 md:py-12">
        <PersonalWorkspaceNav active="/me/oracle" />
        <header className="mb-6">
          <div className="text-[11px] uppercase tracking-[0.24em] text-amber-300/70">
            {t("kicker")}
          </div>
          <h1 className="mt-2 font-serif text-3xl tracking-wide md:text-4xl">{t("title")}</h1>
          <p className="mt-2 text-sm text-amber-100/70" data-testid="oracle-purpose-hint">
            {lang === "zh"
              ? "神谕者阅览室：本页做四体系交叉解读与 90 天窗口。命盘管理请回「命盘与报告」，会员到期在同一页面。"
              : "Oracle Reading Room: this page runs cross-tradition readings and 90-day windows. Manage charts on ‘Charts & Reports’; membership state stays on the same tab."}
          </p>
        </header>

        {/* Oracle ⊇ Sage — surface the inheritance instead of duplicating
            Sage cards inside this room. Any member here can also enter
            the Sage Reading Room. */}
        <section
          data-testid="oracle-includes-sage"
          className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300/30 bg-gradient-to-br from-[#2a1a08] to-[#1a1226] px-4 py-3"
        >
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-amber-300/80">
              {lang === "zh" ? "已包含贤者阅览室" : "Includes Sage Reading Room"}
            </p>
            <p className="mt-1 text-xs text-amber-100/75">
              {lang === "zh"
                ? "神谕者严格包含贤者的全部权益：完整生命时间轴、合盘、每月塔罗。"
                : "Oracle strictly inherits every Sage benefit: full life timeline, synastry, monthly tarot."}
            </p>
          </div>
          <Link
            to="/me/sage"
            className="min-h-9 inline-flex items-center rounded-full border border-amber-300/50 px-3 py-1.5 text-[11px] uppercase tracking-[0.22em] text-amber-100 hover:bg-amber-500/10"
          >
            {lang === "zh" ? "进入贤者阅览室" : "Enter Sage Room"}
          </Link>
        </section>


        {/* Membership status */}
        {mem.kind === "loading" && <div className="text-sm text-amber-100/70">{t("loading")}</div>}

        {mem.kind === "no-oracle" && (
          <section className="rounded-xl border border-amber-400/25 bg-black/30 p-6">
            <div className="text-[11px] uppercase tracking-widest text-amber-300/70">
              {t("member_kicker")}
            </div>
            <h2 className="mt-2 font-serif text-2xl text-amber-100">{t("no_access_title")}</h2>
            <p className="mt-3 text-sm leading-relaxed text-amber-100/75">{t("no_access_body")}</p>
            <p className="mt-3 text-xs text-amber-200/60">{t("mock_notice")}</p>
            {mem.expiresAt && (
              <p className="mt-2 text-xs text-amber-200/60">
                {t("expired")} · {t("active_until")} {fmt(mem.expiresAt, lang)}
              </p>
            )}
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                to="/report"
                className="min-h-11 inline-flex items-center rounded-full border border-amber-300/50 px-4 py-2 text-xs text-amber-100 hover:bg-amber-500/10"
              >
                {lang === "zh" ? "查看会员方案" : "See membership options"}
              </Link>
              <Link
                to="/me/profile"
                className="min-h-11 inline-flex items-center rounded-full border border-amber-400/25 px-4 py-2 text-xs text-amber-100/80 hover:border-amber-300/60"
              >
                {t("open_profile")}
              </Link>
            </div>
          </section>
        )}

        {mem.kind === "oracle" && (
          <>
            <section className="mb-5 rounded-xl border border-amber-300/30 bg-gradient-to-br from-[#1a1226] to-[#0a0a12] p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="font-serif text-lg text-amber-100">
                  {lang === "zh" ? "当前：神谕者" : "Current: Oracle"}
                </div>
                <div className="text-xs text-amber-100/70">
                  {t("active_until")} {fmt(mem.expiresAt, lang)}
                </div>
              </div>
              <p className="mt-1 text-xs text-amber-100/60">
                {lang === "zh"
                  ? "月度会员到期后自动降级，不会未经确认扣款。"
                  : "Monthly membership lapses automatically at expiry — no silent renewal."}
              </p>
            </section>

            {/* Chart picker */}
            <section className="mb-5 rounded-xl border border-amber-400/15 bg-black/20 p-4">
              <div className="text-[11px] uppercase tracking-widest text-amber-200/70">
                {t("select_chart")}
              </div>
              <p className="mt-2 text-xs text-amber-100/60">{t("select_hint")}</p>

              {charts.length === 0 ? (
                <div className="mt-3">
                  <p className="text-sm text-amber-100/75">{t("no_charts")}</p>
                  <Link
                    to="/me/profile"
                    className="mt-3 inline-flex min-h-11 items-center rounded-full border border-amber-300/50 px-4 py-2 text-xs text-amber-100 hover:bg-amber-500/10"
                  >
                    {t("open_profile")}
                  </Link>
                </div>
              ) : (
                <div className="mt-3 grid gap-2">
                  {charts.map((c) => {
                    const selected = selectedChartId === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedChartId(c.id)}
                        className={`flex items-start justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                          selected
                            ? "border-amber-300 bg-amber-500/10 text-amber-100"
                            : "border-amber-400/20 bg-black/20 text-amber-100/75 hover:border-amber-300/60"
                        }`}
                      >
                        <span>
                          <span className="font-medium">
                            {c.name || (lang === "zh" ? "未命名" : "Untitled")}
                          </span>
                          {c.is_primary && (
                            <span className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-200">
                              {t("primary_hint")}
                            </span>
                          )}
                          <span className="ml-2 text-[11px] text-amber-100/50">
                            {c.birth_date ?? ""}
                          </span>
                        </span>
                        {selected && (
                          <span className="text-[10px] uppercase tracking-widest text-amber-300">
                            {t("reading_note").replace(/[:：]/g, "")}
                          </span>
                        )}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setSelectedChartId("companion")}
                    className={`flex items-start justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                      isCompanion
                        ? "border-amber-300 bg-amber-500/10 text-amber-100"
                        : "border-amber-400/20 bg-black/20 text-amber-100/75 hover:border-amber-300/60"
                    }`}
                  >
                    <span>
                      <span className="font-medium">{t("none_chart")}</span>
                      <span className="ml-2 text-[11px] text-amber-100/50">
                        {t("companion_note")}
                      </span>
                    </span>
                  </button>
                </div>
              )}

              {chartRow && (
                <p className="mt-3 rounded-md border border-amber-300/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-100/80">
                  {t("reading_note")}{" "}
                  <span className="font-medium text-amber-100">
                    {chartRow.name || (lang === "zh" ? "未命名" : "Untitled")}
                  </span>{" "}
                  <span className="text-amber-100/50">{t("chart_from_db")}</span>
                </p>
              )}
            </section>

            {/* Conversation */}
            {selectedChartId && (
              <section className="rounded-xl border border-amber-400/20 bg-black/30">
                <div
                  ref={scrollRef}
                  className="max-h-[54vh] min-h-[12rem] space-y-3 overflow-y-auto p-4"
                >
                  {messages.map((m, i) => (
                    <div
                      key={i}
                      className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                          m.role === "user"
                            ? "bg-amber-500/20 text-amber-50"
                            : "bg-white/5 font-serif italic text-amber-100"
                        }`}
                      >
                        {m.content}
                      </div>
                    </div>
                  ))}
                  {busy && (
                    <div className="flex items-center gap-2 text-xs text-amber-100/70">
                      <Loader2 size={12} className="animate-spin" />
                      {isCompanion ? t("thinking_companion") : t("thinking_oracle")}
                    </div>
                  )}
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void send();
                  }}
                  className="flex items-end gap-2 border-t border-amber-400/15 p-3"
                >
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={1}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void send();
                      }
                    }}
                    placeholder={isCompanion ? t("placeholder_companion") : t("placeholder_oracle")}
                    className="max-h-32 min-h-10 flex-1 resize-none rounded-lg border border-amber-400/20 bg-black/40 px-3 py-2 text-sm text-amber-50 placeholder:text-amber-100/40 focus:border-amber-300/60 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!draft.trim() || busy}
                    className="grid size-10 place-items-center rounded-lg bg-amber-500/30 text-amber-100 transition-colors hover:bg-amber-500/45 disabled:opacity-40"
                    aria-label={t("send")}
                  >
                    <Send size={14} />
                  </button>
                </form>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
