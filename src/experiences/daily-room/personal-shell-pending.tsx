/**
 * PersonalShellPending — lightweight pending fallback for `/me/*` sub
 * routes. Never occupies the full viewport with the ritual splash; the
 * shared PersonalWorkspaceNav is already visible in the layout, so a
 * quiet in-page skeleton is enough while the route chunk resolves.
 */
export function PersonalShellPending() {
  return (
    <div
      data-testid="personal-shell-pending"
      className="min-h-[40vh] bg-[#0a0a12] text-amber-100/70"
    >
      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-4 px-4 py-8 md:px-8 md:py-12">
        <div className="h-8 w-2/3 animate-pulse rounded bg-amber-400/10" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-amber-400/5" />
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <div className="h-32 animate-pulse rounded-xl border border-amber-400/10 bg-black/20" />
          <div className="h-32 animate-pulse rounded-xl border border-amber-400/10 bg-black/20" />
        </div>
      </div>
    </div>
  );
}
