// @ts-expect-error bun:test
import { describe, expect, it, beforeEach } from "bun:test";
import { renderToString } from "react-dom/server";

import { htmlLangFor, syncDocumentLang, LanguageProvider, useLang } from "@/lib/i18n";
import { AuthRefreshFailedError } from "@/routes/_authenticated/route";

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
