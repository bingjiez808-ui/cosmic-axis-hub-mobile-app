/**
 * Regression coverage for the hero heading typography.
 *
 * The guide-desk hero was refactored to live inside HomeScrollStack, so
 * we no longer assert its exact JSX shape here — only that the
 * CJK-safe utility classes it depends on remain in styles.css, and
 * that the landing route still mounts the entrance + guide stack.
 */
// @ts-expect-error — bun:test is Bun's built-in runner, no npm types shipped.
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const indexSrc = readFileSync(resolve(here, "index.tsx"), "utf8");
const stylesSrc = readFileSync(resolve(here, "../styles.css"), "utf8");

describe("landing route composition", () => {
  it("still mounts the entrance overlay and guide-desk stack", () => {
    expect(indexSrc).toMatch(/LibraryEntrance/);
    expect(indexSrc).toMatch(/HomeScrollStack/);
  });
});

describe("hero typography utilities", () => {
  it("exposes the text-fluid-hero-zh utility with a mobile-safe clamp and nowrap segments", () => {
    expect(stylesSrc).toMatch(/@utility text-fluid-hero-zh/);
    expect(stylesSrc).toMatch(/font-size:\s*clamp\(1\.75rem,\s*8\.4vw,\s*5\.25rem\)/);
    expect(stylesSrc).toMatch(/@utility hero-zh-line[\s\S]*white-space:\s*nowrap/);
  });

  it("applies iOS text-size-adjust so Safari does not upscale the hero", () => {
    expect(stylesSrc).toMatch(/-webkit-text-size-adjust:\s*100%/);
    expect(stylesSrc).toMatch(/\btext-size-adjust:\s*100%/);
  });

  it("declares a Chinese-system font stack for :lang(zh)", () => {
    expect(stylesSrc).toMatch(/:lang\(zh\)/);
    expect(stylesSrc).toMatch(/PingFang SC/);
    expect(stylesSrc).toMatch(/Noto Sans SC/);
  });
});
