import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "@tanstack/react-router";

import { useLang } from "@/lib/i18n";
import { curatorLetter } from "@/lib/life-guidance-v1";

/**
 * CuratorLetter — the immersive "Curator's opening letter" block on
 * the public landing page. Renders two teaser lines by default; the
 * full letter unfolds with a soft page-turn animation on click. No
 * data fetching, no client-only globals — safe under SSR.
 */
export function CuratorLetter() {
  const { lang } = useLang();
  const copy = curatorLetter[lang];
  const [open, setOpen] = useState(false);

  return (
    <section
      id="curator-letter"
      aria-label={copy.kicker}
      className="relative z-10 mx-auto max-w-4xl px-6 py-24 md:px-12"
    >
      <div className="relative overflow-hidden rounded-[2.25rem] border border-gold-dust/25 bg-gradient-to-br from-void-blue/70 via-obsidian/70 to-nebula-purple/25 p-8 shadow-[0_20px_80px_-40px_rgba(212,175,55,0.35)] backdrop-blur-sm md:p-14">
        {/* soft page grain */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background:radial-gradient(circle_at_20%_10%,rgba(212,175,55,0.25),transparent_45%),radial-gradient(circle_at_80%_90%,rgba(139,92,246,0.25),transparent_55%)]" />

        <p className="mb-4 text-[10px] uppercase tracking-[0.42em] text-gold-dust">
          {copy.kicker}
        </p>
        <h2 className="mb-6 font-serif text-3xl italic leading-tight text-stone-warm md:text-5xl">
          {copy.intro[0]}
        </h2>
        <p className="max-w-2xl font-serif text-lg leading-relaxed text-stone-warm/70 md:text-xl">
          {copy.intro[1]}
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="curator-letter-body"
            className="group inline-flex items-center gap-3 rounded-full border border-gold-dust/40 bg-obsidian/60 px-6 py-3 text-[11px] uppercase tracking-[0.3em] text-gold-dust transition-colors hover:border-gold-dust hover:bg-gold-dust/10"
          >
            <span>{open ? copy.closeCta : copy.openCta}</span>
            <span
              className={`inline-block transition-transform duration-500 ${open ? "rotate-90" : ""}`}
              aria-hidden
            >
              →
            </span>
          </button>
        </div>

        <AnimatePresence initial={false}>
          {open ? (
            <motion.div
              id="curator-letter-body"
              key="letter-body"
              initial={{ opacity: 0, height: 0, y: -8 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={{ opacity: 0, height: 0, y: -8 }}
              transition={{ duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
              className="overflow-hidden"
            >
              <div className="mt-10 space-y-5 border-t border-gold-dust/15 pt-8">
                {copy.paragraphs.map((p, i) => (
                  <motion.p
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.08 * i, ease: [0.32, 0.72, 0, 1] }}
                    className="font-serif text-base leading-relaxed text-stone-warm/85 md:text-lg"
                  >
                    {p}
                  </motion.p>
                ))}

                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Link
                    to="/ritual"
                    className="inline-flex rounded-full bg-gold-dust px-8 py-3 text-xs font-medium uppercase tracking-[0.32em] text-obsidian transition-colors hover:bg-gold-light"
                  >
                    {copy.ctaRitual}
                  </Link>
                  <a
                    href="#traditions"
                    className="text-[11px] uppercase tracking-[0.28em] text-stone-warm/60 transition-colors hover:text-gold-dust"
                  >
                    {copy.ctaPeers}
                  </a>
                </div>

                <p className="mt-8 text-[10px] uppercase tracking-[0.28em] text-stone-warm/40">
                  {copy.safety}
                </p>
                <p className="mt-2 text-right font-serif text-sm italic text-gold-dust/80">
                  — {copy.seal}
                </p>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </section>
  );
}
