import type { SubjectRoomMeta } from "./types";

/**
 * The five 阅览室. Only "math" is open in this phase; the rest are
 * marked as next-phase or requires-integration so users see clear
 * intent without being promised features that do not exist.
 */
export const SUBJECT_ROOMS: SubjectRoomMeta[] = [
  {
    id: "math",
    route: "/life-studies/math",
    slugRoute: "/life-studies/math",
    title: { zh: "数学馆 · 人生函数", en: "Mathematics · Life as a Function" },
    subtitle: {
      zh: "把人生解释成一条可以调节的曲线",
      en: "Read your life as a curve you can tune, not a verdict",
    },
    question: {
      zh: "如果人生不是命定曲线，而是基线、周期、选择与噪声共同写出的函数呢？",
      en: "What if a life is a function of baseline, cycles, choices and noise — not a verdict?",
    },
    visualization: {
      zh: "可交互折线图 · 情景滑块 · 敏感度分布",
      en: "Interactive line chart · scenario sliders · sensitivity map",
    },
    readMinutes: 8,
    dataRequirement: {
      zh: "个性化模式需要主命盘（生日即可）；体验模式无需登录",
      en: "Personalized mode needs a primary chart (birthdate); demo mode needs no sign-in",
    },
    usesAI: false,
    status: "open",
  },
  {
    id: "philosophy",
    route: "/life-studies",
    slugRoute: "/life-studies/philosophy",
    title: { zh: "哲思与诗章馆 · 这个年纪，终于读懂了", en: "Philosophy & Verse · Only Now Did I Understand" },
    subtitle: {
      zh: "把当前阶段的命题，翻译成一段可以慢慢读的散文",
      en: "Translate this life stage into an essay to sit with, not a slogan",
    },
    question: {
      zh: "此刻的困惑，究竟是哪一类古老命题的当代变奏？",
      en: "Which ancient question is your current confusion a modern variation of?",
    },
    visualization: {
      zh: "长文阅读 · 引文卡 · 阶段书签",
      en: "Long-form reading · quotation cards · stage bookmarks",
    },
    readMinutes: 12,
    dataRequirement: {
      zh: "需要主命盘的阶段与年龄事实",
      en: "Needs stage & age facts from the primary chart",
    },
    usesAI: true,
    status: "next-phase",
    statusNote: {
      zh: "下一阶段开放；不会伪造历史人物的名言。",
      en: "Opens next phase. We will not fabricate quotations.",
    },
  },
  {
    id: "physics",
    route: "/life-studies",
    slugRoute: "/life-studies/physics",
    title: { zh: "物理馆 · 人生能量实验室", en: "Physics · Life Energy Lab" },
    subtitle: {
      zh: "把注意力、恢复与阻力当成能量、势能与摩擦来看",
      en: "See attention, recovery and resistance as energy, potential and friction",
    },
    question: {
      zh: "你的能量目前是被什么形式的“摩擦”吃掉的？",
      en: "Which kind of 'friction' is currently eating your energy?",
    },
    visualization: {
      zh: "势能井 · 能量流向图",
      en: "Potential wells · energy-flow diagram",
    },
    readMinutes: 6,
    dataRequirement: {
      zh: "需要主命盘的元素/宫位事实",
      en: "Needs element & house facts from the primary chart",
    },
    usesAI: false,
    status: "next-phase",
  },
  {
    id: "economics",
    route: "/life-studies",
    slugRoute: "/life-studies/economics",
    title: { zh: "经济馆 · 人生资源配置局", en: "Economics · Life Portfolio Desk" },
    subtitle: {
      zh: "把时间、注意力、关系当作可以配置的资源组合",
      en: "Treat time, attention and relationships as an allocatable portfolio",
    },
    question: {
      zh: "现在最值得追加投入的一项资源是什么？",
      en: "Which single resource is most worth reallocating right now?",
    },
    visualization: {
      zh: "资产配置饼图 · 边际回报曲线",
      en: "Allocation pie · marginal-return curve",
    },
    readMinutes: 7,
    dataRequirement: {
      zh: "需要主命盘的性格与阶段事实",
      en: "Needs personality & stage facts from the primary chart",
    },
    usesAI: false,
    status: "next-phase",
  },
  {
    id: "geography",
    route: "/life-studies",
    slugRoute: "/life-studies/geography",
    title: { zh: "地理馆 · 人生迁徙地图", en: "Geography · Migration Map" },
    subtitle: {
      zh: "把不同地点的适配感转译成地图上的势能",
      en: "Turn place-fit into a potential map you can read",
    },
    question: {
      zh: "哪一类地理环境更放大你此刻的优势？",
      en: "Which kind of place amplifies your current strengths?",
    },
    visualization: {
      zh: "世界地图 · 迁移线 · 地区适配指数",
      en: "World map · relocation lines · locational fit index",
    },
    readMinutes: 6,
    dataRequirement: {
      zh: "需要专业迁移盘（Astrocartography）计算器接入",
      en: "Needs a professional relocation-astrology calculator",
    },
    usesAI: false,
    status: "requires-integration",
    statusNote: {
      zh: "在专业迁移盘计算器接入后开放；不会用 AI 猜测地理吉凶。",
      en: "Opens after we integrate a real relocation calculator. We will not have AI guess locational fortune.",
    },
  },
];
