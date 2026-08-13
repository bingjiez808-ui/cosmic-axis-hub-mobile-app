import { useSyncExternalStore } from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

export type SessionState = {
  session: Session | null;
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
};

/**
 * Module-level session store, shared across every `useSupabaseSession()`
 * call site. A single subscription to `supabase.auth.onAuthStateChange`
 * feeds all consumers — public header, authenticated pages, footers —
 * so the signed-in state is consistent regardless of which route the
 * user is on.
 */
const SERVER_STATE: SessionState = {
  session: null,
  user: null,
  isAdmin: false,
  loading: true,
};

let clientState: SessionState = { ...SERVER_STATE };
const listeners = new Set<() => void>();
let initialized = false;
let currentUserId: string | null = null;

function emit() {
  for (const l of listeners) l();
}

function setState(next: Partial<SessionState>) {
  clientState = { ...clientState, ...next };
  emit();
}

async function refreshAdmin(userId: string | null) {
  if (!userId) {
    setState({ isAdmin: false });
    return;
  }
  try {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    // Guard against races: only apply if this is still the current user.
    if (currentUserId === userId) {
      setState({ isAdmin: !!data });
    }
  } catch {
    if (currentUserId === userId) setState({ isAdmin: false });
  }
}

function applySession(session: Session | null) {
  const user = session?.user ?? null;
  currentUserId = user?.id ?? null;
  setState({
    session,
    user,
    loading: false,
    isAdmin: user ? clientState.isAdmin : false,
  });
  void refreshAdmin(currentUserId);
}

function ensureInitialized() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  const hydrationTimeout = window.setTimeout(() => {
    if (clientState.loading) setState({ loading: false });
  }, 3500);
  // Kick off the initial hydration from persisted storage.
  supabase.auth
    .getSession()
    .then(({ data }) => {
      window.clearTimeout(hydrationTimeout);
      applySession(data.session ?? null);
    })
    .catch(() => {
      window.clearTimeout(hydrationTimeout);
      setState({ loading: false });
    });
  // Subscribe once for the lifetime of the tab.
  supabase.auth.onAuthStateChange((_event, session) => {
    applySession(session ?? null);
  });
}

function subscribe(listener: () => void) {
  ensureInitialized();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): SessionState {
  return clientState;
}

function getServerSnapshot(): SessionState {
  return SERVER_STATE;
}

export function useSupabaseSession(): SessionState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
