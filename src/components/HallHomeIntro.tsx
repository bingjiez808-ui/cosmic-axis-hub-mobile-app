import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Feather,
  Mailbox,
  ScrollText,
  Landmark,
  BellRing,
  ShieldCheck,
} from "lucide-react";

import { useLang } from "@/lib/i18n";
import { useSupabaseSession } from "@/lib/session";

/**
 * HallHomeIntro — the guide-desk drawer body for card 06 (同门 · 众生之厅).
 *
 * Mirrors the template of the other home feature modules: hook copy →
 * four destinations → the three-step chain → safety note → CTAs.
 * Every link points at an existing /community route so the drawer has no
 * dead ends.
 */
export function HallHomeIntro() {
  const { lang } = useLang();
  const { session } = useSupabaseSession();
  const isZh = lang === "zh";
  const signedIn = !!session;

  const destinations = [
    {
      icon: Mailbox,
      to: "/community/write",
      zhTitle: "寄给一位陌生同门",
      enTitle: "To a stranger of your age",
      zhBody:
        "信使按年龄段投递给另一位旅者，对方读完写回音。完全匿名，不保证一定有人回，但每封信都会被送出。",
      enBody:
        "The courier delivers it to another traveller in your age band, who writes back. Fully anonymous; delivery is guaranteed, a reply is not.",
    },
    {
      icon: ScrollText,
      to: "/community/wall",
      zhTitle: "贴上公共信墙",
      enTitle: "Pin it on the public wall",
      zhBody:
        "全厅可见，任何同门都能留下回音。适合那些你想让更多人一起想一想的问题。",
      enBody:
        "Visible to the whole hall; anyone can leave an echo. Best for questions you want many minds on.",
    },
    {
      icon: Landmark,
      to: "/community/sages",
      zhTitle: "请一位先贤作答",
      enTitle: "Ask one of the sages",
      zhBody:
        "十二位历代先贤的作答人格，按学业、事业、爱情、人际、财富、自我分类，挑一位来读你的信。",
      enBody:
        "Twelve personas drawn from historical figures, sorted by study, career, love, boundaries, wealth and self — pick who reads your letter.",
    },
    {
      icon: Feather,
      to: "/community/grants",
      zhTitle: "请图书管理员安排真人回信",
      enTitle: "Ask the librarian for a human reply",
      zhBody:
        "开通贤者会员即赠 2 次先贤回信 + 1 次管理员授权（管理员亲自回，或委托一位旅者定向回）。之后 3 元/次、10 元/4 次。",
      enBody:
        "Sage membership gifts 2 sage replies + 1 librarian authorization (a personal reply, or a traveller entrusted to answer you). After that ¥3 / reply, ¥10 / 4 replies.",
    },
  ];

  const chain = isZh
    ? [
        "① 写：在写信台先选「寄给谁」，再按需要选年龄段与主题，写下你的信。",
        "② 寄：敏感词与规则提示会当场提醒，通过后落到对应的信箱或信墙。",
        "③ 等回音：进度条显示「等待回音 / 已有回音」，通知中心集中提醒，你也可以随时打开草稿继续写。",
      ]
    : [
        "1. Write — pick the destination first, then age band and topic, then the letter itself.",
        "2. Send — screening and the house rules check it in place, then it lands in the right box or on the wall.",
        "3. Wait — the progress strip shows waiting / answered, the notice centre gathers alerts, and drafts stay openable.",
      ];

  return (
    <section
      id="community-hall-intro"
      data-testid="home-hall-intro"
      className="relative z-10 mx-auto max-w-5xl px-1 pb-6"
    >
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-[10px] uppercase tracking-[0.36em] text-gold-dust/80">
          {isZh ? "同门 · 众生之厅" : "Same gate · The Hall of Beings"}
        </p>
        <h2 className="mt-3 font-serif text-2xl leading-tight text-stone-warm md:text-3xl">
          {isZh
            ? "命盘读完之后，还有一句话没说出口——写成一封匿名信。"
            : "After the chart is read, one sentence stays unsaid. Write it as an anonymous letter."}
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-stone-warm/70">
          {isZh
            ? "众生之厅不做点赞、不排名、不显示身份。你只写一封信，然后等一个人认真读完它、认真回你一封。四条去处，任选其一。"
            : "No likes, no ranking, no identities. You write one letter and wait for one person to read it properly and answer. Four destinations, choose one."}
        </p>
      </div>

      <ul className="mt-10 grid gap-4 sm:grid-cols-2">
        {destinations.map((it, i) => (
          <motion.li
            key={it.enTitle}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.45, delay: i * 0.05 }}
          >
            <Link
              to={it.to}
              className="flex h-full flex-col rounded-2xl border border-gold-dust/15 bg-obsidian/40 p-5 backdrop-blur-sm transition hover:border-gold-dust/45 hover:bg-obsidian/60"
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
            </Link>
          </motion.li>
        ))}
      </ul>

      <div className="mt-8 rounded-2xl border border-gold-dust/15 bg-obsidian/40 p-5">
        <p className="text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
          {isZh ? "一封信的完整路径" : "The path of one letter"}
        </p>
        <ol className="mt-3 space-y-2 text-sm leading-relaxed text-stone-warm/75">
          {chain.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      </div>

      <div className="mt-4 flex items-start gap-3 rounded-2xl border border-gold-dust/10 bg-obsidian/30 p-5 text-sm leading-relaxed text-stone-warm/65">
        <ShieldCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-gold-dust" />
        <p>
          {isZh
            ? "全程匿名：不显示昵称、命盘或联系方式。写信前会看到规则提示，内容经过敏感词审查，任何信件与回音都可举报。"
            : "Anonymous throughout: no nickname, chart or contact is shown. House rules appear before you write, content is screened, and any letter or echo can be reported."}
        </p>
      </div>

      <div className="mt-10 flex flex-col items-center gap-3">
        {signedIn ? (
          <>
            <Link
              to="/community/write"
              data-testid="hall-intro-cta-primary"
              className="inline-flex min-h-11 items-center rounded-full border border-gold-dust/40 bg-obsidian/80 px-10 py-4 text-xs uppercase tracking-[0.32em] text-gold-dust transition hover:border-gold-dust hover:bg-gold-dust/10"
            >
              {isZh ? "去写信台写一封" : "Open the writing desk"}
            </Link>
            <Link
              to="/community/notices"
              className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.32em] text-stone-warm/60 hover:text-gold-dust"
            >
              <BellRing aria-hidden className="h-3.5 w-3.5" />
              {isZh ? "查看我的来信通知中心" : "My notice centre"}
            </Link>
          </>
        ) : (
          <>
            <Link
              to="/community"
              data-testid="hall-intro-cta-primary"
              className="inline-flex min-h-11 items-center rounded-full border border-gold-dust/40 bg-obsidian/80 px-10 py-4 text-xs uppercase tracking-[0.32em] text-gold-dust transition hover:border-gold-dust hover:bg-gold-dust/10"
            >
              {isZh ? "先逛逛众生之厅" : "Look around the hall"}
            </Link>
            <Link
              to="/auth"
              search={{ redirect: "/community/write" } as never}
              className="text-[11px] uppercase tracking-[0.32em] text-stone-warm/60 hover:text-gold-dust"
            >
              {isZh ? "登录后开始写信" : "Sign in to start writing"}
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
