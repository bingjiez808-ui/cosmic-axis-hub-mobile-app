import { createFileRoute } from "@tanstack/react-router";

import { MathRoomV2 as MathRoom } from "@/experiences/life-studies/math/v2/MathRoomV2";
import { SubjectRoomShell } from "@/experiences/life-studies/SubjectRoomShell";
import { usePrimaryChartForStudies } from "@/experiences/life-studies/usePrimaryChartForStudies";

export const Route = createFileRoute("/life-studies/math/lab")({
  head: () => ({
    meta: [
      { title: "变量实验室 · 数学馆" },
      { name: "description", content: "数学馆变量实验室：调整一个选择变量，观察趋势变化。" },
    ],
  }),
  component: MathLabPage,
});

function MathLabPage() {
  const chart = usePrimaryChartForStudies("/life-studies/math/lab");

  return (
    <SubjectRoomShell
      active="/life-studies/math/lab"
      eyebrow={{ zh: "数学馆 · 实验", en: "Math · Lab" }}
      title={{ zh: "变量实验室", en: "Variable lab" }}
      subtitle={{ zh: "选择一个行动变量，观察曲线如何变化，把抽象建议变成可比较的方案。", en: "Change one action variable and compare the curve." }}
    >
      <MathRoom
        gate={chart.gate}
        primaryBirthISO={chart.primary?.birth_date ?? chart.detail?.birth_date ?? null}
        primaryName={chart.primary?.name ?? chart.detail?.name ?? null}
        primaryPlace={chart.primary?.birth_place ?? chart.detail?.birth_place ?? null}
        isSignedIn={chart.isSignedIn}
        loadingChart={chart.loading}
        view="lab"
      />
    </SubjectRoomShell>
  );
}
