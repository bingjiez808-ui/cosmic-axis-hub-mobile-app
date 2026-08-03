/**
 * useReaderPassData — derives every field rendered on the Reader's Pass
 * from *existing* state (useHomeFacts + Supabase session). NEVER exposes
 * email, full UUID, birth data, or location. Membership permissions are
 * always resolved server-side via useMembershipTier; the pass copy is
 * display-only and not consulted for gating.
 */
import { useMemo } from "react";
import { useSupabaseSession } from "@/lib/session";
import { useHomeFacts } from "@/lib/use-home-facts";
import type { MemTier } from "@/lib/use-membership-tier";

export type ReaderPassData = {
  isSignedIn: boolean;
  displayName: string; // "访客" / user metadata display_name / email initial / "馆内读者"
  identityZh: "访客" | "求索者" | "贤者" | "神谕者";
  identityEn: "Guest" | "Seeker" | "Sage" | "Oracle";
  readerNumber: string; // "GUEST" or "DL-••••-1842"
  chartLabelZh: "尚未建立" | "已入藏";
  chartLabelEn: "Not yet built" | "In the archive";
  tier: MemTier;
  hasPrimaryChart: boolean;
};

function tierToIdentity(tier: MemTier, signedIn: boolean): {
  zh: ReaderPassData["identityZh"];
  en: ReaderPassData["identityEn"];
} {
  if (!signedIn) return { zh: "访客", en: "Guest" };
  if (tier === "oracle") return { zh: "神谕者", en: "Oracle" };
  if (tier === "sage") return { zh: "贤者", en: "Sage" };
  return { zh: "求索者", en: "Seeker" };
}

function safeName(session: ReturnType<typeof useSupabaseSession>["session"]): string {
  if (!session?.user) return "访客";
  const meta = (session.user.user_metadata ?? {}) as Record<string, unknown>;
  const displayName = typeof meta.display_name === "string" ? meta.display_name.trim() : "";
  if (displayName) return displayName;
  const fullName = typeof meta.full_name === "string" ? meta.full_name.trim() : "";
  if (fullName) return fullName;
  const email = typeof session.user.email === "string" ? session.user.email : "";
  if (email) {
    // Use only the initial to avoid leaking the address on-screen.
    const first = email[0]?.toUpperCase() ?? "";
    return first ? `馆内读者 · ${first}` : "馆内读者";
  }
  return "馆内读者";
}

function safeReaderNumber(userId: string | undefined): string {
  if (!userId) return "GUEST";
  const tail = userId.replace(/-/g, "").slice(-4).toUpperCase();
  return `DL-••••-${tail || "0000"}`;
}

export function useReaderPassData(): ReaderPassData {
  const { session } = useSupabaseSession();
  const facts = useHomeFacts();

  return useMemo<ReaderPassData>(() => {
    const identity = tierToIdentity(facts.tier, facts.isSignedIn);
    return {
      isSignedIn: facts.isSignedIn,
      displayName: facts.isSignedIn ? safeName(session) : "访客",
      identityZh: identity.zh,
      identityEn: identity.en,
      readerNumber: safeReaderNumber(session?.user?.id),
      chartLabelZh: facts.hasPrimaryChart ? "已入藏" : "尚未建立",
      chartLabelEn: facts.hasPrimaryChart ? "In the archive" : "Not yet built",
      tier: facts.tier,
      hasPrimaryChart: facts.hasPrimaryChart,
    };
  }, [session, facts.tier, facts.isSignedIn, facts.hasPrimaryChart]);
}
