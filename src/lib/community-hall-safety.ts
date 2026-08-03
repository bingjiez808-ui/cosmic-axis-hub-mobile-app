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

/**
 * 政治法规 / 违法 / 涉黄 — content the hall never carries, in any direction.
 * Kept deliberately narrow so ordinary talk about work, news or the body is
 * not caught: each pattern needs an explicit act, trade or slur.
 */
const POLITICAL_PATTERNS: Array<[string, RegExp]> = [
  ["subversion", /(颠覆(国家)?政权|推翻政府|煽动(颠覆|分裂|叛乱|暴乱)|武装暴动|政变)/],
  ["separatism", /(分裂国家|港独|台独|藏独|疆独|国家分裂活动)/],
  ["terror", /(恐怖组织|恐怖袭击|极端主义宣传|圣战|招募.{0,4}恐怖|制造恐慌袭击|terrorist attack|jihad recruit)/i],
  ["political_org", /(非法集会|游行示威组织|串联上街|散布政治谣言|颠覆宣传单)/],
  ["banned_speech", /(反动标语|反动传单|煽动仇恨(民族|宗教)|种族清洗|纳粹万岁|heil hitler|white power)/i],
];

const SEXUAL_PATTERNS: Array<[string, RegExp]> = [
  ["porn", /(色情(片|网站|资源|链接)|黄片|av资源|成人视频|情色小说|porn\s?(site|link|video)|nsfw\s?link|onlyfans)/i],
  ["prostitution", /(卖淫|嫖娼|援交|包夜|一夜情交易|上门服务.{0,6}(价|钱)|外围女|楼凤|escort\s?service|sex\s?for\s?money)/i],
  ["sexual_solicit", /(约炮|开房吗|裸聊|裸照|发张裸|视频裸|想睡你|口交|做爱吧|send\s?nudes|dick\s?pic|sext(ing)?)/i],
  ["csam", /(幼女|萝莉资源|未成年.{0,4}(裸|性交|性服务)|child\s?porn|underage\s?(nude|sex))/i],
];

const ILLEGAL_PATTERNS: Array<[string, RegExp]> = [
  ["drug_trade", /(卖(冰毒|大麻|摇头丸)|买(冰毒|大麻|摇头丸)|贩毒|毒品(交易|渠道|货源)|上头电子烟|buy\s?(meth|cocaine|heroin))/i],
  ["weapon_trade", /(卖枪|买枪|枪支(买卖|货源)|仿真枪出售|制作(炸药|爆炸物)|土制炸弹|how to make a bomb)/i],
  ["forgery", /(办假证|假身份证|假学历|假章|代开发票|伪造(公章|证件|流水))/i],
  ["black_market", /(洗钱渠道|跑分|四件套(出售|收购)|黑卡|盗刷|开票洗单|人体器官(买卖|出售)|代孕(中介|服务))/i],
  ["gambling", /(网络赌博|赌球|开赌盘|六合彩(网站|下注)|博彩平台|online casino invite)/i],
  ["hacking", /(黑客(接单|服务)|盗号(接单|服务)|开房记录查询|人肉搜索(服务|接单)|查开房|信息贩卖)/i],
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
    ...match(POLITICAL_PATTERNS, text),
    ...match(SEXUAL_PATTERNS, text),
    ...match(ILLEGAL_PATTERNS, text),
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

const CONTACT_CODES = ["email", "phone", "wechat", "wechat_hint", "social", "qrcode", "url"];
const SOLICIT_CODES = ["payment", "financial", "scam", "recruit"];
export const POLITICAL_CODES = [
  "subversion",
  "separatism",
  "terror",
  "political_org",
  "banned_speech",
];
export const SEXUAL_CODES = ["porn", "prostitution", "sexual_solicit", "csam"];
export const ILLEGAL_CODES = [
  "drug_trade",
  "weapon_trade",
  "forgery",
  "black_market",
  "gambling",
  "hacking",
];

/** Stable refusal code; the client turns it into bilingual copy. */
export function safetyCode(
  categories: string[],
):
  | "content_contact"
  | "content_solicitation"
  | "content_political"
  | "content_sexual"
  | "content_illegal"
  | "content_rejected" {
  if (categories.some((c) => POLITICAL_CODES.includes(c))) return "content_political";
  if (categories.some((c) => SEXUAL_CODES.includes(c))) return "content_sexual";
  if (categories.some((c) => ILLEGAL_CODES.includes(c))) return "content_illegal";
  if (categories.some((c) => CONTACT_CODES.includes(c))) return "content_contact";
  if (categories.some((c) => SOLICIT_CODES.includes(c))) return "content_solicitation";
  return "content_rejected";
}

/** Human-facing refusal copy; deliberately generic, no echo of user text. */
export function safetyMessage(categories: string[]): string {
  if (categories.some((c) => POLITICAL_CODES.includes(c))) {
    return "信中不能包含违反法律法规的政治内容、煽动性言论或极端主义宣传。";
  }
  if (categories.some((c) => SEXUAL_CODES.includes(c))) {
    return "信中不能包含色情、性交易或性骚扰内容。众生之厅只谈人生困惑。";
  }
  if (categories.some((c) => ILLEGAL_CODES.includes(c))) {
    return "信中不能包含违法交易、伪造证件、赌博、毒品或其他违法行为的内容。";
  }
  if (categories.some((c) => CONTACT_CODES.includes(c))) {
    return "为了保护双方隐私，信中不能包含手机号、微信号、邮箱、二维码或外部链接。";
  }
  if (categories.some((c) => SOLICIT_CODES.includes(c))) {
    return "信中不能包含金钱往来、投资招揽或商业推广内容。";
  }
  return "这封信包含不适合公开寄出的内容，请修改后再试。";
}

/**
 * Categories that must never be auto-published and must reach a human fast:
 * self-harm, threats of violence, and anything hinting the writer is a minor.
 */
const CRISIS_CATEGORIES = ["self_harm", "violence", "minor_risk", "csam", "terror"] as const;

export type RiskLevel = "none" | "review" | "crisis";

/** Map a verdict to the persisted risk level used by the moderation queue. */
export function riskLevel(verdict: SafetyVerdict): RiskLevel {
  if (verdict.action === "block") return "crisis";
  if (verdict.categories.some((c) => (CRISIS_CATEGORIES as readonly string[]).includes(c))) {
    return "crisis";
  }
  return verdict.action === "review" ? "review" : "none";
}

/** True when the writer may be in danger and should see support resources. */
export function needsSupportResources(verdict: SafetyVerdict): boolean {
  return verdict.categories.includes("self_harm");
}

export function isAgeBand(value: unknown): value is AgeBand {
  return typeof value === "string" && (AGE_BANDS as readonly string[]).includes(value);
}
