import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import type { ReportAI } from "@/lib/report.functions";
import type { OutlookAI } from "@/lib/outlook.functions";

/**
 * Local-first account & saved-readings store. Persisted to localStorage.
 * A future Sage-plan upgrade will sync this to the cloud — the shape here
 * is deliberately small so it maps cleanly.
 */

export type Plan = "free" | "sage" | "oracle";

export type Account = { name: string; email: string; plan?: Plan; avatar?: string };

export type SavedReading = {
  id: string;
  createdAt: number;
  name: string;
  date?: string;
  time?: string;
  place?: string;
  lang?: "en" | "zh";
  fingerprint?: string;
  aiReport?: ReportAI;
  aiOutlook?: OutlookAI;
};

type ReadingAIPatch = Partial<Pick<SavedReading, "aiReport" | "aiOutlook" | "fingerprint">>;

type Ctx = {
  account: Account | null;
  signIn: (a: Account) => void;
  signOut: () => void;
  setPlan: (p: Plan) => void;
  setAvatar: (dataUrl: string) => void;
  saved: SavedReading[];
  saveReading: (r: Omit<SavedReading, "id" | "createdAt">) => void;
  removeReading: (id: string) => void;
  updateReadingAI: (fingerprint: string, patch: ReadingAIPatch) => void;
  findReadingByFingerprint: (fingerprint: string) => SavedReading | undefined;
};

const AccountCtx = createContext<Ctx | null>(null);

const ACC_KEY = "lod.account";
const READS_KEY = "lod.saved_readings";

export function AccountProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [saved, setSaved] = useState<SavedReading[]>([]);

  useEffect(() => {
    try {
      const a = localStorage.getItem(ACC_KEY);
      if (a) setAccount(JSON.parse(a));
      const r = localStorage.getItem(READS_KEY);
      if (r) setSaved(JSON.parse(r));
    } catch {}
  }, []);

  useEffect(() => {
    const syncAccount = (user: { email?: string | null; user_metadata?: Record<string, unknown> } | null) => {
      const userEmail = user?.email;
      if (!userEmail) {
        setAccount(null);
        try {
          localStorage.removeItem(ACC_KEY);
        } catch {}
        return;
      }
      const meta = user.user_metadata ?? {};
      const displayName =
        typeof meta.name === "string"
          ? meta.name
          : typeof meta.full_name === "string"
            ? meta.full_name
            : userEmail.split("@")[0];
      const avatar = typeof meta.avatar_url === "string" ? meta.avatar_url : undefined;
      setAccount((prev) => {
        const next: Account = {
          plan: prev?.plan ?? "free",
          avatar: prev?.avatar ?? avatar,
          name: prev && prev.email === userEmail ? prev.name : displayName,
          email: userEmail,
        };
        try {
          localStorage.setItem(ACC_KEY, JSON.stringify(next));
        } catch {}
        return next;
      });
    };

    supabase.auth.getSession().then(({ data }) => syncAccount(data.session?.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      syncAccount(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = (a: Account) => {
    const withPlan: Account = { plan: "free", ...a };
    setAccount(withPlan);
    try {
      localStorage.setItem(ACC_KEY, JSON.stringify(withPlan));
    } catch {}
  };
  const setPlan = (p: Plan) => {
    setAccount((prev) => {
      if (!prev) return prev;
      const next = { ...prev, plan: p };
      try {
        localStorage.setItem(ACC_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };
  const setAvatar = (dataUrl: string) => {
    setAccount((prev) => {
      const next: Account = prev
        ? { ...prev, avatar: dataUrl }
        : { name: "Traveler", email: "", plan: "free", avatar: dataUrl };
      try {
        localStorage.setItem(ACC_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };
  const signOut = () => {
    setAccount(null);
    try {
      localStorage.removeItem(ACC_KEY);
    } catch {}
    void supabase.auth.signOut();
  };

  const persist = (list: SavedReading[]) => {
    setSaved(list);
    try {
      localStorage.setItem(READS_KEY, JSON.stringify(list));
    } catch {}
  };

  const saveReading: Ctx["saveReading"] = (r) => {
    // Merge with any existing entry that matches name+date+place so AI cache carries over.
    const prior = saved.find(
      (s) => s.name === (r.name ?? "") && s.date === r.date && s.place === r.place,
    );
    const entry: SavedReading = {
      ...prior,
      ...r,
      aiReport: r.aiReport ?? prior?.aiReport,
      aiOutlook: r.aiOutlook ?? prior?.aiOutlook,
      fingerprint: r.fingerprint ?? prior?.fingerprint,
      id: prior?.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: prior?.createdAt ?? Date.now(),
    };
    const next = [entry, ...saved.filter((s) => s.id !== entry.id)].slice(0, 20);
    persist(next);
  };

  const removeReading = (id: string) => persist(saved.filter((s) => s.id !== id));

  const updateReadingAI: Ctx["updateReadingAI"] = (fingerprint, patch) => {
    if (!fingerprint) return;
    let changed = false;
    const next = saved.map((s) => {
      if (s.fingerprint === fingerprint) {
        changed = true;
        return { ...s, ...patch, fingerprint };
      }
      return s;
    });
    if (changed) persist(next);
  };

  const findReadingByFingerprint: Ctx["findReadingByFingerprint"] = (fingerprint) =>
    fingerprint ? saved.find((s) => s.fingerprint === fingerprint) : undefined;

  return (
    <AccountCtx.Provider value={{ account, signIn, signOut, setPlan, setAvatar, saved, saveReading, removeReading, updateReadingAI, findReadingByFingerprint }}>
      {children}
    </AccountCtx.Provider>
  );
}

export function useAccount() {
  const ctx = useContext(AccountCtx);
  if (!ctx) throw new Error("useAccount must be used within AccountProvider");
  return ctx;
}
