import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";

import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const Input = z.object({
  name: z.string().optional(),
  date: z.string().optional(),
  time: z.string().optional(),
  place: z.string().optional(),
  lang: z.enum(["en", "zh"]).default("en"),
  quiz: z.string().optional(),
  planets: z
    .array(
      z.object({
        name: z.string(),
        sign: z.string(),
        house: z.number().optional(),
      }),
    )
    .default([]),
  bazi: z.string().optional(),
  zodiac: z.string().optional(),
  lunar: z.string().optional(),
});

export type OutlookDecade = {
  from: number;
  to: number;
  theme: string;
  detail: string;
  personalTint: string;
  years: { age: number; intensity: number; theme: string }[];
};

export type OutlookBar = { label: string; value: number; reason: string };
export type OutlookWindow = {
  offsetFromDays: number;
  offsetToDays: number;
  tone: string;
  score: number;
  body: string;
};
export type OutlookDimension = {
  key: "career" | "study" | "love" | "health";
  title: string;
  points: string[];
  cautions: string[];
  mitigations: string[];
};

export type OutlookWatchItem = {
  year: string;
  theme: string;
  note: string;
  detail: string;
};

export type OutlookAI = {
  timeline: {
    summary: string;
    decades: OutlookDecade[];
  };
  outlook90: {
    stateSummary: string;
    stateScore: number;
    bars: OutlookBar[];
    windows: OutlookWindow[];
    dimensions: OutlookDimension[];
  };
  watchlist: OutlookWatchItem[];
};

export const generateChartOutlook = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }): Promise<OutlookAI> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(key);
    const isZh = data.lang === "zh";
    const today = new Date().toISOString().slice(0, 10);

    const planetLines = data.planets
      .map((p) => `${p.name} in ${p.sign}${p.house ? ` (house ${p.house})` : ""}`)
      .join("; ");

    const chartFacts = [
      data.name && `Name: ${data.name}`,
      data.date && `Birth date (solar): ${data.date}`,
      data.time && `Birth time: ${data.time}`,
      data.place && `Birth place: ${data.place}`,
      data.lunar && `Lunar date: ${data.lunar}`,
      data.zodiac && `Chinese zodiac: ${data.zodiac}`,
      data.bazi && `BaZi four pillars: ${data.bazi}`,
      planetLines && `Western placements: ${planetLines}`,
      `Today (server date): ${today}`,
    ]
      .filter(Boolean)
      .join("\n");

    const system = isZh
      ? `你是精通八字流年大运与西方过境行运的老者。只输出严格 JSON，不能有前后缀、注释或 Markdown 代码块。
硬性规则：
- 生命时间轴的每个大运（十年）都必须点出该阶段的**大运干支或十神走向**，并结合西方推进（如土星回归、木星过境）。
- 90 天窗口必须结合**当前流月/流年干支**与**当前主要过境行星**（水星逆行、金星过境、外行星相位等）。
- 每一段文字都要引用至少一条上面给出的具体事实，禁止通用模板句。
- 语气温暖、诗意、克制，像烛下低语。`
      : `You are an elder fluent in BaZi luck-decades (大运/流年) and Western transit astrology. Output STRICT JSON only — no prose, comments, or code fences.
Hard rules:
- Each life-timeline decade MUST cite that decade's **luck-pillar stem/branch or Ten-God trend** and pair it with a Western marker (Saturn return, Jupiter transit, etc.).
- The 90-day windows MUST anchor in the **current month/year pillar** and the **actual transits happening now** (Mercury retrograde, Venus ingress, outer-planet aspects).
- Every sentence must reference at least one concrete fact listed above — no generic templates.
- Tone: warm, poetic, restrained.`;

    const schemaZh = `{
  "timeline": {
    "summary": "两三句诗意概括，必须引用具体干支或行星",
    "decades": [
      {
        "from": 0, "to": 10,
        "theme": "6-12 字的意象",
        "detail": "3 句，点出该十年的大运干支/十神与主要行运（土星回归、木星过境等）",
        "personalTint": "1-2 句，此十年对此人的独特倾向",
        "years": [ { "age": 0, "intensity": 0.35, "theme": "10-16 字的年度意象" } /* 10 项 */ ]
      }
      /* 共 8 个：0-10 / 10-20 / 20-30 / 30-40 / 40-50 / 50-60 / 60-70 / 70-80 */
    ]
  },
  "outlook90": {
    "stateSummary": "一句话说明此刻状态的成因（流月干支 + 当前过境）",
    "stateScore": 0-100 的整数,
    "bars": [
      { "label": "元气", "value": 0-100, "reason": "一句缘由" },
      { "label": "专注", "value": 0-100, "reason": "…" },
      { "label": "情绪", "value": 0-100, "reason": "…" },
      { "label": "运气窗口", "value": 0-100, "reason": "…" }
    ],
    "windows": [
      { "offsetFromDays": 0,  "offsetToDays": 6,  "tone": "3-6 字标题", "score": 0-100, "body": "2-3 句，引用具体行运" },
      { "offsetFromDays": 7,  "offsetToDays": 20, "tone": "…", "score": 0-100, "body": "…" },
      { "offsetFromDays": 21, "offsetToDays": 45, "tone": "…", "score": 0-100, "body": "…" },
      { "offsetFromDays": 46, "offsetToDays": 90, "tone": "…", "score": 0-100, "body": "…" }
    ],
    "dimensions": [
      { "key": "career", "title": "事业", "points": ["3 条"], "cautions": ["2 条"], "mitigations": ["2 条"] },
      { "key": "study",  "title": "学业", "points": ["3 条"], "cautions": ["2 条"], "mitigations": ["2 条"] },
      { "key": "love",   "title": "爱情", "points": ["3 条"], "cautions": ["2 条"], "mitigations": ["2 条"] },
      { "key": "health", "title": "健康", "points": ["3 条"], "cautions": ["2 条"], "mitigations": ["2 条"] }
    ]
  }
}`;

    const schemaEn = `{
  "timeline": {
    "summary": "2-3 poetic sentences citing concrete pillars or transits",
    "decades": [
      {
        "from": 0, "to": 10,
        "theme": "6-12 char image",
        "detail": "3 sentences citing this decade's luck-pillar stem/branch + a Western marker",
        "personalTint": "1-2 lines specific to this person",
        "years": [ { "age": 0, "intensity": 0.35, "theme": "concrete 10-16 word image" } /* 10 entries */ ]
      }
      /* 8 total: 0-10 / 10-20 / 20-30 / 30-40 / 40-50 / 50-60 / 60-70 / 70-80 */
    ]
  },
  "outlook90": {
    "stateSummary": "one sentence explaining the current state (month-pillar + live transits)",
    "stateScore": integer 0-100,
    "bars": [
      { "label": "Vitality", "value": 0-100, "reason": "…" },
      { "label": "Focus",    "value": 0-100, "reason": "…" },
      { "label": "Mood",     "value": 0-100, "reason": "…" },
      { "label": "Luck window", "value": 0-100, "reason": "…" }
    ],
    "windows": [
      { "offsetFromDays": 0,  "offsetToDays": 6,  "tone": "short title", "score": 0-100, "body": "2-3 lines citing a real transit" },
      { "offsetFromDays": 7,  "offsetToDays": 20, "tone": "…", "score": 0-100, "body": "…" },
      { "offsetFromDays": 21, "offsetToDays": 45, "tone": "…", "score": 0-100, "body": "…" },
      { "offsetFromDays": 46, "offsetToDays": 90, "tone": "…", "score": 0-100, "body": "…" }
    ],
    "dimensions": [
      { "key": "career", "title": "Career", "points": ["3 items"], "cautions": ["2"], "mitigations": ["2"] },
      { "key": "study",  "title": "Study",  "points": ["3"], "cautions": ["2"], "mitigations": ["2"] },
      { "key": "love",   "title": "Love",   "points": ["3"], "cautions": ["2"], "mitigations": ["2"] },
      { "key": "health", "title": "Health", "points": ["3"], "cautions": ["2"], "mitigations": ["2"] }
    ]
  }
}`;

    const prompt = `${isZh ? "命盘事实" : "Chart facts"}:
${chartFacts}

${isZh ? "严格按此 JSON schema 输出（只输出 JSON）" : "Output STRICTLY this JSON schema (JSON only)"}:
${isZh ? schemaZh : schemaEn}`;

    const { text } = await generateText({
      model: gateway("google/gemini-3.5-flash"),
      system,
      prompt,
    });

    const cleaned = text
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "");
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");
    const jsonStr = first >= 0 && last > first ? cleaned.slice(first, last + 1) : cleaned;

    let parsed: OutlookAI;
    try {
      parsed = JSON.parse(jsonStr) as OutlookAI;
    } catch (err) {
      throw new Error(
        `Outlook JSON parse failed: ${(err as Error).message}. Head: ${jsonStr.slice(0, 240)}`,
      );
    }

    // Normalise decades: guarantee 8 decades 0-80 in order.
    const decades = parsed.timeline?.decades ?? [];
    const targetRanges: [number, number][] = [
      [0, 10], [10, 20], [20, 30], [30, 40], [40, 50], [50, 60], [60, 70], [70, 80],
    ];
    const normalizedDecades: OutlookDecade[] = targetRanges.map(([f, t], i) => {
      const src = decades.find((d) => d?.from === f && d?.to === t) ?? decades[i];
      const years = Array.isArray(src?.years) ? src!.years : [];
      const filledYears = Array.from({ length: t - f }, (_, k) => {
        const age = f + k;
        const y = years.find((yy) => yy?.age === age) ?? years[k];
        return {
          age,
          intensity: typeof y?.intensity === "number" ? Math.max(0.15, Math.min(1, y.intensity)) : 0.4 + Math.random() * 0.4,
          theme: y?.theme ?? "",
        };
      });
      return {
        from: f,
        to: t,
        theme: src?.theme ?? "",
        detail: src?.detail ?? "",
        personalTint: src?.personalTint ?? "",
        years: filledYears,
      };
    });

    const outlook = parsed.outlook90 ?? ({} as OutlookAI["outlook90"]);
    return {
      timeline: {
        summary: parsed.timeline?.summary ?? "",
        decades: normalizedDecades,
      },
      outlook90: {
        stateSummary: outlook.stateSummary ?? "",
        stateScore: typeof outlook.stateScore === "number" ? outlook.stateScore : 60,
        bars: Array.isArray(outlook.bars) ? outlook.bars.slice(0, 4) : [],
        windows: Array.isArray(outlook.windows) ? outlook.windows.slice(0, 4) : [],
        dimensions: Array.isArray(outlook.dimensions) ? outlook.dimensions.slice(0, 4) : [],
      },
    };
  });
