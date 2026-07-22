// @ts-expect-error bun:test
import { describe, expect, it } from "bun:test";

import { DAILY_DICTS } from "@/lib/i18n-daily";
import {
  formatDailySignal,
  formatThemeKeyword,
  formatContradiction,
  parseDailySignal,
  tPhase,
  tPlanet,
  tAspect,
  tDomain,
  tSign,
} from "@/lib/daily-format";

const zh = DAILY_DICTS.zh;
const en = DAILY_DICTS.en;

const FORBIDDEN_EN_IN_ZH = [
  "study",
  "career",
  "love",
  "wealth",
  "sun",
  "moon",
  "mercury",
  "venus",
  "mars",
  "jupiter",
  "saturn",
  "trine",
  "square",
  "opposition",
  "conjunction",
  "sextile",
];

function assertNoEnglishLeak(s: string) {
  const low = s.toLowerCase();
  for (const bad of FORBIDDEN_EN_IN_ZH) {
    expect({ found: bad, in: s }.found in {} || !low.includes(bad), s).toBe(true);
  }
  // no snake_case
  expect(/[a-z]+_[a-z]+/.test(s), `snake_case leaked in "${s}"`).toBe(false);
}

describe("daily-format — parseDailySignal", () => {
  it("parses domain:planet→planet aspect", () => {
    expect(parseDailySignal("study:sun→mercury trine")).toEqual({
      kind: "domain_aspect",
      domain: "study",
      transit: "sun",
      natal: "mercury",
      aspect: "trine",
    });
  });
  it("parses planet→planet aspect (no domain)", () => {
    expect(parseDailySignal("venus→moon opposition")).toEqual({
      kind: "aspect",
      transit: "venus",
      natal: "moon",
      aspect: "opposition",
    });
  });
  it("normalizes ASCII arrows", () => {
    expect(parseDailySignal("career:mars->sun square").kind).toBe("domain_aspect");
  });
  it("returns raw when unknown", () => {
    expect(parseDailySignal("something arbitrary").kind).toBe("raw");
  });
});

describe("daily-format — formatDailySignal (zh)", () => {
  const cases: [string, string[]][] = [
    ["study:sun→mercury trine", ["学业与认知", "太阳", "水星", "三分"]],
    ["study:mercury→sun trine", ["学业与认知", "水星", "太阳", "三分"]],
    ["career:mars→mars trine", ["事业与方向", "火星", "三分"]],
    ["career:mars→sun square", ["事业与方向", "火星", "太阳", "四分"]],
    ["love:venus→sun opposition", ["关系与情感", "金星", "太阳", "对分"]],
    ["love:venus→moon opposition", ["关系与情感", "金星", "月亮", "对分"]],
    ["wealth:jupiter→venus conjunction", ["财富与资源", "木星", "金星", "合相"]],
    ["wealth:saturn→mars sextile", ["财富与资源", "土星", "火星", "六分"]],
  ];
  for (const [raw, needles] of cases) {
    it(`renders naturally: ${raw}`, () => {
      const out = formatDailySignal(raw, zh, "zh");
      for (const n of needles) expect(out.includes(n), `${out} lacks ${n}`).toBe(true);
      assertNoEnglishLeak(out);
    });
  }
});

describe("daily-format — formatDailySignal (en)", () => {
  it("emits an English sentence", () => {
    const out = formatDailySignal("study:sun→mercury trine", en, "en");
    expect(out.toLowerCase().includes("study")).toBe(true);
    expect(out.includes("Sun")).toBe(true);
    expect(out.includes("Mercury")).toBe(true);
    expect(out.includes("Trine")).toBe(true);
  });
});

describe("daily-format — enum translators", () => {
  it("translates all v2 domains in zh (5 non-overall + legacy wealth alias)", () => {
    for (const k of ["study", "career", "love", "body_mind", "finance", "wealth"]) {
      const v = tDomain(zh, k);
      expect(v.length).toBeGreaterThan(0);
      assertNoEnglishLeak(v);
    }
  });
  it("translates every planet in zh", () => {
    for (const p of Object.keys(zh.planet)) {
      const v = tPlanet(zh, p);
      expect(v.length).toBeGreaterThan(0);
      assertNoEnglishLeak(v);
    }
  });
  it("translates every aspect in zh", () => {
    for (const a of Object.keys(zh.aspect)) {
      const v = tAspect(zh, a);
      expect(v.length).toBeGreaterThan(0);
      assertNoEnglishLeak(v);
    }
  });
  it("translates all 12 signs in zh", () => {
    const signs = [
      "aries",
      "taurus",
      "gemini",
      "cancer",
      "leo",
      "virgo",
      "libra",
      "scorpio",
      "sagittarius",
      "capricorn",
      "aquarius",
      "pisces",
    ];
    for (const s of signs) {
      const v = tSign(zh, s);
      expect(v.length).toBeGreaterThan(0);
      assertNoEnglishLeak(v);
    }
  });
  it("translates the 8 moon phases and accepts new_moon/full_moon aliases", () => {
    for (const p of [
      "new_moon",
      "waxing_crescent",
      "first_quarter",
      "waxing_gibbous",
      "full_moon",
      "waning_gibbous",
      "last_quarter",
      "waning_crescent",
    ]) {
      const v = tPhase(zh, p);
      expect(v.length).toBeGreaterThan(0);
      assertNoEnglishLeak(v);
    }
  });
  it("humanizes unknown tokens rather than leaking snake_case", () => {
    expect(tPlanet(zh, "sedna")).toBe("Sedna");
  });
});

describe("daily-format — theme + contradiction", () => {
  it("formats moon-phase theme keyword", () => {
    const out = formatThemeKeyword("new_moon:起始", zh, "zh");
    expect(out.includes("新月")).toBe(true);
    expect(out.includes("起始")).toBe(true);
  });
  it("formats retrograde theme keyword", () => {
    const out = formatThemeKeyword("retrograde:mercury,venus", zh, "zh");
    expect(out.includes("逆行")).toBe(true);
    expect(out.includes("水星")).toBe(true);
    expect(out.includes("金星")).toBe(true);
    assertNoEnglishLeak(out);
  });
  it("localizes contradiction", () => {
    const raw = "study(70) 与 wealth(35) 分数差 ≥ 20，请以现实情境为准。";
    const zhOut = formatContradiction(raw, zh, "zh");
    expect(zhOut.includes("学业与认知")).toBe(true);
    expect(zhOut.includes("财富与资源")).toBe(true);
    assertNoEnglishLeak(zhOut);
    const enOut = formatContradiction(raw, en, "en");
    expect(enOut.toLowerCase().includes("study")).toBe(true);
  });
});
