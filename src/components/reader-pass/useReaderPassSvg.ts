/**
 * useReaderPassSvg — generates the front and back faces of the Reader's
 * Pass as static SVG strings, converted to Blob URLs so the 3D card and
 * the 2D fallback can share the same textures. Regenerates only when
 * the underlying data (name / tier / language / chart status) changes;
 * cleans up the URLs on unmount.
 *
 * We deliberately draw at 1024×1440 with generous safety margins so the
 * card's UV atlas doesn't crop important text near the clip / hole.
 */
import { useEffect, useMemo, useState } from "react";
import type { ReaderPassData } from "./useReaderPassData";

const W = 1024;
const H = 1440;

type Palette = {
  bgStart: string;
  bgEnd: string;
  frame: string;
  ink: string;
  inkSoft: string;
  accent: string;
  seal: string;
};

function paletteFor(tier: ReaderPassData["tier"]): Palette {
  if (tier === "oracle") {
    return {
      bgStart: "#181021",
      bgEnd: "#0b0812",
      frame: "#c9a97a",
      ink: "#f1e6c8",
      inkSoft: "#c2b391",
      accent: "#e6c98a",
      seal: "#8b6b3a",
    };
  }
  if (tier === "sage") {
    return {
      bgStart: "#182a20",
      bgEnd: "#0c1712",
      frame: "#d8b872",
      ink: "#f3e6c1",
      inkSoft: "#c9b891",
      accent: "#e8c37a",
      seal: "#7a5a2c",
    };
  }
  // Seeker / Guest — old brass on aged card.
  return {
    bgStart: "#1a2018",
    bgEnd: "#0e1310",
    frame: "#bfa26a",
    ink: "#eadfbe",
    inkSoft: "#b5a684",
    accent: "#d4b878",
    seal: "#8b6a35",
  };
}

function frontSvg(data: ReaderPassData, isZh: boolean): string {
  const p = paletteFor(data.tier);
  const identity = isZh ? data.identityZh : data.identityEn;
  const chartLabel = isZh ? data.chartLabelZh : data.chartLabelEn;
  const heading = isZh ? "读者借阅证" : "Reader's Pass";
  const brand = isZh ? "命运图书馆 · Destiny Library" : "Destiny Library · 命运图书馆";
  const readerLabel = isZh ? "读者" : "Reader";
  const identityLabel = isZh ? "身份" : "Identity";
  const numberLabel = isZh ? "借阅编号" : "Reader No.";
  const chartTitle = isZh ? "主命盘" : "Primary Chart";
  const sealZh = "命运不是判决书";
  const sealEn = "DESTINY IS NOT A VERDICT";
  const displayName = data.isSignedIn ? data.displayName : isZh ? "访客" : "Guest";

  // Astrolabe glyph — thin gold rings.
  const astro = `
    <g transform="translate(${W / 2},${H * 0.44})" opacity="0.55">
      <circle r="130" fill="none" stroke="${p.frame}" stroke-width="1.2"/>
      <circle r="96"  fill="none" stroke="${p.frame}" stroke-width="0.8"/>
      <circle r="60"  fill="none" stroke="${p.frame}" stroke-width="0.8"/>
      <circle r="4"   fill="${p.accent}"/>
      <g stroke="${p.frame}" stroke-width="0.6" opacity="0.7">
        ${Array.from({ length: 12 })
          .map((_, i) => {
            const a = (i * Math.PI) / 6;
            const x1 = Math.cos(a) * 60;
            const y1 = Math.sin(a) * 60;
            const x2 = Math.cos(a) * 130;
            const y2 = Math.sin(a) * 130;
            return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;
          })
          .join("")}
      </g>
      <g fill="${p.accent}" opacity="0.9">
        <circle r="3" cx="0" cy="-130"/>
        <circle r="3" cx="130" cy="0"/>
        <circle r="3" cx="0" cy="130"/>
        <circle r="3" cx="-130" cy="0"/>
      </g>
    </g>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${p.bgStart}"/>
      <stop offset="1" stop-color="${p.bgEnd}"/>
    </linearGradient>
    <pattern id="grain" width="4" height="4" patternUnits="userSpaceOnUse">
      <rect width="4" height="4" fill="${p.bgEnd}"/>
      <circle cx="1" cy="1" r="0.4" fill="${p.frame}" opacity="0.08"/>
    </pattern>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#grain)" opacity="0.35"/>

  <!-- Frame -->
  <rect x="42" y="42" width="${W - 84}" height="${H - 84}" fill="none" stroke="${p.frame}" stroke-width="2"/>
  <rect x="60" y="60" width="${W - 120}" height="${H - 120}" fill="none" stroke="${p.frame}" stroke-width="0.6" opacity="0.7"/>

  <!-- Brand strip -->
  <g font-family="Georgia, 'Times New Roman', serif" fill="${p.inkSoft}">
    <text x="${W / 2}" y="140" text-anchor="middle" font-size="26" letter-spacing="10">${brand}</text>
    <line x1="${W * 0.28}" y1="168" x2="${W * 0.72}" y2="168" stroke="${p.frame}" stroke-width="0.8" opacity="0.6"/>
  </g>

  <!-- Title -->
  <g font-family="Georgia, 'Times New Roman', serif" fill="${p.ink}" text-anchor="middle">
    <text x="${W / 2}" y="240" font-size="68" letter-spacing="14">${heading}</text>
  </g>

  ${astro}

  <!-- Field block -->
  <g font-family="Georgia, 'Times New Roman', serif" fill="${p.ink}">
    <g transform="translate(120, 780)">
      <text font-size="20" fill="${p.inkSoft}" letter-spacing="6">${readerLabel}</text>
      <text y="52" font-size="46">${escapeXml(displayName)}</text>
    </g>
    <g transform="translate(120, 900)">
      <text font-size="20" fill="${p.inkSoft}" letter-spacing="6">${identityLabel}</text>
      <text y="46" font-size="36" fill="${p.accent}">${identity}</text>
    </g>
    <g transform="translate(120, 1000)">
      <text font-size="20" fill="${p.inkSoft}" letter-spacing="6">${numberLabel}</text>
      <text y="46" font-size="34" font-family="'Courier New', monospace">${data.readerNumber}</text>
    </g>
    <g transform="translate(120, 1100)">
      <text font-size="20" fill="${p.inkSoft}" letter-spacing="6">${chartTitle}</text>
      <text y="46" font-size="32">${chartLabel}</text>
    </g>
  </g>

  <!-- Seal -->
  <g transform="translate(${W / 2},${H - 150})" text-anchor="middle" font-family="Georgia, serif">
    <circle r="66" fill="none" stroke="${p.seal}" stroke-width="1.5"/>
    <circle r="52" fill="none" stroke="${p.seal}" stroke-width="0.6" opacity="0.7"/>
    <text y="-6" font-size="20" fill="${p.seal}" letter-spacing="4">${sealZh}</text>
    <text y="22" font-size="11" fill="${p.seal}" letter-spacing="4">${sealEn}</text>
  </g>
</svg>`;
}

function backSvg(_data: ReaderPassData, isZh: boolean): string {
  const p = paletteFor(_data.tier);
  const title = isZh ? "馆内索引" : "Library Index";
  const rows = isZh
    ? ["我的书架", "今日命运", "会员与订单"]
    : ["My Shelf", "Today's Reading", "Membership & Orders"];
  const rowsEn = isZh
    ? ["My Shelf", "Today's Reading", "Membership & Orders"]
    : ["我的书架", "今日命运", "会员与订单"];
  const disclaimer = isZh
    ? "本证仅用于命运图书馆馆内阅读。所有命理解读用于文化娱乐与自我反思,不替代医疗、法律、投资或人生决策。"
    : "For in-library reading only. All destiny readings are for cultural enjoyment and self-reflection — not medical, legal, financial or life advice.";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <linearGradient id="bg2" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${p.bgEnd}"/>
      <stop offset="1" stop-color="${p.bgStart}"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg2)"/>
  <rect x="42" y="42" width="${W - 84}" height="${H - 84}" fill="none" stroke="${p.frame}" stroke-width="2"/>
  <rect x="60" y="60" width="${W - 120}" height="${H - 120}" fill="none" stroke="${p.frame}" stroke-width="0.6" opacity="0.7"/>

  <g font-family="Georgia, serif" text-anchor="middle" fill="${p.ink}">
    <text x="${W / 2}" y="200" font-size="52" letter-spacing="16">${title}</text>
    <line x1="${W * 0.32}" y1="240" x2="${W * 0.68}" y2="240" stroke="${p.frame}" stroke-width="0.8" opacity="0.6"/>
  </g>

  <g font-family="Georgia, serif" fill="${p.ink}">
    ${rows
      .map((row, i) => {
        const y = 380 + i * 200;
        const num = `0${i + 1}`;
        return `
        <g transform="translate(140, ${y})">
          <text font-size="22" fill="${p.inkSoft}" letter-spacing="6">${num}</text>
          <text y="60" font-size="46" fill="${p.ink}">${row}</text>
          <text y="102" font-size="20" fill="${p.inkSoft}" letter-spacing="4">${rowsEn[i]}</text>
          <line x1="0" y1="130" x2="${W - 280}" y2="130" stroke="${p.frame}" stroke-width="0.4" opacity="0.4"/>
        </g>`;
      })
      .join("")}
  </g>

  <g font-family="Georgia, serif" fill="${p.inkSoft}" text-anchor="middle">
    ${wrapText(disclaimer, 34)
      .map((line, i) => `<text x="${W / 2}" y="${H - 160 + i * 26}" font-size="16" letter-spacing="1">${escapeXml(line)}</text>`)
      .join("")}
  </g>
</svg>`;
}

function wrapText(text: string, maxChars: number): string[] {
  // Simple char-count wrap; both CJK and ASCII look OK at 16-20pt.
  const lines: string[] = [];
  let buf = "";
  for (const ch of text) {
    buf += ch;
    if (buf.length >= maxChars && /[\s,。,;·]/.test(ch)) {
      lines.push(buf.trim());
      buf = "";
    }
  }
  if (buf.trim()) lines.push(buf.trim());
  return lines.slice(0, 3);
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toBlobUrl(svg: string): string {
  const blob = new Blob([svg], { type: "image/svg+xml" });
  return URL.createObjectURL(blob);
}

export type ReaderPassSvg = {
  frontUrl: string;
  backUrl: string;
  frontSvgText: string;
  backSvgText: string;
};

export function useReaderPassSvg(data: ReaderPassData, isZh: boolean): ReaderPassSvg {
  const svgs = useMemo(
    () => ({
      front: frontSvg(data, isZh),
      back: backSvg(data, isZh),
    }),
    [data, isZh],
  );

  const [urls, setUrls] = useState<{ frontUrl: string; backUrl: string }>(() => ({
    frontUrl: "",
    backUrl: "",
  }));

  useEffect(() => {
    if (typeof window === "undefined") return;
    const frontUrl = toBlobUrl(svgs.front);
    const backUrl = toBlobUrl(svgs.back);
    setUrls({ frontUrl, backUrl });
    return () => {
      URL.revokeObjectURL(frontUrl);
      URL.revokeObjectURL(backUrl);
    };
  }, [svgs.front, svgs.back]);

  return {
    frontUrl: urls.frontUrl,
    backUrl: urls.backUrl,
    frontSvgText: svgs.front,
    backSvgText: svgs.back,
  };
}
