import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/ritual")({
  head: () => ({
    meta: [
      { title: "The Ritual — Library of Destiny" },
      {
        name: "description",
        content:
          "The intake ritual for your unified reading. One question at a time — name, moment and place of your first breath.",
      },
    ],
  }),
  component: RitualPage,
});

type FieldKey = "name" | "date" | "time" | "place";

const steps: {
  key: FieldKey;
  index: string;
  prompt: string;
  hint: string;
  placeholder: string;
  input: "text" | "date" | "time";
}[] = [
  {
    key: "name",
    index: "01",
    prompt: "What name has been given to this life?",
    hint: "The name is the first inscription of identity.",
    placeholder: "Your birth name",
    input: "text",
  },
  {
    key: "date",
    index: "02",
    prompt: "On which day did the sky first receive you?",
    hint: "Your date of birth situates the stars.",
    placeholder: "",
    input: "date",
  },
  {
    key: "time",
    index: "03",
    prompt: "At what hour did the first breath arrive?",
    hint: "The hour tunes the four pillars.",
    placeholder: "",
    input: "time",
  },
  {
    key: "place",
    index: "04",
    prompt: "And where on the earth did it happen?",
    hint: "The place fixes the horizon of your chart.",
    placeholder: "City, region, country",
    input: "text",
  },
];

function RitualPage() {
  const navigate = useNavigate();
  const [values, setValues] = useState<Record<FieldKey, string>>({
    name: "",
    date: "",
    time: "",
    place: "",
  });
  const [step, setStep] = useState(0);

  const current = steps[step];
  const progress = useMemo(() => (step + 1) / steps.length, [step]);

  const canAdvance = values[current.key].trim().length > 0;
  const isLast = step === steps.length - 1;

  const advance = () => {
    if (!canAdvance) return;
    if (isLast) {
      const params = new URLSearchParams(values as Record<string, string>);
      navigate({ to: "/synthesis", search: () => Object.fromEntries(params) as never });
    } else {
      setStep((s) => s + 1);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-6 pt-32 pb-24">
      {/* Ceremonial ring reacting to progress */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div
          className="rounded-full border border-gold-dust/20 transition-all duration-1000"
          style={{
            width: `${520 + step * 80}px`,
            height: `${520 + step * 80}px`,
          }}
        />
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-nebula-purple/25 transition-all duration-1000"
          style={{
            width: `${340 + step * 60}px`,
            height: `${340 + step * 60}px`,
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-2xl text-center">
        {/* Progress */}
        <div className="mb-14 flex items-center justify-center gap-3">
          {steps.map((s, i) => (
            <div
              key={s.key}
              className={`h-px transition-all duration-700 ${
                i <= step ? "w-16 bg-gold-dust" : "w-10 bg-white/15"
              }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={current.key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
          >
            <p className="mb-6 text-[10px] uppercase tracking-[0.42em] text-gold-dust">
              Step {current.index} / 04
            </p>
            <h1 className="mx-auto mb-4 max-w-xl font-serif text-3xl italic leading-tight text-stone-warm md:text-5xl">
              {current.prompt}
            </h1>
            <p className="mb-14 text-sm text-stone-warm/50">{current.hint}</p>

            <input
              key={current.key}
              autoFocus
              type={current.input}
              inputMode={current.input === "text" ? "text" : undefined}
              placeholder={current.placeholder}
              className="ritual-input mx-auto max-w-md"
              value={values[current.key]}
              onChange={(e) =>
                setValues((v) => ({ ...v, [current.key]: e.target.value }))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") advance();
              }}
              style={{ colorScheme: "dark" }}
            />

            <div className="mt-14 flex items-center justify-center gap-4">
              {step > 0 && (
                <button
                  onClick={() => setStep((s) => s - 1)}
                  className="rounded-full border border-white/10 px-6 py-3 text-[10px] uppercase tracking-[0.32em] text-stone-warm/60 transition-colors hover:border-gold-dust/40 hover:text-gold-dust"
                >
                  ← Back
                </button>
              )}
              <button
                onClick={advance}
                disabled={!canAdvance}
                className="group relative overflow-hidden rounded-full border border-gold-dust/40 px-10 py-3 text-[10px] uppercase tracking-[0.32em] text-gold-dust transition-all hover:border-gold-dust disabled:cursor-not-allowed disabled:opacity-30"
              >
                <span className="relative z-10">
                  {isLast ? "Invoke synthesis" : "Continue"}
                </span>
                <span className="absolute inset-0 translate-y-full bg-gold-dust/10 transition-transform duration-500 group-hover:translate-y-0" />
              </button>
            </div>
          </motion.div>
        </AnimatePresence>

        <p className="mt-24 font-serif text-xs italic text-stone-warm/40">
          Progress · {Math.round(progress * 100)}%
        </p>
      </div>
    </div>
  );
}
