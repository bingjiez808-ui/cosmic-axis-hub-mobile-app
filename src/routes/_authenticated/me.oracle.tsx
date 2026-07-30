import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Lock, Send } from "lucide-react";

import { MembershipCheckoutModal } from "@/components/MembershipCheckoutModal";
import { PersonalWorkspaceNav } from "@/components/PersonalWorkspaceNav";
import {
  LockedActionButton,
  LockedBanner,
  LockedCtaAnchor,
  scrollToRoomCta,
} from "@/components/RoomLockedShell";

import { DailyRoomError } from "@/experiences/daily-room/fallback";
import { PersonalShellPending } from "@/experiences/daily-room/personal-shell-pending";
import { supabase } from "@/integrations/supabase/client";
import { listUserCharts, type ChartRow } from "@/lib/reports-store.functions";
import { askOracle } from "@/lib/oracle.functions";
import { sageChat } from "@/lib/sage.functions";
import { useLang } from "@/lib/i18n";
import { roomAccess } from "@/lib/room-access";

/**
 * /me/oracle — the authenticated Oracle Reading Room.
 *
 * Server-side truth: `askOracle` re-checks tier and chart ownership on
 * every call. The UI's job is to (a) never fire that call when the
 * caller isn't Oracle, and (b) never leak someone else's saved chart
 * to a caller without the entitlement.
 *
 * Unentitled callers (free or Sage) see a labelled locked preview:
 * banner + sample chart-picker rows + a disabled composer, plus one
 * canonical CTA at the bottom that jumps to `/report#membership-plans`.
 * A Sage member gets a specific "current tier: Sage — Oracle not
 * active" banner rather than the generic none-oracle copy.
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
  const isZh = lang === "zh";
  const [mem, setMem] = useState<MembershipView>({ kind: "loading" });
  const [charts, setCharts] = useState<ChartRow[]>([]);
  const [selectedChartId, setSelectedChartId] = useState<string | "companion" | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [memNonce, setMemNonce] = useState(0);
  const openCheckout = () => setCheckoutOpen(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) return;
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
          if (!cancelled) setCharts(list);
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
  }, [memNonce]);

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
    if (mem.kind !== "oracle") {
      // Belt-and-braces: unentitled callers can't reach this codepath
      // (form is not rendered), but if they do, refuse locally and
      // point them at the single CTA.
      scrollToRoomCta();
      return;
    }
    setDraft("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setBusy(true);
    try {
      if (isCompanion) {
        const res = await sageChat({
          data: { message: text, lang, history: messages.slice(-10) },
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
          content: isZh
            ? `智者此刻没接住这一问，稍后再试一次好吗？（${msg}）`
            : `The Sage couldn't reach that just now. Try again in a moment? (${msg})`,
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const tier: "none" | "sage" | "oracle" =
    mem.kind === "oracle" ? "oracle" : mem.kind === "no-oracle" ? mem.tier : "none";
  const access = roomAccess(tier, "oracle");

  return (
    <div className="min-h-screen bg-[#0a0a12]/10 text-amber-50">
      <div className="mx-auto w-full max-w-[900px] px-4 py-8 md:px-8 md:py-12">
        <PersonalWorkspaceNav active="/me/oracle" />
        <header className="mb-6">
          <div className="text-[11px] uppercase tracking-[0.24em] text-amber-300/70">
            {isZh ? "神谕者阅读室" : "Oracle Reading Room"}
          </div>
          <h1 className="mt-2 font-serif text-3xl tracking-wide md:text-4xl">
            {isZh ? "神谕者 · 命理与合盘" : "Oracle · Chart & Synastry"}
          </h1>
          <p className="mt-2 text-sm text-amber-100/70" data-testid="oracle-purpose-hint">
            {isZh
              ? "神谕者阅览室：本页做四体系交叉解读与 90 天窗口。命盘管理请回「命盘与报告」，会员到期在同一页面。"
              : "Oracle Reading Room: this page runs cross-tradition readings and 90-day windows. Manage charts on ‘Charts & Reports’; membership state stays on the same tab."}
          </p>
        </header>

        <section
          data-testid="oracle-includes-sage"
          className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300/30 bg-gradient-to-br from-[#2a1a08] to-[#1a1226] px-4 py-3"
        >
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-amber-300/80">
              {isZh ? "已包含贤者阅览室" : "Includes Sage Reading Room"}
            </p>
            <p className="mt-1 text-xs text-amber-100/75">
              {isZh
                ? "神谕者严格包含贤者的全部权益：完整生命时间轴、合盘、每月塔罗。"
                : "Oracle strictly inherits every Sage benefit: full life timeline, synastry, monthly tarot."}
            </p>
          </div>
          <Link
            to="/me/sage"
            className="min-h-9 inline-flex items-center rounded-full border border-amber-300/50 px-3 py-1.5 text-[11px] uppercase tracking-[0.22em] text-amber-100 hover:bg-amber-500/10"
          >
            {isZh ? "进入贤者阅览室" : "Enter Sage Room"}
          </Link>
        </section>

        {mem.kind === "loading" && (
          <div className="text-sm text-amber-100/70">
            {isZh ? "读取权限中…" : "Checking your access…"}
          </div>
        )}

        {mem.kind !== "loading" && !access.entitled && (
          <>
            <LockedBanner banner={access.banner} lang={lang} />
            <OracleLockedPreview lang={lang} tier={tier as "none" | "sage"} onUpgrade={openCheckout} />
            <LockedCtaAnchor lang={lang} onUpgrade={openCheckout} />
          </>
        )}

        {mem.kind === "oracle" && (
          <>
            <section className="mb-5 rounded-xl border border-amber-300/30 bg-gradient-to-br from-[#1a1226] to-[#0a0a12] p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="font-serif text-lg text-amber-100">
                  {isZh ? "当前:神谕者" : "Current: Oracle"}
                </div>
                <div className="text-xs text-amber-100/70">
                  {isZh ? "有效期至" : "Valid until"} {fmt(mem.expiresAt, lang)}
                </div>
              </div>
              <p className="mt-1 text-xs text-amber-100/60">
                {isZh
                  ? "月度会员到期后自动降级,不会未经确认扣款。"
                  : "Monthly membership lapses automatically at expiry — no silent renewal."}
              </p>
            </section>

            {/* Chart picker */}
            <section className="mb-5 rounded-xl border border-amber-400/15 bg-black/20 p-4">
              <div className="text-[11px] uppercase tracking-widest text-amber-200/70">
                {isZh ? "本次读取哪一张命盘？" : "Which chart to read?"}
              </div>
              <p className="mt-2 text-xs text-amber-100/60">
                {isZh
                  ? "默认建议主命盘,但不会静默读取——你需要在下面明确选一份。"
                  : "We suggest your primary chart by default, but nothing is read silently — please pick one below explicitly."}
              </p>

              {charts.length === 0 ? (
                <div className="mt-3">
                  <p className="text-sm text-amber-100/75">
                    {isZh
                      ? "你还没有保存的命盘。请先在个人主页登记一张。"
                      : "You don't have any saved charts yet — register one on your profile first."}
                  </p>
                  <Link
                    to="/me/profile"
                    className="mt-3 inline-flex min-h-11 items-center rounded-full border border-amber-300/50 px-4 py-2 text-xs text-amber-100 hover:bg-amber-500/10"
                  >
                    {isZh ? "去个人主页" : "Open my profile"}
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
                            {c.name || (isZh ? "未命名" : "Untitled")}
                          </span>
                          {c.is_primary && (
                            <span className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-200">
                              {isZh ? "主命盘" : "Primary"}
                            </span>
                          )}
                          <span className="ml-2 text-[11px] text-amber-100/50">
                            {c.birth_date ?? ""}
                          </span>
                        </span>
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
                      <span className="font-medium">
                        {isZh ? "不读取命盘 · 陪伴模式" : "Don't read a chart · companion mode"}
                      </span>
                    </span>
                  </button>
                </div>
              )}
            </section>

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
                      {isCompanion
                        ? isZh ? "智者正在听你说…" : "The Sage is listening…"
                        : isZh ? "智者正在展开你的星图…" : "The Sage is opening your chart…"}
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
                    placeholder={
                      isCompanion
                        ? isZh ? "说点什么,我在这里听你说…" : "Say something — I'm here to listen…"
                        : isZh ? "向智者发问（命理、合盘、近 90 天窗口）…" : "Ask the Sage (charts, synastry, 90-day windows)…"
                    }
                    className="max-h-32 min-h-10 flex-1 resize-none rounded-lg border border-amber-400/20 bg-black/40 px-3 py-2 text-sm text-amber-50 placeholder:text-amber-100/40 focus:border-amber-300/60 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!draft.trim() || busy}
                    className="grid size-10 place-items-center rounded-lg bg-amber-500/30 text-amber-100 transition-colors hover:bg-amber-500/45 disabled:opacity-40"
                    aria-label={isZh ? "发送" : "Send"}
                  >
                    <Send size={14} />
                  </button>
                </form>
              </section>
            )}
          </>
        )}
        <MembershipCheckoutModal
          open={checkoutOpen}
          targetTier="oracle"
          source="oracle_room"
          lang={lang}
          onClose={() => setCheckoutOpen(false)}
          onSuccess={() => setMemNonce((n) => n + 1)}
        />
      </div>
    </div>
  );
}

/**
 * The locked-preview mirrors the entitled layout: chart-picker section
 * shape and a chat composer, but every actionable control is a
 * `LockedActionButton` — clicks scroll to the canonical CTA.
 */
function OracleLockedPreview({
  lang,
  tier,
  onUpgrade,
}: {
  lang: "en" | "zh";
  tier: "none" | "sage";
  onUpgrade: () => void;
}) {
  const isZh = lang === "zh";
  void tier;
  const sampleRows = [
    {
      id: "s1",
      name: isZh ? "示例 · 主命盘" : "Sample · primary chart",
      hint: isZh ? "神谕者可选择任意一张已存命盘" : "Oracle members pick any saved chart",
      primary: true,
    },
    {
      id: "s2",
      name: isZh ? "示例 · 伴侣命盘" : "Sample · partner chart",
      hint: isZh ? "用于合盘对照" : "For synastry comparison",
      primary: false,
    },
    {
      id: "s3",
      name: isZh ? "示例 · 陪伴模式" : "Sample · companion mode",
      hint: isZh ? "不读取任何命盘,仅情绪陪伴" : "No chart read — support only",
      primary: false,
    },
  ];

  return (
    <>
      <section
        data-testid="oracle-preview-picker"
        className="mb-5 rounded-xl border border-amber-400/15 bg-black/20 p-4"
      >
        <div className="text-[11px] uppercase tracking-widest text-amber-200/70">
          {isZh ? "命盘选择器（预览）" : "Chart picker (preview)"}
        </div>
        <p className="mt-2 text-xs text-amber-100/60">
          {isZh
            ? "神谕者可以对任意已保存命盘做四体系交叉解读；示例仅展示结构,不加载你的真实命盘。"
            : "Oracle members run cross-tradition readings against any saved chart. This sample shows the shape only — nothing of yours is loaded."}
        </p>
        <ul className="mt-3 grid gap-2">
          {sampleRows.map((r) => (
            <li
              key={r.id}
              aria-disabled="true"
              className="flex items-center justify-between rounded-lg border border-amber-400/15 bg-black/25 px-3 py-2"
            >
              <div className="min-w-0">
                <div className="text-sm text-amber-100/80">
                  {r.name}
                  {r.primary && (
                    <span className="ml-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-200/80">
                      {isZh ? "主命盘" : "Primary"}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-amber-100/50">{r.hint}</div>
              </div>
              <Lock size={14} className="shrink-0 text-amber-300/60" aria-hidden />
            </li>
          ))}
        </ul>
      </section>

      <section
        data-testid="oracle-preview-composer"
        className="mb-5 rounded-xl border border-amber-400/15 bg-black/20 p-4"
      >
        <div className="text-[11px] uppercase tracking-widest text-amber-200/70">
          {isZh ? "追问对话（预览）" : "Follow-up chat (preview)"}
        </div>
        <p className="mt-2 text-xs text-amber-100/60">
          {isZh
            ? "神谕者可对当前命盘无限追问,并进入 90 天窗口分析。"
            : "Oracle members ask unlimited follow-ups against the selected chart and open the 90-day window analysis."}
        </p>
        <div
          aria-disabled="true"
          className="mt-3 flex items-end gap-2 rounded-lg border border-amber-400/20 bg-black/40 p-3 opacity-90"
        >
          <div className="flex-1 rounded-md bg-black/30 px-3 py-2 text-sm text-amber-100/40">
            {isZh
              ? "向智者发问（命理、合盘、近 90 天窗口）…"
              : "Ask the Sage (charts, synastry, 90-day windows)…"}
          </div>
          <LockedActionButton
            testId="oracle-locked-send"
            lang={lang}
            onUpgrade={onUpgrade}
            className="grid size-10 place-items-center rounded-lg border border-amber-400/30 bg-black/40 text-amber-100/70 hover:border-amber-300/60"
          >
            <Send size={12} aria-hidden />
          </LockedActionButton>
        </div>
      </section>

      <section
        data-testid="oracle-preview-actions"
        className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3"
      >
        {[
          {
            id: "followup",
            title: isZh ? "无限追问" : "Unlimited follow-up",
            body: isZh
              ? "对同一命盘反复追问,直到疑问被拆到骨头。"
              : "Keep asking against the same chart until the question is stripped to bone.",
            action: isZh ? "开始追问" : "Start follow-up",
          },
          {
            id: "ninety",
            title: isZh ? "近 90 天窗口" : "90-day windows",
            body: isZh
              ? "识别近 90 天内的关键节点,并给出具体时段建议。"
              : "Surface the keystone windows inside the next 90 days with time-specific guidance.",
            action: isZh ? "生成 90 天分析" : "Run 90-day analysis",
          },
          {
            id: "synastry",
            title: isZh ? "合盘对照" : "Synastry comparison",
            body: isZh
              ? "把两张命盘对齐,读出彼此的和声与噪音。"
              : "Align two charts and read the harmony and noise between them.",
            action: isZh ? "开始合盘" : "Run synastry",
          },
        ].map((c) => (
          <div
            key={c.id}
            data-testid={`oracle-locked-tile-${c.id}`}
            data-locked="true"
            aria-disabled="true"
            className="flex flex-col rounded-2xl border border-amber-400/20 bg-black/25 p-4"
          >
            <p className="font-serif text-base italic text-amber-100/85">{c.title}</p>
            <p className="mt-2 flex-1 text-xs leading-relaxed text-amber-100/60">{c.body}</p>
            <LockedActionButton
              testId={`oracle-locked-tile-${c.id}-action`}
              lang={lang}
              onUpgrade={onUpgrade}
              className="mt-3 inline-flex min-h-10 items-center gap-2 self-start rounded-full border border-amber-400/30 bg-black/40 px-3 py-1.5 text-[11px] uppercase tracking-[0.24em] text-amber-100/70 hover:border-amber-300/60 hover:text-amber-100"
            >
              {c.action}
            </LockedActionButton>
          </div>
        ))}
      </section>
    </>
  );
}
