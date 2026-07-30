import { describe, expect, it } from "bun:test";

import {
  hallError,
  hallErrorCode,
  hallErrorMessage,
} from "./community-hall-errors";
import { safetyCode, screenCommunityText } from "./community-hall-safety";

describe("hall error vocabulary", () => {
  it("round-trips a thrown code", () => {
    expect(hallErrorCode(hallError("rate_limited"))).toBe("rate_limited");
  });

  it("recognises a bare Postgres error string", () => {
    expect(hallErrorCode(new Error('code "adult_required" raised'))).toBe("adult_required");
  });

  it("falls back to unknown for opaque failures", () => {
    expect(hallErrorCode(new Error("22P02 invalid input syntax"))).toBe("unknown");
  });

  it("never leaks the raw message into user copy", () => {
    const raw = "PGRST301 JWT expired for user 8f1c";
    const zh = hallErrorMessage(new Error(raw), "zh");
    const en = hallErrorMessage(new Error(raw), "en");
    expect(zh).not.toContain("PGRST");
    expect(en).not.toContain("PGRST");
    expect(zh).not.toBe(en);
  });

  it("gives every code both languages", () => {
    for (const code of ["auth_required", "letter_closed", "content_contact"] as const) {
      expect(hallErrorMessage(hallError(code), "zh").length).toBeGreaterThan(4);
      expect(hallErrorMessage(hallError(code), "en").length).toBeGreaterThan(4);
    }
  });
});

describe("safety screening maps to codes", () => {
  it("flags contact details", () => {
    const verdict = screenCommunityText("加我微信 abc123 聊聊");
    expect(verdict.action).toBe("block");
    expect(safetyCode(verdict.categories)).toBe("content_contact");
  });

  it("flags money solicitation", () => {
    const verdict = screenCommunityText("跟我一起投资虚拟币，稳赚");
    expect(verdict.action).toBe("block");
    expect(safetyCode(verdict.categories)).toBe("content_solicitation");
  });

  it("lets an ordinary question through", () => {
    const verdict = screenCommunityText("三十岁换行业会不会太晚了，我该怎么想这件事");
    expect(verdict.action).toBe("allow");
  });
});
