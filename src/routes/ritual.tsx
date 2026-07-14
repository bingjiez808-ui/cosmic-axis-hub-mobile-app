import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";

import { CityCombobox } from "@/components/CityCombobox";
import { useLang, type Lang } from "@/lib/i18n";

export const Route = createFileRoute("/ritual")({
  head: () => ({
    meta: [
      { title: "The Ritual — Library of Destiny" },
      {
        name: "description",
        content:
          "The intake ritual for your unified reading. Choose your language, then share the coordinates of your first breath.",
      },
    ],
  }),
  component: RitualPage,
});

type FieldKey = "name" | "date" | "time" | "place";

function RitualPage() {
  const navigate = useNavigate();
  const { lang, setLang, t } = useLang();

  const [values, setValues] = useState<Record<FieldKey, string>>({
    name: "",
    date: "",
    time: "",
    place: "",
  });
  const [step, setStep] = useState(0); // 0 = language, then 4 questions

  const totalSteps = 5;
  const questionSteps: {
    key: FieldKey;
    prompt: string;
    hint: string;
    placeholder: string;
    input: "text" | "date" | "time";
  }[] = [
    { key: "name", prompt: t.q_name, hint: t.q_name_hint, placeholder: t.q_name_ph, input: "text" },
    { key: "date", prompt: t.q_date, hint: t.q_date_hint, placeholder: "", input: "date" },
    { key: "time", prompt: t.q_time, hint: t.q_time_hint, placeholder: "", input: "time" },
    { key: "place", prompt: t.q_place, hint: t.q_place_hint, placeholder: t.q_place_ph, input: "text" },
  ];

  const progress = useMemo(() => (step + 1) / totalSteps, [step]);
  const isLast = step === totalSteps - 1;
  const isLanguageStep = step === 0;
  const currentQ = isLanguageStep ? null : questionSteps[step - 1];
  const canAdvance = isLanguageStep
    ? true
    : (values[currentQ!.key] ?? "").trim().length > 0;

  const advance = () => {
    if (!canAdvance) return;
    if (isLast) {
      const params = new URLSearchParams({ ...values, lang });
      navigate({ to: "/synthesis", search: () => Object.fromEntries(params) as never });
    } else {
      setStep((s) => s + 1);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-6 pt-32 pb-24">
      {/* Ceremonial rings */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div
          className="rounded-full border border-gold-dust/20 transition-all duration-1000"
          style={{ width: `${520 + step * 80}px`, height: `${520 + step * 80}px` }}
        />
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-nebula-purple/25 transition-all duration-1000"
          style={{ width: `${340 + step * 60}px`, height: `${340 + step * 60}px` }}
        />
      </div>

      <div className="relative z-10 w-full max-w-2xl text-center">
        {/* Progress */}
        <div className="mb-14 flex items-center justify-center gap-3">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-px transition-all duration-700 ${
                i <= step ? "w-16 bg-gold-dust" : "w-10 bg-white/15"
              }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
          >
            <p className="mb-6 text-[10px] uppercase tracking-[0.42em] text-gold-dust">
              {t.step_of(step + 1, totalSteps)}
            </p>

            {isLanguageStep ? (
              <>
                <h1 className="mx-auto mb-4 max-w-xl font-serif text-3xl italic leading-tight text-stone-warm md:text-5xl">
                  {t.ritual_pick_language}
                </h1>
                <p className="mb-14 text-sm text-stone-warm/50">
                  {t.ritual_pick_language_hint}
                </p>
                <div className="mx-auto flex max-w-md flex-col gap-4">
                  {(
                    [
                      { code: "en", label: "English", native: "The library will speak in English." },
                      { code: "zh", label: "中文", native: "图书馆将以中文与你对话。" },
                    ] as { code: Lang; label: string; native: string }[]
                  ).map((opt) => {
                    const active = lang === opt.code;
                    return (
                      <button
                        key={opt.code}
                        onClick={() => setLang(opt.code)}
                        className={`glass-card flex items-center justify-between rounded-2xl px-6 py-5 text-left transition-all ${
                          active
                            ? "border-gold-dust/60 bg-gold-dust/10"
                            : "hover:border-gold-dust/30"
                        }`}
                      >
                        <div>
                          <p className="font-serif text-xl text-stone-warm">{opt.label}</p>
                          <p className="mt-1 text-xs italic text-stone-warm/50">{opt.native}</p>
                        </div>
                        <span
                          className={`grid size-6 place-items-center rounded-full border transition-colors ${
                            active
                              ? "border-gold-dust bg-gold-dust text-obsidian"
                              : "border-white/20 text-transparent"
                          }`}
                        >
                          ✓
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <h1 className="mx-auto mb-4 max-w-xl font-serif text-3xl italic leading-tight text-stone-warm md:text-5xl">
                  {currentQ!.prompt}
                </h1>
                <p className="mb-14 text-sm text-stone-warm/50">{currentQ!.hint}</p>

                {currentQ!.key === "place" ? (
                  <CityCombobox
                    value={values.place}
                    onChange={(v) => setValues((s) => ({ ...s, place: v }))}
                    placeholder={currentQ!.placeholder}
                    onCommit={advance}
                  />
                ) : (
                  <input
                    key={currentQ!.key}
                    autoFocus
                    type={currentQ!.input}
                    placeholder={currentQ!.placeholder}
                    className="ritual-input mx-auto max-w-md"
                    min={currentQ!.input === "date" ? "1900-01-01" : undefined}
                    max={currentQ!.input === "date" ? "2099-12-31" : undefined}
                    value={values[currentQ!.key]}
                    onChange={(e) => {
                      let val = e.target.value;
                      if (currentQ!.input === "date") {
                        // Clamp year to 4 digits (native date input can accept 5+).
                        const m = val.match(/^(\d+)(-\d{2}-\d{2})?$/);
                        if (m && m[1].length > 4) val = m[1].slice(0, 4) + (m[2] || "");
                      }
                      setValues((v) => ({ ...v, [currentQ!.key]: val }));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") advance();
                    }}
                    style={{ colorScheme: "dark" }}
                  />
                )}
              </>
            )}

            <div className="mt-14 flex items-center justify-center gap-4">
              {step > 0 && (
                <button
                  onClick={() => setStep((s) => s - 1)}
                  className="rounded-full border border-white/10 px-6 py-3 text-[10px] uppercase tracking-[0.32em] text-stone-warm/60 transition-colors hover:border-gold-dust/40 hover:text-gold-dust"
                >
                  {t.back}
                </button>
              )}
              <button
                onClick={advance}
                disabled={!canAdvance}
                className="group relative overflow-hidden rounded-full border border-gold-dust/40 px-10 py-3 text-[10px] uppercase tracking-[0.32em] text-gold-dust transition-all hover:border-gold-dust disabled:cursor-not-allowed disabled:opacity-30"
              >
                <span className="relative z-10">
                  {isLast ? t.invoke : t.continue}
                </span>
                <span className="absolute inset-0 translate-y-full bg-gold-dust/10 transition-transform duration-500 group-hover:translate-y-0" />
              </button>
            </div>
          </motion.div>
        </AnimatePresence>

        <p className="mt-24 font-serif text-xs italic text-stone-warm/40">
          {t.progress} · {Math.round(progress * 100)}%
        </p>
      </div>
    </div>
  );
}
