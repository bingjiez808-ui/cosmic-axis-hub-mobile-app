import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";

// Beta helpers on supabase-js: keep a tiny typed wrapper so TS accepts the calls
// without grepping node_modules.
type AuthorizationDetails = {
  client?: { name?: string; redirect_uri?: string; scope?: string };
  scopes?: string[];
  redirect_url?: string;
  redirect_to?: string;
};
type OAuthResult<T> = { data: T | null; error: { message: string } | null };
type OAuthNamespace = {
  getAuthorizationDetails: (id: string) => Promise<OAuthResult<AuthorizationDetails>>;
  approveAuthorization: (id: string) => Promise<OAuthResult<AuthorizationDetails>>;
  denyAuthorization: (id: string) => Promise<OAuthResult<AuthorizationDetails>>;
};
const supabaseOAuth = () =>
  (supabase.auth as unknown as { oauth: OAuthNamespace }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  // Browser-only: the Supabase client reads its session from localStorage,
  // absent on the SSR pass. Without this, getSession() is null on the server
  // and bounces signed-in users to login.
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    // No session: send the user through the app's auth flow and preserve the
    // consent URL as a same-origin relative path so they return here with the
    // same authorization_id.
    const next = location.pathname + location.searchStr;
    if (!data.session) {
      throw redirect({ to: "/auth", search: { redirect: next, reset: undefined } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await supabaseOAuth().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="mx-auto max-w-xl px-6 py-24 text-stone-warm">
      <h1 className="mb-4 font-serif text-2xl italic">Could not load this authorization request</h1>
      <p className="text-sm text-stone-warm/70">{String((error as Error)?.message ?? error)}</p>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientName = details?.client?.name ?? "an application";

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = approve
      ? await supabaseOAuth().approveAuthorization(authorization_id)
      : await supabaseOAuth().denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-24">
      <div className="glass-card rounded-3xl border border-gold-dust/20 p-8 md:p-10">
        <p className="text-[10px] uppercase tracking-[0.42em] text-gold-dust">Library of Destiny</p>
        <h1 className="mt-3 font-serif text-2xl italic text-stone-warm md:text-3xl">
          Connect {clientName} to your account
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-stone-warm/70">
          {clientName} will be able to call this app's enabled tools while you are signed in.
          Approving does not bypass the Library's own permissions or backend policies.
        </p>
        {details?.client?.redirect_uri && (
          <p className="mt-3 text-[11px] uppercase tracking-[0.24em] text-stone-warm/40">
            Redirect · {details.client.redirect_uri}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </p>
        )}
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => decide(true)}
            className="rounded-full bg-gold-dust px-6 py-2.5 text-[11px] uppercase tracking-[0.28em] text-obsidian disabled:opacity-40 hover:bg-gold-light"
          >
            {busy ? "Working…" : "Approve"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => decide(false)}
            className="rounded-full border border-gold-dust/40 px-6 py-2.5 text-[11px] uppercase tracking-[0.28em] text-gold-dust disabled:opacity-40 hover:bg-gold-dust/10"
          >
            Cancel connection
          </button>
        </div>
      </div>
    </main>
  );
}
