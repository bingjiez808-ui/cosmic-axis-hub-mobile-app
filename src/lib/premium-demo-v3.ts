/**
 * Deterministic v3 demo sample — used ONLY by the dev/preview route
 * `/dev/demo-premium`. Never served to real users, never inserted
 * into the database. Every field is hand-authored so the UI can be
 * exercised without a real AI call.
 *
 * Guard: the route that consumes this exports its own gate; this
 * module also refuses to import into a production bundle via the
 * `DEV_SAMPLE_ONLY` marker string (tests assert it is a fixture).
 */
import type { V3ReportContent } from "./premium-chapters-v3";
import { PREMIUM_V3_CHAPTERS } from "./premium-chapters-v3";

export const DEV_SAMPLE_ONLY = "DEMO_SAMPLE_NOT_A_REAL_USER" as const;

const filler = (lines: string[]) => lines.join("\n\n");

/** Five representative chapters get fleshed-out bodies; the other 19
 *  render as short placeholders so total UI still exercises 24-chapter
 *  navigation, TOC drawer, timelines, and evidence expansion. */
const REPRESENTATIVE_BODIES: Record<string, string> = {
  executive_summary: filler([
    "本报告以本地确定性排盘为唯一事实来源：西方本命由 astronomy-engine 计算九大行星黄经与主要相位；印度体系以 VSOP87 结合 Lahiri 岁差得到 sidereal 位置并展开 Vimshottari 大限至 Antardasha；八字由 lunar-javascript 得到四柱、日主与十神；紫微由 iztro 提供十二宫、主辅星与四化。AI 只负责就地叙述这些字段，不推算未提供的内容。",
    "以下摘要指向本命四体系共同强调的两条主线：一是命宫 / 太阳 / 日主共同呈现的表达主轴；二是财 / 官 / 迁移相关宫位在流年层面的窗口。任何具体判断都在后续章节标注 evidence_refs，可点击回到事实面板核对。",
    "本报告不涉及疾病诊断、灾祸预言或收益保证；请将结论视为一份可供反思的语言化命盘地图。",
  ]),
  bazi_pillars: filler([
    "四柱（示例数据）：年 庚午 · 月 甲申 · 日 己酉 · 时 甲子。日主为「己土」，坐酉金，天透甲木正官、地藏庚金伤官，全局金气偏旺。",
    "月令申金为伤官格，日支酉金进一步加强伤官，说明表达欲、语言与技艺具有天然的输出通道；同时天干双甲透出，正官气场明显，形成「伤官见官」的经典张力：既想突破规范，也需要被制度承认。",
    "五行分布倾向金旺、木通、火土偏弱。事业与自我价值的成就感来自「以专业技艺被制度采纳」的路径。",
  ]),
  ziwei_palaces: filler([
    "命宫（示例数据）落在午宫，主星「紫微 · 天相」组合，庙旺。身宫在寅宫，主星「太阳 · 巨门」双星，太阳庙。",
    "十四主星在十二宫的分布显示：财帛宫见「武曲 · 天府」，官禄宫见「廉贞 · 破军」，迁移宫见「贪狼」化禄。四化中「太阳化权、天同化禄」提示自我表达与愉悦感受可以直接换算为影响力与资源。",
    "命宫紫微天相的组合传统上被读作「稳重的领导者」——愿意先承担再谈条件；相应地也需要留意「过度独揽」的倾向。",
  ]),
  year_ahead: filler([
    "下一年 Vedic Mahadasha 处于 Jupiter，Antardasha 切换到 Saturn（示例数据），意味着长期蓝图（Jupiter）会被具体的现实秩序（Saturn）打磨。",
    "八字大运（示例数据）走「丙戌」，火土同来生扶己土日主，弱势格局得到明显补气；结合紫微大限「财帛宫」正在化禄，本年整体是「储备 + 建构」的窗口，不宜追求快速换赛道。",
    "关键时间窗口：农历三月、七月两个太阳 / 太阴切换点；西历九月前后木星与本命太阳成合相；这些均已在事实面板给出对应 evidence path，AI 只做语言化。",
  ]),
  methodology: filler([
    "本报告的所有排盘均为本地确定性计算，AI 提供者仅接受结构化 FACTS JSON 与本章的 evidence_refs 白名单，不能引用未列出的字段。",
    "缓存策略：同一命盘 + 同一版本组合只生成一次并永久保存；再次打开个人中心 0 次 AI 调用。失败章节可安全续跑，成功章节永不覆盖。",
    "本报告不构成医疗、法律或投资建议，请自行判断。",
  ]),
};

function shortPlaceholder(title: string) {
  return `本章为示例样例的简短占位内容（章节：${title}）。真实报告会依据事实面板展开 500–1300 字的中文正文，并附 evidence_refs。`;
}

export const PREMIUM_V3_DEMO_SAMPLE: V3ReportContent = {
  schema_version: "v3",
  meta: {
    prompt_version: "premium_deep_v3",
    report_version: "premium_pdf_v1",
    lang: "zh",
    generated_at: "2026-07-17T00:00:00.000Z",
    chart_name: `${DEV_SAMPLE_ONLY} · 演示样例`,
    disclaimer: "本报告为演示样例，非真实客户命盘。所有姓名、生日与结论均为示例，仅用于开发和产品评审。",
  },
  cover: {
    title: "命运图书馆 · 高级 AI 深度报告（演示样例）",
    subtitle: "DEMO SAMPLE — NOT A REAL USER",
  },
  chapters: PREMIUM_V3_CHAPTERS.map((meta) => {
    const modulePool = [
      { path: "bazi.pillars.day", module: "bazi" as const, confidence: "grounded" as const },
      { path: "bazi.pillars.year", module: "bazi" as const, confidence: "grounded" as const },
      { path: "ziwei.palaces[0].main_stars", module: "ziwei" as const, confidence: "grounded" as const },
      { path: "western.sun", module: "western" as const, confidence: "grounded" as const },
      { path: "western.moon", module: "western" as const, confidence: "grounded" as const },
      { path: "vedic.moon", module: "vedic" as const, confidence: "grounded" as const },
      { path: "bazi_luck.current", module: "bazi_luck" as const, confidence: "grounded" as const },
      { path: "ziwei_horoscope.year", module: "ziwei_horoscope" as const, confidence: "grounded" as const },
      { path: "vedic_dasha.current", module: "vedic_dasha" as const, confidence: "grounded" as const },
      { path: "western_aspects.list[0]", module: "western_aspects" as const, confidence: "grounded" as const },
      { path: "western_aspects.list[1]", module: "western_aspects" as const, confidence: "grounded" as const },
    ];
    const allowed = meta.allowed_facts.length === 0 ? [] : modulePool.filter((r) => meta.allowed_facts.includes(r.module));
    const minRefs = Math.max(meta.min_evidence_refs ?? 0, meta.min_module_variety ?? 0, meta.kind === "cross" ? 2 : meta.allowed_facts.length > 0 ? 1 : 0);
    const picks: typeof modulePool = [];
    const seen = new Set<string>();
    for (const r of allowed) if (!seen.has(r.module)) { picks.push(r); seen.add(r.module); }
    for (const r of allowed) { if (picks.length >= minRefs) break; if (!picks.includes(r)) picks.push(r); }
    const evidence_refs = picks;
    const secBody = (meta.required_sections ?? []).map((s) => `## ${s.marker_zh}\n围绕「${s.marker_zh}」展开的示例段落，用以支撑事实解释。`).join("\n\n");
    const tabBody = (meta.required_tables ?? []).map((t) => `### ${t.title_zh}\n| 维度 | 表现 | 建议 |\n| --- | --- | --- |\n| 主线 | 由事实推导 | 立即可行的一步 |`).join("\n\n");
    const bodyBase = REPRESENTATIVE_BODIES[meta.key] ?? shortPlaceholder(meta.title_zh);
    const body = [bodyBase, secBody, tabBody].filter(Boolean).join("\n\n");
    return { key: meta.key, title: meta.title_zh, body, evidence_refs };
  }),
  budget: {
    total_input_tokens: 42_000,
    total_output_tokens: 21_500,
    stopped_reason: null,
  },
};
