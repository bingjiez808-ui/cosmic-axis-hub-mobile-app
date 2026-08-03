const APP_ROUTE_PREFIXES = [
  "/auth",
  "/bonds",
  "/chart",
  "/community",
  "/life-studies",
  "/me",
  "/report",
  "/ritual",
  "/today",
];

export function isAppRoute(pathname: string) {
  if (pathname === "/") return true;
  return APP_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

