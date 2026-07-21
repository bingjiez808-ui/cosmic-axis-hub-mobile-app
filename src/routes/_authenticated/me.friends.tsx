import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import {
  createInMemoryFriendsRepo,
  type FriendInvite,
  type Friendship,
} from "@/lib/friends-repo";

const FLAG_ENABLED =
  typeof import.meta !== "undefined" &&
  (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_ENABLE_DAILY_ROOM === "true";

export const Route = createFileRoute("/_authenticated/me/friends")({
  beforeLoad: () => {
    if (!FLAG_ENABLED) throw redirect({ to: "/" });
  },
  component: FriendsPage,
});

// Shared in-memory repo (per tab). Persists across renders, not across reloads.
const repo = createInMemoryFriendsRepo();
const ME = "demo-me";
const PEER = "demo-peer";

function FriendsPage() {
  const [tab, setTab] = useState<"friends" | "pending" | "blocks">("friends");
  const [tick, setTick] = useState(0);
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [pending, setPending] = useState<{ incoming: FriendInvite[]; outgoing: FriendInvite[] }>({
    incoming: [],
    outgoing: [],
  });
  const [blocks, setBlocks] = useState<{ blockerId: string; blockedId: string }[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setFriends(await repo.listFriends(ME));
      setPending(await repo.listPending(ME));
      setBlocks(await repo.listBlocks(ME));
    })();
  }, [tick]);

  function bump(msg?: string) {
    setTick((t) => t + 1);
    if (msg) {
      setToast(msg);
      setTimeout(() => setToast(null), 2200);
    }
  }

  async function seedIncoming() {
    const inv = await repo.createInvite(PEER, { userId: ME });
    void inv;
    bump("已模拟收到一个好友邀请");
  }
  async function sendOutgoing() {
    await repo.createInvite(ME, { userId: PEER });
    bump("已模拟发出一个好友邀请");
  }

  return (
    <div className="min-h-screen bg-[#0a0a12] text-amber-50">
      <div className="mx-auto w-full max-w-[900px] px-4 py-8 md:px-8 md:py-12">
        <div className="mb-6 rounded-lg border border-amber-400/30 bg-amber-500/5 px-4 py-2 text-xs text-amber-200/90">
          DEMO 预览 · 好友与邀请（in-memory 演示，reload 后会清空）· 迁移未执行前不写入云端。
        </div>

        <header className="mb-6">
          <h1 className="text-3xl font-serif tracking-wide">同门 · 好友</h1>
          <p className="mt-2 text-sm text-amber-100/70">
            邀请制好友、屏蔽、举报 —— 没有自由聊天。好友加进来才可发起双方授权的命盘匹配。
          </p>
        </header>

        <div className="mb-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={sendOutgoing}
            className="rounded-full border border-amber-300/40 bg-amber-300/5 px-3 py-1.5 text-xs text-amber-100 hover:bg-amber-300/10"
          >
            向 demo-peer 发邀请
          </button>
          <button
            type="button"
            onClick={seedIncoming}
            className="rounded-full border border-amber-400/20 px-3 py-1.5 text-xs text-amber-100/80 hover:border-amber-300/60"
          >
            模拟收到一个邀请
          </button>
        </div>

        <nav className="mb-4 flex gap-2 border-b border-amber-400/15">
          {(["friends", "pending", "blocks"] as const).map((t) => (
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
                  : `屏蔽 (${blocks.length})`}
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
                <li key={f.id} className="flex items-center justify-between px-4 py-3">
                  <div className="text-sm">
                    <div className="text-amber-100">{other}</div>
                    <div className="text-xs text-amber-200/50">
                      加为好友 {new Date(f.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex gap-2">
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
                        bump("已屏蔽（同时解除好友与匹配）");
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
                    onClick={async () => {
                      await repo.acceptInvite(inv.code, ME);
                      bump("已接受");
                    }}
                    className="rounded-full border border-emerald-400/40 px-3 py-1 text-xs text-emerald-200 hover:bg-emerald-500/10"
                  >
                    接受
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await repo.rejectInvite(inv.code, ME);
                      bump("已拒绝");
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
                    bump("已撤回");
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
              <li key={i} className="flex items-center justify-between px-4 py-3 text-sm">
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
          <li key={inv.id} className="flex items-center justify-between px-4 py-3">
            <div className="text-sm">
              <div className="text-amber-100">
                {inv.inviterId === "demo-me" ? "→" : "←"} 邀请码{" "}
                <code className="text-amber-300/80">{inv.code}</code>
              </div>
              <div className="text-xs text-amber-200/50">
                有效期至 {new Date(inv.expiresAt).toLocaleString()}
              </div>
            </div>
            <div className="flex gap-2">{actions(inv)}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
