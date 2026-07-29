/**
 * home-guide-cards — the seven card definitions for the guide-desk home
 * page Scroll Stack. Keep bilingual copy + CTA target here so the JSX
 * layer is a pure map, not seven copy-pasted blocks.
 */
import type { MemTier } from "@/lib/use-membership-tier";

export type HomeCardId =
  | "concern"
  | "chart"
  | "report"
  | "timeline"
  | "tarot"
  | "commons"
  | "rooms";

export type HomeCardVisual = HomeCardId; // one visual per card id

export type HomeAccess = "open" | "basic" | "sage" | "oracle" | "coming";

export type HomeGuideCard = {
  id: HomeCardId;
  number: string; // "01".."07"
  titleZh: string;
  titleEn: string;
  taglineZh: string;
  taglineEn: string;
  descriptionZh: string;
  descriptionEn: string;
  access: HomeAccess;
  // CTA target route. When "concern" the card opens a dialog with the
  // existing ConcernSelector instead of navigating.
  target: string;
  requiresPrimaryChart?: boolean;
  requiresTier?: Extract<MemTier, "sage" | "oracle">;
  visual: HomeCardVisual;
};

export const HOME_GUIDE_CARDS: readonly HomeGuideCard[] = [
  {
    id: "concern",
    number: "01",
    titleZh: "今天你带着什么问题来到这里",
    titleEn: "What question brings you today?",
    taglineZh: "选一个你此刻最想理解的问题",
    taglineEn: "Pick the question you most want to understand right now",
    descriptionZh:
      "把当下最想读懂的困惑挑出来，图书馆据此为你安排今天的阅读顺序：学业、事业、爱情、人际、财富、自我。",
    descriptionEn:
      "Name today's real question — study, career, love, relationships, wealth, or self — and the library orders your reading around it.",
    access: "open",
    target: "#concern-dialog",
    requiresPrimaryChart: false,
    visual: "concern",
  },
  {
    id: "chart",
    number: "02",
    titleZh: "建立我的命盘",
    titleEn: "Build my primary chart",
    taglineZh: "四大体系交叉阅读同一份出生资料",
    taglineEn: "Four traditions read the same birth data together",
    descriptionZh:
      "登记完整出生资料，图书馆用西方、印度、八字、紫微四大体系为你建立一张主命盘，作为后续所有阅读的底稿。",
    descriptionEn:
      "Register your full birth data. Western, Vedic, BaZi and Zi Wei each read it in their own voice, forming the primary chart every later reading refers back to.",
    access: "basic",
    target: "/ritual",
    requiresPrimaryChart: false,
    visual: "chart",
  },
  {
    id: "report",
    number: "03",
    titleZh: "阅读综合解读",
    titleEn: "Read the panorama",
    taglineZh: "综合解读永久免费，¥79 一次性解锁 24 章深度报告",
    taglineEn: "Panorama free forever · ¥79 one-time for the 24-chapter premium report",
    descriptionZh:
      "打开四大体系交叉写就的综合解读。¥79 高级 AI 深度报告为一次性购买、永久保存，不是订阅、不自动续费。",
    descriptionEn:
      "Open the panorama that stitches all four traditions together. The ¥79 premium AI report is a one-time purchase kept forever — not a subscription.",
    access: "basic",
    target: "/report",
    requiresPrimaryChart: true,
    visual: "report",
  },
  {
    id: "timeline",
    number: "04",
    titleZh: "沿时间寻找证据",
    titleEn: "Trace evidence through time",
    taglineZh: "生命时间轴 · 大运 · 关键节点的反向验证",
    taglineEn: "Life timeline · luck cycles · key events reverse-verified",
    descriptionZh:
      "沿年龄、阶段与真实事件回看：命盘给出的暗流，在你人生的哪些节点已经浮出水面？",
    descriptionEn:
      "Walk your years, phases and real events back through the chart — which quiet currents already surfaced, and where?",
    access: "basic",
    target: "/me/echoes",
    requiresPrimaryChart: true,
    visual: "timeline",
  },
  {
    id: "tarot",
    number: "05",
    titleZh: "塔罗 · 第二位证人",
    titleEn: "Tarot · the second witness",
    taglineZh: "为当下问题请出一组独立、短期的补充视角",
    taglineEn: "A short-term second opinion for today's question — not a verdict",
    descriptionZh:
      "塔罗不替代命盘，也不替你作决定。它是一位独立证人，为你此刻的问题提供一段可反思的补充视角。",
    descriptionEn:
      "Tarot is not a replacement for the chart, and not a verdict. It is a second witness offering a short, reflective perspective on today's question.",
    access: "basic",
    target: "/me/oracle",
    requiresPrimaryChart: true,
    visual: "tarot",
  },
  {
    id: "commons",
    number: "06",
    titleZh: "命运通识馆",
    titleEn: "Commons hall of destiny",
    taglineZh: "数学、语文、地理、物理、经济、生物六馆",
    taglineEn: "Math · literature · geography · physics · economics · biology",
    descriptionZh:
      "把专业命理翻译成更直观的生活语言。数学馆与语文馆已开放，其余四馆正在整理，进入不收费。",
    descriptionEn:
      "Translating traditional destiny reading into everyday languages. Math and literature halls are open now; the others are still being curated — no charge to explore.",
    access: "open",
    target: "/life-studies",
    requiresPrimaryChart: false,
    visual: "commons",
  },
  {
    id: "rooms",
    number: "07",
    titleZh: "贤者与神谕者阅览室",
    titleEn: "The Sage & Oracle reading rooms",
    taglineZh: "两间月度阅览室 · 与 ¥79 一次性报告并列，不重复",
    taglineEn: "Two monthly reading rooms — complementary to the one-time ¥79 report",
    descriptionZh:
      "贤者阅览室提供长期对话与深度分析；神谕者阅览室追加更长的年运追踪与提问额度。会员为月度，¥79 报告为一次性，两者互不替代。",
    descriptionEn:
      "The Sage room offers ongoing conversation and deep analysis. The Oracle room adds longer year-tracking and more Q&A. Both are monthly, distinct from the one-time ¥79 report.",
    access: "sage",
    target: "/me/membership",
    requiresPrimaryChart: false,
    visual: "rooms",
  },
];
