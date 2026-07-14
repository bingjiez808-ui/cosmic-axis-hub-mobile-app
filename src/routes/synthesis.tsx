import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

import treeImg from "@/assets/tree-of-destiny.jpg";

type SearchParams = {
  name?: string;
  date?: string;
  time?: string;
  place?: string;
  lang?: "en" | "zh";
  quiz?: string;
};

export const Route = createFileRoute("/synthesis")({
  head: () => ({
    meta: [
      { title: "Synthesis in progress — Library of Destiny" },
      {
        name: "description",
        content:
          "The AI is weaving four traditions into a single reading of your life.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): SearchParams => ({
    name: typeof s.name === "string" ? s.name : undefined,
    date: typeof s.date === "string" ? s.date : undefined,
    time: typeof s.time === "string" ? s.time : undefined,
    place: typeof s.place === "string" ? s.place : undefined,
    lang: s.lang === "zh" ? "zh" : s.lang === "en" ? "en" : undefined,
    quiz: typeof s.quiz === "string" ? s.quiz : undefined,
  }),
  component: SynthesisPage,
});

const phases = [
  { label: "Casting the Western wheel", detail: "Sun · Moon · Ascendant · Ten planets" },
  { label: "Drawing the Nakshatra mandala", detail: "27 lunar mansions · Dasha timing" },
  { label: "Assembling the four pillars", detail: "Ten stems · Twelve branches · Five elements" },
  { label: "Populating the twelve palaces", detail: "Fourteen major stars · Four transformations" },
  { label: "Cross-tradition pattern search", detail: "Clustering agreements · Marking conflicts" },
  { label: "Composing the unified reading", detail: "One life, four languages" },
];

function SynthesisPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const total = phases.length;
    const perPhase = 1800;
    const interval = setInterval(() => {
      setPhase((p) => {
        if (p >= total - 1) {
          clearInterval(interval);
          setTimeout(() => {
            navigate({
              to: "/report",
              search: () => search as never,
            });
          }, 1400);
          return p;
        }
        return p + 1;
      });
    }, perPhase);
    return () => clearInterval(interval);
  }, [navigate, search]);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pt-32 pb-24 text-center">
      {/* Rotating rings */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="h-[720px] w-[720px] rounded-full border border-white/5 animate-slow-rotate" />
        <div className="absolute left-1/2 top-1/2 h-[540px] w-[540px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-gold-dust/15 animate-slow-rotate-reverse" />
        <div className="absolute left-1/2 top-1/2 h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-nebula-purple/25 animate-slow-rotate" />
      </div>

      {/* Tree */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 2, ease: [0.32, 0.72, 0, 1] }}
        className="relative z-10 mb-12"
      >
        <div className="relative size-72 md:size-96">
          <div className="absolute inset-0 rounded-full bg-gold-dust/10 blur-3xl animate-pulse-gold" />
          <img
            src={treeImg}
            alt=""
            width={1280}
            height={1280}
            className="relative size-full rounded-full object-cover opacity-80"
          />
        </div>
      </motion.div>

      <div className="relative z-10 max-w-xl">
        <p className="mb-4 text-[10px] uppercase tracking-[0.42em] text-gold-dust">
          {search.name ? `Reading of ${search.name}` : "The reading"}
        </p>
        <h1 className="mb-14 font-serif text-3xl italic leading-tight text-stone-warm md:text-4xl">
          The library is speaking to itself…
        </h1>

        <div className="mb-10 h-16">
          <AnimatePresence mode="wait">
            <motion.div
              key={phase}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.6 }}
            >
              <p className="mb-1 font-serif text-lg text-gold-light">
                {phases[phase].label}
              </p>
              <p className="text-xs uppercase tracking-[0.32em] text-stone-warm/40">
                {phases[phase].detail}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Progress bar */}
        <div className="mx-auto h-px w-64 overflow-hidden bg-white/10">
          <motion.div
            className="h-full bg-gold-dust"
            initial={{ width: 0 }}
            animate={{ width: `${((phase + 1) / phases.length) * 100}%` }}
            transition={{ duration: 1.2, ease: [0.32, 0.72, 0, 1] }}
          />
        </div>
        <p className="mt-4 text-[10px] uppercase tracking-[0.32em] text-stone-warm/40">
          {phase + 1} / {phases.length} passages
        </p>
      </div>
    </div>
  );
}
