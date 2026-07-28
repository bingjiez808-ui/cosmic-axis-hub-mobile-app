import { createFileRoute } from "@tanstack/react-router";

import { GenerationMethod } from "@/experiences/life-studies/GenerationMethod";
import { SubjectRoomCard } from "@/experiences/life-studies/SubjectRoomCard";
import { SubjectRoomShell } from "@/experiences/life-studies/SubjectRoomShell";
import { SUBJECT_ROOMS } from "@/experiences/life-studies/subjects";
import { useLang } from "@/lib/i18n";
import { useSupabaseSession } from "@/lib/session";

export const Route = createFileRoute("/life-studies/")({
  head: () => ({
    meta: [
      { title: "命运通识馆 · Life Studies — Library of Destiny" },
      {
        name: "description",
        content:
          "同一本人生，五种读法：数学、哲思、物理、经济、地理。把命盘事实翻译成通俗可视化语言，非科学证明，非决定论。",
      },
      { property: "og:title", content: "命运通识馆 · Life Studies" },
      {
        property: "og:description",
        content: "One life, five readings: math, philosophy, physics, economics, geography.",
      },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LifeStudiesHome,
});

function LifeStudiesHome() {
  const { lang } = useLang();
  const isZh = lang === "zh";
  const { session } = useSupabaseSession();
  const signedIn = !!session;
  const openRoom = SUBJECT_ROOMS.find((r) => r.status === "open");

  return (
    <SubjectRoomShell
      eyebrow={{ zh: "命运通识馆", en: "Life Studies" }}
      title={{ zh: "同一本人生，五种读法", en: "One life, five readings" }}
      subtitle={{
        zh: "把专业命理事实翻译成数学、哲思诗章、物理、经济、地理五种通俗可视化语言。不是科学证明，也不是决定论——是五种可以自己读的角度。",
        en: "Translate professional chart facts into five everyday-knowledge languages — math, philosophy, physics, economics, geography. Not scientific proof, not determinism — five angles you can read for yourself.",
      }}
    >
      {openRoom && (
        <section
          data-testid="life-studies-featured"
          className="mb-8 rounded-2xl border border-amber-300/40 bg-gradient-to-br from-amber-300/10 to-transparent p-5 md:p-6"
        >
          <div className="text-[11px] uppercase tracking-[0.28em] text-amber-200/70">
            {isZh ? "本次推荐 · 产品导览" : "Featured · product guide"}
          </div>
          <h2 className="mt-1 font-serif text-2xl leading-tight text-amber-50">
            {isZh ? openRoom.title.zh : openRoom.title.en}
          </h2>
          <p className="mt-2 text-sm text-amber-100/75">
            {isZh
              ? "此推荐来自产品导览而非命盘分析——即使你还没有主命盘，也可以立即体验。"
              : "This recommendation comes from the product guide, not from analyzing your chart — you can try it right now without a primary chart."}
          </p>
        </section>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {SUBJECT_ROOMS.map((room) => (
          <SubjectRoomCard key={room.id} meta={room} signedIn={signedIn} />
        ))}
      </div>

      <GenerationMethod />
    </SubjectRoomShell>
  );
}
