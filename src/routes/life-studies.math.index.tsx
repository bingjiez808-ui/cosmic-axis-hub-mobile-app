import { createFileRoute } from "@tanstack/react-router";

import { MathRoomV2 as MathRoom } from "@/experiences/life-studies/math/v2/MathRoomV2";
import { SubjectRoomShell } from "@/experiences/life-studies/SubjectRoomShell";
import { usePrimaryChartForStudies } from "@/experiences/life-studies/usePrimaryChartForStudies";

export const Route = createFileRoute("/life-studies/math/")({
  component: MathRoomIndexPage,
});

function MathRoomIndexPage() {
  const chart = usePrimaryChartForStudies("/life-studies/math");

  return (
    <SubjectRoomShell
      active="/life-studies/math"
      eyebrow={{ zh: "数学馆", en: "Mathematics" }}
      title={{ zh: "人生函数 · Life as a Function", en: "Life as a Function" }}
      subtitle={{
        zh: "把人生解释成一条可以调节的曲线，而不是一次判决。",
        en: "Read your life as a curve you can tune, not a verdict.",
      }}
    >
      <MathRoom
        gate={chart.gate}
        primaryBirthISO={chart.primary?.birth_date ?? chart.detail?.birth_date ?? null}
        primaryName={chart.primary?.name ?? chart.detail?.name ?? null}
        primaryPlace={chart.primary?.birth_place ?? chart.detail?.birth_place ?? null}
        isSignedIn={chart.isSignedIn}
        loadingChart={chart.loading}
      />
    </SubjectRoomShell>
  );
}
