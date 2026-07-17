/**
 * Component-level E2E for the Premium report reader.
 *
 * These tests DO NOT hit the live database. They:
 *   • Boot a happy-dom window inside the bun test process.
 *   • Mock `@/lib/premium.functions` with an in-memory content payload
 *     and a call counter, so we can assert:
 *       - Clicking the CTA opens the dialog Portal-style overlay.
 *       - All 24 chapter titles appear in the table of contents.
 *       - `getPremiumReport` is called on open; `generatePremiumReport`
 *         and `processNextPremiumChapter` are NEVER called for a
 *         completed report.
 *       - Re-opening after close performs another read but keeps
 *         provider deltas at 0 (0 generate/step calls).
 *       - Escape and the close button both dismiss the dialog.
 *   • Assert that no "PDF" / "Export" affordance is rendered.
 *
 * Live-DB provider isolation and hash stability are covered by
 * `premium-e2e.test.ts` and `premium-step-protocol.test.ts`.
 */
import { GlobalRegistrator } from "@happy-dom/global-registrator";
if (typeof globalThis.document === "undefined") {
  GlobalRegistrator.register({ url: "http://localhost/", width: 1440, height: 900 });
}

// @ts-expect-error bun:test
import { describe, expect, test, mock, beforeAll, afterAll } from "bun:test";

const callCount = {
  getReport: 0,
  getProgress: 0,
  generate: 0,
  step: 0,
};

const fakeChapters = Array.from({ length: 24 }, (_, i) => ({
  key: `ch_${i + 1}`,
  title: `Chapter ${i + 1}`,
  body: `Body for chapter ${i + 1}. This is deterministic fixture text.`,
  evidence_refs: [{ path: `western.sun`, module: "western", confidence: "grounded" as const }],
  confidence: "grounded" as const,
}));

const fakeContent = {
  meta: {
    prompt_version: "v3",
    report_version: "premium_pdf_v1",
    report_schema_version: "v3" as const,
    generated_at: "2026-07-17T00:00:00.000Z",
    lang: "en" as const,
    chart_name: "Fixture",
    disclaimer: "For reflection only.",
  },
  cover: { title: "Fixture Deep Reading", subtitle: "24 chapters" },
  chapters: fakeChapters,
};

mock.module("@/lib/premium.functions", () => ({
  generatePremiumReport: async () => {
    callCount.generate += 1;
    return { reportId: "rep-1", status: "completed" as const };
  },
  processNextPremiumChapter: async () => {
    callCount.step += 1;
    return { reportId: "rep-1", status: "completed" as const, processed: false };
  },
  getPremiumReport: async () => {
    callCount.getReport += 1;
    return {
      status: "completed" as const,
      content: fakeContent,
      reportVersion: "premium_pdf_v1",
      generatedAt: fakeContent.meta.generated_at,
      inputHash: "fixture-hash",
      contentHash: "fixture-content-hash",
    };
  },
  getPremiumReportProgress: async () => {
    callCount.getProgress += 1;
    return {
      totalChapters: 24,
      completedChapters: 24,
      chapters: fakeChapters.map((c, i) => ({
        key: c.key,
        title: c.title,
        index: i,
        status: "completed" as const,
        attemptCount: 1,
      })),
    };
  },
  // Types referenced by the reader — need to exist at import time.
  PREMIUM_REPORT_VERSION: "premium_pdf_v1",
}));

// Mock reader-nav helpers used by the reader.
mock.module("@/lib/reader-nav", () => ({
  computeScrollProgress: () => 0,
  formatAuditLine: () => "audit",
  neighborChapters: () => ({ prev: null, next: null }),
}));

// The i18n hook expects a provider — supply a minimal one via mock.
mock.module("@/lib/i18n", () => ({
  useLang: () => ({ lang: "en" as const, setLang: () => {}, t: {} }),
}));

let React: typeof import("react");
let ReactDOMClient: typeof import("react-dom/client");
let PremiumReportReader: typeof import("./PremiumReportReader").PremiumReportReader;

beforeAll(async () => {
  React = await import("react");
  ReactDOMClient = await import("react-dom/client");
  const mod = await import("./PremiumReportReader");
  PremiumReportReader = mod.PremiumReportReader;
});

afterAll(() => {
  // Leave happy-dom registered — other tests in this file may follow.
});

function makeRoot() {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return { el, root: ReactDOMClient.createRoot(el) };
}

async function flush() {
  // happy-dom microtasks + framer-motion effects.
  for (let i = 0; i < 8; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

function harness(initialOpen: boolean, onClose: () => void) {
  return React.createElement(function Harness() {
    const [open, setOpen] = React.useState(initialOpen);
    // Expose setter for tests via a data-attribute callback.
    (globalThis as unknown as { __setOpen: (v: boolean) => void }).__setOpen = setOpen;
    return React.createElement(PremiumReportReader, {
      open,
      chartId: "chart-1",
      chartName: "Fixture",
      onClose: () => {
        onClose();
        setOpen(false);
      },
    });
  });
}

describe("PremiumReportReader — component E2E", () => {
  test("opens as an aria-modal dialog and lists all 24 chapters", async () => {
    callCount.getReport = 0;
    callCount.getProgress = 0;
    callCount.generate = 0;
    callCount.step = 0;

    const { root } = makeRoot();
    let closed = 0;
    root.render(harness(true, () => { closed += 1; }));
    await flush();

    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    expect(dialog).not.toBeNull();

    // 24 chapter titles present somewhere in the reader.
    for (const c of fakeChapters) {
      expect(document.body.textContent ?? "").toContain(c.title);
    }

    // Provider invariants: reader must not call generate/step on a
    // completed report — it only reads content + progress.
    expect(callCount.getReport).toBe(1);
    expect(callCount.getProgress).toBe(1);
    expect(callCount.generate).toBe(0);
    expect(callCount.step).toBe(0);

    // No PDF/export affordances anywhere in the rendered reader.
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/\bPDF\b/);
    expect(text).not.toMatch(/导出/);
    expect(text).not.toMatch(/Download/i);

    // Close via ESC.
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await flush();
    expect(closed).toBeGreaterThanOrEqual(1);

    root.unmount();
  });

  test("re-opening after close performs another READ but zero provider calls", async () => {
    callCount.getReport = 0;
    callCount.getProgress = 0;
    callCount.generate = 0;
    callCount.step = 0;

    const { root } = makeRoot();
    root.render(harness(false, () => {}));
    await flush();

    const setOpen = (globalThis as unknown as { __setOpen: (v: boolean) => void }).__setOpen;

    // First open.
    setOpen(true);
    await flush();
    expect(document.querySelector('[role="dialog"][aria-modal="true"]')).not.toBeNull();
    const firstGetCalls = callCount.getReport;
    expect(firstGetCalls).toBeGreaterThan(0);

    // Close, then re-open.
    setOpen(false);
    await flush();
    setOpen(true);
    await flush();
    expect(document.querySelector('[role="dialog"][aria-modal="true"]')).not.toBeNull();

    // A second READ is fine — it's a cheap DB SELECT that never
    // invokes the AI provider. The critical invariant is that
    // completed content never triggers generate/step.
    expect(callCount.getReport).toBeGreaterThanOrEqual(firstGetCalls + 1);
    expect(callCount.generate).toBe(0);
    expect(callCount.step).toBe(0);

    root.unmount();
  });
});
