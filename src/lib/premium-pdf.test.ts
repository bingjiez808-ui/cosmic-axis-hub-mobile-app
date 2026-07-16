/**
 * Premium ¥79 PDF renderer unit tests.
 *
 * The server functions themselves depend on Supabase + AI Gateway and
 * are covered by E2E; here we assert the pure-helper contract of the
 * PDF renderer:
 *   - Refuses to render CJK content instead of producing broken PDFs.
 *   - Emits a valid PDF byte stream for English content.
 */
// @ts-expect-error — bun:test is Bun's built-in runner.
import { describe, expect, test } from "bun:test";

import { renderPremiumPdf } from "./premium-pdf.server";

const baseContent = (lang: "en" | "zh") => ({
  meta: {
    prompt_version: "v1",
    report_version: "premium_pdf_v1",
    generated_at: new Date().toISOString(),
    lang,
    chart_name: "Test Subject",
    disclaimer: "For reflection only.",
  },
  cover: { title: "Test Report", subtitle: "Sample" },
  chapters: [
    { key: "executive_summary", title: "Executive Summary", body: "A single line of summary." },
    { key: "character", title: "Character", body: "Warm and steady, with a long time-horizon." },
  ],
});

describe("renderPremiumPdf", () => {
  test("refuses to render CJK reports (no font configured)", async () => {
    let threw = false;
    try {
      await renderPremiumPdf(baseContent("zh"));
    } catch (err) {
      threw = true;
      expect(String((err as Error).message)).toMatch(/cjk_font_not_configured/);
    }
    expect(threw).toBe(true);
  });

  test("produces a valid PDF byte stream for English content", async () => {
    const bytes = await renderPremiumPdf(baseContent("en"));
    expect(bytes.byteLength).toBeGreaterThan(500);
    // PDF magic header.
    const head = String.fromCharCode(...bytes.slice(0, 4));
    expect(head).toBe("%PDF");
  });
});
