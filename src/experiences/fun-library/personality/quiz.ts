/**
 * Fun Library · 12 absurd library-scene questions.
 *
 * Design invariants (enforced by personality.test.ts):
 *   - 12 questions × 4 options each.
 *   - Each of the four hidden axes (ML, ET, AC, FO) is hit by
 *     EXACTLY 6 questions, and the ± totals across all options
 *     of those questions sum to 0 (perfectly balanced).
 *   - Every option contributes to 2 axes (never single-axis) so no
 *     question is a giveaway for a specific trait.
 *   - No wording resembles standard psychometrics; no obvious
 *     good/bad polarity.
 */

import type { QuizQuestion } from "./types";

export const QUIZ_VERSION = "quiz_v1";

/**
 * Weight grid used across the 12 questions. Each question picks a
 * pair of axes (X,Y); its four options are ±X × ±Y with weight 2 so
 * the axis pair is fully covered and balanced.
 */
const PAIR = (
  x: "ML" | "ET" | "AC" | "FO",
  y: "ML" | "ET" | "AC" | "FO",
) => [
  { [x]: 2, [y]: 2 } as Record<string, number>,
  { [x]: 2, [y]: -2 } as Record<string, number>,
  { [x]: -2, [y]: 2 } as Record<string, number>,
  { [x]: -2, [y]: -2 } as Record<string, number>,
];

// Q1–3 hit (ML, ET); Q4–6 hit (AC, FO);
// Q7–9 hit (ML, AC); Q10–12 hit (ET, FO). Each axis → 6 questions.

export const QUIZ: QuizQuestion[] = [
  // ---------- Q1 (ML × ET) ----------
  {
    id: "q1",
    zh: "凌晨三点，一本没有书名的书从架上掉下来。你先做什么？",
    en: "3 a.m. A book with no title slips off the shelf. First thing you do?",
    options: (() => {
      const w = PAIR("ML", "ET");
      return [
        { id: "q1a", zh: "先把它放回原位，记下坐标编号", en: "Slot it back and note its shelf coordinates", weights: w[0] },
        { id: "q1b", zh: "翻到中间读一段，看它想说什么", en: "Flip to the middle and read a passage, see what it wants", weights: w[1] },
        { id: "q1c", zh: "抬头看看四周，等下一件事发生", en: "Look around and wait for what happens next", weights: w[2] },
        { id: "q1d", zh: "抽张便签夹进去，明早再管", en: "Slip a sticky note inside; deal with it tomorrow", weights: w[3] },
      ] as [ typeof w[0] extends never ? never : QuizQuestion["options"][0], QuizQuestion["options"][1], QuizQuestion["options"][2], QuizQuestion["options"][3]] as QuizQuestion["options"];
    })(),
  },
  // ---------- Q2 (ML × ET) ----------
  {
    id: "q2",
    zh: "图书馆闭馆前，你只能带走一件东西。你选哪个？",
    en: "The library is closing. You can take exactly one thing.",
    options: (() => {
      const w = PAIR("ML", "ET");
      return [
        { id: "q2a", zh: "一本你完全看不懂语言的书", en: "A book in a language you don't understand", weights: w[0] },
        { id: "q2b", zh: "一张写错了地址的车票", en: "A train ticket with the wrong address", weights: w[1] },
        { id: "q2c", zh: "半封没有署名的信", en: "Half a letter, no signature", weights: w[2] },
        { id: "q2d", zh: "一把不知开哪里的钥匙", en: "A key you can't place", weights: w[3] },
      ] as unknown as QuizQuestion["options"];
    })(),
  },
  // ---------- Q3 (ML × ET) ----------
  {
    id: "q3",
    zh: "书页开始倒着长。你会：",
    en: "Pages start growing backwards. You:",
    options: (() => {
      const w = PAIR("ML", "ET");
      return [
        { id: "q3a", zh: "先寻找页码规律", en: "Look for a pattern in the page numbers", weights: w[0] },
        { id: "q3b", zh: "叫人来一起看", en: "Call someone over to witness it", weights: w[1] },
        { id: "q3c", zh: "继续读下去", en: "Keep reading anyway", weights: w[2] },
        { id: "q3d", zh: "在空白处写下一句话", en: "Write one sentence in the margin", weights: w[3] },
      ] as unknown as QuizQuestion["options"];
    })(),
  },
  // ---------- Q4 (AC × FO) ----------
  {
    id: "q4",
    zh: "馆长说“出口藏在一句谎话里”。你会先：",
    en: "The keeper says: \"The exit is hidden in one lie.\" You first:",
    options: (() => {
      const w = PAIR("AC", "FO");
      return [
        { id: "q4a", zh: "观察谁最紧张", en: "Watch who looks most nervous", weights: w[0] },
        { id: "q4b", zh: "自己对照一份地图", en: "Cross-check a map by yourself", weights: w[1] },
        { id: "q4c", zh: "先随便推一扇门试试", en: "Just push a door and see", weights: w[2] },
        { id: "q4d", zh: "反问馆长一个无关的问题", en: "Ask the keeper an unrelated question back", weights: w[3] },
      ] as unknown as QuizQuestion["options"];
    })(),
  },
  // ---------- Q5 (AC × FO) ----------
  {
    id: "q5",
    zh: "一本书的结局被撕掉了。你怎么办？",
    en: "The ending of a book has been torn out. What now?",
    options: (() => {
      const w = PAIR("AC", "FO");
      return [
        { id: "q5a", zh: "找馆员一起推断作者原意", en: "Ask a clerk to reason out the original ending with you", weights: w[0] },
        { id: "q5b", zh: "自己合上书，安静想清楚", en: "Close the book and think it through alone", weights: w[1] },
        { id: "q5c", zh: "拉一位陌生读者来续写", en: "Pull a stranger over to invent a new ending", weights: w[2] },
        { id: "q5d", zh: "宁可让它保持没写完", en: "Let it stay unfinished on purpose", weights: w[3] },
      ] as unknown as QuizQuestion["options"];
    })(),
  },
  // ---------- Q6 (AC × FO) ----------
  {
    id: "q6",
    zh: "一只从没见过的动物趴在阅览桌上不走。你：",
    en: "An animal you've never seen sits on your reading desk and won't move.",
    options: (() => {
      const w = PAIR("AC", "FO");
      return [
        { id: "q6a", zh: "问相邻座位的读者它是谁", en: "Ask the reader next to you what it is", weights: w[0] },
        { id: "q6b", zh: "自己观察半小时再决定", en: "Watch it for half an hour before deciding", weights: w[1] },
        { id: "q6c", zh: "带一群朋友一起来看", en: "Bring a group of friends to see it", weights: w[2] },
        { id: "q6d", zh: "换一张桌子，让它待着", en: "Move to another desk and let it stay", weights: w[3] },
      ] as unknown as QuizQuestion["options"];
    })(),
  },
  // ---------- Q7 (ML × AC) ----------
  {
    id: "q7",
    zh: "有人在你借出的书里夹了一张陌生纸条，只写着“别翻第七章”。",
    en: "Someone slipped a note into a book you borrowed: \"Don't open chapter seven.\"",
    options: (() => {
      const w = PAIR("ML", "AC");
      return [
        { id: "q7a", zh: "先列出可能的写字人清单", en: "First list who could plausibly have written it", weights: w[0] },
        { id: "q7b", zh: "自己想想为什么", en: "Sit with it and think why by yourself", weights: w[1] },
        { id: "q7c", zh: "拿去问最近借过这本书的朋友", en: "Ask the friend who borrowed it before you", weights: w[2] },
        { id: "q7d", zh: "把纸条留在原处，忘掉它", en: "Leave the note in place and forget it", weights: w[3] },
      ] as unknown as QuizQuestion["options"];
    })(),
  },
  // ---------- Q8 (ML × AC) ----------
  {
    id: "q8",
    zh: "整层楼的灯突然只剩一盏，还在你正上方。",
    en: "The whole floor's lights go dark. Only one remains — right above you.",
    options: (() => {
      const w = PAIR("ML", "AC");
      return [
        { id: "q8a", zh: "抬头量一量灯到书架的距离", en: "Look up and measure the distance to the shelves", weights: w[0] },
        { id: "q8b", zh: "叫附近的人聚过来", en: "Call anyone nearby to gather here", weights: w[1] },
        { id: "q8c", zh: "自己顺着灯的方向走", en: "Walk in the direction the light points", weights: w[2] },
        { id: "q8d", zh: "关掉这盏灯，看看会发生什么", en: "Switch that last light off and see what happens", weights: w[3] },
      ] as unknown as QuizQuestion["options"];
    })(),
  },
  // ---------- Q9 (ML × AC) ----------
  {
    id: "q9",
    zh: "你在书架背面发现了自己的名字，笔迹不是你的。",
    en: "You find your own name on the back of a shelf — in someone else's handwriting.",
    options: (() => {
      const w = PAIR("ML", "AC");
      return [
        { id: "q9a", zh: "记下位置和字体特征", en: "Note the exact location and stroke style", weights: w[0] },
        { id: "q9b", zh: "问馆员这排书谁常经过", en: "Ask the clerk who usually passes this row", weights: w[1] },
        { id: "q9c", zh: "沿着这一排把书全翻一遍", en: "Turn over every book along that row by yourself", weights: w[2] },
        { id: "q9d", zh: "在旁边写上一个日期就走", en: "Write a date next to it and leave", weights: w[3] },
      ] as unknown as QuizQuestion["options"];
    })(),
  },
  // ---------- Q10 (ET × FO) ----------
  {
    id: "q10",
    zh: "有人塞给你一本厚厚的“别人的日记”，请你保管一年。",
    en: "Someone hands you a thick \"someone else's diary\" to keep for a year.",
    options: (() => {
      const w = PAIR("ET", "FO");
      return [
        { id: "q10a", zh: "锁进最深的柜子，一年后原样归还", en: "Lock it away; return it untouched a year later", weights: w[0] },
        { id: "q10b", zh: "分门别类整理索引后再保管", en: "Sort and index it before storing it", weights: w[1] },
        { id: "q10c", zh: "随身带着，遇到什么就读什么", en: "Carry it around; read wherever life opens it", weights: w[2] },
        { id: "q10d", zh: "翻到一半，再决定要不要继续", en: "Read halfway, then decide whether to continue", weights: w[3] },
      ] as unknown as QuizQuestion["options"];
    })(),
  },
  // ---------- Q11 (ET × FO) ----------
  {
    id: "q11",
    zh: "在闭馆前十分钟，你只允许在一本书上留下一件东西。",
    en: "Ten minutes before closing, you may leave exactly one thing inside one book.",
    options: (() => {
      const w = PAIR("ET", "FO");
      return [
        { id: "q11a", zh: "一张写好日期的名片", en: "A business card with today's date", weights: w[0] },
        { id: "q11b", zh: "一句结论性的话", en: "One conclusive sentence", weights: w[1] },
        { id: "q11c", zh: "一片没有说明的树叶", en: "A leaf with no explanation", weights: w[2] },
        { id: "q11d", zh: "一个问号", en: "A single question mark", weights: w[3] },
      ] as unknown as QuizQuestion["options"];
    })(),
  },
  // ---------- Q12 (ET × FO) ----------
  {
    id: "q12",
    zh: "有一扇门每次打开通向不同房间。你会：",
    en: "A door opens into a different room each time. You will:",
    options: (() => {
      const w = PAIR("ET", "FO");
      return [
        { id: "q12a", zh: "记录每次开门的时间和结果", en: "Log the time and outcome of every opening", weights: w[0] },
        { id: "q12b", zh: "只在需要一个答案时才开", en: "Only open it when you need one specific answer", weights: w[1] },
        { id: "q12c", zh: "有空就推一下，看今天给什么", en: "Push it whenever free; see what today gives", weights: w[2] },
        { id: "q12d", zh: "干脆一直让它开着", en: "Just prop it open indefinitely", weights: w[3] },
      ] as unknown as QuizQuestion["options"];
    })(),
  },
];
