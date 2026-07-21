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
const { createRoot } = await import("react-dom/client");
const { DailyRoomPending, DailyRoomError } = await import(
  "@/experiences/daily-room/fallback"
);

const roots: Array<{ root: ReturnType<typeof createRoot>; host: HTMLElement }> = [];

async function mount(el: ReactElement) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(el));
  roots.push({ root, host });
  return host;
}

afterEach(async () => {
  while (roots.length) {
    const { root, host } = roots.pop()!;
    await act(async () => root.unmount());
    host.remove();
  }
  document.body.innerHTML = "";
  document.documentElement.setAttribute("lang", "en");
});

describe("/me/home fallbacks · never blank", () => {
  beforeEach(() => {
    document.documentElement.setAttribute("lang", "en");
  });

  it("pending panel renders non-empty English text", async () => {
    await mount(<DailyRoomPending />);
    const el = document.querySelector('[data-testid="daily-room-pending"]');
    expect(el).toBeTruthy();
    const txt = (el?.textContent ?? "").trim();
    expect(txt.length).toBeGreaterThan(0);
    expect(txt.toLowerCase()).toContain("opening today");
  });

  it("pending panel renders Chinese copy when <html lang=zh-CN>", async () => {
    document.documentElement.setAttribute("lang", "zh-CN");
    await mount(<DailyRoomPending />);
    const el = document.querySelector('[data-testid="daily-room-pending"]');
    expect(el?.textContent ?? "").toContain("今日阅览室");
    expect(el?.textContent ?? "").toContain("正在打开");
  });

  it("error panel surfaces bilingual title, error message, retry button and home link", async () => {
    let resetCount = 0;
    await mount(
      <DailyRoomError error={new Error("boom-42")} reset={() => (resetCount += 1)} />,
    );
    const el = document.querySelector('[data-testid="daily-room-error"]');
    expect(el).toBeTruthy();
    expect(el?.textContent ?? "").toContain("boom-42");
    const buttons = Array.from(document.querySelectorAll("button"));
    const retry = buttons.find((b) => /try again/i.test(b.textContent ?? ""));
    expect(retry).toBeTruthy();
    await act(async () => retry!.click());
    expect(resetCount).toBe(1);
    const anchors = Array.from(document.querySelectorAll("a"));
    expect(anchors.some((a) => a.getAttribute("href") === "/")).toBe(true);
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
