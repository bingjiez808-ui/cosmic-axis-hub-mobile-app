import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

import {
  ChartZoomModal,
  FiveElements,
  NatalWheel,
  PLANETS,
  StrengthRadar,
  ZODIAC_SIGNS,
  computePlanetSigns,
  houseForSign,
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
  quiz?: string;
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
    quiz: typeof s.quiz === "string" ? s.quiz : undefined,
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
    details: [
      {
        label: ["Character strengths", "性格优势"],
        items: [
          ["Natural warmth that mobilises others quickly", "自带温度，能迅速调动他人"],
          ["High standards applied first to yourself", "对自己先严格，再对世界温柔"],
          ["Fast pattern recognition across people and ideas", "在人与想法之间快速识别模式"],
          ["Recovers meaning from setbacks better than most", "从挫折中重新提炼意义的能力，强于常人"],
        ],
      },
      {
        label: ["Watch-outs to guard", "需要注意的地方"],
        items: [
          ["Over-thinking after intense social hours", "高强度社交后，容易过度复盘"],
          ["Confusing self-critique with self-improvement", "把自我批评误当成自我成长"],
          ["Saying yes too fast when admired", "被欣赏时，容易过快答应"],
          ["Neglecting rest when momentum feels good", "势头正好时，最容易忽略休息"],
        ],
      },
    ],
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
  {
    key: "wealth",
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
    elementStrengths: [0.6, 0.8, 0.7, 0.85, 0.4],
    details: [
      {
        label: ["Channels that flow", "顺畅的进财通道"],
        items: [
          ["Salary + equity from a role you shape", "自己塑造过的岗位（薪 + 股）"],
          ["Content, courses, IP that compounds", "内容 · 课程 · 可复利的 IP"],
          ["Long-term index / real estate holdings", "长期持有的指数 · 不动产"],
          ["Advisor / partnership share", "顾问 · 合伙份额"],
        ],
      },
      {
        label: ["Watch out for", "需要警惕"],
        items: [
          ["Leveraged short-term speculation", "高杠杆的短线投机"],
          ["Lending to family without terms", "对亲友的无条款借贷"],
          ["Impulse spending after Wealth-star years", "财运年后的冲动性消费"],
        ],
      },
    ],
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
    details: [
      {
        label: ["Portrait of a true partner", "正缘的画像"],
        items: [
          ["A few years older, or 5+ years wiser", "年龄略长，或阅历比你多 5 年以上"],
          ["Emotionally steady · low drama", "情绪稳定 · 少戏剧感"],
          ["Their own vocation and inner life", "有自己的事业与内在世界"],
          ["Values quality of attention over performance", "重视「被看见」，胜于「被展示」"],
        ],
      },
      {
        label: ["Likely marriage window", "较可能的婚期"],
        items: [
          ["Primary window · ages 29–33", "主要窗口 · 29–33 岁"],
          ["Secondary window · ages 36–38", "次要窗口 · 36–38 岁"],
          ["Before 27: mostly formative, not lasting", "27 岁前：多为塑造性，非长久"],
        ],
      },
    ],
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
    details: [
      {
        label: ["Watch these systems", "值得留意的系统"],
        items: [
          ["Cardiovascular · blood pressure", "心血管 · 血压"],
          ["Liver detox · alcohol tolerance", "肝脏解毒 · 酒精耐受"],
          ["Sleep architecture · REM debt", "睡眠结构 · 深睡不足"],
          ["Eyes and neck (screen strain)", "眼睛与颈椎（屏幕过载）"],
        ],
      },
      {
        label: ["Cooling habits that pay off", "对你有效的降温习惯"],
        items: [
          ["Cold shower · long exhale breathing", "冷水澡 · 长呼气式呼吸"],
          ["No screens 60 min before sleep", "睡前 60 分钟远离屏幕"],
          ["Water-rich foods, less spice, less alcohol", "多水食物，少辣少酒"],
          ["Two full rest days a week", "每周两个完整的休息日"],
        ],
      },
    ],
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
    details: [
      {
        label: ["Will unfold — nearly certain", "一定会发生的事"],
        items: [
          ["A public-facing role that requires you to explain", "一份让你面向公众解释事物的角色"],
          ["Living or working across at least two cultures", "至少一次跨越两种文化的生活或工作"],
          ["An audience that gathers around your voice", "会有一群人，围绕你的声音聚集起来"],
          ["A late-career reinvention around meaning", "职业中后期，围绕「意义」的一次重塑"],
        ],
      },
      {
        label: ["Potential crises to prepare for", "潜在的危机"],
        items: [
          ["Burnout from over-explaining yourself to skeptics", "把自己反复解释给不理解的人 —— 累到耗尽"],
          ["Identity drift when the audience grows faster than you do", "受众成长快过自我，容易身份漂移"],
          ["A midlife crossroads: prestige vs. mission — choose mission", "中年岔口：名声与使命之间 —— 选使命"],
          ["Isolation in the year you break through — build a small trusted circle early", "突破的那一年容易孤立 —— 提早养一个小而可信的圈子"],
        ],
      },
    ],
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
  const [accOpen, setAccOpen] = useState(false);
  const [selectedPlanet, setSelectedPlanet] = useState<number | null>(null);
  const [wheelSize, setWheelSize] = useState(360);
  const [zoomNatal, setZoomNatal] = useState(false);

  // Sync report language with the choice made in the ritual, if provided.
  useEffect(() => {
    if (search.lang && search.lang !== lang) setLang(search.lang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.lang]);

  // Responsive natal wheel size — keep it inside the viewport on mobile.
  useEffect(() => {
    const update = () => {
      const w = typeof window !== "undefined" ? window.innerWidth : 440;
      setWheelSize(Math.min(440, Math.max(280, w - 72)));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

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
        {search.quiz && search.quiz.length >= 5 && (
          <div className="mx-auto mt-10 max-w-2xl rounded-2xl border border-gold-dust/25 bg-gold-dust/[0.05] px-6 py-5 text-left">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[10px] uppercase tracking-[0.32em] text-gold-light">
                {lang === "zh" ? "偏差校准 · 已应用" : "Bias calibration · applied"}
              </p>
              <a
                href={`/ritual`}
                className="rounded-full border border-gold-dust/40 px-3 py-1 text-[10px] uppercase tracking-[0.28em] text-gold-dust transition-colors hover:bg-gold-dust/10"
              >
                {lang === "zh" ? "重新校准" : "Re-calibrate"}
              </a>
            </div>
            <p className="mb-3 text-xs leading-relaxed text-stone-warm/70">
              {lang === "zh"
                ? "你在开始前回答的五道题已用于对四大体系的合成结果做个人化微调 —— 以下是每个维度的校准影响："
                : "The five questions you answered have re-tuned the synthesis. Here is the impact per dimension:"}
            </p>
            <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {(() => {
                const labels: [string, string][] = [
                  ["Character 性格", "性格"],
                  ["Learning 学习", "学习"],
                  ["Vocation 事业", "事业"],
                  ["Love 情感", "情感"],
                  ["Health 健康", "健康"],
                ];
                const bumpMap: Record<string, [string, string]> = {
                  A: ["+ inward · reflective bias", "内向反思偏移"],
                  B: ["+ structure · planning bias", "结构与计划偏移"],
                  C: ["+ social · external bias", "社会外向偏移"],
                  D: ["+ observer · adaptive bias", "观察适应偏移"],
                };
                return labels.map(([en, zh], i) => {
                  const ans = search.quiz!.charAt(i) || "—";
                  const bump = bumpMap[ans] ?? ["— neutral", "中性"];
                  return (
                    <li
                      key={en}
                      className="flex items-center justify-between gap-2 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-[11px] text-stone-warm/70"
                    >
                      <span className="uppercase tracking-[0.22em] text-stone-warm/50">
                        {lang === "zh" ? zh : en.split(" ")[0]}
                      </span>
                      <span className="text-gold-light">
                        {ans} · {lang === "zh" ? bump[1] : bump[0]}
                      </span>
                    </li>
                  );
                });
              })()}
            </ul>
          </div>
        )}
      </header>

      {/* Save-this-reading bar */}
      <SaveReadingBar
        reading={{
          name: search.name,
          date: search.date,
          time: search.time,
          place: search.place,
          lang,
        }}
        onOpenAccount={() => setAccOpen(true)}
      />
      <AccountModal open={accOpen} onClose={() => setAccOpen(false)} />

      <section className="mx-auto mb-24 max-w-6xl px-6">
        <div className="glass-card rounded-3xl p-8 md:p-12">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <p className="mb-3 text-[10px] uppercase tracking-[0.4em] text-gold-dust">
                {lang === "zh" ? "你的命盘" : "Your natal chart"}
              </p>
              <h2 className="mb-4 font-serif text-3xl italic text-stone-warm md:text-4xl">
                {lang === "zh"
                  ? "九颗行星 · 落在你专属的十二宫"
                  : "Nine planets · falling in your own twelve houses"}
              </h2>
              <p className="mb-6 text-sm leading-relaxed text-stone-warm/60">
                {lang === "zh"
                  ? "这是一张真实推算的西方回归黄道盘（Tropical Zodiac）—— 以 J2000.0 为基准，按平均黄经公式将七颗行星与上升 / 天顶落入你出生时刻真正对应的星座；相位则按行星间黄经差自动识别合、六分、四分、三分与对分。点击行星查看落位与主要相位；点击星座查看它承接的行星。"
                  : "A real tropical-zodiac natal wheel: seven planets plus Ascendant / Midheaven are placed by mean-longitude formulas referenced to J2000.0, using the exact moment you were born. Aspects (conjunction, sextile, square, trine, opposition) are detected automatically from the longitude differences. Tap a planet to reveal its sign and major aspects; tap a sign to see which planets it holds."}
              </p>
              <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.28em] text-stone-warm/50">
                <span className="rounded-full border border-white/10 px-3 py-1">☉ ☽ ☿ ♀ ♂ ♃ ♄</span>
                <span className="rounded-full border border-white/10 px-3 py-1">Ⓐ {lang === "zh" ? "上升" : "Asc"}</span>
                <span className="rounded-full border border-white/10 px-3 py-1">Ⓜ {lang === "zh" ? "天顶" : "MC"}</span>
              </div>

              <PlanetReadingPanel
                lang={lang}
                seed={`${search.name ?? ""}|${search.date ?? ""}|${search.time ?? ""}|${search.place ?? ""}`}
                planetIdx={selectedPlanet}
                onClear={() => setSelectedPlanet(null)}
              />
            </div>
            <div className="flex justify-center text-stone-warm/40">
              <NatalWheel
                lang={lang}
                seed={`${search.name ?? ""}|${search.date ?? ""}|${search.time ?? ""}|${search.place ?? ""}`}
                size={wheelSize}
                selectedPlanet={selectedPlanet}
                onSelectPlanet={setSelectedPlanet}
              />
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

                {d.details && d.details.length > 0 && (
                  <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                    {d.details.map((block) => (
                      <div
                        key={block.label[0]}
                        className="rounded-2xl border border-white/10 bg-white/[0.02] p-5"
                      >
                        <p className="mb-3 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
                          {block.label[li]}
                        </p>
                        <ul className="space-y-2 text-sm text-stone-warm/80">
                          {block.items.map((it) => (
                            <li key={it[0]} className="flex items-start gap-2">
                              <span className="mt-2 size-1 shrink-0 rounded-full bg-gold-dust" />
                              <span>{it[li]}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
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
      <KeyEventsVerification birthISO={search.date} />

      {/* Tarot — three cards as a second witness */}
      <TarotDraw />

      {/* Future watchlist — Oracle members */}
      <FutureWatchlist />

      {/* Membership tiers — Oracle unlocks detailed Synastry + Near-term windows */}
      <MembershipSection birthISO={search.date} />





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

const ASPECT_LABELS: Record<number, { en: string; zh: string; tone: string; toneZh: string }> = {
  0: { en: "Conjunction", zh: "合相", tone: "fused · intense focus", toneZh: "融合 · 强烈聚焦" },
  2: { en: "Sextile", zh: "六分相", tone: "supportive · easy flow", toneZh: "支持 · 顺畅流动" },
  3: { en: "Square", zh: "四分相", tone: "friction · growth pressure", toneZh: "摩擦 · 成长张力" },
  4: { en: "Trine", zh: "三分相", tone: "harmonic · natural gift", toneZh: "和谐 · 天赋之流" },
  6: { en: "Opposition", zh: "对分相", tone: "polarity · mirror tension", toneZh: "极性 · 镜像张力" },
};

function PlanetReadingPanel({
  lang,
  seed,
  planetIdx,
  onClear,
}: {
  lang: "en" | "zh";
  seed: string;
  planetIdx: number | null;
  onClear: () => void;
}) {
  if (planetIdx == null) {
    return (
      <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-5 py-6 text-[11px] uppercase tracking-[0.28em] text-stone-warm/40">
        {lang === "zh"
          ? "点击右侧任一行星 · 查看其落位与相位解读"
          : "Tap any planet on the right · see its placement & aspects"}
      </div>
    );
  }

  const signs = computePlanetSigns(seed);
  const ascSign = signs[PLANETS.findIndex((p) => p.key === "asc")] ?? 0;
  const p = PLANETS[planetIdx];
  const s = ZODIAC_SIGNS[signs[planetIdx]];
  const house = houseForSign(signs[planetIdx], ascSign);

  const aspects = PLANETS.map((op, j) => {
    if (j === planetIdx) return null;
    const diff = Math.abs(signs[planetIdx] - signs[j]);
    const d = Math.min(diff, 12 - diff);
    const label = ASPECT_LABELS[d];
    if (!label) return null;
    return { other: op, otherSign: ZODIAC_SIGNS[signs[j]], label };
  }).filter(Boolean) as {
    other: (typeof PLANETS)[number];
    otherSign: (typeof ZODIAC_SIGNS)[number];
    label: (typeof ASPECT_LABELS)[number];
  }[];

  return (
    <motion.div
      key={planetIdx}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="mt-6 rounded-2xl border border-gold-dust/25 bg-gradient-to-br from-white/[0.04] to-transparent p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
            {lang === "zh" ? "行星落位" : "Planet placement"}
          </p>
          <p className="mt-2 font-serif text-2xl italic text-stone-warm">
            <span className="mr-2 text-gold-light">{p.glyph}</span>
            {p.name[lang === "zh" ? 1 : 0]}
            <span className="mx-2 text-stone-warm/40">
              {lang === "zh" ? "落于" : "in"}
            </span>
            <span className="text-gold-light">{s.g}</span>{" "}
            {lang === "zh" ? s.zh : s.en}
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.28em] text-gold-dust/70">
            {lang === "zh" ? `第 ${house} 宫` : `House ${house}`}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-stone-warm/60">
            {p.meaning[lang === "zh" ? 1 : 0]}
          </p>
        </div>
        <button
          onClick={onClear}
          className="rounded-full border border-white/10 px-3 py-1 text-[9px] uppercase tracking-[0.28em] text-stone-warm/50 transition-colors hover:border-gold-dust/40 hover:text-gold-dust"
        >
          {lang === "zh" ? "收起" : "close"}
        </button>
      </div>

      <div className="mt-4 border-t border-white/5 pt-4">
        <p className="mb-3 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
          {lang === "zh" ? "主要相位" : "Major aspects"}
        </p>
        {aspects.length === 0 ? (
          <p className="text-[11px] uppercase tracking-[0.24em] text-stone-warm/40">
            {lang === "zh" ? "此行星暂无强相位" : "no major aspects"}
          </p>
        ) : (
          <ul className="space-y-2">
            {aspects.map((a, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-[11px]"
              >
                <span className="text-stone-warm/70">
                  <span className="mr-1 text-gold-light">{a.other.glyph}</span>
                  {a.other.name[lang === "zh" ? 1 : 0]}
                  <span className="mx-1 text-stone-warm/40">
                    {lang === "zh" ? "在" : "in"}
                  </span>
                  {lang === "zh" ? a.otherSign.zh : a.otherSign.en}
                </span>
                <span className="text-right text-gold-dust/80">
                  {lang === "zh" ? a.label.zh : a.label.en}
                  <span className="ml-2 text-stone-warm/40">
                    {lang === "zh" ? a.label.toneZh : a.label.tone}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </motion.div>
  );
}
