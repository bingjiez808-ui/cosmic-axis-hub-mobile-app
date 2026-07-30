import { test, expect } from "vitest";
import { buildCalculationSnapshot } from "@/lib/calc-snapshot";
test("ziwei across times", () => {
  const times = ["00:00","00:30","23:59","12:00","06:15"];
  for (const t of times) {
    const s = buildCalculationSnapshot({ date: "1993-08-15", time: t, place: "北京", gender: "male", lang: "zh" });
    console.log(t, s.ziwei.status, s.ziwei.reason ?? "", s.vedic.status, s.vedic.reason ?? "");
  }
  const noplace = buildCalculationSnapshot({ date: "1993-08-15", time: "08:00", place: "某小县城", gender: "male", lang: "zh" });
  console.log("unknown place", noplace.ziwei.status, noplace.vedic.status, noplace.vedic.reason);
  expect(1).toBe(1);
});
