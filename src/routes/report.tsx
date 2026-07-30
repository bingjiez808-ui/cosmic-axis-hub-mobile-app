import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Sparkles,
  Compass,
  Coins,
  Heart,
  Activity,
  TreePine,
  Sprout,
  Flame,
  Sun,
  Moon,
  Layers,
  Star,
  Check,
  AlertTriangle,
  ChevronRight,
  Maximize2,
  BookOpen,
  type LucideIcon,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ReportToc, type TocItem } from "@/components/ReportToc";
import { PriorityPreviewModal } from "@/components/PriorityPreviewModal";
import { isConcernKey } from "@/lib/concern-guidance-v1";
// Sage tree-hole is mounted globally in src/routes/__root.tsx.

const DIM_ICONS: Record<string, LucideIcon> = {
  character: Sparkles,
  academic: BookOpen,
  vocation: Compass,
  wealth: Coins,
  love: Heart,
  health: Activity,
  parents: TreePine,
  children: Sprout,
  mission: Flame,
};

const TRADITION_ICONS: Record<string, LucideIcon> = {
  Astrology: Sun,
  astrology: Sun,
  "Western astrology": Sun,
  西方占星: Sun,
  占星: Sun,
  Jyotish: Moon,
  "Vedic Jyotish": Moon,
  印度占星: Moon,
  吠陀: Moon,
  BaZi: Layers,
  Bazi: Layers,
  八字: Layers,
  "Zi Wei": Star,
  ZiWei: Star,
  "Zi Wei Dou Shu": Star,
  紫微: Star,
  紫微斗数: Star,
};

function traditionIcon(name: string): LucideIcon {
  if (TRADITION_ICONS[name]) return TRADITION_ICONS[name];
  const k = name.toLowerCase();
  if (k.includes("astro") || k.includes("占星")) return Sun;
  if (k.includes("jyot") || k.includes("vedic") || k.includes("印度") || k.includes("吠陀"))
    return Moon;
  if (k.includes("bazi") || k.includes("八字") || k.includes("pillar")) return Layers;
  if (k.includes("zi") || k.includes("紫微") || k.includes("dou")) return Star;
  return Sparkles;
}

// Split a paragraph blob into readable sub-paragraphs (2 sentences each).
// Preserves content — only inserts paragraph breaks between sentence groups.
function splitParagraphs(text: string, groupSize = 2): string[] {
  if (!text) return [];
  // Respect explicit line breaks the model may have inserted.
  const blocks = text
    .split(/\n{2,}|\r\n\r\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const block of blocks) {
    // Sentence splitter for CJK + Latin punctuation, keeping the delimiter.
    const parts = block.match(/[^。！？!?.]+[。！？!?.]?["'”’)）]*\s*/g);
    if (!parts || parts.length <= groupSize) {
      out.push(block);
      continue;
    }
    for (let i = 0; i < parts.length; i += groupSize) {
      out.push(
        parts
          .slice(i, i + groupSize)
          .join("")
          .trim(),
      );
    }
  }
  return out;
}

function textFromUnknown(value: unknown, lang: "en" | "zh"): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return textFromUnknown(value[lang === "zh" ? 1 : 0] ?? value[0], lang);
  }
  if (value && typeof value === "object") {
    const r = value as Record<string, unknown>;
    const candidates =
      lang === "zh"
        ? [r.zh, r.cn, r.chinese, r.plain, r.text, r.synthesis, r.headline, r.summary, r.en]
        : [r.en, r.plain, r.text, r.synthesis, r.headline, r.summary, r.zh, r.cn];
    for (const c of candidates) {
      const s = textFromUnknown(c, lang).trim();
      if (s) return s;
    }
  }
  return "";
}

function textArrayFromUnknown(value: unknown, lang: "en" | "zh"): string[] {
  if (Array.isArray(value)) return value.map((v) => textFromUnknown(v, lang)).filter(Boolean);
  const s = textFromUnknown(value, lang);
  return s ? [s] : [];
}

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
import { FourSystemsChart } from "@/components/charts/FourSystemsChart";
import { planetPlacementReading as placementReading, aspectReading } from "@/lib/planet-reading";
import {
  KeyEventsVerification,
  LifeTimeline,
  MembershipSection,
  SaveReadingBar,
  TarotDraw,
} from "@/components/ReportExtras";
import { AccountModal } from "@/components/AccountModal";
import { useLang } from "@/lib/i18n";
import {
  DIM_KEYS,
  generateReportDimension,
  generateReportSummary,
  type ReportAI,
  type ReportDimensionAI,
} from "@/lib/report.functions";
import {
  assignChartOwnership,
  beginReport,
  buildCanonicalChartInput,
  ensureChart,
  failReport,
  getSavedReport,
  saveReport,
} from "@/lib/reports-store.functions";
import { supabase } from "@/integrations/supabase/client";
import {
  buildReportCacheKey,
  buildReportFingerprint,
  buildReportRequest,
  buildReportSeed,
} from "@/lib/report-input";
import { REPORT_AI_VERSION } from "@/lib/ai-cache-version";
import { useAccount } from "@/lib/account";
import "@/components/report-modules.css";
import {
  buildCalculationSnapshot,
  ELEMENT_LABEL_EN,
  ELEMENT_LABEL_ZH,
  type CalculationSnapshot,
} from "@/lib/calc-snapshot";

type SearchParams = {
  name?: string;
  date?: string;
  time?: string;
  place?: string;
  lang?: "en" | "zh";
  quiz?: string;
  bazi?: string;
  zodiac?: string;
  lunar?: string;
  readingId?: string;
  gender?: "male" | "female";
  role?: "self" | "other";
  relationship?: string;
  relationshipLabel?: string;
  primaryIntent?: "replace" | "keep" | "auto";
  concern?: string;
  focus?: string;
  id?: string;
};

const pickStr = (v: unknown) => (typeof v === "string" ? v : undefined);

export const Route = createFileRoute("/report")({
  head: () => ({
    meta: [
      { title: "Your reading — Library of Destiny" },
      {
        name: "description",
        content: "The unified AI reading of your life, synthesized across four ancient traditions.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): SearchParams => ({
    name: pickStr(s.name),
    date: pickStr(s.date),
    time: pickStr(s.time),
    place: pickStr(s.place),
    lang: s.lang === "zh" ? "zh" : s.lang === "en" ? "en" : undefined,
    quiz: pickStr(s.quiz),
    bazi: pickStr(s.bazi),
    zodiac: pickStr(s.zodiac),
    lunar: pickStr(s.lunar),
    readingId: pickStr(s.readingId),
    gender: s.gender === "male" ? "male" : s.gender === "female" ? "female" : undefined,
    role: s.role === "self" ? "self" : s.role === "other" ? "other" : undefined,
    relationship: pickStr(s.relationship),
    relationshipLabel: pickStr(s.relationshipLabel),
    primaryIntent:
      s.primaryIntent === "replace" || s.primaryIntent === "keep" || s.primaryIntent === "auto"
        ? s.primaryIntent
        : undefined,
    concern: pickStr(s.concern),
    focus: pickStr(s.focus),
    id: pickStr(s.id),
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
        note: [
          "Sun in fire · Mercury retrograde in the 3rd house",
          "太阳落火象 · 水星逆行于第三宫",
        ],
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
          [
            "Recovers meaning from setbacks better than most",
            "从挫折中重新提炼意义的能力，强于常人",
          ],
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
    key: "academic",
    title: ["Academic & Cognition", "学业与认知"],
    headline: ["Learn by shaping, not by absorbing", "以「塑造」为轴的认知节奏 —— 不靠被动吸收"],
    stars: 4,
    strengths: [0.8, 0.75, 0.8, 0.75],
    evidence: [
      {
        tradition: ["Astrology", "西方占星"],
        note: ["Mercury in an air sign · 3rd house emphasis", "水星落风象 · 第三宫得到强化"],
      },
      {
        tradition: ["Jyotish", "印度占星"],
        note: [
          "Moon in a knowledge-oriented Nakshatra · Jupiter aspect",
          "月亮居学识型 Nakshatra · 木星照射",
        ],
      },
      {
        tradition: ["BaZi", "八字"],
        note: [
          "Resource star 印 supports the day master · Output star 食伤 lends expression",
          "印星生扶日主 · 食伤透干利于表达",
        ],
      },
      {
        tradition: ["Zi Wei", "紫微"],
        note: [
          "Palace of parents / education carries 化科 · 文昌 in the命宫",
          "父母/学识宫见化科 · 文昌照命",
        ],
      },
    ],
    synthesis: [
      "Four systems agree on shape rather than IQ: information sticks best when it is used, taught, or re-shaped — not merely absorbed. Strengths cluster in language, human-observation, and cross-domain integration. Exam-style rote intake is not the natural fit.",
      "四大体系一致给出「形状」而非「智商」：知识只有在被使用、被讲述、被重新组织的时候才在你身上真正留下——单纯被动听讲会最快被遗忘。优势多集中在语言表达、社会观察与跨领域整合；纯粹应试型的死记硬背，不是这张盘的天然赛道。",
    ],
    plain: [
      'In everyday words: pick learning methods that let you output early — write summaries, teach juniors, build small projects. Whichever subject cluster you\'re actually curious about is more diagnostic than any "gifted at math or humanities" label. Please treat the clusters below as directions to test, not as fate.',
      "说人话：选那种「让你尽早输出」的学习方式——写摘要、讲给学弟妹听、动手做一个小项目。你此刻真正好奇的学科族群，比任何「文科好还是理科好」的标签都更能说明问题。下面的族群候选是方向，不是结论——请在真实成绩、真实兴趣里验证它。",
    ],
    viz: "radar",
    details: [
      {
        label: ["Subject cluster candidates", "学科族群候选"],
        items: [
          [
            "Languages & humanities expression — writing, translation, teaching",
            "语言与人文表达 —— 写作 · 翻译 · 教学",
          ],
          [
            "Social observation & research — sociology, psychology, policy studies",
            "社会观察与研究 —— 社会学 · 心理 · 政策研究",
          ],
          [
            "Cross-domain integration — design × technology, humanities × data",
            "跨学科整合 —— 设计 × 技术、人文 × 数据",
          ],
          [
            "Applied engineering & operations (secondary channel — needs a project to anchor)",
            "实务工程与应用（次通道 · 需要一个具体项目锚定）",
          ],
        ],
      },
      {
        label: ["Study style that works", "适合的学习方式"],
        items: [
          [
            "Learn by teaching · summarise, then present within 48 hours",
            "以教代学 · 学完 48 小时内讲一遍",
          ],
          [
            "Small, finished projects beat long, un-shipped ones",
            "小而完整的项目 · 优于宏大而无产出的长战线",
          ],
          [
            "Rotate 2–3 subjects a season — pure single-track fatigue drains you",
            "每季度轮换 2–3 门 · 单线高强度容易疲劳",
          ],
          [
            "Age-adapted: student → coursework + side project · adult → re-skilling or teaching what you already do",
            "按年龄适配：学生 → 课程 + 副项目 · 成年 → 再学习或反哺自己的手艺",
          ],
        ],
      },
      {
        label: ["Watch-outs to guard", "需要注意的地方"],
        items: [
          [
            "Rebelling against authority mid-course — pick programs with real freedom",
            "中途因不服权威而改路 —— 尽量选择留有自由度的课程",
          ],
          [
            "Confusing curiosity with commitment — new topic every month, none deepened",
            "把好奇心误当承诺 —— 每月一门新话题，没有一门被深化",
          ],
          [
            "Neglecting the boring foundational reps (grammar drills, base math)",
            "忽略那些「无聊但必要」的基础练习",
          ],
          [
            "Reading your chart as an IQ score — this reading only describes learning shape, not intelligence rank",
            "把这份解读当作智商评分 —— 它只描述学习形状，不给智力打分",
          ],
        ],
      },
    ],
  },
  {
    key: "vocation",
    title: ["Vocation", "事业方向"],
    headline: ["Built to lead, not to repeat", "为领导而生，非为重复而设"],
    stars: 4,
    strengths: [0.85, 0.8, 0.9, 0.7],
    evidence: [
      {
        tradition: ["Astrology", "西方占星"],
        note: ["Sun conjunct Midheaven in the 10th", "太阳合天顶于第十宫"],
      },
      { tradition: ["Jyotish", "印度占星"], note: ["Jupiter in the 10th Bhava", "木星居第十宫"] },
      {
        tradition: ["BaZi", "八字"],
        note: ["Officer star 正官 prominent in the month pillar", "月柱正官显位"],
      },
      {
        tradition: ["Zi Wei", "紫微"],
        note: ["紫微天府 in the career palace", "紫微天府入官禄宫"],
      },
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
    headline: ["Built over cycles, not seasons", "以周期积累，而非季节暴富"],
    stars: 4,
    strengths: [0.75, 0.7, 0.85, 0.7],
    evidence: [
      { tradition: ["Astrology", "西方占星"], note: ["Venus trine Jupiter", "金星三合木星"] },
      { tradition: ["Jyotish", "印度占星"], note: ["Dhana yoga forming", "形成 Dhana Yoga"] },
      {
        tradition: ["BaZi", "八字"],
        note: ["Wealth star 正财 with element support", "正财有力有根"],
      },
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
    headline: ["Late clarity rewards early patience", "晚一点看清，胜过早一点将就"],
    stars: 3,
    strengths: [0.6, 0.7, 0.55, 0.75],
    evidence: [
      {
        tradition: ["Astrology", "西方占星"],
        note: ["Venus square Saturn — mature love pattern", "金星刑土星 — 成熟型恋爱模式"],
      },
      {
        tradition: ["Jyotish", "印度占星"],
        note: ["7th lord aspected by Saturn", "七宫主受土星照射"],
      },
      {
        tradition: ["BaZi", "八字"],
        note: ["Spouse palace strong in later luck pillars", "夫妻宫于后运走强"],
      },
      {
        tradition: ["Zi Wei", "紫微"],
        note: ["天同化禄 in the marriage palace", "天同化禄入夫妻宫"],
      },
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
    headline: ["Fire tempered by water", "火盛，需水来调"],
    stars: 4,
    strengths: [0.7, 0.75, 0.8, 0.65],
    evidence: [
      { tradition: ["Astrology", "西方占星"], note: ["Ascendant ruler cadent", "命主星落续宫"] },
      {
        tradition: ["Jyotish", "印度占星"],
        note: ["6th lord in a friendly sign", "六宫主入友好星座"],
      },
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
    key: "parents",
    title: ["Parents & Family", "父母与原生家庭"],
    headline: ["Rooted, but built to leave the roof", "根扎得深 —— 却生来要走出屋檐"],
    stars: 4,
    strengths: [0.75, 0.85, 0.8, 0.8],
    evidence: [
      {
        tradition: ["Astrology", "西方占星"],
        note: ["Moon in the 4th · Saturn aspecting IC", "月亮居第四宫 · 土星照 IC"],
      },
      {
        tradition: ["Jyotish", "印度占星"],
        note: [
          "4th lord well-placed · Guru's grace on mother-karma",
          "四宫主得地 · 母亲之业受木星恩泽",
        ],
      },
      {
        tradition: ["BaZi", "八字"],
        note: [
          "Year-pillar 印 (Resource) strong; slight 冲 with day pillar",
          "年柱印星有力；与日柱轻冲",
        ],
      },
      {
        tradition: ["Zi Wei", "紫微"],
        note: ["父母宫 has 天梁 · 化科 present", "父母宫见天梁 · 化科入宫"],
      },
    ],
    synthesis: [
      "All four systems draw the same picture: a formative home that gave you standards and a work ethic, and a chart that then insists you leave those standards behind long enough to build your own.",
      "四大体系描出同一画面：原生家庭给你标准与勤勉，但命盘同时坚持 —— 你要暂时离开那套标准，长到能建立自己的一套。",
    ],
    plain: [
      "In everyday words: your parents gave you more good tools than you usually admit — and one or two beliefs you'll spend a decade unlearning. Distance is not disloyalty; the chart actually treats a stretch of independence as the way you honour them, not the way you betray them.",
      "说人话：父母给你的好东西比你平时承认的多，但也塞进了一两个让你花十年才卸下的信念。距离不是背叛 —— 命盘把「一段独立的时光」看作你回报他们的方式，而不是伤害他们的方式。",
    ],
    viz: "radar",
    details: [
      {
        label: ["What the family bond gives you", "原生家庭带给你的"],
        items: [
          ["A quiet, above-average sense of responsibility", "一份安静而高于常人的责任感"],
          ["Craft standards absorbed before you knew you had them", "尚未察觉时已内化的手艺标准"],
          ["A parent (often mother) who reads you accurately", "一位（多半是母亲）能读懂你的家人"],
          ["Financial or moral safety net most peers don't have", "同龄人少有的经济或道德底盘"],
        ],
      },
      {
        label: ["Watch-outs to guard", "需要注意的地方"],
        items: [
          ["Approval-seeking that outlives its usefulness", "早已失效、却仍在寻求父母认可的模式"],
          ["Confusing loyalty with living the same life", "把「忠诚」误当作「过一样的人生」"],
          [
            "Financial help with unspoken emotional strings attached",
            "带着未言明情感条件的经济支持",
          ],
          [
            "Ages 27–34: the classic separation-and-return arc",
            "27–34 岁：典型的「离开—回来」弧线",
          ],
        ],
      },
    ],
  },
  {
    key: "children",
    title: ["Children & Legacy", "子女与传承"],
    headline: ["Few in number, deep in influence", "数不多 —— 但份量都很重"],
    stars: 3,
    strengths: [0.7, 0.75, 0.7, 0.8],
    evidence: [
      {
        tradition: ["Astrology", "西方占星"],
        note: [
          "5th house lord aspecting Jupiter · one strong node",
          "第五宫主与木星有相 · 一个强节点",
        ],
      },
      {
        tradition: ["Jyotish", "印度占星"],
        note: [
          "5th Bhava clean; Putra karaka Jupiter dignified",
          "五宫清朗 · Putra Kāraka（木星）得地",
        ],
      },
      {
        tradition: ["BaZi", "八字"],
        note: [
          "Output star 食神 leaning bright; hour pillar carries the child signal",
          "食神偏亮 · 时柱承接子女信号",
        ],
      },
      {
        tradition: ["Zi Wei", "紫微"],
        note: ["子女宫 with 天同 / 天喜 · 化禄 in tow", "子女宫见天同/天喜 · 化禄相随"],
      },
    ],
    synthesis: [
      "The four systems agree on shape more than on count: a small circle of children — biological, adopted, mentored, or created — that carries an unusually direct imprint of your temperament. Quality of transmission, not quantity of offspring.",
      "四大体系在「形状」上一致，而非「数量」：一小圈子女 —— 生的、养的、教的、创造的 —— 承接你温度的印记异常直接。重传承的质，不重生育的量。",
    ],
    plain: [
      "In everyday words: if you have kids, you'll probably have fewer than you imagined and love them more fiercely than you planned. If you don't, the same energy will pour into students, protégés, or a body of work — the chart barely distinguishes between them. Whatever you raise carries your fingerprint on purpose.",
      "说人话：如果你有孩子，可能比你原先设想的少，但爱得比你计划的更凶。如果没有，同一份能量会流向学生、后辈、或一件作品 —— 命盘几乎不分辨这些。你养大的东西，都带着你有意留下的指纹。",
    ],
    viz: "zodiac",
    details: [
      {
        label: ["Likely shape of the bond", "子女缘的可能形状"],
        items: [
          [
            "1–2 biological or fully-committed children (rather than many)",
            "1–2 个亲生或全心投入的孩子（而非多数）",
          ],
          ["First-born tends to mirror your early-life temperament", "长子/女多半映照你早年的性情"],
          [
            "A late-arriving child or protégé who changes the chart",
            "较晚出现、却改写命盘的一个孩子或后辈",
          ],
          [
            "Teaching, mentoring, or authorship as parallel legacy",
            "教学 · 带徒 · 著述，作为并行的传承",
          ],
        ],
      },
      {
        label: ["Watch-outs to guard", "需要注意的地方"],
        items: [
          [
            "Repeating your parents' silences with your own kids",
            "把父母对你的沉默，重复给自己的孩子",
          ],
          ["Pushing children onto your unlived vocation", "把自己未走过的路，塞进孩子的人生"],
          ["Over-protection that starves their independence", "过度保护，反而饿死了他们的独立"],
          [
            "Delaying decisions about family past a workable window",
            "把是否要孩子的决定，拖过了可行的窗口",
          ],
        ],
      },
    ],
  },
  {
    key: "mission",
    title: ["Life Mission · Synthesis of all above", "人生使命 · 前文总结"],
    headline: [
      "To translate — between worlds, between people",
      "翻译者 — 在世界之间、在人与人之间",
    ],
    stars: 5,
    strengths: [0.95, 0.9, 0.85, 0.9],
    evidence: [
      {
        tradition: ["Astrology", "西方占星"],
        note: ["North Node in the 9th house", "北交点入第九宫"],
      },
      {
        tradition: ["Jyotish", "印度占星"],
        note: ["Rahu in the 9th Bhava · dharma", "Rahu 入第九宫 · 主 dharma"],
      },
      { tradition: ["BaZi", "八字"], note: ["Output star 伤官/食神 favoured", "食伤为喜"] },
      { tradition: ["Zi Wei", "紫微"], note: ["迁移宫 activated", "迁移宫动"] },
    ],
    synthesis: [
      "Placed at the end because it is the sum of everything above — character (warm outside, exacting inside), vocation (built to lead, not repeat), wealth (compounded, not sudden), love (depth over urgency), health (fire tempered by water), parents (rooted, then departing), children (few, deeply imprinted). Four traditions converge on one shape: your life reads as a bridge — translation, teaching, publishing, or institutions that carry meaning across contexts. Mission is not a seventh dimension — it is the seam that stitches the other seven together.",
      "放在最后，是因为它其实是前面所有模块的合鸣 —— 性格（外热内冷）、事业（为领导而生）、财富（复利型积累）、感情（深度胜过急促）、健康（火盛需水）、父母（扎根之后离开）、子女（少而深）。四大体系描出同一形状：你这一生是「桥」—— 翻译、教学、出版，或搭建把意义送过界的机构。使命不是第七个维度，而是把前面七个维度缝在一起的那道线。",
    ],
    plain: [
      "In everyday words: your job — whatever its title — will always secretly be to explain one world to another. East to West, expert to beginner, old to new. Read the previous sections together and you'll notice each of them (character, vocation, wealth, love, health, parents, children) is a different angle on the same act: carrying meaning across a gap. The moments you feel most alive are usually the moments you're translating something for someone.",
      "说人话：无论职位叫什么，你真正在做的一直是把一个世界解释给另一个世界听 —— 中西之间、专家与小白之间、旧与新之间。把前面几个板块（性格、事业、财富、感情、健康、父母、子女）串起来看，你会发现它们其实都是同一件事的不同侧面：把意义送过一道缝隙。你最有生命力的时刻，通常都是在为某人翻译某件事。",
    ],
    viz: "zodiac",
    details: [
      {
        label: ["Synthesis of the previous modules", "前文模块的合并总结"],
        items: [
          [
            "Character × Vocation → you lead by translating, not by commanding.",
            "性格 × 事业 → 你靠「翻译」领导，而非「命令」。",
          ],
          [
            "Wealth × Health → compounding money and compounding sleep obey the same law.",
            "财富 × 健康 → 复利的钱与复利的睡眠，遵循同一条法则。",
          ],
          [
            "Love × Parents × Children → the same lesson replays across three generations.",
            "感情 × 父母 × 子女 → 同一堂课，在三代人之间重播。",
          ],
          [
            "All seven → each one is a bridge; the mission is being the bridge-builder.",
            "七者合并 → 每个都是一座桥；使命就是「造桥的人」本身。",
          ],
        ],
      },
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
          [
            "Burnout from over-explaining yourself to skeptics",
            "把自己反复解释给不理解的人 —— 累到耗尽",
          ],
          [
            "Identity drift when the audience grows faster than you do",
            "受众成长快过自我，容易身份漂移",
          ],
          [
            "A midlife crossroads: prestige vs. mission — choose mission",
            "中年岔口：名声与使命之间 —— 选使命",
          ],
          [
            "Isolation in the year you break through — build a small trusted circle early",
            "突破的那一年容易孤立 —— 提早养一个小而可信的圈子",
          ],
        ],
      },
    ],
  },
];

function Stars({ n }: { n: number }) {
  return (
    <span className="rm-stars tracking-[0.3em] text-gold-dust" aria-label={`${n}/5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`rm-star ${i < n ? "rm-star--on" : "text-stone-warm/20"}`}
          style={i < n ? { animationDelay: `${i * 0.42}s` } : undefined}
        >
          ★
        </span>
      ))}
    </span>
  );
}

/**
 * Touch/coarse-pointer devices have no hover, so a module "wakes up" while it
 * sits in the middle of the viewport instead. Desktop keeps pure hover.
 */
function useCoarseActive<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof window === "undefined") return;
    const coarse = window.matchMedia("(hover: none), (pointer: coarse)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!coarse || reduced) return;
    const io = new IntersectionObserver(
      ([entry]) => setActive(entry.isIntersecting),
      { rootMargin: "-38% 0px -38% 0px", threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<T>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--rm-x", `${((e.clientX - r.left) / r.width) * 100}%`);
    el.style.setProperty("--rm-y", `${((e.clientY - r.top) / r.height) * 100}%`);
  }, []);

  return { ref, active, onPointerMove };
}


function ReportPage() {
  const search = Route.useSearch();
  const { lang, setLang, t } = useLang();
  const reportLang = search.lang ?? lang;
  const li = lang === "zh" ? 1 : 0;
  const [accOpen, setAccOpen] = useState(false);
  // Default to Sun (index 0) so the left panel shows its reading on load.
  const [selectedPlanet, setSelectedPlanet] = useState<number | null>(0);
  const [wheelSize, setWheelSize] = useState(360);
  const [zoomNatal, setZoomNatal] = useState(false);
  // Which dimension's detail modal is open (by key), or null.
  const [detailKey, setDetailKey] = useState<string | null>(null);

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

  // Personalised AI report — grounded in this specific chart.
  // Persistence-first flow:
  //   1. Require an authenticated + email-verified session (else save
  //      draft + redirect to /auth).
  //   2. Ensure a `charts` row for this normalized birth input.
  //   3. Look up the persisted `reports` row for this chart+version.
  //      Completed → hydrate the report, never call the AI.
  //      Pending  → poll until it flips (another tab is generating).
  //      Missing  → atomically claim it via `beginReport`; only the
  //                 caller that gets `didStart` runs the AI, then
  //                 commits via `saveReport` / `failReport`.
  const seed = buildReportSeed(search);
  const [ai, setAi] = useState<ReportAI | null>(null);
  const [aiState, setAiState] = useState<
    "idle" | "loading" | "ready" | "error" | "needs-auth" | "needs-verify"
  >("idle");
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiProgress, setAiProgress] = useState({ done: 0, total: 0 });
  const [reportChartId, setReportChartId] = useState<string | null>(null);
  const latestReqRef = useRef(0);
  const { updateReadingAI } = useAccount();
  const navigate = useNavigate();

  const runReport = useCallback(() => {
    if (!search.date) return;
    const fingerprint = buildReportFingerprint(search, reportLang);
    const reqId = ++latestReqRef.current;
    const stale = () => reqId !== latestReqRef.current;

    const totalSteps = DIM_KEYS.length + 1;
    setAiState("loading");
    setAiError(null);
    setAiProgress({ done: 0, total: totalSteps });

    const draftKey = "lod.report-draft";
    const currentUrl =
      typeof window !== "undefined" ? window.location.pathname + window.location.search : "/report";

    (async () => {
      // 1. Session check.
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        try {
          localStorage.setItem(draftKey, JSON.stringify(search));
        } catch {
          /* ignore */
        }
        setAiState("needs-auth");
        return;
      }

      // 2. Ensure chart row (also validates hash server-side).
      let chartId: string;
      try {
        const canonical = buildCanonicalChartInput(search, reportLang);
        const res = await ensureChart({
          data: {
            ...canonical,
            input_snapshot: { ...canonical.input_snapshot },
          },
        });
        chartId = res.chartId;
        setReportChartId(chartId);
      } catch {
        if (stale()) return;
        setAiError("chart_save_failed");
        setAiState("error");
        return;
      }

      // 2b. Persist ownership metadata coming from the ritual.
      // Only assigns when the URL carries `role` (i.e. this chart was
      // just created via /ritual). Never overrides an existing primary.
      if (search.role === "self" || search.role === "other") {
        try {
          await assignChartOwnership({
            data: {
              chartId,
              role: search.role,
              relationshipLabel: search.relationshipLabel || undefined,
              autoPromoteIfNoPrimary: search.role === "self",
              primaryIntent:
                search.primaryIntent === "replace" || search.primaryIntent === "keep"
                  ? search.primaryIntent
                  : undefined,
            },
          });
        } catch {
          /* non-fatal: chart still exists; user can adjust in /me/profile */
        }
      }


      // Migrate a temporary/legacy readingId in the URL to the persisted
      // chart UUID that actually belongs to this user. Only rewrite when
      // (a) the URL param is present AND (b) it is not already a UUID.
      // We NEVER match legacy local links by name; the DB row here was
      // selected by normalized_input_hash so ownership is guaranteed.
      try {
        const rid = (search.readingId ?? "").trim();
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rid);
        if (rid && !isUuid && rid !== chartId) {
          navigate({
            to: "/report",
            replace: true,
            search: ((s: SearchParams) => ({ ...s, readingId: chartId })) as never,
          });
        }
      } catch {
        /* best-effort URL sync */
      }

      // 3. Look up existing report.
      try {
        const saved = await getSavedReport({
          data: { chartId, kind: "report", reportVersion: REPORT_AI_VERSION },
        });
        if (stale()) return;
        if (saved?.status === "completed" && saved.report_json) {
          const finalReport = saved.report_json as unknown as ReportAI;
          setAi(finalReport);
          setAiState("ready");
          updateReadingAI(fingerprint, {
            aiReport: finalReport,
            aiReportVersion: REPORT_AI_VERSION,
            fingerprint,
          });
          return;
        }
      } catch {
        /* fall through to begin */
      }

      // 4. Atomic claim.
      let claim: Awaited<ReturnType<typeof beginReport>>;
      try {
        claim = await beginReport({
          data: {
            chartId,
            kind: "report",
            reportVersion: REPORT_AI_VERSION,
            input_snapshot: { ...search, lang: reportLang },
          },
        });
      } catch (err) {
        if (stale()) return;
        const msg = (err as Error)?.message ?? "";
        if (msg.includes("email_not_verified")) {
          setAiState("needs-verify");
        } else {
          setAiError("begin_failed");
          setAiState("error");
        }
        return;
      }
      if (stale()) return;

      if (claim.status === "completed" && claim.report_json) {
        const finalReport = claim.report_json as unknown as ReportAI;
        setAi(finalReport);
        setAiState("ready");
        return;
      }

      if (!claim.didStart) {
        // Another tab / earlier request is generating. Poll for it.
        const started = Date.now();
        while (!stale() && Date.now() - started < 180_000) {
          await new Promise((r) => setTimeout(r, 2500));
          if (stale()) return;
          const poll = await getSavedReport({
            data: { chartId, kind: "report", reportVersion: REPORT_AI_VERSION },
          });
          if (poll?.status === "completed" && poll.report_json) {
            if (stale()) return;
            const finalReport = poll.report_json as unknown as ReportAI;
            setAi(finalReport);
            setAiState("ready");
            return;
          }
          if (poll?.status === "failed") break;
        }
        if (stale()) return;
        setAiError("timeout");
        setAiState("error");
        return;
      }

      // 5. We own this generation. Run the streaming pieces.
      const req = buildReportRequest(search, reportLang);
      const acc: { summary: string; dimensions: ReportDimensionAI[] } = {
        summary: "",
        dimensions: [],
      };
      setAi({ summary: "", dimensions: [] });

      let firstError: unknown = null;
      const bump = () => {
        if (stale()) return;
        setAiProgress((p) => ({ done: Math.min(p.total, p.done + 1), total: p.total }));
      };

      const summaryPromise = generateReportSummary({ data: req })
        .then((res) => {
          if (stale()) return;
          acc.summary = res.summary;
          setAi((prev) => ({ summary: res.summary, dimensions: prev?.dimensions ?? [] }));
        })
        .catch((err) => {
          firstError = firstError ?? err;
        })
        .finally(bump);

      const dimPromises = DIM_KEYS.map((k) =>
        generateReportDimension({ data: { ...req, key: k } })
          .then((dim) => {
            if (stale()) return;
            acc.dimensions.push(dim);
            const ordered = DIM_KEYS.map((key) => acc.dimensions.find((d) => d.key === key)).filter(
              (d): d is ReportDimensionAI => !!d,
            );
            setAi((prev) => ({ summary: prev?.summary ?? acc.summary, dimensions: ordered }));
          })
          .catch((err) => {
            firstError = firstError ?? err;
          })
          .finally(bump),
      );

      await Promise.all([summaryPromise, ...dimPromises]);
      if (stale()) return;

      if (acc.dimensions.length === 0 && !acc.summary) {
        await failReport({
          data: {
            reportId: claim.reportId,
            error_message: (firstError as Error)?.message?.slice(0, 300) ?? "unknown",
          },
        }).catch(() => {});
        setAiError((firstError as Error)?.message ?? "unknown");
        setAiState("error");
        return;
      }

      const finalDims: ReportDimensionAI[] = DIM_KEYS.map(
        (k) =>
          acc.dimensions.find((d) => d.key === k) ?? {
            key: k,
            headline: "",
            evidence: [],
            synthesis: "",
            plain: "",
            details: [],
          },
      );
      const finalReport: ReportAI = { summary: acc.summary, dimensions: finalDims };
      setAi(finalReport);
      setAiState("ready");

      // Commit to DB (source of truth) + mirror locally for offline resilience.
      try {
        await saveReport({
          data: {
            reportId: claim.reportId,
            report_json: finalReport as never,
            model: "google/gemini-2.5-flash",
            provider: "lovable-ai-gateway",
          },
        });
      } catch {
        /* keep local mirror */
      }
      updateReadingAI(fingerprint, {
        aiReport: finalReport,
        aiReportVersion: REPORT_AI_VERSION,
        fingerprint,
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, reportLang, search.readingId]);

  useEffect(() => {
    runReport();
  }, [runReport]);

  // Redirect unauthenticated users to sign in, preserving their input as a draft.
  useEffect(() => {
    if (aiState !== "needs-auth") return;
    navigate({
      to: "/auth",
      search: {
        mode: "login",
        redirect:
          typeof window !== "undefined"
            ? window.location.pathname + window.location.search
            : "/report",
      } as never,
    });
  }, [aiState, navigate]);

  const isAwaitingPersonalized = !!search.date && aiState === "loading" && !ai?.summary;
  const summaryText = textFromUnknown(ai?.summary, lang);
  const summary = summaryText
    ? summaryText
    : isAwaitingPersonalized
      ? lang === "zh"
        ? "智者正在依据你的出生日期、时辰、农历、八字与行星落位生成专属解读……"
        : "The elder is generating a personal reading from your birth date, time, lunar conversion, BaZi pillars and planetary placements…"
      : lang === "zh"
        ? "你的人生更像探险者的图谱，而非追随者的轨迹 —— 一张反复回到「志业、意义与再次选择的勇气」的星图。"
        : "Your life is written more as an explorer's than a follower's — a chart that repeatedly returns to the questions of vocation, meaning and the courage to choose again.";

  // Calculation snapshot: real, verifiable values from the four traditions.
  // Vedic and Zi Wei do not have real calculators yet — those evidence rows
  // are labelled "计算模块尚未完成 / Calculation module not yet complete" so
  // we never ship a hard-coded template line that could contradict the
  // actual chart (e.g. "太阳落火象" for a Scorpio Sun).
  const snapshot: CalculationSnapshot = useMemo(
    () =>
      buildCalculationSnapshot({
        date: search.date,
        time: search.time,
        place: search.place,
        lang: reportLang,
        gender: search.gender ?? null,
      }),
    [search.date, search.time, search.place, search.gender, reportLang],
  );

  const snapshotEvidence = useMemo(() => {
    const sun = snapshot.western.sun;
    const bazi = snapshot.bazi;
    const pendingZh = "计算模块尚未完成";
    const pendingEn = "Calculation module not yet complete";
    const astro: [string, string] = sun
      ? [
          `Sun in ${sun.sign_en} · ${ELEMENT_LABEL_EN[sun.element]} element`,
          `太阳落${sun.sign_zh} · ${ELEMENT_LABEL_ZH[sun.element]}`,
        ]
      : [pendingEn, pendingZh];
    const baziLine: [string, string] =
      bazi.day_master && bazi.pillars
        ? [
            `Day-master ${bazi.day_master.stem} (${bazi.day_master.element}); pillars ${bazi.pillars.year} ${bazi.pillars.month} ${bazi.pillars.day}${bazi.pillars.hour ? " " + bazi.pillars.hour : ""}`,
            `日主 ${bazi.day_master.stem}（${bazi.day_master.element}）· 四柱 ${bazi.pillars.year} ${bazi.pillars.month} ${bazi.pillars.day}${bazi.pillars.hour ? " " + bazi.pillars.hour : ""}`,
          ]
        : [pendingEn, pendingZh];
    const v = snapshot.vedic.chart;
    const vedic: [string, string] = v
      ? [
          `Moon in ${v.moon.nakshatra_en} pada ${v.moon.pada}; Vimshottari dasa of ${v.vimshottari[0]?.lord ?? v.moon.lord}${v.ascendant ? `; sidereal Ascendant ${v.ascendant.sign_en}` : ""}`,
          `月亮 ${v.moon.nakshatra_zh}·${v.moon.pada}分位；大运起始 ${v.vimshottari[0]?.lord ?? v.moon.lord}${v.ascendant ? `；恒星上升 ${v.ascendant.sign_zh}` : ""}`,
        ]
      : [pendingEn, pendingZh];
    const z = snapshot.ziwei.chart;
    const ziwei: [string, string] = z
      ? (() => {
          const stars =
            z.palaces[z.soul_palace_index]?.major_stars.map((s) => s.name).join("·") || "空宫";
          return [
            `Soul palace ${stars}; body star ${z.body}; ${z.five_elements_class}`,
            `命宫 ${stars}·身宫主星 ${z.body}·${z.five_elements_class}`,
          ];
        })()
      : [pendingEn, pendingZh];
    return { astro, baziLine, vedic, ziwei };
  }, [snapshot]);

  // Merge AI content into the base dimensions (viz / stars / strengths keep
  // their fallback shape; text is overridden per-visitor). Fallback evidence
  // is REPLACED with real snapshot values, so nothing rendered before the
  // AI hydrates can contradict the visitor's actual chart.
  const aiByKey = useMemo(() => {
    const m = new Map<string, ReportAI["dimensions"][number]>();
    ai?.dimensions.forEach((d) => {
      if (d && typeof d.key === "string") m.set(d.key, d);
    });
    return m;
  }, [ai]);
  const displayed = useMemo(
    () =>
      dimensions.map((d) => {
        const p = aiByKey.get(d.key);
        // Rebuild the evidence bar from real snapshot values so the
        // fallback template never claims the wrong Sun / Day-master.
        const fallbackEvidence: Dimension["evidence"] = [
          { tradition: ["Astrology", "西方占星"], note: snapshotEvidence.astro },
          { tradition: ["Jyotish", "印度占星"], note: snapshotEvidence.vedic },
          { tradition: ["BaZi", "八字"], note: snapshotEvidence.baziLine },
          { tradition: ["Zi Wei", "紫微"], note: snapshotEvidence.ziwei },
        ];
        if (!p) return { ...d, evidence: fallbackEvidence };
        const pAny = p as unknown as Record<string, unknown>;
        const headline = textFromUnknown(pAny.headline, lang);
        const synthesis = textFromUnknown(pAny.synthesis, lang);
        const plain = textFromUnknown(pAny.plain, lang);
        const evidence = Array.isArray(pAny.evidence) ? pAny.evidence : [];
        const details = Array.isArray(pAny.details) ? pAny.details : [];
        return {
          ...d,
          headline: [headline || d.headline[0], headline || d.headline[1]] as [string, string],
          synthesis: [synthesis || d.synthesis[0], synthesis || d.synthesis[1]] as [string, string],
          plain: [plain || d.plain[0], plain || d.plain[1]] as [string, string],
          evidence:
            evidence.length >= 4
              ? evidence.slice(0, 4).map((e) => {
                  const er = e as Record<string, unknown>;
                  const tradition = textFromUnknown(er.tradition, lang);
                  const note = textFromUnknown(er.note, lang);
                  return {
                    tradition: [tradition, tradition] as [string, string],
                    note: [note, note] as [string, string],
                  };
                })
              : fallbackEvidence,
          details:
            details.length > 0
              ? details.map((b) => {
                  const br = b as Record<string, unknown>;
                  const label = textFromUnknown(br.label, lang);
                  return {
                    label: [label, label] as [string, string],
                    items: textArrayFromUnknown(br.items, lang).map(
                      (it) => [it, it] as [string, string],
                    ),
                  };
                })
              : d.details,
        };
      }),
    [aiByKey, snapshotEvidence, lang],
  );

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
      {(() => {
        const fingerprint = search.date ? buildReportFingerprint(search, reportLang) : undefined;
        const savedReading = undefined as
          | {
              aiReport?: ReportAI;
              aiReportVersion?: string;
              aiOutlook?: unknown;
              aiOutlookVersion?: string;
            }
          | undefined;
        return (
          <SaveReadingBar
            reading={{
              name: search.name,
              date: search.date,
              time: search.time,
              place: search.place,
              lang: reportLang,
            }}
            onOpenAccount={() => setAccOpen(true)}
            fingerprint={fingerprint}
            aiReport={ai ?? savedReading?.aiReport}
            aiReportVersion={ai ? REPORT_AI_VERSION : savedReading?.aiReportVersion}
            aiOutlook={undefined}
            aiOutlookVersion={undefined}
          />
        );
      })()}

      <AccountModal open={accOpen} onClose={() => setAccOpen(false)} />

      {(() => {
        const li = lang === "zh" ? 1 : 0;
        const toc: TocItem[] = [
          {
            id: "natal-chart",
            label: lang === "zh" ? "你的命盘" : "Your natal chart",
            hint: lang === "zh" ? "九颗行星 · 十二宫" : "Nine planets · twelve houses",
          },
          ...displayed.map((d) => ({
            id: d.key,
            label: d.title[li],
            hint: d.headline[li],
          })),
        ];
        return <ReportToc items={toc} lang={lang} />;
      })()}

      <section id="natal-chart" className="mx-auto mb-24 max-w-6xl scroll-mt-[calc(var(--site-nav-height,96px)+72px)] px-4 sm:px-6">
        <div className="glass-card rounded-3xl p-4 sm:p-8 md:p-12">
          {/* Intro block — always full width so mobile sees context first */}
          <div className="mb-6 min-w-0 lg:mb-8">
            <p className="mb-3 text-[10px] uppercase tracking-[0.4em] text-gold-dust">
              {lang === "zh" ? "你的命盘" : "Your natal chart"}
            </p>
            <h2 className="mb-4 font-serif text-2xl italic text-stone-warm sm:text-3xl md:text-4xl">
              {lang === "zh"
                ? "九颗行星 · 落在你专属的十二宫"
                : "Nine planets · falling in your own twelve houses"}
            </h2>
            <p className="reading-copy mb-4 text-sm leading-relaxed text-stone-warm/60">
              {lang === "zh"
                ? "这是一张真实推算的西方回归黄道盘（Tropical Zodiac）—— 以 J2000.0 为基准，按平均黄经公式将七颗行星与上升 / 天顶落入你出生时刻真正对应的星座；相位则按行星间黄经差自动识别合、六分、四分、三分与对分。点击行星查看落位与主要相位；点击星座查看它承接的行星。"
                : "A real tropical-zodiac natal wheel: seven planets plus Ascendant / Midheaven are placed by mean-longitude formulas referenced to J2000.0, using the exact moment you were born. Aspects (conjunction, sextile, square, trine, opposition) are detected automatically from the longitude differences. Tap a planet to reveal its sign and major aspects; tap a sign to see which planets it holds."}
            </p>
            <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.28em] text-stone-warm/50">
              <span className="rounded-full border border-white/10 px-3 py-1">☉ ☽ ☿ ♀ ♂ ♃ ♄</span>
              <span className="rounded-full border border-white/10 px-3 py-1">
                Ⓐ {lang === "zh" ? "上升" : "Asc"}
              </span>
              <span className="rounded-full border border-white/10 px-3 py-1">
                Ⓜ {lang === "zh" ? "天顶" : "MC"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-stretch lg:gap-10">
            {/* Left: planet reading panel — on mobile it comes after the wheel */}
            <div className="order-2 flex min-w-0 flex-col lg:order-1 lg:h-full">
              <div className="flex min-w-0 flex-1 flex-col">
                <PlanetReadingPanel
                  lang={lang}
                  seed={`${search.name ?? ""}|${search.date ?? ""}|${search.time ?? ""}|${search.place ?? ""}`}
                  planetIdx={selectedPlanet}
                  onClear={() => setSelectedPlanet(null)}
                />
              </div>
            </div>

            {/* Right: four-system chart + core placements */}
            <div className="order-1 flex min-w-0 flex-col items-center gap-4 lg:order-2">
              <div className="relative w-full text-stone-warm/40">
                <FourSystemsChart
                  snapshot={snapshot}
                  lang={lang}
                  seed={`${search.name ?? ""}|${search.date ?? ""}|${search.time ?? ""}|${search.place ?? ""}`}
                  size={wheelSize}
                  selectedPlanet={selectedPlanet}
                  onSelectPlanet={setSelectedPlanet}
                />
                <button
                  onClick={() => setZoomNatal(true)}
                  className="absolute bottom-0 right-0 z-10 rounded-full border border-gold-dust/30 bg-obsidian/60 px-2.5 py-1 text-[10px] uppercase tracking-[0.28em] text-gold-dust/80 backdrop-blur transition-colors hover:border-gold-light hover:text-gold-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-light sm:px-3 sm:py-1.5"
                  aria-label={lang === "zh" ? "放大查看星盘" : "Enlarge chart"}
                >
                  {lang === "zh" ? "⤢ 放大" : "⤢ Enlarge"}
                </button>
              </div>


              <div className="flex w-full flex-col">
                <ChartFactsCard
                  lang={lang}
                  seed={`${search.name ?? ""}|${search.date ?? ""}|${search.time ?? ""}|${search.place ?? ""}`}
                  onPickPlanet={setSelectedPlanet}
                />
              </div>
            </div>
          </div>
        </div>

        <ChartZoomModal
          open={zoomNatal}
          onClose={() => setZoomNatal(false)}
          title={lang === "zh" ? "命盘 · 四大体系" : "Charts · four systems"}
          subtitle={
            lang === "zh" ? "西方星盘 · 印度曼陀罗 · 四柱五行 · 紫微十二宫" : "Western · Vedic · BaZi · Zi Wei"
          }
        >
          <div className="flex flex-col items-center gap-4">
            <FourSystemsChart
              snapshot={snapshot}
              lang={lang}
              seed={`${search.name ?? ""}|${search.date ?? ""}|${search.time ?? ""}|${search.place ?? ""}`}
              size={Math.min(560, typeof window !== "undefined" ? window.innerWidth - 96 : 560)}
              selectedPlanet={selectedPlanet}
              onSelectPlanet={setSelectedPlanet}
            />
            <p className="max-w-2xl text-center text-xs leading-relaxed text-stone-warm/60">
              {lang === "zh"
                ? "点击行星查看落位与相位；四个尖轴宫（1/4/7/10）以金色标示。上升与天顶因不含出生地经度，属近似值。"
                : "Tap a planet for placement & aspects. The four angular houses (1/4/7/10) are highlighted in gold. Ascendant / MC are approximate — birth-place longitude is not provided in the seed."}
            </p>
          </div>
        </ChartZoomModal>
      </section>

      {/* Dimensions */}
      <section className="mx-auto max-w-5xl space-y-10 px-4 sm:px-6 md:px-12">
        {search.date && aiState === "ready" && (search.role === "self" || search.role === "other") && (
          <div
            data-testid="report-completion-cta"
            className="glass-card flex flex-col gap-3 rounded-2xl border border-gold-dust/30 bg-black/30 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="text-sm text-stone-warm/80">
              {search.role === "other"
                ? lang === "zh"
                  ? `已作为「${search.relationshipLabel || "他人命盘"}」保存到你的个人书架。`
                  : `Saved to your Personal Library as "${search.relationshipLabel || "someone else"}".`
                : search.primaryIntent === "keep"
                  ? lang === "zh"
                    ? "已另存为「我的其他命盘」（未改动主命盘）。"
                    : "Saved as one of your other charts. Your primary chart is unchanged."
                  : lang === "zh"
                    ? "已设为你的主命盘。"
                    : "Set as your primary chart."}
            </div>
            <div className="flex flex-wrap gap-2">
              {search.role === "other" ? (
                <Link
                  to="/me/friends"
                  className="min-h-11 rounded-full border border-gold-dust/50 bg-gold-dust/10 px-5 py-2 text-[11px] uppercase tracking-[0.24em] text-gold-dust hover:bg-gold-dust/20"
                >
                  {lang === "zh" ? "去关系与适配" : "Relationships"}
                </Link>
              ) : search.primaryIntent === "keep" ? (
                <Link
                  to="/me/profile"
                  className="min-h-11 rounded-full border border-gold-dust/50 bg-gold-dust/10 px-5 py-2 text-[11px] uppercase tracking-[0.24em] text-gold-dust hover:bg-gold-dust/20"
                >
                  {lang === "zh" ? "去个人书架" : "Personal Library"}
                </Link>
              ) : (
                <Link
                  to="/me/home"
                  className="min-h-11 rounded-full border border-gold-dust/50 bg-gold-dust/10 px-5 py-2 text-[11px] uppercase tracking-[0.24em] text-gold-dust hover:bg-gold-dust/20"
                >
                  {lang === "zh" ? "去书架主页" : "Library Home"}
                </Link>
              )}
            </div>
          </div>
        )}
        {search.date && (aiState === "loading" || aiState === "error") && (

          <div
            className={`glass-card flex flex-col gap-3 rounded-2xl px-5 py-3 text-[11px] uppercase tracking-[0.28em] sm:flex-row sm:items-center sm:justify-between ${
              aiState === "error" ? "text-red-300/80" : "text-gold-dust/80"
            }`}
          >
            <span>
              {aiState === "loading"
                ? lang === "zh"
                  ? `智者正在逐维度写下你的命盘 · ${aiProgress.done}/${aiProgress.total}`
                  : `The elder is writing your chart, one dimension at a time · ${aiProgress.done}/${aiProgress.total}`
                : lang === "zh"
                  ? `个性化解读暂时无法生成（${aiError ?? "unknown"}）—— 先显示通用模板。`
                  : `Personalised reading unavailable (${aiError ?? "unknown"}) — showing template.`}
            </span>
            {aiState === "loading" && (
              <span className="size-2 animate-pulse rounded-full bg-gold-dust" />
            )}
            {aiState === "error" && (
              <button
                type="button"
                onClick={() => runReport()}
                className="flex-none rounded-full border border-red-300/40 px-4 py-1.5 text-[10px] tracking-[0.28em] text-red-200 transition-colors hover:bg-red-300/10"
              >
                {lang === "zh" ? "重试" : "Retry"}
              </button>
            )}
          </div>
        )}
        {displayed.map((d, idx) => {
          const arrived = aiByKey.has(d.key);
          const pending = !!search.date && aiState === "loading" && !arrived;
          return (
            <DimensionCardShell key={d.key} id={d.key} idx={idx} pending={pending}>

              <div className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-6">
                <div className="flex min-w-0 items-start gap-4">
                  <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-gold-dust/25 bg-gradient-to-br from-gold-dust/[0.12] to-transparent text-gold-light shadow-[0_0_24px_-12px_hsl(45_70%_60%/0.5)]">
                    {(() => {
                      const Icon = DIM_ICONS[d.key] ?? Sparkles;
                      return <Icon size={22} strokeWidth={1.5} />;
                    })()}
                  </div>
                  <div className="min-w-0">
                    <p className="mb-2 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
                      <span>
                        {String(idx + 1).padStart(2, "0")} · {d.title[li]}
                      </span>
                      {pending && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-gold-dust/30 px-2 py-0.5 text-[9px] tracking-[0.28em] text-gold-dust/80">
                          <span className="size-1.5 animate-pulse rounded-full bg-gold-dust" />
                          {lang === "zh" ? "生成中" : "Writing"}
                        </span>
                      )}
                    </p>
                    <h2 className="font-serif text-2xl italic text-stone-warm md:text-3xl">
                      {d.headline[li]}
                    </h2>
                  </div>
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
                    {d.evidence.map((e) => {
                      const TIcon = traditionIcon(e.tradition[0]);
                      return (
                        <li key={e.tradition[0]} className="border-l border-gold-dust/30 pl-4">
                          <p className="mb-1 flex items-center gap-2 font-serif text-gold-light">
                            <TIcon size={13} strokeWidth={1.5} className="opacity-80" />
                            <span>{e.tradition[li]}</span>
                          </p>
                          <p className="text-stone-warm/60">{e.note[li]}</p>
                        </li>
                      );
                    })}
                  </ul>

                  <p className="mb-3 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
                    {t.strength_map}
                  </p>
                  <div className="text-stone-warm/50">
                    {d.viz === "elements" && d.elementStrengths ? (
                      <FiveElements strengths={d.elementStrengths} lang={lang} size={240} />
                    ) : (
                      <StrengthRadar values={d.strengths} labels={t.four_traditions} size={220} />
                    )}
                  </div>
                </div>

                {/* Right: synthesis + plain-language */}
                <div className="lg:col-span-3">
                  <p className="mb-4 flex items-center gap-2 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
                    <span
                      className="inline-block size-1.5 rotate-45 bg-gold-dust"
                      aria-hidden="true"
                    />
                    {t.synthesis}
                  </p>
                  <div className="reading-copy mb-8 space-y-4 text-base leading-relaxed text-stone-warm/80">
                    {splitParagraphs(d.synthesis[li]).map((para, i) => (
                      <p key={i}>{para}</p>
                    ))}
                  </div>

                  <div className="rounded-2xl border border-gold-dust/25 bg-gradient-to-br from-gold-dust/[0.08] to-gold-dust/[0.02] p-5 md:p-6">
                    <p className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.32em] text-gold-light">
                      <span className="size-1.5 rounded-full bg-gold-dust" />
                      {t.in_plain_words}
                    </p>
                    <div className="reading-copy space-y-3 font-serif text-[15px] italic leading-[1.7] text-stone-warm/90 md:text-base">
                      {splitParagraphs(d.plain[li]).map((para, i) => (
                        <p key={i}>{para}</p>
                      ))}
                    </div>
                  </div>

                  {d.details && d.details.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setDetailKey(d.key)}
                      className="group mt-6 flex w-full items-center justify-between gap-3 rounded-2xl border border-gold-dust/25 bg-gradient-to-br from-gold-dust/[0.06] to-transparent px-5 py-4 text-left transition-all hover:border-gold-dust/50 hover:from-gold-dust/[0.1] hover:shadow-[0_10px_40px_-20px_hsl(45_70%_60%/0.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-light"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-gold-dust/30 bg-obsidian/60 text-gold-light">
                          <Maximize2 size={14} strokeWidth={1.6} />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[10px] uppercase tracking-[0.32em] text-gold-dust/80">
                            {lang === "zh" ? "查看四体系详细佐证" : "View four-system evidence"}
                          </span>
                          <span className="mt-1 block truncate font-serif text-sm italic text-stone-warm/75">
                            {lang === "zh"
                              ? "通道 · 警惕 · 落位数据 · 图示"
                              : "Channels · cautions · placements · charts"}
                          </span>
                        </span>
                      </span>
                      <span className="flex items-center gap-2 text-gold-dust/70 transition-transform group-hover:translate-x-1">
                        {/* Preview dots — one per detail block */}
                        <span className="hidden gap-1 sm:flex">
                          {d.details.map((_, i) => (
                            <span
                              key={i}
                              className={`size-1.5 rounded-full ${
                                i === 0 ? "bg-emerald-300/70" : "bg-amber-300/70"
                              }`}
                            />
                          ))}
                        </span>
                        <ChevronRight size={16} />
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </motion.article>
          );
        })}
      </section>

      {/* Life Timeline — 大运 */}
      <div id="life-timeline" className="mt-24 scroll-mt-[calc(var(--site-nav-height,96px)+72px)]">
        <LifeTimeline birthISO={search.date} search={search} chartId={reportChartId} />
      </div>

      {/* Key life events verification */}
      <div id="key-events" className="scroll-mt-[calc(var(--site-nav-height,96px)+72px)]">
        <KeyEventsVerification birthISO={search.date} search={search} />
      </div>

      {/* Tarot — three cards as a second witness */}
      <div id="tarot" className="scroll-mt-[calc(var(--site-nav-height,96px)+72px)]">
        <TarotDraw />
      </div>


      {/* Membership tiers — Oracle unlocks Synastry + 90-day windows + Future watchlist */}
      <MembershipSection birthISO={search.date} search={search} />

      {/* Outro */}
      <div className="mx-auto mt-16 max-w-3xl px-6 text-center print:hidden">
        <p className="mb-6 text-[10px] uppercase tracking-[0.42em] text-gold-dust">
          {t.note_on_fate}
        </p>
        <p className="mb-12 font-serif text-2xl italic leading-relaxed text-stone-warm/70">
          {t.note_body_1} <span className="text-gold-light">{t.note_body_2}</span>
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

      {/* Dimension detail modal — richer four-system evidence + channels / cautions */}
      <DimensionDetailModal
        dimension={displayed.find((x) => x.key === detailKey) ?? null}
        open={detailKey !== null}
        onClose={() => setDetailKey(null)}
        lang={lang}
        t={t}
      />

      {/* Post-ritual priority preview — one-shot per report generation */}
      {isConcernKey(search.concern) ? (
        <PriorityPreviewModal
          concern={search.concern}
          lang={lang}
          displayed={displayed}
          reportKey={
            aiState === "ready"
              ? `${reportChartId ?? search.readingId ?? seed}::${REPORT_AI_VERSION}`
              : null
          }
          ready={aiState === "ready" && !!ai}
        />
      ) : null}

      {/* Floating sage companion is provided globally in __root.tsx */}
    </div>
  );
}


function DimensionDetailModal({
  dimension,
  open,
  onClose,
  lang,
  t,
}: {
  dimension: Dimension | null;
  open: boolean;
  onClose: () => void;
  lang: "en" | "zh";
  t: ReturnType<typeof useLang>["t"];
}) {
  const li = lang === "zh" ? 1 : 0;
  const d = dimension;
  const DIcon = d ? (DIM_ICONS[d.key] ?? Sparkles) : Sparkles;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="fixed inset-x-0 bottom-0 top-2 left-0 right-0 grid h-[calc(100dvh-0.5rem)] max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 grid-rows-[auto_1fr] gap-0 overflow-hidden rounded-b-none rounded-t-3xl border border-gold-dust/25 bg-obsidian/98 p-0 backdrop-blur-xl sm:inset-auto sm:left-[50%] sm:top-[50%] sm:h-auto sm:max-h-[92vh] sm:w-[96vw] sm:max-w-4xl sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-3xl [&>button]:right-3 [&>button]:top-3 [&>button]:z-30 [&>button]:grid [&>button]:size-11 [&>button]:place-items-center [&>button]:rounded-full [&>button]:border [&>button]:border-gold-dust/30 [&>button]:bg-obsidian/70 [&>button]:text-gold-light [&>button]:opacity-100 sm:[&>button]:right-4 sm:[&>button]:top-4">
        {d && (
          <div
            className="relative row-span-2 grid grid-rows-[auto_1fr] overflow-hidden"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            {/* Ambient background */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 -z-0 opacity-70"
              style={{
                background:
                  "radial-gradient(ellipse 60% 40% at 20% 0%, color-mix(in oklab, var(--gold-dust) 12%, transparent) 0%, transparent 70%), radial-gradient(ellipse 60% 40% at 100% 100%, color-mix(in oklab, var(--nebula-purple) 18%, transparent) 0%, transparent 70%)",
              }}
            />

            {/* Sticky Header */}
            <div className="sticky top-0 z-20 flex items-start gap-3 border-b border-white/10 bg-obsidian/95 px-5 py-4 pr-14 backdrop-blur-md sm:gap-4 sm:px-10 sm:py-7">
              <div className="grid size-11 shrink-0 place-items-center rounded-2xl border border-gold-dust/30 bg-gradient-to-br from-gold-dust/[0.14] to-transparent text-gold-light sm:size-14">
                <DIcon size={22} strokeWidth={1.5} />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle asChild>
                  <p className="mb-1 text-[10px] uppercase tracking-[0.28em] text-gold-dust/80 sm:tracking-[0.32em]">
                    {d.title[li]} · {lang === "zh" ? "详细佐证" : "detailed evidence"}
                  </p>
                </DialogTitle>
                <DialogDescription asChild>
                  <h3 className="font-serif text-lg italic leading-snug text-stone-warm sm:text-2xl">
                    {d.headline[li]}
                  </h3>
                </DialogDescription>
              </div>
            </div>

            {/* Scrollable body */}
            <div
              className="relative overflow-y-auto overflow-x-hidden"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              <div className="relative grid gap-8 px-6 py-7 sm:px-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
                {/* Left column — data visualisation */}
                <div className="flex flex-col gap-6">
                  {/* Four-system strength bars */}
                  <div>
                    <p className="mb-3 text-[10px] uppercase tracking-[0.32em] text-gold-dust/80">
                      {lang === "zh" ? "四大体系强度" : "Four-system strength"}
                    </p>
                    <ul className="space-y-2.5">
                      {t.four_traditions.map((label, i) => {
                        const v = d.strengths[i];
                        const TIcon = traditionIcon(d.evidence[i]?.tradition[0] ?? label);
                        return (
                          <li key={label} className="flex items-center gap-3">
                            <span className="grid size-6 shrink-0 place-items-center rounded-md border border-gold-dust/25 text-gold-light">
                              <TIcon size={11} strokeWidth={1.6} />
                            </span>
                            <span className="w-20 shrink-0 text-[10px] uppercase tracking-[0.22em] text-stone-warm/60">
                              {label}
                            </span>
                            <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                              <motion.span
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.round(v * 100)}%` }}
                                transition={{ duration: 0.9, ease: [0.32, 0.72, 0, 1] }}
                                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-gold-dust/70 to-gold-light"
                              />
                            </span>
                            <span className="w-8 shrink-0 text-right font-serif text-[11px] italic text-gold-light">
                              {Math.round(v * 100)}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  {/* Evidence details from each tradition */}
                  <div>
                    <p className="mb-3 text-[10px] uppercase tracking-[0.32em] text-gold-dust/80">
                      {lang === "zh" ? "各体系落位" : "Placements by tradition"}
                    </p>
                    <ul className="space-y-2.5">
                      {d.evidence.map((e) => {
                        const TIcon = traditionIcon(e.tradition[0]);
                        return (
                          <li
                            key={e.tradition[0]}
                            className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5"
                          >
                            <p className="mb-1 flex items-center gap-2 font-serif text-[13px] italic text-gold-light">
                              <TIcon size={12} strokeWidth={1.5} />
                              {e.tradition[li]}
                            </p>
                            <p className="text-[12px] leading-relaxed text-stone-warm/70">
                              {e.note[li]}
                            </p>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>

                {/* Right column — channels & cautions, spelled out */}
                <div className="flex flex-col gap-5">
                  {d.details?.map((block, bIdx) => {
                    const isCaution = bIdx > 0;
                    const ItemIcon = isCaution ? AlertTriangle : Check;
                    return (
                      <motion.div
                        key={block.label[0]}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.08 * bIdx }}
                        className={`rounded-2xl border p-4 sm:p-5 ${
                          isCaution
                            ? "border-amber-200/25 bg-gradient-to-br from-amber-300/[0.06] to-transparent"
                            : "border-emerald-200/25 bg-gradient-to-br from-emerald-300/[0.06] to-transparent"
                        }`}
                      >
                        <p
                          className={`mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] ${
                            isCaution ? "text-amber-200/90" : "text-emerald-200/90"
                          }`}
                        >
                          <span
                            className={`grid size-6 place-items-center rounded-md ${
                              isCaution
                                ? "bg-amber-300/15 text-amber-200"
                                : "bg-emerald-300/15 text-emerald-200"
                            }`}
                          >
                            <ItemIcon size={11} strokeWidth={2} />
                          </span>
                          {block.label[li]}
                        </p>
                        <ul className="space-y-2">
                          {block.items.map((it, i) => (
                            <li
                              key={it[0]}
                              className="flex items-start gap-3 rounded-lg border border-white/5 bg-obsidian/40 px-3 py-2 text-[13px] leading-relaxed text-stone-warm/85"
                            >
                              <span
                                className={`grid size-5 shrink-0 place-items-center rounded-full font-serif text-[10px] italic ${
                                  isCaution
                                    ? "bg-amber-300/20 text-amber-100"
                                    : "bg-emerald-300/20 text-emerald-100"
                                }`}
                              >
                                {i + 1}
                              </span>
                              <span>{it[li]}</span>
                            </li>
                          ))}
                        </ul>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

const ASPECT_LABELS: Record<number, { en: string; zh: string; tone: string; toneZh: string }> = {
  0: { en: "Conjunction", zh: "合相", tone: "fused · intense focus", toneZh: "融合 · 强烈聚焦" },
  2: { en: "Sextile", zh: "六分相", tone: "supportive · easy flow", toneZh: "支持 · 顺畅流动" },
  3: { en: "Square", zh: "四分相", tone: "friction · growth pressure", toneZh: "摩擦 · 成长张力" },
  4: { en: "Trine", zh: "三分相", tone: "harmonic · natural gift", toneZh: "和谐 · 天赋之流" },
  6: {
    en: "Opposition",
    zh: "对分相",
    tone: "polarity · mirror tension",
    toneZh: "极性 · 镜像张力",
  },
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
      <div className="flex h-full min-h-[140px] items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-5 py-6 text-center text-[11px] uppercase tracking-[0.28em] text-stone-warm/40">
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

  const ASPECT_KEY: Record<number, string> = { 0: "conj", 2: "sext", 3: "squ", 4: "tri", 6: "opp" };
  const aspects = PLANETS.map((op, j) => {
    if (j === planetIdx) return null;
    const diff = Math.abs(signs[planetIdx] - signs[j]);
    const d = Math.min(diff, 12 - diff);
    const label = ASPECT_LABELS[d];
    if (!label) return null;
    return { other: op, otherSign: ZODIAC_SIGNS[signs[j]], label, aKey: ASPECT_KEY[d] };
  }).filter(Boolean) as {
    other: (typeof PLANETS)[number];
    otherSign: (typeof ZODIAC_SIGNS)[number];
    label: (typeof ASPECT_LABELS)[number];
    aKey: string;
  }[];

  return (
    <motion.div
      key={planetIdx}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="planet-panel relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-gold-dust/25 bg-gradient-to-br from-white/[0.04] to-transparent"
    >
      <div className="max-h-[520px] flex-1 overflow-y-auto overscroll-contain p-5 pr-4 md:max-h-[600px] lg:max-h-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
              {lang === "zh" ? "行星落位" : "Planet placement"}
            </p>
            <p className="mt-2 font-serif text-2xl italic text-stone-warm">
              <span className="mr-2 text-gold-light">{p.glyph}</span>
              {p.name[lang === "zh" ? 1 : 0]}
              <span className="mx-2 text-stone-warm/40">{lang === "zh" ? "落于" : "in"}</span>
              <span className="text-gold-light">{s.g}</span> {lang === "zh" ? s.zh : s.en}
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.28em] text-gold-dust/70">
              {lang === "zh" ? `第 ${house} 宫` : `House ${house}`}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-stone-warm/60">
              {p.meaning[lang === "zh" ? 1 : 0]}
            </p>
            <p className="mt-3 rounded-xl border border-gold-dust/20 bg-obsidian/40 p-3 text-[12px] leading-relaxed text-stone-warm/80">
              <span className="mr-2 text-[9px] uppercase tracking-[0.32em] text-gold-dust/70">
                {lang === "zh" ? "落位解读" : "Placement reading"}
              </span>
              <span className="block pt-1">
                {placementReading(planetIdx, signs[planetIdx], house, lang)}
              </span>
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
                  className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-[11px]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-stone-warm/70">
                      <span className="mr-1 text-gold-light">{a.other.glyph}</span>
                      {a.other.name[lang === "zh" ? 1 : 0]}
                      <span className="mx-1 text-stone-warm/40">{lang === "zh" ? "在" : "in"}</span>
                      {lang === "zh" ? a.otherSign.zh : a.otherSign.en}
                    </span>
                    <span className="text-right text-gold-dust/80">
                      {lang === "zh" ? a.label.zh : a.label.en}
                      <span className="ml-2 text-stone-warm/40">
                        {lang === "zh" ? a.label.toneZh : a.label.tone}
                      </span>
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-stone-warm/55">
                    {aspectReading(a.aKey, lang)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// Signs → element / modality mapping for the compact facts card.
const SIGN_ELEMENT: [string, string][] = [
  ["Fire", "火"],
  ["Earth", "土"],
  ["Air", "风"],
  ["Water", "水"],
  ["Fire", "火"],
  ["Earth", "土"],
  ["Air", "风"],
  ["Water", "水"],
  ["Fire", "火"],
  ["Earth", "土"],
  ["Air", "风"],
  ["Water", "水"],
];
const SIGN_MODALITY: [string, string][] = [
  ["Cardinal", "开创"],
  ["Fixed", "固定"],
  ["Mutable", "变动"],
  ["Cardinal", "开创"],
  ["Fixed", "固定"],
  ["Mutable", "变动"],
  ["Cardinal", "开创"],
  ["Fixed", "固定"],
  ["Mutable", "变动"],
  ["Cardinal", "开创"],
  ["Fixed", "固定"],
  ["Mutable", "变动"],
];

function ChartTipCard({ lang, seed }: { lang: "en" | "zh"; seed: string }) {
  const li = lang === "zh" ? 1 : 0;
  const signs = computePlanetSigns(seed);
  const bodySigns = PLANETS.slice(0, 10).map((_, i) => signs[i]);
  const tally = (arr: [string, string][]) => {
    const m = new Map<string, number>();
    for (const p of arr) {
      const k = p[li];
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const els = tally(bodySigns.map((s) => SIGN_ELEMENT[s]));
  const mods = tally(bodySigns.map((s) => SIGN_MODALITY[s]));
  const el = els[0]?.[0] ?? "";
  const mod = mods[0]?.[0] ?? "";
  const tipZh: Record<string, string> = {
    火: "以行动点火 —— 先出发再校准，热度是你的引擎。",
    土: "以身体为准 —— 慢即是稳，落地一次胜过空想十次。",
    风: "以对话推进 —— 让想法在他人身上先成形。",
    水: "以感受导航 —— 情绪不是干扰,是数据。",
  };
  const tipEn: Record<string, string> = {
    Fire: "Ignite by acting — leave first, calibrate on the road. Heat is your engine.",
    Earth: "Anchor through the body — slow is steady; one landed step beats ten imagined.",
    Air: "Move through dialogue — let ideas take shape in someone else first.",
    Water: "Navigate by feeling — emotion is not noise, it is data.",
  };
  const modZh: Record<string, string> = {
    开创: "开创模式主导 · 你擅长起头，注意收尾。",
    固定: "固定模式主导 · 你擅长坚持，注意松动。",
    变动: "变动模式主导 · 你擅长适配，注意锚点。",
  };
  const modEn: Record<string, string> = {
    Cardinal: "Cardinal-dominant · you start well; mind the finish.",
    Fixed: "Fixed-dominant · you hold well; mind the flex.",
    Mutable: "Mutable-dominant · you adapt well; mind the anchor.",
  };
  return (
    <div className="rounded-2xl border border-gold-dust/20 bg-obsidian/40 p-4 sm:p-5">
      <p className="text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
        {lang === "zh" ? "命盘提示 · 主导之声" : "Chart tip · dominant voice"}
      </p>
      <p className="mt-3 font-serif text-base italic leading-relaxed text-stone-warm/90 sm:text-lg">
        {lang === "zh" ? tipZh[el] : tipEn[el]}
      </p>
      <p className="mt-2 text-[11px] leading-relaxed text-stone-warm/55">
        {lang === "zh" ? modZh[mod] : modEn[mod]}
      </p>
    </div>
  );
}

function ChartFactsCard({
  lang,
  seed,
  onPickPlanet,
}: {
  lang: "en" | "zh";
  seed: string;
  onPickPlanet: (i: number) => void;
}) {
  const li = lang === "zh" ? 1 : 0;
  const signs = computePlanetSigns(seed);
  // Element / modality tally across the ten visible bodies.
  const tally = <T,>(pairs: T[][]) => {
    const map = new Map<string, number>();
    for (const p of pairs) {
      const k = p[li] as unknown as string;
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  };
  const bodySigns = PLANETS.slice(0, 10).map((_, i) => signs[i]);
  const elements = tally(bodySigns.map((s) => SIGN_ELEMENT[s]));
  const modalities = tally(bodySigns.map((s) => SIGN_MODALITY[s]));
  const dominant = elements[0];
  const dominantMod = modalities[0];
  const ascSign = signs[PLANETS.findIndex((x) => x.key === "asc")] ?? 0;

  return (
    <div
      className="flex w-full flex-col rounded-2xl border border-gold-dust/20 bg-obsidian/40 p-4 sm:p-5"
      aria-label={lang === "zh" ? "命盘核心概览" : "Chart facts summary"}
    >
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
          {lang === "zh" ? "命盘核心 · 快速一览" : "Core placements · quick view"}
        </p>
        <p className="text-[9px] uppercase tracking-[0.28em] text-stone-warm/40">
          {lang === "zh" ? "点选查看解读" : "tap to read"}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {PLANETS.map((p, idx) => {
          const s = ZODIAC_SIGNS[signs[idx]];
          const h = houseForSign(signs[idx], ascSign);
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => onPickPlanet(idx)}
              className="group flex h-full items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2.5 text-left transition-colors hover:border-gold-dust/40 hover:bg-gold-dust/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-light"
              aria-label={
                lang === "zh"
                  ? `${p.name[1]} 落于 ${s.zh}，第 ${h} 宫`
                  : `${p.name[0]} in ${s.en}, house ${h}`
              }
            >
              <span
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-gold-dust/25 bg-obsidian/60 text-[15px] leading-none text-gold-light"
                aria-hidden="true"
              >
                {p.glyph}
              </span>
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="truncate text-[11px] tracking-[0.14em] text-stone-warm/55">
                  {p.name[li]}
                </span>
                <span className="mt-0.5 truncate font-serif text-[13px] italic text-stone-warm/95">
                  {lang === "zh" ? s.zh : s.en}
                  <span className="ml-1.5 not-italic text-[10px] tracking-[0.18em] text-gold-dust/70">
                    · {lang === "zh" ? `第${h}宫` : `H${h}`}
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/5 pt-3 text-[11px] leading-snug text-stone-warm/70">
        <p>
          <span className="mr-1.5 text-[9px] uppercase tracking-[0.28em] text-gold-dust/70">
            {lang === "zh" ? "主导元素" : "Dominant"}
          </span>
          <span className="font-serif italic text-gold-light">{dominant?.[0] ?? "—"}</span>
          <span className="ml-1 text-stone-warm/45">×{dominant?.[1] ?? 0}</span>
        </p>
        <p>
          <span className="mr-1.5 text-[9px] uppercase tracking-[0.28em] text-gold-dust/70">
            {lang === "zh" ? "主导模式" : "Modality"}
          </span>
          <span className="font-serif italic text-gold-light">{dominantMod?.[0] ?? "—"}</span>
          <span className="ml-1 text-stone-warm/45">×{dominantMod?.[1] ?? 0}</span>
        </p>
      </div>
    </div>
  );
}
