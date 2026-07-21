/**
 * LanguageToggle wiring — non-DOM contract test.
 *
 * The desktop nav and mobile drawer both render `<LanguageToggle />` from
 * `src/routes/__root.tsx`. That component MUST derive `lang` + `setLang`
 * from the shared `useLang()` context (so `setLang` writes to the same
 * React state, localStorage, and `document.documentElement.lang`), and
 * MUST wire the EN and 中 buttons to that setter. This test guards the
 * source-level contract; the runtime behavior of `setLang` itself —
 * localStorage + `<html lang>` sync — is covered by
 * `src/lib/i18n-html-lang.test.tsx`.
 *
 * A source-level check is used because bun's shared React module registry
 * across test files makes act(...) / flushSync-driven rendering flaky for
 * this specific provider; the invariants under test here are static (the
 * button wiring), not state-machine behavior.
 */
// @ts-expect-error bun:test
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const rootSource = readFileSync(
  resolve(process.cwd(), "src/routes/__root.tsx"),
  "utf8",
);

describe("LanguageToggle wiring", () => {
  it("derives lang + setLang from the shared useLang() context", () => {
    const match = rootSource.match(
      /function LanguageToggle\(\)[\s\S]*?const \{[^}]*\} = useLang\(\);/,
    );
    expect(match).not.toBeNull();
    expect(match![0]).toContain("lang");
    expect(match![0]).toContain("setLang");
  });

  it("wires EN and 中 buttons to setLang for both languages", () => {
    const toggleBlock = rootSource
      .split("function LanguageToggle()")[1]
      ?.split(/\nfunction /)[0] ?? "";
    // Iterates ["en", "zh"] and calls setLang(l) inside onClick.
    expect(toggleBlock).toMatch(/\["en",\s*"zh"\]\s+as\s+const/);
    expect(toggleBlock).toMatch(/onClick=\{\(\)\s*=>\s*setLang\(l\)\}/);
    // The visible label alternates EN / 中, so both languages are reachable.
    expect(toggleBlock).toContain('"EN"');
    expect(toggleBlock).toContain('"中"');
  });

  it("only defines one LanguageToggle so desktop + drawer share it", () => {
    const occurrences = rootSource.match(/function LanguageToggle\(\)/g) ?? [];
    expect(occurrences.length).toBe(1);
    // And both the desktop nav and the mobile drawer actually render it.
    const usages = rootSource.match(/<LanguageToggle\s*\/>/g) ?? [];
    expect(usages.length).toBeGreaterThanOrEqual(2);
  });
});
