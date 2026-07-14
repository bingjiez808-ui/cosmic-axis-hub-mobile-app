import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

import {
  FiveElements,
  StrengthRadar,
  ZodiacWheel,
} from "@/components/charts/DestinyCharts";
import {
  FutureWatchlist,
  KeyEventsVerification,
  LifeTimeline,
  MembershipSection,
  SaveReadingBar,
  TarotDraw,
} from "@/components/ReportExtras";
import { AccountModal } from "@/components/AccountModal";
import { useLang } from "@/lib/i18n";

type SearchParams = {
  name?: string;
  date?: string;
  time?: string;
  place?: string;
  lang?: "en" | "zh";
};

export const Route = createFileRoute("/report")({
  head: () => ({
    meta: [
      { title: "Your reading — Library of Destiny" },
      {
        name: "description",
        content:
          "The unified AI reading of your life, synthesized across four ancient traditions.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): SearchParams => ({
    name: typeof s.name === "string" ? s.name : undefined,
    date: typeof s.date === "string" ? s.date : undefined,
    time: typeof s.time === "string" ? s.time : undefined,
    place: typeof s.place === "string" ? s.place : undefined,
    lang: s.lang === "zh" ? "zh" : s.lang === "en" ? "en" : undefined,
  }),
  component: ReportPage,
});

type DetailBlock = { label: [string, string]; items: [string, string][] };

type Dimension = {
  key: string;
  title: [string, string];
  headline: [string, string];
  stars: number;
  strengths: [number, number, number, number]; // astrology, jyotish, bazi, ziwei
  evidence: { tradition: [string, string]; note: [string, string] }[];
  synthesis: [string, string];
  plain: [string, string];
  viz: "zodiac" | "elements" | "radar";
  elementStrengths?: [number, number, number, number, number]; // wood, fire, earth, metal, water
  details?: DetailBlock[];
};

const dimensions: Dimension[] = [
  {
    key: "character",
    title: ["Character", "性格特质"],
    headline: [
      "A double-signed temperament — warm outside, exacting inside",
      "外热内冷 — 一副双签名的性情",
    ],
    stars: 5,
    strengths: [0.9, 0.85, 0.75, 0.8],
    evidence: [
      {
        tradition: ["Astrology", "西方占星"],
        note: ["Sun in fire · Mercury retrograde in the 3rd house", "太阳落火象 · 水星逆行于第三宫"],
      },
      {
        tradition: ["Jyotish", "印度占星"],
        note: ["Moon in Rohini · Jupiter aspecting the Lagna", "月亮居 Rohini · 木星照命宫"],
      },
      {
        tradition: ["BaZi", "八字"],
        note: ["Yang Fire Day Master · strong Wood support", "阳火日主 · 木旺相生"],
      },
      {
        tradition: ["Zi Wei", "紫微"],
        note: ["紫微 in the palace of self with 化科", "紫微坐命 · 化科"],
      },
    ],
    synthesis: [
      "Four systems converge on a personality that leads outwardly but revises inwardly — socially generous, privately exacting.",
      "四大体系一致指向：对外慷慨领导，对内反复斟酌 —— 一种既有影响力，也需要独处修复的性情。",
    ],
    plain: [
      "In everyday words: you're the person others come to for warmth and momentum, but at home you replay conversations and want to get things exactly right. That gap is fuel, not a flaw — just protect quiet time to recharge.",
      "说人话：别人愿意找你要温度和主意，但你回到房间会把每句话重放一遍。这个落差是你的燃料，不是缺陷 —— 只需要留出独处时间充电。",
    ],
    viz: "zodiac",
  },
  {
    key: "vocation",
    title: ["Vocation", "事业方向"],
    headline: [
      "Built to lead, not to repeat",
      "为领导而生，非为重复而设",
    ],
    stars: 4,
    strengths: [0.85, 0.8, 0.9, 0.7],
    evidence: [
      { tradition: ["Astrology", "西方占星"], note: ["Sun conjunct Midheaven in the 10th", "太阳合天顶于第十宫"] },
      { tradition: ["Jyotish", "印度占星"], note: ["Jupiter in the 10th Bhava", "木星居第十宫"] },
      { tradition: ["BaZi", "八字"], note: ["Officer star 正官 prominent in the month pillar", "月柱正官显位"] },
      { tradition: ["Zi Wei", "紫微"], note: ["紫微天府 in the career palace", "紫微天府入官禄宫"] },
    ],
    synthesis: [
      "All four traditions converge: leadership, autonomy or founding roles will outperform repetitive execution work.",
      "四体系合鸣：领导、自主或创办角色，长期表现将远优于重复执行的岗位。",
    ],
    plain: [
      "In everyday words: a 9-to-5 with a fixed script will drain you. You do best when you can set the rules — management, founding, teaching, research. Don't feel guilty about disliking pure execution roles; the chart genuinely doesn't fit them.",
      "说人话：脚本固定的打卡工作会磨光你的电。你更适合当规则制定者 —— 管理、创业、教学、研究。不必为讨厌纯执行的岗位而内疚，你的盘确实不契合它。",
    ],
    viz: "radar",
    details: [
      {
        label: ["Suitable industries", "适合的行业"],
        items: [
          ["Education, publishing, media", "教育 · 出版 · 媒体"],
          ["Technology · product · design", "科技 · 产品 · 设计"],
          ["Consulting · research · strategy", "咨询 · 研究 · 战略"],
          ["Culture, translation, cross-border", "文化 · 翻译 · 跨境"],
        ],
      },
      {
        label: ["Roles that fit", "适配的岗位"],
        items: [
          ["Founder / co-founder", "创始人 / 联合创始人"],
          ["Head of product · head of research", "产品负责人 · 研究负责人"],
          ["Editor-in-chief · lead teacher", "主编 · 首席讲师"],
          ["Independent expert / advisor", "独立专家 / 顾问"],
        ],
      },
    ],
  },
    title: ["Wealth", "财富格局"],
    headline: [
      "Built over cycles, not seasons",
      "以周期积累，而非季节暴富",
    ],
    stars: 4,
    strengths: [0.75, 0.7, 0.85, 0.7],
    evidence: [
      { tradition: ["Astrology", "西方占星"], note: ["Venus trine Jupiter", "金星三合木星"] },
      { tradition: ["Jyotish", "印度占星"], note: ["Dhana yoga forming", "形成 Dhana Yoga"] },
      { tradition: ["BaZi", "八字"], note: ["Wealth star 正财 with element support", "正财有力有根"] },
      { tradition: ["Zi Wei", "紫微"], note: ["武曲 aspecting the wealth palace", "武曲照财帛宫"] },
    ],
    synthesis: [
      "The reading does not indicate sudden fortune. It indicates compounding — wealth built through decisions repeated over decades.",
      "命盘并不主暴富，而主复利 —— 财富来自你在数十年里反复做出的正确决定。",
    ],
    plain: [
      "In everyday words: don't chase overnight windfalls. Your money-shape is boring on purpose — invest steadily, keep your fixed costs low, hold assets for years. The chart rewards patience with real freedom around midlife.",
      "说人话：别指望一夜暴富。你的财富节奏本就是「无聊而稳定」—— 持续投入、控制固定开销、长期持有。这张盘用中年之后的真正自由，回报你的耐心。",
    ],
    viz: "elements",
    elementStrengths: [0.6, 0.8, 0.7, 0.85, 0.4], // wood fire earth metal water
  },
  {
    key: "love",
    title: ["Love & Marriage", "情感与婚姻"],
    headline: [
      "Late clarity rewards early patience",
      "晚一点看清，胜过早一点将就",
    ],
    stars: 3,
    strengths: [0.6, 0.7, 0.55, 0.75],
    evidence: [
      { tradition: ["Astrology", "西方占星"], note: ["Venus square Saturn — mature love pattern", "金星刑土星 — 成熟型恋爱模式"] },
      { tradition: ["Jyotish", "印度占星"], note: ["7th lord aspected by Saturn", "七宫主受土星照射"] },
      { tradition: ["BaZi", "八字"], note: ["Spouse palace strong in later luck pillars", "夫妻宫于后运走强"] },
      { tradition: ["Zi Wei", "紫微"], note: ["天同化禄 in the marriage palace", "天同化禄入夫妻宫"] },
    ],
    synthesis: [
      "Three traditions concur that partnership deepens later; one warns against forcing timing. Depth over speed.",
      "三大体系一致：关系在偏后的年纪才会深化；一大体系提醒不要强求时机。深度比速度更重要。",
    ],
    plain: [
      "In everyday words: early relationships often teach rather than last. Don't panic about timing — the person who actually fits you shows up when you've stopped auditioning for approval. Choose depth, not urgency.",
      "说人话：早期恋爱多半是学习，不是终点。别被时间焦虑推着走 —— 真正适合的那个人，是在你不再为被认可而表演之后出现的。选深度，不选着急。",
    ],
    viz: "radar",
  },
  {
    key: "health",
    title: ["Health & Vitality", "健康与活力"],
    headline: [
      "Fire tempered by water",
      "火盛，需水来调",
    ],
    stars: 4,
    strengths: [0.7, 0.75, 0.8, 0.65],
    evidence: [
      { tradition: ["Astrology", "西方占星"], note: ["Ascendant ruler cadent", "命主星落续宫"] },
      { tradition: ["Jyotish", "印度占星"], note: ["6th lord in a friendly sign", "六宫主入友好星座"] },
      { tradition: ["BaZi", "八字"], note: ["Fire dominant · needs Water", "火旺 · 需水制"] },
      { tradition: ["Zi Wei", "紫微"], note: ["疾厄宫 lightly afflicted", "疾厄宫轻煞"] },
    ],
    synthesis: [
      "Vitality is generally strong; the shared concern is over-heating — mental over-drive, sleep debt, inflammation.",
      "整体活力充足；共同的隐忧是「过热」—— 大脑过载、睡眠债务、慢性炎症。",
    ],
    plain: [
      "In everyday words: your engine runs hot. Sleep is not optional, cold water and slow breathing are your friends, and skipping rest days will cost you more than skipping workouts. Cool yourself down as seriously as you push yourself.",
      "说人话：你这台引擎天生偏热。睡觉不是可选项，冷水和慢呼吸是你的好朋友；跳过休息日的代价比跳过训练日更大。给自己降温，要像逼自己前进一样认真。",
    ],
    viz: "elements",
    elementStrengths: [0.5, 0.9, 0.55, 0.6, 0.3],
  },
  {
    key: "mission",
    title: ["Life Mission", "人生使命"],
    headline: [
      "To translate — between worlds, between people",
      "翻译者 — 在世界之间、在人与人之间",
    ],
    stars: 5,
    strengths: [0.95, 0.9, 0.85, 0.9],
    evidence: [
      { tradition: ["Astrology", "西方占星"], note: ["North Node in the 9th house", "北交点入第九宫"] },
      { tradition: ["Jyotish", "印度占星"], note: ["Rahu in the 9th Bhava · dharma", "Rahu 入第九宫 · 主 dharma"] },
      { tradition: ["BaZi", "八字"], note: ["Output star 伤官/食神 favoured", "食伤为喜"] },
      { tradition: ["Zi Wei", "紫微"], note: ["迁移宫 activated", "迁移宫动"] },
    ],
    synthesis: [
      "Four systems name the same shape: your life reads as a bridge — translation, teaching, publishing, or institutions that carry meaning across contexts.",
      "四体系描出的是同一形状：你这一生是桥 —— 翻译、教学、出版，或搭建把意义送过界的机构。",
    ],
    plain: [
      "In everyday words: your job — whatever its title — will always secretly be to explain one world to another. East to West, expert to beginner, old to new. The moments you feel most alive are usually the moments you're translating something for someone.",
      "说人话：无论职位叫什么，你真正在做的一直是把一个世界解释给另一个世界听 —— 中西之间、专家与小白之间、旧与新之间。你最有生命力的时刻，通常都是在为某人翻译某件事。",
    ],
    viz: "zodiac",
  },
];

function Stars({ n }: { n: number }) {
  return (
    <span className="tracking-[0.3em] text-gold-dust">
      {"★".repeat(n)}
      <span className="text-stone-warm/20">{"★".repeat(5 - n)}</span>
    </span>
  );
}

function ReportPage() {
  const search = Route.useSearch();
  const { lang, setLang, t } = useLang();
  const li = lang === "zh" ? 1 : 0;

  // Sync report language with the choice made in the ritual, if provided.
  useEffect(() => {
    if (search.lang && search.lang !== lang) setLang(search.lang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.lang]);

  const summary =
    lang === "zh"
      ? "你的人生更像探险者的图谱，而非追随者的轨迹 —— 一张反复回到「志业、意义与再次选择的勇气」的星图。"
      : "Your life is written more as an explorer's than a follower's — a chart that repeatedly returns to the questions of vocation, meaning and the courage to choose again.";

  return (
    <div className="pt-32 pb-32">
      {/* Hero */}
      <header className="mx-auto max-w-4xl px-6 pb-16 text-center">
        <p className="mb-4 text-[10px] uppercase tracking-[0.42em] text-gold-dust">
          {t.report_kicker}
        </p>
        <h1 className="mb-6 font-serif text-4xl leading-[1.1] text-stone-warm md:text-6xl">
          {search.name ? (
            <>
              <span className="italic gold-gradient-text">{search.name}</span>
              <br />
              {t.report_read_across}
            </>
          ) : lang === "zh" ? (
            <>你的一生，被四大体系同时阅读</>
          ) : (
            <>Your life, read across four traditions</>
          )}
        </h1>
        <p className="mx-auto mt-6 max-w-3xl font-serif text-xl italic leading-relaxed text-stone-warm/80 md:text-2xl">
          “{summary}”
        </p>
        {(search.date || search.place) && (
          <p className="mt-8 text-[10px] uppercase tracking-[0.4em] text-stone-warm/40">
            {[search.date, search.time, search.place].filter(Boolean).join(" · ")}
          </p>
        )}
      </header>

      {/* Interactive natal wheel */}
      <section className="mx-auto mb-24 max-w-5xl px-6">
        <div className="glass-card rounded-3xl p-8 md:p-12">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
            <div>
              <p className="mb-3 text-[10px] uppercase tracking-[0.4em] text-gold-dust">
                {lang === "zh" ? "你的十二宫图" : "Your zodiac wheel"}
              </p>
              <h2 className="mb-4 font-serif text-3xl italic text-stone-warm md:text-4xl">
                {lang === "zh"
                  ? "悬停一个星座 · 让盘活起来"
                  : "Hover a sign · let the wheel breathe"}
              </h2>
              <p className="text-sm leading-relaxed text-stone-warm/60">
                {lang === "zh"
                  ? "外环是天空的刻度，中环是十二星座，内核是发光的命宫。命盘不是判决书，而是一台你可以查阅的仪器。"
                  : "The outer ring marks the sky, the middle ring holds the twelve signs, the inner core glows with your ascendant. The chart is not a verdict — it is an instrument you can consult."}
              </p>
            </div>
            <div className="text-stone-warm/40">
              <ZodiacWheel lang={lang} size={360} />
            </div>
          </div>
        </div>
      </section>

      {/* Dimensions */}
      <section className="mx-auto max-w-5xl space-y-10 px-6 md:px-12">
        {dimensions.map((d, idx) => (
          <motion.article
            key={d.key}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.8, delay: idx * 0.04, ease: [0.32, 0.72, 0, 1] }}
            className="glass-card overflow-hidden rounded-3xl p-8 md:p-12"
          >
            <div className="mb-8 flex flex-wrap items-baseline justify-between gap-4 border-b border-white/10 pb-6">
              <div>
                <p className="mb-2 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
                  {String(idx + 1).padStart(2, "0")} · {d.title[li]}
                </p>
                <h2 className="font-serif text-2xl italic text-stone-warm md:text-3xl">
                  {d.headline[li]}
                </h2>
              </div>
              <Stars n={d.stars} />
            </div>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
              {/* Left: evidence + viz */}
              <div className="lg:col-span-2">
                <p className="mb-4 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
                  {t.evidence_across}
                </p>
                <ul className="mb-8 space-y-3 text-sm">
                  {d.evidence.map((e) => (
                    <li key={e.tradition[0]} className="border-l border-gold-dust/30 pl-4">
                      <p className="font-serif text-gold-light">{e.tradition[li]}</p>
                      <p className="text-stone-warm/60">{e.note[li]}</p>
                    </li>
                  ))}
                </ul>

                <p className="mb-3 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
                  {t.strength_map}
                </p>
                <div className="text-stone-warm/50">
                  {d.viz === "elements" && d.elementStrengths ? (
                    <FiveElements strengths={d.elementStrengths} lang={lang} size={240} />
                  ) : (
                    <StrengthRadar
                      values={d.strengths}
                      labels={t.four_traditions}
                      size={220}
                    />
                  )}
                </div>
              </div>

              {/* Right: synthesis + plain-language */}
              <div className="lg:col-span-3">
                <p className="mb-4 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
                  {t.synthesis}
                </p>
                <p className="mb-8 text-base leading-relaxed text-stone-warm/80">
                  {d.synthesis[li]}
                </p>

                <div className="rounded-2xl border border-gold-dust/20 bg-gold-dust/[0.04] p-6">
                  <p className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.32em] text-gold-light">
                    <span className="size-1.5 rounded-full bg-gold-dust" />
                    {t.in_plain_words}
                  </p>
                  <p className="font-serif text-lg italic leading-relaxed text-stone-warm/90">
                    {d.plain[li]}
                  </p>
                </div>
              </div>
            </div>
          </motion.article>
        ))}
      </section>

      {/* Life Timeline — 大运 */}
      <div className="mt-24">
        <LifeTimeline birthISO={search.date} />
      </div>

      {/* Key life events verification */}
      <KeyEventsVerification />

      {/* Membership / PDF / AI follow-up */}
      <MembershipSection />

      {/* Outro */}
      <div className="mx-auto mt-16 max-w-3xl px-6 text-center print:hidden">

        <p className="mb-6 text-[10px] uppercase tracking-[0.42em] text-gold-dust">
          {t.note_on_fate}
        </p>
        <p className="mb-12 font-serif text-2xl italic leading-relaxed text-stone-warm/70">
          {t.note_body_1}{" "}
          <span className="text-gold-light">{t.note_body_2}</span>
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            to="/ritual"
            className="rounded-full border border-gold-dust/40 px-8 py-3 text-[10px] uppercase tracking-[0.32em] text-gold-dust transition-colors hover:bg-gold-dust/10"
          >
            {t.read_another}
          </Link>
          <Link
            to="/traditions"
            className="rounded-full border border-white/10 px-8 py-3 text-[10px] uppercase tracking-[0.32em] text-stone-warm/60 transition-colors hover:border-gold-dust/40 hover:text-gold-dust"
          >
            {t.return_archive}
          </Link>
        </div>
      </div>
    </div>
  );
}
