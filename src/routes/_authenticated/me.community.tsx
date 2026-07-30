import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PersonalWorkspaceNav } from "@/components/PersonalWorkspaceNav";
import { Button } from "@/components/ui/button";
import { useCommunityProfile, useSaveCommunityProfile } from "@/lib/community-hall-client";
import { useCommunityHall } from "@/lib/i18n-community-hall";

/**
 * /me/community — fellowship settings: anonymous identity, participation
 * switch, and reply language. Real name, birth date and exact age are never
 * shown here or anywhere else in the hall.
 */
export const Route = createFileRoute("/_authenticated/me/community")({
  head: () => ({ meta: [{ name: "robots", content: "noindex,nofollow" }] }),
  component: CommunitySettingsPage,
});

function CommunitySettingsPage() {
  const c = useCommunityHall();
  const query = useCommunityProfile();
  const save = useSaveCommunityProfile();

  const [alias, setAlias] = useState("");
  const [quote, setQuote] = useState("");
  const [language, setLanguage] = useState<"zh" | "en">("zh");
  const [optIn, setOptIn] = useState(false);
  const [paused, setPaused] = useState(false);

  const profile = query.data?.profile;
  useEffect(() => {
    if (!profile) return;
    setAlias(profile.alias ?? "");
    setQuote(profile.quote ?? "");
    setLanguage((profile.language as "zh" | "en") ?? "zh");
    setOptIn(Boolean(profile.optIn));
    setPaused(profile.status === "paused");
  }, [profile]);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-24 pt-10 sm:px-6">
      <PersonalWorkspaceNav />
      <h1 className="mt-8 text-2xl font-semibold text-foreground">{c.settingsTitle}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{c.identityHint}</p>

      {query.isLoading ? (
        <p className="mt-8 text-sm text-muted-foreground">{c.loading}</p>
      ) : query.data && !query.data.eligible ? (
        <p className="mt-8 rounded-2xl border border-primary/20 bg-background/50 p-6 text-sm text-muted-foreground">
          {c.gateAdult}
        </p>
      ) : (
        <section className="mt-8 space-y-6 rounded-2xl border border-primary/15 bg-background/50 p-6 backdrop-blur">
          <div className="text-xs text-muted-foreground">
            {c.ageBand(query.data?.ageBand)} · {c.ageChapter(query.data?.ageBand)}
          </div>

          <label className="block">
            <span className="text-sm font-medium text-foreground">{c.settingAlias}</span>
            <input
              value={alias}
              onChange={(e) => setAlias(e.target.value.slice(0, 40))}
              className="mt-2 w-full rounded-xl border border-primary/20 bg-background/70 px-4 py-2.5 text-sm outline-none focus:border-primary/50"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-foreground">{c.settingQuote}</span>
            <input
              value={quote}
              onChange={(e) => setQuote(e.target.value.slice(0, 140))}
              className="mt-2 w-full rounded-xl border border-primary/20 bg-background/70 px-4 py-2.5 text-sm outline-none focus:border-primary/50"
            />
          </label>

          <div>
            <span className="text-sm font-medium text-foreground">{c.settingLanguage}</span>
            <div className="mt-2 flex gap-2">
              {(["zh", "en"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLanguage(l)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition ${
                    language === l
                      ? "border-primary/50 bg-primary/15 text-primary"
                      : "border-primary/15 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {l === "zh" ? "中文" : "English"}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-3 text-sm text-muted-foreground">
            <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} />
            <span>{c.settingParticipate}</span>
          </label>

          <label className="flex items-center gap-3 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={!paused}
              onChange={(e) => setPaused(!e.target.checked)}
            />
            <span>{c.settingReceive}</span>
          </label>

          <Button
            disabled={save.isPending}
            onClick={async () => {
              await save.mutateAsync({
                alias: alias.trim() || null,
                academy: profile?.academy ?? null,
                element: profile?.element ?? null,
                avatarUrl: profile?.avatarUrl ?? null,
                quote: quote.trim() || null,
                language,
                optIn,
                paused,
              });
              toast.success(c.saved);
            }}
          >
            {save.isPending ? c.sending : c.save}
          </Button>
        </section>
      )}
    </main>
  );
}
