/**
 * i18n dictionary for the "Today's Reading Room" / friends / match preview
 * routes plus the shared SocialConsentGate.
 *
 * Kept in its own module so the main `i18n.tsx` dict stays lean and so the
 * key-parity test in `i18n-daily.test.ts` can target a single object.
 *
 * Rules the pages rely on:
 * - Deterministic calc outputs (score, band, phase, planet keys) are
 *   language-agnostic. Only the rendering uses the maps below.
 * - Any future explanation cache MUST include the lang in its key so
 *   switching language never surfaces a Chinese string in the English UI.
 */
import { useMemo } from "react";

import { useLang, type Lang } from "@/lib/i18n";
import { SOCIAL_MIN_AGE } from "@/lib/social-gates";

type Enum<K extends string> = Record<K, string>;

export type DailyDict = {
  // ---- shared / nav ----
  nav_today: string;
  demo_banner_home: string;
  demo_banner_friends: string;
  demo_banner_match: string;
  loading: string;
  cancel: string;
  submit: string;
  send: string;
  close: string;

  // ---- /me/home ----
  today_kicker: string;
  today_title: string;
  today_chart_label: (name: string) => string;
  today_tier_free: string;
  today_tier_member: string;
  today_toggle_membership: string;
  section_my_charts: string;
  my_charts_loading: string;
  my_charts_anonymous: string;
  my_charts_error: (msg: string) => string;
  my_charts_count: (n: number) => string;
  my_charts_empty: string;
  my_charts_unnamed: string;
  my_charts_missing_date: string;
  capabilities_line: (opts: {
    rename: boolean;
    del: boolean;
    setDefault: boolean;
  }) => string;
  overall_signal: string;
  overall_out_of: string;
  overall_note: string;
  today_theme: string;
  theme_pending: string;
  theme_line: (phase: string, keywords: string) => string;
  theme_default_keyword: string;
  contradictions_title: string;
  supportive_title: string;
  supportive_demo: readonly string[];
  caution_title: string;
  caution_demo: readonly string[];
  countercondition_title: string;
  countercondition_body: string;
  reflection_title: string;
  reflection_body: string;
  free_tier_notice: string;
  evidence_title: string;
  evidence_expand: string;
  evidence_collapse: string;
  evidence_sample: string;
  evidence_calc: string;
  evidence_slower: string;
  evidence_slower_line: (v: string, b: string, z: string) => string;
  evidence_slower_note: string;
  evidence_refs: string;
  evidence_no_strong: string;
  evidence_missing: string;
  evidence_footer: string;
  home_secondary_nav_charts: string;
  home_secondary_nav_friends: string;
  home_secondary_nav_match: string;

  // ---- Chart manager (real data) ----
  charts_primary_title: string;
  charts_primary_missing_title: string;
  charts_primary_missing_body: string;
  charts_others_title: string;
  charts_role_self: string;
  charts_role_other: string;
  charts_action_rename: string;
  charts_action_set_primary: string;
  charts_action_make_other: string;
  charts_action_save: string;
  charts_action_cancel: string;
  charts_action_delete: string;
  charts_name_placeholder: string;
  charts_name_empty_error: string;
  charts_name_too_long_error: string;
  charts_saving: string;
  charts_setting_primary: string;
  charts_error_generic: (msg: string) => string;
  charts_untitled_other: string;
  charts_delete_confirm: (name: string) => string;
  charts_privacy_notice: string;
  charts_manage_link: string;
  charts_primary_missing_cta_ritual: string;
  charts_primary_missing_cta_shelf: string;
  bookshelf_open_report: string;
  bookshelf_open_today: string;
  bookshelf_more_menu: string;
  bookshelf_role_toggle_self: string;
  bookshelf_role_toggle_other: string;
  bookshelf_duplicates_found: (n: number) => string;
  bookshelf_show_duplicates: string;
  bookshelf_hide_duplicates: string;
  bookshelf_relations_privacy: string;
  bookshelf_no_others: string;
  bookshelf_no_relations: string;
  bookshelf_main_book_label: string;
  bookshelf_relation_card_label: string;
  bookshelf_relation_label_placeholder: string;
  bookshelf_relation_label_edit: string;
  bookshelf_relation_label_none: string;
  bookshelf_open_match: string;
  profile_title: string;
  profile_kicker: string;
  profile_section_primary: string;
  profile_section_others: string;
  profile_section_relations: string;
  profile_section_friends: string;
  profile_friends_empty: string;
  profile_privacy_title: string;
  profile_privacy_body: string;
  profile_open_today: string;
  bookshelf_completeness: (pct: number) => string;
  bookshelf_completeness_full: string;
  bookshelf_shelf_scroll_hint: string;
  bookshelf_missing_time: string;
  bookshelf_missing_place: string;
  bookshelf_missing_report: string;


  // ---- Match real-import ----
  match_import_title: string;
  match_import_intro: string;
  match_import_my_primary_label: string;
  match_import_no_primary: string;
  match_import_go_home: string;
  match_import_other_label: string;
  match_import_other_placeholder: string;
  match_import_no_others: string;
  match_import_privacy: string;
  match_import_privacy_ack: string;
  match_import_run: string;
  match_import_running: string;
  match_import_partial_note: (missing: string) => string;
  match_demo_details_label: string;


  // ---- /me/friends ----
  friends_title: string;
  friends_subtitle: string;
  tab_friends: (n: number) => string;
  tab_pending: (n: number) => string;
  tab_blocks: (n: number) => string;
  tab_inbox: (n: number) => string;
  friends_empty: string;
  friends_added_at: (when: string) => string;
  friends_send_note: string;
  friends_report: string;
  friends_remove: string;
  friends_block: string;
  friends_seed_incoming: string;
  friends_send_outgoing: string;
  friends_pending_incoming: string;
  friends_pending_outgoing: string;
  friends_pending_incoming_empty: string;
  friends_pending_outgoing_empty: string;
  friends_accept: string;
  friends_decline: string;
  friends_withdraw: string;
  friends_invite_code: (dir: "in" | "out") => string;
  friends_invite_expires: (when: string) => string;
  blocks_empty: string;
  blocks_unblock: string;
  inbox_empty: string;
  toast_need_consent: string;
  toast_seeded: string;
  toast_sent_invite: string;
  toast_accepted: string;
  toast_rejected: string;
  toast_removed: string;
  toast_blocked: string;
  toast_unblocked: string;
  toast_revoked: string;
  toast_report_submitted: (category: string) => string;
  toast_note_sent: (preview: string) => string;
  report_modal_title: (peer: string) => string;
  report_categories: readonly { id: string; label: string }[];
  report_detail_placeholder: string;
  report_submit: string;
  note_modal_title: (peer: string) => string;
  note_modal_hint: string;
  note_templates: readonly { id: string; text: string }[];

  // ---- /me/match ----
  match_kicker: string;
  match_title: string;
  match_intro: (strong: (s: string) => string) => (string | ReturnType<any>)[];
  match_intro_plain: string;
  match_consent_status: string;
  match_consent_ok: string;
  match_consent_revoked: string;
  match_toggle_revoke: string;
  match_toggle_reauth: string;
  match_revoke_hint: string;
  match_demo_labels: Enum<
    "friend_pair" | "complementary_pair" | "clash_pair" | "partial_pair"
  >;
  match_modes: Enum<"friendship" | "romantic" | "family" | "work">;
  match_result_locked_consent: string;
  match_result_locked_revoked: string;
  match_overall_label: string;
  match_partial_pill: (confidence: string) => string;
  match_resonances: string;
  match_complements: string;
  match_frictions: string;
  match_suggestions: string;
  match_evidence_title: string;
  match_evidence_source: (systems: string, crossSupport: boolean) => string;
  match_evidence_source_fallback: string;
  match_evidence_missing: (fields: string) => string;
  match_footer: string;
  match_tech_details_label: string;
  match_tech_line: (version: string, pairKey: string) => string;
  match_facet_labels: Enum<
    "communication" | "emotional_support" | "action_tempo" | "boundary_repair" | "growth"
  >;

  // ---- SocialConsentGate ----
  consent_confirmed: string;
  consent_revoke: string;
  consent_prompt: string;
  consent_age_label: string;
  consent_privacy_label: string;
  consent_footer: string;

  // ---- Enumerable maps (never expose raw keys) ----
  band: Enum<"supportive" | "neutral" | "mixed" | "caution" | "high" | "mid" | "low">;
  confidence: Enum<"high" | "medium" | "low">;
  // v2 domains include body_mind + finance; `wealth` retained for legacy
  // (older Skill fixtures still ship v1 signals until they migrate).
  domain: Enum<"study" | "career" | "love" | "body_mind" | "finance" | "wealth">;
  phase: Enum<
    | "new"
    | "new_moon"
    | "waxing_crescent"
    | "first_quarter"
    | "waxing_gibbous"
    | "full"
    | "full_moon"
    | "waning_gibbous"
    | "last_quarter"
    | "waning_crescent"
  >;
  planet: Record<string, string>;
  aspect: Record<string, string>;
  sign: Record<string, string>;
};

// -------------- Chinese --------------
const zh: DailyDict = {
  nav_today: "今日命运",
  demo_banner_home:
    "DEMO 预览 · 今日阅览室 · 本页数据为演示示例，未写入任何账户，未调用 AI。",
  demo_banner_friends:
    "DEMO 预览 · 好友与邀请 · 仅本地演示，刷新后清空，不写入云端。",
  demo_banner_match:
    "DEMO 预览 · 双人互动适配 · 演示示例，不写入云端，不调用 AI。",
  loading: "加载中…",
  cancel: "取消",
  submit: "提交",
  send: "发送",
  close: "关闭",

  today_kicker: "Today's Reading Room",
  today_title: "今日阅览室",
  today_chart_label: (name) => `命盘：${name}`,
  today_tier_free: "免费 · 基础总览",
  today_tier_member: "会员 · 详细证据",
  today_toggle_membership: "模拟已购会员（不写入真实权益）",
  section_my_charts: "我的命盘（真实数据）",
  my_charts_loading: "正在读取命盘…",
  my_charts_anonymous: "未登录 —— 下方仅显示 DEMO fixture。",
  my_charts_error: (m) => `无法读取命盘：${m}。以下仅显示 DEMO。`,
  my_charts_count: (n) => `已登录 · ${n} 张命盘（只读接入）`,
  my_charts_empty: "你还没有创建命盘。请去仪式创建。",
  my_charts_unnamed: "未命名命盘",
  my_charts_missing_date: "缺日期",
  capabilities_line: ({ rename, del, setDefault }) =>
    `能力：只读列表 ✓ · 重命名 ${rename ? "✓" : "—"} · 删除 ${del ? "✓" : "—"} · 设为默认 ${
      setDefault ? "✓" : "缺列 display_name/is_default，待迁移"
    }`,
  overall_signal: "今日综合信号",
  overall_out_of: "/ 100",
  overall_note:
    "今日阅览室只提供一面镜子，照见星历与心境的交汇；路仍在你脚下。",

  today_theme: "今日主题",
  theme_pending: "今日星象计算待接入 / 缺关键事实。",
  theme_line: (phase, kw) => `月相 ${phase} · 主题词 ${kw}`,
  theme_default_keyword: "静观",
  contradictions_title: "领域间存在张力",
  supportive_title: "今天更适合做的事",
  supportive_demo: [
    "把手上一件搁置的小任务收尾。",
    "花 15 分钟整理近期学习/工作的笔记。",
    "给一位重要的人一个不含要求的问候。",
  ],
  caution_title: "需要观察的事",
  caution_demo: [
    "涉及金钱的重要决定，多留一天再定。",
    "沟通中避免二选一句式，多问对方的语境。",
    "身体信号（睡眠、饮食）异常时先照顾自己。",
  ],
  countercondition_title: "如果现实不同",
  countercondition_body:
    "如果现实情境与今日信号相反（例如实际推进得比预想更顺利），以现实为准；今日读数只是「值得留意的可能性」。",
  reflection_title: "自我探问",
  reflection_body: "「今天有没有一件事，我是因为惯性去做，而不是真的想做？」",
  free_tier_notice:
    "详细证据 / 多命盘每日导读 / 完整匹配报告仅对已购会员开放。基础安全操作（查看命盘、上方总览、建议）永远免费。",
  evidence_title: "为什么这样判断",
  evidence_expand: "展开",
  evidence_collapse: "收起",
  evidence_sample: "采样时间",
  evidence_calc: "calculator",
  evidence_slower: "较慢周期背景",
  evidence_slower_line: (v, b, z) => `Vedic：${v} · BaZi：${b} · Ziwei：${z}`,
  evidence_slower_note:
    "较慢周期仅作背景，绝不推导为「今日必然发生」。项目未计算日干支/日盘/日 Nakshatra。",
  evidence_refs: "证据引用",
  evidence_no_strong: "（本领域今日无强证据；请以现实为准。）",
  evidence_missing: "缺失的事实",
  evidence_footer: "本页为 DEMO；实际生产会绑定用户已保存命盘并按当地日午夜刷新。",
  home_secondary_nav_charts: "我的命盘",
  home_secondary_nav_friends: "好友",
  home_secondary_nav_match: "适配分析",

  charts_primary_title: "我的主命盘",
  charts_primary_missing_title: "先登记你的第一张命盘",
  charts_primary_missing_body:
    "今日阅读将以你的主命盘为准。管理书架可以随时更换主命盘或整理关系书架。",
  charts_primary_missing_cta_ritual: "开启仪式",
  charts_primary_missing_cta_shelf: "管理我的书架",
  bookshelf_open_report: "打开高级报告",
  bookshelf_open_today: "今日命运",
  bookshelf_more_menu: "更多操作",
  bookshelf_role_toggle_self: "改为我的命盘",
  bookshelf_role_toggle_other: "改为他人命盘",
  bookshelf_duplicates_found: (n) => `发现 ${n} 条与之出生信息相同的记录`,
  bookshelf_show_duplicates: "查看重复项",
  bookshelf_hide_duplicates: "收起重复项",
  bookshelf_relations_privacy:
    "关系书架仅你可见，仅用于你个人的适配阅读。请确保已获得对方同意；不会自动公开也不会自动发送好友申请。",
  bookshelf_no_others: "还没有其它属于你自己的命盘。",
  bookshelf_no_relations: "关系书架为空。你保存的他人命盘会出现在这里。",
  bookshelf_main_book_label: "主命盘",
  bookshelf_relation_card_label: "关系藏书",
  bookshelf_relation_label_placeholder: "关系（如：伴侣、母亲、朋友）",
  bookshelf_relation_label_edit: "编辑关系标签",
  bookshelf_relation_label_none: "未设置关系",
  bookshelf_open_match: "适配分析",
  charts_others_title: "他人命盘",

  charts_role_self: "我的",
  charts_role_other: "他人",
  charts_action_rename: "重命名",
  charts_action_set_primary: "设为我的主命盘",
  charts_action_make_other: "设为他人命盘",
  charts_action_save: "保存",
  charts_action_cancel: "取消",
  charts_action_delete: "删除",
  charts_name_placeholder: "输入称呼（例如：小林 / 妈妈 / 合作伙伴）",
  charts_name_empty_error: "称呼不能为空",
  charts_name_too_long_error: "称呼过长（上限 120 个字符）",
  charts_saving: "保存中…",
  charts_setting_primary: "设置中…",
  charts_error_generic: (m) => `操作失败：${m}`,
  charts_untitled_other: "未命名的他人命盘",
  charts_delete_confirm: (name) => `确定删除“${name}”这张命盘及其所有报告吗？此操作不可恢复。`,
  charts_privacy_notice:
    "他人命盘仅供你个人查看与关系适配使用，不会公开给社区或好友。请在保存前确保已获得对方同意。",
  charts_manage_link: "管理我的书架",
  profile_title: "我的图书证",
  profile_kicker: "命运图书馆 · 个人书架",
  profile_section_primary: "我的主命盘",
  profile_section_others: "我的其他命盘",
  profile_section_relations: "关系书架 · 他人命盘",
  profile_section_friends: "好友与来信",
  profile_friends_empty: "还没有好友申请或已建立的联系。",
  profile_privacy_title: "隐私控制",
  profile_privacy_body:
    "默认不加入公开匿名匹配，也不会向好友暴露你的命盘详情。仅在你明确授权关系适配时，才会使用派生匹配特征。",
  profile_open_today: "打开今日命运 →",
  bookshelf_completeness: (p) => `资料完整度 ${p}%`,
  bookshelf_completeness_full: "资料完整",
  bookshelf_shelf_scroll_hint: "← 横向滑动查看更多 →",
  bookshelf_missing_time: "补充出生时间可解锁更精细的时辰分析",
  bookshelf_missing_place: "补充出生地点可校正地方真太阳时",
  bookshelf_missing_report: "尚未生成任何报告",



  match_import_title: "从我的命盘中选择两张进行适配",
  match_import_intro:
    "从你已保存的命盘中挑选两张：一张是你的主命盘，一张是想要适配的他人命盘。计算严格采用项目内确定性引擎，不调用任何 AI。",
  match_import_my_primary_label: "我的主命盘",
  match_import_no_primary: "尚未设置主命盘。",
  match_import_go_home: "去命盘管理设置 →",
  match_import_other_label: "选择他人命盘",
  match_import_other_placeholder: "— 请选择 —",
  match_import_no_others: "你还没有保存任何“他人命盘”。请先在命盘管理中添加。",
  match_import_privacy: "隐私确认",
  match_import_privacy_ack: "我已获得对方同意保存并用于关系适配。",
  match_import_run: "开始适配分析",
  match_import_running: "计算中…",
  match_import_partial_note: (m) => `资料不完整：${m}。以下结果为受限置信度示例。`,
  match_demo_details_label: "查看四组演示案例（不会写入云端 / 不调用 AI）",


  friends_title: "同门 · 好友",
  friends_subtitle:
    "邀请制好友、结构化纸条、屏蔽、举报 —— 没有自由聊天。加为好友后，才可发起双方授权的命盘匹配。",
  tab_friends: (n) => `好友 (${n})`,
  tab_pending: (n) => `待处理 (${n})`,
  tab_blocks: (n) => `屏蔽 (${n})`,
  tab_inbox: (n) => `站内通知 (${n})`,
  friends_empty: "还没有好友，先发一个邀请吧。",
  friends_added_at: (w) => `加为好友 ${w}`,
  friends_send_note: "发送结构化纸条",
  friends_report: "举报",
  friends_remove: "移除",
  friends_block: "屏蔽",
  friends_seed_incoming: "模拟收到一个邀请",
  friends_send_outgoing: "向 demo-peer 发邀请",
  friends_pending_incoming: "收到的邀请",
  friends_pending_outgoing: "发出的邀请",
  friends_pending_incoming_empty: "暂无待你处理的邀请。",
  friends_pending_outgoing_empty: "暂无发出中的邀请。",
  friends_accept: "接受",
  friends_decline: "拒绝",
  friends_withdraw: "撤回",
  friends_invite_code: (d) => (d === "in" ? "← 邀请码" : "→ 邀请码"),
  friends_invite_expires: (w) => `有效期至 ${w}`,
  blocks_empty: "屏蔽列表为空。",
  blocks_unblock: "取消屏蔽",
  inbox_empty: "站内通知会在你邀请、接受、举报、屏蔽或发送纸条时出现。",
  toast_need_consent: "请先确认年龄与隐私同意",
  toast_seeded: "已模拟收到一个好友邀请",
  toast_sent_invite: "已模拟发出一个好友邀请",
  toast_accepted: "已接受",
  toast_rejected: "已拒绝",
  toast_removed: "已移除好友",
  toast_blocked: "已屏蔽（同时解除好友与匹配）",
  toast_unblocked: "已取消屏蔽",
  toast_revoked: "已撤回",
  toast_report_submitted: (c) => `已提交举报（${c}）`,
  toast_note_sent: (p) => `已发送纸条：${p}…`,
  report_modal_title: (peer) => `举报 · ${peer}`,
  report_categories: [
    { id: "harassment", label: "骚扰或不当言论" },
    { id: "spam", label: "垃圾信息 / 广告" },
    { id: "impersonation", label: "冒充他人身份" },
    { id: "underage", label: "对方可能未满 18 岁" },
    { id: "other", label: "其他违反社区约定的行为" },
  ],
  report_detail_placeholder: "可选：简要补充（不接受人身攻击、二次骚扰内容）",
  report_submit: "提交举报",
  note_modal_title: (peer) => `结构化纸条 · 发送给 ${peer}`,
  note_modal_hint: "仅可从下列模板中选择一条；本平台不提供自由聊天。",
  note_templates: [
    { id: "greet", text: "很高兴认识你，一起阅读命运图书馆吧。" },
    { id: "thanks", text: "谢谢你接受邀请。" },
    { id: "match_ask", text: "如果你愿意，我们可以尝试一次双方授权的互动适配。" },
    { id: "boundary", text: "希望我们的交流保持在阅读与探讨的边界内。" },
    { id: "pause", text: "最近我需要一些空间，晚点再联系。" },
  ],

  match_kicker: "双方命盘适配 · 演示",
  match_title: "互动适配（双方授权后可见）",
  match_intro: () => [],
  match_intro_plain:
    "这是互动适配指数，用于观察两个人在沟通、情绪支持、行动节奏、边界修复、共同成长上的样貌，不是关系成功率、婚姻结果或命运判定。真实使用时，需要好友关系 + 双方选择命盘 + 双方明确同意，任一方撤回，结果立即失效。",
  match_consent_status: "授权状态（模拟）",
  match_consent_ok: "已选择命盘并同意",
  match_consent_revoked: "已撤回",
  match_toggle_revoke: "模拟一方撤回",
  match_toggle_reauth: "重新授权",
  match_revoke_hint: "撤回后：结果立即失效，缓存分数清空，另一方看不到本次结果。",
  match_demo_labels: {
    friend_pair: "朋友组合",
    complementary_pair: "互补组合",
    clash_pair: "张力组合",
    partial_pair: "资料不全",
  },
  match_modes: {
    friendship: "朋友",
    romantic: "亲密",
    family: "家人",
    work: "搭档",
  },
  match_result_locked_consent:
    "结果不可见 —— 请先完成年龄与隐私同意。撤回同意后，任何已生成的结果都不再显示。",
  match_result_locked_revoked: "结果已失效 —— 一方撤回授权后，本次匹配结果立即从双方界面移除。",
  match_overall_label: "互动适配指数",
  match_partial_pill: (c) => `事实不完整 · 置信度 ${c}`,
  match_resonances: "共鸣点",
  match_complements: "互补点",
  match_frictions: "误解点",
  match_suggestions: "相处建议",
  match_evidence_title: "证据来源",
  match_evidence_source: (s, cross) =>
    `来自：${s} · ${cross ? "多体系互相支持" : "单一体系或资料不完整"}`,
  match_evidence_source_fallback: "（演示样本切面）",
  match_evidence_missing: (f) => `仍缺：${f}`,
  match_footer: "顺序无关 · 纯确定性计算，不调用 AI。",
  match_tech_details_label: "技术依据（供开发核验）",
  match_tech_line: (v, pk) => `version ${v} · pair-key ${pk}`,
  match_facet_labels: {
    communication: "沟通",
    emotional_support: "情绪支持",
    action_tempo: "行动节奏",
    boundary_repair: "边界修复",
    growth: "共同成长",
  },

  consent_confirmed: `已确认年龄 ≥ ${SOCIAL_MIN_AGE} · 已阅读并接受隐私与匹配授权。撤回后好友与匹配立即锁定。`,
  consent_revoke: "撤回同意",
  consent_prompt: "进入好友与匹配前，请确认以下内容",
  consent_age_label: `我已年满 ${SOCIAL_MIN_AGE} 周岁。未成年人不参与任何双方匹配。`,
  consent_privacy_label:
    "我已阅读隐私说明：匹配需双方各自选择命盘并明确同意；任一方撤回，结果立即失效并不可再次读取。互动适配指数不是关系成功率、婚姻或命运判定。",
  consent_footer: "两项都勾选后才能发起邀请或授权匹配。撤回同意会关闭访问。",

  band: {
    supportive: "支持",
    neutral: "平稳",
    mixed: "混合",
    caution: "留意",
    high: "高",
    mid: "中",
    low: "低",
  },
  confidence: { high: "高", medium: "中", low: "低" },
  domain: {
    study: "学业 · 注意力与理解",
    career: "事业 · 协作与推进",
    love: "关系 · 沟通与边界",
    body_mind: "身心 · 作息与压力",
    finance: "财务 · 预算与复核",
    wealth: "财务 · 预算与复核",
  },
  phase: {
    new: "新月",
    new_moon: "新月",
    waxing_crescent: "娥眉月（渐盈）",
    first_quarter: "上弦月",
    waxing_gibbous: "盈凸月",
    full: "满月",
    full_moon: "满月",
    waning_gibbous: "亏凸月",
    last_quarter: "下弦月",
    waning_crescent: "残月",
  },
  planet: {
    sun: "太阳", moon: "月亮", mercury: "水星", venus: "金星", mars: "火星",
    jupiter: "木星", saturn: "土星", uranus: "天王星", neptune: "海王星", pluto: "冥王星",
    north_node: "北交点", south_node: "南交点", chiron: "凯龙星",
  },
  aspect: {
    conjunction: "合相", opposition: "对分", trine: "三分", square: "四分",
    sextile: "六分", quincunx: "梅花",
  },
  sign: {
    aries: "白羊", taurus: "金牛", gemini: "双子", cancer: "巨蟹",
    leo: "狮子", virgo: "处女", libra: "天秤", scorpio: "天蝎",
    sagittarius: "射手", capricorn: "摩羯", aquarius: "水瓶", pisces: "双鱼",
  },
};

// -------------- English --------------
const en: DailyDict = {
  nav_today: "Today",
  demo_banner_home:
    "DEMO preview · Today's Reading Room · sample data only, nothing written to your account, no AI.",
  demo_banner_friends:
    "DEMO preview · Friends & invites · local sample only, cleared on reload, not synced to cloud.",
  demo_banner_match:
    "DEMO preview · Bilateral compatibility · sample only, nothing written to cloud, no AI.",
  loading: "Loading…",
  cancel: "Cancel",
  submit: "Submit",
  send: "Send",
  close: "Close",

  today_kicker: "Today's Reading Room",
  today_title: "Today's Reading Room",
  today_chart_label: (name) => `Chart: ${name}`,
  today_tier_free: "Free · overview",
  today_tier_member: "Member · full evidence",
  today_toggle_membership: "Simulate member (no real entitlement is written)",
  section_my_charts: "My charts (real data)",
  my_charts_loading: "Loading charts…",
  my_charts_anonymous: "Signed out — showing DEMO fixtures below.",
  my_charts_error: (m) => `Could not load charts: ${m}. Showing DEMO only.`,
  my_charts_count: (n) => `Signed in · ${n} chart${n === 1 ? "" : "s"} (read-only)`,
  my_charts_empty: "No charts yet. Create one from the Ritual.",
  my_charts_unnamed: "Untitled chart",
  my_charts_missing_date: "no date",
  capabilities_line: ({ rename, del, setDefault }) =>
    `Capabilities: read-only list ✓ · rename ${rename ? "✓" : "—"} · delete ${del ? "✓" : "—"} · set default ${
      setDefault ? "✓" : "needs display_name/is_default column — pending migration"
    }`,
  overall_signal: "Today's overall signal",
  overall_out_of: "/ 100",
  overall_note:
    "This is a \"domain signal for today\" — not a success rate or luck score. Suggestions are informational; real context wins.",
  today_theme: "Today's theme",
  theme_pending: "Today's astronomy not yet wired / key facts missing.",
  theme_line: (phase, kw) => `Moon phase ${phase} · themes ${kw}`,
  theme_default_keyword: "observe",
  contradictions_title: "Tension between domains",
  supportive_title: "Better suited for today",
  supportive_demo: [
    "Finish one small task that's been sitting.",
    "Spend 15 min tidying recent study/work notes.",
    "Send a plain hello to someone who matters — no ask attached.",
  ],
  caution_title: "Worth watching today",
  caution_demo: [
    "Give money-related decisions one more day before committing.",
    "Avoid either/or phrasing in conversation; ask for the other person's context.",
    "If sleep or appetite feels off, care for yourself first.",
  ],
  countercondition_title: "If reality differs",
  countercondition_body:
    "If what actually happens contradicts today's signal (say, things go smoother than expected), trust reality. Today's reading only names a possibility worth watching.",
  reflection_title: "A question for yourself",
  reflection_body: "\"Is there anything I'm doing today out of habit rather than because I want to?\"",
  free_tier_notice:
    "Full evidence, multi-chart daily readings and complete match reports are member-only. Baseline safety actions (viewing charts, this overview, suggestions) stay free.",
  evidence_title: "Why this reading",
  evidence_expand: "expand",
  evidence_collapse: "collapse",
  evidence_sample: "Sampled at",
  evidence_calc: "calculator",
  evidence_slower: "Slower cycles (background)",
  evidence_slower_line: (v, b, z) => `Vedic: ${v} · BaZi: ${b} · Ziwei: ${z}`,
  evidence_slower_note:
    "Slower cycles are background context only — never treated as \"today will therefore happen.\" Daily-stem / day-chart / day-nakshatra are not calculated in this project.",
  evidence_refs: "Evidence refs",
  evidence_no_strong: "(No strong evidence for this domain today — go with reality.)",
  evidence_missing: "Missing facts",
  evidence_footer:
    "This page is a DEMO; production would bind your saved chart and refresh at local midnight.",
  home_secondary_nav_charts: "My charts",
  home_secondary_nav_friends: "Friends",
  home_secondary_nav_match: "Match",

  charts_primary_title: "My primary chart",
  charts_primary_missing_title: "Register your first chart",
  charts_primary_missing_body:
    "Today's reading needs your primary chart. Manage your bookshelf to swap it or organise your relationship shelf.",
  charts_primary_missing_cta_ritual: "Open the ritual",
  charts_primary_missing_cta_shelf: "Manage my bookshelf",
  bookshelf_open_report: "Open premium report",
  bookshelf_open_today: "Today's reading",
  bookshelf_more_menu: "More",
  bookshelf_role_toggle_self: "Mark as mine",
  bookshelf_role_toggle_other: "Mark as other",
  bookshelf_duplicates_found: (n) => `Found ${n} record${n === 1 ? "" : "s"} with the same birth details`,
  bookshelf_show_duplicates: "Show duplicates",
  bookshelf_hide_duplicates: "Hide duplicates",
  bookshelf_relations_privacy:
    "The relationship shelf is private to you and only used for your own compatibility reads. Please confirm you have the other person's consent. Nothing here is auto-published or auto-sent as a friend request.",
  bookshelf_no_others: "You don't have any other charts of your own yet.",
  bookshelf_no_relations: "Your relationship shelf is empty. Other-people charts you save appear here.",
  bookshelf_main_book_label: "Primary chart",
  bookshelf_relation_card_label: "Relationship card",
  bookshelf_relation_label_placeholder: "Relationship (Partner, Mother, Friend…)",
  bookshelf_relation_label_edit: "Edit relationship label",
  bookshelf_relation_label_none: "No relationship set",
  bookshelf_open_match: "Compatibility",
  charts_others_title: "Other charts",

  charts_role_self: "Mine",
  charts_role_other: "Other",
  charts_action_rename: "Rename",
  charts_action_set_primary: "Set as my primary",
  charts_action_make_other: "Mark as other",
  charts_action_save: "Save",
  charts_action_cancel: "Cancel",
  charts_action_delete: "Delete",
  charts_name_placeholder: "Nickname (e.g. Alex / Mom / Partner)",
  charts_name_empty_error: "Name cannot be empty",
  charts_name_too_long_error: "Name too long (max 120 characters)",
  charts_saving: "Saving…",
  charts_setting_primary: "Setting…",
  charts_error_generic: (m) => `Could not update: ${m}`,
  charts_untitled_other: "Untitled other chart",
  charts_delete_confirm: (name) =>
    `Delete “${name}” and all of its reports? This cannot be undone.`,
  charts_privacy_notice:
    "Other-people charts are private to you and only used for your own compatibility read. Make sure you have their consent before saving.",
  charts_manage_link: "Manage my bookshelf",
  profile_title: "My library card",
  profile_kicker: "Destiny Library · Personal bookshelf",
  profile_section_primary: "My primary chart",
  profile_section_others: "My other charts",
  profile_section_relations: "Relationship shelf · other people",
  profile_section_friends: "Friends & letters",
  profile_friends_empty: "No pending friend letters or accepted connections yet.",
  profile_privacy_title: "Privacy controls",
  profile_privacy_body:
    "By default you are not in the anonymous match pool, and friends never see your chart details. Derived compatibility features are only used after you explicitly authorize a match.",
  profile_open_today: "Open Today's Reading →",
  bookshelf_completeness: (p) => `Profile ${p}% complete`,
  bookshelf_completeness_full: "Profile complete",
  bookshelf_shelf_scroll_hint: "← swipe to see more →",
  bookshelf_missing_time: "Add a birth time to unlock finer hour-level analysis",
  bookshelf_missing_place: "Add a birth place to apply true local solar time",
  bookshelf_missing_report: "No report generated yet",



  match_import_title: "Pick two saved charts to compare",
  match_import_intro:
    "Choose your primary chart and one saved “other” chart. Compatibility is computed by the project’s deterministic engine — no AI is called.",
  match_import_my_primary_label: "My primary chart",
  match_import_no_primary: "No primary chart yet.",
  match_import_go_home: "Set one up in chart manager →",
  match_import_other_label: "Pick an other-person chart",
  match_import_other_placeholder: "— select —",
  match_import_no_others: "You have no “other” charts saved yet. Add one from chart manager.",
  match_import_privacy: "Consent confirmation",
  match_import_privacy_ack: "I have their consent to save this chart and run compatibility.",
  match_import_run: "Run compatibility",
  match_import_running: "Computing…",
  match_import_partial_note: (m) => `Facts incomplete: ${m}. Result shown at reduced confidence.`,
  match_demo_details_label: "See the four demo pairs (never stored, no AI)",


  friends_title: "Friends",
  friends_subtitle:
    "Invite-only friends, structured notes, block, report — no free chat. Adding a friend is required before you can start a mutual-consent chart match.",
  tab_friends: (n) => `Friends (${n})`,
  tab_pending: (n) => `Pending (${n})`,
  tab_blocks: (n) => `Blocks (${n})`,
  tab_inbox: (n) => `Inbox (${n})`,
  friends_empty: "No friends yet — send an invite to get started.",
  friends_added_at: (w) => `Added ${w}`,
  friends_send_note: "Send structured note",
  friends_report: "Report",
  friends_remove: "Remove",
  friends_block: "Block",
  friends_seed_incoming: "Simulate incoming invite",
  friends_send_outgoing: "Send invite to demo-peer",
  friends_pending_incoming: "Incoming invites",
  friends_pending_outgoing: "Outgoing invites",
  friends_pending_incoming_empty: "No invites waiting for you.",
  friends_pending_outgoing_empty: "No invites in flight.",
  friends_accept: "Accept",
  friends_decline: "Decline",
  friends_withdraw: "Withdraw",
  friends_invite_code: (d) => (d === "in" ? "← invite code" : "→ invite code"),
  friends_invite_expires: (w) => `Expires ${w}`,
  blocks_empty: "Blocklist is empty.",
  blocks_unblock: "Unblock",
  inbox_empty: "Notifications appear when you invite, accept, report, block, or send a note.",
  toast_need_consent: "Please confirm age and privacy first",
  toast_seeded: "Simulated an incoming invite",
  toast_sent_invite: "Simulated an outgoing invite",
  toast_accepted: "Accepted",
  toast_rejected: "Declined",
  toast_removed: "Friend removed",
  toast_blocked: "Blocked (also removes friendship & any match)",
  toast_unblocked: "Unblocked",
  toast_revoked: "Withdrawn",
  toast_report_submitted: (c) => `Report submitted (${c})`,
  toast_note_sent: (p) => `Note sent: ${p}…`,
  report_modal_title: (peer) => `Report · ${peer}`,
  report_categories: [
    { id: "harassment", label: "Harassment or inappropriate speech" },
    { id: "spam", label: "Spam / advertising" },
    { id: "impersonation", label: "Impersonation" },
    { id: "underage", label: "Peer may be under 18" },
    { id: "other", label: "Other community-guideline violation" },
  ],
  report_detail_placeholder: "Optional short note (no personal attacks or repeat harassment)",
  report_submit: "Submit report",
  note_modal_title: (peer) => `Structured note · to ${peer}`,
  note_modal_hint: "Pick one of the templates below. Free-form chat is not supported.",
  note_templates: [
    { id: "greet", text: "Nice to meet you — let's read the Library of Destiny together." },
    { id: "thanks", text: "Thanks for accepting the invite." },
    { id: "match_ask", text: "If you'd like, we can try one mutual-consent compatibility read." },
    { id: "boundary", text: "I'd like to keep our exchange focused on reading and reflection." },
    { id: "pause", text: "I need some space right now; let's reconnect later." },
  ],

  match_kicker: "Two-chart compatibility · demo",
  match_title: "Compatibility (visible only after mutual consent)",
  match_intro: () => [],
  match_intro_plain:
    "This is a compatibility index — a lens on how two people show up in communication, emotional support, action tempo, boundary repair, and shared growth. It is not a success rate, marriage outcome, or fate verdict. In real use it requires a friendship, both people picking a chart, and both people explicitly consenting. Either side withdrawing invalidates the result immediately.",
  match_consent_status: "Consent status (simulated)",
  match_consent_ok: "Chart chosen · consented",
  match_consent_revoked: "Withdrawn",
  match_toggle_revoke: "Simulate one side withdrawing",
  match_toggle_reauth: "Re-authorize",
  match_revoke_hint:
    "After withdrawal: the result is invalidated instantly, cached score is dropped, the peer can no longer see it.",
  match_demo_labels: {
    friend_pair: "Friendly pair",
    complementary_pair: "Complementary pair",
    clash_pair: "Tension pair",
    partial_pair: "Incomplete facts",
  },
  match_modes: {
    friendship: "Friendship",
    romantic: "Romantic",
    family: "Family",
    work: "Co-founders",
  },
  match_result_locked_consent:
    "Result hidden — please complete the age & privacy consent first. Any previous result is removed once consent is withdrawn.",
  match_result_locked_revoked:
    "Result invalidated — once either side withdraws, the match is immediately removed from both views.",
  match_overall_label: "Compatibility index",
  match_partial_pill: (c) => `Facts incomplete · confidence ${c}`,
  match_resonances: "Resonance",
  match_complements: "Complements",
  match_frictions: "Friction points",
  match_suggestions: "Suggestions",
  match_evidence_title: "Evidence source",
  match_evidence_source: (s, cross) =>
    `Sources: ${s} · ${cross ? "supported by multiple systems" : "single-system or incomplete data"}`,
  match_evidence_source_fallback: "(demo sample facets)",
  match_evidence_missing: (f) => `Still missing: ${f}`,
  match_footer: "Order-independent · deterministic, no AI.",
  match_tech_details_label: "Technical basis (for developer audit)",
  match_tech_line: (v, pk) => `version ${v} · pair-key ${pk}`,
  match_facet_labels: {
    communication: "Communication",
    emotional_support: "Emotional support",
    action_tempo: "Action tempo",
    boundary_repair: "Boundary repair",
    growth: "Shared growth",
  },

  consent_confirmed: `Age ≥ ${SOCIAL_MIN_AGE} confirmed · privacy & match consent accepted. Withdrawing locks friends and match immediately.`,
  consent_revoke: "Withdraw consent",
  consent_prompt: "Before entering friends & match, please confirm:",
  consent_age_label: `I am at least ${SOCIAL_MIN_AGE} years old. Minors do not participate in any two-party match.`,
  consent_privacy_label:
    "I have read the privacy notice: match requires each side to pick a chart and consent explicitly. Either side withdrawing invalidates the result immediately, and it cannot be read again. The compatibility index is not a success rate, marriage outcome or fate verdict.",
  consent_footer:
    "Both checkboxes are required to send invites or authorize a match. Withdrawing closes access.",

  band: {
    supportive: "Supportive",
    neutral: "Neutral",
    mixed: "Mixed",
    caution: "Caution",
    high: "High",
    mid: "Mid",
    low: "Low",
  },
  confidence: { high: "High", medium: "Medium", low: "Low" },
  domain: {
    study: "Study · focus & review",
    career: "Career · collaboration & momentum",
    love: "Relationships · communication & boundaries",
    body_mind: "Body & mind · rest & pressure",
    finance: "Finance · budget & review",
    wealth: "Finance · budget & review",
  },
  phase: {
    new: "New moon",
    new_moon: "New moon",
    waxing_crescent: "Waxing crescent",
    first_quarter: "First quarter",
    waxing_gibbous: "Waxing gibbous",
    full: "Full moon",
    full_moon: "Full moon",
    waning_gibbous: "Waning gibbous",
    last_quarter: "Last quarter",
    waning_crescent: "Waning crescent",
  },
  planet: {
    sun: "Sun", moon: "Moon", mercury: "Mercury", venus: "Venus", mars: "Mars",
    jupiter: "Jupiter", saturn: "Saturn", uranus: "Uranus", neptune: "Neptune", pluto: "Pluto",
    north_node: "North Node", south_node: "South Node", chiron: "Chiron",
  },
  aspect: {
    conjunction: "Conjunction", opposition: "Opposition", trine: "Trine",
    square: "Square", sextile: "Sextile", quincunx: "Quincunx",
  },
  sign: {
    aries: "Aries", taurus: "Taurus", gemini: "Gemini", cancer: "Cancer",
    leo: "Leo", virgo: "Virgo", libra: "Libra", scorpio: "Scorpio",
    sagittarius: "Sagittarius", capricorn: "Capricorn", aquarius: "Aquarius", pisces: "Pisces",
  },
};

export const DAILY_DICTS: Record<Lang, DailyDict> = { zh, en };

export function useDaily(): DailyDict {
  const { lang } = useLang();
  return DAILY_DICTS[lang];
}

/** Translate an enum-ish token via the map, falling back to a
 * humanized version of the raw key so we never surface a bare
 * `waxing_crescent` in the UI. */
export function xlate(map: Record<string, string>, key: string | undefined | null): string {
  if (!key) return "";
  if (map[key]) return map[key];
  return key.replace(/_/g, " ");
}

/** Intl date formatter, locale-aware. */
export function useFormatDate() {
  const { lang } = useLang();
  return useMemo(
    () => (isoOrDate: string | Date, tz?: string) => {
      const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
      return new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: tz,
      }).format(d);
    },
    [lang],
  );
}

/** Locale-aware number formatter. */
export function formatNumber(n: number, lang: Lang): string {
  return new Intl.NumberFormat(lang === "zh" ? "zh-CN" : "en-US").format(n);
}
