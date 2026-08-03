/**
 * LanguageToggle wiring — non-DOM contract test.
 *
 * The desktop nav and mobile drawer both render `<LanguageToggle />`,
 * which lives in `src/components/LanguageToggle.tsx` (extracted from the
 * root route so its DOM behavior is testable in isolation). The
 * component MUST derive `lang` + `setLang` from the shared `useLang()`
 * context and MUST wire the EN and 中 buttons to that setter. The
 * runtime side effects of `setLang` — localStorage + `<html lang>` sync
 * and a real click event — are covered by
 * `src/lib/i18n-html-lang.test.tsx` and
 * `src/components/language-toggle.dom.test.tsx`.
 *
 * A source-level check is used because bun's shared React module
 * registry across test files makes act(...) / flushSync-driven
 * rendering flaky for this provider; the invariants under test here are
 * static (the button wiring), not state-machine behavior.
 */
// @ts-expect-error bun:test
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const toggleSource = readFileSync(
  resolve(process.cwd(), "src/components/LanguageToggle.tsx"),
  "utf8",
);
const rootSource = readFileSync(
  resolve(process.cwd(), "src/routes/__root.tsx"),
  "utf8",
);

describe("LanguageToggle wiring", () => {
  it("derives lang + setLang from the shared useLang() context", () => {
    const match = toggleSource.match(
      /export function LanguageToggle\(\)[\s\S]*?const \{[^}]*\} = useLang\(\);/,
    );
    expect(match).not.toBeNull();
    expect(match![0]).toContain("lang");
    expect(match![0]).toContain("setLang");
  });

  it("wires EN and 中 buttons to setLang for both languages", () => {
    expect(toggleSource).toMatch(/\["en",\s*"zh"\]\s+as\s+const/);
    expect(toggleSource).toMatch(/onClick=\{\(\)\s*=>\s*setLang\(l\)\}/);
    expect(toggleSource).toContain('"EN"');
    expect(toggleSource).toContain('"中"');
  });

  it("root route imports the shared LanguageToggle and renders it in both navs", () => {
    expect(rootSource).toMatch(
      /import\s*\{\s*LanguageToggle\s*\}\s*from\s*["']@\/components\/LanguageToggle["']/,
    );
    // No duplicate local declaration that could shadow the shared one.
    expect(rootSource).not.toMatch(/function LanguageToggle\(\)/);
    const usages = rootSource.match(/<LanguageToggle\s*\/>/g) ?? [];
    expect(usages.length).toBeGreaterThanOrEqual(2);
  });
});
