/**
 * 同门 · 机制说明 — the whole chain, written out once so nobody has to guess:
 * where a letter can go, what it costs, who may answer it, and how a good
 * answer is rewarded.
 */
import { Link } from "@tanstack/react-router";

import { HallSection } from "@/experiences/community-hall/HallShell";
import { useCommunityHall } from "@/lib/i18n-community-hall";

type Rule = { title: string; body: string; tag?: string };

export function HallMechanismSection() {
  const c = useCommunityHall();
  const zh = c.lang !== "en";

  const routes: Rule[] = zh
    ? [
        {
          title: "信使定向投递",
          tag: "免费",
          body: "系统按主题与年龄段，把信悄悄送到一位陌生旅者手中。对方可回可不回。",
        },
        {
          title: "公共信墙",
          tag: "免费",
          body: "张贴给全厅，任何旅者都能读、都能回。适合想听见很多声音的问题。",
        },
        {
          title: "先贤回信",
          tag: "贤者会员",
          body: "十二位已故思想者之一，以其一生经历与看家本领作答。可随时写，不消耗真人次数。",
        },
        {
          title: "图书管理员亲自回信",
          tag: "贤者会员 · 赠 3 次",
          body: "由管理员本人执笔，或由他托付给一位愿意接信的旅者。每寄出一封消耗一次赠送机会。",
        },
      ]
    : [
        {
          title: "Courier delivery",
          tag: "Free",
          body: "The system quietly hands your letter to one stranger matched by topic and age chapter. They may answer, or not.",
        },
        {
          title: "The public wall",
          tag: "Free",
          body: "Pinned for the whole hall; anyone may read and reply. Best when you want many voices.",
        },
        {
          title: "A sage's reply",
          tag: "Sage membership",
          body: "One of twelve long-dead thinkers answers in their own voice, through their distilled skill. Write as often as you like — it never spends a human reply.",
        },
        {
          title: "The librarian in person",
          tag: "Sage · 3 gifted",
          body: "Written by the librarian, or by a traveler they entrust. Each letter spends one of the three gifted human replies.",
        },
      ];

  const chain: Rule[] = zh
    ? [
        {
          title: "1 · 开通即赠三次",
          body: "开通「贤者」后，前往「真人回复」页面领取 3 次机会。这是一次性赠送，不会每月重置；用完为止。",
        },
        {
          title: "2 · 一次可有两种去处",
          body: "同一次机会，既可以让管理员本人回信，也可以由管理员托付给一位「愿意接信」的旅者定向回复——两者都消耗一次。",
        },
        {
          title: "3 · 收到回音后可评分",
          body: "只有寄信人能给真人回音打 1–5 星，并留一句悄悄话。评分匿名，回信人只看到结果。",
        },
        {
          title: "4 · 好评累积换取奖励",
          body: "受托旅者累计 3 封被评分的回音、平均 4.5 星以上、且其中至少 3 封为四星以上，即自动获赠一个月「神谕者」会员。",
        },
        {
          title: "5 · 冷却与防刷",
          body: "每位受托者 30 天内最多获奖一次；先贤的 AI 回音不参与评分，也不计入奖励。",
        },
      ]
    : [
        {
          title: "1 · Three gifted on joining",
          body: "Once you hold the Sage membership, claim your three human replies on the grants page. It is a one-time gift — no monthly reset.",
        },
        {
          title: "2 · One credit, two possible hands",
          body: "The same credit buys either the librarian's own reply or a directed reply from a traveler they entrust. Both spend one.",
        },
        {
          title: "3 · Rate the echo you receive",
          body: "Only the letter's author may rate a human echo 1–5 stars and leave a quiet line. Ratings stay anonymous.",
        },
        {
          title: "4 · Good echoes earn a month",
          body: "An entrusted traveler with three rated echoes, an average above 4.5★, and at least three ratings of 4–5★ is automatically granted a month of Oracle membership.",
        },
        {
          title: "5 · Cooldown, and no farming",
          body: "At most one reward every 30 days per helper. A sage's AI echo cannot be rated and never counts toward the reward.",
        },
      ];

  return (
    <HallSection title={zh ? "机制说明" : "How the hall works"}>
      <div className="grid gap-4 sm:grid-cols-2">
        {routes.map((r) => (
          <article key={r.title} className="hall-paper p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="hall-card-title">{r.title}</h3>
              {r.tag ? (
                <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[0.65rem] text-primary">
                  {r.tag}
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{r.body}</p>
          </article>
        ))}
      </div>

      <div className="hall-paper mt-4 p-5">
        <h3 className="hall-card-title">
          {zh ? "真人回复与回信奖励的完整链条" : "The human-reply chain, end to end"}
        </h3>
        <ol className="mt-3 space-y-3">
          {chain.map((step) => (
            <li key={step.title} className="text-sm leading-relaxed">
              <span className="text-foreground">{step.title}</span>
              <span className="text-muted-foreground"> — {step.body}</span>
            </li>
          ))}
        </ol>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link to="/community/grants" className="text-primary hover:underline">
            {zh ? "去领取真人回复 →" : "Claim your human replies →"}
          </Link>
          <Link to="/community/errands" className="text-primary hover:underline">
            {zh ? "查看托付给我的信与声望 →" : "Letters entrusted to me →"}
          </Link>
          <Link to="/me/community" className="text-primary hover:underline">
            {zh ? "设置是否愿意接信 →" : "Choose whether to receive entrusted letters →"}
          </Link>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {zh
            ? "所有往来始终匿名：无论对方是旅者、图书管理员还是先贤，双方只看得到旅者身份。"
            : "Every exchange stays anonymous: traveler, librarian or sage, both sides only ever see a traveler identity."}
        </p>
      </div>
    </HallSection>
  );
}
