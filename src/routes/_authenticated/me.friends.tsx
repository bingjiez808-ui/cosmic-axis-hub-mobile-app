import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { RelationshipsSubtabs } from "@/components/PersonalWorkspaceNav";
import { PersonalLibraryShell } from "@/components/PersonalLibraryShell";

import {
  blockUser,
  createFriendInvite,
  getFriendsSnapshot,
  markFriendNotesRead,
  redeemFriendInvite,
  removeFriend,
  reportUser,
  respondFriendInvite,
  sendFriendNote,
  unblockUser,
  type FriendsSnapshot,
} from "@/lib/friends.functions";

import { SocialConsentGate, useSocialConsent } from "@/experiences/daily-room/social-consent";
import { useLang } from "@/lib/i18n";
import { useDaily, useFormatDate } from "@/lib/i18n-daily";

import { PersonalShellPending } from "@/experiences/daily-room/personal-shell-pending";
import { DailyRoomError } from "@/experiences/daily-room/fallback";

export const Route = createFileRoute("/_authenticated/me/friends")({
  head: () => ({ meta: [{ name: "robots", content: "noindex,nofollow" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    code: typeof search["code"] === "string" ? (search["code"] as string) : undefined,
  }),
  pendingMs: 0,
  pendingComponent: PersonalShellPending,
  errorComponent: DailyRoomError,
  component: FriendsPage,
});

const EMPTY: FriendsSnapshot = {
  friends: [],
  invites: [],
  blocks: [],
  notes: [],
  notifications: [],
};

function errText(e: unknown, zh: boolean): string {
  const raw = e instanceof Error ? e.message : String(e);
  const map: Record<string, [string, string]> = {
    invite_not_found: ["邀请码不存在", "Invite code not found"],
    invite_not_pending: ["该邀请已被处理", "This invite was already handled"],
    invite_expired: ["邀请码已过期", "Invite code expired"],
    self_invite: ["不能接受自己的邀请码", "You cannot redeem your own code"],
    not_target: ["该邀请不是发给你的", "This invite is not addressed to you"],
    blocked_relationship: ["你与对方处于屏蔽状态", "One of you has blocked the other"],
    not_friends: ["需要先成为好友", "You must be friends first"],
    self_block: ["不能屏蔽自己", "You cannot block yourself"],
  };
  for (const [k, v] of Object.entries(map)) {
    if (raw.includes(k)) return zh ? v[0] : v[1];
  }
  if (raw.includes("RATE_LIMITED")) return zh ? "操作过于频繁，请稍后再试" : "Too many requests, try later";
  return zh ? "操作失败，请稍后再试" : "Something went wrong, try again";
}

function FriendsPage() {
  const d = useDaily();
  const { lang } = useLang();
  const zh = lang === "zh";
  const fmtDate = useFormatDate();
  const consent = useSocialConsent();
  const search = useSearch({ from: "/_authenticated/me/friends" });

  const load = useServerFn(getFriendsSnapshot);
  const create = useServerFn(createFriendInvite);
  const redeem = useServerFn(redeemFriendInvite);
  const respond = useServerFn(respondFriendInvite);
  const remove = useServerFn(removeFriend);
  const block = useServerFn(blockUser);
  const unblock = useServerFn(unblockUser);
  const report = useServerFn(reportUser);
  const note = useServerFn(sendFriendNote);
  const markRead = useServerFn(markFriendNotesRead);

  const [snapshot, setSnapshot] = useState<FriendsSnapshot>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"friends" | "pending" | "notes" | "blocks" | "inbox">("friends");
  const [toast, setToast] = useState<string | null>(null);
  const [myCode, setMyCode] = useState<{ code: string; expiresAt: number } | null>(null);
  const [redeemCode, setRedeemCode] = useState(search.code ?? "");
  const [reportTarget, setReportTarget] = useState<{ userId: string; alias: string } | null>(null);
  const [reportCategory, setReportCategory] = useState<string>(d.report_categories[0]!.id);
  const [reportDetail, setReportDetail] = useState("");
  const [noteTarget, setNoteTarget] = useState<{ userId: string; alias: string } | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string>(d.note_templates[0]!.id);

  const refresh = useCallback(async () => {
    const next = await load({});
    setSnapshot(next);
  }, [load]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const next = await load({});
        if (alive) setSnapshot(next);
      } catch {
        /* surfaced through empty state */
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2400);
  }

  const run = useCallback(
    async (fn: () => Promise<unknown>, okMsg: string) => {
      if (busy) return;
      setBusy(true);
      try {
        await fn();
        await refresh();
        flash(okMsg);
      } catch (e) {
        flash(errText(e, zh));
      } finally {
        setBusy(false);
      }
    },
    [busy, refresh, zh],
  );

  const incoming = useMemo(
    () => snapshot.invites.filter((i) => i.direction === "incoming"),
    [snapshot.invites],
  );
  const outgoing = useMemo(
    () => snapshot.invites.filter((i) => i.direction === "outgoing"),
    [snapshot.invites],
  );
  const unreadNotes = snapshot.notes.filter((n) => n.direction === "incoming" && !n.readAt).length;
  const unreadNotifs = snapshot.notifications.filter((n) => !n.readAt).length;

  const inviteLink = myCode
    ? `${typeof window === "undefined" ? "" : window.location.origin}/me/friends?code=${myCode.code}`
    : "";

  const gated = consent.gated;

  return (
    <PersonalLibraryShell
      active="/me/friends"
      width="narrow"
      kicker={zh ? "关系与适配" : "Relationships"}
      title={d.friends_title}
      intro={d.friends_subtitle}
    >
      <div className="pl-stagger space-y-6">
        <RelationshipsSubtabs current="friends" />

        <div>
          <SocialConsentGate />
        </div>

        {/* Invite console */}
        <section
          className={`pl-panel space-y-4 px-4 py-4 ${gated ? "" : "pointer-events-none opacity-40"}`}
          aria-disabled={!gated}
        >
          <div className="text-xs uppercase tracking-widest text-amber-200/70">
            {zh ? "邀请好友" : "Invite a friend"}
          </div>
          <p className="text-sm text-amber-200/70">
            {zh
              ? "生成一枚一次性邀请码（7 天有效），把链接交给你信任的人；对方确认后即建立好友关系。"
              : "Generate a one-time invite code (valid 7 days) and share the link with someone you trust."}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!gated || busy}
              onClick={() =>
                run(async () => {
                  const res = await create({ data: {} });
                  setMyCode(res);
                }, zh ? "已生成邀请码" : "Invite code created")
              }
              className="pl-pill rounded-full border border-amber-300/50 bg-amber-300/10 px-4 py-2 text-xs text-amber-100 hover:bg-amber-300/20 disabled:cursor-not-allowed"
            >
              {zh ? "生成邀请码" : "Create invite code"}
            </button>
            {myCode && (
              <>
                <code className="rounded-full border border-amber-400/20 px-3 py-1 text-xs text-amber-300/90">
                  {myCode.code}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(inviteLink);
                    flash(zh ? "邀请链接已复制" : "Invite link copied");
                  }}
                  className="rounded-full border border-amber-400/25 px-3 py-1 text-xs text-amber-100/80 hover:border-amber-300/60"
                >
                  {zh ? "复制邀请链接" : "Copy invite link"}
                </button>
                <span className="text-xs text-amber-200/50">
                  {d.friends_invite_expires(fmtDate(new Date(myCode.expiresAt)))}
                </span>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-amber-400/10 pt-4">
            <label className="text-xs text-amber-200/70" htmlFor="friend-code">
              {zh ? "使用邀请码" : "Redeem a code"}
            </label>
            <input
              id="friend-code"
              value={redeemCode}
              onChange={(e) => setRedeemCode(e.target.value)}
              placeholder="inv_xxxxxxxx"
              className="min-w-[12rem] flex-1 rounded-full border border-amber-400/25 bg-black/30 px-4 py-2 text-sm text-amber-100 outline-none placeholder:text-amber-200/30 focus:border-amber-300/60"
            />
            <button
              type="button"
              disabled={!gated || busy || redeemCode.trim().length < 4}
              onClick={() =>
                run(async () => {
                  await redeem({ data: { code: redeemCode.trim() } });
                  setRedeemCode("");
                }, zh ? "已建立好友关系" : "You are now friends")
              }
              className="pl-pill rounded-full border border-emerald-400/40 px-4 py-2 text-xs text-emerald-200 hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {zh ? "确认加为好友" : "Add friend"}
            </button>
          </div>
        </section>

        <nav className="mb-4 flex flex-wrap gap-1 border-b border-amber-400/15">
          {(["friends", "pending", "notes", "blocks", "inbox"] as const).map((tk) => (
            <button
              key={tk}
              type="button"
              onClick={() => {
                setTab(tk);
                if (tk === "notes" || tk === "inbox") {
                  void markRead({}).then(refresh).catch(() => undefined);
                }
              }}
              aria-current={tab === tk ? "page" : undefined}
              data-active={tab === tk ? "true" : "false"}
              className={`pl-underline-tab px-3 py-2 text-sm transition-colors ${
                tab === tk ? "text-amber-100" : "text-amber-200/60 hover:text-amber-100"
              }`}
            >
              {tk === "friends"
                ? d.tab_friends(snapshot.friends.length)
                : tk === "pending"
                  ? d.tab_pending(incoming.length + outgoing.length)
                  : tk === "notes"
                    ? `${zh ? "纸条" : "Notes"} (${unreadNotes || snapshot.notes.length})`
                    : tk === "blocks"
                      ? d.tab_blocks(snapshot.blocks.length)
                      : d.tab_inbox(unreadNotifs || snapshot.notifications.length)}
            </button>
          ))}
        </nav>

        {loading && (
          <div className="pl-panel px-4 py-6 text-sm text-amber-200/60">
            {zh ? "正在翻阅名录…" : "Opening the register…"}
          </div>
        )}

        {!loading && tab === "friends" && (
          <ul className="pl-panel divide-y divide-amber-400/10">
            {snapshot.friends.length === 0 && (
              <li className="px-4 py-6 text-sm text-amber-200/60">{d.friends_empty}</li>
            )}
            {snapshot.friends.map((f) => (
              <li
                key={f.friendshipId}
                className="pl-row flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="text-sm">
                  <div className="text-amber-100">
                    {f.alias}
                    {f.unreadNotes > 0 && (
                      <span className="ml-2 rounded-full border border-emerald-400/40 px-2 py-0.5 text-[10px] text-emerald-200">
                        {zh ? `${f.unreadNotes} 张新纸条` : `${f.unreadNotes} new`}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-amber-200/50">
                    {d.friends_added_at(fmtDate(new Date(f.createdAt)))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNoteTarget({ userId: f.userId, alias: f.alias });
                      setSelectedNoteId(d.note_templates[0]!.id);
                    }}
                    className="rounded-full border border-amber-400/30 px-3 py-1 text-xs text-amber-100 hover:bg-amber-300/10"
                  >
                    {d.friends_send_note}
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportTarget({ userId: f.userId, alias: f.alias })}
                    className="rounded-full border border-amber-400/20 px-3 py-1 text-xs text-amber-100/80 hover:border-amber-300/60"
                  >
                    {d.friends_report}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(() => remove({ data: { userId: f.userId } }), d.toast_removed)}
                    className="rounded-full border border-amber-400/20 px-3 py-1 text-xs text-amber-100/80 hover:border-amber-300/60"
                  >
                    {d.friends_remove}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(() => block({ data: { userId: f.userId } }), d.toast_blocked)}
                    className="rounded-full border border-rose-400/30 px-3 py-1 text-xs text-rose-200 hover:bg-rose-500/10"
                  >
                    {d.friends_block}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {!loading && tab === "pending" && (
          <div className="space-y-6">
            <div>
              <div className="mb-2 text-xs uppercase tracking-widest text-amber-200/70">
                {d.friends_pending_incoming}
              </div>
              <ul className="pl-panel divide-y divide-amber-400/10">
                {incoming.length === 0 && (
                  <li className="px-4 py-4 text-sm text-amber-200/60">
                    {d.friends_pending_incoming_empty}
                  </li>
                )}
                {incoming.map((inv) => (
                  <li
                    key={inv.id}
                    className="pl-row flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="text-sm">
                      <div className="text-amber-100">{inv.counterpartAlias}</div>
                      <div className="text-xs text-amber-200/50">
                        {d.friends_invite_expires(fmtDate(new Date(inv.expiresAt)))}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={!gated || busy}
                        onClick={() =>
                          run(
                            () => respond({ data: { inviteId: inv.id, action: "accept" } }),
                            d.toast_accepted,
                          )
                        }
                        className="rounded-full border border-emerald-400/40 px-3 py-1 text-xs text-emerald-200 hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {d.friends_accept}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          run(
                            () => respond({ data: { inviteId: inv.id, action: "reject" } }),
                            d.toast_rejected,
                          )
                        }
                        className="rounded-full border border-amber-400/20 px-3 py-1 text-xs text-amber-100/80 hover:border-amber-300/60"
                      >
                        {d.friends_decline}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="mb-2 text-xs uppercase tracking-widest text-amber-200/70">
                {d.friends_pending_outgoing}
              </div>
              <ul className="pl-panel divide-y divide-amber-400/10">
                {outgoing.length === 0 && (
                  <li className="px-4 py-4 text-sm text-amber-200/60">
                    {d.friends_pending_outgoing_empty}
                  </li>
                )}
                {outgoing.map((inv) => (
                  <li
                    key={inv.id}
                    className="pl-row flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="text-sm">
                      <div className="text-amber-100">
                        {d.friends_invite_code("out")}{" "}
                        <code className="text-amber-300/80">{inv.code}</code>
                      </div>
                      <div className="text-xs text-amber-200/50">
                        {d.friends_invite_expires(fmtDate(new Date(inv.expiresAt)))}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard?.writeText(
                            `${window.location.origin}/me/friends?code=${inv.code}`,
                          );
                          flash(zh ? "邀请链接已复制" : "Invite link copied");
                        }}
                        className="rounded-full border border-amber-400/25 px-3 py-1 text-xs text-amber-100/80 hover:border-amber-300/60"
                      >
                        {zh ? "复制链接" : "Copy link"}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          run(
                            () => respond({ data: { inviteId: inv.id, action: "cancel" } }),
                            d.toast_revoked,
                          )
                        }
                        className="rounded-full border border-amber-400/20 px-3 py-1 text-xs text-amber-100/80 hover:border-amber-300/60"
                      >
                        {d.friends_withdraw}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {!loading && tab === "notes" && (
          <ul className="pl-panel divide-y divide-amber-400/10">
            {snapshot.notes.length === 0 && (
              <li className="px-4 py-6 text-sm text-amber-200/60">
                {zh
                  ? "还没有纸条。加为好友后，可以从模板中挑一句寄出。"
                  : "No notes yet. Once you are friends, pick a template and send one."}
              </li>
            )}
            {snapshot.notes.map((n) => (
              <li key={n.id} className="pl-row px-4 py-3 text-sm">
                <div className="mb-1 flex items-center gap-2 text-xs text-amber-200/60">
                  <span className="rounded-full border border-amber-400/25 px-2 py-0.5 text-[10px] uppercase">
                    {n.direction === "incoming" ? (zh ? "收到" : "In") : zh ? "寄出" : "Out"}
                  </span>
                  <span>{n.counterpartAlias}</span>
                  <span className="text-amber-200/40">{fmtDate(new Date(n.createdAt))}</span>
                </div>
                <p className="text-amber-100/90">{n.body}</p>
              </li>
            ))}
          </ul>
        )}

        {!loading && tab === "blocks" && (
          <ul className="pl-panel divide-y divide-amber-400/10">
            {snapshot.blocks.length === 0 && (
              <li className="px-4 py-6 text-sm text-amber-200/60">{d.blocks_empty}</li>
            )}
            {snapshot.blocks.map((b) => (
              <li
                key={b.id}
                className="pl-row flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="text-amber-100">{b.alias}</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => unblock({ data: { userId: b.userId } }), d.toast_unblocked)}
                  className="rounded-full border border-amber-400/20 px-3 py-1 text-xs text-amber-100/80 hover:border-amber-300/60"
                >
                  {d.blocks_unblock}
                </button>
              </li>
            ))}
          </ul>
        )}

        {!loading && tab === "inbox" && (
          <ul className="pl-panel divide-y divide-amber-400/10">
            {snapshot.notifications.length === 0 && (
              <li className="px-4 py-6 text-sm text-amber-200/60">{d.inbox_empty}</li>
            )}
            {snapshot.notifications.map((n) => (
              <li key={n.id} className="pl-row flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <span className="mr-2 rounded-full border border-amber-400/30 px-2 py-0.5 text-[10px] uppercase text-amber-200/80">
                    {n.type === "friend_invite_accepted"
                      ? zh
                        ? "好友"
                        : "friend"
                      : zh
                        ? "纸条"
                        : "note"}
                  </span>
                  <span className="text-amber-100/90">
                    {n.type === "friend_invite_accepted"
                      ? zh
                        ? `${n.payload.alias ?? ""} 接受了你的邀请`
                        : `${n.payload.alias ?? "Someone"} accepted your invite`
                      : zh
                        ? `${n.payload.alias ?? ""} 寄来一张纸条：${n.payload.preview ?? ""}`
                        : `${n.payload.alias ?? "A friend"} sent a note: ${n.payload.preview ?? ""}`}
                  </span>
                </div>
                <span className="text-xs text-amber-200/40">{fmtDate(new Date(n.createdAt))}</span>
              </li>
            ))}
          </ul>
        )}

        {toast && (
          <div
            role="status"
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-amber-400/40 bg-black/80 px-5 py-2 text-sm text-amber-100 shadow-lg"
          >
            {toast}
          </div>
        )}

        {/* Report dialog */}
        {reportTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-md rounded-2xl border border-amber-400/25 bg-[#0d0b08] p-5">
              <h2 className="mb-3 text-base text-amber-100">
                {d.report_modal_title(reportTarget.alias)}
              </h2>
              <div className="space-y-2">
                {d.report_categories.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm text-amber-100/90">
                    <input
                      type="radio"
                      name="report-category"
                      value={c.id}
                      checked={reportCategory === c.id}
                      onChange={() => setReportCategory(c.id)}
                    />
                    {c.label}
                  </label>
                ))}
              </div>
              <textarea
                value={reportDetail}
                onChange={(e) => setReportDetail(e.target.value)}
                placeholder={d.report_detail_placeholder}
                rows={3}
                className="mt-3 w-full rounded-xl border border-amber-400/25 bg-black/40 p-3 text-sm text-amber-100 outline-none focus:border-amber-300/60"
              />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReportTarget(null)}
                  className="rounded-full border border-amber-400/20 px-4 py-1.5 text-xs text-amber-100/80"
                >
                  {zh ? "取消" : "Cancel"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    const target = reportTarget;
                    const cat =
                      d.report_categories.find((c) => c.id === reportCategory)?.label ?? reportCategory;
                    setReportTarget(null);
                    setReportDetail("");
                    void run(
                      () =>
                        report({
                          data: {
                            userId: target.userId,
                            category: reportCategory,
                            detail: reportDetail || undefined,
                          },
                        }),
                      d.toast_report_submitted(cat),
                    );
                  }}
                  className="rounded-full border border-rose-400/40 px-4 py-1.5 text-xs text-rose-200 hover:bg-rose-500/10"
                >
                  {d.report_submit}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Note dialog */}
        {noteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-md rounded-2xl border border-amber-400/25 bg-[#0d0b08] p-5">
              <h2 className="mb-1 text-base text-amber-100">
                {d.note_modal_title(noteTarget.alias)}
              </h2>
              <p className="mb-3 text-xs text-amber-200/60">{d.note_modal_hint}</p>
              <div className="space-y-2">
                {d.note_templates.map((t) => (
                  <label key={t.id} className="flex items-start gap-2 text-sm text-amber-100/90">
                    <input
                      type="radio"
                      name="note-template"
                      value={t.id}
                      checked={selectedNoteId === t.id}
                      onChange={() => setSelectedNoteId(t.id)}
                      className="mt-1"
                    />
                    {t.text}
                  </label>
                ))}
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setNoteTarget(null)}
                  className="rounded-full border border-amber-400/20 px-4 py-1.5 text-xs text-amber-100/80"
                >
                  {zh ? "取消" : "Cancel"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    const target = noteTarget;
                    const tmpl = d.note_templates.find((t) => t.id === selectedNoteId);
                    setNoteTarget(null);
                    void run(
                      () =>
                        note({
                          data: {
                            userId: target.userId,
                            templateId: selectedNoteId,
                            body: tmpl?.text ?? "",
                          },
                        }),
                      d.toast_note_sent((tmpl?.text ?? "").slice(0, 12)),
                    );
                  }}
                  className="rounded-full border border-amber-300/50 bg-amber-300/10 px-4 py-1.5 text-xs text-amber-100 hover:bg-amber-300/20"
                >
                  {zh ? "寄出纸条" : "Send note"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PersonalLibraryShell>
  );
}
