/**
 * Guided Library V2 · Story chain — fixtures.
 *
 * All content in this file is DEMO placeholder content authored by hand.
 * It is not derived from real charts and must never be presented as such.
 */
import type {
  BookRef,
  HistoricalFigure,
  Insight,
  Note,
  StoryTopic,
} from "./types";

export const DEMO_FIXTURE = true as const;

export interface BookCard {
  ref: BookRef;
  icon: string;
  title: string;
  subtitle: string;
  minutes: number;
  topics: StoryTopic[];
  demo_note: string;
  quick: string;
  deep: string;
}

export const BOOKS: BookCard[] = [
  {
    ref: "self",
    icon: "◐",
    title: "基础命盘 · 你的底色",
    subtitle: "四种传统给你的第一张画像",
    minutes: 5,
    topics: ["recent"],
    demo_note: "演示内容 — 真实用户接入时会由确定性事实生成，AI 不参与排盘。",
    quick:
      "你是那种在安静里最先醒来的人：观察先于表达，选择先于承诺。习惯先看见，再决定是否加入。",
    deep:
      "西方占星把你的月亮放在偏内向的位置；印度占星的月宿指向一种"
      + "默默维护秩序的气质；八字给你偏印透干的深思型日主；紫微则给你紫微独坐的、被推举而非争夺型的核心。四个体系共同指向"
      + "『中心而不外扩』的内在结构。",
  },
  {
    ref: "career",
    icon: "◇",
    title: "事业之书 · 你适合站在哪里",
    subtitle: "行业族群 · 岗位画像 · 组织环境",
    minutes: 6,
    topics: ["career", "recent"],
    demo_note: "演示样章。付费版会展开三段真实候选行业与两种不适合的组织类型。",
    quick:
      "你适合的是需要长期判断、允许沉默的位置；不适合每天用嘴争取资源的岗位。",
    deep:
      "行业族群：教育／研究、内容与出版、法律与合规、非急性医疗；\n"
      + "岗位画像：主笔、研究员、审校、独立顾问、有明确产出边界的执行者；\n"
      + "组织环境：小而稳、允许一个人做主的团队；避免高强度销售驱动、日日会议、每日排位。",
  },
  {
    ref: "love",
    icon: "❦",
    title: "情感之书 · 你在关系里重复什么",
    subtitle: "情感需求 · 伴侣特质 · 冲突模式",
    minutes: 6,
    topics: ["love"],
    demo_note: "演示样章。付费版会展开三类真实伴侣特质与两种可预期的冲突模式。",
    quick:
      "你需要的不是热烈，而是稳定；你反复被吸引的，其实是"
      + "一种『能替你解释这个世界』的人。",
    deep:
      "情感需求：被理解、被记得、被长期守护；\n"
      + "伴侣特质：语言清晰、生活节奏稳定、愿意在冷场时先开口；\n"
      + "冲突模式：你退，他解释；你希望他先来，他希望你先说。真正的裂痕通常来自"
      + "『谁先低头』这种小事累积。",
  },
  {
    ref: "wealth",
    icon: "◆",
    title: "财富之书 · 钱在你身上的形状",
    subtitle: "现金流 · 风险偏好 · 长期资产",
    minutes: 5,
    topics: ["wealth"],
    demo_note: "演示样章。此处不承诺收益、不构成投资建议。",
    quick:
      "你的钱不适合快进快出；适合建立一个『不看每天涨跌』的长期结构。",
    deep:
      "现金流：靠稳定手艺，而不是靠交易差价；\n"
      + "风险偏好：外表保守，实际敢下重仓，但只在自己彻底看懂的方向上；\n"
      + "长期资产：耐心比选品重要；周期比信号重要；每年只做一两个大决定即可。",
  },
  {
    ref: "timeline",
    icon: "∾",
    title: "生命时间轴 · 你正在哪一段",
    subtitle: "过去三年 · 现在 · 接下来两年",
    minutes: 7,
    topics: ["career", "love", "wealth", "recent"],
    demo_note: "演示曲线。真实版本会由确定性事实模块生成，未开放二次预测。",
    quick:
      "你目前处于一个『整理与筛选』的阶段：不适合大幅扩张，适合把该收的收回来、把该说清的说清楚。",
    deep:
      "过去三年：铺开的多、收回的少；\n"
      + "现在：需要一个明确的边界动作；\n"
      + "接下来两年：一次身份切换的窗口，不是命令，是允许。",
  },
  {
    ref: "premium",
    icon: "☰",
    title: "高级综合报告（24 章）",
    subtitle: "演示禁用 · 真实报告需在个人中心解锁",
    minutes: 60,
    topics: ["career", "love", "wealth", "recent"],
    demo_note:
      "在演示环境下，此项仅呈现目录概览；正式功能在 V1 个人中心提供。",
    quick: "24 章分别覆盖：自我、事业、情感、财富、时间、四体系交叉、争议与共识、未来两年提醒。",
    deep:
      "目录节选：\n"
      + "1. 我是谁 · 2. 情绪骨架 · 3. 判断风格 · ...\n"
      + "10. 事业岗位画像 · 11. 组织环境适配 · ...\n"
      + "17. 情感冲突模式 · 18. 家庭角色 · ...\n"
      + "23. 四体系共识 · 24. 争议与提醒",
  },
  {
    ref: "sage",
    icon: "☯",
    title: "与智者对话",
    subtitle: "把一个具体问题带来问",
    minutes: 4,
    topics: ["recent"],
    demo_note:
      "演示环境不会真的调用 AI 智者。正式版本连接 V1 智者树洞，遵守事实边界。",
    quick:
      "示例：你可以问"
      + "『如果我三个月内换城市，最需要提前解决什么？』——智者只解释你的事实结构，不预测未来。",
    deep:
      "智者不会告诉你『会不会成功』；他会指出你现在的结构里、"
      + "哪一部分最容易在这件事上出错，以及你可以先做哪一件事去中和它。",
  },
];

export function bookByRef(ref: BookRef): BookCard {
  const b = BOOKS.find((x) => x.ref === ref);
  if (!b) throw new Error(`unknown book ref: ${ref}`);
  return b;
}

export const INSIGHT_BY_TOPIC: Record<StoryTopic | "overview", Insight> = {
  overview: {
    headline:
      "你没有先选择一条路径——那也是一个信息：你想要的是全景，而不是被推向某个答案。",
    why:
      "四个体系在你身上不会同时说同一件事：西方占星、印度占星、八字、紫微各自看见你不同的一面。全景阅读会把它们并排放好，再由你决定先深入哪一处。",
    next:
      "接下来先看『基础命盘 · 你的底色』和『生命时间轴 · 你正在哪一段』；读完后再选择往事业、关系或财富任何一章展开。",
    when:
      "全景阅读没有固定的时间窗口——你可以随时切换主题、随时回到地图，之前的阅读会保留在书签里。",
  },

  career: {
    headline:
      "你不是在犹豫，你在等一个『真的值得』的位置——最近一年你把两三个原本可以答应的机会推掉了，那不是错。",
    why:
      "你的判断风格偏内向、深度优先，长期让你更精准，但短期会让你显得慢。你的直觉在替你筛选『看似合适、其实消耗你』的位置。",
    next:
      "接下来一个月，把你正在做的三件事按『能不能独立署名』重新排一次；能署名的加时间，不能署名的往后放。",
    when:
      "接下来两年里有一个明显的身份切换窗口——不是命令，是允许。你不需要现在决定；你需要现在把桌面清干净。",
  },
  love: {
    headline:
      "你反复被吸引的类型，其实是想替你解释这个世界的人；但你真正需要的，是在你沉默时不追问的人。",
    why:
      "你在关系里的核心需求是被稳定守护，而不是被理解得很快。你会误把『被解读』当成『被爱』。",
    next:
      "接下来两周，注意谁在你不回消息的时候不追问、也没有消失；他/她可能就是你需要的那一类。",
    when:
      "接下来一年里，有一次关系需要重新命名——不是分开，是命名。给它一个正确的名字，比留住它更重要。",
  },
  wealth: {
    headline:
      "你的钱不适合频繁进出，它需要一个『不看每天涨跌』的结构，才会真正长出来。",
    why:
      "你的风险模式是外表保守、内心敢重仓，但只在自己彻底看懂的方向上。频繁操作会消耗你判断的电量。",
    next:
      "接下来一个月，只做一件事：把每月自动流出的钱列一遍，先砍最没有情感的那一笔。",
    when:
      "未来一年里有一次盘点自己现金流结构的窗口；不是要不要买房，是要不要把边界画清。",
  },
  recent: {
    headline:
      "最近发生的事不是巧合，是一次连着的信号——它在告诉你哪一段关系或角色已经过期。",
    why:
      "你正在一个整理阶段，任何『还留着但已经不给你能量』的关系或承诺，都会以小意外的形式提醒你。",
    next:
      "把这周所有让你不舒服的三件事写下来，看它们指向的是同一个人、还是同一种角色。",
    when:
      "接下来两个月里，会有一个自然的了结点；你不需要制造冲突，你只需要不再续期。",
  },
};

// ---------- Historical figures (fixture, 8 people, mixed east/west) ----------
export const FIGURES: HistoricalFigure[] = [
  {
    id: "sima-qian",
    name: "司马迁",
    tradition: "east",
    age_band: "35-39",
    topics: ["career", "recent"],
    situation: "身处朝堂，因为一次替他人辩护，招来最沉重的私人代价。",
    choice: "在能选择放弃著述与选择接受屈辱之间，他选择了活下去、完成《史记》。",
    outcome: "作品在他身后成为整个东亚的历史底稿。",
    cost: "个人尊严的公开被击穿，一生再没有真正被恢复。",
    transferable:
      "有些位置你之所以撑住，不是为了赢，而是为了完成一件比自己更长的事。",
    source_title: "《史记 · 太史公自序》",
    source_url: "https://example.org/library-v2/demo/simaqian",
    warning:
      "过度类比警示：你不必用『完成大事』来正当化自己受的委屈。是否留下、是否继续，是两回事。",
    different_choice: false,
  },
  {
    id: "hypatia",
    name: "Hypatia of Alexandria",
    tradition: "west",
    age_band: "40-49",
    topics: ["career"],
    situation: "在一个身份剧烈对撞的城市里，坚持在公共场合讲学。",
    choice: "拒绝退回私人空间、拒绝被沉默化。",
    outcome: "被公开攻击、遇害；她的讲堂在她死后成为一段被反复引用的记忆。",
    cost: "生命本身。",
    transferable:
      "有一种坚持是必要的：不是姿态，而是因为撤退等于把这件事在世界上完全抹掉。",
    source_title: "Hypatia — a life in translation",
    source_url: "https://example.org/library-v2/demo/hypatia",
    warning:
      "过度类比警示：你的岗位不必以命换来。判断『能否撤退』先于『要不要坚持』。",
    different_choice: false,
  },
  {
    id: "li-qingzhao",
    name: "李清照",
    tradition: "east",
    age_band: "40-49",
    topics: ["love", "recent"],
    situation: "在战乱中经历伴侣离世、旧藏尽失、身份被质疑。",
    choice: "在没有人替她说话的时期，选择自己成为记录者。",
    outcome: "以词与《金石录后序》完成了一段完整的自我叙述。",
    cost: "长年的孤独与被误读。",
    transferable:
      "当所有人都替你解释你时，最有效的回应不是辩解，是留下一份完整的自述。",
    source_title: "《金石录后序》",
    source_url: "https://example.org/library-v2/demo/liqingzhao",
    warning:
      "过度类比警示：你不需要靠悲剧来获得叙述权。可以在平静时就开始写。",
    different_choice: false,
  },
  {
    id: "marcus-aurelius",
    name: "Marcus Aurelius",
    tradition: "west",
    age_band: "40-49",
    topics: ["career", "recent"],
    situation: "被推向他并不追求的位置，同时要处理长期的边境冲突与内部质疑。",
    choice: "在私下写下自省笔记，作为对自己而非对帝国的解释。",
    outcome: "《沉思录》成为一份不为公众而写却影响公众的文本。",
    cost: "他从未真正拥有过安静。",
    transferable:
      "当外部要求你以强硬示人时，向内的写作比向外的表态更可靠。",
    source_title: "Meditations",
    source_url: "https://example.org/library-v2/demo/marcus",
    warning:
      "过度类比警示：写日记不能替代必要的边界与决策。",
    different_choice: false,
  },
  {
    id: "wang-yangming",
    name: "王阳明",
    tradition: "east",
    age_band: "35-39",
    topics: ["career", "recent"],
    situation: "被贬至偏远地带，几乎失去所有可以依赖的资源与身份。",
    choice: "把外部失败作为向内确认自身秩序的一次机会。",
    outcome: "在龙场的独处中完成了心学的核心一跃。",
    cost: "许多年的边缘化与自我怀疑。",
    transferable:
      "有一种下滑，是把你从被消耗的位置移到一个能听见自己的位置。",
    source_title: "《王阳明全集》",
    source_url: "https://example.org/library-v2/demo/wangyangming",
    warning:
      "过度类比警示：不要美化被贬。判断这段是否真的『把你带回自己』，而不是消耗你。",
    different_choice: false,
  },
  {
    id: "elizabeth-1",
    name: "Elizabeth I",
    tradition: "west",
    age_band: "25-29",
    topics: ["love", "career"],
    situation: "在极年轻时就被安置在一个所有人都想替她安排的位置上。",
    choice: "选择不结婚，作为长期治理的一部分。",
    outcome: "以此换来接近半个世纪的政治稳定。",
    cost: "私人生活始终是公众议题。",
    transferable:
      "『不选择』本身就是一种选择；有一些位置需要你以不做承诺的方式承担。",
    source_title: "Elizabeth I — Public and Private",
    source_url: "https://example.org/library-v2/demo/elizabeth",
    warning:
      "过度类比警示：不结婚不是每个人的答案；它是一种在特定位置上的具体选择。",
    different_choice: true,
  },
  {
    id: "su-shi",
    name: "苏轼",
    tradition: "east",
    age_band: "35-39",
    topics: ["career", "wealth", "recent"],
    situation: "长期在贬谪与复起之间来回；每一次都要在新的低处重新开局。",
    choice: "在每一段低谷都选择把生活先安顿好——种菜、造桥、写字。",
    outcome: "作品与生活方式一起被留下来，成为一种可复制的姿态。",
    cost: "始终没有得到他自认为该有的政治平台。",
    transferable:
      "当一段路不再上行时，把眼前生活做好是最有效的抵抗。",
    source_title: "《东坡志林》选",
    source_url: "https://example.org/library-v2/demo/sushi",
    warning:
      "过度类比警示：随遇而安不是万能解。区分『安顿』与『放弃』。",
    different_choice: false,
  },
  {
    id: "jane-addams",
    name: "Jane Addams",
    tradition: "west",
    age_band: "30-34",
    topics: ["wealth", "career"],
    situation: "出身较好、有明确资源，却选择放弃一份可以稳妥继承的生活。",
    choice: "在芝加哥建立 Hull House，把资源投入到一份不确定回报的公共工作里。",
    outcome: "开创了一种延续至今的社区工作模型，后来获得诺贝尔和平奖。",
    cost: "长年放弃了标准意义上的私人生活稳定。",
    transferable:
      "有些财富的真正用途，不是被守住，而是被投放到一件比自己更长的事情上。",
    source_title: "Twenty Years at Hull-House",
    source_url: "https://example.org/library-v2/demo/janeaddams",
    warning:
      "过度类比警示：你不必立即把资源投出去；先判断这件事是否真正与你相关。",
    different_choice: true,
  },
];

// Seed notes shown in the public list on first mount (Demo-only).
export function seedNotes(now: number): Note[] {
  return [
    {
      id: "seed-note-1",
      author_id: "seed-a",
      author_nickname: "长桥",
      topic: "career",
      body:
        "三十岁那年我从一个所有人都看好的岗位上退了下来，用了两年才承认那是对的。想听听有没有人也这样过。",
      image_data_url: null,
      audience: "similar",
      status: "active",
      match_traits: ["人生阶段相近", "责任模式相似"],
      created_at: now - 1000 * 60 * 60 * 26,
      updated_at: now - 1000 * 60 * 60 * 26,
      deleted_at: null,
    },
    {
      id: "seed-note-2",
      author_id: "seed-b",
      author_nickname: "夜航船",
      topic: "love",
      body:
        "我反复被同一类人吸引，直到最近才承认我要的其实不是他们身上那样东西。写下来，看看能不能收到不一样的答案。",
      image_data_url: null,
      audience: "opposite",
      status: "active",
      match_traits: ["互补视角"],
      created_at: now - 1000 * 60 * 60 * 6,
      updated_at: now - 1000 * 60 * 60 * 6,
      deleted_at: null,
    },
    {
      id: "seed-note-3",
      author_id: "seed-c",
      author_nickname: "青石",
      topic: "wealth",
      body:
        "第一次真正接住一笔钱之后，我反而不知道怎么处理它。经历过这种感觉的人，能不能告诉我你当时做的第一件事？",
      image_data_url: null,
      audience: "experienced",
      status: "active",
      match_traits: ["责任模式相似"],
      created_at: now - 1000 * 60 * 60 * 3,
      updated_at: now - 1000 * 60 * 60 * 3,
      deleted_at: null,
    },
  ];
}

export const CLOSING_QUOTE =
  "所有命运看似没有选择，实际上都藏着一种选择。你无法重写故事的开篇，但可以决定下一页如何落笔。";
