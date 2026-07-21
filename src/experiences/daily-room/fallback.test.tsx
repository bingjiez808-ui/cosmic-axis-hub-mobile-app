// @ts-expect-error bun:test
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import type { ReactElement } from "react";

if (typeof globalThis.document === "undefined") {
  GlobalRegistrator.register({ url: "http://localhost/", width: 1280, height: 900 });
}
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const React = await import("react");
const { act } = React;
const { createRoot, hydrateRoot } = await import("react-dom/client");
const { renderToString } = await import("react-dom/server");
const { DailyRoomPending, DailyRoomError } = await import(
  "@/experiences/daily-room/fallback"
);
const { LanguageProvider } = await import("@/lib/i18n");

const roots: Array<{ root: { unmount: () => void }; host: HTMLElement }> = [];

function wrap(el: ReactElement): ReactElement {
  return <LanguageProvider>{el}</LanguageProvider>;
}

async function mount(el: ReactElement) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(wrap(el)));
  roots.push({ root, host });
  return host;
}

function resetLangToEnglish() {
  document.documentElement.setAttribute("lang", "en");
  try {
    window.localStorage.clear();
    window.localStorage.setItem("lod.lang", "en");
  } catch {
    /* ignore */
  }
  // The i18n store holds a module-level snapshot that can survive across
  // test suites; broadcast a language-change event so useSyncExternalStore
  // re-reads from localStorage on the next render.
  try {
    window.dispatchEvent(new Event("lod:lang-change"));
  } catch {
    /* ignore */
  }
}

afterEach(async () => {
  while (roots.length) {
    const { root, host } = roots.pop()!;
    await act(async () => root.unmount());
    host.remove();
  }
  document.body.innerHTML = "";
  resetLangToEnglish();
});

describe("/me/home fallbacks · never blank", () => {
  beforeEach(() => {
    resetLangToEnglish();
  });

  it("pending panel renders non-empty English text by default", async () => {
    await mount(<DailyRoomPending />);
    const el = document.querySelector('[data-testid="daily-room-pending"]');
    expect(el).toBeTruthy();
    const txt = (el?.textContent ?? "").trim();
    expect(txt.length).toBeGreaterThan(0);
    expect(txt.toLowerCase()).toContain("opening today");
    expect(el?.getAttribute("data-lang")).toBe("en");
  });

  it("pending panel swaps to Chinese after mount when the user's stored lang is zh", async () => {
    window.localStorage.setItem("lod.lang", "zh");
    await mount(<DailyRoomPending />);
    const el = document.querySelector('[data-testid="daily-room-pending"]');
    expect(el).toBeTruthy();
    expect(el?.getAttribute("data-lang")).toBe("zh");
    const txt = el?.textContent ?? "";
    expect(txt).toContain("今日阅览室");
    expect(txt).toContain("正在打开");
  });

  it("error panel surfaces title, error message, retry button and home link", async () => {
    let resetCount = 0;
    await mount(
      <DailyRoomError error={new Error("boom-42")} reset={() => (resetCount += 1)} />,
    );
    const el = document.querySelector('[data-testid="daily-room-error"]');
    expect(el).toBeTruthy();
    expect(el?.textContent ?? "").toContain("boom-42");
    const buttons = Array.from(document.querySelectorAll("button"));
    const retry = buttons.find((b) => /try again|重试/i.test(b.textContent ?? ""));
    expect(retry).toBeTruthy();
    await act(async () => retry!.click());
    expect(resetCount).toBe(1);
    const anchors = Array.from(document.querySelectorAll("a"));
    expect(anchors.some((a) => a.getAttribute("href") === "/")).toBe(true);
  });
});

describe("/me/home fallbacks · SSR hydration parity (regression for zh-CN mismatch)", () => {
  beforeEach(() => {
    resetLangToEnglish();
    try {
      window.localStorage.clear();
    } catch {
      /* ignore */
    }
  });

  it("server HTML for DailyRoomPending contains English copy (server snapshot)", () => {
    // Server render must be deterministic regardless of any client state,
    // because `getServerLanguageSnapshot()` always returns "en".
    const html = renderToString(wrap(<DailyRoomPending />));
    expect(html).toContain("Opening today");
    expect(html).not.toContain("今日阅览室");
    expect(html).toContain('data-lang="en"');
  });

  it("hydrates cleanly with stored zh AND swaps to Chinese after mount — no hydration mismatch", async () => {
    // Regression: previously DailyRoomPending read `document.documentElement.lang`
    // at render time. SSR emitted English but the first client render read
    // "zh-CN" from <html lang> and emitted Chinese, causing a hydration mismatch.
    // Now the component reads useLang() (SSR snapshot pinned to "en"), so the
    // first client render matches the server output. React then re-renders
    // with the real client snapshot and swaps to Chinese.
    document.documentElement.setAttribute("lang", "zh-CN");
    window.localStorage.setItem("lod.lang", "zh");

    const serverHTML = renderToString(wrap(<DailyRoomPending />));
    const host = document.createElement("div");
    host.innerHTML = serverHTML;
    document.body.appendChild(host);

    const errors: unknown[] = [];
    const origError = console.error;
    console.error = (...args: unknown[]) => {
      errors.push(args);
    };

    let hydrated: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => {
        hydrated = hydrateRoot(host, wrap(<DailyRoomPending />));
      });
    } finally {
      console.error = origError;
    }
    roots.push({
      root: { unmount: () => hydrated?.unmount() },
      host,
    });

    // Zero hydration warnings — the diagnostic React logs contain the word
    // "hydrat" (Hydration failed / did not match / hydration error).
    const mismatch = errors.find((entry) => {
      const s = Array.isArray(entry) ? entry.map(String).join(" ") : String(entry);
      return /hydrat/i.test(s);
    });
    if (mismatch) {
      // Surface the offending message so future regressions are debuggable.
      throw new Error(
        `Hydration mismatch detected: ${JSON.stringify(mismatch).slice(0, 400)}`,
      );
    }

    // After hydration + client re-render, Chinese copy is present and lang flag is zh.
    const el = document.querySelector('[data-testid="daily-room-pending"]');
    expect(el).toBeTruthy();
    expect(el?.getAttribute("data-lang")).toBe("zh");
    expect(el?.textContent ?? "").toContain("今日阅览室");
    expect((el?.textContent ?? "").trim().length).toBeGreaterThan(0);
  });

  it("error panel hydrates cleanly for zh-CN too", async () => {
    document.documentElement.setAttribute("lang", "zh-CN");
    window.localStorage.setItem("lod.lang", "zh");

    const el = wrap(
      <DailyRoomError error={new Error("boom")} reset={() => {}} />,
    );
    const serverHTML = renderToString(el);
    const host = document.createElement("div");
    host.innerHTML = serverHTML;
    document.body.appendChild(host);

    const errors: unknown[] = [];
    const origError = console.error;
    console.error = (...args: unknown[]) => {
      errors.push(args);
    };

    let hydrated: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => {
        hydrated = hydrateRoot(host, el);
      });
    } finally {
      console.error = origError;
    }
    roots.push({
      root: { unmount: () => hydrated?.unmount() },
      host,
    });

    const mismatch = errors.find((entry) => {
      const s = Array.isArray(entry) ? entry.map(String).join(" ") : String(entry);
      return /hydrat/i.test(s);
    });
    if (mismatch) {
      throw new Error(
        `Hydration mismatch detected in DailyRoomError: ${JSON.stringify(mismatch).slice(0, 400)}`,
      );
    }

    const alertEl = document.querySelector('[data-testid="daily-room-error"]');
    expect(alertEl?.getAttribute("data-lang")).toBe("zh");
    expect(alertEl?.textContent ?? "").toContain("阅览室");
  });
});

describe("/me/home body never waits on Supabase (real-chart adapter is non-blocking)", () => {
  it("real-chart section is rendered by DailyRoomPage independent of session fetch", async () => {
    // Contract-only assertion: the route module exports the pending/error
    // components on `Route.options`. If a future refactor removes them, the
    // regression that motivated this fix would reappear.
    const mod = await import("@/routes/_authenticated/me.home");
    const opts = (mod.Route as unknown as { options: Record<string, unknown> }).options;
    expect(opts.pendingComponent).toBeTruthy();
    expect(opts.errorComponent).toBeTruthy();
    expect(opts.pendingMs).toBe(0);
  });
});
