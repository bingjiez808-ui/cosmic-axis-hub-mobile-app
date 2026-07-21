// @ts-expect-error bun:test
import { afterEach, describe, expect, it, beforeEach } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import type { ReactElement } from "react";
if (typeof globalThis.document === "undefined") {
  GlobalRegistrator.register({ url: "http://localhost/", width: 1280, height: 900 });
}
if (
  typeof globalThis.document !== "undefined" &&
  (typeof globalThis.window === "undefined" ||
    typeof globalThis.window.addEventListener !== "function")
) {
  const defaultView = globalThis.document.defaultView;
  if (defaultView && typeof defaultView.addEventListener === "function") {
    (globalThis as unknown as { window: Window }).window = defaultView as unknown as Window;
  }
}

function restoreDomWindow(): void {
  const defaultView = globalThis.document?.defaultView;
  if (!defaultView) return;
  if (
    typeof globalThis.window === "undefined" ||
    globalThis.window !== defaultView ||
    typeof globalThis.window.addEventListener !== "function"
  ) {
    Object.defineProperty(globalThis, "window", {
      value: defaultView,
      configurable: true,
      writable: true,
    });
  }
  Object.defineProperty(globalThis, "localStorage", {
    value: defaultView.localStorage,
    configurable: true,
    writable: true,
  });
}

restoreDomWindow();
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const React = await import("react");
const { act } = React;
const { createRoot } = await import("react-dom/client");
const { renderToString } = await import("react-dom/server");
const { htmlLangFor, syncDocumentLang, LanguageProvider, useLang } = await import("@/lib/i18n");
const { useDaily } = await import("@/lib/i18n-daily");
const { LanguageToggle } = await import("@/components/LanguageToggle");
const { AuthRefreshFailedError } = await import("@/routes/_authenticated/route");

const activeRoots: Array<{ root: ReturnType<typeof createRoot>; host: HTMLElement }> = [];

async function mount(el: ReactElement) {
  restoreDomWindow();
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(el);
  });
  activeRoots.push({ root, host });
  return { root, host };
}

afterEach(async () => {
  restoreDomWindow();
  while (activeRoots.length) {
    const { root, host } = activeRoots.pop()!;
    await act(async () => root.unmount());
    host.remove();
  }
  document.body.innerHTML = "";
  document.documentElement.setAttribute("lang", "en");
  window.localStorage.clear();
});

describe("i18n · html lang tag mapping", () => {
  it("maps app lang → BCP-47 html tag", () => {
    expect(htmlLangFor("en")).toBe("en");
    expect(htmlLangFor("zh")).toBe("zh-CN");
  });

  it("syncDocumentLang is a no-op when document is undefined", () => {
    const originalDocument = (globalThis as { document?: unknown }).document;
    delete (globalThis as { document?: unknown }).document;
    expect(() => syncDocumentLang("zh")).not.toThrow();
    if (originalDocument !== undefined) {
      (globalThis as { document?: unknown }).document = originalDocument;
    }
  });

  it("syncDocumentLang writes to <html>", () => {
    const stub = {
      documentElement: {
        _lang: "en",
        getAttribute(name: string) {
          return name === "lang" ? this._lang : null;
        },
        setAttribute(name: string, value: string) {
          if (name === "lang") this._lang = value;
        },
      },
    };
    const original = (globalThis as { document?: unknown }).document;
    (globalThis as { document?: unknown }).document = stub;
    try {
      syncDocumentLang("zh");
      expect(stub.documentElement._lang).toBe("zh-CN");
      syncDocumentLang("en");
      expect(stub.documentElement._lang).toBe("en");
    } finally {
      if (original === undefined) delete (globalThis as { document?: unknown }).document;
      else (globalThis as { document?: unknown }).document = original;
    }
  });
});

describe("LanguageProvider · SSR shell parity", () => {
  it("initial SSR render matches the default `en` shell (no hydration mismatch)", () => {
    function Probe() {
      const { lang } = useLang();
      return `lang=${lang}`;
    }
    const html = renderToString(
      <LanguageProvider>
        <Probe />
      </LanguageProvider>,
    );
    // Provider must default to `en` on the server so the `<html lang="en">`
    // shell hydrates cleanly. localStorage-driven override happens in an
    // effect after mount.
    expect(html).toBe("lang=en");
  });
});

describe("LanguageToggle · real DOM interaction", () => {
  beforeEach(() => {
    restoreDomWindow();
    window.localStorage.clear();
    document.documentElement.setAttribute("lang", "en");
  });

  it("clicks zh → en → zh and immediately updates context copy, <html lang>, and persistence", async () => {
    function ProbeContent() {
      const { lang } = useLang();
      const d = useDaily();
      return (
        <>
          <LanguageToggle />
          <p data-testid="lang">{lang}</p>
          <h1>{d.match_kicker}</h1>
          <nav>{d.home_secondary_nav_match}</nav>
        </>
      );
    }

    await mount(
      <LanguageProvider>
        <ProbeContent />
      </LanguageProvider>,
    );

    const zhButton = document.querySelector<HTMLButtonElement>('[data-lang-button="zh"]');
    expect(zhButton).toBeTruthy();
    await act(async () => {
      zhButton!.click();
    });

    expect(document.documentElement.getAttribute("lang")).toBe("zh-CN");
    expect(window.localStorage.getItem("lod.lang")).toBe("zh");
    expect(document.querySelector('[data-testid="lang"]')?.textContent).toBe("zh");
    expect(document.body.textContent ?? "").toContain("双人命盘互动 · 演示");

    const enButton = document.querySelector<HTMLButtonElement>('[data-lang-button="en"]');
    expect(enButton).toBeTruthy();
    await act(async () => {
      enButton!.click();
    });

    expect(document.documentElement.getAttribute("lang")).toBe("en");
    expect(window.localStorage.getItem("lod.lang")).toBe("en");
    expect(document.querySelector('[data-testid="lang"]')?.textContent).toBe("en");
    expect(document.body.textContent ?? "").toContain("Two-chart compatibility · demo");
    expect(document.body.textContent ?? "").not.toContain("双人命盘互动 · 演示");

    await act(async () => {
      zhButton!.click();
    });

    expect(document.documentElement.getAttribute("lang")).toBe("zh-CN");
    expect(window.localStorage.getItem("lod.lang")).toBe("zh");
    expect(document.querySelector('[data-testid="lang"]')?.textContent).toBe("zh");
    expect(document.body.textContent ?? "").toContain("双人命盘互动 · 演示");

    while (activeRoots.length) {
      const { root, host } = activeRoots.pop()!;
      await act(async () => root.unmount());
      host.remove();
    }
    await mount(
      <LanguageProvider>
        <ProbeContent />
      </LanguageProvider>,
    );
    expect(document.documentElement.getAttribute("lang")).toBe("zh-CN");
    expect(document.querySelector('[data-testid="lang"]')?.textContent).toBe("zh");
    expect(document.body.textContent ?? "").toContain("双人命盘互动 · 演示");
  });

  it("keeps nested LanguageProviders on one shared store when an inner EN button is clicked", async () => {
    function LocalizedPanel({ id }: { id: string }) {
      const { lang } = useLang();
      const d = useDaily();
      return (
        <section data-testid={id}>
          <LanguageToggle />
          <p data-testid={`${id}-lang`}>{lang}</p>
          <h2>{d.home_secondary_nav_match}</h2>
          <p>{d.match_kicker}</p>
        </section>
      );
    }

    await mount(
      <LanguageProvider>
        <LocalizedPanel id="outer" />
        <LanguageProvider>
          <LocalizedPanel id="inner" />
        </LanguageProvider>
      </LanguageProvider>,
    );

    const inner = document.querySelector<HTMLElement>('[data-testid="inner"]');
    const innerZh = inner?.querySelector<HTMLButtonElement>('[data-lang-button="zh"]');
    expect(innerZh).toBeTruthy();
    await act(async () => {
      innerZh!.click();
    });

    expect(document.documentElement.getAttribute("lang")).toBe("zh-CN");
    expect(document.querySelector('[data-testid="outer-lang"]')?.textContent).toBe("zh");
    expect(document.querySelector('[data-testid="inner-lang"]')?.textContent).toBe("zh");
    expect(document.body.textContent ?? "").toContain("适配分析");

    const innerEn = inner?.querySelector<HTMLButtonElement>('[data-lang-button="en"]');
    expect(innerEn).toBeTruthy();
    await act(async () => {
      innerEn!.click();
    });

    expect(document.documentElement.getAttribute("lang")).toBe("en");
    expect(window.localStorage.getItem("lod.lang")).toBe("en");
    expect(document.querySelector('[data-testid="outer-lang"]')?.textContent).toBe("en");
    expect(document.querySelector('[data-testid="inner-lang"]')?.textContent).toBe("en");
    expect(document.body.textContent ?? "").toContain("Match");
    expect(document.body.textContent ?? "").toContain("Two-chart compatibility · demo");
    expect(document.body.textContent ?? "").not.toContain("双人命盘互动 · 演示");

    await act(async () => {
      innerZh!.click();
    });

    expect(document.documentElement.getAttribute("lang")).toBe("zh-CN");
    expect(window.localStorage.getItem("lod.lang")).toBe("zh");
    expect(document.querySelector('[data-testid="outer-lang"]')?.textContent).toBe("zh");
    expect(document.querySelector('[data-testid="inner-lang"]')?.textContent).toBe("zh");
    expect(document.body.textContent ?? "").toContain("双人命盘互动 · 演示");
  });
});

describe("AuthRefreshFailedError", () => {
  it("preserves the underlying cause and identifies itself by name", () => {
    const inner = new Error("Failed to fetch");
    inner.name = "TypeError";
    const err = new AuthRefreshFailedError(inner);
    expect(err.name).toBe("AuthRefreshFailedError");
    expect(err.cause).toBe(inner);
    expect(err.message).toContain("Failed to fetch");
  });
});
