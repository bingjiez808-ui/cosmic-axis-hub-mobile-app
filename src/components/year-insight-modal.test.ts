/**
 * YearInsightModal — deterministic, non-AI, portal + a11y invariants.
 * The modal renders in a portal, gates on ESC/backdrop, and only shows
 * conditional / reflective copy driven by (score, theme) — never a
 * fabricated illness, disaster, or investment forecast.
 */
// @ts-expect-error — bun:test is Bun's built-in runner.
import { afterEach, describe, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
if (typeof globalThis.document === "undefined") {
  GlobalRegistrator.register({ url: "http://localhost/", width: 1024, height: 768 });
}

// @ts-expect-error — bun:test is Bun's built-in runner.
import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";

import { YearInsightModal } from "@/components/YearInsightModal";


const activeRoots: Array<{ root: Root; host: HTMLElement }> = [];

async function mount(el: React.ReactElement) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(el);
  });
  activeRoots.push({ root, host });
  return { root, host };
}

afterEach(async () => {
  while (activeRoots.length) {
    const { root, host } = activeRoots.pop()!;
    await act(async () => root.unmount());
    host.remove();
  }
  document.body.style.overflow = "";
});

describe("YearInsightModal — behavior", () => {
  test("renders inside a portal on document.body with role=dialog", async () => {
    await mount(
      React.createElement(YearInsightModal, {
        open: true,
        lang: "zh",
        point: { age: 36, score: 72, theme: "突破 —— 可见度上升", year: 2026 },
        onClose: () => undefined,
      }),
    );
    const dialog = document.querySelector('[data-testid="year-insight-modal"]');
    expect(dialog).toBeTruthy();
    expect(dialog?.getAttribute("role")).toBe("dialog");
    expect(dialog?.getAttribute("aria-modal")).toBe("true");
  });

  test("locks body scroll while open and restores on unmount", async () => {
    document.body.style.overflow = "";
    const { root, host } = await mount(
      React.createElement(YearInsightModal, {
        open: true,
        lang: "en",
        point: { age: 20, score: 40, theme: "learning" },
        onClose: () => undefined,
      }),
    );
    expect(document.body.style.overflow).toBe("hidden");
    await act(async () => root.unmount());
    host.remove();
    activeRoots.pop();
    expect(document.body.style.overflow).toBe("");
  });

  test("ESC calls onClose", async () => {
    let closed = 0;
    await mount(
      React.createElement(YearInsightModal, {
        open: true,
        lang: "zh",
        point: { age: 30, score: 60, theme: "巩固" },
        onClose: () => {
          closed += 1;
        },
      }),
    );
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(closed).toBe(1);
  });

  test("insufficient-data path shows the not-enough-data panel", async () => {
    await mount(
      React.createElement(YearInsightModal, {
        open: true,
        lang: "zh",
        point: { age: 30, score: null, theme: "—" },
        onClose: () => undefined,
      }),
    );
    expect(document.body.textContent ?? "").toContain(
      "缺少完整的出生资料",
    );
  });

  test("reference tier flags itself and shows the disclaimer", async () => {
    await mount(
      React.createElement(YearInsightModal, {
        open: true,
        lang: "en",
        point: {
          age: 42,
          score: 55,
          theme: "steady",
          reference: true,
        },
        onClose: () => undefined,
      }),
    );
    const text = document.body.textContent ?? "";
    expect(text.toLowerCase()).toContain("reference tier");
    expect(text.toLowerCase()).toContain(
      "not medical, legal, financial or life-decision advice",
    );
  });

  test("does not render when closed", async () => {
    await mount(
      React.createElement(YearInsightModal, {
        open: false,
        lang: "zh",
        point: { age: 20, score: 50, theme: "开门" },
        onClose: () => undefined,
      }),
    );
    expect(document.querySelector('[data-testid="year-insight-modal"]')).toBeNull();
  });
});

describe("YearInsightModal — source-level safety invariants", () => {
  const SRC = readFileSync("src/components/YearInsightModal.tsx", "utf8");

  // Strip block + line comments so a "we never diagnose" doc-comment
  // never trips a forbidden-word scan; the check is about user-visible
  // strings, not documentation about the rules.
  const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

  test("no forbidden certainty / medical / financial forecast copy", () => {
    for (const p of [
      /diagnos/i,
      /guarantee/i,
      /surely\s+will/i,
      /(?:certain|guaranteed)\s+(?:profit|return|loss|death)/i,
      /确诊|必然|必定|保证盈利|保证收益|一定会/,
    ]) {
      expect(CODE).not.toMatch(p);
    }
  });


  test("does not call any AI / oracle / server fn", () => {
    expect(SRC).not.toMatch(/fetch\(/);
    expect(SRC).not.toMatch(/askOracle|generateChartOutlook|processNextPremiumChapter|generatePremiumReport/);
  });

  test("renders through a portal", () => {
    expect(SRC).toContain("createPortal");
  });
});
