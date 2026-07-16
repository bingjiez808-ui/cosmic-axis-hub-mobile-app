import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";

import { elderChat } from "@/lib/elder.functions";
import { supabase } from "@/integrations/supabase/client";

/**
 * ElderCompanion — small floating "sage" avatar (bottom-left) that opens
 * a gentle tree-hole chat. Non-fortune-telling; device/order keywords are
 * forwarded to `user_feedback` on the backend.
 */

type ChatMsg = { role: "user" | "assistant"; content: string };

const TIPS_ZH = [
  "我在。想聊点什么？",
  "小烦恼也可以说出来，我听。",
  "不用完美，慢慢讲就好。",
];
const TIPS_EN = [
  "I'm here. What's on your mind?",
  "Small worries welcome — I'll listen.",
  "No need to be tidy. Take your time.",
];

const OPENERS_ZH = [
  "夜色柔软。愿意告诉我，今天让你有点在意的是什么？",
  "我在这里。想倒一点什么，都可以慢慢说。",
];
const OPENERS_EN = [
  "The night is soft. Tell me — what's been on your mind today?",
  "I'm right here. Pour out whatever you need, at your own pace.",
];

export function ElderCompanion({ lang }: { lang: "en" | "zh" }) {
  const tips = lang === "zh" ? TIPS_ZH : TIPS_EN;
  const [open, setOpen] = useState(false);
  const [tipIdx, setTipIdx] = useState(() => Math.floor(Math.random() * tips.length));
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chat = useServerFn(elderChat);

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
      const opener = (lang === "zh" ? OPENERS_ZH : OPENERS_EN)[
        Math.floor(Math.random() * 2)
      ];
      setMessages([{ role: "assistant", content: opener }]);
    }
  }, [open, lang, messages.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const currentTip = useMemo(() => tips[tipIdx % tips.length], [tips, tipIdx]);

  const send = async () => {
    const text = draft.trim();
    if (!text || busy) return;
    if (!authed) {
      setBanner(lang === "zh" ? "先登录，我才能听你慢慢说。" : "Please sign in first — then I can listen.");
      return;
    }
    setBanner(null);
    setDraft("");
    const history = messages.slice(-10).map((m) => ({ role: m.role, content: m.content }));
    const nextUser: ChatMsg = { role: "user", content: text };
    setMessages((prev) => [...prev, nextUser]);
    setBusy(true);
    try {
      const res = await chat({ data: { message: text, lang, history } });
      setMessages((prev) => [...prev, { role: "assistant", content: res.text }]);
      if (res.feedback.recorded) {
        setBanner(
          lang === "zh"
            ? `已把这条${res.feedback.category === "device" ? "设备" : "订单"}反馈记入后台，团队会尽快跟进。`
            : `Your ${res.feedback.category} note is now in our team inbox — we'll follow up.`,
        );
      }
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

  return (
    <div className="pointer-events-none fixed bottom-4 left-3 z-40 flex items-end gap-2 print:hidden sm:bottom-6 sm:left-4">
      <motion.button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) setTipIdx((i) => (i + 1) % tips.length);
        }}
        aria-label={lang === "zh" ? "智者" : "The elder"}
        className="pointer-events-auto relative grid size-11 place-items-center rounded-full border border-gold-dust/40 bg-obsidian/80 shadow-[0_8px_20px_-8px_rgba(0,0,0,0.6)] backdrop-blur-md transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-light sm:size-12"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
      >
        <span
          className="absolute inset-0 rounded-full animate-pulse-gold"
          style={{
            background:
              "radial-gradient(circle at 50% 40%, color-mix(in oklab, var(--gold-dust) 45%, transparent) 0%, transparent 65%)",
          }}
          aria-hidden="true"
        />
        <svg viewBox="0 0 64 64" className="relative size-7 sm:size-8" aria-hidden="true">
          <defs>
            <linearGradient id="sage-robe" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="color-mix(in oklab, var(--gold-light) 80%, transparent)" />
              <stop offset="100%" stopColor="color-mix(in oklab, var(--gold-dust) 20%, transparent)" />
            </linearGradient>
          </defs>
          <path d="M12 60 C 16 44, 20 38, 32 38 C 44 38, 48 44, 52 60 Z" fill="url(#sage-robe)" opacity="0.85" />
          <path d="M22 34 C 24 46, 28 52, 32 54 C 36 52, 40 46, 42 34 Z" fill="color-mix(in oklab, var(--stone-warm) 85%, transparent)" opacity="0.9" />
          <circle cx="32" cy="26" r="9" fill="color-mix(in oklab, var(--gold-light) 70%, transparent)" />
          <path d="M20 26 C 22 14, 30 10, 32 10 C 34 10, 42 14, 44 26 Z" fill="color-mix(in oklab, var(--nebula-purple) 60%, transparent)" />
          <path d="M32 15 l1 2.5 l2.6 0.3 l-1.9 1.8 l0.5 2.6 l-2.2 -1.3 l-2.2 1.3 l0.5 -2.6 l-1.9 -1.8 l2.6 -0.3 z" fill="var(--gold-light)" />
          <circle cx="29" cy="26" r="0.9" fill="var(--obsidian)" />
          <circle cx="35" cy="26" r="0.9" fill="var(--obsidian)" />
        </svg>
        <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-gold-light shadow-[0_0_8px_var(--gold-light)] animate-pulse-gold" />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            className="pointer-events-auto relative mb-1 flex w-[86vw] max-w-sm flex-col overflow-hidden rounded-2xl border border-gold-dust/30 bg-obsidian/95 shadow-2xl backdrop-blur-md sm:w-[22rem]"
          >
            <div className="flex items-start justify-between gap-2 border-b border-gold-dust/20 px-4 py-3">
              <div>
                <p className="text-[9px] uppercase tracking-[0.32em] text-gold-dust/80">
                  {lang === "zh" ? "智者 · 树洞" : "Elder · tree hole"}
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
                ? "这里聊小烦恼、小吐槽——不做命理解读。设备或订单问题会自动记入反馈。"
                : "A place for small worries — not a reading. Device or order notes go to the team automatically."}
            </p>

            <div
              ref={scrollRef}
              className="max-h-[46vh] min-h-[10rem] space-y-2 overflow-y-auto px-3 py-3"
            >
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-[12.5px] leading-relaxed ${
                      m.role === "user"
                        ? "bg-gold-dust/20 text-stone-warm"
                        : "bg-white/[0.04] font-serif italic text-stone-warm/95"
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {busy && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl bg-white/[0.04] px-3 py-2 text-[12px] text-stone-warm/70">
                    <Loader2 size={12} className="animate-spin" />
                    {lang === "zh" ? "智者正在听你说……" : "The elder is listening…"}
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
                disabled={authed === false || busy}
                className="max-h-24 min-h-9 flex-1 resize-none rounded-lg border border-gold-dust/20 bg-obsidian/60 px-3 py-2 text-[12.5px] text-stone-warm placeholder:text-stone-warm/35 focus:border-gold-light/50 focus:outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!draft.trim() || busy || authed === false}
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
