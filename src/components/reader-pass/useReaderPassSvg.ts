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

function backSvg(data: ReaderPassData, isZh: boolean): string {
  // The back always keeps the deep-green / gold library livery so the flip
  // never reveals a white or transparent face.
  const frame = "#c9a95c";
  const ink = "#eee3c2";
  const inkSoft = "rgba(238,227,194,0.66)";
  const identity = isZh ? data.identityZh : data.identityEn;
  const displayName = data.isSignedIn
    ? data.displayName
    : isZh
      ? "访客读者"
      : "Guest Reader";
  const fields: Array<[string, string]> = isZh
    ? [
        ["持证读者", displayName],
        ["读者等级", identity],
        ["借阅编号", data.readerNumber],
        ["入馆状态", "已入馆"],
      ]
    : [
        ["Reader", displayName],
        ["Level", identity],
        ["Reader No.", data.readerNumber],
        ["Status", "Admitted"],
      ];
  const motto = isZh
    ? "这张卡只记录你的阅读，不定义你的命运。"
    : "This card records your reading, not your fate.";
  const flipHint = isZh ? "点击卡片翻回正面" : "Tap the card to flip back";

  // Decorative pseudo-barcode derived from the display number only.
  const seed = data.readerNumber;
  const bars = Array.from({ length: 46 })
    .map((_, i) => {
      const code = seed.charCodeAt(i % seed.length) + i * 7;
      const w = 3 + (code % 4) * 2;
      const x = 130 + i * 16;
      return `<rect x="${x}" y="0" width="${w}" height="46" fill="${frame}" opacity="${0.35 + (code % 5) * 0.09}"/>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <linearGradient id="backbg" x1="0.1" y1="0" x2="0.9" y2="1">
      <stop offset="0" stop-color="#13251E"/>
      <stop offset="0.55" stop-color="#0A1712"/>
      <stop offset="1" stop-color="#07110D"/>
    </linearGradient>
    <radialGradient id="backglow" cx="0.72" cy="0.2" r="0.42">
      <stop offset="0" stop-color="#C9A95C" stop-opacity="0.14"/>
      <stop offset="1" stop-color="#C9A95C" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#backbg)"/>
  <rect width="${W}" height="${H}" fill="url(#backglow)"/>

  <!-- Inner gold hairline frames -->
  <rect x="10" y="10" width="${W - 20}" height="${H - 20}" fill="none" stroke="${frame}" stroke-width="3" opacity="0.58"/>
  <rect x="46" y="46" width="${W - 92}" height="${H - 92}" fill="none" stroke="${frame}" stroke-width="1.4" opacity="0.28"/>

  <g font-family="Georgia, 'Times New Roman', serif" text-anchor="middle">
    <text x="${W / 2}" y="132" font-size="30" fill="${ink}" letter-spacing="8">${isZh ? "命运图书馆 · 借阅凭证" : "DESTINY LIBRARY"}</text>
    <text x="${W / 2}" y="176" font-size="18" fill="${inkSoft}" letter-spacing="7">DESTINY LIBRARY · READER PASS</text>
    <line x1="${W * 0.26}" y1="212" x2="${W * 0.74}" y2="212" stroke="${frame}" stroke-width="0.8" opacity="0.5"/>
  </g>

  <!-- Library seal -->
  <g transform="translate(${W / 2}, 430)" opacity="0.32" fill="none" stroke="${frame}">
    <circle r="150" stroke-width="2"/>
    <circle r="126" stroke-width="0.9"/>
    <circle r="70" stroke-width="0.9"/>
    ${Array.from({ length: 24 })
      .map((_, i) => {
        const a = (i * Math.PI) / 12;
        return `<line x1="${(Math.cos(a) * 126).toFixed(1)}" y1="${(Math.sin(a) * 126).toFixed(1)}" x2="${(Math.cos(a) * 150).toFixed(1)}" y2="${(Math.sin(a) * 150).toFixed(1)}" stroke-width="0.8"/>`;
      })
      .join("")}
    <text text-anchor="middle" y="12" font-size="54" font-family="Georgia, serif" fill="${frame}" stroke="none" letter-spacing="6">命</text>
  </g>

  <!-- Reader fields -->
  <g font-family="Georgia, 'Times New Roman', serif">
    ${fields
      .map(([label, value], i) => {
        const y = 700 + i * 118;
        return `
        <g transform="translate(110, ${y})">
          <text font-size="20" fill="${inkSoft}" letter-spacing="6">${escapeXml(label)}</text>
          <text y="52" font-size="40" fill="${ink}">${escapeXml(value)}</text>
          <line x1="0" y1="76" x2="${W - 220}" y2="76" stroke="${frame}" stroke-width="0.5" opacity="0.28"/>
        </g>`;
      })
      .join("")}
  </g>

  <!-- Decorative shelf-mark barcode -->
  <g transform="translate(0, ${H - 250})">
    ${bars}
    <text x="${W / 2}" y="76" text-anchor="middle" font-size="18" font-family="'Courier New', monospace" fill="${inkSoft}" letter-spacing="8">${escapeXml(data.readerNumber)}</text>
  </g>

  <g font-family="Georgia, serif" text-anchor="middle">
    <text x="${W / 2}" y="${H - 116}" font-size="24" fill="${ink}" letter-spacing="2">${escapeXml(motto)}</text>
    <text x="${W / 2}" y="${H - 66}" font-size="17" fill="${inkSoft}" letter-spacing="5">${escapeXml(flipHint)}</text>
  </g>
</svg>`;
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
