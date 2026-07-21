// @ts-expect-error bun:test
import { describe, expect, it, beforeEach } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";

import { LanguageProvider, useLang, htmlLangFor } from "@/lib/i18n";

function Toggle() {
  const { lang, setLang } = useLang();
  return (
    <div>
      <span data-testid="lang">{lang}</span>
      <button data-testid="en" onClick={() => setLang("en")}>EN</button>
      <button data-testid="zh" onClick={() => setLang("zh")}>中</button>
    </div>
  );
}

async function mount() {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      <LanguageProvider>
        <Toggle />
      </LanguageProvider>,
    );
  });
  return { host, root };
}

describe("LanguageToggle · zh↔en interaction keeps <html lang> in sync", () => {
  beforeEach(() => {
    document.documentElement.setAttribute("lang", "en");
    try {
      localStorage.removeItem("lod.lang");
    } catch {}
  });

  it("clicking EN then 中 flips context, localStorage, and <html lang>", async () => {
    const { host, root } = await mount();

    const langSpan = () => host.querySelector('[data-testid="lang"]')!.textContent;
    const en = host.querySelector('[data-testid="en"]') as HTMLButtonElement;
    const zh = host.querySelector('[data-testid="zh"]') as HTMLButtonElement;

    expect(langSpan()).toBe("en");
    expect(document.documentElement.getAttribute("lang")).toBe("en");

    await act(async () => { zh.click(); });
    expect(langSpan()).toBe("zh");
    expect(document.documentElement.getAttribute("lang")).toBe(htmlLangFor("zh"));
    expect(document.documentElement.getAttribute("lang")).toBe("zh-CN");
    expect(localStorage.getItem("lod.lang")).toBe("zh");

    await act(async () => { en.click(); });
    expect(langSpan()).toBe("en");
    expect(document.documentElement.getAttribute("lang")).toBe("en");
    expect(localStorage.getItem("lod.lang")).toBe("en");

    await act(async () => { zh.click(); });
    expect(langSpan()).toBe("zh");
    expect(document.documentElement.getAttribute("lang")).toBe("zh-CN");

    await act(async () => { root.unmount(); });
    host.remove();
  });
});
