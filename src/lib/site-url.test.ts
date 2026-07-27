import { describe, it, expect, afterEach, beforeEach } from "vitest";

import {
  getAuthRedirectUrl,
  getPublicSiteUrl,
  isForbiddenAuthHost,
  PUBLIC_PREVIEW_URL,
  sanitizeNextPath,
} from "./site-url";

const originalWindow = globalThis.window;

function setWindow(origin: string, hostname: string) {
  (globalThis as unknown as { window: { location: { origin: string; hostname: string } } }).window = {
    location: { origin, hostname },
  };
}

afterEach(() => {
  if (originalWindow === undefined) delete (globalThis as { window?: unknown }).window;
  else (globalThis as { window: unknown }).window = originalWindow;
});

describe("isForbiddenAuthHost", () => {
  it("rejects id-preview and editor + local hosts", () => {
    expect(isForbiddenAuthHost("id-preview--abc.lovable.app")).toBe(true);
    expect(isForbiddenAuthHost("lovable.dev")).toBe(true);
    expect(isForbiddenAuthHost("beta.lovable.dev")).toBe(true);
    expect(isForbiddenAuthHost("localhost")).toBe(true);
    expect(isForbiddenAuthHost("127.0.0.1")).toBe(true);
  });
  it("allows public preview and custom domains", () => {
    expect(isForbiddenAuthHost("preview--cosmic-axis-hub.lovable.app")).toBe(false);
    expect(isForbiddenAuthHost("cosmic-axis-hub.lovable.app")).toBe(false);
    expect(isForbiddenAuthHost("fatelib.com")).toBe(false);
  });
});

describe("getPublicSiteUrl", () => {
  beforeEach(() => {
    delete (import.meta as unknown as { env: Record<string, string | undefined> }).env
      ?.VITE_PUBLIC_SITE_URL;
  });
  it("falls back to public preview when origin is id-preview", () => {
    setWindow("https://id-preview--abc.lovable.app", "id-preview--abc.lovable.app");
    expect(getPublicSiteUrl()).toBe(PUBLIC_PREVIEW_URL);
  });
  it("uses the public origin as-is", () => {
    setWindow("https://preview--cosmic-axis-hub.lovable.app", "preview--cosmic-axis-hub.lovable.app");
    expect(getPublicSiteUrl()).toBe("https://preview--cosmic-axis-hub.lovable.app");
  });
});

describe("getAuthRedirectUrl", () => {
  it("never contains id-preview or lovable.dev when run from id-preview", () => {
    setWindow("https://id-preview--abc.lovable.app", "id-preview--abc.lovable.app");
    const url = getAuthRedirectUrl("/me/home");
    expect(url).not.toMatch(/id-preview/);
    expect(url).not.toMatch(/lovable\.dev/);
    expect(url.startsWith(PUBLIC_PREVIEW_URL + "/auth/callback")).toBe(true);
    expect(url).toContain("next=%2Fme%2Fhome");
  });
  it("drops unsafe next targets", () => {
    setWindow("https://preview--cosmic-axis-hub.lovable.app", "preview--cosmic-axis-hub.lovable.app");
    expect(getAuthRedirectUrl("//evil.com")).not.toContain("next=");
    expect(getAuthRedirectUrl("https://evil.com")).not.toContain("next=");
    expect(getAuthRedirectUrl("/\\evil")).not.toContain("next=");
  });
});

describe("sanitizeNextPath", () => {
  it("only allows same-origin absolute paths", () => {
    expect(sanitizeNextPath("/me/home")).toBe("/me/home");
    expect(sanitizeNextPath("//evil.com")).toBeUndefined();
    expect(sanitizeNextPath("https://evil.com")).toBeUndefined();
    expect(sanitizeNextPath("/\\evil")).toBeUndefined();
    expect(sanitizeNextPath(null)).toBeUndefined();
  });
});
