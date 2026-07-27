import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { CalendarDays, Compass, Users, HeartHandshake, Sparkles, ScrollText } from "lucide-react";

import { useLang } from "@/lib/i18n";
import { useSupabaseSession } from "@/lib/session";

/**
 * HomePersonalDeskTeaser — landing-page module that explains what a
 * signed-in user gets on `/me/home`. Not a duplicate of the feature
 * shelf: focused on the *daily* value + the personal desk metaphor.
 *
 * CTA is session-aware:
 * - signed-in → primary "Open my reading desk" (→ /me/home)
 * - signed-out → primary "Sign in to open my desk" (→ /auth?redirect=/me/home)
 *                secondary "Start the ritual" (→ /ritual)
 */
export function HomePersonalDeskTeaser() {
  const { lang } = useLang();
  const { session } = useSupabaseSession();
  const isZh = lang === "zh";
  const signedIn = !!session;

  const items = [
    {
      icon: CalendarDays,
      zhTitle: "今日命运 · 未来 7 天",
      enTitle: "Today's Fate · next 7 days",
      zhBody:
        "每天登录看到今日主线、六个生活领域的白话建议，还能滑动预览下周的能量走向。",
      enBody:
        "Every visit opens with today's line, plain-language notes for six life domains and a 7-day energy preview.",
    },
    {
      icon: Compass,
      zhTitle: "命盘与报告",
      enTitle: "Charts & Reports",
      zhBody:
        "保存主命盘和他人命盘（一次生成，永久保存），随时打开综合解读或 ¥79 深度报告。",
      enBody:
        "Save your primary chart and others (generated once, kept forever); open the free panorama or your ¥79 deep report anytime.",
    },
    {
      icon: Users,
      zhTitle: "好友与来信",
      enTitle: "Friends & letters",
      zhBody: "接收好友邀请、写下便签、控制谁能看到你的推导——一切都需你先确认。",
      enBody:
        "Receive friend invites, exchange notes and control who ever sees anything derived from your chart — always opt-in.",
    },
    {
      icon: HeartHandshake,
      zhTitle: "适配分析",
      enTitle: "Match analysis",
      zhBody:
        "选两张已保存的命盘做兼容度分析，或匿名地在社区匹配池里寻找共鸣。",
      enBody:
        "Compare two saved charts, or enter the anonymous match pool to find people whose patterns resonate.",
    },
    {
      icon: ScrollText,
      zhTitle: "历史回声",
      enTitle: "Historical echoes",
      zhBody:
        "在同类人生阶段，历史上曾经面对相似课题的人是如何走过的——收藏你想留下的书签。",
      enBody:
        "See how historical figures at the same life stage navigated similar questions, and bookmark the ones you want to keep.",
    },
    {
      icon: Sparkles,
      zhTitle: "会员与订单",
      enTitle: "Membership & orders",
      zhBody:
        "查看月度神谕者会员状态、到期时间、报告订单与工单——从不会静默续费。",
      enBody:
        "See your monthly Oracle status, expiry, report orders and support tickets — never any silent renewal.",
    },
  ];

  return (
    <section
      id="personal-desk"
      data-testid="home-personal-desk-teaser"
      className="relative z-10 mx-auto max-w-6xl px-6 py-20"
    >
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-[10px] uppercase tracking-[0.36em] text-gold-dust/80">
          {isZh ? "登录后 · 你的个人阅览桌" : "After sign-in · your reading desk"}
        </p>
        <h2 className="mt-3 font-serif text-3xl leading-tight text-stone-warm md:text-4xl">
          {isZh
            ? "登录之后，每天回来打开的是你的一张桌子。"
            : "Once you sign in, coming back opens your own desk."}
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-stone-warm/65 md:text-base">
          {isZh
            ? "不是一次性读一份报告就结束，而是每天有一件确定可做的事：今日主线、命盘、好友、匹配、历史回声、会员，都在同一张阅览桌上。"
            : "Not a one-off report. Each day has one clear thing to do — today's line, your charts, friends, match, historical echoes and membership all on the same desk."}
        </p>
      </div>

      <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it, i) => (
          <motion.li
            key={it.enTitle}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.5, delay: i * 0.05 }}
            className="rounded-2xl border border-gold-dust/15 bg-obsidian/40 p-5 backdrop-blur-sm"
          >
            <div className="mb-3 flex items-center gap-2">
              <span
                aria-hidden
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gold-dust/10 text-gold-dust"
              >
                <it.icon className="h-4 w-4" />
              </span>
              <h3 className="font-serif text-base text-stone-warm">
                {isZh ? it.zhTitle : it.enTitle}
              </h3>
            </div>
            <p className="text-sm leading-relaxed text-stone-warm/70">
              {isZh ? it.zhBody : it.enBody}
            </p>
          </motion.li>
        ))}
      </ul>

      <div className="mt-12 flex flex-col items-center gap-3">
        {signedIn ? (
          <Link
            to="/me/home"
            data-testid="desk-teaser-cta-primary"
            className="inline-flex min-h-11 items-center rounded-full border border-gold-dust/40 bg-obsidian/80 px-10 py-4 text-xs uppercase tracking-[0.32em] text-gold-dust transition hover:border-gold-dust hover:bg-gold-dust/10"
          >
            {isZh ? "进入我的主页" : "Open my reading desk"}
          </Link>
        ) : (
          <>
            <Link
              to="/auth"
              search={{ redirect: "/me/home" } as never}
              data-testid="desk-teaser-cta-primary"
              className="inline-flex min-h-11 items-center rounded-full border border-gold-dust/40 bg-obsidian/80 px-10 py-4 text-xs uppercase tracking-[0.32em] text-gold-dust transition hover:border-gold-dust hover:bg-gold-dust/10"
            >
              {isZh ? "登录后打开我的阅览桌" : "Sign in to open my desk"}
            </Link>
            <Link
              to="/ritual"
              data-testid="desk-teaser-cta-secondary"
              className="text-[11px] uppercase tracking-[0.32em] text-stone-warm/60 hover:text-gold-dust"
            >
              {isZh ? "先开启仪式，登记我的命盘" : "First open the ritual · register a chart"}
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
