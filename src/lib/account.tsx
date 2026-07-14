import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * Local-first account & saved-readings store. Persisted to localStorage.
 * A future Sage-plan upgrade will sync this to the cloud — the shape here
 * is deliberately small so it maps cleanly.
 */

export type Plan = "free" | "sage" | "oracle";

export type Account = { name: string; email: string; plan?: Plan };

export type SavedReading = {
  id: string;
  createdAt: number;
  name: string;
  date?: string;
  time?: string;
  place?: string;
  lang?: "en" | "zh";
};

type Ctx = {
  account: Account | null;
  signIn: (a: Account) => void;
  signOut: () => void;
  setPlan: (p: Plan) => void;
  saved: SavedReading[];
  saveReading: (r: Omit<SavedReading, "id" | "createdAt">) => void;
  removeReading: (id: string) => void;
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
  const signOut = () => {
    setAccount(null);
    try {
      localStorage.removeItem(ACC_KEY);
    } catch {}
  };

  const persist = (list: SavedReading[]) => {
    setSaved(list);
    try {
      localStorage.setItem(READS_KEY, JSON.stringify(list));
    } catch {}
  };

  const saveReading: Ctx["saveReading"] = (r) => {
    const entry: SavedReading = {
      ...r,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
    };
    // De-dupe by identical name+date+place (keep newest).
    const next = [entry, ...saved.filter(
      (s) => !(s.name === entry.name && s.date === entry.date && s.place === entry.place),
    )].slice(0, 20);
    persist(next);
  };

  const removeReading = (id: string) => persist(saved.filter((s) => s.id !== id));

  return (
    <AccountCtx.Provider value={{ account, signIn, signOut, setPlan, saved, saveReading, removeReading }}>
      {children}
    </AccountCtx.Provider>
  );
}

export function useAccount() {
  const ctx = useContext(AccountCtx);
  if (!ctx) throw new Error("useAccount must be used within AccountProvider");
  return ctx;
}
