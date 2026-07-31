export const FPS = 30;

export const GOLD = "#E8C87A";
export const GOLD_SOFT = "#C9A24A";
export const CREAM = "#F6EBD2";
export const INK = "#07070d";

/** Scene table — same story beats for both orientations. */
export type Beat = {
  id: string;
  /** desktop (16:9) shot */
  shotD: string;
  /** mobile (9:16) shot */
  shotM: string;
  kicker: string;
  title: string;
  sub: string;
  /** focus point of the screenshot, 0..1 */
  focus: { x: number; y: number };
  duration: number;
};

export const BEATS: Beat[] = [
  {
    id: "ritual",
    shotD: "shots/04-ritual-d.png",
    shotM: "shots/04-ritual-m.png",
    kicker: "01 · 开启仪式",
    title: "一次登记，四种古老语言同时开口",
    sub: "西方占星 · 印度吠陀 · 八字 · 紫微斗数",
    focus: { x: 0.5, y: 0.32 },
    duration: 110,
  },
  {
    id: "traditions",
    shotD: "shots/06-traditions-d.png",
    shotM: "shots/06-traditions-m.png",
    kicker: "02 · 四大体系",
    title: "四套宇宙观，读同一份出生资料",
    sub: "分歧与共识，都摊开给你看",
    focus: { x: 0.5, y: 0.4 },
    duration: 100,
  },
  {
    id: "report",
    shotD: "shots/05-report-d.png",
    shotM: "shots/05-report-m.png",
    kicker: "03 · 深度报告",
    title: "24 章合参报告，每一句都能追到证据",
    sub: "诗意开篇 · 依据可查 · 落到本周行动",
    focus: { x: 0.5, y: 0.45 },
    duration: 110,
  },
  {
    id: "math",
    shotD: "shots/07-math-d.png",
    shotM: "shots/07-math-m.png",
    kicker: "04 · 数学馆",
    title: "七条人生曲线，看见起伏何时发生",
    sub: "学业 · 事业 · 爱情 · 家庭 · 人际 · 财富 · 健康",
    focus: { x: 0.5, y: 0.45 },
    duration: 110,
  },
  {
    id: "daily",
    shotD: "shots/03-guide2-d.png",
    shotM: "shots/03-guide2-m.png",
    kicker: "05 · 今日阅览室",
    title: "每天一页今日信号",
    sub: "本地推算不花钱，想要馆员手记时再唤醒 AI",
    focus: { x: 0.5, y: 0.4 },
    duration: 100,
  },
  {
    id: "hall",
    shotD: "shots/08-community-d.png",
    shotM: "shots/08-community-m.png",
    kicker: "06 · 同门 · 众生之厅",
    title: "把问题写成一封信，等一次回音",
    sub: "匿名寄出 · 先贤回信 · 公开回音墙",
    focus: { x: 0.5, y: 0.42 },
    duration: 110,
  },
];
