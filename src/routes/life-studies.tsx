import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/life-studies")({
  component: () => <Outlet />,
});
