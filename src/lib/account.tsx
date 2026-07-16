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
  aiReportVersion?: string;
  aiOutlook?: OutlookAI;
  aiOutlookVersion?: string;
};

type ReadingAIPatch = Partial<
  Pick<
    SavedReading,
    "aiReport" | "aiReportVersion" | "aiOutlook" | "aiOutlookVersion" | "fingerprint"
  >
>;

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
  findReading: (lookup: SavedReadingLookup) => SavedReading | undefined;
};

const AccountCtx = createContext<Ctx | null>(null);

const ACC_KEY = "lod.account";
export const READS_KEY = "lod.saved_readings";

export type SavedReadingLookup = {
  id?: string;
  fingerprint?: string;
  name?: string;
  date?: string;
  time?: string;
  place?: string;
  lang?: "en" | "zh";
};

function readStoredJson<T>(key: string, fallback: T): T {
  try {
    if (typeof localStorage === "undefined") return fallback;
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStoredJson<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export function readStoredSavedReadings(): SavedReading[] {
  const list = readStoredJson<SavedReading[]>(READS_KEY, []);
  return Array.isArray(list) ? list : [];
}

export function findSavedReading(list: SavedReading[], lookup: SavedReadingLookup) {
  if (lookup.id) {
    const byId = list.find((s) => s.id === lookup.id);
    if (byId) return byId;
  }
  if (lookup.fingerprint) {
    const byFingerprint = list.find((s) => s.fingerprint === lookup.fingerprint);
    if (byFingerprint) return byFingerprint;
  }
  if (!lookup.date) return undefined;
  const same = (a?: string, b?: string) => (a ?? "") === (b ?? "");
  return list.find(
    (s) =>
      same(s.name, lookup.name) &&
      same(s.date, lookup.date) &&
      same(s.time, lookup.time) &&
      same(s.place, lookup.place) &&
      (!lookup.lang || !s.lang || s.lang === lookup.lang),
  );
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(() => readStoredJson<Account | null>(ACC_KEY, null));
  const [saved, setSaved] = useState<SavedReading[]>(() => readStoredSavedReadings());

  useEffect(() => {
    try {
      setAccount(readStoredJson<Account | null>(ACC_KEY, null));
      setSaved(readStoredSavedReadings());
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
    writeStoredJson(READS_KEY, list);
  };

  const saveReading: Ctx["saveReading"] = (r) => {
    setSaved((current) => {
      const base = current.length ? current : readStoredSavedReadings();
      // Merge with any existing entry that matches the stable reading id,
      // fingerprint, or the visible birth fields so AI cache carries over.
      const prior = findSavedReading(base, {
        fingerprint: r.fingerprint,
        name: r.name ?? "",
        date: r.date,
        time: r.time,
        place: r.place,
        lang: r.lang,
      });
      const entry: SavedReading = {
        ...prior,
        ...r,
        aiReport: r.aiReport ?? prior?.aiReport,
        aiReportVersion: r.aiReportVersion ?? prior?.aiReportVersion,
        aiOutlook: r.aiOutlook ?? prior?.aiOutlook,
        aiOutlookVersion: r.aiOutlookVersion ?? prior?.aiOutlookVersion,
        fingerprint: r.fingerprint ?? prior?.fingerprint,
        id: prior?.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: prior?.createdAt ?? Date.now(),
      };
      const next = [entry, ...base.filter((s) => s.id !== entry.id)].slice(0, 20);
      writeStoredJson(READS_KEY, next);
      return next;
    });
  };

  const removeReading = (id: string) => persist(saved.filter((s) => s.id !== id));

  const updateReadingAI: Ctx["updateReadingAI"] = (fingerprint, patch) => {
    if (!fingerprint) return;
    setSaved((current) => {
      const base = current.length ? current : readStoredSavedReadings();
      let changed = false;
      const next = base.map((s) => {
        if (s.fingerprint === fingerprint) {
          changed = true;
          return { ...s, ...patch, fingerprint };
        }
        return s;
      });
      if (!changed) return current;
      writeStoredJson(READS_KEY, next);
      return next;
    });
  };

  const findReadingByFingerprint: Ctx["findReadingByFingerprint"] = (fingerprint) =>
    fingerprint ? findSavedReading(saved, { fingerprint }) ?? findSavedReading(readStoredSavedReadings(), { fingerprint }) : undefined;

  const findReading: Ctx["findReading"] = (lookup) =>
    findSavedReading(saved, lookup) ?? findSavedReading(readStoredSavedReadings(), lookup);

  return (
    <AccountCtx.Provider value={{ account, signIn, signOut, setPlan, setAvatar, saved, saveReading, removeReading, updateReadingAI, findReadingByFingerprint, findReading }}>
      {children}
    </AccountCtx.Provider>
  );
}

export function useAccount() {
  const ctx = useContext(AccountCtx);
  if (!ctx) throw new Error("useAccount must be used within AccountProvider");
  return ctx;
}
