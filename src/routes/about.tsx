import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — Library of Destiny" },
      {
        name: "description",
        content:
          "How the library reads four traditions at once, and how it treats fate — as pattern, not sentence.",
      },
      { property: "og:title", content: "About — Library of Destiny" },
      {
        property: "og:description",
        content: "Four civilizations, one question, and the ethics of reading a life.",
      },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 pt-32 pb-32">
      <p className="mb-4 text-[10px] uppercase tracking-[0.42em] text-gold-dust">The library</p>
      <h1 className="mb-10 font-serif text-5xl leading-[1.05] text-stone-warm md:text-6xl">
        A reading that <span className="italic gold-gradient-text">refuses to shout.</span>
      </h1>
      <div className="space-y-8 font-serif text-lg leading-relaxed text-stone-warm/80">
        <p>
          The Library of Destiny does not aim to tell your future. It aims to describe your
          pattern. It does that by reading you in four languages at once — the Hellenistic
          zodiac, the Vedic Nakshatras, the Chinese Four Pillars, and the Purple Star.
        </p>
        <p>
          Each of these traditions took centuries to develop. Each one is internally coherent.
          Where they agree, the library gives a strong reading. Where they disagree, the
          library says so — and asks you to hold the tension rather than resolve it
          prematurely.
        </p>
        <p className="italic text-stone-warm/70">
          Fate here is written in the language of “tends to”, “more likely”, and “worthy of
          attention.” Anything more definite would be a story pretending to be a certainty.
        </p>
      </div>

      <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
        {[
          {
            k: "Not prediction",
            v: "The library does not tell you what will happen. It tells you what patterns are already at work.",
          },
          {
            k: "Not absolute",
            v: "No conclusion is stated without a confidence rating and the traditions that support it.",
          },
          {
            k: "Not a substitute",
            v: "The reading is a companion to reflection — not a replacement for medical, legal or financial counsel.",
          },
        ].map((c) => (
          <div key={c.k} className="glass-card rounded-2xl p-6">
            <p className="mb-3 text-[10px] uppercase tracking-[0.32em] text-gold-dust">{c.k}</p>
            <p className="text-sm text-stone-warm/70">{c.v}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
