/**
 * concern-guidance-v1 — deterministic data layer for the "带着我的问题
 * 开始阅读" homepage flow. 0 AI tokens; every string is a literal.
 *
 * Users select one of seven concerns on the landing page. That choice
 * decides which sample the response page renders, which library book
 * glows first, and which real report section the CTA points at when
 * the user reaches the paid reader. It does NOT alter any chart fact,
 * score, or premium computation.
 */

export const CONCERN_KEYS = [
  "study",
  "career",
  "love",
  "relationships",
  "finance",
  "self_family",
  "overview",
] as const;
export type ConcernKey = (typeof CONCERN_KEYS)[number];

export function isConcernKey(v: unknown): v is ConcernKey {
  return typeof v === "string" && (CONCERN_KEYS as readonly string[]).includes(v);
}

/**
 * Whitelisted section anchors on the paid report. Every value here
 * must correspond to a real chapter key in
 * `src/lib/premium-chapters-v3.ts`. If a concern's target section is
 * removed from the manifest, `resolveConcernRoute` falls back safely.
 */
export const REPORT_SECTION_WHITELIST = [
  "chart_map",
  "academic",
  "vocation",
  "wealth",
  "relationships",
  "family",
  "health",
  "mission",
  "year_and_windows",
  "character",
] as const;
export type ReportSection = (typeof REPORT_SECTION_WHITELIST)[number];

export function isReportSection(v: unknown): v is ReportSection {
  return typeof v === "string" && (REPORT_SECTION_WHITELIST as readonly string[]).includes(v);
}

type Bi = { zh: string; en: string };
type BiList = { zh: string[]; en: string[] };

export type ConcernRecord = {
  key: ConcernKey;
  /** Short chip label for the picker */
  chip: Bi;
  /** Full first-person question */
  question: Bi;
  /** 2–3 sentence attuned response — no diagnosis, no doom */
  situationalResponse: Bi;
  /** 4–5 concrete features the library will read for this concern */
  featureBullets: BiList;
  /** A short, realistic-format sample paragraph (not AI) */
  sampleOutput: Bi;
  /** Primary CTA label */
  ctaLabel: Bi;
  /** "Next step will …" microcopy under the CTA */
  nextStepHint: Bi;
  /** Which real report chapter to jump to when they own a report */
  targetSection: ReportSection;
  /** Which library shelf book should glow first */
  featuredShelfBook: ShelfBookKey;
};

export const SHELF_BOOK_KEYS = [
  "self_knowledge",
  "study_growth",
  "career_path",
  "love_bonds",
  "wealth_path",
  "life_timeline",
] as const;
export type ShelfBookKey = (typeof SHELF_BOOK_KEYS)[number];

// ─────────────── Content ───────────────

export const CONCERNS: Record<ConcernKey, ConcernRecord> = {
  study: {
    key: "study",
    chip: { zh: "学业与成长", en: "Study & growth" },
    question: {
      zh: "我适合怎样学习？我的优势到底在哪里？",
      en: "How am I built to learn? Where does my real strength sit?",
    },
    situationalResponse: {
      zh:
        "一次成绩只能说明你在一种规则下的表现，不能概括你的理解力、好奇心和未来。这里会帮助你分清：是不够努力、学习方式不合，还是一直在用别人的标准否定自己的长处。",
      en:
        "A single grade only shows how you performed under one set of rules — it does not sum up your comprehension, your curiosity, or your future. This place helps you tell three things apart: not enough effort, a learning style that doesn't fit, and a long habit of measuring yourself by someone else's yardstick.",
    },
    featureBullets: {
      zh: [
        "综合解读·学业：擅长的学科族群与学习方式",
        "适合独立深研 · 讨论型 · 项目型 · 应用型之间的偏向",
        "阶段性建议：现在更该积累、调整、还是转向",
        "今日学业信号，观察短期节奏",
        "高级 AI 报告 · 第 3 章「学业与认知」",
      ],
      en: [
        "Panorama · Study: subject clusters that fit you",
        "How you learn best — solo depth, dialogue, projects, or applied practice",
        "Phase advice: now is time to accumulate, adjust, or pivot",
        "Today's study signal, for short-term rhythm",
        "Premium report · Chapter 3 «Academic & Cognition»",
      ],
    },
    sampleOutput: {
      zh:
        "偏向理科族群中的结构与工程类；比起大班讲授，你更容易在小组共研与实做中打通。近期不必急着换方向，先补齐一项支撑性技能，再看是否加速。",
      en:
        "Leans toward structure- and engineering-oriented clusters within STEM. Small-group co-study and hands-on work unblock you more than lecture halls. No need to switch tracks right now — pick one supporting skill to shore up first, then reassess speed.",
    },
    ctaLabel: { zh: "带着这个问题，开始阅读我的命盘", en: "Read my chart with this question in mind" },
    nextStepHint: {
      zh: "下一步将登记出生资料，生成后优先打开【学业与认知】。",
      en: "Next you'll register your birth details; the reader will open «Academic & Cognition» first.",
    },
    targetSection: "academic",
    featuredShelfBook: "study_growth",
  },

  career: {
    key: "career",
    chip: { zh: "事业与选择", en: "Career & choices" },
    question: {
      zh: "我正在走的路适合我吗？什么时候应该继续或转向？",
      en: "Is the path I'm on the right one? When should I stay, and when should I turn?",
    },
    situationalResponse: {
      zh:
        "你可能并不是没有能力，只是长期站在一个无法回馈你优势的位置上。有些疲惫来自努力不够，有些疲惫却来自方向与自己不合。这里不会仓促劝你辞职或坚持，而会帮助你辨认：动力从哪里来、适合怎样的工作结构，以及现在更应该积累、调整还是转向。",
      en:
        "It may not be that you lack ability — you may simply have stood, for a long time, in a place that does not give your strengths back to you. Some exhaustion comes from not trying hard enough; other exhaustion comes from a direction that does not fit. This place will not rush to tell you to quit or hold on. It will help you name where your drive comes from, what kind of work structure suits you, and whether now is really the time to accumulate, adjust, or turn.",
    },
    featureBullets: {
      zh: [
        "综合解读·事业：工作结构与行业方向",
        "你的优势属于稳态深耕、变化调度、还是拓荒创造",
        "转折时机：接下来 12 个月适合准备、发动，还是收敛",
        "人生时间轴 · 大运能量趋势线",
        "高级 AI 报告 · 第 17 章「事业方向与天赋」",
      ],
      en: [
        "Panorama · Career: work structure and direction",
        "Whether your edge is steady deep work, orchestrating change, or breaking new ground",
        "Turning points: whether the next 12 months lean toward preparing, launching, or consolidating",
        "Life timeline · long-arc energy trend",
        "Premium report · Chapter 17 «Vocation & Talents»",
      ],
    },
    sampleOutput: {
      zh:
        "你的驱动更接近「稳态深耕 + 每 3–4 年一次结构升级」。近 12 个月更适合在原体系里换赛道、扩边界，而不是彻底跳出。若已在准备一个跳跃，先把一件收尾的事做到位。",
      en:
        "Your drive fits steady deep work with a structural level-up every 3–4 years. In the next 12 months, changing lane within the same system beats jumping out. If a leap is already in motion, finish one closing thing well first.",
    },
    ctaLabel: { zh: "带着这个问题，开始阅读我的命盘", en: "Read my chart with this question in mind" },
    nextStepHint: {
      zh: "下一步将登记出生资料，生成后优先打开【事业方向与天赋】。",
      en: "Next you'll register your birth details; the reader will open «Vocation & Talents» first.",
    },
    targetSection: "vocation",
    featuredShelfBook: "career_path",
  },

  love: {
    key: "love",
    chip: { zh: "爱情与亲密关系", en: "Love & intimacy" },
    question: {
      zh: "为什么我总被某一类人吸引？我真正需要怎样的关系？",
      en: "Why do I keep being drawn to the same kind of person? What kind of relationship do I actually need?",
    },
    situationalResponse: {
      zh:
        "你也许不是不知道该不该爱，而是已经很久分不清：舍不得的是这个人，还是那个曾经相信一切会变好的自己。这里不会替你决定留下或离开，而会陪你看清反复寻找什么、害怕失去什么，以及怎样的关系让你不必缩小自己。",
      en:
        "It may not be that you don't know whether to love — it's that for a long time you've had trouble telling apart what you can't let go of: this person, or the self who once believed everything could still get better. This place will not decide for you whether to stay or leave. It will sit with you while you see what you keep looking for, what you fear losing, and what kind of relationship lets you stop shrinking.",
    },
    featureBullets: {
      zh: [
        "综合解读·爱情：关系需求与吸引模式",
        "边界与安全感的搭建方式",
        "适配窗口：接下来更适合稳固已有，还是探索新的连接",
        "关系适配：与朋友命盘的匹配读法",
        "高级 AI 报告 · 第 19 章「情感与关系」",
      ],
      en: [
        "Panorama · Love: relational needs and attraction patterns",
        "How you build boundaries and safety",
        "Compatibility windows: whether now favours stabilising or exploring",
        "Relationship match: reading with a friend's chart",
        "Premium report · Chapter 19 «Love & Relationships»",
      ],
    },
    sampleOutput: {
      zh:
        "你倾向被「表达清晰、情绪稳定、但内里有裂缝」的人吸引。真正让你安心的不是热烈，而是可预期。近段时间比起追求新的连接，更适合把一段旧关系的边界重新画一次。",
      en:
        "You tend to be drawn to people who are articulate and emotionally steady but carry a hidden fracture. What actually settles you is not intensity but predictability. In the near term, redrawing the boundary of an existing relationship serves you more than pursuing a new one.",
    },
    ctaLabel: { zh: "带着这个问题，开始阅读我的命盘", en: "Read my chart with this question in mind" },
    nextStepHint: {
      zh: "下一步将登记出生资料，生成后优先打开【情感与关系】。",
      en: "Next you'll register your birth details; the reader will open «Love & Relationships» first.",
    },
    targetSection: "relationships",
    featuredShelfBook: "love_bonds",
  },

  relationships: {
    key: "relationships",
    chip: { zh: "人际与边界", en: "People & boundaries" },
    question: {
      zh: "为什么与人相处总让我疲惫？哪些关系值得靠近？",
      en: "Why does being around people wear me out? Which relationships are worth stepping closer to?",
    },
    situationalResponse: {
      zh:
        "让你疲惫的，未必是人多，而是你太熟悉「先把别人的感受放在自己前面」。这里不劝你切断谁，而会帮你看清：哪些连接值得靠近、哪些消耗其实来自你自己一直不肯承认的规则。",
      en:
        "What wears you out may not be how many people are around, but a long-standing habit of putting others' feelings ahead of your own. This place won't tell you to cut anyone off. It will help you see which connections deserve nearness, and which drain comes from a rule you've quietly refused to admit you were following.",
    },
    featureBullets: {
      zh: [
        "综合解读·关系模式与边界",
        "对不同类型关系的能量成本读法",
        "好友适配：匿名共鸣星图",
        "历史回声：与你相近处境的人如何走过",
        "高级 AI 报告 · 第 19 章「情感与关系」",
      ],
      en: [
        "Panorama · relationship patterns and boundaries",
        "Energy cost read across different kinds of ties",
        "Friend match: anonymous resonance atlas",
        "Historical echoes: how others walked through similar terrain",
        "Premium report · Chapter 19 «Love & Relationships»",
      ],
    },
    sampleOutput: {
      zh:
        "你对「有明确议题的关系」更省电，对「情绪高强度但边界模糊」的关系更耗电。近段时间值得做的一件小事：在一次不舒服的对话里，少解释一句。",
      en:
        "You spend less energy in relationships with a clear agenda; you spend more in ones with high emotion and blurry limits. One small move worth trying soon: in one uncomfortable conversation, explain yourself one sentence less.",
    },
    ctaLabel: { zh: "带着这个问题，开始阅读我的命盘", en: "Read my chart with this question in mind" },
    nextStepHint: {
      zh: "下一步将登记出生资料，生成后优先打开【情感与关系】。",
      en: "Next you'll register your birth details; the reader will open «Love & Relationships» first.",
    },
    targetSection: "relationships",
    featuredShelfBook: "love_bonds",
  },

  finance: {
    key: "finance",
    chip: { zh: "财富与安全感", en: "Wealth & safety" },
    question: {
      zh: "我的财富主要依靠什么能力？为什么钱总是难以留下？",
      en: "Which of my abilities really pulls in money? Why does it never seem to stay?",
    },
    situationalResponse: {
      zh:
        "钱难以留下，往往不是因为你不会赚，而是因为你没看清「什么让你安心」。这里不承诺你会发财，而会陪你辨认：主要收入靠的是哪种能力、什么样的风险你其实承担不起、以及积累与消耗为什么反复拉锯。",
      en:
        "Money often fails to stay not because you can't earn it, but because you haven't seen clearly what actually makes you feel safe. This place will not promise wealth. It will sit with you while you name which ability is really pulling income in, which risks you cannot actually afford, and why accumulation and drain keep pulling each other back and forth.",
    },
    featureBullets: {
      zh: [
        "综合解读·财富格局与主要来源",
        "稳健收益 · 波动机会 · 资产沉淀 之间的偏向",
        "风险习惯的自我识别（非投资建议）",
        "人生时间轴 · 财富节奏窗口",
        "高级 AI 报告 · 第 18 章「财富格局」",
      ],
      en: [
        "Panorama · wealth structure and main sources",
        "Bias between steady returns, volatile upside, and asset accumulation",
        "Self-recognition of risk habits (not investment advice)",
        "Life timeline · wealth-rhythm windows",
        "Premium report · Chapter 18 «Wealth»",
      ],
    },
    sampleOutput: {
      zh:
        "主要收入更偏「专业能力 + 系统化产出」，短期投机对你并不友好。财富常被消耗在「为了不让别人失望而做出的支出」上。近期先记账两周，看看被动支出的形状。",
      en:
        "Your income leans on professional skill compounded by systemised output; short-term speculation is not friendly to you. Wealth often leaks through spending done to keep others from being disappointed. Track expenses for two weeks and read the shape of the passive spend.",
    },
    ctaLabel: { zh: "带着这个问题，开始阅读我的命盘", en: "Read my chart with this question in mind" },
    nextStepHint: {
      zh: "下一步将登记出生资料，生成后优先打开【财富格局】。",
      en: "Next you'll register your birth details; the reader will open «Wealth» first.",
    },
    targetSection: "wealth",
    featuredShelfBook: "wealth_path",
  },

  self_family: {
    key: "self_family",
    chip: { zh: "自我、家庭与人生阶段", en: "Self, family & chapter" },
    question: {
      zh: "为什么我总在相同的问题里反复？哪些期待并不属于我？",
      en: "Why do I keep circling the same problems? Which expectations were never mine to begin with?",
    },
    situationalResponse: {
      zh:
        "反复出现的问题，通常不是你还不够努力，而是有一些别人早年放在你身上的期待，你还没来得及分辨。这里不会替你切断亲情，而会帮你看清哪些是你自己的功课，哪些其实一直是别人交给你保管的。",
      en:
        "Recurring problems rarely mean you haven't tried hard enough. Usually there are expectations placed on you a long time ago that you have not yet had a chance to sort. This place will not tell you to cut off family. It will help you see which lessons are actually yours, and which ones were quietly handed to you to hold for someone else.",
    },
    featureBullets: {
      zh: [
        "综合解读·核心人格与身心节奏",
        "家庭课题与代际期待的读法",
        "人生页码：此刻你处于哪一章",
        "历史回声：与你同龄的人如何走过",
        "高级 AI 报告 · 第 16 章「性格底色」+ 第 20 章「家庭与家园」",
      ],
      en: [
        "Panorama · core personality and body-mind rhythm",
        "Family lessons and generational expectations",
        "Life chapter: which page you're on right now",
        "Historical echoes: how others of your age moved through this",
        "Premium report · Chapter 16 «Character» + Chapter 20 «Family & Home»",
      ],
    },
    sampleOutput: {
      zh:
        "你现在的循环，很可能源自「被赋予的责任」与「真正想要的形状」之间的错位。此刻更适合小幅调整而不是大动作：先给自己一件属于你自己的、无需向任何人交代的小事。",
      en:
        "Your current loop likely comes from a mismatch between duties handed to you and the shape you actually want. Now favours small adjustments over big moves: give yourself one small thing that belongs only to you and doesn't need to be explained to anyone.",
    },
    ctaLabel: { zh: "带着这个问题，开始阅读我的命盘", en: "Read my chart with this question in mind" },
    nextStepHint: {
      zh: "下一步将登记出生资料，生成后优先打开【性格底色】。",
      en: "Next you'll register your birth details; the reader will open «Character» first.",
    },
    targetSection: "character",
    featuredShelfBook: "self_knowledge",
  },

  overview: {
    key: "overview",
    chip: { zh: "我也说不清，只想先认识自己", en: "Not sure yet — I just want to meet myself" },
    question: {
      zh: "我也说不清，只想先认识自己。",
      en: "I can't put it into words yet — I just want to meet myself first.",
    },
    situationalResponse: {
      zh:
        "「说不清」本身也是一种诚实。真正认识自己，不需要先知道要问什么。这里会带你先看命盘的全景，让你从熟悉的模式里，找到自己真正想问的那一个问题。",
      en:
        "Not knowing what to ask is its own kind of honesty. Meeting yourself doesn't require a question first. This place starts with the full panorama of your chart, so the question you actually want to ask can find you.",
    },
    featureBullets: {
      zh: [
        "命盘全景导览：性格 / 事业 / 关系 / 财富 / 使命 一次读完",
        "六领域今日信号，理解短期节奏",
        "四大传统体系的交叉视角",
        "人生页码：现在你在哪一章",
        "高级 AI 报告 · 第 2 章「命盘全景导览」",
      ],
      en: [
        "Panorama tour: character, career, relationships, wealth, mission in one read",
        "Today's six-domain signals for near-term rhythm",
        "Cross-view across four traditions",
        "Life chapter: where you stand right now",
        "Premium report · Chapter 2 «Chart Map»",
      ],
    },
    sampleOutput: {
      zh:
        "你并不需要现在就有答案。先读一次全景，让自己看到哪一段被你忽略了，哪一段其实早就想面对——从那里再开始也不迟。",
      en:
        "You don't need an answer right now. Read the panorama once and notice which part you have been skipping over, and which part you already wanted to face — starting from there is not late.",
    },
    ctaLabel: { zh: "带着这个问题，开始阅读我的命盘", en: "Read my chart with this question in mind" },
    nextStepHint: {
      zh: "下一步将登记出生资料，生成后优先打开【命盘全景导览】。",
      en: "Next you'll register your birth details; the reader will open «Chart Map» first.",
    },
    targetSection: "chart_map",
    featuredShelfBook: "self_knowledge",
  },
};

// ─────────────── Route resolver ───────────────

export type ResolveArgs = {
  concern: ConcernKey;
  isSignedIn: boolean;
  hasPrimaryChart: boolean;
  existingReportId?: string | null;
};

/**
 * Build a same-origin destination URL for the concern CTA. Every branch
 * uses a real route that exists in this project; unresolved states fall
 * back to `/me/home` rather than a dead link.
 */
export function resolveConcernRoute(args: ResolveArgs): string {
  const { concern, isSignedIn, hasPrimaryChart, existingReportId } = args;
  const rec = CONCERNS[concern];
  const section: ReportSection = rec.targetSection;

  if (!isSignedIn) {
    const redirect = `/ritual?concern=${encodeURIComponent(concern)}`;
    return `/auth?mode=signup&redirect=${encodeURIComponent(redirect)}`;
  }
  if (!hasPrimaryChart) {
    return `/ritual?concern=${encodeURIComponent(concern)}`;
  }
  if (existingReportId) {
    return `/report?id=${encodeURIComponent(existingReportId)}&focus=${encodeURIComponent(
      section,
    )}`;
  }
  return `/me/home?concern=${encodeURIComponent(concern)}#curator-welcome`;
}

/**
 * Same-origin safety check for `redirect` / `returnTo` values coming
 * off the wire. Accepts only relative paths beginning with a single
 * "/" and rejects protocol-relative "//" values.
 */
export function isSafeReturnTo(v: unknown): v is string {
  return typeof v === "string" && v.startsWith("/") && !v.startsWith("//");
}

// ─────────────── DailyCuratorCounsel templates ───────────────
// Deterministic 3-layer counsel: response · today · one small move.
// Keyed by (concern, band). No AI, no randomness.

export type DailyBand = "supportive" | "neutral" | "mixed" | "caution";

type CounselTriple = {
  response: string;
  today: string;
  move: string;
};

const COUNSEL_TABLE_ZH: Record<ConcernKey, Record<DailyBand, CounselTriple>> = {
  study: {
    supportive: {
      response: "你上次说想弄清自己的学习方式；这不是软弱，而是难得的自觉。",
      today: "今天学习与专注的信号偏顺，适合完成一件卡了很久的小任务。",
      move: "现在可以试着：设一个 25 分钟的专注块，只处理最难开头的那一件。",
    },
    neutral: {
      response: "你上次说想认清自己的长处；先允许自己承认，比逼自己进步更有力量。",
      today: "今天信号平稳，是复盘胜过前进的一天。",
      move: "现在可以试着：写下最近一次学会一件事的过程——不是结果，是过程。",
    },
    mixed: {
      response: "你上次说想找到自己的节奏；节奏不是稳定，而是知道自己什么时候需要停。",
      today: "今天专注度起伏，别用「不够努力」惩罚自己。",
      move: "现在可以试着：把今天的目标砍掉一半，只做剩下的那一半。",
    },
    caution: {
      response: "你上次说想被理解；今天先让自己被自己理解。",
      today: "今天信号偏紧，硬推容易走弯路。",
      move: "现在可以试着：合上一件让你反复自我批评的事，去做一件五分钟能完成的事。",
    },
  },
  career: {
    supportive: {
      response: "你上次说想看清方向；方向不是选一次，而是允许自己修正。",
      today: "今天事业信号偏顺，适合做一次「不重要但一直搁着」的推进。",
      move: "现在可以试着：给一个搁置的对话发出第一句话。",
    },
    neutral: {
      response: "你上次说想知道该继续还是转向；先分清疲惫来自方向，还是来自当下这周。",
      today: "今天信号中性，观察比决策更值得。",
      move: "现在可以试着：写下这周最让你有能量的一小时，做了什么。",
    },
    mixed: {
      response: "你上次说想找到属于自己的路；矛盾出现时，那条路才开始清晰。",
      today: "今天事业与身心信号不太一致，别在这一天做大决定。",
      move: "现在可以试着：把最想说给某个人的判断先写下来，明天再决定要不要说。",
    },
    caution: {
      response: "你上次说想被真正看见；被看见首先要求你不再假装没事。",
      today: "今天信号偏紧，别把「坚持」当成唯一答案。",
      move: "现在可以试着：给自己一个可以不达标的下午。",
    },
  },
  love: {
    supportive: {
      response: "你上次说想看清自己在寻找什么；今天的关系信号愿意让你看得更远一点。",
      today: "今天情感信号偏温和，适合一次不带目的的靠近。",
      move: "现在可以试着：给一个久违的人发一条不要求回应的问候。",
    },
    neutral: {
      response: "你上次说想被稳定地对待；先允许自己不再解释。",
      today: "今天关系信号平稳，边界比表达更值得注意。",
      move: "现在可以试着：在一次对话里少解释一句，看看会不会更安心。",
    },
    mixed: {
      response: "你上次说想认清是舍不得这个人，还是那个自己；矛盾里往往藏着答案。",
      today: "今天信号起伏，不要在情绪高点做重大关系决定。",
      move: "现在可以试着：把想发出去的一段话先存在草稿里 24 小时。",
    },
    caution: {
      response: "你上次说想被理解；理解不必来自今天遇到的人。",
      today: "今天信号偏紧，主动靠近容易被误读。",
      move: "现在可以试着：把关心先转向自己一次。",
    },
  },
  relationships: {
    supportive: {
      response: "你上次说人多让你累；累的不是人多，而是你一直不肯把自己排在前面。",
      today: "今天关系信号偏顺，适合修复一段被搁置的连接。",
      move: "现在可以试着：向一个真诚的朋友说出一件你之前没敢说的小事。",
    },
    neutral: {
      response: "你上次说想分清值得靠近的人；答案通常不在他们说什么，而在他们让你成为谁。",
      today: "今天信号中性，观察多于表达。",
      move: "现在可以试着：列出让你近一周最放松的三个人。",
    },
    mixed: {
      response: "你上次说想画清边界；边界不是拒绝别人，而是承认自己的容量。",
      today: "今天关系信号不太稳，别用道歉换取平静。",
      move: "现在可以试着：在一次对话里，把「我可以」换成「让我看看」。",
    },
    caution: {
      response: "你上次说想被理解；今天先允许自己不去理解所有人。",
      today: "今天信号偏紧，退一步不是逃避，是保存。",
      move: "现在可以试着：暂缓一次让你为难的回应。",
    },
  },
  finance: {
    supportive: {
      response: "你上次说想弄清钱去哪了；这份好奇，本身就是财富的开始。",
      today: "今天财富信号偏顺，适合梳理而不是行动。",
      move: "现在可以试着：拉出最近一周的支出，只标出「为了别人不失望」的那几笔。",
    },
    neutral: {
      response: "你上次说想更安心；安心不来自更多存款，而来自看清风险的样子。",
      today: "今天信号中性，宜观察，不宜追高。",
      move: "现在可以试着：把最近一笔冲动购买延后 48 小时。",
    },
    mixed: {
      response: "你上次说想抓住机会；矛盾的信号里，抓不住其实比抓错要好。",
      today: "今天财富信号不一致，避免同一天做进出两个方向。",
      move: "现在可以试着：把要做的决定写成两句话，让明天的自己重读一次。",
    },
    caution: {
      response: "你上次说想稳一点；稳的第一步是承认自己现在承担不起某件事。",
      today: "今天信号偏紧，避免用未来的自己去承诺现在。",
      move: "现在可以试着：延后一件本来今天要签字的事。",
    },
  },
  self_family: {
    supportive: {
      response: "你上次说想认识自己；今天的自我信号愿意配合你更靠近一点。",
      today: "今天整体信号偏顺，适合回到自己而不是取悦谁。",
      move: "现在可以试着：给自己一件不需要向任何人报备的十分钟。",
    },
    neutral: {
      response: "你上次说反复陷在同一个问题里；重复出现的问题，通常在等你换一个提问。",
      today: "今天信号平稳，是安静的一天。",
      move: "现在可以试着：把最近困扰你的问题换一种问法写下来。",
    },
    mixed: {
      response: "你上次说想分清哪些期待是自己的；矛盾出现时，才有辨认的机会。",
      today: "今天身心与关系信号不一致，别急着做长远决定。",
      move: "现在可以试着：写下三件「其实不是我要的」小事。",
    },
    caution: {
      response: "你上次说累；累不一定要靠意志克服，也可以是身体在提醒你减少一件事。",
      today: "今天信号偏紧，减法胜过加法。",
      move: "现在可以试着：从今天日程里划掉一件对你并不重要的事。",
    },
  },
  overview: {
    supportive: {
      response: "你上次说想先认识自己；今天的整体信号愿意让你走近一点。",
      today: "今天整体信号偏顺，适合安静而完整地读一次自己。",
      move: "现在可以试着：花十分钟只写一段——今天你最真实的感受是什么。",
    },
    neutral: {
      response: "你上次说说不清；说不清是一种诚实，比匆忙给答案更值得。",
      today: "今天信号平稳，观察多于行动。",
      move: "现在可以试着：不做判断地记录今天让你停下来的三个瞬间。",
    },
    mixed: {
      response: "你上次说想看清全貌；矛盾出现时，全貌才真正开始显形。",
      today: "今天各领域信号不一致，允许自己此刻不合并结论。",
      move: "现在可以试着：把今天让你矛盾的两个想法都写下来，一个都不删。",
    },
    caution: {
      response: "你上次说想更接近自己；接近自己有时意味着先允许自己暂时远离所有人。",
      today: "今天信号偏紧，别在这一天要求自己厘清一切。",
      move: "现在可以试着：让自己有一小时不回应任何消息。",
    },
  },
};

const COUNSEL_TABLE_EN: Record<ConcernKey, Record<DailyBand, CounselTriple>> = {
  study: {
    supportive: {
      response: "You said you wanted to see how you actually learn; noticing that is not weakness — it's a rare kind of awareness.",
      today: "Today's study and focus signals lean supportive; good for closing one small task that's been stuck.",
      move: "Try now: set a 25-minute focus block and only touch the piece that's hardest to start.",
    },
    neutral: {
      response: "You said you wanted to name your strengths; admitting them can hold more power than forcing progress.",
      today: "Signals are steady today — a day for review, not push.",
      move: "Try now: write down the last thing you truly learned — the process, not the result.",
    },
    mixed: {
      response: "You said you wanted your own rhythm; rhythm is not being steady, it's knowing when to stop.",
      today: "Focus rises and dips today; don't punish yourself with 'not trying hard enough'.",
      move: "Try now: cut today's goal in half and only do the remaining half.",
    },
    caution: {
      response: "You said you wanted to be understood; today, let yourself be understood by yourself first.",
      today: "Signals feel tight today; pushing hard tends to detour.",
      move: "Try now: close the thing you keep self-criticising, and go do something you can finish in five minutes.",
    },
  },
  career: {
    supportive: {
      response: "You said you wanted to see the direction; direction is not a one-shot choice, it's giving yourself room to correct.",
      today: "Career signals lean supportive today; move one 'not urgent but long-pending' thing forward.",
      move: "Try now: send the first sentence of a conversation you've been sitting on.",
    },
    neutral: {
      response: "You said you wanted to know whether to stay or turn; first sort whether the fatigue is from the direction or just this week.",
      today: "Signals are neutral today; observing beats deciding.",
      move: "Try now: write down which single hour this week gave you the most energy — and what you did.",
    },
    mixed: {
      response: "You said you wanted your own path; the path starts to clarify exactly when contradictions appear.",
      today: "Career and body-mind signals don't line up today; not a day for big decisions.",
      move: "Try now: write down the verdict you most want to give someone, and decide tomorrow whether to send it.",
    },
    caution: {
      response: "You said you wanted to be truly seen; being seen begins with no longer pretending everything is fine.",
      today: "Signals feel tight today; don't make 'push through' your only answer.",
      move: "Try now: give yourself one afternoon where you're allowed to fall short.",
    },
  },
  love: {
    supportive: {
      response: "You said you wanted to see what you were looking for; today's relational signal is willing to let you see a little further.",
      today: "Emotional signals are gentle today; suited for one small, purposeless act of closeness.",
      move: "Try now: send a long-lost person a message that asks for no reply.",
    },
    neutral: {
      response: "You said you wanted to be steadily held; permit yourself, first, to stop explaining.",
      today: "Signals are calm today; boundaries deserve more attention than expression.",
      move: "Try now: in one conversation, explain yourself one sentence less.",
    },
    mixed: {
      response: "You said you wanted to know whether you couldn't let go of the person or that former self; the answer often hides inside the contradiction.",
      today: "Signals rise and fall today; don't make a major relationship decision at a peak.",
      move: "Try now: park the message you want to send in drafts for 24 hours.",
    },
    caution: {
      response: "You said you wanted to be understood; that doesn't have to come from whoever crosses your path today.",
      today: "Signals feel tight today; initiating closeness is easy to misread.",
      move: "Try now: turn the care back on yourself, once.",
    },
  },
  relationships: {
    supportive: {
      response: "You said crowds tire you; it isn't the number of people, it's the habit of never putting yourself first.",
      today: "Relational signals lean supportive today; a good day to repair a set-aside connection.",
      move: "Try now: say to a genuine friend one small thing you'd been holding back.",
    },
    neutral: {
      response: "You said you wanted to know who deserves nearness; the answer is rarely in what they say — it's in who you become around them.",
      today: "Signals are neutral today; observe more than express.",
      move: "Try now: list the three people who left you most relaxed this past week.",
    },
    mixed: {
      response: "You said you wanted clearer boundaries; a boundary isn't rejection, it's admitting your capacity.",
      today: "Relational signals are unsteady today; don't trade apologies for peace.",
      move: "Try now: in one conversation, swap 'I can' for 'let me see'.",
    },
    caution: {
      response: "You said you wanted to be understood; today, permit yourself not to understand everyone.",
      today: "Signals feel tight today; a step back is preservation, not avoidance.",
      move: "Try now: postpone one reply that puts you in a bind.",
    },
  },
  finance: {
    supportive: {
      response: "You said you wanted to know where money goes; that curiosity itself is the start of wealth.",
      today: "Wealth signals lean supportive today; good for reviewing, not acting.",
      move: "Try now: pull last week's spend and mark only the lines paid so someone else wouldn't be disappointed.",
    },
    neutral: {
      response: "You said you wanted more ease; ease comes from seeing risk clearly, not from more savings.",
      today: "Signals are neutral today; observe, don't chase.",
      move: "Try now: delay a recent impulse purchase by 48 hours.",
    },
    mixed: {
      response: "You said you wanted to seize an opportunity; when signals contradict, missing beats mis-seizing.",
      today: "Wealth signals are inconsistent today; avoid entering and exiting the same day.",
      move: "Try now: write the decision as two sentences, let tomorrow's you reread it.",
    },
    caution: {
      response: "You said you wanted more stability; the first step is admitting there is something you cannot afford right now.",
      today: "Signals feel tight today; don't spend the future self to promise the present.",
      move: "Try now: postpone one thing you were going to sign today.",
    },
  },
  self_family: {
    supportive: {
      response: "You said you wanted to meet yourself; today's self-signal is willing to let you step a little closer.",
      today: "Overall signals lean supportive today; a day to return to yourself, not to please anyone.",
      move: "Try now: give yourself ten minutes that need to be reported to no one.",
    },
    neutral: {
      response: "You said you keep circling the same problem; a repeating problem usually waits for a different question.",
      today: "Signals are calm today; a quiet day.",
      move: "Try now: rewrite the recurring problem as a different question.",
    },
    mixed: {
      response: "You said you wanted to sort which expectations were yours; contradictions are what let you tell them apart.",
      today: "Body-mind and relational signals don't line up today; hold off on long-range decisions.",
      move: "Try now: list three small things that 'were never really mine to want'.",
    },
    caution: {
      response: "You said you were tired; tiredness doesn't always need willpower — sometimes the body is asking you to subtract.",
      today: "Signals feel tight today; subtraction beats addition.",
      move: "Try now: cross one thing off today that doesn't actually matter to you.",
    },
  },
  overview: {
    supportive: {
      response: "You said you wanted to meet yourself first; today's overall signal is willing to let you step closer.",
      today: "Overall signals lean supportive today; a good day to read yourself quietly and in full.",
      move: "Try now: spend ten minutes writing one paragraph — what today's truest feeling actually is.",
    },
    neutral: {
      response: "You said you couldn't put it into words; not knowing is honest — more so than rushing to answer.",
      today: "Signals are calm today; observe more than act.",
      move: "Try now: record three moments today that made you pause, without judging them.",
    },
    mixed: {
      response: "You said you wanted the whole picture; contradictions are what let the whole picture appear.",
      today: "Signals across domains disagree today; permit yourself not to merge them into a conclusion right now.",
      move: "Try now: write down both of today's conflicting thoughts and delete neither.",
    },
    caution: {
      response: "You said you wanted to be nearer to yourself; sometimes that means allowing yourself, briefly, to be far from everyone.",
      today: "Signals feel tight today; don't demand clarity from this one day.",
      move: "Try now: give yourself one hour of replying to no one.",
    },
  },
};

/**
 * Look up the three-layer counsel. Deterministic: same inputs, same
 * output. `lang` selects the table; unknown bands fall back to
 * `neutral` so the UI is never blank.
 */
export function selectDailyCounsel(args: {
  concern: ConcernKey;
  band: DailyBand | string | null | undefined;
  lang: "zh" | "en";
}): CounselTriple {
  const table = args.lang === "en" ? COUNSEL_TABLE_EN : COUNSEL_TABLE_ZH;
  const bandKey: DailyBand =
    args.band === "supportive" || args.band === "neutral" || args.band === "mixed" || args.band === "caution"
      ? args.band
      : "neutral";
  return table[args.concern][bandKey];
}

// ─────────────── Shelf book copy ───────────────

export type ShelfBook = {
  key: ShelfBookKey;
  title: Bi;
  oneLiner: Bi;
  answers: BiList;
  ctaTarget: ConcernKey;
};

export const SHELF_BOOKS: ShelfBook[] = [
  {
    key: "self_knowledge",
    title: { zh: "认识自己", en: "Meet yourself" },
    oneLiner: {
      zh: "从性格底色、身心节奏、家庭课题看到你为什么反复走同一段路。",
      en: "Read character, body-mind rhythm and family lessons to see why you keep walking the same road.",
    },
    answers: {
      zh: [
        "我最容易被什么推动？",
        "哪些情绪反应其实来自小时候？",
        "此刻我处于人生的哪一章？",
      ],
      en: [
        "What actually moves me?",
        "Which reactions really come from earlier years?",
        "Which chapter of life am I in?",
      ],
    },
    ctaTarget: "self_family",
  },
  {
    key: "study_growth",
    title: { zh: "学业成长", en: "Study & growth" },
    oneLiner: {
      zh: "不是分数天花板，而是适合你的学习方式与优势学科族群。",
      en: "Not a ceiling on grades — the way of learning and subject clusters that fit you.",
    },
    answers: {
      zh: [
        "我在什么学习结构下最不费力？",
        "我的优势属于哪一族学科？",
        "现在更该积累、调整还是转向？",
      ],
      en: [
        "Which learning structure costs me least?",
        "Which cluster of subjects plays to my strengths?",
        "Now: accumulate, adjust, or pivot?",
      ],
    },
    ctaTarget: "study",
  },
  {
    key: "career_path",
    title: { zh: "事业道路", en: "Career path" },
    oneLiner: {
      zh: "看清工作结构、行业方向与什么时候适合发力或收敛。",
      en: "See your fit in work structure and direction, and when to push or to consolidate.",
    },
    answers: {
      zh: [
        "我的驱动来自哪里？",
        "接下来 12 个月更适合发动还是准备？",
        "哪种工作结构真的能回馈我？",
      ],
      en: [
        "Where does my drive actually come from?",
        "Do the next 12 months favour launching or preparing?",
        "Which work structure actually gives back to me?",
      ],
    },
    ctaTarget: "career",
  },
  {
    key: "love_bonds",
    title: { zh: "爱情关系", en: "Love & bonds" },
    oneLiner: {
      zh: "关系需求、吸引模式、边界，以及适合稳固或探索的窗口。",
      en: "Relational needs, attraction patterns, boundaries, and windows for stability or exploration.",
    },
    answers: {
      zh: [
        "我为什么总被同一类人吸引？",
        "我需要的到底是热烈还是可预期？",
        "哪些关系我不必缩小自己？",
      ],
      en: [
        "Why the same type over and over?",
        "Do I actually need intensity, or predictability?",
        "Which relationships let me not shrink?",
      ],
    },
    ctaTarget: "love",
  },
  {
    key: "wealth_path",
    title: { zh: "财富路径", en: "Wealth path" },
    oneLiner: {
      zh: "主要收入靠的是什么能力，钱为什么难留下，什么风险你其实承担不起。",
      en: "Which ability really earns for you, why money doesn't stay, and which risks you can't actually carry.",
    },
    answers: {
      zh: [
        "我的收入主要靠哪种能力？",
        "钱主要漏在哪里？",
        "近期宜守宜攻？",
      ],
      en: [
        "Which ability really pulls in my income?",
        "Where does the money mostly leak?",
        "Now: defend or advance?",
      ],
    },
    ctaTarget: "finance",
  },
  {
    key: "life_timeline",
    title: { zh: "人生时间轴", en: "Life timeline" },
    oneLiner: {
      zh: "把大运、流年与关键窗口画成一条可读的能量曲线。",
      en: "Draws long-arc cycles, yearly transits and key windows into one readable energy line.",
    },
    answers: {
      zh: [
        "接下来一年的关键窗口在哪里？",
        "现在处于放缓、深耕，还是转折？",
        "什么时候适合大动作？",
      ],
      en: [
        "Where are the key windows in the year ahead?",
        "Am I now slowing, deepening, or turning?",
        "When does a big move fit?",
      ],
    },
    ctaTarget: "overview",
  },
];
