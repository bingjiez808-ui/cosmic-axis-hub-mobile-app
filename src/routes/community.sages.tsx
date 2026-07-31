/**
 * /community/sages — 历代先贤 · the Council of Sages.
 *
 * Pick a distilled historical persona, write to them, and read the answer in
 * their voice. Gated on the 贤者 (Sage) membership; every member also holds
 * three one-time gifts to escalate a letter to a real human reply.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  HallEmpty,
  HallGate,
  HallHeader,
  HallMobileBar,
  HallNav,
  HallSection,
} from "@/experiences/community-hall/HallShell";
import { hallErrorMessage } from "@/lib/community-hall-errors";
import { LETTER_TOPICS, useCommunityHall, type AgeBand, type LetterTopic } from "@/lib/i18n-community-hall";
import { useCommunityProfile } from "@/lib/community-hall-client";
import {
  useAskSage,
  useDeskLetters,
  useRequestHumanReply,
  useSageEntitlement,
} from "@/lib/sage-council-client";
import { SAGE_DOMAIN_LABEL, SAGE_PERSONAS, sageName } from "@/lib/sage-personas";
import { sageSkill, sagesForTopic } from "@/lib/sage-skills";
import "@/experiences/community-hall/hall.css";

const BODY_MIN = 30;
const BODY_MAX = 1200;

export const Route = createFileRoute("/community/sages")({
  head: () => ({
    meta: [
      { title: "历代先贤 · 众生之厅 — Council of Sages | Library of Destiny" },
      {
        name: "description",
        content:
          "把你的问题寄给庄子、王阳明、荣格或弗兰克尔，读一封以其口吻写来的回信。Write to a distilled historical sage and read their answer.",
      },
      { property: "og:title", content: "历代先贤 · 众生之厅" },
      { property: "og:description", content: "以古人的生平与语气，回你此刻的疑问。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: SagesPage,
});

function SagesPage() {
  const c = useCommunityHall();
  const zh = c.lang !== "en";
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-28 sm:px-6 sm:pb-24 sm:pt-32">
      <HallHeader
        title={zh ? "历代先贤" : "The Council of Sages"}
        subtitle={
          zh
            ? "十二位已故的思想者、心学家与心理学者。他们依自己的生平、主张与语气回信——这是对其著作的一次阅读，不是预言。"
            : "Twelve thinkers, all long dead. Each answers from their own documented life, arguments and voice — a reading of their work, never a prophecy."
        }
      />
      <HallNav />
      <HallGate>
        <SageDesk />
      </HallGate>
      <HallMobileBar />
    </main>
  );
}

function SageDesk() {
  const c = useCommunityHall();
  const zh = c.lang !== "en";
  const profile = useCommunityProfile();
  const entitlement = useSageEntitlement();
  const desk = useDeskLetters("sage");
  const ask = useAskSage();
  const human = useRequestHumanReply();

  const [personaId, setPersonaId] = useState<string>(SAGE_PERSONAS[0].id);
  const [topic, setTopic] = useState<LetterTopic | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  const band = (profile.data?.ageBand ?? null) as AgeBand | null;
  const entitled = Boolean(entitlement.data?.entitled);
  const credits = entitlement.data?.credits;
  const length = body.trim().length;

  const matchedIds = topic ? sagesForTopic(topic) : null;
  const visiblePersonas = matchedIds
    ? SAGE_PERSONAS.filter((p) => matchedIds.includes(p.id))
    : SAGE_PERSONAS;

  async function submit() {
    if (!band) return setError(zh ? "需要先完善旅者身份。" : "Complete your traveler identity first.");
    if (length < BODY_MIN) return setError(c.bodyTooShort(BODY_MIN));
    if (length > BODY_MAX) return setError(c.tooLong);
    try {
      await ask.mutateAsync({
        personaId,
        subject: subject.trim() || null,
        body: body.trim(),
        topic: "self",
        targetAgeBand: band,
        lang: zh ? "zh" : "en",
      });
      setSubject("");
      setBody("");
      setError(null);
    } catch (err) {
      setError(hallErrorMessage(err, c.lang));
    }
  }

  return (
    <div className="mt-8 space-y-8">
      <HallSection title={zh ? "选择一位先贤" : "Choose a sage"}>
        <div className="mb-4">
          <p className="mb-2 text-xs text-muted-foreground">
            {zh
              ? "先选你此刻的主题，再看哪几位先贤的本领对得上。"
              : "Pick the topic you carry, then see which sages' skills match it."}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTopic(null)}
              aria-pressed={topic === null}
              className={`hall-tap rounded-full border px-4 py-1.5 text-xs transition ${
                topic === null
                  ? "border-primary/60 bg-primary/15 text-foreground"
                  : "border-primary/20 text-muted-foreground hover:border-primary/40"
              }`}
            >
              {zh ? "全部" : "All"}
            </button>
            {LETTER_TOPICS.map((key) => {
              const active = topic === key;
              const label = c.topics.find((t) => t.key === key)?.label ?? key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTopic(active ? null : key)}
                  aria-pressed={active}
                  className={`hall-tap rounded-full border px-4 py-1.5 text-xs transition ${
                    active
                      ? "border-primary/60 bg-primary/15 text-foreground"
                      : "border-primary/20 text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {visiblePersonas.map((p) => {
            const active = p.id === personaId;
            const skill = sageSkill(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPersonaId(p.id)}
                aria-pressed={active}
                className={`hall-tap rounded-2xl border p-4 text-left transition ${
                  active
                    ? "border-primary/50 bg-primary/10"
                    : "border-primary/15 bg-background/60 hover:border-primary/30"
                }`}
              >
                <span className="block text-sm font-semibold text-foreground">
                  {zh ? p.name.zh : p.name.en}
                </span>
                <span className="mt-0.5 block text-[0.7rem] text-primary/75">
                  {zh ? p.era.zh : p.era.en} · {zh ? SAGE_DOMAIN_LABEL[p.domain].zh : SAGE_DOMAIN_LABEL[p.domain].en}
                </span>
                <span className="mt-2 block text-xs leading-relaxed text-muted-foreground">
                  {zh ? p.blurb.zh : p.blurb.en}
                </span>
                {skill ? (
                  <span className="mt-2 block rounded-lg border border-primary/20 bg-primary/5 px-2 py-1.5 text-[0.7rem] leading-relaxed text-primary/90">
                    <strong className="font-semibold">
                      {zh ? `本领 · ${skill.name.zh}` : `Skill · ${skill.name.en}`}
                    </strong>
                    <span className="mt-0.5 block text-muted-foreground">
                      {zh ? skill.summary.zh : skill.summary.en}
                    </span>
                  </span>
                ) : null}
                <span className="mt-2 block text-[0.7rem] leading-relaxed text-muted-foreground/80">
                  {(zh ? p.goodFor.zh : p.goodFor.en).join(" · ")}
                </span>
              </button>
            );
          })}
        </div>
      </HallSection>

      <HallSection title={zh ? "写一封信" : "Write your letter"}>
        {!entitled ? (
          <div className="hall-paper p-5">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {zh
                ? "让先贤回信需要「贤者」会员。开通即赠 2 次「先贤回信」与 1 次「管理员授权」（管理员亲自回信或委托旅者定向回信）。用完可单独加购：3 元 1 次，10 元 4 次。往来始终匿名，只以旅者身份署名。"
                : "Letters answered by a sage require the Sage membership. It also gifts three personal replies from the librarian, once. Every exchange stays anonymous, signed only with your traveler alias."}
            </p>
            <Button asChild className="hall-tap mt-4">
              <Link to="/me/membership">{zh ? "查看会员权益" : "See membership"}</Link>
            </Button>
          </div>
        ) : (
          <div className="hall-paper space-y-4 p-5">
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={80}
              placeholder={zh ? "一句话说明来意（可留空）" : "A one-line subject (optional)"}
              className="w-full rounded-xl border border-primary/15 bg-background/70 px-4 py-3 text-sm"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              maxLength={BODY_MAX}
              placeholder={
                zh
                  ? `你想问${sageName(personaId, "zh")}什么？写下此刻真实的处境。`
                  : `What would you ask ${sageName(personaId, "en")}? Describe the situation as it is.`
              }
              className="w-full rounded-xl border border-primary/15 bg-background/70 px-4 py-3 text-sm leading-relaxed"
            />
            <p className="text-xs text-muted-foreground">
              {length}/{BODY_MAX}
              {credits
                ? ` · ${zh ? "先贤回信剩余" : "sage replies left"} ${credits.sageRemaining}/${credits.sageGranted} · ${zh ? "管理员授权剩余" : "librarian replies left"} ${credits.remaining}/${credits.granted}`
                : ""}
            </p>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button className="hall-tap" disabled={ask.isPending} onClick={() => void submit()}>
              {ask.isPending
                ? zh
                  ? "先贤正在提笔…"
                  : "The sage is writing…"
                : zh
                  ? "寄给先贤"
                  : "Send to the sage"}
            </Button>
          </div>
        )}
      </HallSection>

      <HallSection title={zh ? "先贤回信" : "Replies from the sages"}>
        {(desk.data ?? []).length === 0 ? (
          <HallEmpty
            text={zh ? "还没有回信。选一位先贤，写下你的第一封信。" : "No letters yet — choose a sage and write your first."}
          />
        ) : (
          <div className="space-y-4">
            {(desk.data ?? []).map((letter) => (
              <article key={letter.letterId} className="hall-paper p-5">
                <p className="text-[0.7rem] text-primary/75">
                  {sageName(letter.personaId, zh ? "zh" : "en")} ·{" "}
                  {new Date(letter.createdAt).toLocaleDateString()}
                </p>
                <h3 className="hall-card-title mt-2">{letter.subject || (zh ? "无题" : "Untitled")}</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">
                  {letter.body}
                </p>
                {letter.replies.map((reply) => (
                  <div key={reply.replyId} className="mt-4 rounded-xl border border-primary/15 bg-background/50 p-4">
                    <p className="text-[0.7rem] text-primary/75">
                      {reply.authorKind === "sage"
                        ? sageName(reply.personaId ?? letter.personaId, zh ? "zh" : "en")
                        : reply.authorKind === "librarian"
                          ? zh
                            ? "图书管理员"
                            : "The librarian"
                          : zh
                            ? "一位旅者"
                            : "A traveler"}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                      {reply.body}
                    </p>
                  </div>
                ))}
                {entitled && (credits?.remaining ?? 0) > 0 ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="hall-tap mt-4"
                    disabled={human.isPending}
                    onClick={() => void human.mutateAsync({ letterId: letter.letterId }).catch(() => {})}
                  >
                    {zh ? "请一位真人再回一次（用 1 次管理员授权）" : "Ask a real person too (uses 1 librarian-authorised reply)"}
                  </Button>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </HallSection>
    </div>
  );
}
