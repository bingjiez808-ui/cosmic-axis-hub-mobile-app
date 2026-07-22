/**
 * daily-plain-language-v1 — deterministic plain-language interpreter
 * over `daily-facts-v1` + `daily-domain-score-v2`.
 *
 * Rules:
 *  - Zero AI tokens. No randomness. Same input → identical output.
 *  - Chinese output MUST NOT contain "三分/四分/对分", English planet
 *    names, or raw snake_case keys. Those live only in the collapsed
 *    "evidence" area, formatted by @/lib/daily-format.
 *  - Every field is grounded in `DailyDomainScore.breakdown` /
 *    `DailyFacts`. When there is no strong signal, the caller must
 *    emit the neutral template (band=neutral) which explicitly says
 *    "no strong signal today, stay observant".
 *  - Love: never promises meeting/breakup. Body_mind: no diagnosis.
 *    Finance: no return prediction, only budget/review/impulse advice.
 */
import type { Lang } from "@/lib/i18n";
import type { DailyDomainScore, DomainKey, SignalBand } from "@/lib/daily-domain-score";
import type { DailyFacts } from "@/lib/daily-facts";

export const DAILY_PLAIN_LANGUAGE_VERSION = "daily-plain-v1";

export type PlainLanguageDomainOutput = {
  domain: DomainKey | "overall";
  band: SignalBand;
  headline: string;              // one-sentence takeaway
  may_show_as: string;           // "today may feel like…"
  do_today: string[];            // 1–2 concrete actions
  avoid_today: string[];         // 1–2 concrete cautions
  week_trend: string;            // reserved — filled with a generic line for now
  confidence: "low" | "medium" | "high";
  missing_data_note: string | null;
  evidence_refs: string[];
};

type TemplateKey = "overall" | DomainKey;

type BandTemplates = {
  headline: string;
  may_show_as: string;
  do_today: string[];
  avoid_today: string[];
  week_trend: string;
};

type DomainTemplateSet = Record<SignalBand, BandTemplates>;
type FullDict = Record<TemplateKey, DomainTemplateSet>;

/* ------------------------------------------------------------------ */
/* Templates — hand-authored, cover 5 domains + overall × 4 bands × 2 */
/* languages. Kept concise; wording follows the safety rules above.   */
/* ------------------------------------------------------------------ */

const ZH: FullDict = {
  overall: {
    supportive: {
      headline: "整体节奏顺，适合把重要的事推进一步。",
      may_show_as: "今天可能表现为：思路清晰、协作顺畅，愿意做决定。",
      do_today: [
        "挑一件最有价值的事，先做能验证方向的第一步。",
        "把长期搁置的沟通用简短方式收尾。",
      ],
      avoid_today: [
        "别把顺利当作全部答应下来的理由，先估算真实的时间成本。",
      ],
      week_trend: "本周整体基调偏支持，越靠近今天越顺。",
    },
    neutral: {
      headline: "整体没有强烈信号，保持平稳观察即可。",
      may_show_as: "今天可能表现为：不好不坏，按计划走会比较踏实。",
      do_today: [
        "把今天当作复盘日：整理最近的任务清单。",
        "留 20 分钟做一件你一直想做但没开始的小事。",
      ],
      avoid_today: [
        "不必强行推进重要决策，等条件更清楚再说。",
      ],
      week_trend: "本周节奏平缓，重点在于稳定而非突破。",
    },
    mixed: {
      headline: "信号方向有分歧，注意分清楚哪一件事真正重要。",
      may_show_as: "今天可能表现为：一头顺利、另一头卡壳，需要在两者之间取舍。",
      do_today: [
        "先处理最能带来确定进展的一件事。",
        "把复杂任务拆成三步，只保证今天完成第一步。",
      ],
      avoid_today: [
        "不要在情绪拉扯时同时推进两件重要事。",
      ],
      week_trend: "本周有起有伏，避免把某一天的感觉当作整周结论。",
    },
    caution: {
      headline: "整体阻力偏大，宜保持观察、暂缓不可逆决定。",
      may_show_as: "今天可能表现为：容易被打断、需要重新协调预期。",
      do_today: [
        "把今天要交付的事再核对一遍关键点。",
        "先照顾好基本作息，把状态调回中位。",
      ],
      avoid_today: [
        "避免在情绪高点做不可逆的决定或承诺。",
        "重要文件/付款/发送前，再检查一次。",
      ],
      week_trend: "本周阻力集中在近几天，越往后越缓。",
    },
  },
  love: {
    supportive: {
      headline: "关系里的沟通更容易被听懂，适合把想说的话说清楚。",
      may_show_as: "今天可能表现为：对方比较愿意听，你也更容易表达柔软的部分。",
      do_today: [
        "把一直想道谢或想澄清的话，用两三句写下来再说。",
        "主动约一次不带任务的相处，比如散步或吃饭。",
      ],
      avoid_today: [
        "别把顺利当成对方永远都会这么配合，边界仍要留。",
      ],
      week_trend: "本周关系的耐心整体偏高。",
    },
    neutral: {
      headline: "关系上没有强烈信号，保持平常的节奏就好。",
      may_show_as: "今天可能表现为：不冷不热，日常事务照旧。",
      do_today: [
        "记住一件对方最近提过的小事，找机会呼应一下。",
      ],
      avoid_today: [
        "不必要求关系今天就有明显变化。",
      ],
      week_trend: "关系节奏平稳，重点是保持一致的相处频率。",
    },
    mixed: {
      headline: "关系里冷热并存，先确认对方真正在意的重点。",
      may_show_as: "今天可能表现为：某个话题很顺，另一个话题一碰就紧。",
      do_today: [
        "在讨论敏感话题前，先问一句“你现在最担心的是什么？”",
        "把要求换成邀请：“我们要不要一起…”",
      ],
      avoid_today: [
        "避免二选一句式，例如“要么…要么…”。",
      ],
      week_trend: "本周关系需要多做一次澄清，才能对齐。",
    },
    caution: {
      headline: "沟通容易各说各话，先降温再谈重要事。",
      may_show_as: "今天可能表现为：一句话被解读成另一种意思。",
      do_today: [
        "把重要消息先写成草稿，隔半天再决定发不发。",
        "如果起了火，先约个明天的具体时间再谈。",
      ],
      avoid_today: [
        "避免在情绪高点说“永远/从来/一定”这类绝对词。",
        "不要临时改动之前的承诺，先解释理由。",
      ],
      week_trend: "本周关系上的解释成本较高，节奏放慢反而更省力。",
    },
  },
  study: {
    supportive: {
      headline: "注意力比较集中，适合啃一段之前推不动的内容。",
      may_show_as: "今天可能表现为：读得进去、逻辑更容易串起来。",
      do_today: [
        "选一段最难的内容做主攻，专注 30 分钟不切换。",
        "把今天学到的用自己的话写三行摘要。",
      ],
      avoid_today: [
        "别把整块专注时间浪费在整理笔记这种低强度任务上。",
      ],
      week_trend: "本周学习的深度比广度更值得投入。",
    },
    neutral: {
      headline: "学习状态一般，靠固定流程比靠灵感更稳。",
      may_show_as: "今天可能表现为：能坐下来，但难以突破新内容。",
      do_today: [
        "复习昨天的关键点，比学新内容更划算。",
        "做一次“番茄钟 25 分钟”，只做一件小任务。",
      ],
      avoid_today: [
        "不必今天就攻下最难的一章。",
      ],
      week_trend: "本周学习靠积累，稳定 > 冲刺。",
    },
    mixed: {
      headline: "理解与专注不同步，需要挑对该做哪一件。",
      may_show_as: "今天可能表现为：一部分内容很清晰，另一部分反复读也进不去。",
      do_today: [
        "先做已经理解的题目，把节奏找回来再啃难点。",
        "遇到卡点，先写下具体是哪一句/哪一步不懂。",
      ],
      avoid_today: [
        "避免同时开三门课来回切换。",
      ],
      week_trend: "本周学习收获会集中在少数几个主题上。",
    },
    caution: {
      headline: "容易分心，先把干扰源收好再开始。",
      may_show_as: "今天可能表现为：读了半页就想拿手机。",
      do_today: [
        "把手机放到看不见的地方，只留 25 分钟先做一件事。",
        "如果状态实在差，改做低强度复习，别硬啃新内容。",
      ],
      avoid_today: [
        "不要今天决定放弃一门长期学习计划，先睡一觉再评估。",
      ],
      week_trend: "本周专注需要更明确的边界。",
    },
  },
  career: {
    supportive: {
      headline: "推进力较好，适合把关键事项定下来。",
      may_show_as: "今天可能表现为：会议里能把结论收拢、决定不再拖。",
      do_today: [
        "把一件搁置的决定用一两句话在群里明确掉。",
        "更新一份需要长期跟进的任务的最新进度。",
      ],
      avoid_today: [
        "别一次性认领超出实际带宽的新任务。",
      ],
      week_trend: "本周协作与推进普遍顺畅。",
    },
    neutral: {
      headline: "工作没有强烈信号，按计划走。",
      may_show_as: "今天可能表现为：不轻松也不难，正常输出。",
      do_today: [
        "花 15 分钟整理下周要交付的清单。",
      ],
      avoid_today: [
        "不必主动申请新的复杂任务。",
      ],
      week_trend: "本周整体产出取决于计划落实。",
    },
    mixed: {
      headline: "推进方向不统一，先对齐目标再动手。",
      may_show_as: "今天可能表现为：一个项目在动，另一个还没澄清。",
      do_today: [
        "开工前用一句话写下今天要交付的最小结果。",
        "跟合作方确认最关键的一件事，避免误解。",
      ],
      avoid_today: [
        "避免同时开三条重要项目并行推进。",
      ],
      week_trend: "本周协作与个人推进节奏不完全一致。",
    },
    caution: {
      headline: "阻力较多，宜稳住基本盘、少做承诺。",
      may_show_as: "今天可能表现为：容易被临时事项打断、信息不完整。",
      do_today: [
        "把重要邮件/文档先存成草稿，稍后再发。",
        "遇到冲突，先复述对方的观点再回应。",
      ],
      avoid_today: [
        "避免今天签下不可逆的合作条款。",
        "重大发布前，再做一次同事互查。",
      ],
      week_trend: "本周阻力集中在初段，越往后越顺。",
    },
  },
  body_mind: {
    supportive: {
      headline: "身心状态相对充电，适合做一件让自己恢复的事。",
      may_show_as: "今天可能表现为：起床后清醒感更好，情绪不易被小事牵动。",
      do_today: [
        "安排一次真正意义上的休息，不带屏幕。",
        "花 10 分钟做点你喜欢但一直没时间做的事。",
      ],
      avoid_today: [
        "别用状态好就一次性把三件事都塞满。",
      ],
      week_trend: "本周恢复窗口相对较宽。",
    },
    neutral: {
      headline: "身心状态一般，把作息守住就够。",
      may_show_as: "今天可能表现为：既不特别累也没有明显充电感。",
      do_today: [
        "尽量按平时的时间入睡，避免熬夜追内容。",
      ],
      avoid_today: [
        "不必今天就开始新的高强度运动计划。",
      ],
      week_trend: "本周身体节奏靠一致的作息维持。",
    },
    mixed: {
      headline: "身心信号不一致，情绪与体力步调不同。",
      may_show_as: "今天可能表现为：想做事但身体没跟上，或反过来。",
      do_today: [
        "在开始工作前先做 5 分钟拉伸或深呼吸。",
        "喝水与用餐节奏比平时更规律一点。",
      ],
      avoid_today: [
        "避免连续两杯咖啡试图硬撑。",
      ],
      week_trend: "本周状态波动明显，注意留恢复日。",
    },
    caution: {
      headline: "身心处于低电量，优先照顾自己，不做过度承诺。",
      may_show_as: "今天可能表现为：睡不够、易烦躁或注意力散。（这是自我照顾提示，不是诊断。）",
      do_today: [
        "把今天的目标砍掉一半，只做最重要的一件。",
        "早半小时结束屏幕时间，睡前少刺激。",
      ],
      avoid_today: [
        "避免用刺激性食物或熬夜来推进任务。",
        "如果持续不适，请咨询专业人士，不要在这里寻找诊断答案。",
      ],
      week_trend: "本周恢复优先级高于产出。",
    },
  },
  finance: {
    supportive: {
      headline: "预算与复核的窗口较好，适合把账梳一遍。",
      may_show_as: "今天可能表现为：面对数字更冷静、能看清楚哪一项其实可以省。",
      do_today: [
        "花 15 分钟核对最近一次账单/订阅，剔除不需要的。",
        "为下个月列一份粗略预算：必要 / 想要 / 可延后。",
      ],
      avoid_today: [
        "别把“今天顺”当作追加投资的理由，收益从不因情绪出现。",
      ],
      week_trend: "本周财务重心是复核，不是加仓。",
    },
    neutral: {
      headline: "财务无强信号，按既定节奏走。",
      may_show_as: "今天可能表现为：账户与开销都相对稳定。",
      do_today: [
        "顺手记一笔今天的支出，保持记账习惯。",
      ],
      avoid_today: [
        "不必今天就调整长期资产配置。",
      ],
      week_trend: "本周财务重在维持而非动作。",
    },
    mixed: {
      headline: "机会与风险并存，先做“可以省下的那一笔”。",
      may_show_as: "今天可能表现为：既有想投的项目，也有隐约不安的信号。",
      do_today: [
        "先列出这个月已花过的三笔最大支出，看是否合乎预期。",
        "如果要动大笔资金，等 48 小时冷静期再决定。",
      ],
      avoid_today: [
        "避免看到营销文案就点进付款页。",
      ],
      week_trend: "本周财务需要一次冷静的自我复核。",
    },
    caution: {
      headline: "冲动消费/仓促决策风险较高，宜多留一天。",
      may_show_as: "今天可能表现为：想快速买/卖/签约来消解焦虑。",
      do_today: [
        "把想买/想投的东西写到清单里，明天再看。",
        "付款或提交前，再对一次金额与条款。",
      ],
      avoid_today: [
        "避免任何“今天不做就没了”的话术。",
        "避免用借贷或信用额度做非必要消费。",
      ],
      week_trend: "本周财务的关键是慢半拍。",
    },
  },
};

const EN: FullDict = {
  overall: {
    supportive: {
      headline: "Overall rhythm supports moving one important thing forward.",
      may_show_as: "Today may feel like: thinking clears, collaboration flows, decisions land.",
      do_today: [
        "Pick the single most valuable task and do the first step that validates the direction.",
        "Close a long-postponed conversation with a short, clear message.",
      ],
      avoid_today: [
        "Don't treat a smooth day as a reason to say yes to everything — estimate real time cost.",
      ],
      week_trend: "This week trends supportive; today is near the peak.",
    },
    neutral: {
      headline: "No strong signal overall — stay steady and observe.",
      may_show_as: "Today may feel like: not great, not bad — sticking to the plan works.",
      do_today: [
        "Treat today as a review day: tidy the current task list.",
        "Give 20 minutes to one small thing you keep meaning to start.",
      ],
      avoid_today: [
        "You don't have to force a major decision today; wait for clearer inputs.",
      ],
      week_trend: "A quiet week — stability beats breakthrough.",
    },
    mixed: {
      headline: "Signals disagree — get clear about which thing actually matters.",
      may_show_as: "Today may feel like: one track flowing, another stuck — you'll have to choose.",
      do_today: [
        "Start with the item that promises the most certain progress.",
        "Break the hard task into three steps; commit only to finishing step one today.",
      ],
      avoid_today: [
        "Don't try to push two heavy items forward while emotions are pulled.",
      ],
      week_trend: "The week alternates — don't take one day's feel as the whole story.",
    },
    caution: {
      headline: "Resistance is up — observe, and hold off irreversible decisions.",
      may_show_as: "Today may feel like: interruptions land more often; expectations need re-aligning.",
      do_today: [
        "Re-check the key points of anything you're delivering today.",
        "Protect the basics — sleep, meals — to nudge yourself back to center.",
      ],
      avoid_today: [
        "Avoid irreversible commitments while emotions are high.",
        "Verify amounts / recipients before sending or paying.",
      ],
      week_trend: "The friction sits in the near term and eases later in the week.",
    },
  },
  love: {
    supportive: {
      headline: "Words land more easily today — say what you've been meaning to say.",
      may_show_as: "Today may feel like: they're willing to listen; you can name the softer part.",
      do_today: [
        "Draft two or three lines of thanks or clarification before speaking.",
        "Suggest an errand-free hangout — a walk, a meal.",
      ],
      avoid_today: [
        "A good day isn't a promise of endless patience — keep your own limits in view.",
      ],
      week_trend: "Patience across the relationship trends higher this week.",
    },
    neutral: {
      headline: "Nothing loud in the relationship — keep the ordinary rhythm.",
      may_show_as: "Today may feel like: neither warm nor cold — routine holds.",
      do_today: [
        "Remember one small thing they mentioned recently and echo it later.",
      ],
      avoid_today: [
        "Don't demand a visible relationship shift today.",
      ],
      week_trend: "The relationship stays even — consistency is the point.",
    },
    mixed: {
      headline: "Warmth and distance coexist — confirm what they actually care about.",
      may_show_as: "Today may feel like: one topic flows, another tightens on contact.",
      do_today: [
        "Before a sensitive topic, ask: \"what worries you most about this right now?\"",
        "Turn requests into invitations: \"how about we try…\"",
      ],
      avoid_today: [
        "Avoid either/or framings.",
      ],
      week_trend: "Expect one round of clarification is needed to line up.",
    },
    caution: {
      headline: "Talking past each other is easy — cool the temperature before big topics.",
      may_show_as: "Today may feel like: one sentence gets read as another.",
      do_today: [
        "Draft important messages; sit with them for half a day before sending.",
        "If things heat up, schedule a specific time tomorrow to continue.",
      ],
      avoid_today: [
        "Avoid absolutes like \"never / always / must\" when tempers are high.",
        "Don't renegotiate an earlier commitment without first explaining why.",
      ],
      week_trend: "Explaining costs more this week — slower pace is cheaper.",
    },
  },
  study: {
    supportive: {
      headline: "Focus is decent — chew on something you've been putting off.",
      may_show_as: "Today may feel like: reading sticks, ideas connect.",
      do_today: [
        "Take the hardest section and give it 30 focused minutes with no switching.",
        "Summarise what you learned today in three lines of your own words.",
      ],
      avoid_today: [
        "Don't spend prime focus time re-formatting notes.",
      ],
      week_trend: "Depth pays off more than breadth this week.",
    },
    neutral: {
      headline: "Ordinary study state — process beats inspiration.",
      may_show_as: "Today may feel like: you can sit down, but new material is slow.",
      do_today: [
        "Reviewing yesterday's key points beats starting new material.",
        "Do one 25-minute pomodoro on a single small task.",
      ],
      avoid_today: [
        "You don't have to conquer the hardest chapter today.",
      ],
      week_trend: "Progress is cumulative — steady beats sprinting.",
    },
    mixed: {
      headline: "Focus and comprehension aren't in sync — choose the right task.",
      may_show_as: "Today may feel like: part is clear, part re-reads and still won't click.",
      do_today: [
        "Warm up on problems you already understand before tackling the hard part.",
        "When you hit a wall, write down exactly which line or step lost you.",
      ],
      avoid_today: [
        "Don't rotate three subjects at once.",
      ],
      week_trend: "Progress will concentrate in a few topics.",
    },
    caution: {
      headline: "Distraction is likely — remove the sources before starting.",
      may_show_as: "Today may feel like: half a page in and you reach for the phone.",
      do_today: [
        "Put the phone out of sight; give a 25-minute block to one thing.",
        "If you're truly off, switch to light review instead of forcing new material.",
      ],
      avoid_today: [
        "Don't decide to quit a long-term plan today — sleep on it first.",
      ],
      week_trend: "Focus needs clearer boundaries this week.",
    },
  },
  career: {
    supportive: {
      headline: "Momentum is available — lock in the important calls.",
      may_show_as: "Today may feel like: meetings converge, decisions stop drifting.",
      do_today: [
        "Nail down a stalled decision with one or two lines in the channel.",
        "Post an update on a project that needed long-term follow-through.",
      ],
      avoid_today: [
        "Don't accept a stack of new work beyond real bandwidth in one go.",
      ],
      week_trend: "Collaboration and momentum trend supportive.",
    },
    neutral: {
      headline: "No loud work signal — run the plan.",
      may_show_as: "Today may feel like: not light, not heavy — steady output.",
      do_today: [
        "Spend 15 minutes lining up next week's deliverables.",
      ],
      avoid_today: [
        "You don't have to volunteer for a complex new task today.",
      ],
      week_trend: "Output tracks how well plans get executed.",
    },
    mixed: {
      headline: "Directions disagree — align on the goal before touching the work.",
      may_show_as: "Today may feel like: one project moves, another still needs clarification.",
      do_today: [
        "Before starting, write one line: what's the minimum delivery for today?",
        "Confirm the single most critical point with your counterpart to avoid drift.",
      ],
      avoid_today: [
        "Avoid running three important projects in parallel today.",
      ],
      week_trend: "Personal and shared momentum aren't fully in phase.",
    },
    caution: {
      headline: "Resistance is up — hold the base, promise less.",
      may_show_as: "Today may feel like: interruptions land often; information is incomplete.",
      do_today: [
        "Keep important emails/docs in draft; send later after a review.",
        "In conflict, restate the other side's point before you respond.",
      ],
      avoid_today: [
        "Don't sign an irreversible term today.",
        "Do a peer review before any major release.",
      ],
      week_trend: "Friction is concentrated up front and eases later.",
    },
  },
  body_mind: {
    supportive: {
      headline: "Body and mind feel relatively charged — do one thing that restores.",
      may_show_as: "Today may feel like: clearer on waking, small things don't hijack the mood.",
      do_today: [
        "Book real rest — no screens.",
        "Give 10 minutes to something you enjoy but keep skipping.",
      ],
      avoid_today: [
        "Feeling good isn't a reason to stack three big tasks on top.",
      ],
      week_trend: "The recovery window is wider than usual.",
    },
    neutral: {
      headline: "Ordinary state — protecting your rhythm is enough.",
      may_show_as: "Today may feel like: not tired, not obviously charged either.",
      do_today: [
        "Aim for your usual bedtime — no late-night rabbit holes.",
      ],
      avoid_today: [
        "You don't have to start a high-intensity fitness plan today.",
      ],
      week_trend: "Body rhythm rides on consistency this week.",
    },
    mixed: {
      headline: "Signals don't match — mood and stamina step at different paces.",
      may_show_as: "Today may feel like: mind wants to work, body lags — or the reverse.",
      do_today: [
        "Do five minutes of stretching or breathing before starting.",
        "Keep meals and water a touch more regular than usual.",
      ],
      avoid_today: [
        "Don't stack a second coffee to push through.",
      ],
      week_trend: "State swings — keep a recovery day in view.",
    },
    caution: {
      headline: "Low battery — care for yourself first; don't over-commit. (This is a self-care nudge, not a diagnosis.)",
      may_show_as: "Today may feel like: under-slept, irritable or scattered.",
      do_today: [
        "Cut today's goals in half; do only the one that matters most.",
        "End screens 30 minutes earlier tonight.",
      ],
      avoid_today: [
        "Don't push with stimulants or late nights.",
        "If things persist, please consult a professional — this page is not diagnostic.",
      ],
      week_trend: "Recovery outranks output this week.",
    },
  },
  finance: {
    supportive: {
      headline: "A decent window for budgeting and reviewing — walk through the books.",
      may_show_as: "Today may feel like: calmer with numbers; you can see what's actually cuttable.",
      do_today: [
        "Spend 15 minutes on your recent bill or subscriptions — drop what you don't need.",
        "Sketch next month's budget: must / want / can-wait.",
      ],
      avoid_today: [
        "A smooth day isn't a reason to add positions — returns don't come from moods.",
      ],
      week_trend: "This week is for review, not additions.",
    },
    neutral: {
      headline: "No loud financial signal — keep the routine.",
      may_show_as: "Today may feel like: accounts and spend are steady.",
      do_today: [
        "Jot one expense as it happens; keep the habit.",
      ],
      avoid_today: [
        "You don't have to rebalance long-term allocations today.",
      ],
      week_trend: "Maintenance beats motion this week.",
    },
    mixed: {
      headline: "Opportunity and risk both — do the thing that saves money first.",
      may_show_as: "Today may feel like: something to buy or invest in, and a small unease.",
      do_today: [
        "List your three largest expenses this month; check they match expectations.",
        "If large money moves are in play, wait 48 hours before deciding.",
      ],
      avoid_today: [
        "Don't click through to checkout the moment a pitch lands.",
      ],
      week_trend: "The week wants a calm review, not a big move.",
    },
    caution: {
      headline: "Impulse spending / rushed calls risk is up — sleep on it.",
      may_show_as: "Today may feel like: buying, selling or signing to relieve anxiety.",
      do_today: [
        "Write the thing you want to buy / invest into a list; look again tomorrow.",
        "Double-check amount and terms before submitting.",
      ],
      avoid_today: [
        "Avoid any \"today only\" pressure framing.",
        "Don't use credit or loans for non-essential spending.",
      ],
      week_trend: "This week rewards half a beat slower.",
    },
  },
};

const DICTS: Record<Lang, FullDict> = { zh: ZH, en: EN };

function bandFromScore(score: number): SignalBand {
  if (score >= 62) return "supportive";
  if (score >= 52) return "neutral";
  if (score >= 45) return "mixed";
  return "caution";
}

/**
 * Interpret a single domain (or overall) into plain-language output.
 * Fully deterministic: same inputs → identical outputs, no AI, no random.
 */
export function interpretDomain(input: {
  domain: DomainKey | "overall";
  score: DailyDomainScore;
  facts: DailyFacts | null;
  lang: Lang;
}): PlainLanguageDomainOutput {
  const dict = DICTS[input.lang];
  const isOverall = input.domain === "overall";
  const target = isOverall
    ? input.score.overall
    : input.score.domains.find((d) => d.domain === input.domain) ?? null;

  // No target row — should not happen for valid inputs, but stay safe.
  if (!target) {
    const tpl = dict.overall.neutral;
    return {
      domain: input.domain,
      band: "neutral",
      headline: tpl.headline,
      may_show_as: tpl.may_show_as,
      do_today: [...tpl.do_today],
      avoid_today: [...tpl.avoid_today],
      week_trend: tpl.week_trend,
      confidence: "low",
      missing_data_note:
        input.lang === "zh"
          ? "缺少领域数据，仅显示中性提示。"
          : "Domain data unavailable — showing neutral guidance.",
      evidence_refs: [],
    };
  }

  const band: SignalBand = target.band;
  const key: TemplateKey = isOverall ? "overall" : (input.domain as DomainKey);
  const tpl = dict[key][band];

  const evidence: string[] = [];
  let confidence: "low" | "medium" | "high" = "low";
  if (!isOverall) {
    const row = input.score.domains.find((d) => d.domain === input.domain);
    if (row) {
      evidence.push(...row.evidence_refs);
      confidence = row.confidence;
    }
  } else {
    confidence = input.score.partial ? "low" : "medium";
  }

  const missing = input.score.missing_facts.length
    ? input.lang === "zh"
      ? `资料不完整：${input.score.missing_facts.join(" / ")}；分数已回落到中性基准。`
      : `Facts incomplete: ${input.score.missing_facts.join(" / ")}; scores drift back toward neutral.`
    : null;

  return {
    domain: input.domain,
    band,
    headline: tpl.headline,
    may_show_as: tpl.may_show_as,
    do_today: [...tpl.do_today],
    avoid_today: [...tpl.avoid_today],
    week_trend: tpl.week_trend,
    confidence,
    missing_data_note: missing,
    evidence_refs: evidence,
  };
}

/**
 * Overall "do today / avoid today" derived from the strongest supportive
 * and cautionary domain signals — same input → same output.
 */
export function interpretAll(input: {
  score: DailyDomainScore;
  facts: DailyFacts | null;
  lang: Lang;
}): {
  overall: PlainLanguageDomainOutput;
  domains: PlainLanguageDomainOutput[];
} {
  const overall = interpretDomain({ ...input, domain: "overall" });
  const domains = input.score.domains.map((d) =>
    interpretDomain({ ...input, domain: d.domain }),
  );
  return { overall, domains };
}
