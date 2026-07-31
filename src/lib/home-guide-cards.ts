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
  | "hall"
  | "desk";

export type HomeCardVisual =
  | "concern"
  | "chart"
  | "report"
  | "timeline"
  | "tarot"
  | "commons"
  | "rooms"
  | "hall";

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
    taglineZh: "问题接待台 · 六种困惑 → 图书馆的六本书",
    taglineEn: "Reception desk · six questions → six books of the library",
    descriptionZh:
      "先在接待台挑出今天最想读懂的困惑，图书馆据此为你从六本书中推出一本合适的：学业、事业、爱情、人际、财富、自我。两步在同一扇门里完成。",
    descriptionEn:
      "Name today's real question at the reception desk, then flip open one of the six books the library hands you — study, career, love, relationships, wealth, self. Both steps live behind one door.",
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
    id: "commons",
    number: "04",
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
    number: "05",
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
    id: "hall",
    number: "06",
    titleZh: "同门 · 众生之厅",
    titleEn: "The Hall of Beings",
    taglineZh: "匿名写一封信 → 陌生同门/先贤回你一封",
    taglineEn: "Write one anonymous letter → someone answers it",
    descriptionZh:
      "读完自己的命盘之后,来这里把还没说出口的那句话写成一封匿名信。可以寄给同龄的陌生旅者、贴上公共信墙、请一位先贤(十二位历史人物人格)作答,或交给图书管理员安排真人回信。全程匿名、有敏感词审查与举报,回音会在通知中心提醒你。",
    descriptionEn:
      "After reading your own chart, write the sentence you never said aloud as an anonymous letter. Send it to a stranger of your age band, pin it on the public wall, ask one of twelve distilled historical sages, or let the librarian arrange a human reply. Anonymous throughout, screened and reportable, with echoes announced in your notice centre.",
    ctaZh: "走进众生之厅",
    ctaEn: "Enter the hall",
    access: "open",
    mode: "drawer",
    visual: "hall",
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
