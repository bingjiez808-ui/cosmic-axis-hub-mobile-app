import { createFileRoute } from "@tanstack/react-router";

import { MathRoomV2 as MathRoom } from "@/experiences/life-studies/math/v2/MathRoomV2";
import { SubjectRoomShell } from "@/experiences/life-studies/SubjectRoomShell";
import { usePrimaryChartForStudies } from "@/experiences/life-studies/usePrimaryChartForStudies";

export const Route = createFileRoute("/life-studies/math/year")({
  head: () => ({
    meta: [
      { title: "这一年雷达 · 数学馆" },
      { name: "description", content: "数学馆年份雷达：聚焦单一年份的多维状态。" },
    ],
  }),
  component: MathYearPage,
});

function MathYearPage() {
  const chart = usePrimaryChartForStudies("/life-studies/math/year");

  return (
    <SubjectRoomShell
      active="/life-studies/math/year"
      eyebrow={{ zh: "数学馆 · 年份", en: "Math · Year" }}
      title={{ zh: "这一年雷达", en: "This-year radar" }}
      subtitle={{ zh: "不看长线，只聚焦一个年份，快速比较各领域的强弱和提醒。", en: "Focus one year and compare the domain signals." }}
    >
      <MathRoom
        gate={chart.gate}
        primaryBirthISO={chart.primary?.birth_date ?? chart.detail?.birth_date ?? null}
        primaryName={chart.primary?.name ?? chart.detail?.name ?? null}
        primaryPlace={chart.primary?.birth_place ?? chart.detail?.birth_place ?? null}
        isSignedIn={chart.isSignedIn}
        loadingChart={chart.loading}
        view="year"
      />
    </SubjectRoomShell>
  );
}
