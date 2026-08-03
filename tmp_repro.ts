import { buildCalculationSnapshot, missingSystems } from "@/lib/calc-snapshot";
import { buildPremiumFacts } from "@/lib/premium-facts";
const snap = buildCalculationSnapshot({ date: "2002-11-03", time: "09:26", place: "南京, 中国", lang: "zh", gender: "female" });
console.log("missing:", missingSystems(snap));
console.log("systems:", { bazi: !!snap.bazi, ziwei: !!snap.ziwei, vedic: !!snap.vedic, western: !!snap.western });
const facts = buildPremiumFacts(snap);
console.log("facts modules:", { bazi: !!facts.bazi, ziwei: !!facts.ziwei, vedic: !!facts.vedic, western: !!facts.western });
