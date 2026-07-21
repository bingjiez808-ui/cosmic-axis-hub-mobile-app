import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import {
  createInMemoryFriendsRepo,
  type FriendInvite,
  type Friendship,
} from "@/lib/friends-repo";
import { ensureSocialPreviewAllowed } from "@/experiences/daily-room/route-guard";
import { SocialConsentGate, useSocialConsent } from "@/experiences/daily-room/social-consent";
import { useLang } from "@/lib/i18n";
import { useDaily, useFormatDate } from "@/lib/i18n-daily";

export const Route = createFileRoute("/_authenticated/me/friends")({
  head: () => ({ meta: [{ name: "robots", content: "noindex,nofollow" }] }),
  beforeLoad: () => {
    ensureSocialPreviewAllowed();
  },
  component: FriendsPage,
});

const repo = createInMemoryFriendsRepo();
const ME = "demo-me";
const PEER = "demo-peer";

type LocalNotification = {
  id: string;
  at: number;
  text: string;
  kind: "invite" | "accept" | "reject" | "block" | "report" | "note" | "revoke";
};

function FriendsPage() {
  const d = useDaily();
  const { lang } = useLang();
  const fmtDate = useFormatDate();
  const consent = useSocialConsent();
  const [tab, setTab] = useState<"friends" | "pending" | "blocks" | "inbox">("friends");
  const [tick, setTick] = useState(0);
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [pending, setPending] = useState<{ incoming: FriendInvite[]; outgoing: FriendInvite[] }>({
    incoming: [],
    outgoing: [],
  });
  const [blocks, setBlocks] = useState<{ blockerId: string; blockedId: string }[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<string | null>(null);
  const [reportCategory, setReportCategory] = useState<string>(d.report_categories[0].id);
  const [reportDetail, setReportDetail] = useState("");
  const [noteTarget, setNoteTarget] = useState<string | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string>(d.note_templates[0].id);
  const [notifications, setNotifications] = useState<LocalNotification[]>([]);

  useEffect(() => {
    void (async () => {
      setFriends(await repo.listFriends(ME));
      setPending(await repo.listPending(ME));
      setBlocks(await repo.listBlocks(ME));
    })();
  }, [tick]);

  function pushNotification(kind: LocalNotification["kind"], text: string) {
    setNotifications((prev) =>
      [{ id: Math.random().toString(36).slice(2, 10), at: Date.now(), text, kind }, ...prev].slice(
        0,
        20,
      ),
    );
  }

  function bump(msg?: string, kind: LocalNotification["kind"] = "note") {
    setTick((t) => t + 1);
    if (msg) {
      setToast(msg);
      pushNotification(kind, msg);
      setTimeout(() => setToast(null), 2200);
    }
  }

  async function seedIncoming() {
    if (!consent.gated) {
      bump(d.toast_need_consent);
      return;
    }
    await repo.createInvite(PEER, { userId: ME });
    bump(d.toast_seeded, "invite");
  }
  async function sendOutgoing() {
    if (!consent.gated) {
      bump(d.toast_need_consent);
      return;
    }
    await repo.createInvite(ME, { userId: PEER });
    bump(d.toast_sent_invite, "invite");
  }

  async function submitReport() {
    if (!reportTarget) return;
    const cat =
      d.report_categories.find((c) => c.id === reportCategory)?.label ?? reportCategory;
    await repo.report(ME, reportTarget, reportCategory, reportDetail || undefined);
    setReportTarget(null);
    setReportDetail("");
    bump(d.toast_report_submitted(cat), "report");
  }

  async function submitNote() {
    if (!noteTarget) return;
    const tmpl = d.note_templates.find((t) => t.id === selectedNoteId);
    setNoteTarget(null);
    bump(d.toast_note_sent((tmpl?.text ?? "").slice(0, 12)), "note");
  }

  return (
    <div className="min-h-screen bg-[#0a0a12] text-amber-50">
      <div className="mx-auto w-full max-w-[900px] px-4 py-8 md:px-8 md:py-12">
        <div className="mb-4 rounded-lg border border-amber-400/30 bg-amber-500/5 px-4 py-2 text-xs text-amber-200/90">
          {d.demo_banner_friends}
        </div>

        <nav
          aria-label={d.nav_today}
          className="mb-6 flex flex-wrap items-center gap-2 text-xs"
        >
          <Link
            to="/me/home"
            className="rounded-full border border-amber-400/25 px-3 py-1 text-amber-200/80 hover:border-amber-300/60"
          >
            {d.nav_today}
          </Link>
          <Link
            to="/me/friends"
            aria-current="page"
            className="rounded-full border border-amber-300 bg-amber-300/10 px-3 py-1 text-amber-100"
          >
            {d.home_secondary_nav_friends}
          </Link>
          <Link
            to="/me/match"
            className="rounded-full border border-amber-400/25 px-3 py-1 text-amber-200/80 hover:border-amber-300/60"
          >
            {d.home_secondary_nav_match}
          </Link>
        </nav>

        <header className="mb-6">
          <h1 className="text-3xl font-serif tracking-wide">{d.friends_title}</h1>
          <p className="mt-2 text-sm text-amber-100/70">{d.friends_subtitle}</p>
        </header>

        <div className="mb-6">
          <SocialConsentGate />
        </div>

        <div
          className={`mb-6 flex flex-wrap gap-2 ${!consent.gated ? "pointer-events-none opacity-40" : ""}`}
          aria-disabled={!consent.gated}
        >
          <button
            type="button"
            onClick={sendOutgoing}
            disabled={!consent.gated}
            className="rounded-full border border-amber-300/40 bg-amber-300/5 px-3 py-1.5 text-xs text-amber-100 hover:bg-amber-300/10 disabled:cursor-not-allowed"
          >
            {d.friends_send_outgoing}
          </button>
          <button
            type="button"
            onClick={seedIncoming}
            disabled={!consent.gated}
            className="rounded-full border border-amber-400/20 px-3 py-1.5 text-xs text-amber-100/80 hover:border-amber-300/60 disabled:cursor-not-allowed"
          >
            {d.friends_seed_incoming}
          </button>
        </div>

        <nav className="mb-4 flex flex-wrap gap-1 border-b border-amber-400/15">
          {(["friends", "pending", "blocks", "inbox"] as const).map((tk) => (
            <button
              key={tk}
              type="button"
              onClick={() => setTab(tk)}
              aria-current={tab === tk ? "page" : undefined}
              className={`border-b-2 px-3 py-2 text-sm ${
                tab === tk
                  ? "border-amber-300 text-amber-100"
                  : "border-transparent text-amber-200/60 hover:text-amber-100"
              }`}
            >
              {tk === "friends"
                ? d.tab_friends(friends.length)
                : tk === "pending"
                  ? d.tab_pending(pending.incoming.length + pending.outgoing.length)
                  : tk === "blocks"
                    ? d.tab_blocks(blocks.length)
                    : d.tab_inbox(notifications.length)}
            </button>
          ))}
        </nav>

        {tab === "friends" && (
          <ul className="divide-y divide-amber-400/10 rounded-xl border border-amber-400/15 bg-black/30">
            {friends.length === 0 && (
              <li className="px-4 py-6 text-sm text-amber-200/60">{d.friends_empty}</li>
            )}
            {friends.map((f) => {
              const other = f.aUserId === ME ? f.bUserId : f.aUserId;
              return (
                <li
                  key={f.id}
                  className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="text-sm">
                    <div className="text-amber-100">{other}</div>
                    <div className="text-xs text-amber-200/50">
                      {d.friends_added_at(fmtDate(new Date(f.createdAt)))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setNoteTarget(other);
                        setSelectedNoteId(d.note_templates[0].id);
                      }}
                      className="rounded-full border border-amber-400/30 px-3 py-1 text-xs text-amber-100 hover:bg-amber-300/10"
                    >
                      {d.friends_send_note}
                    </button>
                    <button
                      type="button"
                      onClick={() => setReportTarget(other)}
                      className="rounded-full border border-amber-400/20 px-3 py-1 text-xs text-amber-100/80 hover:border-amber-300/60"
                    >
                      {d.friends_report}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await repo.removeFriend(ME, other);
                        bump(d.toast_removed);
                      }}
                      className="rounded-full border border-amber-400/20 px-3 py-1 text-xs text-amber-100/80 hover:border-amber-300/60"
                    >
                      {d.friends_remove}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await repo.block(ME, other);
                        bump(d.toast_blocked, "block");
                      }}
                      className="rounded-full border border-rose-400/30 px-3 py-1 text-xs text-rose-200 hover:bg-rose-500/10"
                    >
                      {d.friends_block}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {tab === "pending" && (
          <div className="space-y-6">
            <PendingList
              title={d.friends_pending_incoming}
              items={pending.incoming}
              emptyText={d.friends_pending_incoming_empty}
              lang={lang}
              codeLabel={d.friends_invite_code}
              expiresLabel={d.friends_invite_expires}
              fmtDate={fmtDate}
              actions={(inv) => (
                <>
                  <button
                    type="button"
                    disabled={!consent.gated}
                    onClick={async () => {
                      await repo.acceptInvite(inv.code, ME);
                      bump(d.toast_accepted, "accept");
                    }}
                    className="rounded-full border border-emerald-400/40 px-3 py-1 text-xs text-emerald-200 hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {d.friends_accept}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await repo.rejectInvite(inv.code, ME);
                      bump(d.toast_rejected, "reject");
                    }}
                    className="rounded-full border border-amber-400/20 px-3 py-1 text-xs text-amber-100/80 hover:border-amber-300/60"
                  >
                    {d.friends_decline}
                  </button>
                </>
              )}
            />
            <PendingList
              title={d.friends_pending_outgoing}
              items={pending.outgoing}
              emptyText={d.friends_pending_outgoing_empty}
              lang={lang}
              codeLabel={d.friends_invite_code}
              expiresLabel={d.friends_invite_expires}
              fmtDate={fmtDate}
              actions={(inv) => (
                <button
                  type="button"
                  onClick={async () => {
                    await repo.cancelInvite(inv.code, ME);
                    bump(d.toast_revoked, "revoke");
                  }}
                  className="rounded-full border border-amber-400/20 px-3 py-1 text-xs text-amber-100/80 hover:border-amber-300/60"
                >
                  {d.friends_withdraw}
                </button>
              )}
            />
          </div>
        )}

        {tab === "blocks" && (
          <ul className="divide-y divide-amber-400/10 rounded-xl border border-amber-400/15 bg-black/30">
            {blocks.length === 0 && (
              <li className="px-4 py-6 text-sm text-amber-200/60">{d.blocks_empty}</li>
            )}
            {blocks.map((b, i) => (
              <li
                key={i}
                className="flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="text-amber-100">{b.blockedId}</span>
                <button
                  type="button"
                  onClick={async () => {
                    await repo.unblock(ME, b.blockedId);
                    bump(d.toast_unblocked);
                  }}
                  className="rounded-full border border-amber-400/20 px-3 py-1 text-xs text-amber-100/80 hover:border-amber-300/60"
                >
                  {d.blocks_unblock}
                </button>
              </li>
            ))}
          </ul>
        )}

        {tab === "inbox" && (
          <ul className="divide-y divide-amber-400/10 rounded-xl border border-amber-400/15 bg-black/30">
            {notifications.length === 0 && (
              <li className="px-4 py-6 text-sm text-amber-200/60">{d.inbox_empty}</li>
            )}
            {notifications.map((n) => (
              <li key={n.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <span
                    className={`mr-2 rounded-full border px-2 py-0.5 text-[10px] uppercase ${
                      n.kind === "block" || n.kind === "revoke"
                        ? "border-rose-400/40 text-rose-200"
                        : n.kind === "report"
                          ? "border-amber-400/40 text-amber-200"
                          : "border-emerald-400/30 text-emerald-200"
                    }`}
                  >
                    {n.kind}
                  </span>
                  <span className="text-amber-100/90">{n.text}</span>
                </div>
                <span className="text-xs text-amber-200/50">
                  {new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(n.at))}
                </span>
              </li>
            ))}
          </ul>
        )}

        {reportTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
            <div className="w-full max-w-md rounded-xl border border-amber-400/30 bg-[#12121b] p-6">
              <div className="text-sm text-amber-200/80">{d.report_modal_title(reportTarget)}</div>
              <div className="mt-3 space-y-2">
                {d.report_categories.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-3 rounded-lg border border-amber-400/15 p-2 text-sm text-amber-100/90"
                  >
                    <input
                      type="radio"
                      name="report-cat"
                      value={c.id}
                      checked={reportCategory === c.id}
                      onChange={(e) => setReportCategory(e.target.value)}
                      className="accent-amber-400"
                    />
                    <span>{c.label}</span>
                  </label>
                ))}
              </div>
              <textarea
                value={reportDetail}
                onChange={(e) => setReportDetail(e.target.value.slice(0, 300))}
                placeholder={d.report_detail_placeholder}
                className="mt-3 w-full rounded-lg border border-amber-400/20 bg-black/40 p-2 text-xs text-amber-100 placeholder:text-amber-200/40"
                rows={3}
              />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReportTarget(null)}
                  className="rounded-full border border-amber-400/20 px-3 py-1.5 text-xs text-amber-100/80"
                >
                  {d.cancel}
                </button>
                <button
                  type="button"
                  onClick={submitReport}
                  className="rounded-full border border-rose-400/40 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-100"
                >
                  {d.report_submit}
                </button>
              </div>
            </div>
          </div>
        )}

        {noteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
            <div className="w-full max-w-md rounded-xl border border-amber-400/30 bg-[#12121b] p-6">
              <div className="text-sm text-amber-200/80">{d.note_modal_title(noteTarget)}</div>
              <div className="mt-2 text-xs text-amber-200/60">{d.note_modal_hint}</div>
              <div className="mt-3 space-y-2">
                {d.note_templates.map((tmpl) => (
                  <label
                    key={tmpl.id}
                    className="flex items-start gap-3 rounded-lg border border-amber-400/15 p-2 text-sm text-amber-100/90"
                  >
                    <input
                      type="radio"
                      name="note-tmpl"
                      value={tmpl.id}
                      checked={selectedNoteId === tmpl.id}
                      onChange={(e) => setSelectedNoteId(e.target.value)}
                      className="mt-1 accent-amber-400"
                    />
                    <span>{tmpl.text}</span>
                  </label>
                ))}
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setNoteTarget(null)}
                  className="rounded-full border border-amber-400/20 px-3 py-1.5 text-xs text-amber-100/80"
                >
                  {d.cancel}
                </button>
                <button
                  type="button"
                  onClick={submitNote}
                  className="rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-1.5 text-xs text-amber-100"
                >
                  {d.send}
                </button>
              </div>
            </div>
          </div>
        )}

        {toast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full border border-amber-400/40 bg-black/80 px-4 py-2 text-xs text-amber-100 shadow-lg">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}

function PendingList({
  title,
  items,
  emptyText,
  actions,
  lang,
  codeLabel,
  expiresLabel,
  fmtDate,
}: {
  title: string;
  items: FriendInvite[];
  emptyText: string;
  actions: (inv: FriendInvite) => React.ReactNode;
  lang: "zh" | "en";
  codeLabel: (dir: "in" | "out") => string;
  expiresLabel: (when: string) => string;
  fmtDate: (d: Date | string, tz?: string) => string;
}) {
  void lang;
  return (
    <div>
      <div className="mb-2 text-xs uppercase tracking-widest text-amber-200/70">{title}</div>
      <ul className="divide-y divide-amber-400/10 rounded-xl border border-amber-400/15 bg-black/30">
        {items.length === 0 && (
          <li className="px-4 py-4 text-sm text-amber-200/60">{emptyText}</li>
        )}
        {items.map((inv) => (
          <li
            key={inv.id}
            className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="text-sm">
              <div className="text-amber-100">
                {codeLabel(inv.inviterId === "demo-me" ? "out" : "in")}{" "}
                <code className="text-amber-300/80">{inv.code}</code>
              </div>
              <div className="text-xs text-amber-200/50">
                {expiresLabel(fmtDate(new Date(inv.expiresAt)))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">{actions(inv)}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
