// @ts-expect-error bun:test
import { describe, it, expect } from "bun:test";
import {
  TICKET_CATEGORIES,
  TICKET_STATUSES,
  TICKET_PRIORITIES,
} from "@/lib/tickets.functions";

describe("tickets vocabulary", () => {
  it("exposes the five allowed categories", () => {
    expect(TICKET_CATEGORIES).toEqual([
      "product",
      "device",
      "order",
      "payment",
      "subscription",
    ]);
  });
  it("covers the ticket lifecycle statuses", () => {
    expect(TICKET_STATUSES).toEqual([
      "new",
      "in_progress",
      "waiting_user",
      "resolved",
      "closed",
    ]);
  });
  it("exposes four priorities including urgent", () => {
    expect(TICKET_PRIORITIES).toContain("urgent");
    expect(TICKET_PRIORITIES).toContain("normal");
  });
});
