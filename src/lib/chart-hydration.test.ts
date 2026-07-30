import { describe, expect, test } from "vitest";
import { isChartInputComplete, missingChartInputFields } from "@/lib/chart-hydration";
import { buildReportFingerprint } from "@/lib/report-input";

describe("chart hydration", () => {
  test("gender is required for a complete four-system input", () => {
    const base = { date: "1993-08-15", time: "08:00", place: "北京" };
    expect(isChartInputComplete(base)).toBe(false);
    expect(missingChartInputFields(base)).toEqual(["gender"]);
    expect(isChartInputComplete({ ...base, gender: "male" as const })).toBe(true);
  });
  test("fingerprint separates genders so a ziwei-less cache is not reused", () => {
    const base = { date: "1993-08-15", time: "08:00", place: "北京" };
    expect(buildReportFingerprint(base, "zh")).not.toBe(
      buildReportFingerprint({ ...base, gender: "male" }, "zh"),
    );
  });
});
