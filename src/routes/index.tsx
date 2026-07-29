import { createFileRoute } from "@tanstack/react-router";

import { LibraryEntrance } from "@/components/entrance/LibraryEntrance";
import { HomeScrollStack } from "@/components/home-v2/HomeScrollStack";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "命运图书馆 · 导览室 · Destiny Library" },
      {
        name: "description",
        content:
          "推开图书馆的大门，跟随七块导览牌，从今天的问题走到两间阅览室——四大体系为你交叉阅读同一份人生资料。",
      },
      { property: "og:title", content: "命运图书馆 · 导览室" },
      {
        property: "og:description",
        content:
          "推开图书馆的大门，跟随七块导览牌，从今天的问题走到两间阅览室。",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <>
      <LibraryEntrance />
      <HomeScrollStack />
    </>
  );
}
