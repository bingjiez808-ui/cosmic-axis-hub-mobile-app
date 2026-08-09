/**
 * concern-reading-guide — supplementary bilingual copy that the
 * homepage ConcernSelector uses to fill the right-hand response
 * panel (three "index cards" + a chapter label per concern).
 *
 * Kept separate from `concern-guidance-v1.ts` so the existing
 * ConcernRecord schema, tests, and downstream consumers (reader,
 * ritual, life-guidance functions) stay untouched. All strings are
 * literal — 0 AI tokens.
 */
import type { ConcernKey } from "@/lib/concern-guidance-v1";

type Bi = { zh: string; en: string };

export type ReadingIndexCard = {
  id: string;
  title: Bi;
  description: Bi;
};

export type ConcernReadingGuide = {
  /** Bilingual name of the report chapter this concern maps to. */
  reportSectionLabel: Bi;
  /** Three compact "what this reading will help you tell apart" cards. */
  readingIndexes: ReadingIndexCard[];
};

export const CONCERN_READING_GUIDES: Record<ConcernKey, ConcernReadingGuide> = {
  overview: {
    reportSectionLabel: { zh: "命盘全景导览", en: "Chart Map" },
    readingIndexes: [
      {
        id: "recurring-pattern",
        title: { zh: "反复出现的模式", en: "The pattern that keeps returning" },
        description: {
          zh: "哪些选择、关系或情绪，正在以不同形式重复出现。",
          en: "Which choices, relationships or moods keep returning in different shapes.",
        },
      },
      {
        id: "true-drain",
        title: { zh: "真正消耗你的部分", en: "What actually drains you" },
        description: {
          zh: "区分暂时的疲惫、外部压力，以及长期未被看见的需求。",
          en: "Tell apart temporary fatigue, outside pressure, and a long-unseen need.",
        },
      },
      {
        id: "next-page",
        title: { zh: "下一页从哪里翻起", en: "Where the next page opens" },
        description: {
          zh: "找到此刻最值得先处理的一条线，而不是一次解决整个人生。",
          en: "Find the single thread worth handling first — not the whole life at once.",
        },
      },
    ],
  },

  study: {
    reportSectionLabel: { zh: "学业与认知", en: "Academic & Cognition" },
    readingIndexes: [
      {
        id: "learning-style",
        title: { zh: "适合你的学习方式", en: "The learning style that fits you" },
        description: {
          zh: "会重点阅读你在独立深研、讨论、项目或应用之间的偏向。",
          en: "Reads which mode suits you — solo depth, dialogue, projects or applied work.",
        },
      },
      {
        id: "hidden-edge",
        title: { zh: "容易被忽视的优势", en: "The strength that gets overlooked" },
        description: {
          zh: "帮助你辨认那些不被考试量化，却真正推动理解的能力。",
          en: "Names the abilities exams under-count but that actually drive comprehension.",
        },
      },
      {
        id: "shore-or-switch",
        title: { zh: "当前该补能力还是换路径", en: "Shore up, or switch tracks" },
        description: {
          zh: "分清此刻是补一项支撑性技能，还是需要真的换一条学习路径。",
          en: "Distinguishes shoring up one supporting skill from switching path entirely.",
        },
      },
    ],
  },

  career: {
    reportSectionLabel: { zh: "事业方向与天赋", en: "Vocation & Talents" },
    readingIndexes: [
      {
        id: "work-structure",
        title: { zh: "适合发挥的工作结构", en: "The work structure that suits you" },
        description: {
          zh: "会重点阅读稳态深耕、变化调度或拓荒创造的适配度。",
          en: "Reads how you fit steady deep work, orchestrating change, or breaking new ground.",
        },
      },
      {
        id: "accumulate-turn-consolidate",
        title: { zh: "现在是积累、转向还是收缩", en: "Accumulate, turn, or consolidate now" },
        description: {
          zh: "帮助你辨认接下来 12 个月更适合准备、发动，还是收敛。",
          en: "Helps tell whether the next 12 months favour preparing, launching, or consolidating.",
        },
      },
      {
        id: "recurring-lesson",
        title: { zh: "容易反复遇到的职业课题", en: "The career lesson that keeps returning" },
        description: {
          zh: "看清换了几个岗位仍在重复的那一门课，是哪一门。",
          en: "Names the lesson that keeps returning across roles — so it stops repeating.",
        },
      },
    ],
  },

  love: {
    reportSectionLabel: { zh: "情感与关系", en: "Love & Relationships" },
    readingIndexes: [
      {
        id: "true-need",
        title: { zh: "你在关系中真正需要什么", en: "What you actually need in a bond" },
        description: {
          zh: "会重点阅读你安心的来源，是热烈、可预期，还是被看见。",
          en: "Reads whether safety comes from intensity, predictability, or being seen.",
        },
      },
      {
        id: "attraction-defence",
        title: { zh: "重复的吸引与防御模式", en: "Recurring attraction & defence" },
        description: {
          zh: "帮助你辨认反复靠近某一类人时，你在寻找什么、又在防御什么。",
          en: "Names what you keep looking for — and what you keep guarding — in the same type.",
        },
      },
      {
        id: "approach-observe-boundary",
        title: { zh: "此刻适合靠近、观察还是建立边界", en: "Approach, observe, or set a boundary" },
        description: {
          zh: "分清眼前这段关系此刻需要靠近、静观，还是先把边界重画一次。",
          en: "Distinguishes stepping closer, quietly observing, or redrawing the boundary first.",
        },
      },
    ],
  },

  relationships: {
    reportSectionLabel: { zh: "情感与关系", en: "Love & Relationships" },
    readingIndexes: [
      {
        id: "worth-investing",
        title: { zh: "哪些关系值得继续投入", en: "Which ties are worth investing in" },
        description: {
          zh: "会重点阅读不同关系在你身上的能量成本与回报差异。",
          en: "Reads how different ties trade energy cost against real return in your case.",
        },
      },
      {
        id: "overcarry",
        title: { zh: "你为何容易承担过多", en: "Why you end up carrying too much" },
        description: {
          zh: "帮助你辨认那条「先把别人的感受放在自己前面」的旧规则。",
          en: "Names the old rule that puts others' feelings ahead of your own.",
        },
      },
      {
        id: "connect-without-shrinking",
        title: { zh: "如何在连接中不缩小自己", en: "Staying whole while staying connected" },
        description: {
          zh: "找到能维持关系又不必牺牲自我的具体表达方式。",
          en: "Finds concrete ways to keep the tie without shrinking who you are.",
        },
      },
    ],
  },

  finance: {
    reportSectionLabel: { zh: "财富格局", en: "Wealth" },
    readingIndexes: [
      {
        id: "wealth-source",
        title: { zh: "更适合你的财富来源", en: "The wealth source that fits you" },
        description: {
          zh: "会重点阅读专业能力、系统化产出与资产沉淀之间的偏向。",
          en: "Reads the mix of professional skill, systemised output, and asset accumulation.",
        },
      },
      {
        id: "drain-decisions",
        title: { zh: "容易发生损耗的决策模式", en: "Decision patterns that leak" },
        description: {
          zh: "帮助你辨认哪些支出是为了不让别人失望而做的。",
          en: "Names the spending done to keep others from being disappointed.",
        },
      },
      {
        id: "grow-or-hold",
        title: { zh: "当前更需要增长还是守住", en: "Grow, or hold what's here" },
        description: {
          zh: "分清此刻更适合争取新增长，还是先把已有的稳住。",
          en: "Distinguishes reaching for new growth from stabilising what you already hold.",
        },
      },
    ],
  },

  self_family: {
    reportSectionLabel: { zh: "性格底色 + 家庭与家园", en: "Character + Family & Home" },
    readingIndexes: [
      {
        id: "family-inertia",
        title: { zh: "原生家庭留下的惯性", en: "The inertia family left behind" },
        description: {
          zh: "会重点阅读你身上仍在运行的那些早年被交付的期待。",
          en: "Reads which early-handed expectations still run silently inside you.",
        },
      },
      {
        id: "chapter-task",
        title: { zh: "当前人生阶段的核心任务", en: "The core task of this chapter" },
        description: {
          zh: "帮助你辨认此刻这一章真正要做的一件事，而不是所有事。",
          en: "Names the one thing this chapter is really asking of you — not all of them.",
        },
      },
      {
        id: "expectations-not-yours",
        title: { zh: "哪些期待其实不属于你", en: "Which expectations were never yours" },
        description: {
          zh: "分清哪些是你自己的功课，哪些一直是别人交给你保管的。",
          en: "Distinguishes lessons that are yours from ones handed to you to hold for someone else.",
        },
      },
    ],
  },
};
