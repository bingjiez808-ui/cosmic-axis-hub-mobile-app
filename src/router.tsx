import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { DailyRoomPending, DailyRoomError } from "./experiences/daily-room/fallback";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // Ensure ANY navigation into a not-yet-loaded chunk (side nav, mobile
    // drawer, /me/friends → /me/home, etc.) paints an instant non-blank
    // fallback rather than a bare <main>.
    defaultPendingMs: 0,
    defaultPendingComponent: DailyRoomPending,
    defaultErrorComponent: DailyRoomError,
  });

  return router;
};

