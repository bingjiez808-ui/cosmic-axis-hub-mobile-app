import { createFileRoute, Outlet } from "@tanstack/react-router";

// Layout wrapper so /auth and /auth/reset can coexist as sibling leaves.
export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [{ name: "robots", content: "noindex" }],
  }),
  component: () => <Outlet />,
});
