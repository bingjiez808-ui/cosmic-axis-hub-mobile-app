import { createFileRoute } from "@tanstack/react-router";

import { MathRoomV2 as MathRoom } from "@/experiences/life-studies/math/v2/MathRoomV2";
import { SubjectRoomShell } from "@/experiences/life-studies/SubjectRoomShell";
import { usePrimaryChartForStudies } from "@/experiences/life-studies/usePrimaryChartForStudies";

export const Route = createFileRoute("/life-studies/math/notes")({
  head: () => ({
    meta: [
      { title: "波动与书签 · 数学馆" },
      { name: "description", content: "数学馆波动与书签：查看关键年份和不同阅读角度。" },
    ],
  }),
  component: MathNotesPage,
});

function MathNotesPage() {
  const chart = usePrimaryChartForStudies("/life-studies/math/notes");

  return (
    <SubjectRoomShell
      active="/life-studies/math/notes"
      eyebrow={{ zh: "数学馆 · 整理", en: "Math · Notes" }}
      title={{ zh: "波动与书签", en: "Notes and bookmarks" }}
      subtitle={{ zh: "查看关键波动年份，也可以切换不同阅读角度理解同一张曲线。", en: "Review key ages and switch reading lenses." }}
    >
      <MathRoom
        gate={chart.gate}
        primaryBirthISO={chart.primary?.birth_date ?? chart.detail?.birth_date ?? null}
        primaryName={chart.primary?.name ?? chart.detail?.name ?? null}
        primaryPlace={chart.primary?.birth_place ?? chart.detail?.birth_place ?? null}
        isSignedIn={chart.isSignedIn}
        loadingChart={chart.loading}
        view="notes"
      />
    </SubjectRoomShell>
  );
}
