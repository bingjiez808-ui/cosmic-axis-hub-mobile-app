import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * /me/relationships — canonical entry for the merged Friends + Match
 * space. Renders nothing itself; forwards to /me/friends (the default
 * subtab). Kept as a stable direct-link surface so the shelf nav and
 * external links never depend on subroute knowledge.
 */
export const Route = createFileRoute("/_authenticated/me/relationships")({
  beforeLoad: () => {
    throw redirect({ to: "/me/friends" });
  },
});
