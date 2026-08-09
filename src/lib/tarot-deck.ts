/**
 * Standard 78-card Rider–Waite–Smith deck.
 * Image URLs use Wikimedia Commons' Special:FilePath resolver (public domain).
 */

export type TarotCard = {
  id: string;
  nameEn: string;
  nameZh: string;
  glyph: string; // roman numeral or rank
  suit: "major" | "wands" | "cups" | "swords" | "pentacles";
  image: string;
  score: number; // -2..+2, energy for the 上/中/下签 verdict
  hintEn: string;
  hintZh: string;
};

const WIKI = "https://commons.wikimedia.org/wiki/Special:FilePath/";
const img = (file: string) => `${WIKI}${file}`;

const MAJORS: Omit<TarotCard, "id" | "suit">[] = [
  { nameEn: "The Fool", nameZh: "愚者", glyph: "0", image: img("RWS_Tarot_00_Fool.jpg"), score: 1, hintEn: "A new beginning without a map — leap on faith.", hintZh: "没有地图的启程 —— 以信念纵身一跃。" },
  { nameEn: "The Magician", nameZh: "魔术师", glyph: "I", image: img("RWS_Tarot_01_Magician.jpg"), score: 2, hintEn: "The tools are already in your hands.", hintZh: "工具早已在你手中。" },
  { nameEn: "The High Priestess", nameZh: "女祭司", glyph: "II", image: img("RWS_Tarot_02_High_Priestess.jpg"), score: 1, hintEn: "Listen to what you already know.", hintZh: "倾听你已经知道的。" },
  { nameEn: "The Empress", nameZh: "女皇", glyph: "III", image: img("RWS_Tarot_03_Empress.jpg"), score: 2, hintEn: "Abundance ripens where you nourish.", hintZh: "你滋养之处，丰盈自会生长。" },
  { nameEn: "The Emperor", nameZh: "皇帝", glyph: "IV", image: img("RWS_Tarot_04_Emperor.jpg"), score: 1, hintEn: "Structure and boundaries protect the vision.", hintZh: "结构与边界，护住你的愿景。" },
  { nameEn: "The Hierophant", nameZh: "教皇", glyph: "V", image: img("RWS_Tarot_05_Hierophant.jpg"), score: 0, hintEn: "Tradition offers a doorway — use it, don't marry it.", hintZh: "传统是一道门 —— 借它通行，勿嫁给它。" },
  { nameEn: "The Lovers", nameZh: "恋人", glyph: "VI", image: img("RWS_Tarot_06_Lovers.jpg"), score: 2, hintEn: "A choice about values, not just love.", hintZh: "关于价值观的抉择，不仅是感情。" },
  { nameEn: "The Chariot", nameZh: "战车", glyph: "VII", image: img("RWS_Tarot_07_Chariot.jpg"), score: 1, hintEn: "Willpower steers opposing forces.", hintZh: "意志驾驭相反之力。" },
  { nameEn: "Strength", nameZh: "力量", glyph: "VIII", image: img("RWS_Tarot_08_Strength.jpg"), score: 2, hintEn: "Gentleness is your real strength.", hintZh: "温柔才是你真正的力量。" },
  { nameEn: "The Hermit", nameZh: "隐者", glyph: "IX", image: img("RWS_Tarot_09_Hermit.jpg"), score: 0, hintEn: "Withdraw to see clearly.", hintZh: "退一步，才看得清。" },
  { nameEn: "Wheel of Fortune", nameZh: "命运之轮", glyph: "X", image: img("RWS_Tarot_10_Wheel_of_Fortune.jpg"), score: 1, hintEn: "A cycle turns beyond your control.", hintZh: "一轮周期，超出你的控制。" },
  { nameEn: "Justice", nameZh: "正义", glyph: "XI", image: img("RWS_Tarot_11_Justice.jpg"), score: 0, hintEn: "The scales settle exactly as you have weighed.", hintZh: "天平精确地回到你曾放的分量。" },
  { nameEn: "The Hanged Man", nameZh: "倒吊人", glyph: "XII", image: img("RWS_Tarot_12_Hanged_Man.jpg"), score: -1, hintEn: "A necessary pause, seen upside-down.", hintZh: "一段必要的停顿，倒着看世界。" },
  { nameEn: "Death", nameZh: "死神", glyph: "XIII", image: img("RWS_Tarot_13_Death.jpg"), score: -1, hintEn: "An ending that clears the way.", hintZh: "一段结束，为新事腾出位置。" },
  { nameEn: "Temperance", nameZh: "节制", glyph: "XIV", image: img("RWS_Tarot_14_Temperance.jpg"), score: 1, hintEn: "Mix the extremes into something drinkable.", hintZh: "把两极调和成可以入口的东西。" },
  { nameEn: "The Devil", nameZh: "恶魔", glyph: "XV", image: img("RWS_Tarot_15_Devil.jpg"), score: -2, hintEn: "The chain is looser than it feels.", hintZh: "锁链其实比你以为的松。" },
  { nameEn: "The Tower", nameZh: "高塔", glyph: "XVI", image: img("RWS_Tarot_16_Tower.jpg"), score: -2, hintEn: "A sudden collapse — necessary, not the end.", hintZh: "一次突然的坍塌 —— 必要，并非终点。" },
  { nameEn: "The Star", nameZh: "星星", glyph: "XVII", image: img("RWS_Tarot_17_Star.jpg"), score: 2, hintEn: "Quiet hope after difficulty.", hintZh: "低谷之后，安静的希望。" },
  { nameEn: "The Moon", nameZh: "月亮", glyph: "XVIII", image: img("RWS_Tarot_18_Moon.jpg"), score: -1, hintEn: "Not everything visible is real.", hintZh: "所见并非皆真。" },
  { nameEn: "The Sun", nameZh: "太阳", glyph: "XIX", image: img("RWS_Tarot_19_Sun.jpg"), score: 2, hintEn: "Clarity, warmth, arrival.", hintZh: "澄澈、温暖、抵达。" },
  { nameEn: "Judgement", nameZh: "审判", glyph: "XX", image: img("RWS_Tarot_20_Judgement.jpg"), score: 1, hintEn: "A calling that will not go quiet.", hintZh: "一个不会安静下来的呼唤。" },
  { nameEn: "The World", nameZh: "世界", glyph: "XXI", image: img("RWS_Tarot_21_World.jpg"), score: 2, hintEn: "The circle closes — take the bow.", hintZh: "圆环闭合 —— 请谢幕，也请再启。" },
];

type SuitDef = {
  key: "wands" | "cups" | "swords" | "pentacles";
  zh: string;
  en: string;
  file: string; // e.g. "Wands"
  scores: number[]; // 14 entries, ace .. king
  hints: [string, string][]; // 14 entries [en, zh]
};

const SUITS: SuitDef[] = [
  {
    key: "wands", en: "Wands", zh: "权杖", file: "Wands",
    scores: [2, 1, 1, 2, -1, 2, -1, 1, -1, -2, 1, 1, 1, 2],
    hints: [
      ["A spark of pure initiative.", "纯粹的起心动念。"],
      ["Two horizons — you must choose one.", "两片天地 —— 你只能选一。"],
      ["Ships coming in on your patience.", "船因你的耐心而靠港。"],
      ["A celebration, a threshold crossed.", "一场庆典，一个门槛已过。"],
      ["Friction that clarifies who's in.", "冲突，让人显形。"],
      ["Public victory earned in private.", "在私底下赢来的公开胜利。"],
      ["Defend the higher ground.", "守住高处。"],
      ["Fast news — reply within the day.", "快讯 —— 当天回应。"],
      ["One more push, and you're through.", "再撑一下，就穿过去了。"],
      ["Put down what isn't yours to carry.", "放下不该你扛的。"],
      ["A curious apprentice returns.", "一位好奇的学徒来访。"],
      ["A brave scout, half-thought-through.", "勇敢的先锋，只是没想清楚。"],
      ["A generous, warm leader.", "慷慨温热的领导者。"],
      ["Vision that others will follow.", "众人会追随的远见。"],
    ],
  },
  {
    key: "cups", en: "Cups", zh: "圣杯", file: "Cups",
    scores: [2, 2, 2, 1, -2, 1, -1, -1, 2, 2, 2, 1, 2, 1],
    hints: [
      ["The heart overflowing.", "心之满溢。"],
      ["Mutual recognition — the real kind.", "彼此看见 —— 真的那种。"],
      ["Celebration with your chosen people.", "与所选之人的欢宴。"],
      ["Boredom, but a fifth cup is offered.", "厌倦 —— 但第五只杯正被递来。"],
      ["Grief needs its full weight.", "悲伤，需要给它完整的分量。"],
      ["A tender memory, returning gently.", "温柔归来的旧记忆。"],
      ["Too many fantasies, too few decisions.", "幻想太多，决定太少。"],
      ["Walk away from what no longer feeds.", "离开已不再滋养的。"],
      ["The wish, granted.", "所愿成真。"],
      ["Family, in the deepest sense.", "家 —— 最深层的意义。"],
      ["A quiet, poetic newcomer.", "安静诗意的新来者。"],
      ["A romantic idealist arrives.", "一位浪漫理想主义者到来。"],
      ["The most emotionally fluent card.", "全牌中最擅长感受之人。"],
      ["Mature, steady, receiving affection.", "成熟、稳定、能接住感情。"],
    ],
  },
  {
    key: "swords", en: "Swords", zh: "宝剑", file: "Swords",
    scores: [1, -1, -2, 0, -2, 1, -1, -2, -2, -2, -1, 0, 0, 1],
    hints: [
      ["A clean, honest breakthrough of thought.", "干净诚实的思维突破。"],
      ["Stalemate — take off the blindfold.", "僵局 —— 请拿下蒙眼布。"],
      ["Heartbreak named plainly.", "被直白说出的心碎。"],
      ["Rest — you're not quitting, you're recovering.", "休息 —— 不是放弃，是回血。"],
      ["A pyrrhic argument.", "赢下来却输掉的争吵。"],
      ["Crossing to calmer waters.", "渡向更平静的水面。"],
      ["A partial theft — check what's missing.", "一次局部的偷取 —— 清点缺失。"],
      ["The exit exists — you just haven't looked.", "出口一直在 —— 你还没抬头看。"],
      ["3am fears, mostly imagined.", "凌晨三点的恐惧，多半是想象。"],
      ["Rock bottom — the only way is up.", "最低点 —— 只剩上升。"],
      ["A sharp, observant learner.", "敏锐善观察的学习者。"],
      ["Rushing in, all momentum, half strategy.", "冲进来 —— 全是气势，只有半个策略。"],
      ["Clear boundaries, hard-won.", "来之不易的清晰边界。"],
      ["Cold logic, fair authority.", "冷静的逻辑，公正的权威。"],
    ],
  },
  {
    key: "pentacles", en: "Pentacles", zh: "钱币", file: "Pents",
    scores: [2, 1, 1, 2, -1, 1, 1, 1, 1, 2, 1, 1, 2, 2],
    hints: [
      ["A tangible offer arrives.", "一个可触摸的机会到来。"],
      ["Juggle only what actually fits.", "只玩你真接得住的球。"],
      ["Skilled work, publicly recognized.", "被公开看见的匠人手艺。"],
      ["Held tightly — a little too tightly.", "抓得紧 —— 略嫌太紧。"],
      ["A cold season — but the door is open.", "冷冬 —— 但门其实是开的。"],
      ["Giving and receiving, in balance.", "给与拿，回到平衡。"],
      ["Patience while the crop matures.", "等待作物长熟的耐心。"],
      ["Diligence, one stroke at a time.", "一笔一笔的勤勉。"],
      ["Independence, self-earned wealth.", "自力挣来的独立与财富。"],
      ["Legacy, family wealth, deep roots.", "家业、深根、传承。"],
      ["A dedicated, methodical student.", "认真按部就班的学生。"],
      ["A slow, reliable finisher.", "缓慢但可靠的完工者。"],
      ["Warm, generous, materially secure.", "温暖慷慨，物质安稳。"],
      ["Prosperous, established, seasoned.", "已建立的、老练的丰盛。"],
    ],
  },
];

const RANK_GLYPHS = ["A", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "Page", "Knight", "Queen", "King"];
const RANK_ZH = ["A", "二", "三", "四", "五", "六", "七", "八", "九", "十", "侍从", "骑士", "皇后", "国王"];
const RANK_EN = ["Ace", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Page", "Knight", "Queen", "King"];

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

export const TAROT_78: TarotCard[] = [
  ...MAJORS.map((m, i) => ({ ...m, id: `M${i}`, suit: "major" as const })),
  ...SUITS.flatMap((s) =>
    s.scores.map((score, i) => ({
      id: `${s.key[0].toUpperCase()}${i + 1}`,
      nameEn: `${RANK_EN[i]} of ${s.en}`,
      nameZh: `${s.zh}${RANK_ZH[i]}`,
      glyph: RANK_GLYPHS[i],
      suit: s.key,
      image: img(`${s.file}${pad2(i + 1)}.jpg`),
      score,
      hintEn: s.hints[i][0],
      hintZh: s.hints[i][1],
    })),
  ),
];
