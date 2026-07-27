/**
 * Deterministic, auditable intent classifier for the Sage Companion.
 *
 * Runs BEFORE any AI call so out-of-scope / crisis / destiny-reading
 * messages never consume the user's quota, never leak PII to the model,
 * and can be reasoned about in tests.
 *
 * Six intents:
 *   - crisis           self-harm / harm-to-others / emergency
 *   - destiny_reading  chart / astrology / bazi / ziwei / horoscope / luck
 *   - product_help     how-to / feature / login / report / usage
 *   - order_help       payment / order / refund / subscription / invoice
 *   - out_of_scope     coding / homework / translation / marketing / trivia
 *   - emotional_support (default)  small worries, venting, life
 *
 * Precedence is fixed and documented in `classifyIntent`.
 */

export type Intent =
  | "crisis"
  | "destiny_reading"
  | "product_help"
  | "order_help"
  | "out_of_scope"
  | "emotional_support";

export type IntentResult = {
  intent: Intent;
  reasons: string[];
};

const CRISIS = [
  // zh
  "自杀",
  "轻生",
  "不想活",
  "想死",
  "自残",
  "割腕",
  "跳楼",
  "服药过量",
  "杀了他",
  "杀了她",
  "杀人",
  "报复社会",
  // en
  "suicide",
  "kill myself",
  "end my life",
  "want to die",
  "self harm",
  "self-harm",
  "cut myself",
  "overdose",
  "kill him",
  "kill her",
  "hurt someone",
];

const DESTINY = [
  // zh
  "命盘",
  "星盘",
  "八字",
  "紫微",
  "紫薇",
  "命理",
  "运势",
  "星座",
  "占星",
  "占卜",
  "算命",
  "解读",
  "看盘",
  "流年",
  "大运",
  "婚姻线",
  "事业运",
  "财运",
  "桃花",
  "水星",
  "金星",
  "火星",
  "木星",
  "土星",
  "月亮",
  "上升",
  "下降",
  "宫位",
  // en
  "natal",
  "birth chart",
  "horoscope",
  "astrology",
  "zodiac",
  "bazi",
  "ziwei",
  "jyotish",
  "vedic",
  "dasha",
  "transit",
  "synastry",
  "reading",
  "fortune",
  "mercury",
  "venus",
  "mars",
  "jupiter",
  "saturn",
  "ascendant",
  "midheaven",
  "sun sign",
  "moon sign",
  "rising sign",
];

const ORDER = [
  // zh
  "订单",
  "付款",
  "支付",
  "退款",
  "扣费",
  "扣款",
  "发票",
  "收据",
  "会员",
  "订阅",
  "续费",
  "开通失败",
  "未到账",
  "涨价",
  "优惠券",
  "价格",
  // en
  "order",
  "payment",
  "paid",
  "refund",
  "charge",
  "charged",
  "billing",
  "invoice",
  "receipt",
  "subscription",
  "membership",
  "renew",
  "renewal",
  "coupon",
];

const PRODUCT = [
  // zh
  "怎么用",
  "如何使用",
  "登录",
  "登陆",
  "注册",
  "密码",
  "报告",
  "生成失败",
  "打不开",
  "闪退",
  "崩溃",
  "卡顿",
  "白屏",
  "黑屏",
  "加载不出",
  "报错",
  "bug",
  "首页",
  "个人主页",
  "命盘保存",
  "命盘删除",
  // en
  "how do i",
  "how to",
  "login",
  "log in",
  "sign in",
  "sign up",
  "password",
  "reset",
  "generate",
  "download",
  "install",
  "crash",
  "crashed",
  "frozen",
  "blank",
  "won't load",
  "cannot load",
  "error",
  "not working",
];

const OUT_OF_SCOPE = [
  // zh
  "帮我写代码",
  "写代码",
  "python",
  "javascript",
  "typescript",
  "sql",
  "写作业",
  "翻译成",
  "帮我翻译",
  "写一篇",
  "文案",
  "营销文案",
  "小红书文案",
  "抖音脚本",
  "天气",
  "股票",
  "新闻",
  "菜谱",
  "食谱",
  "推荐电影",
  "推荐游戏",
  // en
  "write code",
  "write me code",
  "debug my",
  "fix my code",
  "javascript function",
  "translate this",
  "translate to",
  "write an essay",
  "write a poem",
  "homework",
  "marketing copy",
  "ad copy",
  "recipe",
  "movie recommendation",
  "stock price",
  "weather forecast",
  "news about",
];

function hits(text: string, list: readonly string[]): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  for (const k of list) {
    if (lower.includes(k.toLowerCase())) found.push(k);
  }
  return found;
}

/**
 * Classify a single free-text message.
 *
 * Precedence (higher wins):
 *   1. crisis           — safety must never be masked
 *   2. destiny_reading  — must gate on Oracle before any AI call
 *   3. order_help       — actionable, needs real order data
 *   4. product_help     — deterministic FAQ answers, no AI
 *   5. out_of_scope     — refuse, no AI
 *   6. emotional_support (default fallback)
 */
export function classifyIntent(message: string): IntentResult {
  const text = (message ?? "").trim();
  if (!text) return { intent: "emotional_support", reasons: [] };

  const c = hits(text, CRISIS);
  if (c.length) return { intent: "crisis", reasons: c };

  const d = hits(text, DESTINY);
  if (d.length) return { intent: "destiny_reading", reasons: d };

  const o = hits(text, ORDER);
  if (o.length) return { intent: "order_help", reasons: o };

  const p = hits(text, PRODUCT);
  if (p.length) return { intent: "product_help", reasons: p };

  const s = hits(text, OUT_OF_SCOPE);
  if (s.length) return { intent: "out_of_scope", reasons: s };

  return { intent: "emotional_support", reasons: [] };
}
