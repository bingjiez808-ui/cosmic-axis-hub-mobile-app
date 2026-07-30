/**
 * 同门 · 众生之厅 — localisation for the anonymous cross-generation letter hall.
 *
 * Every user-visible string lives here, keyed by the app's existing `Lang`.
 * Database enum values (age bands, topics, statuses, moderation results) are
 * never rendered raw — they always pass through the maps below.
 */
import { useMemo } from "react";

import { useLang, type Lang } from "@/lib/i18n";

export const AGE_BANDS = ["18-22", "23-29", "30-39", "40-49", "50-59", "60+"] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

export const LETTER_TOPICS = [
  "study",
  "career",
  "love",
  "boundaries",
  "family",
  "money",
  "self",
  "other",
] as const;
export type LetterTopic = (typeof LETTER_TOPICS)[number];

type Pair = { zh: string; en: string };
const pick = (p: Pair, lang: Lang) => (lang === "zh" ? p.zh : p.en);

const AGE_BAND_LABELS: Record<AgeBand, Pair> = {
  "18-22": { zh: "18–22 岁", en: "Ages 18–22" },
  "23-29": { zh: "23–29 岁", en: "Ages 23–29" },
  "30-39": { zh: "30–39 岁", en: "Ages 30–39" },
  "40-49": { zh: "40–49 岁", en: "Ages 40–49" },
  "50-59": { zh: "50–59 岁", en: "Ages 50–59" },
  "60+": { zh: "60 岁以上", en: "Ages 60+" },
};

const AGE_BAND_INVITES: Record<AgeBand, Pair> = {
  "18-22": {
    zh: "想问问刚离开校园、还在试错的人",
    en: "Ask someone still just past the school gate",
  },
  "23-29": {
    zh: "想问问正在城市里站稳脚跟的人",
    en: "Ask someone finding their footing in a city",
  },
  "30-39": {
    zh: "想问问选择开始有重量的人",
    en: "Ask someone whose choices have started to weigh",
  },
  "40-49": {
    zh: "想问问肩上已经有人的人",
    en: "Ask someone who now carries others",
  },
  "50-59": {
    zh: "想问问正在回望、也仍在启程的人",
    en: "Ask someone looking back while still setting out",
  },
  "60+": {
    zh: "想问问走过很长一段路的人",
    en: "Ask someone who has walked a long road",
  },
};

const AGE_BAND_CHAPTERS: Record<AgeBand, Pair> = {
  "18-22": { zh: "刚离开校园的路口", en: "just past the school gate" },
  "23-29": { zh: "在城市里立足的年头", en: "finding a footing" },
  "30-39": { zh: "选择开始有重量的年月", en: "when choices start to weigh" },
  "40-49": { zh: "肩上有人的年月", en: "carrying others" },
  "50-59": { zh: "回望与再启程之间", en: "between looking back and setting out" },
  "60+": { zh: "走过很长一段路之后", en: "after a long road" },
};

const TOPIC_LABELS: Record<LetterTopic, Pair> = {
  study: { zh: "学业与成长", en: "Study & growing up" },
  career: { zh: "事业与选择", en: "Work & choices" },
  love: { zh: "爱情与亲密关系", en: "Love & intimacy" },
  boundaries: { zh: "人际与边界", en: "People & boundaries" },
  family: { zh: "家庭与责任", en: "Family & duty" },
  money: { zh: "财富与安全感", en: "Money & security" },
  self: { zh: "自我与人生阶段", en: "Self & seasons of life" },
  other: { zh: "其他困惑", en: "Something else" },
};

const LETTER_STATUS: Record<string, Pair> = {
  pending: { zh: "等待馆员过目", en: "Awaiting review" },
  approved: { zh: "已在投递中", en: "In delivery" },
  hidden: { zh: "已被隐藏", en: "Hidden" },
  rejected: { zh: "未通过审核", en: "Not approved" },
  expired: { zh: "已过期", en: "Expired" },
  closed: { zh: "已收满回音", en: "Enough echoes" },
};

const DELIVERY_STATUS: Record<string, Pair> = {
  delivered: { zh: "未拆封", en: "Unopened" },
  read: { zh: "已阅读", en: "Read" },
  replied: { zh: "已回复", en: "Replied" },
  archived: { zh: "已封存", en: "Archived" },
  hidden: { zh: "已隐藏", en: "Hidden" },
};

const MODERATION_RESULT: Record<string, Pair> = {
  approve: { zh: "通过", en: "Approved" },
  hide: { zh: "隐藏", en: "Hidden" },
  reject: { zh: "拒绝", en: "Rejected" },
  redact: { zh: "局部脱敏", en: "Redacted" },
  redispatch: { zh: "重新投递", en: "Re-dispatched" },
  set_status_active: { zh: "恢复参与", en: "Participation restored" },
  set_status_paused: { zh: "暂停参与", en: "Participation paused" },
  set_status_banned: { zh: "禁止参与", en: "Participation banned" },
};

const REPORT_REASONS = [
  { key: "contact", zh: "索要联系方式", en: "Asking for contact details" },
  { key: "scam", zh: "诈骗或拉群导流", en: "Scam or solicitation" },
  { key: "harassment", zh: "骚扰、侮辱或威胁", en: "Harassment or threats" },
  { key: "sexual", zh: "性骚扰或不适内容", en: "Sexual or unsafe content" },
  { key: "crisis", zh: "自伤或危机内容", en: "Self-harm or crisis" },
  { key: "other", zh: "其他不适内容", en: "Something else" },
] as const;

export type ReportReasonKey = (typeof REPORT_REASONS)[number]["key"];

export function useCommunityHall() {
  const { lang } = useLang();
  return useMemo(() => {
    const zh = lang === "zh";
    const p = (a: string, b: string) => (zh ? a : b);
    return {
      lang,
      isZh: zh,
      ageBand: (band?: string | null) =>
        band && band in AGE_BAND_LABELS
          ? pick(AGE_BAND_LABELS[band as AgeBand], lang)
          : p("未知阶段", "Unknown chapter"),
      ageChapter: (band?: string | null) =>
        band && band in AGE_BAND_CHAPTERS ? pick(AGE_BAND_CHAPTERS[band as AgeBand], lang) : "",
      topic: (topic?: string | null) =>
        topic && topic in TOPIC_LABELS
          ? pick(TOPIC_LABELS[topic as LetterTopic], lang)
          : p("未分类", "Unfiled"),
      letterStatus: (s?: string | null) =>
        s && s in LETTER_STATUS ? pick(LETTER_STATUS[s], lang) : p("处理中", "Processing"),
      deliveryStatus: (s?: string | null) =>
        s && s in DELIVERY_STATUS ? pick(DELIVERY_STATUS[s], lang) : p("未拆封", "Unopened"),
      moderationResult: (s?: string | null) =>
        s && s in MODERATION_RESULT ? pick(MODERATION_RESULT[s], lang) : (s ?? ""),
      topics: LETTER_TOPICS.map((key) => ({ key, label: pick(TOPIC_LABELS[key], lang) })),
      bands: AGE_BANDS.map((key) => ({
        key,
        label: pick(AGE_BAND_LABELS[key], lang),
        chapter: pick(AGE_BAND_CHAPTERS[key], lang),
        invite: pick(AGE_BAND_INVITES[key], lang),
      })),
      ageInvite: (band?: string | null) =>
        band && band in AGE_BAND_INVITES ? pick(AGE_BAND_INVITES[band as AgeBand], lang) : "",
      reportReasons: REPORT_REASONS.map((r) => ({ key: r.key, label: zh ? r.zh : r.en })),

      // ── Hall ──────────────────────────────────────────────
      hallEyebrow: p("同门 · 众生之厅", "Fellowship · Hall of Beings"),
      hallTitle: p(
        "把一个问题，寄给走过这段路的人",
        "Send a question to someone who has lived through that chapter",
      ),
      hallSubtitle: p(
        "写下此刻的小小困惑，选择你想询问的人生阶段。图书馆会匿名把信送到合适的旅者手中，再把他们的回音带回来。",
        "Write down what you are turning over right now and choose the chapter of life you want to ask. The library carries your letter to a traveler there, anonymously, and brings their answer back to you.",
      ),
      hallTagline: p("游客之间，彼此照亮", "Travelers lighting the way for one another"),
      ctaWrite: p("写一封信", "Write a letter"),
      ctaInbox: p("打开收信匣", "Open your mailbox"),
      ctaReceived: p("看看别人寄来的信", "Letters written to you"),
      ctaEchoes: p("我的回音", "My echoes"),
      ctaHow: p("同门如何运作", "How this works"),
      steps: [
        {
          title: p("写下问题", "Write the question"),
          body: p(
            "一句真实的困惑，胜过一封完美的信。",
            "One honest sentence beats a perfect letter.",
          ),
        },
        {
          title: p("选择收信人的人生阶段", "Choose their chapter"),
          body: p(
            "你想听 30 岁的人说，还是 60 岁的人说？",
            "Do you want to hear from someone at 30, or at 60?",
          ),
        },
        {
          title: p("等待匿名回音", "Wait for an echo"),
          body: p(
            "有人读到并写下回信后，它会出现在你的回音页。",
            "When someone reads it and writes back, the echo appears in your shelf.",
          ),
        },
      ],
      privacyTitle: p("关于隐私", "About privacy"),
      privacyPoints: [
        p(
          "你的真实姓名、生日和精确年龄不会展示。",
          "Your real name, birth date and exact age are never shown.",
        ),
        p(
          "对方只会看到你的匿名身份和必要的年龄阶段。",
          "The other traveler only sees your anonymous name and a broad age chapter.",
        ),
        p(
          "这不是即时聊天，信件可能需要一些时间才会收到回复。",
          "This is not a chat room — a reply may take some time to arrive.",
        ),
      ],

      // ── Sections / nav ────────────────────────────────────
      navHall: p("大厅", "Hall"),
      navWrite: p("寄信", "Write"),
      navInbox: p("收信", "Mailbox"),
      navMine: p("我的", "Mine"),
      sectionToday: p("今日来信", "Letters for you today"),
      sectionSend: p("寄出一封信", "Send a letter"),
      sectionOutbox: p("我的书札", "My letters"),
      sectionEchoes: p("我的回音", "My echoes"),
      entryNotes: p("入馆问笺", "Entry Notes"),
      entryNotesHint: p(
        "可选的自我探索小笺，与书信投递无关。",
        "An optional self-reflection note. It has nothing to do with letter delivery.",
      ),

      // ── Letter card ───────────────────────────────────────
      fromTraveler: p("寄自", "From"),
      toChapter: p("寄给", "Written to"),
      deliveredAt: p("送达于", "Delivered"),
      expiresAt: p("截止于", "Closes"),
      open: p("拆开信件", "Open the letter"),
      deliveredCount: p("已送达", "Delivered to"),
      replyCount: p("回音", "Echoes"),
      people: p("位旅者", "travelers"),

      // ── Write flow ────────────────────────────────────────
      writeTitle: p("寄信台", "The writing desk"),
      stepOne: p("写下问题", "Your question"),
      stepTwo: p("这封信想寄给谁", "Who should read it"),
      stepThree: p("封缄并寄出", "Seal and send"),
      fieldSubject: p("标题", "Title"),
      fieldSubjectHint: p("建议 8–40 字", "8–40 characters works well"),
      fieldBody: p("正文", "Letter"),
      fieldBodyHint: p("建议 20–800 字", "20–800 characters works well"),
      fieldTopic: p("主题", "Topic"),
      required: p("这一项还没有填写", "This still needs something"),
      tooShort: p("再多写一点，让对方看懂你的处境", "A little more, so they can understand"),
      tooLong: p("超出长度上限了", "That is over the limit"),
      next: p("下一步", "Next"),
      back: p("返回修改", "Back"),
      chooseBand: p("选择你想询问的人生阶段", "Choose the chapter you want to ask"),
      replyLanguage: p("回信语言", "Reply language"),
      allowMultiple: p("允许多位旅者回复", "Let several travelers reply"),
      stopAfter: p("收到多少封回音后停止投递", "Stop delivering after this many echoes"),
      autoExpire: p("7 天后自动停止投递", "Delivery stops automatically after 7 days"),
      preview: p("寄信预览", "Preview"),
      agreeRules: p(
        "我已阅读社区守则：不索要联系方式，不索取金钱，不进行骚扰。",
        "I have read the house rules: no contact details, no money requests, no harassment.",
      ),
      seal: p("封缄并寄出", "Seal and send"),
      sending: p("正在封缄…", "Sealing…"),
      sentTitle: p("信已寄出", "Your letter is on its way"),
      pendingReview: p(
        "这封信需要馆员先过目，通过后会自动开始投递。",
        "A librarian will read this one first; delivery starts once it is approved.",
      ),

      // ── Detail / reply ────────────────────────────────────
      writeEcho: p("写下回音", "Write an echo"),
      echoPlaceholder: p("写下你走过这段路时最想说的话…", "What would you tell them?"),
      echoHint: p("20–1000 字", "20–1000 characters"),
      sendEcho: p("寄出回音", "Send the echo"),
      echoSent: p("回音已送达", "Echo delivered"),
      reportThis: p("举报这封信", "Report this letter"),
      blockThis: p("屏蔽这位匿名旅者", "Block this traveler"),
      muteTopic: p("不再接收此类主题", "Stop receiving this topic"),
      backToInbox: p("返回收信匣", "Back to the mailbox"),
      reportSent: p("已收到你的举报，馆员会尽快处理。", "Thank you — a librarian will review this."),
      blocked: p("已屏蔽，之后不会再收到 TA 的信。", "Blocked. You will not be matched again."),

      // ── Filters ───────────────────────────────────────────
      filterAll: p("全部", "All"),
      filterUnread: p("未拆封", "Unopened"),
      filterRead: p("已阅读", "Read"),
      filterReplied: p("已回复", "Replied"),
      filterArchived: p("已封存", "Archived"),
      archive: p("封存", "Archive"),
      unarchive: p("取出", "Restore"),
      tabReceivedEchoes: p("收到的回音", "Echoes received"),
      tabMyEchoes: p("我写出的回音", "Echoes I wrote"),

      // ── Empty states ──────────────────────────────────────
      emptyInbox: p(
        "书架上暂时没有写给你的信。图书馆仍在寻找合适的来信，你也可以先寄出自己的问题。",
        "No letters on your shelf yet. The library is still looking — meanwhile you could send a question of your own.",
      ),
      emptyOutbox: p(
        "你还没有寄出过书札。也许可以从一句最近反复想起的话开始。",
        "You have not sent a letter yet. Perhaps start with the sentence that keeps coming back to you.",
      ),
      emptyEchoes: p(
        "回音需要时间穿过书架。有人读到你的信后，它会在这里亮起。",
        "Echoes take time to cross the shelves. When someone reads your letter, it will light up here.",
      ),

      // ── Gate ──────────────────────────────────────────────
      gateSignIn: p("登录后即可寄信与收信。", "Sign in to send and receive letters."),
      gateSignInCta: p("登录 / 注册", "Sign in"),
      gateAdult: p(
        "众生之厅目前仅向已满 18 周岁的旅者开放。请先在个人书架中补全出生日期。",
        "The Hall of Beings is open to travelers aged 18 and over. Add your birth date in your library first.",
      ),
      gateAdultCta: p("前往个人书架", "Go to my library"),
      gateOptIn: p(
        "开启同门书信后，图书馆才会把信送到你手中。",
        "Turn on fellowship letters and the library can start delivering to you.",
      ),
      gateOptInCta: p("开启同门书信", "Turn on fellowship letters"),
      identityTitle: p("确认你的匿名身份", "Confirm your anonymous name"),
      identityHint: p(
        "别人只会看到这个称号，不会看到你的真实信息。",
        "Others only ever see this name — never your real details.",
      ),
      save: p("保存", "Save"),
      saved: p("已保存", "Saved"),

      // ── Settings ──────────────────────────────────────────
      settingsTitle: p("同门设置", "Fellowship settings"),
      settingParticipate: p("参与同门", "Take part in the fellowship"),
      settingReceive: p("接收信件", "Receive letters"),
      settingTopics: p("可接收的主题", "Topics I will read"),
      settingAlias: p("匿名称号", "Anonymous name"),
      settingAcademy: p("学院", "House"),
      settingElement: p("元素", "Element"),
      settingQuote: p("个性短句", "One-line motto"),
      settingLanguage: p("回信语言", "Reply language"),
      blockList: p("屏蔽名单", "Blocked travelers"),
      myReports: p("我的举报记录", "My reports"),
      archiveList: p("封存记录", "Archived"),
      loading: p("正在从书架取信…", "Fetching from the shelves…"),

      // ── Hall hero (round 3) ───────────────────────────────
      hallHeroLineOne: p("你此刻的困惑，", "The question you are carrying"),
      hallHeroLineTwo: p("有人已经走过", "has already been walked by someone"),
      hallHeroBody: p(
        "在众生之厅，你可以匿名写下一个真实的问题，选择你想请教的人生阶段。图书馆的信使会把它送到那个阶段的旅者手中，再把回音带回你的书架。",
        "In the Hall of Beings you can write one honest question, anonymously, and choose the chapter of life you want to ask. A courier carries it to a traveler there, and brings the echo back to your shelf.",
      ),
      hallHeroNote: p(
        "没有点赞，没有粉丝，没有公开评论区。只有一封信，和一次回音。",
        "No likes, no followers, no public comment thread. Just a letter, and an echo.",
      ),
      pathTitle: p("信是怎样走完这一程的", "How a letter travels"),
      cardWriteTitle: p("寄一封信", "Send a letter"),
      cardWriteBody: p("写下一个真实的问题，交给信使。", "Write one honest question and hand it to the courier."),
      cardInboxTitle: p("收信匣", "Mailbox"),
      cardInboxBody: p("别人寄到你这一段人生的信。", "Letters written to the chapter you are living."),
      cardOutboxTitle: p("我的书札", "My letters"),
      cardOutboxBody: p("你寄出的信，和它们的去向。", "The letters you sent, and where they went."),
      cardEchoesTitle: p("回音", "Echoes"),
      cardEchoesBody: p("陌生人写给你的回信。", "What strangers wrote back to you."),
      unreadCount: (n: number) => (zh ? `${n} 封未拆封` : `${n} unopened`),
      newEchoes: (n: number) => (zh ? `${n} 条新回音` : `${n} new`),
      identityLine: (alias: string, band: string) =>
        zh ? `你现在是「${alias}」，来自${band}` : `You are "${alias}", writing from ${band}`,
      identityEdit: p("修改匿名身份", "Edit anonymous identity"),
      recentTitle: p("最近的动静", "Recent movement"),
      houseRules: p("馆内守则", "House rules"),

      // ── States ────────────────────────────────────────────
      stateLoadingHall: p("信使正在整理书架…", "The courier is sorting the shelves…"),
      stateError: p("书架那边出了点状况。", "Something went wrong on the shelves."),
      stateRetry: p("再试一次", "Try again"),
      stateOffline: p("暂时连不上图书馆，请检查网络。", "The library is unreachable. Check your connection."),
      stateEmptyHint: p("这里现在是空的。", "Nothing here yet."),

      // ── Write flow (round 3) ──────────────────────────────
      stepOfThree: (n: number) => (zh ? `第 ${n} 步 / 共 3 步` : `Step ${n} of 3`),
      writeIntro: p(
        "一句真实的困惑，胜过一封完美的信。对方看不到你是谁。",
        "One honest sentence beats a perfect letter. They will never see who you are.",
      ),
      bodyCounter: (n: number, max: number) => (zh ? `${n} / ${max} 字` : `${n} / ${max}`),
      bodyTooShort: (min: number) =>
        zh ? `再多写一点，至少 ${min} 字，让对方看懂你的处境。` : `A little more — at least ${min} characters.`,
      previewFrom: p("寄自", "From"),
      previewTo: p("寄往", "To"),
      previewSealHint: p(
        "寄出后不能修改，也不能撤回。信件 7 天后自动停止投递。",
        "Once sealed it cannot be edited or recalled. Delivery stops after 7 days.",
      ),
      sentBody: p(
        "信使已经带着它走向书架深处。有人读到并写下回音时，你会在「回音」里看到。",
        "The courier has carried it into the stacks. When someone answers, it will appear under Echoes.",
      ),
      sentGoEchoes: p("去回音等一等", "Wait by the echoes"),
      sentWriteAnother: p("再写一封", "Write another"),

      // ── Letter detail (round 3) ───────────────────────────
      openingLetter: p("正在拆开信封…", "Opening the envelope…"),
      letterFromChapter: p("这封信来自", "This letter comes from"),
      echoRange: p("20–800 字", "20–800 characters"),
      echoTooShort: p("回音至少 20 字。", "An echo needs at least 20 characters."),
      echoTooLong: p("回音最多 800 字。", "An echo can hold at most 800 characters."),
      echoNoEmojiOnly: p("请用文字写下你想说的话。", "Please answer in words."),
      echoDuplicate: p("这段话你刚刚已经寄出过了。", "You just sent that exact echo."),
      echoOnce: p("每封信只能回一次。", "One echo per letter."),
      notReplyable: p("这封信已经不再接收回音。", "This letter no longer takes echoes."),
      safetyTools: p("安全", "Safety"),
      safetySheetTitle: p("这封信让你不舒服吗？", "Is this letter making you uncomfortable?"),
      confirmBlock: p("确认屏蔽这位匿名旅者？", "Block this anonymous traveler?"),
      cancel: p("取消", "Cancel"),
      confirm: p("确认", "Confirm"),

      // ── Echo shelf (round 3) ──────────────────────────────
      echoesForLetter: p("这封信收到的回音", "Echoes for this letter"),
      saveEcho: p("收藏这条回音", "Keep this echo"),
      savedEcho: p("已收藏", "Kept"),
      closeCollecting: p("结束收信", "Stop collecting"),
      closedCollecting: p("已结束收信", "No longer collecting"),
      closeConfirm: p("结束后不会再有新的回音寄来，确认吗？", "No new echoes will arrive after this. Continue?"),
      awaitingEcho: p("还在等待回音", "Still waiting for an echo"),

      // ── Cold start, onboarding, notifications (batch C) ───
      samplesTitle: p("馆藏范文", "From the library shelf"),
      samplesBadge: p("馆藏范文 · 非真人来信", "Library sample · not a member letter"),
      samplesIntro: p(
        "开馆之初，这些是由图书馆撰写的示范书信与示范回音，用来说明这里的语气与分寸。它们不会被投递给任何人，也无法回信。",
        "While the hall is young, these sample letters and echoes are written by the library itself to show the tone we hope for. They are never delivered to anyone and cannot be answered.",
      ),
      samplesEchoes: p("示范回音", "Sample echoes"),
      samplesEmpty: p("馆藏还在整理中。", "The shelf is still being arranged."),
      samplesWriteCta: p("写下我自己的那封", "Write my own letter"),

      onboardTitle: p("入馆三件事", "Three things before you write"),
      onboardSkip: p("以后再说", "Later"),
      onboardNext: p("下一张", "Next"),
      onboardDone: p("我明白了", "I understand"),
      onboardCards: [
        {
          zh: ["这里是什么", "你写下此刻真实的困惑，它会被匿名寄给几位走过这段路的人；你可能收到一封回音，也可能没有。"],
          en: ["What this is", "You write a real question, and it travels anonymously to a few people who have lived that chapter. An echo may come back — or may not."],
        },
        {
          zh: ["保护你自己", "不要写出姓名、单位、学校、电话和社交账号。匿名是这里唯一的安全带。"],
          en: ["Protect yourself", "No names, employers, schools, phone numbers or handles. Anonymity is the only seatbelt here."],
        },
        {
          zh: ["温柔地回信", "回音不是评判。若信中出现危机内容，请举报并让我们介入，而不是独自承担。"],
          en: ["Answer gently", "An echo is not a verdict. If a letter shows a crisis, report it so we can step in — do not carry it alone."],
        },
      ].map((card) => ({ title: pick({ zh: card.zh[0], en: card.en[0] }, lang), body: pick({ zh: card.zh[1], en: card.en[1] }, lang) })),

      notificationsTitle: p("信使通报", "Notifications"),
      notificationsEmpty: p("暂时没有新的通报。", "Nothing new from the courier."),
      notificationsMarkRead: p("全部标为已读", "Mark all read"),
      notificationLabel: (type: string) =>
        pick(
          {
            letter_received: { zh: "有一封信寄到了你手上", en: "A letter arrived for you" },
            reply_received: { zh: "你的信收到了回音", en: "Your letter received an echo" },
            letter_reviewed: { zh: "你的信已完成审核", en: "Your letter finished review" },
            reply_reviewed: { zh: "你的回音已完成审核", en: "Your echo finished review" },
          }[type] ?? { zh: "新的通报", en: "New notice" },
          lang,
        ),

      // ── Metrics & privacy (round 4 · batch D) ─────────────
      metricsTitle: p("运营指标", "Operating metrics"),
      metricsRange: (n: number) => pick({ zh: `最近 ${n} 天`, en: `Last ${n} days` }, lang),
      metricLetters: p("来信", "Letters"),
      metricDeliveries: p("投递", "Deliveries"),
      metricReplies: p("回音", "Echoes"),
      metricReports: p("举报", "Reports"),
      metricParticipants: p("同门", "Members"),
      metricReadRate: p("拆阅率", "Open rate"),
      metricReplyRate: p("回音率", "Echo rate"),
      metricMedianEcho: p("首次回音中位时长", "Median time to first echo"),
      metricHours: p("小时", "h"),
      metricNoData: p("暂无数据", "No data yet"),

      privacyTitle: p("我的数据", "My data"),
      privacyBody: p(
        "你可以随时清除自己在众生之厅留下的全部痕迹：匿名身份、寄出的信、写过的回音、收信记录、举报与通报。此操作不可撤销，且不会影响你的账号与命盘。",
        "You can erase everything you left in the hall at any time: anonymous identity, letters sent, echoes written, delivery records, reports and notices. This cannot be undone, and it does not touch your account or charts.",
      ),
      privacyDelete: p("清除我在同门的全部数据", "Delete all my hall data"),
      privacyConfirm: p("确认清除？此操作不可撤销。", "Delete for good? This cannot be undone."),
      privacyDone: p("已清除你在众生之厅的全部数据。", "Your hall data has been erased."),

      // ── Delivery waves (round 4 · batch B) ────────────────
      waveLabel: p("投递波次", "Delivery waves"),
      waveDelivered: p("已送达", "Delivered"),
      waveRead: p("已拆阅", "Opened"),
      waveReplied: p("已回音", "Echoes"),
      waveWaiting: p("信已在路上，正在等待回音。", "Your letter is on its way, waiting for an echo."),
      waveRequest: p("再送一程", "Send another wave"),
      waveRequested: p("新的一波已经寄出。", "A new wave has been sent."),
      waveNoOne: p("暂时没有合适的收信人，稍后会自动再试。", "No suitable reader right now — we will try again later."),
      waveCooldown: p("下一波可在 {time} 之后寄出。", "The next wave can go out after {time}."),
      waveFull: p("这封信已经送到最多的读者手中。", "This letter has reached as many readers as allowed."),
      waveHint: p(
        "为了不打扰任何人，每位同门每天只会收到有限的几封信；若一段时间没有回音，我们会自动把信送给更多人。",
        "To keep inboxes gentle, each traveler receives only a few letters a day; if no echo arrives, we quietly widen the circle.",
      ),
    };
  }, [lang]);
}

export type CommunityHallCopy = ReturnType<typeof useCommunityHall>;
