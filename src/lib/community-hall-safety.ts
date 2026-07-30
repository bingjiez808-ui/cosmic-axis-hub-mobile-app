/**
 * 同门 · 众生之厅 — content safety + privacy scrubbing (pure helpers).
 *
 * Runs server-side before any letter/reply is persisted. Two outcomes:
 *   - `blocked`  → refuse the write outright (contact exchange, payment
 *                  solicitation, QR/-code drops, abuse).
 *   - `review`   → persist with status `pending` so a human approves it
 *                  (crisis / self-harm / illegal / high-risk signals).
 * Nothing here logs the letter body; only category codes are returned.
 */

export const AGE_BANDS = ["18-22", "23-29", "30-39", "40-49", "50-59", "60+"] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

export type SafetyVerdict = {
  action: "allow" | "review" | "block";
  categories: string[];
};

const CONTACT_PATTERNS: Array<[string, RegExp]> = [
  ["email", /[a-z0-9._%+-]+\s*(@|＠|\(at\)|\[at\])\s*[a-z0-9.-]+\.[a-z]{2,}/i],
  ["phone", /(?:\+?\d[\s-]?){7,15}\d/],
  ["wechat", /(微信|weixin|wechat|vx|＋v|加\s*v|威信|qq\s*号|q\s*q)\s*[:：]?\s*[a-z0-9_-]{4,}/i],
  ["wechat_hint", /(加|留|私)\s*(我)?\s*(微信|vx|wx|qq|line|whatsapp|telegram|tg)/i],
  ["social", /(instagram|ins账号|抖音号|小红书号|telegram|whats\s?app|line\s?id|discord#?\d{3,})/i],
  ["qrcode", /(二维码|扫码|扫一扫|qr\s?code|长按识别)/i],
  ["url", /(https?:\/\/|www\.[a-z0-9-]+\.[a-z]{2,}|[a-z0-9-]+\.(com|cn|net|org|xyz|top|io)\b)/i],
];

const SOLICITATION_PATTERNS: Array<[string, RegExp]> = [
  ["payment", /(转账|汇款|付款码|支付宝|微信支付|红包|打款|银行卡号|收款码|venmo|paypal|cash\s?app)/i],
  ["financial", /(投资|理财|炒股|期货|外汇|数字货币|虚拟币|比特币|带单|稳赚|包赚|返利|杀猪盘|贷款|放款|额度)/i],
  ["scam", /(刷单|兼职日结|裸聊|博彩|赌场|下注|色情|代考|办证|发票代开)/i],
  ["recruit", /(加入我们的群|进群领|私信领取|一对一辅导收费|付费咨询请联系)/i],
];

const ABUSE_PATTERNS: Array<[string, RegExp]> = [
  ["abuse", /(去死|滚出去|傻逼|贱人|白痴|智障|杂种|fuck\s?you|bitch|idiot|kys)/i],
  ["hate", /(死全家|下地狱|该死的女人|该死的男人)/i],
];

const REVIEW_PATTERNS: Array<[string, RegExp]> = [
  ["self_harm", /(自杀|自残|不想活|活不下去|结束生命|割腕|跳楼|安眠药过量|suicide|kill myself|self[-\s]?harm|end my life)/i],
  ["violence", /(杀了他|杀了她|报复社会|伤害别人|制造爆炸|枪支|hurt someone)/i],
  ["illegal", /(毒品|冰毒|大麻|走私|偷渡|洗钱|黑客攻击|盗号)/i],
  ["minor_risk", /(未成年|我今年1[0-7]岁|初中生|小学生|under\s?18)/i],
  ["privacy", /(身份证号|护照号|social security|银行卡密码|家庭住址是)/i],
];

function match(list: Array<[string, RegExp]>, text: string): string[] {
  return list.filter(([, re]) => re.test(text)).map(([code]) => code);
}

/** Classify a letter/reply body. Never returns the body itself. */
export function screenCommunityText(raw: string): SafetyVerdict {
  const text = (raw ?? "").normalize("NFKC");
  const blocked = [
    ...match(CONTACT_PATTERNS, text),
    ...match(SOLICITATION_PATTERNS, text),
    ...match(ABUSE_PATTERNS, text),
  ];
  if (blocked.length > 0) return { action: "block", categories: unique(blocked) };
  const review = match(REVIEW_PATTERNS, text);
  if (review.length > 0) return { action: "review", categories: unique(review) };
  return { action: "allow", categories: [] };
}

function unique(items: string[]): string[] {
  return Array.from(new Set(items));
}

/** Human-facing refusal copy; deliberately generic, no echo of user text. */
export function safetyMessage(categories: string[]): string {
  if (categories.some((c) => ["email", "phone", "wechat", "wechat_hint", "social", "qrcode", "url"].includes(c))) {
    return "为了保护双方隐私，信中不能包含手机号、微信号、邮箱、二维码或外部链接。";
  }
  if (categories.some((c) => ["payment", "financial", "scam", "recruit"].includes(c))) {
    return "信中不能包含金钱往来、投资招揽或商业推广内容。";
  }
  return "这封信包含不适合公开寄出的内容，请修改后再试。";
}

export function isAgeBand(value: unknown): value is AgeBand {
  return typeof value === "string" && (AGE_BANDS as readonly string[]).includes(value);
}
