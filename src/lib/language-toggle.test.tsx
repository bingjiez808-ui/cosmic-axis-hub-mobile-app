// @ts-expect-error bun:test
import { describe, expect, it, beforeEach } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
if (typeof globalThis.document === "undefined") {
  GlobalRegistrator.register({ url: "http://localhost/", width: 1024, height: 768 });
}
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";

import { LanguageProvider, useLang, htmlLangFor } from "@/lib/i18n";

type Lang = "en" | "zh";

/**
 * Renders the shared `<LanguageProvider>`, captures the toggle mechanism the
 * root nav's `LanguageToggle` uses (`setLang` from `useLang()`), and asserts
 * that flipping languages updates React context, localStorage, and the
 * `<html lang>` attribute together. The root nav toggle wires those three
 * signals through the same hook, so exercising the hook directly guards
 * against regressions in either drawer or desktop button.
 */
function Probe({ onReady }: { onReady: (setLang: (l: Lang) => void, lang: Lang) => void }) {
  const { lang, setLang } = useLang();
  useEffect(() => {
    onReady(setLang, lang);
  });
  return <span data-testid="lang">{lang}</span>;
}

describe("LanguageToggle · zh↔en interaction keeps <html lang> in sync", () => {
  beforeEach(() => {
    document.documentElement.setAttribute("lang", "en");
    try {
      localStorage.removeItem("lod.lang");
    } catch {}
  });

  it("flipping via setLang updates context, localStorage, and <html lang>", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);

    let latestSetLang: ((l: Lang) => void) | null = null;
    const handleReady = (setLang: (l: Lang) => void) => {
      latestSetLang = setLang;
    };

    await act(async () => {
      root.render(
        <LanguageProvider>
          <Probe onReady={handleReady} />
        </LanguageProvider>,
      );
    });

    const langSpan = () => host.querySelector('[data-testid="lang"]')!.textContent;

    expect(langSpan()).toBe("en");
    expect(document.documentElement.getAttribute("lang")).toBe("en");

    await act(async () => {
      latestSetLang!("zh");
    });
    expect(langSpan()).toBe("zh");
    expect(htmlLangFor("zh")).toBe("zh-CN");
    expect(document.documentElement.getAttribute("lang")).toBe("zh-CN");
    expect(localStorage.getItem("lod.lang")).toBe("zh");

    await act(async () => {
      latestSetLang!("en");
    });
    expect(langSpan()).toBe("en");
    expect(document.documentElement.getAttribute("lang")).toBe("en");
    expect(localStorage.getItem("lod.lang")).toBe("en");

    await act(async () => {
      latestSetLang!("zh");
    });
    expect(langSpan()).toBe("zh");
    expect(document.documentElement.getAttribute("lang")).toBe("zh-CN");

    await act(async () => {
      root.unmount();
    });
    host.remove();
  });
});
