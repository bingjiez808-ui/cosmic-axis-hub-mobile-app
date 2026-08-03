import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CITIES, formatCity, searchCities, type City } from "@/lib/cities";
import { useLang } from "@/lib/i18n";

type Props = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  onCommit?: () => void;
};

export function CityCombobox({ value, onChange, placeholder, onCommit }: Props) {
  const { lang } = useLang();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => setQuery(value), [value]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const matches: City[] = useMemo(() => searchCities(query, lang), [query, lang]);

  const pick = (c: City) => {
    const label = formatCity(c, lang);
    onChange(label);
    setQuery(label);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative mx-auto max-w-md">
      <input
        ref={inputRef}
        type="text"
        autoFocus
        className="ritual-input"
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setHighlight((h) => Math.min(h + 1, matches.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
          } else if (e.key === "Enter") {
            if (open && matches[highlight]) {
              e.preventDefault();
              pick(matches[highlight]);
            } else if (onCommit) {
              onCommit();
            }
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        style={{ colorScheme: "dark" }}
        autoComplete="off"
      />

      <AnimatePresence>
        {open && matches.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="glass-card absolute left-0 right-0 top-[calc(100%+10px)] z-30 max-h-72 overflow-auto rounded-2xl p-2 text-left"
          >
            {matches.map((c, i) => {
              const label = formatCity(c, lang);
              const active = i === highlight;
              return (
                <li key={c.en}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pick(c);
                    }}
                    onMouseEnter={() => setHighlight(i)}
                    className={`flex w-full items-center justify-between rounded-xl px-4 py-2.5 text-sm transition-colors ${
                      active
                        ? "bg-gold-dust/10 text-gold-light"
                        : "text-stone-warm/80 hover:bg-white/5"
                    }`}
                  >
                    <span className="font-serif">{lang === "zh" ? c.zh : c.en}</span>
                    <span className="text-[10px] uppercase tracking-[0.28em] text-stone-warm/40">
                      {lang === "zh" ? c.countryZh : c.country}
                    </span>
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>

      <p className="mt-4 text-[10px] uppercase tracking-[0.28em] text-stone-warm/30">
        {lang === "zh"
          ? `${CITIES.length}+ 座城市 · 支持中英文搜索`
          : `${CITIES.length}+ cities · search in English or 中文`}
      </p>
    </div>
  );
}
