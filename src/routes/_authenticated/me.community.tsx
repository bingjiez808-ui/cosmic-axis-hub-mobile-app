import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PersonalWorkspaceNav } from "@/components/PersonalWorkspaceNav";
import { Button } from "@/components/ui/button";
import { useCommunityProfile, useSaveCommunityProfile } from "@/lib/community-hall-client";
import { EntryNotesSection } from "@/experiences/community-hall/EntryNotes";
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

      {/* ── Privacy promise + the optional entry notes side room ── */}
      <section className="mt-8 rounded-2xl border border-primary/12 bg-background/40 p-5">
        <h2 className="text-sm font-semibold text-foreground">{c.privacyTitle}</h2>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
          {c.privacyPoints.map((point) => (
            <li key={point}>· {point}</li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-muted-foreground">{c.entryNotesHint}</p>
        <details className="mt-3 rounded-xl border border-primary/12 p-4">
          <summary className="cursor-pointer text-sm font-medium text-primary">
            {c.entryNotes}
          </summary>
          <div className="mt-4">
            <EntryNotesSection />
          </div>
        </details>
      </section>

      {/* ── Round 4 · batch D: member-initiated data erasure ── */}
      <DangerZone />
    </main>
  );
}

function DangerZone() {
  const c = useCommunityHall();
  const erase = useDeleteMyCommunityData();
  const [confirming, setConfirming] = useState(false);

  return (
    <section className="mt-8 rounded-2xl border border-destructive/25 bg-destructive/5 p-5">
      <h2 className="text-sm font-semibold text-foreground">{c.dataTitle}</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{c.dataBody}</p>
      {confirming ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-sm text-destructive">{c.dataConfirm}</span>
          <Button
            variant="destructive"
            size="sm"
            disabled={erase.isPending}
            onClick={async () => {
              await erase.mutateAsync();
              setConfirming(false);
              toast.success(c.dataDone);
            }}
          >
            {erase.isPending ? c.sending : c.dataDelete}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
            {c.cancel}
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="mt-4 border-destructive/40 text-destructive hover:bg-destructive/10"
          onClick={() => setConfirming(true)}
        >
          {c.dataDelete}
        </Button>
      )}
    </section>
  );
}
