import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";

type SearchParams = {
  name?: string;
  date?: string;
  time?: string;
  place?: string;
};

export const Route = createFileRoute("/report")({
  head: () => ({
    meta: [
      { title: "Your reading — Library of Destiny" },
      {
        name: "description",
        content:
          "The unified AI reading of your life, synthesized across four ancient traditions.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): SearchParams => ({
    name: typeof s.name === "string" ? s.name : undefined,
    date: typeof s.date === "string" ? s.date : undefined,
    time: typeof s.time === "string" ? s.time : undefined,
    place: typeof s.place === "string" ? s.place : undefined,
  }),
  component: ReportPage,
});

/**
 * Sample composite report. Wired for later: swap this data for an AI-generated
 * synthesis (Lovable AI Gateway server function) that reads name/date/time/place
 * and produces the same shape.
 */
const summary =
  "Your life is written more as an explorer's than a follower's — a chart that repeatedly returns to the questions of vocation, meaning and the courage to choose again.";

const dimensions: {
  title: string;
  headline: string;
  stars: number;
  evidence: { tradition: string; note: string }[];
  synthesis: string;
}[] = [
  {
    title: "Character",
    headline: "A double-signed temperament — outward warmth, inward architect",
    stars: 5,
    evidence: [
      { tradition: "Astrology", note: "Sun in a fire sign · Mercury retrograde in the third house" },
      { tradition: "Jyotish", note: "Moon in Rohini · Jupiter aspecting the Lagna" },
      { tradition: "BaZi", note: "Yang Fire Day Master with strong Wood support" },
      { tradition: "Zi Wei", note: "紫微 in the palace of self with 化科" },
    ],
    synthesis:
      "Four systems converge on a personality that leads outwardly but revises inwardly. You are read as socially generous and privately exacting — a combination that produces influence, though it costs energy.",
  },
  {
    title: "Vocation",
    headline: "Built to lead, not to repeat",
    stars: 4,
    evidence: [
      { tradition: "Astrology", note: "Sun conjunct Midheaven in the tenth house" },
      { tradition: "Jyotish", note: "Jupiter tenanting the tenth Bhava" },
      { tradition: "BaZi", note: "Officer star (正官) prominent in the month pillar" },
      { tradition: "Zi Wei", note: "紫微天府 combination in the career palace" },
    ],
    synthesis:
      "All four traditions converge: leadership, autonomy or founding roles will outperform repetitive execution work. Management, entrepreneurship, research and teaching are indicated over the long horizon.",
  },
  {
    title: "Wealth",
    headline: "Built over cycles, not seasons",
    stars: 4,
    evidence: [
      { tradition: "Astrology", note: "Venus trine Jupiter · second-house ruler well-placed" },
      { tradition: "Jyotish", note: "Dhana yoga forming through second and eleventh lords" },
      { tradition: "BaZi", note: "Wealth star (正财) visible with element support" },
      { tradition: "Zi Wei", note: "武曲 aspecting the wealth palace" },
    ],
    synthesis:
      "The reading does not indicate sudden fortune. It indicates compounding — wealth built through decisions repeated over decades, especially around ages that align with your Great Luck pillars and your Jupiter returns.",
  },
  {
    title: "Love & marriage",
    headline: "Late clarity rewards early patience",
    stars: 3,
    evidence: [
      { tradition: "Astrology", note: "Venus square Saturn — mature love pattern" },
      { tradition: "Jyotish", note: "Seventh lord in a Kendra, aspected by Saturn" },
      { tradition: "BaZi", note: "Spouse palace strong in later Great Luck pillars" },
      { tradition: "Zi Wei", note: "天同 with 化禄 in marriage palace" },
    ],
    synthesis:
      "Three traditions concur that partnership deepens later rather than earlier. One tradition adds a warning against forcing timing. The reading suggests choosing depth over speed.",
  },
  {
    title: "Health & vitality",
    headline: "Fire tempered by water",
    stars: 4,
    evidence: [
      { tradition: "Astrology", note: "Ascendant ruler in a cadent house" },
      { tradition: "Jyotish", note: "Sixth house lord in a friendly sign" },
      { tradition: "BaZi", note: "Fire dominant — needs Water to balance" },
      { tradition: "Zi Wei", note: "疾厄宫 lightly afflicted, self-managed" },
    ],
    synthesis:
      "Vitality is generally strong; the shared concern is over-heating — mental over-drive, sleep debt, inflammation. Traditions agree on rhythm and rest as the durable antidote.",
  },
  {
    title: "Life mission",
    headline: "To translate — between worlds, between people",
    stars: 5,
    evidence: [
      { tradition: "Astrology", note: "North Node in the ninth house" },
      { tradition: "Jyotish", note: "Rahu in the ninth Bhava · dharma emphasis" },
      { tradition: "BaZi", note: "Output star (伤官/食神) strongly favoured" },
      { tradition: "Zi Wei", note: "迁移宫 activated · movement, exchange" },
    ],
    synthesis:
      "Four systems name the same shape: your life reads as a bridge. Translation, teaching, publishing, or building institutions that carry meaning across contexts are all consistent with the underlying pattern.",
  },
];

function Stars({ n }: { n: number }) {
  return (
    <span className="tracking-[0.3em] text-gold-dust">
      {"★".repeat(n)}
      <span className="text-stone-warm/20">{"★".repeat(5 - n)}</span>
    </span>
  );
}

function ReportPage() {
  const search = Route.useSearch();

  return (
    <div className="pt-32 pb-32">
      {/* Hero of the report */}
      <header className="mx-auto max-w-4xl px-6 pb-24 text-center">
        <p className="mb-4 text-[10px] uppercase tracking-[0.42em] text-gold-dust">
          The unified reading
        </p>
        <h1 className="mb-6 font-serif text-4xl leading-[1.1] text-stone-warm md:text-6xl">
          {search.name ? (
            <>
              <span className="italic gold-gradient-text">{search.name}</span>
              <br />
              read across four traditions
            </>
          ) : (
            <>Your life, read across four traditions</>
          )}
        </h1>
        <p className="mx-auto mt-6 max-w-3xl font-serif text-xl italic leading-relaxed text-stone-warm/80 md:text-2xl">
          “{summary}”
        </p>
        {(search.date || search.place) && (
          <p className="mt-8 text-[10px] uppercase tracking-[0.4em] text-stone-warm/40">
            {[search.date, search.time, search.place].filter(Boolean).join(" · ")}
          </p>
        )}
      </header>

      {/* Dimensions */}
      <section className="mx-auto max-w-5xl space-y-10 px-6 md:px-12">
        {dimensions.map((d, idx) => (
          <motion.article
            key={d.title}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.8, delay: idx * 0.05, ease: [0.32, 0.72, 0, 1] }}
            className="glass-card overflow-hidden rounded-3xl p-8 md:p-12"
          >
            <div className="mb-8 flex flex-wrap items-baseline justify-between gap-4 border-b border-white/10 pb-6">
              <div>
                <p className="mb-2 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
                  {String(idx + 1).padStart(2, "0")} · {d.title}
                </p>
                <h2 className="font-serif text-2xl italic text-stone-warm md:text-3xl">
                  {d.headline}
                </h2>
              </div>
              <Stars n={d.stars} />
            </div>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
              <div className="lg:col-span-2">
                <p className="mb-4 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
                  Evidence across traditions
                </p>
                <ul className="space-y-3 text-sm">
                  {d.evidence.map((e) => (
                    <li key={e.tradition} className="border-l border-gold-dust/30 pl-4">
                      <p className="font-serif text-gold-light">{e.tradition}</p>
                      <p className="text-stone-warm/60">{e.note}</p>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="lg:col-span-3">
                <p className="mb-4 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
                  Synthesis
                </p>
                <p className="text-base leading-relaxed text-stone-warm/80">{d.synthesis}</p>
              </div>
            </div>
          </motion.article>
        ))}
      </section>

      {/* CTA */}
      <div className="mx-auto mt-32 max-w-3xl px-6 text-center">
        <p className="mb-6 text-[10px] uppercase tracking-[0.42em] text-gold-dust">
          A note on reading fate
        </p>
        <p className="mb-12 font-serif text-2xl italic leading-relaxed text-stone-warm/70">
          These are tendencies, not sentences. The library reads the pattern —{" "}
          <span className="text-gold-light">the choices remain yours.</span>
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            to="/ritual"
            className="rounded-full border border-gold-dust/40 px-8 py-3 text-[10px] uppercase tracking-[0.32em] text-gold-dust transition-colors hover:bg-gold-dust/10"
          >
            Read another chart
          </Link>
          <Link
            to="/traditions"
            className="rounded-full border border-white/10 px-8 py-3 text-[10px] uppercase tracking-[0.32em] text-stone-warm/60 transition-colors hover:border-gold-dust/40 hover:text-gold-dust"
          >
            Return to the archive
          </Link>
        </div>
      </div>
    </div>
  );
}
