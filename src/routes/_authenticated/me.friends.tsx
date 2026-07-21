import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import {
  createInMemoryFriendsRepo,
  type FriendInvite,
  type Friendship,
} from "@/lib/friends-repo";
import { ensureSocialPreviewAllowed } from "@/experiences/daily-room/route-guard";
import { SocialConsentGate, useSocialConsent } from "@/experiences/daily-room/social-consent";

export const Route = createFileRoute("/_authenticated/me/friends")({
  head: () => ({ meta: [{ name: "robots", content: "noindex,nofollow" }] }),
  beforeLoad: () => {
    ensureSocialPreviewAllowed();
  },
  component: FriendsPage,
});

// Shared in-memory repo (per tab). Persists across renders, not across reloads.
const repo = createInMemoryFriendsRepo();
const ME = "demo-me";
const PEER = "demo-peer";

const REPORT_CATEGORIES = [
  { id: "harassment", label: "骚扰或不当言论" },
  { id: "spam", label: "垃圾信息 / 广告" },
  { id: "impersonation", label: "冒充他人身份" },
  { id: "underage", label: "对方可能未满 18 岁" },
  { id: "other", label: "其他违反社区约定的行为" },
];

// Structured note templates (fixed set — no free chat)
const NOTE_TEMPLATES = [
  { id: "greet", text: "很高兴认识你，一起阅读命运图书馆吧。" },
  { id: "thanks", text: "谢谢你接受邀请。" },
  { id: "match_ask", text: "如果你愿意，我们可以尝试一次双方授权的互动适配。" },
  { id: "boundary", text: "希望我们的交流保持在阅读与探讨的边界内。" },
  { id: "pause", text: "最近我需要一些空间，晚点再联系。" },
];

type LocalNotification = {
  id: string;
  at: number;
  text: string;
  kind: "invite" | "accept" | "reject" | "block" | "report" | "note" | "revoke";
};

function FriendsPage() {
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
  const [reportCategory, setReportCategory] = useState<string>(REPORT_CATEGORIES[0].id);
  const [reportDetail, setReportDetail] = useState("");
  const [noteTarget, setNoteTarget] = useState<string | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string>(NOTE_TEMPLATES[0].id);
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
      [
        { id: Math.random().toString(36).slice(2, 10), at: Date.now(), text, kind },
        ...prev,
      ].slice(0, 20),
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
      bump("请先确认年龄与隐私同意");
      return;
    }
    const inv = await repo.createInvite(PEER, { userId: ME });
    void inv;
    bump("已模拟收到一个好友邀请", "invite");
  }
  async function sendOutgoing() {
    if (!consent.gated) {
      bump("请先确认年龄与隐私同意");
      return;
    }
    await repo.createInvite(ME, { userId: PEER });
    bump("已模拟发出一个好友邀请", "invite");
  }

  async function submitReport() {
    if (!reportTarget) return;
    await repo.report(ME, reportTarget, reportCategory, reportDetail || undefined);
    setReportTarget(null);
    setReportDetail("");
    bump(`已提交举报（${reportCategory}）`, "report");
  }

  async function submitNote() {
    if (!noteTarget) return;
    const tmpl = NOTE_TEMPLATES.find((t) => t.id === selectedNoteId);
    setNoteTarget(null);
    bump(`已发送纸条：${tmpl?.text.slice(0, 12)}…`, "note");
  }

  return (
    <div className="min-h-screen bg-[#0a0a12] text-amber-50">
      <div className="mx-auto w-full max-w-[900px] px-4 py-8 md:px-8 md:py-12">
        <div className="mb-4 rounded-lg border border-amber-400/30 bg-amber-500/5 px-4 py-2 text-xs text-amber-200/90">
          DEMO 预览 · 好友与邀请（in-memory 演示，reload 后会清空）· 迁移未执行前不写入云端。
        </div>

        <header className="mb-6">
          <h1 className="text-3xl font-serif tracking-wide">同门 · 好友</h1>
          <p className="mt-2 text-sm text-amber-100/70">
            邀请制好友、结构化纸条、屏蔽、举报 —— 没有自由聊天。加为好友后，才可发起双方授权的命盘匹配。
          </p>
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
            向 demo-peer 发邀请
          </button>
          <button
            type="button"
            onClick={seedIncoming}
            disabled={!consent.gated}
            className="rounded-full border border-amber-400/20 px-3 py-1.5 text-xs text-amber-100/80 hover:border-amber-300/60 disabled:cursor-not-allowed"
          >
            模拟收到一个邀请
          </button>
        </div>

        <nav className="mb-4 flex flex-wrap gap-1 border-b border-amber-400/15">
          {(["friends", "pending", "blocks", "inbox"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              aria-current={tab === t ? "page" : undefined}
              className={`border-b-2 px-3 py-2 text-sm ${
                tab === t
                  ? "border-amber-300 text-amber-100"
                  : "border-transparent text-amber-200/60 hover:text-amber-100"
              }`}
            >
              {t === "friends"
                ? `好友 (${friends.length})`
                : t === "pending"
                  ? `待处理 (${pending.incoming.length + pending.outgoing.length})`
                  : t === "blocks"
                    ? `屏蔽 (${blocks.length})`
                    : `站内通知 (${notifications.length})`}
            </button>
          ))}
        </nav>

        {tab === "friends" && (
          <ul className="divide-y divide-amber-400/10 rounded-xl border border-amber-400/15 bg-black/30">
            {friends.length === 0 && (
              <li className="px-4 py-6 text-sm text-amber-200/60">还没有好友，先发一个邀请吧。</li>
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
                      加为好友 {new Date(f.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setNoteTarget(other);
                        setSelectedNoteId(NOTE_TEMPLATES[0].id);
                      }}
                      className="rounded-full border border-amber-400/30 px-3 py-1 text-xs text-amber-100 hover:bg-amber-300/10"
                    >
                      发送结构化纸条
                    </button>
                    <button
                      type="button"
                      onClick={() => setReportTarget(other)}
                      className="rounded-full border border-amber-400/20 px-3 py-1 text-xs text-amber-100/80 hover:border-amber-300/60"
                    >
                      举报
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await repo.removeFriend(ME, other);
                        bump("已移除好友");
                      }}
                      className="rounded-full border border-amber-400/20 px-3 py-1 text-xs text-amber-100/80 hover:border-amber-300/60"
                    >
                      移除
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await repo.block(ME, other);
                        bump("已屏蔽（同时解除好友与匹配）", "block");
                      }}
                      className="rounded-full border border-rose-400/30 px-3 py-1 text-xs text-rose-200 hover:bg-rose-500/10"
                    >
                      屏蔽
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
              title="收到的邀请"
              items={pending.incoming}
              emptyText="暂无待你处理的邀请。"
              actions={(inv) => (
                <>
                  <button
                    type="button"
                    disabled={!consent.gated}
                    onClick={async () => {
                      await repo.acceptInvite(inv.code, ME);
                      bump("已接受", "accept");
                    }}
                    className="rounded-full border border-emerald-400/40 px-3 py-1 text-xs text-emerald-200 hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    接受
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await repo.rejectInvite(inv.code, ME);
                      bump("已拒绝", "reject");
                    }}
                    className="rounded-full border border-amber-400/20 px-3 py-1 text-xs text-amber-100/80 hover:border-amber-300/60"
                  >
                    拒绝
                  </button>
                </>
              )}
            />
            <PendingList
              title="发出的邀请"
              items={pending.outgoing}
              emptyText="暂无发出中的邀请。"
              actions={(inv) => (
                <button
                  type="button"
                  onClick={async () => {
                    await repo.cancelInvite(inv.code, ME);
                    bump("已撤回", "revoke");
                  }}
                  className="rounded-full border border-amber-400/20 px-3 py-1 text-xs text-amber-100/80 hover:border-amber-300/60"
                >
                  撤回
                </button>
              )}
            />
          </div>
        )}

        {tab === "blocks" && (
          <ul className="divide-y divide-amber-400/10 rounded-xl border border-amber-400/15 bg-black/30">
            {blocks.length === 0 && (
              <li className="px-4 py-6 text-sm text-amber-200/60">屏蔽列表为空。</li>
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
                    bump("已取消屏蔽");
                  }}
                  className="rounded-full border border-amber-400/20 px-3 py-1 text-xs text-amber-100/80 hover:border-amber-300/60"
                >
                  取消屏蔽
                </button>
              </li>
            ))}
          </ul>
        )}

        {tab === "inbox" && (
          <ul className="divide-y divide-amber-400/10 rounded-xl border border-amber-400/15 bg-black/30">
            {notifications.length === 0 && (
              <li className="px-4 py-6 text-sm text-amber-200/60">
                站内通知会在你邀请、接受、举报、屏蔽或发送纸条时出现。
              </li>
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
                  {new Date(n.at).toLocaleTimeString()}
                </span>
              </li>
            ))}
          </ul>
        )}

        {/* Report modal (structured, no free text required) */}
        {reportTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
            <div className="w-full max-w-md rounded-xl border border-amber-400/30 bg-[#12121b] p-6">
              <div className="text-sm text-amber-200/80">举报 · {reportTarget}</div>
              <div className="mt-3 space-y-2">
                {REPORT_CATEGORIES.map((c) => (
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
                placeholder="可选：简要补充（不接受人身攻击、二次骚扰内容）"
                className="mt-3 w-full rounded-lg border border-amber-400/20 bg-black/40 p-2 text-xs text-amber-100 placeholder:text-amber-200/40"
                rows={3}
              />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReportTarget(null)}
                  className="rounded-full border border-amber-400/20 px-3 py-1.5 text-xs text-amber-100/80"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={submitReport}
                  className="rounded-full border border-rose-400/40 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-100"
                >
                  提交举报
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Structured note modal — fixed templates only, no free chat */}
        {noteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
            <div className="w-full max-w-md rounded-xl border border-amber-400/30 bg-[#12121b] p-6">
              <div className="text-sm text-amber-200/80">结构化纸条 · 发送给 {noteTarget}</div>
              <div className="mt-2 text-xs text-amber-200/60">
                仅可从下列模板中选择一条；本平台不提供自由聊天。
              </div>
              <div className="mt-3 space-y-2">
                {NOTE_TEMPLATES.map((t) => (
                  <label
                    key={t.id}
                    className="flex items-start gap-3 rounded-lg border border-amber-400/15 p-2 text-sm text-amber-100/90"
                  >
                    <input
                      type="radio"
                      name="note-tmpl"
                      value={t.id}
                      checked={selectedNoteId === t.id}
                      onChange={(e) => setSelectedNoteId(e.target.value)}
                      className="mt-1 accent-amber-400"
                    />
                    <span>{t.text}</span>
                  </label>
                ))}
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setNoteTarget(null)}
                  className="rounded-full border border-amber-400/20 px-3 py-1.5 text-xs text-amber-100/80"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={submitNote}
                  className="rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-1.5 text-xs text-amber-100"
                >
                  发送
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
}: {
  title: string;
  items: FriendInvite[];
  emptyText: string;
  actions: (inv: FriendInvite) => React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 text-xs uppercase tracking-widest text-amber-200/70">{title}</div>
      <ul className="divide-y divide-amber-400/10 rounded-xl border border-amber-400/15 bg-black/30">
        {items.length === 0 && <li className="px-4 py-4 text-sm text-amber-200/60">{emptyText}</li>}
        {items.map((inv) => (
          <li
            key={inv.id}
            className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="text-sm">
              <div className="text-amber-100">
                {inv.inviterId === "demo-me" ? "→" : "←"} 邀请码{" "}
                <code className="text-amber-300/80">{inv.code}</code>
              </div>
              <div className="text-xs text-amber-200/50">
                有效期至 {new Date(inv.expiresAt).toLocaleString()}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">{actions(inv)}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
