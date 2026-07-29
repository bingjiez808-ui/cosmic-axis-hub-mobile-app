import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { MathRoomV2 as MathRoom } from "@/experiences/life-studies/math/v2/MathRoomV2";
import { SubjectRoomShell } from "@/experiences/life-studies/SubjectRoomShell";
import type { GateState } from "@/experiences/life-studies/MainChartGate";
import { listUserCharts } from "@/lib/reports-store.functions";
import { useSupabaseSession } from "@/lib/session";

export const Route = createFileRoute("/life-studies/math")({
  head: () => ({
    meta: [
      { title: "数学馆 · 人生函数 — 命运通识馆" },
      {
        name: "description",
        content:
          "把人生解释成 Y(t) = B + C(t) + Σ wᵢ·Xᵢ + ε 的可交互函数：基线、周期、选择与噪声。解释与自我反思模型，不是科学预测。",
      },
      { property: "og:title", content: "Mathematics · Life as a Function" },
      {
        property: "og:description",
        content: "Read your life as a tunable function: baseline, cycles, choices and noise.",
      },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MathRoomPage,
});

function MathRoomPage() {
  const { session } = useSupabaseSession();
  const fetchCharts = useServerFn(listUserCharts);
  const isSignedIn = !!session;
  const chartsQuery = useQuery({
    queryKey: ["life-studies", "charts", session?.user?.id ?? "anon"],
    queryFn: () => fetchCharts(),
    enabled: isSignedIn,
    staleTime: 60_000,
  });

  const primary = chartsQuery.data?.find((c) => c.is_primary) ?? null;
  const gate: GateState = !isSignedIn
    ? { kind: "signed-out", returnTo: "/life-studies/math" }
    : primary
      ? { kind: "ready", chartName: primary.name ?? null }
      : { kind: "no-primary" };

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
        gate={gate}
        primaryBirthISO={primary?.birth_date ?? null}
        primaryName={primary?.name ?? null}
        isSignedIn={isSignedIn}
      />
    </SubjectRoomShell>
  );
}
