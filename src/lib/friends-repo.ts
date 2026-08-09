/**
 * Friends & chart-match consent — repository contract.
 *
 * Two implementations live behind this interface:
 *   • `createInMemoryFriendsRepo()` — used in tests and in the
 *     `/me/friends` / `/me/match` preview surface until the
 *     migration in `supabase/pending/20260722_friends_and_matches.sql`
 *     is applied.
 *   • Supabase implementation lands in `friends.functions.ts` once
 *     the migration ships. It maps 1:1 to this interface, so the UI
 *     does not change.
 *
 * The interface intentionally forbids free-form chat: it only carries
 * structured invite / friendship / block / report / consent state.
 */

export type FriendId = string;
export type InviteCode = string;

export type FriendInvite = {
  id: string;
  inviterId: string;
  code: InviteCode;
  targetId: string | null;
  status: "pending" | "accepted" | "rejected" | "cancelled" | "expired";
  expiresAt: number;
  createdAt: number;
};

export type Friendship = {
  id: string;
  aUserId: string; // canonical: aUserId < bUserId
  bUserId: string;
  createdAt: number;
  removedAt: number | null;
};

export type Block = {
  id: string;
  blockerId: string;
  blockedId: string;
  createdAt: number;
};

export type FriendReport = {
  id: string;
  reporterId: string;
  reportedId: string;
  category: string;
  detail: string | null;
  createdAt: number;
};

export type MatchMode = "friendship" | "romantic" | "family" | "work";

export type MatchConsent = {
  id: string;
  aUserId: string;
  bUserId: string;
  aChartId: string | null;
  bChartId: string | null;
  mode: MatchMode;
  aConsentedAt: number | null;
  bConsentedAt: number | null;
  revokedAt: number | null;
  resultJson: unknown | null;
  createdAt: number;
};

export interface FriendsRepo {
  // Invites
  createInvite(inviterId: string, targetHint?: { userId?: string }): Promise<FriendInvite>;
  acceptInvite(code: InviteCode, acceptorId: string): Promise<{ friendship: Friendship }>;
  rejectInvite(code: InviteCode, acceptorId: string): Promise<void>;
  cancelInvite(code: InviteCode, inviterId: string): Promise<void>;
  listPending(userId: string): Promise<{ incoming: FriendInvite[]; outgoing: FriendInvite[] }>;

  // Friendships
  listFriends(userId: string): Promise<Friendship[]>;
  removeFriend(userId: string, otherId: string): Promise<void>;

  // Blocks & reports
  block(blockerId: string, blockedId: string, reason?: string): Promise<void>;
  unblock(blockerId: string, blockedId: string): Promise<void>;
  listBlocks(userId: string): Promise<Block[]>;
  report(
    reporterId: string,
    reportedId: string,
    category: string,
    detail?: string,
  ): Promise<FriendReport>;

  // Match consents
  requestMatch(
    fromUserId: string,
    toUserId: string,
    mode: MatchMode,
    fromChartId: string,
  ): Promise<MatchConsent>;
  respondMatch(
    consentId: string,
    responderId: string,
    responderChartId: string,
  ): Promise<MatchConsent>;
  revokeMatch(consentId: string, userId: string): Promise<MatchConsent>;
  listConsents(userId: string): Promise<MatchConsent[]>;
  getConsentById(consentId: string, userId: string): Promise<MatchConsent | null>;

  // Convenience
  areFriends(a: string, b: string): Promise<boolean>;
  isBlocked(a: string, b: string): Promise<boolean>;
}

export function canonicalUserPair(a: string, b: string): [string, string] {
  return a <= b ? [a, b] : [b, a];
}

// ── in-memory implementation ─────────────────────────────────────

function uid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}

function makeCode(): InviteCode {
  const alpha = "abcdefghjkmnpqrstuvwxyz23456789";
  let s = "inv_";
  for (let i = 0; i < 8; i++) s += alpha[Math.floor(Math.random() * alpha.length)];
  return s;
}

export function createInMemoryFriendsRepo(): FriendsRepo {
  const invites: FriendInvite[] = [];
  const friendships: Friendship[] = [];
  const blocks: Block[] = [];
  const reports: FriendReport[] = [];
  const consents: MatchConsent[] = [];

  function ensureNotBlocked(a: string, b: string) {
    const [x, y] = canonicalUserPair(a, b);
    if (blocks.some((bl) => (bl.blockerId === x && bl.blockedId === y) || (bl.blockerId === y && bl.blockedId === x))) {
      throw new Error("blocked_relationship");
    }
  }

  return {
    async createInvite(inviterId, targetHint) {
      if (targetHint?.userId && targetHint.userId === inviterId) throw new Error("self_invite");
      const inv: FriendInvite = {
        id: uid(),
        inviterId,
        code: makeCode(),
        targetId: targetHint?.userId ?? null,
        status: "pending",
        expiresAt: Date.now() + 7 * 24 * 3600 * 1000,
        createdAt: Date.now(),
      };
      invites.push(inv);
      return inv;
    },

    async acceptInvite(code, acceptorId) {
      const inv = invites.find((i) => i.code === code);
      if (!inv) throw new Error("invite_not_found");
      if (inv.status !== "pending") throw new Error("invite_not_pending");
      if (inv.expiresAt < Date.now()) {
        inv.status = "expired";
        throw new Error("invite_expired");
      }
      if (inv.inviterId === acceptorId) throw new Error("self_accept");
      if (inv.targetId && inv.targetId !== acceptorId) throw new Error("not_target");
      ensureNotBlocked(inv.inviterId, acceptorId);

      inv.status = "accepted";
      inv.targetId = acceptorId;

      const [a, b] = canonicalUserPair(inv.inviterId, acceptorId);
      const existing = friendships.find(
        (f) => f.aUserId === a && f.bUserId === b && f.removedAt === null,
      );
      if (existing) return { friendship: existing };
      const fr: Friendship = {
        id: uid(),
        aUserId: a,
        bUserId: b,
        createdAt: Date.now(),
        removedAt: null,
      };
      friendships.push(fr);
      return { friendship: fr };
    },

    async rejectInvite(code, acceptorId) {
      const inv = invites.find((i) => i.code === code);
      if (!inv) throw new Error("invite_not_found");
      if (inv.targetId && inv.targetId !== acceptorId) throw new Error("not_target");
      inv.status = "rejected";
    },

    async cancelInvite(code, inviterId) {
      const inv = invites.find((i) => i.code === code);
      if (!inv) throw new Error("invite_not_found");
      if (inv.inviterId !== inviterId) throw new Error("not_inviter");
      if (inv.status === "pending") inv.status = "cancelled";
    },

    async listPending(userId) {
      const active = invites.filter((i) => i.status === "pending");
      return {
        incoming: active.filter((i) => i.targetId === userId),
        outgoing: active.filter((i) => i.inviterId === userId),
      };
    },

    async listFriends(userId) {
      return friendships.filter(
        (f) => f.removedAt === null && (f.aUserId === userId || f.bUserId === userId),
      );
    },

    async removeFriend(userId, otherId) {
      const [a, b] = canonicalUserPair(userId, otherId);
      const f = friendships.find(
        (x) => x.aUserId === a && x.bUserId === b && x.removedAt === null,
      );
      if (f) f.removedAt = Date.now();
    },

    async block(blockerId, blockedId, reason) {
      if (blockerId === blockedId) throw new Error("self_block");
      if (!blocks.some((b) => b.blockerId === blockerId && b.blockedId === blockedId)) {
        blocks.push({ id: uid(), blockerId, blockedId, createdAt: Date.now() });
      }
      // Blocking removes any existing friendship.
      const [a, b] = canonicalUserPair(blockerId, blockedId);
      const f = friendships.find((x) => x.aUserId === a && x.bUserId === b && x.removedAt === null);
      if (f) f.removedAt = Date.now();
      // And revokes any live consents.
      for (const c of consents) {
        if (c.revokedAt === null && ((c.aUserId === a && c.bUserId === b))) c.revokedAt = Date.now();
      }
      void reason;
    },

    async unblock(blockerId, blockedId) {
      const idx = blocks.findIndex((b) => b.blockerId === blockerId && b.blockedId === blockedId);
      if (idx >= 0) blocks.splice(idx, 1);
    },

    async listBlocks(userId) {
      return blocks.filter((b) => b.blockerId === userId);
    },

    async report(reporterId, reportedId, category, detail) {
      const rep: FriendReport = {
        id: uid(),
        reporterId,
        reportedId,
        category,
        detail: detail ?? null,
        createdAt: Date.now(),
      };
      reports.push(rep);
      return rep;
    },

    async requestMatch(fromUserId, toUserId, mode, fromChartId) {
      if (fromUserId === toUserId) throw new Error("self_match");
      ensureNotBlocked(fromUserId, toUserId);
      const [a, b] = canonicalUserPair(fromUserId, toUserId);
      const live = consents.find(
        (c) => c.aUserId === a && c.bUserId === b && c.mode === mode && c.revokedAt === null,
      );
      if (live) throw new Error("consent_already_open");
      const isA = fromUserId === a;
      const now = Date.now();
      const c: MatchConsent = {
        id: uid(),
        aUserId: a,
        bUserId: b,
        aChartId: isA ? fromChartId : null,
        bChartId: isA ? null : fromChartId,
        mode,
        aConsentedAt: isA ? now : null,
        bConsentedAt: isA ? null : now,
        revokedAt: null,
        resultJson: null,
        createdAt: now,
      };
      consents.push(c);
      return c;
    },

    async respondMatch(consentId, responderId, responderChartId) {
      const c = consents.find((x) => x.id === consentId);
      if (!c) throw new Error("consent_not_found");
      if (c.revokedAt !== null) throw new Error("consent_revoked");
      const isA = responderId === c.aUserId;
      const isB = responderId === c.bUserId;
      if (!isA && !isB) throw new Error("not_participant");
      if (isA) {
        c.aChartId = responderChartId;
        c.aConsentedAt = Date.now();
      } else {
        c.bChartId = responderChartId;
        c.bConsentedAt = Date.now();
      }
      return c;
    },

    async revokeMatch(consentId, userId) {
      const c = consents.find((x) => x.id === consentId);
      if (!c) throw new Error("consent_not_found");
      if (userId !== c.aUserId && userId !== c.bUserId) throw new Error("not_participant");
      c.revokedAt = Date.now();
      c.resultJson = null; // immediately invalidate any cached result
      return c;
    },

    async listConsents(userId) {
      return consents.filter((c) => c.aUserId === userId || c.bUserId === userId);
    },

    async getConsentById(consentId, userId) {
      const c = consents.find((x) => x.id === consentId);
      if (!c) return null;
      if (c.aUserId !== userId && c.bUserId !== userId) return null;
      if (c.revokedAt !== null) return null;
      return c;
    },

    async areFriends(a, b) {
      const [x, y] = canonicalUserPair(a, b);
      return friendships.some(
        (f) => f.aUserId === x && f.bUserId === y && f.removedAt === null,
      );
    },

    async isBlocked(a, b) {
      return blocks.some(
        (bl) =>
          (bl.blockerId === a && bl.blockedId === b) ||
          (bl.blockerId === b && bl.blockedId === a),
      );
    },
  };
}
