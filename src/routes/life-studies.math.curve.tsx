import { createFileRoute } from "@tanstack/react-router";

import { MathRoomV2 as MathRoom } from "@/experiences/life-studies/math/v2/MathRoomV2";
import { SubjectRoomShell } from "@/experiences/life-studies/SubjectRoomShell";
import { usePrimaryChartForStudies } from "@/experiences/life-studies/usePrimaryChartForStudies";

export const Route = createFileRoute("/life-studies/math/curve")({
  head: () => ({
    meta: [
      { title: "七维曲线 · 数学馆" },
      { name: "description", content: "数学馆七维曲线：查看人生领域随年龄变化的趋势。" },
    ],
  }),
  component: MathCurvePage,
});

function MathCurvePage() {
  const chart = usePrimaryChartForStudies("/life-studies/math/curve");

  return (
    <SubjectRoomShell
      active="/life-studies/math/curve"
      eyebrow={{ zh: "数学馆 · 七维曲线", en: "Math · Curve" }}
      title={{ zh: "七维曲线", en: "Seven-line curve" }}
      subtitle={{ zh: "只看主图：学业、事业、爱情、家庭、人际、财富和健康如何同步起伏。", en: "The main chart for seven life domains across time." }}
    >
      <MathRoom
        gate={chart.gate}
        primaryBirthISO={chart.primary?.birth_date ?? chart.detail?.birth_date ?? null}
        primaryName={chart.primary?.name ?? chart.detail?.name ?? null}
        primaryPlace={chart.primary?.birth_place ?? chart.detail?.birth_place ?? null}
        isSignedIn={chart.isSignedIn}
        loadingChart={chart.loading}
        view="curve"
      />
    </SubjectRoomShell>
  );
}
