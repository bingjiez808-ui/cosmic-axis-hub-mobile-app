// @ts-expect-error bun:test
import { describe, expect, it, beforeEach } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
if (typeof globalThis.document === "undefined") {
  GlobalRegistrator.register({ url: "http://localhost/", width: 1024, height: 768 });
}
delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;

import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";

import { LanguageProvider, useLang, htmlLangFor } from "@/lib/i18n";

type Lang = "en" | "zh";

/**
 * The desktop button and mobile drawer language toggles both call the same
 * `setLang` returned by `useLang()`. Rendering the provider and capturing
 * that function verifies that flipping languages writes through to React
 * state (via the rendered text), localStorage, and `<html lang>` together.
 *
 * A tiny `Probe` grabs `setLang` during render (no effect needed) and
 * writes it onto a plain store, so the assertions never depend on whether
 * bun's shared act-environment flag was captured by React at import time.
 */
function makeProbe() {
  const store: { setLang: ((l: Lang) => void) | null; lang: Lang } = {
    setLang: null,
    lang: "en",
  };
  const Probe = () => {
    const { lang, setLang } = useLang();
    store.setLang = setLang;
    store.lang = lang;
    return <span data-testid="lang">{lang}</span>;
  };
  return { store, Probe };
}

describe("LanguageToggle · zh↔en interaction keeps <html lang> in sync", () => {
  beforeEach(() => {
    document.documentElement.setAttribute("lang", "en");
    try {
      localStorage.removeItem("lod.lang");
    } catch {}
  });

  it("flipping via setLang updates context, localStorage, and <html lang>", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    const { store, Probe } = makeProbe();

    flushSync(() => {
      root.render(
        <LanguageProvider>
          <Probe />
        </LanguageProvider>,
      );
    });

    expect(store.lang).toBe("en");
    expect(document.documentElement.getAttribute("lang")).toBe("en");

    flushSync(() => store.setLang!("zh"));
    expect(store.lang).toBe("zh");
    expect(htmlLangFor("zh")).toBe("zh-CN");
    expect(document.documentElement.getAttribute("lang")).toBe("zh-CN");
    expect(localStorage.getItem("lod.lang")).toBe("zh");

    flushSync(() => store.setLang!("en"));
    expect(store.lang).toBe("en");
    expect(document.documentElement.getAttribute("lang")).toBe("en");
    expect(localStorage.getItem("lod.lang")).toBe("en");

    flushSync(() => store.setLang!("zh"));
    expect(store.lang).toBe("zh");
    expect(document.documentElement.getAttribute("lang")).toBe("zh-CN");

    flushSync(() => root.unmount());
    host.remove();
  });
});
