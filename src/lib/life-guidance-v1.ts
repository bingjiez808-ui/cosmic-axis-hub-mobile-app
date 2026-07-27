/**
 * life-guidance-v1 — deterministic data + selectors for the "Curator's
 * Letter", "Life Chapter Right Now" and "Historical Echoes" experience.
 *
 * All output is deterministic. Same (stage, domain, day, lang) input
 * yields the same strings. No AI, no Math.random.
 */

export const LIFE_GUIDANCE_VERSION = "life-guidance-v1";

export type Lang = "en" | "zh";

export type LifeStage =
  | "learning_self"
  | "early_adulthood"
  | "building_life"
  | "midlife_reassessment"
  | "maturity_legacy";

export const LIFE_STAGES: readonly LifeStage[] = [
  "learning_self",
  "early_adulthood",
  "building_life",
  "midlife_reassessment",
  "maturity_legacy",
] as const;

/**
 * Priority-domain keys mirror /me/home's daily-domain-score-v2 keys.
 */
export type DomainKey = "love" | "study" | "career" | "body_mind" | "finance";

export type StageSource = "auto" | "user";

/* ─────────────────────────── Age → default stage ─────────────────────── */

/**
 * Compute integer age in the viewer's local timezone (already provided as
 * `today = YYYY-MM-DD` from the caller). Ignores time-of-day. Returns null
 * when birth date is missing or malformed. Robust against Feb 29 (birthday
 * on Feb 28 in non-leap years) and around midnight boundaries.
 */
export function computeAge(
  birthDateISO: string | null | undefined,
  todayISO: string,
): number | null {
  if (!birthDateISO || !/^\d{4}-\d{2}-\d{2}$/.test(birthDateISO)) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(todayISO)) return null;
  const [by, bm, bd] = birthDateISO.split("-").map(Number);
  const [ty, tm, td] = todayISO.split("-").map(Number);
  if (!by || !bm || !bd || !ty || !tm || !td) return null;
  let age = ty - by;
  // Not yet had this year's birthday?
  if (tm < bm || (tm === bm && td < bd)) age -= 1;
  return age < 0 ? 0 : age;
}

/**
 * Default stage suggestion from age. This is a *starting suggestion only*
 * — users may override. Deliberately non-mechanical labels:
 *   <=22           → learning_self
 *   23–29          → early_adulthood
 *   30–41          → building_life
 *   42–54          → midlife_reassessment
 *   55+            → maturity_legacy
 * Returns null when age is null.
 */
export function defaultStageForAge(age: number | null): LifeStage | null {
  if (age == null) return null;
  if (age <= 22) return "learning_self";
  if (age <= 29) return "early_adulthood";
  if (age <= 41) return "building_life";
  if (age <= 54) return "midlife_reassessment";
  return "maturity_legacy";
}

/* ─────────────────────────── Priority domain ─────────────────────────── */

/**
 * Pick the "priority domain" from a domain-score array using the same
 * heuristic /me/home already surfaces: the domain whose score deviates
 * farthest from the neutral 50, ties broken by DOMAIN_ORDER. Returns
 * null when the array is empty.
 */
export function pickPriorityDomain(
  domains: ReadonlyArray<{ domain: string; score: number }>,
): DomainKey | null {
  if (!domains.length) return null;
  const rank: Record<string, number> = {
    love: 0,
    study: 1,
    career: 2,
    body_mind: 3,
    finance: 4,
  };
  const sorted = [...domains]
    .filter((d) => d.domain in rank)
    .sort((a, b) => {
      const da = Math.abs(a.score - 50);
      const db = Math.abs(b.score - 50);
      if (db !== da) return db - da;
      return (rank[a.domain] ?? 99) - (rank[b.domain] ?? 99);
    });
  return (sorted[0]?.domain as DomainKey) ?? null;
}

/* ─────────────────────────── Curator's Letter ────────────────────────── */

export const curatorLetter: Record<
  Lang,
  {
    kicker: string;
    intro: [string, string]; // two short teaser lines
    openCta: string;
    closeCta: string;
    paragraphs: string[]; // 5 short paragraphs
    ctaRitual: string;
    ctaPeers: string;
    safety: string;
    seal: string;
  }
> = {
  zh: {
    kicker: "馆长序言 · 命运图书馆",
    intro: [
      "命盘不是判决书，而是一张帮助你辨认自己、理解处境、重新选择道路的地图。",
      "读懂命运，不是向命运投降，而是重新拿回选择。",
    ],
    openCta: "翻开馆长序言",
    closeCta: "合上这封信",
    paragraphs: [
      "旅人，欢迎来到命运图书馆。我们不做预言家，也不替你签下任何一张判决书。我们相信：命盘不是安排，而是一张让你看清自己的地图。",
      "太多的疲惫，其实来自把决策失误和认知盲区都包装成了「命该如此」。当你能分辨哪些属于处境、哪些属于选择、哪些是他人的期待，内耗自会松动。",
      "我们不宣扬优绩主义，也不赞美无意义的忍耐。愿意让你休息、让你转弯、让你更换舞台的建议，永远比让你硬扛的建议更常出现在这些书页里。",
      "命盘只能呈现倾向、条件与可能性——它不能决定你人生的上限。你与谁相遇、什么时候转弯、成为什么样的人，答案始终握在你自己手里。",
      "翻开下一页，去认识你自己。这个图书馆最重的那本书，是你正在写的那一本。",
    ],
    ctaRitual: "开始认识自己",
    ctaPeers: "看看与我同龄的人，都在为什么困惑",
    safety:
      "文化与自我反思用途，不替代心理、医疗、法律或财务专业帮助。",
    seal: "命运图书馆 · 馆长敬上",
  },
  en: {
    kicker: "Curator's Letter · Destiny Library",
    intro: [
      "A chart is not a verdict. It is a map that helps you recognise yourself, read your circumstances, and choose your next road again.",
      "Reading your fate is not surrender to fate — it is taking your choices back.",
    ],
    openCta: "Open the Curator's Letter",
    closeCta: "Close this letter",
    paragraphs: [
      "Traveller, welcome to the Destiny Library. We are not prophets, and we will not hand you any verdict. We believe a chart is not an arrangement — it is a map that lets you see yourself more clearly.",
      "So much exhaustion begins with dressing up misjudgement and blind spots as fate. When you can tell circumstance apart from choice, and both apart from other people's expectations, the noise inside you softens.",
      "We do not celebrate meritocratic burnout, nor romanticise silent endurance. Advice that lets you rest, turn away, or change the stage will appear on these pages far more often than advice that tells you to push through.",
      "A chart shows tendencies, conditions and possibilities. It cannot decide the ceiling of your life. Who you meet, when you turn, and who you become — the answers stay in your own hands.",
      "Turn the page and begin knowing yourself. The heaviest book in this library is the one you are still writing.",
    ],
    ctaRitual: "Begin knowing yourself",
    ctaPeers: "See what people my age are wrestling with",
    safety:
      "Cultural & self-reflection use only; not a substitute for professional mental-health, medical, legal or financial help.",
    seal: "The Curator · Destiny Library",
  },
};

/* ─────────────────────────── Stage templates ─────────────────────────── */

export type StageCopy = {
  label: string;
  resonance: string; // 1 sentence
  lesson: string; // "what this chapter is trying to teach you"
  peerReframe: string; // "why you feel behind"
  ageHint: string; // e.g. "≈ 18–22"
};

const STAGE_COPY: Record<LifeStage, Record<Lang, StageCopy>> = {
  learning_self: {
    zh: {
      label: "求学与认识自己",
      resonance:
        "你正在辨认自己的形状：什么让你活过来，什么让你迅速枯竭。",
      lesson:
        "这一章最重要的功课不是「成为最好的」，而是分清哪些标准来自你，哪些只是别人的声音。",
      peerReframe:
        "同龄人的时间线看起来快，是因为你只看得见他们晒出来的部分。你在慢慢建立自己的判断力，这本身就是进度。",
      ageHint: "≈ 18–22",
    },
    en: {
      label: "Learning & finding your shape",
      resonance:
        "You are still learning your own shape — what wakes you up and what drains you fast.",
      lesson:
        "The real lesson of this chapter is not being the best. It is telling which standards are yours and which are borrowed from other voices.",
      peerReframe:
        "Peers look faster because you only see what they post. Slowly building your own judgement is itself progress.",
      ageHint: "≈ 18–22",
    },
  },
  early_adulthood: {
    zh: {
      label: "初入成年与建立坐标",
      resonance:
        "你正在把自己放进现实的坐标系里：工作、关系、金钱、时间。",
      lesson:
        "这一章的功课是学会小步下注：允许试错、允许换方向，不必一次就把余生押上。",
      peerReframe:
        "看起来先跑起来的人，往往也在悄悄回头改题。你不落后，只是在选择更贴近自己的路径。",
      ageHint: "≈ 23–29",
    },
    en: {
      label: "Entering adulthood, building coordinates",
      resonance:
        "You are placing yourself inside a real coordinate system — work, relationships, money, time.",
      lesson:
        "This chapter asks you to bet small: allow trial, allow direction changes, do not stake the rest of your life on one first move.",
      peerReframe:
        "The people who look ahead are quietly rewriting their own questions too. You are not behind — you are choosing a path that fits you.",
      ageHint: "≈ 23–29",
    },
  },
  building_life: {
    zh: {
      label: "建立生活与承担选择",
      resonance:
        "你正在为一种可以持续的生活承担代价：亲密、事业、健康、责任。",
      lesson:
        "这一章的功课是承认取舍：想要什么、愿意为它放弃什么，把这两句话对自己说清楚。",
      peerReframe:
        "别人「稳定」的样子，大多是外部叙事。你正在为自己真实想要的东西做出选择，这是更慢但更耐久的进度。",
      ageHint: "≈ 30–41",
    },
    en: {
      label: "Building a life, owning your trade-offs",
      resonance:
        "You are paying the real cost of a life that can last — intimacy, work, health, responsibility.",
      lesson:
        "This chapter's lesson is trade-off: name what you want, and what you are willing to let go of to keep it.",
      peerReframe:
        "Other people's 'stable' is usually a caption. You are choosing what you actually want — slower, but far more durable.",
      ageHint: "≈ 30–41",
    },
  },
  midlife_reassessment: {
    zh: {
      label: "中年重估与重新分配精力",
      resonance:
        "你正在重新分配精力：什么值得继续投入，什么可以放下、修剪或告别。",
      lesson:
        "这一章的功课不是重新证明自己，而是把有限的精力交给真正在乎的人和事。",
      peerReframe:
        "别人看起来「拥有更多」的时候，你其实在学会「放下也是一种成就」。这不是退步，是重新分配。",
      ageHint: "≈ 42–54",
    },
    en: {
      label: "Midlife reassessment, reallocating energy",
      resonance:
        "You are redistributing your energy — what still deserves investment, and what you can prune, release or say goodbye to.",
      lesson:
        "This chapter is not about proving yourself again. It is about giving your finite energy to the people and things that actually matter.",
      peerReframe:
        "When peers appear to 'have more', you are learning that letting go is also an achievement. Not regression — reallocation.",
      ageHint: "≈ 42–54",
    },
  },
  maturity_legacy: {
    zh: {
      label: "成熟、健康与传承",
      resonance:
        "你正在照看两件事：自己的身体节奏，以及愿意留给他人的东西。",
      lesson:
        "这一章的功课是允许被照顾、允许慢下来，同时把你真正走过的经验，留一部分给下一代。",
      peerReframe:
        "「还有没有时间」这个问题的答案，永远来自你今天怎么用这一天，而不是别人。",
      ageHint: "≈ 55+",
    },
    en: {
      label: "Maturity, health, and what you pass on",
      resonance:
        "You are tending two things: your body's rhythm, and what you are willing to hand on to others.",
      lesson:
        "This chapter's lesson is to accept being cared for, to slow down, and to leave some of the experience you actually earned for the next generation.",
      peerReframe:
        "The answer to 'is there still time?' comes from how you use today — never from anyone else.",
      ageHint: "≈ 55+",
    },
  },
};

export function stageCopy(stage: LifeStage, lang: Lang): StageCopy {
  return STAGE_COPY[stage][lang];
}

/* ─────────────── Priority-domain × stage action & watch-out ──────────── */

type ActionTemplate = Record<
  DomainKey,
  Record<Lang, { action: string; caution: string }>
>;

const DOMAIN_ACTIONS: Record<LifeStage, ActionTemplate> = {
  learning_self: {
    love: {
      zh: { action: "今天挑一段关系，练习说出一件你真实的感受，而不是应该说的话。", caution: "不必用一次坦诚去测试整段关系的重量。" },
      en: { action: "Pick one relationship today and practise naming a real feeling instead of the expected line.", caution: "One honest sentence isn't a test of the whole relationship — don't force it to be." },
    },
    study: {
      zh: { action: "今天只专注一件学习任务 60 分钟，其他先记下来，别同时开三扇窗。", caution: "不要用「感觉学了很久」代替「真的理解了」。" },
      en: { action: "Give one study task a focused 60 minutes today; park the others in a note instead of juggling.", caution: "Don't trade 'felt like a lot' for 'actually understood'." },
    },
    career: {
      zh: { action: "今天写下你观察到的一个规则或潜规则，只写一条即可。", caution: "不必立刻表演成熟；观察本身已经是能力。" },
      en: { action: "Write down one rule (or unwritten rule) you noticed today. Just one line.", caution: "You don't need to perform maturity yet — noticing is already the skill." },
    },
    body_mind: {
      zh: { action: "今天把睡眠时间往前挪 30 分钟，不用完美，只做一次。", caution: "别用「年轻扛得住」当理由，长期账最贵。" },
      en: { action: "Move your sleep 30 minutes earlier tonight — not a routine, just once.", caution: "'Young enough to handle it' is the most expensive excuse long-term." },
    },
    finance: {
      zh: { action: "今天记下过去 7 天的花销，不做判断，只看清楚。", caution: "不必和别人比消费水平；看清自己的账已经足够。" },
      en: { action: "Log the last 7 days of spending today — no judgement, just visibility.", caution: "Comparison to peers isn't the point; seeing your own numbers is." },
    },
  },
  early_adulthood: {
    love: {
      zh: { action: "今天主动说出一个具体的边界，用一句话就好。", caution: "别急着替对方消化情绪，那不是关心，是内耗。" },
      en: { action: "Name one specific boundary out loud today, in a single sentence.", caution: "Absorbing someone else's feelings isn't care — it's your own drain." },
    },
    study: {
      zh: { action: "今天为你正在学的东西定一个「已经会了」的验证方式，而不是继续加内容。", caution: "输入越多不代表理解越深；输出才验证。" },
      en: { action: "Define one concrete way to prove you've learned what you're studying — not more input.", caution: "More input isn't more understanding — output is the test." },
    },
    career: {
      zh: { action: "今天挑一件事请人反馈，只问 1 个具体问题。", caution: "不必求完整评价；追求一次可执行的修正。" },
      en: { action: "Ask for feedback on one thing today — one specific question, not everything.", caution: "You don't need a full review — you need one actionable edit." },
    },
    body_mind: {
      zh: { action: "今天在饭后走 15 分钟，不看手机，只走。", caution: "别把疲惫当作勋章；它是账单，不是荣誉。" },
      en: { action: "Walk 15 minutes after a meal today — no phone, just walking.", caution: "Exhaustion is a bill, not a badge — stop tipping it." },
    },
    finance: {
      zh: { action: "今天检查一笔自动扣款：还在用吗？值这个价吗？", caution: "别把「都在花」当作「必须花」，很多是惯性。" },
      en: { action: "Audit one recurring charge today: still using it? worth the price?", caution: "'Everyone spends this' isn't 'you must' — a lot is inertia." },
    },
  },
  building_life: {
    love: {
      zh: { action: "今天和一位重要的人对一件小事说「谢谢，我看到了」。", caution: "别把亲密关系当作永远兜底的救生艇，它也需要维护。" },
      en: { action: "Tell someone important today: 'I see it. Thank you.' — about one small thing.", caution: "Intimacy isn't an always-on lifeboat — it needs maintenance too." },
    },
    study: {
      zh: { action: "今天用 20 分钟把一件正在做的事写成给未来自己看的说明。", caution: "别用忙碌代替沉淀，脑子里的东西没被写下就等于没有。" },
      en: { action: "Spend 20 minutes today writing an ongoing task into a note for future-you.", caution: "Busy isn't the same as consolidated — unwritten thinking is basically lost." },
    },
    career: {
      zh: { action: "今天把一件小事正式授权给别人，包括允许对方用自己的方式做。", caution: "「我自己做更快」是短期真话、长期陷阱。" },
      en: { action: "Delegate one small task today — and let the other person do it their way.", caution: "'I'll just do it myself' is true short-term, a trap long-term." },
    },
    body_mind: {
      zh: { action: "今天为身体安排一件小事：一次拉伸、一次午睡、一次早点关灯。", caution: "别再拿透支换进度，账单会以身体的形式回来。" },
      en: { action: "Book one small thing for your body today: a stretch, a nap, lights out earlier.", caution: "Trading health for output — your body sends the invoice with interest." },
    },
    finance: {
      zh: { action: "今天检查一项支出是否真的服务于你想要的生活，不是别人期待的生活。", caution: "别把身份消费当作稳定；账户平静远胜过朋友圈热闹。" },
      en: { action: "Check one expense today: does it serve the life you actually want, or the one expected of you?", caution: "Status spending isn't stability — a quiet balance sheet beats a loud feed." },
    },
  },
  midlife_reassessment: {
    love: {
      zh: { action: "今天主动约一位你在乎但很久没联系的人，只要 10 分钟。", caution: "别用「等有空」拖住关系；关系是持续的动作，不是意愿。" },
      en: { action: "Reach out to one person you care about but haven't spoken to in a while — 10 minutes is enough.", caution: "'When I have time' quietly ends relationships — care is action, not intention." },
    },
    study: {
      zh: { action: "今天允许自己学一件「无用」的东西 30 分钟，纯粹因为你想。", caution: "别把每一次学习都要求转化为产出，那会榨干好奇心。" },
      en: { action: "Give yourself 30 minutes today on something 'useless' — purely because you want to.", caution: "Turning every learning into output kills the curiosity that fuels it." },
    },
    career: {
      zh: { action: "今天列一件「做了很久，其实可以停」的事，写下来即可。", caution: "重估不是放弃，是把有限时间还给你自己。" },
      en: { action: "Name one thing you've done for years that you could actually stop. Just write it down.", caution: "Reassessment isn't giving up — it's returning finite time to yourself." },
    },
    body_mind: {
      zh: { action: "今天做一项常规体检里被你拖延的小项目，或至少预约。", caution: "别再把体检当负担；不看数据的健康是猜的。" },
      en: { action: "Book (or actually do) one delayed check-up today.", caution: "Skipping data isn't health — it's guessing." },
    },
    finance: {
      zh: { action: "今天检查一次核心账户和一份保障，把小漏洞记下来。", caution: "别用「还来得及」安慰自己拖延，就今天看一次。" },
      en: { action: "Audit one core account and one insurance today — write down any small gap.", caution: "'There's still time' postpones the check that pays off — do it today." },
    },
  },
  maturity_legacy: {
    love: {
      zh: { action: "今天把一件想对家人说的话写下来或说出来，不必长。", caution: "别把「他们知道的」当作「已经听到过」。" },
      en: { action: "Say or write one thing to family today — it doesn't have to be long.", caution: "'They already know' isn't the same as 'they've heard it from you.'" },
    },
    study: {
      zh: { action: "今天把你熟练的一门经验讲给一个人，一段话就够。", caution: "别等「合适的听众」，讲的过程本身让你更清楚。" },
      en: { action: "Teach one thing you know well to one person today — a paragraph is enough.", caution: "Don't wait for the 'right audience' — teaching is how you clarify it yourself." },
    },
    career: {
      zh: { action: "今天为正在做的事找一个可以慢慢交接的人，即使只是记下名字。", caution: "别把所有事都攥在手里，那是对自己也对他人的重量。" },
      en: { action: "Identify one person you could slowly hand something to — even just noting the name.", caution: "Holding everything is a weight — on you and on them." },
    },
    body_mind: {
      zh: { action: "今天给身体一次温和的运动 15 分钟，重点是持续，不是强度。", caution: "别追年轻时的强度；持续温和更保护你。" },
      en: { action: "Give your body 15 minutes of gentle movement today — the point is continuity, not intensity.", caution: "Don't chase your younger intensity; steady gentle work protects you more." },
    },
    finance: {
      zh: { action: "今天检查一次账户或遗产文件的一小项，让明天的自己更省事。", caution: "别把「以后再说」留给正在慌乱中的家人。" },
      en: { action: "Review one small piece of your accounts or estate paperwork today.", caution: "'Later' becomes a burden your family carries during a hard week — spare them." },
    },
  },
};

export function domainAction(
  stage: LifeStage,
  domain: DomainKey | null,
  lang: Lang,
): { action: string; caution: string } {
  const fallback = DOMAIN_ACTIONS[stage].body_mind[lang];
  if (!domain) return fallback;
  return DOMAIN_ACTIONS[stage][domain][lang];
}

/* ─────────────────────────── Historical figures ──────────────────────── */

export type HistoricalFigure = {
  key: string;
  stage: LifeStage;
  domains: DomainKey[];
  name: Record<Lang, string>;
  era: Record<Lang, string>;
  situation: Record<Lang, string>;
  tension: Record<Lang, string>;
  choice: Record<Lang, string>;
  borrow: Record<Lang, string>;
  dontCopy: Record<Lang, string>;
};

/**
 * Curated public-biography sketches. Widely-accepted facts only —
 * no invented quotes, no chart claims, no diagnoses. Every stage
 * gets at least 3 figures across eras/cultures.
 */
export const historicalFigures: HistoricalFigure[] = [
  // ─── learning_self ───
  {
    key: "malala",
    stage: "learning_self",
    domains: ["study", "body_mind", "career"],
    name: { zh: "马拉拉 · 优素福扎伊", en: "Malala Yousafzai" },
    era: { zh: "巴基斯坦 · 1997– ", en: "Pakistan · b. 1997" },
    situation: {
      zh: "少女时期，她想继续上学，而她的家乡正处在剥夺女孩受教育权利的压力之下。",
      en: "As a teenager she wanted to keep going to school in a region where girls' education was under threat.",
    },
    tension: {
      zh: "个人安全与继续发声之间的取舍；家庭愿望与外部危险的拉扯。",
      en: "The pull between personal safety and continuing to speak up; between family hope and external danger.",
    },
    choice: {
      zh: "在遇袭后仍继续为女孩受教育权发声，代价是不能回到熟悉的故乡生活。",
      en: "She kept speaking for girls' schooling after being attacked — the cost was not returning to the life she knew.",
    },
    borrow: {
      zh: "把「继续学习」当作一种立场，而不仅是一件任务。",
      en: "Treat 'continuing to learn' as a stance, not just a task.",
    },
    dontCopy: {
      zh: "不必把每一次发声都放到公共舞台，安全与私域也是选择。",
      en: "You don't have to put every voice on a public stage — safety and privacy are also choices.",
    },
  },
  {
    key: "franklin_teen",
    stage: "learning_self",
    domains: ["study", "career"],
    name: { zh: "本杰明 · 富兰克林（少年时期）", en: "Benjamin Franklin (as a youth)" },
    era: { zh: "北美 · 1706–1790", en: "Colonial America · 1706–1790" },
    situation: {
      zh: "少年学徒时期，他没有正规学校教育，只能在印刷所和自学中拼出知识。",
      en: "As a young apprentice with no formal schooling, he pieced together learning inside a print shop and by teaching himself.",
    },
    tension: {
      zh: "现实生计与自我教育之间的时间分配。",
      en: "Splitting limited time between earning a living and self-education.",
    },
    choice: {
      zh: "把每天的碎片时间转成阅读、抄写与练习，长期积累。",
      en: "Turned fragments of each day into reading, copying and practice, compounding over years.",
    },
    borrow: {
      zh: "把「今天多学一点」变成小到不容易破戒的习惯。",
      en: "Make 'a little more today' a habit small enough that you rarely break it.",
    },
    dontCopy: {
      zh: "他的时代节奏与今天不同；不必用他的量表苛责自己。",
      en: "His century's tempo is not ours — don't beat yourself with his yardstick.",
    },
  },
  {
    key: "curie_young",
    stage: "learning_self",
    domains: ["study", "career"],
    name: { zh: "玛丽 · 居里（求学期）", en: "Marie Curie (student years)" },
    era: { zh: "波兰 / 法国 · 1867–1934", en: "Poland / France · 1867–1934" },
    situation: {
      zh: "青年时期她想学科学，但当时的波兰不接受女性进入大学。",
      en: "As a young woman she wanted to study science, but universities in her homeland did not admit women at the time.",
    },
    tension: {
      zh: "留在家乡与追求学术之间的取舍。",
      en: "Staying near family versus leaving to pursue a scientific education.",
    },
    choice: {
      zh: "远赴巴黎求学，长期节衣缩食，只为进入一间自己想要的教室。",
      en: "Moved to Paris and lived very frugally for years to sit in the classroom she wanted.",
    },
    borrow: {
      zh: "如果本地的门关着，就找一间开着的门，即使要走远一点。",
      en: "If the local door is closed, find one that's open — even if you have to travel to reach it.",
    },
    dontCopy: {
      zh: "不必用透支健康换机会，她后期也曾为此付出代价。",
      en: "You don't have to trade your health for opportunity — she paid a real cost for that later.",
    },
  },

  // ─── early_adulthood ───
  {
    key: "jobs_20s",
    stage: "early_adulthood",
    domains: ["career", "study"],
    name: { zh: "史蒂夫 · 乔布斯（20 岁前后）", en: "Steve Jobs (around his 20s)" },
    era: { zh: "美国 · 1955–2011", en: "USA · 1955–2011" },
    situation: {
      zh: "他从大学退学，靠在附近旁听感兴趣的课，尤其是书法课。",
      en: "He dropped out of college but kept auditing classes that interested him, notably calligraphy.",
    },
    tension: {
      zh: "看似「无用」的兴趣与「应该」的正轨之间的选择。",
      en: "'Useless' interest versus the expected straight path.",
    },
    choice: {
      zh: "允许自己走非典型路径，把兴趣长期存着，等未来自己去连接。",
      en: "Allowed himself an atypical path, saving interests to be connected later.",
    },
    borrow: {
      zh: "现在无法预测的连接，很多年后可能才成型；先允许自己感兴趣。",
      en: "Connections you can't predict now often show up years later — first, allow yourself to be curious.",
    },
    dontCopy: {
      zh: "不必把「退学」浪漫化，路径是他的，不是普遍处方。",
      en: "Don't romanticise dropping out — his path was his, not a universal prescription.",
    },
  },
  {
    key: "murasaki",
    stage: "early_adulthood",
    domains: ["career", "love"],
    name: { zh: "紫式部", en: "Murasaki Shikibu" },
    era: { zh: "日本平安时代 · 约 973–1014", en: "Heian Japan · c. 973–1014" },
    situation: {
      zh: "早年守寡后，她进入宫廷成为女官，在有限的活动空间里持续写作。",
      en: "Widowed young, she entered court service as a lady-in-waiting and kept writing within a narrow social space.",
    },
    tension: {
      zh: "现实处境（阶层、性别、身份）与内在创作愿望之间的落差。",
      en: "The gap between her real constraints (class, gender, role) and her inner creative drive.",
    },
    choice: {
      zh: "利用宫廷生活的观察与自由时段坚持写作，完成《源氏物语》。",
      en: "Used what freedom court life did give her — observation and quiet hours — to sustain the work that became The Tale of Genji.",
    },
    borrow: {
      zh: "空间不完美，也可以有真实的产出。",
      en: "An imperfect space can still produce real work.",
    },
    dontCopy: {
      zh: "她的处境是历史性的，不必美化限制本身。",
      en: "Her constraints were historical — don't romanticise the limits themselves.",
    },
  },
  {
    key: "franklin_20s",
    stage: "early_adulthood",
    domains: ["career", "finance"],
    name: { zh: "本杰明 · 富兰克林（20 多岁）", en: "Benjamin Franklin (in his 20s)" },
    era: { zh: "北美 · 1706–1790", en: "Colonial America · 1706–1790" },
    situation: {
      zh: "20 多岁离开熟悉的城市，在费城开始新的印刷生意。",
      en: "In his twenties he left the city he knew and started a printing business in Philadelphia.",
    },
    tension: {
      zh: "稳定的旧路径与在陌生城市重新建立信誉之间的选择。",
      en: "The stable known path versus rebuilding a reputation in a new city.",
    },
    choice: {
      zh: "选择重新开始，专注于建立信誉和小社群，而不是一夜成功。",
      en: "Chose the restart, focusing on trust and a small community rather than quick success.",
    },
    borrow: {
      zh: "早期最重要的资产是别人愿意把小事交给你。",
      en: "Your most important early asset is other people willing to hand you small things.",
    },
    dontCopy: {
      zh: "不必模仿他的行业或时代节奏，只借用「先建立信任」的顺序。",
      en: "Don't copy the trade or century — borrow the order: trust before scale.",
    },
  },

  // ─── building_life ───
  {
    key: "abe_lawyer",
    stage: "building_life",
    domains: ["career", "body_mind"],
    name: { zh: "亚伯拉罕 · 林肯（律师时期）", en: "Abraham Lincoln (lawyer years)" },
    era: { zh: "美国 · 1809–1865", en: "USA · 1809–1865" },
    situation: {
      zh: "在成为总统前，他多年做地方律师，往返各县出差，收入起伏。",
      en: "Before the presidency he practised circuit law for years, travelling between counties with an uneven income.",
    },
    tension: {
      zh: "看似不够耀眼的日常工作与内在使命感之间的张力。",
      en: "Everyday work that didn't feel grand versus a growing sense of larger calling.",
    },
    choice: {
      zh: "把日常案件做扎实，同时长期阅读、写作与思考公共问题。",
      en: "Did the ordinary casework well while reading, writing and thinking about public issues on the side.",
    },
    borrow: {
      zh: "看似平淡的几年，往往是后来能承担更大责任的地基。",
      en: "The years that feel plain are often the foundation for the bigger work later.",
    },
    dontCopy: {
      zh: "不必等待「大时代召唤」；也不必因未被召唤而否定自己。",
      en: "Don't wait for a 'moment of history' — and don't invalidate yourself if it never arrives.",
    },
  },
  {
    key: "curie_marriage",
    stage: "building_life",
    domains: ["career", "love"],
    name: { zh: "玛丽 · 居里（合作研究期）", en: "Marie Curie (research partnership years)" },
    era: { zh: "法国 · 1867–1934", en: "France · 1867–1934" },
    situation: {
      zh: "与配偶皮埃尔在极其简陋的实验室里坚持研究放射性。",
      en: "She and her partner Pierre pushed on with radioactivity research in a very bare lab.",
    },
    tension: {
      zh: "家庭责任、经济压力与长期研究之间的持续拉扯。",
      en: "Ongoing pull between family, money pressure and long-term research.",
    },
    choice: {
      zh: "把工作与亲密关系放在同一节奏里，而不是让其中一个吃掉另一个。",
      en: "Kept work and partnership on the same rhythm instead of letting one swallow the other.",
    },
    borrow: {
      zh: "重要的关系值得进入你日程表的「已锁定」部分。",
      en: "Important relationships deserve to be in the 'already locked' part of your calendar.",
    },
    dontCopy: {
      zh: "别把长期透支健康看作研究者的必需，那是她的代价，不是配方。",
      en: "Don't treat long-term health depletion as a scientist's badge — that was her cost, not a recipe.",
    },
  },
  {
    key: "kahlo",
    stage: "building_life",
    domains: ["body_mind", "love", "career"],
    name: { zh: "弗里达 · 卡罗", en: "Frida Kahlo" },
    era: { zh: "墨西哥 · 1907–1954", en: "Mexico · 1907–1954" },
    situation: {
      zh: "严重车祸后长期身体疼痛，同时经营高强度的婚姻和艺术生涯。",
      en: "Long-term physical pain after a serious accident, alongside an intense marriage and art career.",
    },
    tension: {
      zh: "身体极限、亲密关系风暴与创作愿望三者之间的分配。",
      en: "Body limits, a stormy relationship, and creative drive competing for the same energy.",
    },
    choice: {
      zh: "把痛苦本身变成作品的材料，而不是等到「身体好起来」才创作。",
      en: "Turned the pain itself into material for the work — did not wait to be 'well' before creating.",
    },
    borrow: {
      zh: "允许自己在不完美的身体状态里继续创造与生活。",
      en: "Allow yourself to keep creating and living inside an imperfect body.",
    },
    dontCopy: {
      zh: "不必美化痛苦或忽视医疗，她的选择是她的，不是普遍处方。",
      en: "Don't romanticise pain or refuse care — her choices were hers, not a prescription for anyone else.",
    },
  },

  // ─── midlife_reassessment ───
  {
    key: "gauguin",
    stage: "midlife_reassessment",
    domains: ["career", "finance", "love"],
    name: { zh: "保罗 · 高更", en: "Paul Gauguin" },
    era: { zh: "法国 · 1848–1903", en: "France · 1848–1903" },
    situation: {
      zh: "35 岁前后，他从股票经纪人的职业转向全职绘画。",
      en: "Around 35, he left a stockbroker career to paint full-time.",
    },
    tension: {
      zh: "家庭经济稳定与个人艺术使命之间的巨大取舍。",
      en: "Family financial stability versus personal artistic calling.",
    },
    choice: {
      zh: "选择转向艺术，代价是家庭关系与经济的长期动荡。",
      en: "Chose art — at the cost of long-term strain on family and finances.",
    },
    borrow: {
      zh: "中年重估时，「你真正想为什么承担代价」是一个必须问的问题。",
      en: "At midlife, 'what am I actually willing to pay a price for?' is a question you have to ask.",
    },
    dontCopy: {
      zh: "他把代价大部分转嫁到了家人身上，这不是一个可以复制的答案。",
      en: "He passed most of that cost onto his family — that isn't a template to reuse.",
    },
  },
  {
    key: "junghmid",
    stage: "midlife_reassessment",
    domains: ["career", "body_mind"],
    name: { zh: "卡尔 · 荣格（中年转折）", en: "Carl Jung (his mid-life turn)" },
    era: { zh: "瑞士 · 1875–1961", en: "Switzerland · 1875–1961" },
    situation: {
      zh: "在与弗洛伊德决裂后，他进入长期的自我探索期，暂时退出主流学术。",
      en: "After breaking with Freud he entered a long period of self-inquiry, stepping back from mainstream academia.",
    },
    tension: {
      zh: "既有名声与内心不能再回避的问题之间的冲突。",
      en: "Existing reputation versus questions he could no longer avoid inside himself.",
    },
    choice: {
      zh: "允许自己「退一段」，把这段时间用于内在梳理与写作。",
      en: "Allowed himself a long 'withdrawal', using it for inner work and writing.",
    },
    borrow: {
      zh: "中年时，允许自己「什么都不产出」的一段时间，可能是最重要的产出。",
      en: "In midlife, letting yourself 'produce nothing' for a while can be the most important output.",
    },
    dontCopy: {
      zh: "不必模仿他的隐居时长；每个人的复原时间尺度不同。",
      en: "Don't copy the length — everyone's recovery scale is different.",
    },
  },
  {
    key: "julia_child",
    stage: "midlife_reassessment",
    domains: ["career", "study"],
    name: { zh: "朱莉娅 · 柴尔德", en: "Julia Child" },
    era: { zh: "美国 · 1912–2004", en: "USA · 1912–2004" },
    situation: {
      zh: "她在近 40 岁时才开始认真学做菜，最终在 50 岁前后靠这门手艺成名。",
      en: "She only began learning to cook seriously in her late 30s and became known for it around age 50.",
    },
    tension: {
      zh: "「起步太晚」的社会叙事与内在对某件事持续兴趣之间的冲突。",
      en: "The 'too late to start' social story versus a real, lasting interest.",
    },
    choice: {
      zh: "无视「太晚」的评价，长期专注在一件她真的享受的手艺上。",
      en: "Ignored the 'too late' verdict and stayed with a craft she actually enjoyed.",
    },
    borrow: {
      zh: "「太晚」通常是别人给你的判词，不是事实。",
      en: "'Too late' is usually someone else's verdict, not a fact.",
    },
    dontCopy: {
      zh: "不必把她的曝光路径当作成就的必要条件。",
      en: "Her public profile isn't a required part of doing what you love.",
    },
  },

  // ─── maturity_legacy ───
  {
    key: "buffett",
    stage: "maturity_legacy",
    domains: ["finance", "career"],
    name: { zh: "沃伦 · 巴菲特", en: "Warren Buffett" },
    era: { zh: "美国 · 1930–", en: "USA · b. 1930" },
    situation: {
      zh: "多年在公开场合承诺将大部分财富捐出，并逐步安排传承。",
      en: "Has publicly committed to giving away most of his wealth and gradually arranged succession.",
    },
    tension: {
      zh: "个人对下一代的期待与「不留下太多」的价值观之间的平衡。",
      en: "Personal hopes for the next generation versus the value that 'not leaving too much' matters.",
    },
    choice: {
      zh: "把「留什么、留给谁、什么时候留」当作长期而具体的工作。",
      en: "Treats 'what to leave, to whom, and when' as an ongoing, concrete piece of work.",
    },
    borrow: {
      zh: "传承不是终点的一次动作，而是提前很多年就开始的一系列小决定。",
      en: "Passing things on isn't a single moment — it's a series of small decisions started years earlier.",
    },
    dontCopy: {
      zh: "不必以他的资产规模为参照；每个人的传承尺度不同。",
      en: "Don't measure by his wealth scale — legacy comes in every size.",
    },
  },
  {
    key: "hokusai",
    stage: "maturity_legacy",
    domains: ["career", "study"],
    name: { zh: "葛饰北斋", en: "Katsushika Hokusai" },
    era: { zh: "日本 · 1760–1849", en: "Japan · 1760–1849" },
    situation: {
      zh: "70 多岁仍在创作代表作，一生反复修改自己的作品和署名。",
      en: "Still creating major work in his 70s, repeatedly refining his art and even his signature over his life.",
    },
    tension: {
      zh: "年龄给身体的限制与仍未完成的手艺之间的冲突。",
      en: "The body's limits versus a craft that still felt unfinished.",
    },
    choice: {
      zh: "在晚年继续把标准往前推，把「还没完成」当作动力而非焦虑。",
      en: "Kept raising his standard late in life, treating 'not yet finished' as fuel rather than anxiety.",
    },
    borrow: {
      zh: "允许自己晚年仍在成长，不必用「差不多了」结束自己。",
      en: "Let yourself keep growing late — you don't have to end yourself with 'that's about enough'.",
    },
    dontCopy: {
      zh: "他的高强度并非普遍适用，休息也是尊重身体。",
      en: "His intensity isn't universal — rest is also respect for the body.",
    },
  },
  {
    key: "mandela_later",
    stage: "maturity_legacy",
    domains: ["career", "love"],
    name: { zh: "纳尔逊 · 曼德拉（晚年）", en: "Nelson Mandela (later life)" },
    era: { zh: "南非 · 1918–2013", en: "South Africa · 1918–2013" },
    situation: {
      zh: "在漫长的公共角色之后，他晚年主动淡出，把舞台交给下一代。",
      en: "After a very long public role, he stepped back later in life and handed the stage to a next generation.",
    },
    tension: {
      zh: "外界仍希望他继续在前台，而他选择让出位置。",
      en: "The public still wanted him at the front; he chose to make room for others.",
    },
    choice: {
      zh: "把「让位」本身当作一项负责任的传承工作。",
      en: "Treated stepping back as itself a responsible act of legacy.",
    },
    borrow: {
      zh: "退到后台，也可以是一种主动的成就。",
      en: "Stepping back can itself be a deliberate achievement.",
    },
    dontCopy: {
      zh: "不必以他的舞台尺度衡量自己；传承在小尺度上同样重要。",
      en: "Don't measure by his scale — legacy at any size matters.",
    },
  },
];

/**
 * Deterministic figure list for a given (stage, priorityDomain?).
 * When domain is provided, figures whose `domains` include it come first;
 * remaining stage-matching figures follow. Order within each tier is
 * insertion order — stable across runs.
 */
export function figuresFor(
  stage: LifeStage,
  domain: DomainKey | null,
): HistoricalFigure[] {
  const stageMatches = historicalFigures.filter((f) => f.stage === stage);
  if (!domain) return stageMatches;
  const primary = stageMatches.filter((f) => f.domains.includes(domain));
  const rest = stageMatches.filter((f) => !f.domains.includes(domain));
  return [...primary, ...rest];
}

/* ─────────────────────────── Historical Echo copy ─────────────────────── */

export const echoCopy: Record<Lang, {
  title: string;
  intro: string;
  disclaimer: string;
  situationLabel: string;
  tensionLabel: string;
  choiceLabel: string;
  borrowLabel: string;
  dontCopyLabel: string;
  prev: string;
  next: string;
  ariaGroup: string;
  bookmark: string;
  bookmarked: string;
  respond: string;
  respondPlaceholder: string;
  respondSave: string;
  respondCancel: string;
  respondSaved: string;
  respondTooLong: string;
  closeQuote1: string;
  closeQuote2: string;
  signInHint: string;
  savedLocal: string;
  empty: string;
}> = {
  zh: {
    title: "历史回声 · 走过这一章的人",
    intro: "在你之前，另一些旅人也翻过这一章。",
    disclaimer:
      "处境主题相近，不代表命格或结局相同。这里不是让你复制他们的路，而是借他们的选择重新看清自己。",
    situationLabel: "当时的处境",
    tensionLabel: "面对的矛盾",
    choiceLabel: "做出的选择及代价",
    borrowLabel: "可以借鉴什么",
    dontCopyLabel: "不能照搬什么",
    prev: "上一位",
    next: "下一位",
    ariaGroup: "历史人物卡",
    bookmark: "夹入我的书签",
    bookmarked: "已加入书签",
    respond: "写下我的回应",
    respondPlaceholder: "写下你从这段处境里看到的自己（≤ 1200 字）…",
    respondSave: "保存回应",
    respondCancel: "取消",
    respondSaved: "已保存",
    respondTooLong: "内容过长，最多 1200 字。",
    closeQuote1:
      "值得借鉴的不是答案，而是他们如何辨认自己不能继续忍受什么，以及愿意为哪种生活承担代价。",
    closeQuote2: "下一页，由你来写。",
    signInHint: "登录后即可保存书签与回应。",
    savedLocal: "已在此浏览器暂存（未登录）",
    empty: "这一章暂时没有匹配的人物记录。",
  },
  en: {
    title: "Historical Echoes · Others who walked this chapter",
    intro: "Before you, other travellers turned this same page.",
    disclaimer:
      "A similar situation doesn't mean a similar chart or a similar ending. This is not a script to copy — it's a way to see yourself more clearly.",
    situationLabel: "Situation",
    tensionLabel: "Tension",
    choiceLabel: "Choice & cost",
    borrowLabel: "What you can borrow",
    dontCopyLabel: "What not to copy",
    prev: "Previous",
    next: "Next",
    ariaGroup: "Biography card",
    bookmark: "Bookmark this echo",
    bookmarked: "Bookmarked",
    respond: "Write my response",
    respondPlaceholder: "Write what you see of yourself in this passage (≤ 1200 chars)…",
    respondSave: "Save response",
    respondCancel: "Cancel",
    respondSaved: "Saved",
    respondTooLong: "Too long — 1200 characters max.",
    closeQuote1:
      "What's worth borrowing isn't the answer — it's how they learned what they could no longer endure, and what life they were willing to pay for.",
    closeQuote2: "The next page is yours to write.",
    signInHint: "Sign in to save bookmarks and responses.",
    savedLocal: "Saved locally in this browser (signed out).",
    empty: "No matching figures for this chapter yet.",
  },
};

/* ─────────────────────────── i18n for the life chapter card ──────────── */

export const chapterCopy: Record<Lang, {
  kicker: string;
  title: string;
  ageLine: (age: number) => string;
  ageUnknown: string;
  stageLabel: string;
  changeStage: string;
  chooseStage: string;
  cancel: string;
  save: string;
  saved: string;
  savedLocal: string;
  actionLabel: string;
  cautionLabel: string;
  cta1: string; // "what to learn"
  cta2: string; // "why do I feel behind"
  cta3: string; // "who walked this before"
  lessonLabel: string;
  peerLabel: string;
  emptyTitle: string;
  emptyBody: string;
  emptyCta: string;
}> = {
  zh: {
    kicker: "此刻的人生页码",
    title: "你正在翻阅的一章",
    ageLine: (age) => `根据你的主命盘，你现在大约 ${age} 岁。`,
    ageUnknown: "尚未从主命盘读到出生日期。",
    stageLabel: "默认阶段建议",
    changeStage: "这不像我现在的人生阶段",
    chooseStage: "选择更贴近现在的阶段",
    cancel: "取消",
    save: "保存",
    saved: "已同步到你的偏好",
    savedLocal: "已在此浏览器暂存（未登录时）",
    actionLabel: "今天可以做的一件事",
    cautionLabel: "不必急着证明",
    cta1: "这个阶段，我最需要学会什么？",
    cta2: "为什么我总觉得自己落后？",
    cta3: "看看历史上谁也经历过这一章",
    lessonLabel: "这一章的功课",
    peerLabel: "关于「落后」这件事",
    emptyTitle: "先登记你的第一张命盘",
    emptyBody:
      "登记后，「此刻的人生页码」会根据你的出生日期给出默认阶段，你随时可以调整。",
    emptyCta: "前往登记",
  },
  en: {
    kicker: "Life chapter right now",
    title: "The chapter you're turning",
    ageLine: (age) => `From your primary chart, you're about ${age} years old.`,
    ageUnknown: "No birth date on your primary chart yet.",
    stageLabel: "Default stage suggestion",
    changeStage: "This isn't my current chapter",
    chooseStage: "Choose a chapter closer to now",
    cancel: "Cancel",
    save: "Save",
    saved: "Saved to your preferences",
    savedLocal: "Saved locally in this browser (signed out).",
    actionLabel: "One thing you can do today",
    cautionLabel: "No need to rush",
    cta1: "What is this chapter trying to teach me?",
    cta2: "Why do I keep feeling behind?",
    cta3: "See who walked this chapter before",
    lessonLabel: "This chapter's lesson",
    peerLabel: "On 'falling behind'",
    emptyTitle: "Register your primary chart first",
    emptyBody:
      "Once registered, this chapter card will suggest a default stage from your birth date. You can change it any time.",
    emptyCta: "Go to registration",
  },
};
