import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Loader2 } from "lucide-react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { sageChat, type SageChatResponse } from "@/lib/sage.functions";
import { supabase } from "@/integrations/supabase/client";
import { SageAvatar } from "@/components/SageAvatar";

/**
 * SageCompanion — the single, unified floating "Sage" avatar in the
 * bottom-left of the app. Non-fortune-telling: routes every message
 * through the server-side intent router in `sageChat`. Depending on
 * intent the reply is emotional support (uses AI), a deterministic
 * product / order / crisis / out-of-scope response (no AI), or a
 * hand-off to the Oracle Reading Room (no AI, no reading here).
 */

type ChatMsg = {
  role: "user" | "assistant";
  content: string;
  meta?: SageChatResponse;
};

const TIPS_ZH = ["我在。想聊点什么？", "小烦恼也可以说出来。", "不用完美，慢慢讲就好。"];
const TIPS_EN = [
  "I'm here. What's on your mind?",
  "Small worries welcome — I'll listen.",
  "No need to be tidy. Take your time.",
];

const OPENERS_ZH = [
  "夜色柔软。愿意告诉我，今天让你有点在意的是什么？",
  "我在这里。慢慢说，都可以。",
];
const OPENERS_EN = [
  "The night is soft. What's been on your mind today?",
  "I'm right here — take your time.",
];

export function ElderCompanion({ lang }: { lang: "en" | "zh" }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hidden = pathname.startsWith("/admin");
  const tips = lang === "zh" ? TIPS_ZH : TIPS_EN;
  const [open, setOpen] = useState(false);
  const [tipIdx, setTipIdx] = useState(() => Math.floor(Math.random() * tips.length));
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chat = useServerFn(sageChat);

  useEffect(() => {
    if (open) return;
    const id = setInterval(() => setTipIdx((i) => (i + 1) % tips.length), 16000);
    return () => clearInterval(id);
  }, [open, tips.length]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(Boolean(data.session?.user)));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthed(Boolean(session?.user));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!open) return;
    if (messages.length === 0) {
      const opener = (lang === "zh" ? OPENERS_ZH : OPENERS_EN)[Math.floor(Math.random() * 2)];
      setMessages([{ role: "assistant", content: opener }]);
    }
  }, [open, lang, messages.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, busy]);

  const currentTip = useMemo(() => tips[tipIdx % tips.length], [tips, tipIdx]);

  const send = async () => {
    const text = draft.trim();
    if (!text || busy) return;
    if (!authed) {
      setBanner(
        lang === "zh" ? "先登录，我才能听你慢慢说。" : "Please sign in first — then I can listen.",
      );
      return;
    }
    setBanner(null);
    setDraft("");
    const history = messages
      .filter((m) => !m.meta || m.meta.usedAi)
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setBusy(true);
    try {
      const res = await chat({ data: { message: text, lang, history } });
      setMessages((prev) => [...prev, { role: "assistant", content: res.text, meta: res }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            lang === "zh"
              ? `我这边一时没接住你的话，稍后再试一次好吗？（${msg}）`
              : `I couldn't quite hear you just now. Try again in a moment? (${msg})`,
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  if (hidden) return null;

  const sageLabel = lang === "zh" ? "智者" : "Sage Companion";

  return (
    <div
      className="pointer-events-none fixed bottom-2 left-2 z-40 flex items-end gap-2 print:hidden sm:bottom-6 sm:left-4"
      style={{
        paddingBottom: "max(env(safe-area-inset-bottom), 0.25rem)",
        paddingLeft: "env(safe-area-inset-left)",
      }}
    >
      <motion.button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) setTipIdx((i) => (i + 1) % tips.length);
        }}
        aria-label={sageLabel}
        title={sageLabel}
        className="pointer-events-auto group relative grid h-12 w-12 place-items-center rounded-full border border-gold-dust/40 bg-obsidian/80 p-0 shadow-[0_8px_20px_-8px_rgba(0,0,0,0.6)] backdrop-blur-md transition-transform hover:scale-[1.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-light sm:h-14 sm:w-14 motion-reduce:transition-none"
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <SageAvatar className="h-full w-full motion-safe:animate-pulse-gold motion-reduce:animate-none" />
        <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-gold-light shadow-[0_0_8px_var(--gold-light)] motion-safe:animate-pulse-gold" />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            className="pointer-events-auto relative mb-1 flex w-[calc(100vw-5rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-gold-dust/30 bg-obsidian/95 shadow-2xl backdrop-blur-md sm:w-[22rem]"
          >
            <div className="flex items-start justify-between gap-2 border-b border-gold-dust/20 px-4 py-3">
              <div>
                <p className="text-[9px] uppercase tracking-[0.32em] text-gold-dust/80">
                  {lang === "zh"
                    ? "智者陪伴 · 情绪、产品与订单"
                    : "Sage Companion · feelings, product & orders"}
                </p>
                <p className="mt-0.5 font-serif text-[13px] italic leading-snug text-stone-warm/95">
                  {currentTip}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-1 text-stone-warm/60 hover:text-gold-light"
                aria-label="close"
              >
                <X size={14} />
              </button>
            </div>

            <p className="border-b border-gold-dust/10 px-4 py-2 text-[10px] leading-relaxed text-stone-warm/55">
              {lang === "zh"
                ? "这里不读取命盘。命理解读请进入「神谕者阅读室」。"
                : "This companion does not read charts. For a chart reading, enter the Oracle Reading Room."}
            </p>

            <div
              ref={scrollRef}
              className="max-h-[46vh] min-h-[10rem] space-y-2 overflow-y-auto px-3 py-3"
            >
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2 text-[12.5px] leading-relaxed ${
                      m.role === "user"
                        ? "bg-gold-dust/20 text-stone-warm"
                        : m.meta?.intent === "crisis"
                          ? "border border-orange-400/40 bg-orange-500/10 text-orange-100"
                          : "bg-white/[0.04] font-serif italic text-stone-warm/95"
                    }`}
                  >
                    {m.content}
                  </div>
                  {m.role === "assistant" && m.meta && <NextActionRow meta={m.meta} lang={lang} />}
                </div>
              ))}
              {busy && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl bg-white/[0.04] px-3 py-2 text-[12px] text-stone-warm/70">
                    <Loader2 size={12} className="animate-spin" />
                    {lang === "zh" ? "智者正在听你说……" : "The Sage is listening…"}
                  </div>
                </div>
              )}
            </div>

            {banner && (
              <p className="mx-3 mb-2 rounded-lg border border-gold-dust/30 bg-gold-dust/10 px-2.5 py-1.5 text-[10.5px] leading-snug text-gold-light/90">
                {banner}
              </p>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
              className="flex items-end gap-2 border-t border-gold-dust/20 p-2"
            >
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                rows={1}
                placeholder={
                  authed === false
                    ? lang === "zh"
                      ? "先登录再来聊"
                      : "Sign in first"
                    : lang === "zh"
                      ? "说点什么…（Enter 发送）"
                      : "Say something… (Enter to send)"
                }
                disabled={busy}
                className="max-h-24 min-h-9 flex-1 resize-none rounded-lg border border-gold-dust/20 bg-obsidian/60 px-3 py-2 text-[12.5px] text-stone-warm placeholder:text-stone-warm/35 focus:border-gold-light/50 focus:outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!draft.trim() || busy}
                className="grid size-9 place-items-center rounded-lg bg-gold-dust/30 text-gold-light transition-colors hover:bg-gold-dust/45 disabled:opacity-40"
                aria-label="send"
              >
                <Send size={14} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NextActionRow({ meta, lang }: { meta: SageChatResponse; lang: "en" | "zh" }) {
  const na = meta.nextAction;
  if (!na || na.kind === "none" || na.kind === "crisis_support") return null;

  const zh = lang === "zh";
  if (na.kind === "enter_oracle") {
    return (
      <Link
        to="/me/oracle"
        search={{ source: na.source } as never}
        className="mt-1 inline-flex min-h-9 items-center rounded-full border border-gold-dust/40 px-3 py-1.5 text-[11px] text-gold-light hover:bg-gold-dust/10"
      >
        {zh ? "进入神谕者阅读室 →" : "Enter Oracle Reading Room →"}
      </Link>
    );
  }
  if (na.kind === "upgrade_oracle") {
    return (
      <Link
        to="/report"
        className="mt-1 inline-flex min-h-9 items-center rounded-full border border-gold-dust/30 px-3 py-1.5 text-[11px] text-gold-light/90 hover:bg-gold-dust/10"
      >
        {zh ? "了解神谕者月度会员（模拟支付）" : "About Oracle monthly (simulated payment)"}
      </Link>
    );
  }
  if (na.kind === "open_route") {
    return (
      <Link
        to={na.href as never}
        className="mt-1 inline-flex min-h-9 items-center rounded-full border border-gold-dust/25 px-3 py-1.5 text-[11px] text-stone-warm/85 hover:border-gold-dust/60"
      >
        {na.label[lang]} →
      </Link>
    );
  }
  if (na.kind === "provide_order_id") {
    return (
      <span className="mt-1 text-[10.5px] text-stone-warm/60">
        {meta.feedbackTicket
          ? zh
            ? `已记入后台 · 工单 ${meta.feedbackTicket.id.slice(0, 8)}`
            : `Filed · ticket ${meta.feedbackTicket.id.slice(0, 8)}`
          : zh
            ? "请把订单号发过来"
            : "Please share the order number"}
      </span>
    );
  }
  return null;
}
