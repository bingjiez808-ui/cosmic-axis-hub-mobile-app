import { createFileRoute, Outlet } from "@tanstack/react-router";

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
  component: MathRoomLayout,
});

function MathRoomLayout() {
  return <Outlet />;
}
