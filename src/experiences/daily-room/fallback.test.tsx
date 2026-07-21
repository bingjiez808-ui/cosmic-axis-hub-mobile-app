/**
 * Non-blank pending / error fallbacks for /me/home route chunk gap.
 * Guards against the "briefly-blank <main>" symptom reported after
 * navigating from /me/match → /me/home.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { RouterProvider, createMemoryHistory, createRouter, createRootRoute, createRoute, Outlet } from "@tanstack/react-router";

import { DailyRoomPending, DailyRoomError } from "@/experiences/daily-room/fallback";

function renderInRouter(ui: React.ReactNode) {
  const rootRoute = createRootRoute({ component: () => <Outlet /> });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => <>{ui}</>,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  return render(<RouterProvider router={router} />);
}

describe("daily-room fallback UI", () => {
  beforeEach(() => {
    cleanup();
    document.documentElement.setAttribute("lang", "en");
  });

  it("renders a non-empty pending panel in English", () => {
    renderInRouter(<DailyRoomPending />);
    const el = screen.getByTestId("daily-room-pending");
    expect(el.textContent && el.textContent.trim().length).toBeGreaterThan(0);
    expect(el.textContent).toMatch(/opening today’s reading room/i);
  });

  it("renders a non-empty pending panel in Chinese when html lang=zh", () => {
    document.documentElement.setAttribute("lang", "zh-CN");
    renderInRouter(<DailyRoomPending />);
    expect(screen.getByTestId("daily-room-pending").textContent).toContain("今日阅览室");
  });

  it("error panel surfaces retry + home link and calls reset", () => {
    let reset = 0;
    renderInRouter(
      <DailyRoomError error={new Error("boom")} reset={() => (reset += 1)} />,
    );
    const el = screen.getByTestId("daily-room-error");
    expect(el.textContent).toMatch(/reading room didn’t open|阅览室/i);
    expect(el.textContent).toContain("boom");
    fireEvent.click(screen.getByRole("button", { name: /try again|重试/i }));
    expect(reset).toBe(1);
  });
});
