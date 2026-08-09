/**
 * Demo fixtures for /me/match. Deterministic pair of "characters" so the
 * screen renders realistic compatibility scores without any user data.
 */
import type { SideFacets } from "@/lib/compatibility-score";

export type MatchDemoSide = {
  userId: string;
  displayName: string;
  chartId: string;
  chartLabel: string;
  facets: SideFacets;
};

export type MatchDemoKey = "friend_pair" | "complementary_pair" | "clash_pair" | "partial_pair";

export const MATCH_DEMO: Record<MatchDemoKey, { label: string; a: MatchDemoSide; b: MatchDemoSide }> = {
  friend_pair: {
    label: "同频朋友",
    a: {
      userId: "demo-a-friend",
      displayName: "阿禾（DEMO）",
      chartId: "demo-chart-a1",
      chartLabel: "1992 · 春分 · 上海",
      facets: { yang: 0.2, pace: 0.55, openness: 0.7, rootedness: 0.6 },
    },
    b: {
      userId: "demo-b-friend",
      displayName: "小南（DEMO）",
      chartId: "demo-chart-b1",
      chartLabel: "1993 · 冬至 · 杭州",
      facets: { yang: 0.15, pace: 0.6, openness: 0.72, rootedness: 0.58 },
    },
  },
  complementary_pair: {
    label: "阴阳互补",
    a: {
      userId: "demo-a-comp",
      displayName: "北辰（DEMO）",
      chartId: "demo-chart-a2",
      chartLabel: "1988 · 立秋 · 成都",
      facets: { yang: 0.72, pace: 0.75, openness: 0.4, rootedness: 0.55 },
    },
    b: {
      userId: "demo-b-comp",
      displayName: "云溪（DEMO）",
      chartId: "demo-chart-b2",
      chartLabel: "1990 · 雨水 · 广州",
      facets: { yang: -0.48, pace: 0.45, openness: 0.7, rootedness: 0.75 },
    },
  },
  clash_pair: {
    label: "节奏错拍",
    a: {
      userId: "demo-a-clash",
      displayName: "沐白（DEMO）",
      chartId: "demo-chart-a3",
      chartLabel: "1985 · 大寒 · 沈阳",
      facets: { yang: 0.6, pace: 0.9, openness: 0.85, rootedness: 0.3 },
    },
    b: {
      userId: "demo-b-clash",
      displayName: "青梧（DEMO）",
      chartId: "demo-chart-b3",
      chartLabel: "1986 · 谷雨 · 昆明",
      facets: { yang: -0.55, pace: 0.15, openness: 0.25, rootedness: 0.4 },
    },
  },
  partial_pair: {
    label: "缺出生时间（示例）",
    a: {
      userId: "demo-a-partial",
      displayName: "岸行（DEMO）",
      chartId: "demo-chart-a4",
      chartLabel: "1995 · 无出生时间",
      facets: { yang: 0.3, pace: 0.5, openness: 0.6, rootedness: 0.55 },
    },
    b: {
      userId: "demo-b-partial",
      displayName: "拾光（DEMO）",
      chartId: "demo-chart-b4",
      chartLabel: "1994 · 无出生时间",
      // deliberately partial — only 2 of 4 facets
      facets: { pace: 0.6, openness: 0.7 } as SideFacets,
    },
  },
};
