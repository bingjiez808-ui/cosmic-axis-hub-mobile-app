/**
 * LanguageToggle — the EN / 中 pill button pair shared by the desktop
 * navigation and the mobile drawer in `src/routes/__root.tsx`. Extracted
 * so its click behavior can be exercised in a DOM interaction test
 * (`src/components/language-toggle.dom.test.tsx`) without loading the
 * entire root route module.
 *
 * The component's whole job: read `lang` from `useLang()` and, on click,
 * call `setLang(nextLang)`. That setter performs three synchronous
 * write-throughs — React state, `localStorage["lod.lang"]`, and
 * `document.documentElement.lang` (via `syncDocumentLang`) — so every
 * consumer of `useLang` on the current page rerenders in the new
 * language on the same tick.
 */
import { useLang } from "../lib/i18n";

export function LanguageToggle() {
  const { lang, setLang } = useLang();
  return (
    <div className="flex items-center gap-1 rounded-full border border-white/10 p-0.5">
      {(["en", "zh"] as const).map((l) => (
        <button
          key={l}
          type="button"
          data-lang-button={l}
          onClick={() => setLang(l)}
          className={`rounded-full px-2.5 py-1 text-[10px] tracking-[0.28em] transition-colors ${
            lang === l
              ? "bg-gold-dust/15 text-gold-light"
              : "text-stone-warm/50 hover:text-gold-dust"
          }`}
        >
          {l === "en" ? "EN" : "中"}
        </button>
      ))}
    </div>
  );
}
