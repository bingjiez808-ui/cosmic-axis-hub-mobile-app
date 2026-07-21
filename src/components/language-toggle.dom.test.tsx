/**
 * LanguageToggle — real DOM interaction test.
 *
 * Renders the actual `<LanguageToggle />` inside `<LanguageProvider>` and
 * dispatches a real `click` event on the EN and 中 buttons. Verifies that
 * every click triggers the synchronous write-throughs the toggle relies
 * on for /me/home, /me/friends, /me/match to switch immediately:
 *   1. `localStorage["lod.lang"]` — so refresh persists the choice.
 *   2. `document.documentElement.lang` — so `<html lang>` and `:lang()`
 *      selectors follow the UI.
 *
 * The React commit (re-render of the pressed pill's active-state class)
 * depends on the shared act-environment flag across bun test files, which
 * makes it flaky to assert in this suite; the source-level wiring test in
 * `src/lib/language-toggle.test.tsx` covers that the two pills are
 * derived from `lang` on every render. Together the two tests cover both
 * halves of the toggle contract.
 */
// @ts-expect-error bun:test
import { describe, expect, it, beforeEach } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

// A prior test file may have registered happy-dom against a document
// object that React's root then attached its delegated event listeners
// to. Re-registering here gives us a fresh document + window pair so
// `button.click()` reaches the onClick handler React just wired up.
try {
  if (GlobalRegistrator.isRegistered) {
    GlobalRegistrator.unregister();
  }
} catch {}
GlobalRegistrator.register({ url: "http://localhost/", width: 1024, height: 768 });

import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";

import { LanguageProvider } from "@/lib/i18n";
import { LanguageToggle } from "@/components/LanguageToggle";

describe("LanguageToggle · DOM click updates <html lang> + localStorage", () => {
  beforeEach(() => {
    document.documentElement.setAttribute("lang", "en");
    try {
      localStorage.removeItem("lod.lang");
    } catch {}
  });

  it("clicking 中 then EN then 中 flips <html lang> and persists the choice", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);

    flushSync(() => {
      root.render(
        <LanguageProvider>
          <LanguageToggle />
        </LanguageProvider>,
      );
    });

    const enBtn = host.querySelector<HTMLButtonElement>('[data-lang-button="en"]');
    const zhBtn = host.querySelector<HTMLButtonElement>('[data-lang-button="zh"]');
    expect(enBtn).not.toBeNull();
    expect(zhBtn).not.toBeNull();

    // Baseline: SSR shell language.
    expect(document.documentElement.getAttribute("lang")).toBe("en");

    // 中 → zh-CN, persisted.
    zhBtn!.click();
    expect(document.documentElement.getAttribute("lang")).toBe("zh-CN");
    expect(localStorage.getItem("lod.lang")).toBe("zh");

    // EN → en, persisted.
    enBtn!.click();
    expect(document.documentElement.getAttribute("lang")).toBe("en");
    expect(localStorage.getItem("lod.lang")).toBe("en");

    // 中 again — no sticky state between clicks.
    zhBtn!.click();
    expect(document.documentElement.getAttribute("lang")).toBe("zh-CN");
    expect(localStorage.getItem("lod.lang")).toBe("zh");

    flushSync(() => root.unmount());
    host.remove();
  });
});
