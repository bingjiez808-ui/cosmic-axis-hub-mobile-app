/**
 * home-guide-cards — the seven feature-index cards on the guide-desk
 * home page. Each card is a bookmark; clicking it opens
 * LibraryFeatureDrawer with the corresponding existing feature module.
 * Only two cards leave the drawer: 02 (ritual) and 03 (report) — those
 * navigate to their existing routes because they own multi-step flows
 * (birth-data form, purchase / progress state machine).
 */
import type { MemTier } from "@/lib/use-membership-tier";

export type HomeCardId =
  | "concern"
  | "chart"
  | "report"
  | "books"
  | "commons"
  | "rooms"
  | "desk";

export type HomeCardVisual =
  | "concern"
  | "chart"
  | "report"
  | "timeline"
  | "tarot"
  | "commons"
  | "rooms";

export type HomeAccess = "open" | "basic" | "sage" | "oracle" | "coming";

// "drawer": open the LibraryFeatureDrawer inline. "route": navigate.
export type HomeCardMode = "drawer" | "route";

export type HomeGuideCard = {
  id: HomeCardId;
  number: string;
  titleZh: string;
  titleEn: string;
  taglineZh: string;
  taglineEn: string;
  descriptionZh: string;
  descriptionEn: string;
  ctaZh: string;
  ctaEn: string;
  access: HomeAccess;
  mode: HomeCardMode;
  // route target when mode === "route"
  target?: string;
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
    taglineZh: "问题接待台 · 六种最常被问的困惑",
    taglineEn: "Reception desk · six most-asked questions",
    descriptionZh:
      "先把今天最想读懂的困惑挑出来，图书馆据此为你安排接下来的阅读顺序：学业、事业、爱情、人际、财富、自我。",
    descriptionEn:
      "Name today's real question — study, career, love, relationships, wealth, or self — and the library orders the rest of your reading around it.",
    ctaZh: "打开问题接待台",
    ctaEn: "Open reception desk",
    access: "open",
    mode: "drawer",
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
    ctaZh: "开启仪式",
    ctaEn: "Open the ritual",
    access: "basic",
    mode: "route",
    target: "/ritual",
    visual: "chart",
  },
  {
    id: "report",
    number: "03",
    titleZh: "综合解读 · 24 章深度报告",
    titleEn: "Panorama · 24-chapter premium report",
    taglineZh: "综合解读永久免费,¥79 一次性解锁深度报告",
    taglineEn: "Panorama free forever · ¥79 one-time unlocks the report",
    descriptionZh:
      "打开四大体系交叉写就的综合解读。¥79 高级 AI 深度报告为一次性购买、永久保存,不是订阅、不自动续费。",
    descriptionEn:
      "Open the panorama that stitches all four traditions together. The ¥79 premium AI report is a one-time purchase kept forever — not a subscription.",
    ctaZh: "进入综合解读",
    ctaEn: "Enter the panorama",
    access: "basic",
    mode: "route",
    target: "/report",
    requiresPrimaryChart: true,
    visual: "report",
  },
  {
    id: "books",
    number: "04",
    titleZh: "今日借阅 · 图书馆的六本书",
    titleEn: "Today's picks · six books of the library",
    taglineZh: "自我、学业、事业、爱情、财富、时间轴",
    taglineEn: "Self · study · career · love · wealth · timeline",
    descriptionZh:
      "根据你在问题接待台挑选的困惑,馆员为你准备好六本书。翻开任意一本,直接进入对应的深度阅读。",
    descriptionEn:
      "Based on the question you picked at the reception desk, the curator has laid out six books. Open any one to jump into the matching deep reading.",
    ctaZh: "翻开今日书单",
    ctaEn: "Open today's shelf",
    access: "basic",
    mode: "drawer",
    visual: "timeline",
  },
  {
    id: "commons",
    number: "05",
    titleZh: "命运通识馆 · 六馆总览",
    titleEn: "Commons hall of destiny · six halls",
    taglineZh: "数学、语文、地理、物理、经济、生物六馆",
    taglineEn: "Math · literature · geography · physics · economics · biology",
    descriptionZh:
      "把专业命理翻译成更直观的生活语言。数学馆与语文馆已开放,其余四馆正在整理,进入不收费。",
    descriptionEn:
      "Traditional destiny reading translated into everyday languages. Math and literature halls are open; the others are still being curated — free to explore.",
    ctaZh: "走进通识馆",
    ctaEn: "Enter the commons",
    access: "open",
    mode: "drawer",
    visual: "commons",
  },
  {
    id: "rooms",
    number: "06",
    titleZh: "仪式之后 · 四间特别藏室",
    titleEn: "After the ritual · four special rooms",
    taglineZh: "时间轴、验证、塔罗、会员",
    taglineEn: "Timeline · validation · tarot · membership",
    descriptionZh:
      "命盘建立之后开启的四间藏室,每一间都能在原地预览。打开与否取决于你是否登录、是否建过命盘。",
    descriptionEn:
      "Four rooms that open once the primary chart exists. Each previews in place; unlocking depends on whether you've signed in and built the chart.",
    ctaZh: "查看四间藏室",
    ctaEn: "See the four rooms",
    access: "basic",
    mode: "drawer",
    visual: "rooms",
  },
  {
    id: "desk",
    number: "07",
    titleZh: "我的书架 · 每天回来的地方",
    titleEn: "Personal Library · come back each day",
    taglineZh: "今日命运、命盘管理、好友与订单",
    taglineEn: "Today's fate, chart manager, friends & orders",
    descriptionZh:
      "登录之后每天回来的主界面:今日命运、七日预览、命盘管理、贤者/神谕者阅览室、好友与订单,一次进入,循序阅读。",
    descriptionEn:
      "The main desk you return to each day once signed in: today's fate, seven-day preview, chart manager, Sage/Oracle rooms, friends & orders — one entry, read in order.",
    ctaZh: "介绍我的书架",
    ctaEn: "Preview my Personal Library",
    access: "basic",
    mode: "drawer",
    visual: "tarot",
  },
];
