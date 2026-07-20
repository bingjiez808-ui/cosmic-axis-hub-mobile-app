/**
 * Deterministic demo fixtures for Guided Library V2.
 *
 * Every string in this file is placeholder copy authored for the demo. It
 * is NOT real chart output. Nothing here is derived from AI or from the
 * real premium_facts pipeline — the surface is intentionally decoupled so
 * the demo can be evaluated without touching the production data path.
 *
 * Labelled `DEMO_FIXTURE` for clarity in the UI banner.
 */
import type { LibraryFocus } from "./version";

export const DEMO_FIXTURE = true as const;

export type BookKey =
  | "self"
  | "career"
  | "love"
  | "wealth"
  | "timeline"
  | "chart";

export interface DemoBook {
  key: BookKey;
  icon: string; // emoji stand-in — replaced with SVG glyphs in production
  title_zh: string;
  title_en: string;
  read_minutes: number;
  quick: {
    verdict: string;
    keywords: [string, string, string];
    manifest: string;
    suggestion: string;
    caution: string;
  };
  deep: {
    western: string;
    vedic: string;
    bazi: string;
    ziwei: string;
    consensus: string;
    tension: string;
    evidence: string[];
    premium_hook: string;
    // Book-specific enrichment expected by the manifest.
    career_detail?: { industry: string; role: string; environment: string };
    love_detail?: { need: string; partner: string; conflict: string };
  };
}

export const DEMO_BOOKS: DemoBook[] = [
  {
    key: "self",
    icon: "◐",
    title_zh: "我是谁",
    title_en: "Who Am I",
    read_minutes: 4,
    quick: {
      verdict: "你是那种在安静里最先醒来的人：观察先于表达，选择先于承诺。",
      keywords: ["深思", "克制", "耐心"],
      manifest: "别人以为你在犹豫，其实你在等一个真正值得的答案。",
      suggestion: "把每周留出一段完全不说话的时间，做为自己的对齐仪式。",
      caution: "警惕把内省当成拖延，观察是准备行动的姿势，不是行动本身。",
    },
    deep: {
      western: "月亮落于第十二宫，情绪往内收，成为一个安静的观察者。",
      vedic: "月宿偏向 Anuradha，一种在关系中默默维护秩序的气质。",
      bazi: "日主偏印透干，思维深、判断慢、忠于自己的节奏。",
      ziwei: "命宫紫微独坐，静态权威、被推举而非争夺型的核心气场。",
      consensus: "四体系都指向一种“中心而不外扩”的内在结构。",
      tension: "西方与紫微都提到需要独处；八字则提示不宜长期孤立。",
      evidence: [
        "western.moon.house = 12",
        "vedic.moon.nakshatra = Anuradha",
        "bazi.day_master.polarity = yin",
        "ziwei.命宫.主星 = 紫微",
      ],
      premium_hook: "在高级报告中，这一节展开为《人生课题 · 内向权威者的三段路径》。",
    },
  },
  {
    key: "career",
    icon: "✦",
    title_zh: "事业与天赋",
    title_en: "Career & Gift",
    read_minutes: 5,
    quick: {
      verdict: "你的天赋不在冲锋，而在把一片混乱变成可交付的秩序。",
      keywords: ["结构感", "深耕", "长线"],
      manifest: "同事记不住你怎么说话，但记得住你交付的东西一定能用。",
      suggestion: "选择“需要长期积累才有壁垒”的方向，而非风口。",
      caution: "警惕不合适的短期激励系统，会让你误以为自己不够快。",
    },
    deep: {
      western: "土星与水星有六合，稳定思维 + 可执行结构。",
      vedic: "第十宫主强旺，事业运本身有骨架。",
      bazi: "官星有根、印星护身，适合被授权而非独立单打。",
      ziwei: "官禄宫见天府，稳中带守，长期主义命宫格。",
      consensus: "四体系都指向“结构型职业路径”而非“表演型”。",
      tension: "西方偏向自由创作，八字更偏向组织内部长跑。",
      evidence: [
        "western.aspect.saturn_mercury = sextile",
        "vedic.house_10.lord_strength = strong",
        "bazi.official_star.rooted = true",
        "ziwei.官禄宫.主星 = 天府",
      ],
      premium_hook: "高级报告在此展开《适合行业族群 / 岗位画像 / 组织环境》三张表。",
      career_detail: {
        industry: "教育、法律、金融合规、企业运营、深度内容产品。",
        role: "顾问 / 主控设计 / 长期负责人，而非纯执行或纯 sales。",
        environment: "小而稳定的团队、清晰的授权边界、成果按季度评估。",
      },
    },
  },
  {
    key: "love",
    icon: "❁",
    title_zh: "情感与关系",
    title_en: "Love & Bonds",
    read_minutes: 5,
    quick: {
      verdict: "你需要的是同频，不是同型。相处久了才安心，一见钟情反而让你紧张。",
      keywords: ["同频", "缓热", "边界"],
      manifest: "从朋友变成恋人是你的关系惯性，直觉常在第 6–12 个月才出现。",
      suggestion: "允许自己在一段关系里保留“无解释的独处时间”。",
      caution: "警惕过度解读对方的沉默，那常常只是他自己在充电。",
    },
    deep: {
      western: "金星有海王星微弱三分，浪漫但不迷幻，需要现实感锚定。",
      vedic: "第七宫主与月宿有默契，关系里追求情绪长稳。",
      bazi: "夫妻宫喜用平衡，宜迟婚或稳婚而非速婚。",
      ziwei: "夫妻宫见太阴，重情绪细节、重被理解。",
      consensus: "四体系都提示：慢热关系比冲动关系更适合你。",
      tension: "西方偏浪漫叙事，八字与紫微强调可持续。",
      evidence: [
        "western.venus.aspect.neptune = trine",
        "vedic.house_7.lord.dignity = friendly",
        "bazi.spouse_palace.harmony = true",
        "ziwei.夫妻宫.主星 = 太阴",
      ],
      premium_hook: "高级报告将本节展开为《情感需求 / 伴侣特质 / 冲突模式》三部分。",
      love_detail: {
        need: "被稳定理解，而不是被激烈追求。",
        partner: "有独立世界、能坦率沟通、不用你去管理他的情绪。",
        conflict: "你倾向于沉默处理，对方若也沉默会形成僵局；提前约好“24 小时内先开口”规则。",
      },
    },
  },
  {
    key: "wealth",
    icon: "◈",
    title_zh: "财富与资源",
    title_en: "Wealth & Resources",
    read_minutes: 4,
    quick: {
      verdict: "你的财富曲线是慢坡不是过山车，越晚越稳。",
      keywords: ["积累", "复利", "少即多"],
      manifest: "你不容易一夜暴富，但也不容易一朝清零。",
      suggestion: "把主动收入的 20–30% 放进长期不动结构，其余照常生活。",
      caution: "警惕熟人推荐的短线高收益方案，那是你财路上的典型陷阱。",
    },
    deep: {
      western: "第二宫主行运稳定，收入起伏温和。",
      vedic: "Dhana 星群略偏保守，宜置产而非速投。",
      bazi: "财星藏而不透，靠积累而非爆发。",
      ziwei: "财帛宫见天相，讲原则、忌投机。",
      consensus: "四体系都不支持“重杠杆 / 短线博弈”作为主策略。",
      tension: "紫微允许一次中等规模的产业积累，其他体系更保守。",
      evidence: [
        "western.house_2.transit.stability = medium_high",
        "vedic.dhana_yoga.strength = moderate",
        "bazi.wealth_star.hidden = true",
        "ziwei.财帛宫.主星 = 天相",
      ],
      premium_hook: "高级报告拆解《主要收入来源族群 / 潜在风险》两张对照表。",
    },
  },
  {
    key: "timeline",
    icon: "⋯",
    title_zh: "人生时间轴",
    title_en: "Life Timeline",
    read_minutes: 6,
    quick: {
      verdict: "你的黄金段不是眼前，是接下来三年的“稳中转”。",
      keywords: ["转向", "扎根", "远行"],
      manifest: "你会在一个平静的季度里突然做出一个看起来风险很大的决定。",
      suggestion: "把大决策安排到你精神最清晰的两个月做，别在焦虑期里下判断。",
      caution: "警惕把“换环境”当成“换人生”，环境是杠杆不是答案。",
    },
    deep: {
      western: "土星过 IC，家庭与根基议题上台。",
      vedic: "大运进入 Jupiter 干支，扩展主题被启动。",
      bazi: "运走食伤，表达与作品明显增多。",
      ziwei: "大限主星与本命共振，属实质型运。",
      consensus: "四体系都提示未来 24–36 个月有一个真正的“节点”。",
      tension: "西方指向内部整理，紫微指向对外扩张。",
      evidence: [
        "western.transit.saturn.house = 4",
        "vedic.dasa.current = Jupiter",
        "bazi.luck_pillar.element = fire",
        "ziwei.大限.主星 = 天机",
      ],
      premium_hook: "高级报告输出未来 12 个月每月能量曲线与决策窗口。",
    },
  },
  {
    key: "chart",
    icon: "✧",
    title_zh: "四体系命盘",
    title_en: "Four-System Chart",
    read_minutes: 3,
    quick: {
      verdict: "四张盘互相印证的地方，就是你可以长期依赖的天赋结构。",
      keywords: ["交叉", "印证", "冗余"],
      manifest: "你越是重要的选择，越应该看四体系“共同同意”的方向。",
      suggestion: "把四体系共识作为“不后悔选项”，把冲突处作为“需要更多信息”。",
      caution: "警惕只挑一个体系的结论去证实自己想做的事——那是自我说服，不是解读。",
    },
    deep: {
      western: "本命盘：太阳/月亮/上升三要素结构。",
      vedic: "月宿 + 大运 + 相位表。",
      bazi: "四柱 + 十神 + 大运 + 流年简表。",
      ziwei: "十二宫 + 四化 + 大限简表。",
      consensus: "四张盘的共同强项，是你长期最稳的“天然壁垒”。",
      tension: "四张盘的分歧处，是你人生里最有趣、最需要选择的部分。",
      evidence: [
        "western.chart.rendered = true",
        "vedic.chart.rendered = true",
        "bazi.chart.rendered = true",
        "ziwei.chart.rendered = true",
      ],
      premium_hook: "高级报告以此为总纲，向下展开 24 章。",
    },
  },
];

const RECOMMENDATION_ORDER: Record<LibraryFocus, BookKey[]> = {
  career: ["career", "timeline", "self", "wealth", "love", "chart"],
  love: ["love", "self", "timeline", "career", "wealth", "chart"],
  wealth: ["wealth", "career", "timeline", "self", "love", "chart"],
  self: ["self", "love", "career", "timeline", "wealth", "chart"],
  unsure: ["self", "career", "love", "wealth", "timeline", "chart"],
};

export function recommendedOrderFor(focus: LibraryFocus): BookKey[] {
  return RECOMMENDATION_ORDER[focus];
}

export function nextBookAfter(focus: LibraryFocus, current: BookKey): BookKey | null {
  const order = RECOMMENDATION_ORDER[focus];
  const i = order.indexOf(current);
  if (i < 0 || i >= order.length - 1) return null;
  return order[i + 1];
}

export const FOCUS_CARDS: Array<{
  key: LibraryFocus;
  title_zh: string;
  subtitle_zh: string;
  glyph: string;
}> = [
  { key: "career", title_zh: "事业", subtitle_zh: "方向、行业、天赋", glyph: "✦" },
  { key: "love", title_zh: "情感", subtitle_zh: "关系、伴侣、边界", glyph: "❁" },
  { key: "wealth", title_zh: "财富", subtitle_zh: "积累、节奏、风险", glyph: "◈" },
  { key: "self", title_zh: "自我", subtitle_zh: "性格、内在、课题", glyph: "◐" },
  { key: "unsure", title_zh: "不确定", subtitle_zh: "让图书馆推荐", glyph: "✧" },
];

export const TRADITIONS = [
  { key: "western", label_zh: "西方占星", detail_zh: "行星与相位" },
  { key: "vedic", label_zh: "印度吠陀", detail_zh: "月宿与大运" },
  { key: "bazi", label_zh: "中国八字", detail_zh: "四柱与十神" },
  { key: "ziwei", label_zh: "紫微斗数", detail_zh: "十二宫与四化" },
] as const;
