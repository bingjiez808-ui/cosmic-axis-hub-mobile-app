// @ts-expect-error bun:test
import { describe, expect, it } from "bun:test";

import { canonicalUserPair, createInMemoryFriendsRepo } from "./friends-repo";

describe("friends-repo (in-memory contract)", () => {
  it("canonical pair orders lexicographically and is order-independent", () => {
    expect(canonicalUserPair("bob", "alice")).toEqual(["alice", "bob"]);
    expect(canonicalUserPair("alice", "bob")).toEqual(["alice", "bob"]);
  });

  it("invite acceptance creates a canonical friendship", async () => {
    const r = createInMemoryFriendsRepo();
    const inv = await r.createInvite("user-a");
    const { friendship } = await r.acceptInvite(inv.code, "user-b");
    expect(friendship.aUserId).toBe("user-a");
    expect(friendship.bUserId).toBe("user-b");
    expect(await r.areFriends("user-a", "user-b")).toBe(true);
    expect(await r.areFriends("user-b", "user-a")).toBe(true);
  });

  it("cannot self-invite / self-accept", async () => {
    const r = createInMemoryFriendsRepo();
    await expect(r.createInvite("u1", { userId: "u1" })).rejects.toThrow();
    const inv = await r.createInvite("u1");
    await expect(r.acceptInvite(inv.code, "u1")).rejects.toThrow();
  });

  it("targeted invite rejects a non-target acceptor", async () => {
    const r = createInMemoryFriendsRepo();
    const inv = await r.createInvite("u1", { userId: "u2" });
    await expect(r.acceptInvite(inv.code, "u3")).rejects.toThrow();
  });

  it("cancelled/rejected invites cannot be accepted", async () => {
    const r = createInMemoryFriendsRepo();
    const inv = await r.createInvite("u1");
    await r.cancelInvite(inv.code, "u1");
    await expect(r.acceptInvite(inv.code, "u2")).rejects.toThrow();
  });

  it("blocking removes friendship and revokes live consents", async () => {
    const r = createInMemoryFriendsRepo();
    const inv = await r.createInvite("u1");
    await r.acceptInvite(inv.code, "u2");
    const c = await r.requestMatch("u1", "u2", "friendship", "chart-1");
    await r.respondMatch(c.id, "u2", "chart-2");
    expect((await r.getConsentById(c.id, "u1"))?.revokedAt).toBeNull();

    await r.block("u1", "u2");
    expect(await r.areFriends("u1", "u2")).toBe(false);
    expect(await r.getConsentById(c.id, "u1")).toBeNull();
  });

  it("match consent stays hidden until both sides consent (surface layer)", async () => {
    const r = createInMemoryFriendsRepo();
    const c = await r.requestMatch("u1", "u2", "friendship", "chart-a");
    expect(c.aConsentedAt).not.toBeNull();
    expect(c.bConsentedAt).toBeNull();
    const both = await r.respondMatch(c.id, "u2", "chart-b");
    expect(both.aConsentedAt).not.toBeNull();
    expect(both.bConsentedAt).not.toBeNull();
  });

  it("revokeMatch immediately invalidates and hides the consent", async () => {
    const r = createInMemoryFriendsRepo();
    const c = await r.requestMatch("u1", "u2", "friendship", "chart-a");
    await r.respondMatch(c.id, "u2", "chart-b");
    await r.revokeMatch(c.id, "u1");
    expect(await r.getConsentById(c.id, "u1")).toBeNull();
    expect(await r.getConsentById(c.id, "u2")).toBeNull();
  });

  it("non-participants cannot revoke or respond", async () => {
    const r = createInMemoryFriendsRepo();
    const c = await r.requestMatch("u1", "u2", "friendship", "chart-a");
    await expect(r.respondMatch(c.id, "u3", "chart-x")).rejects.toThrow();
    await expect(r.revokeMatch(c.id, "u3")).rejects.toThrow();
  });

  it("cannot open two live consents for the same pair+mode", async () => {
    const r = createInMemoryFriendsRepo();
    await r.requestMatch("u1", "u2", "friendship", "chart-a");
    await expect(r.requestMatch("u1", "u2", "friendship", "chart-a")).rejects.toThrow();
  });
});
