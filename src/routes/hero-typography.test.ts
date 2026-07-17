/**
 * Regression coverage for the hero heading typography.
 *
 * Guards the iPhone-16 (393px) orphan-glyph bug: the Chinese hero title
 * must render as exactly two semantic block spans — "每一种文明，都在追问"
 * and "同一个问题。" — never as a naive `<br />` split that lets the
 * browser wrap a single character onto its own line. English keeps the
 * same block-span structure so both languages share one layout contract.
 */
// @ts-expect-error — bun:test is Bun's built-in runner, no npm types shipped.
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const indexSrc = readFileSync(resolve(here, "index.tsx"), "utf8");
const stylesSrc = readFileSync(resolve(here, "../styles.css"), "utf8");

describe("hero typography", () => {
  it("renders the hero h1 as two block spans, not a raw <br />", () => {
    expect(indexSrc).toMatch(/data-testid="hero-h1"/);
    // No raw <br /> in the h1 payload — segmentation is via spans instead.
    const h1Block = indexSrc.slice(
      indexSrc.indexOf('data-testid="hero-h1"'),
      indexSrc.indexOf("</motion.h1>"),
    );
    expect(h1Block).not.toMatch(/<br\s*\/?>/i);
    expect(h1Block).toMatch(/t\.hero_h1_a/);
    expect(h1Block).toMatch(/t\.hero_h1_b/);
  });

  it("switches to the CJK-tuned utility when lang === 'zh'", () => {
    expect(indexSrc).toMatch(/isZh\s*\?\s*"text-fluid-hero-zh"\s*:\s*"text-fluid-hero"/);
    expect(indexSrc).toMatch(/hero-zh-line/);
  });

  it("exposes the text-fluid-hero-zh utility with a mobile-safe clamp and nowrap segments", () => {
    expect(stylesSrc).toMatch(/@utility text-fluid-hero-zh/);
    // clamp min must stay under ~28px so 10-glyph titles fit a 320px viewport
    // after horizontal padding; the max scales up on desktop.
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
