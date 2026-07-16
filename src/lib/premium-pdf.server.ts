/**
 * Server-side PDF renderer for the premium ¥99 deep report.
 *
 * Constraints:
 * - Runs inside the Cloudflare Worker runtime — no fs, no native
 *   binaries, no headless browser. We use pdf-lib (pure JS).
 * - pdf-lib's built-in fonts (Helvetica) are Latin-1 only. Chinese
 *   glyphs render as tofu / blank boxes with them, which is worse
 *   than a plain-text handoff. For zh reports we therefore refuse
 *   to render a broken PDF and let the caller mark the row as
 *   "content ready, PDF renderer pending font configuration".
 * - No public URLs are ever produced. The caller uploads the bytes
 *   into the private `premium-pdfs` bucket and hands them out via
 *   short-lived signed URLs.
 *
 * Follow-ups for productionising CJK PDFs (documented, not stubbed
 * as "done"):
 *   1. Upload a Noto Sans SC (Regular + Bold) subset to a private
 *      storage bucket, e.g. `pdf-fonts/noto-sans-sc.ttf`.
 *   2. Add fontkit: `bun add @pdf-lib/fontkit`.
 *   3. Register with pdfDoc.registerFontkit(fontkit) and embed the
 *      TTF fetched via supabaseAdmin.storage.download().
 *   4. Update `pickFontsForLang("zh")` below to return the embedded
 *      TTFs instead of throwing.
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

type Chapter = { key: string; title: string; body: string };
type Content = {
  meta: {
    prompt_version: string;
    report_version: string;
    generated_at: string;
    lang: "en" | "zh";
    chart_name: string | null;
    disclaimer: string;
  };
  cover: { title: string; subtitle: string };
  chapters: Chapter[];
};

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const MARGIN = 56;
const TEXT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function wrapAscii(text: string, font: import("pdf-lib").PDFFont, size: number): string[] {
  const words = text.replace(/\s+/g, " ").split(" ");
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const candidate = current ? `${current} ${w}` : w;
    if (font.widthOfTextAtSize(candidate, size) > TEXT_WIDTH) {
      if (current) lines.push(current);
      // Handle very long tokens by hard-splitting on characters.
      if (font.widthOfTextAtSize(w, size) > TEXT_WIDTH) {
        let chunk = "";
        for (const ch of w) {
          if (font.widthOfTextAtSize(chunk + ch, size) > TEXT_WIDTH) {
            lines.push(chunk);
            chunk = ch;
          } else {
            chunk += ch;
          }
        }
        current = chunk;
      } else {
        current = w;
      }
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Strips characters outside pdf-lib's default WinAnsi glyph set so
 * the PDF renders without "WinAnsi cannot encode" errors.
 */
function toAscii(text: string): string {
  // Replace common CJK punctuation with ASCII equivalents.
  return text
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[—–]/g, "-")
    .replace(/…/g, "...")
    .replace(/[·・]/g, "-")
    .replace(/[^\x20-\x7E\n\t]/g, ""); // drop anything not printable-ASCII
}

export async function renderPremiumPdf(content: Content): Promise<Uint8Array> {
  if (content.meta.lang === "zh") {
    // We do not have a CJK-capable font embedded. Refuse to render a
    // broken PDF; the caller will leave `pdf_storage_path` null.
    throw new Error("cjk_font_not_configured");
  }

  const pdf = await PDFDocument.create();
  pdf.setTitle(content.cover.title);
  pdf.setSubject(`${content.meta.report_version} · ${content.meta.chart_name ?? "personal reading"}`);
  pdf.setCreator("Library of Destiny");
  pdf.setProducer("Library of Destiny");
  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const helvItalic = await pdf.embedFont(StandardFonts.HelveticaOblique);

  const ink = rgb(0.13, 0.11, 0.09); // near-black
  const gold = rgb(0.72, 0.58, 0.24);

  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const newPage = () => {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
  };
  const needSpace = (space: number) => {
    if (y - space < MARGIN + 32) newPage();
  };

  const drawFooter = () => {
    // Deferred to end.
  };

  // -------- Cover
  {
    const title = toAscii(content.cover.title);
    const subtitle = toAscii(content.cover.subtitle);
    y = PAGE_HEIGHT * 0.6;
    const titleSize = 26;
    const w = helvBold.widthOfTextAtSize(title, titleSize);
    page.drawText(title, {
      x: (PAGE_WIDTH - w) / 2,
      y,
      size: titleSize,
      font: helvBold,
      color: gold,
    });
    y -= 30;
    const sw = helvItalic.widthOfTextAtSize(subtitle, 14);
    page.drawText(subtitle, {
      x: (PAGE_WIDTH - sw) / 2,
      y,
      size: 14,
      font: helvItalic,
      color: ink,
    });
    y -= 60;
    const stamp = toAscii(new Date(content.meta.generated_at).toISOString().slice(0, 10));
    const sw2 = helv.widthOfTextAtSize(stamp, 10);
    page.drawText(stamp, {
      x: (PAGE_WIDTH - sw2) / 2,
      y,
      size: 10,
      font: helv,
      color: ink,
    });
    newPage();
  }

  // -------- Table of contents
  {
    page.drawText("Contents", { x: MARGIN, y, size: 20, font: helvBold, color: gold });
    y -= 30;
    for (const [i, ch] of content.chapters.entries()) {
      needSpace(18);
      const line = `${String(i + 1).padStart(2, "0")}.  ${toAscii(ch.title)}`;
      page.drawText(line, { x: MARGIN, y, size: 11, font: helv, color: ink });
      y -= 18;
    }
    newPage();
  }

  // -------- Chapters
  for (const ch of content.chapters) {
    needSpace(60);
    const title = toAscii(ch.title);
    page.drawText(title, { x: MARGIN, y, size: 17, font: helvBold, color: gold });
    y -= 26;
    const paragraphs = toAscii(ch.body).split(/\n\s*\n/);
    for (const para of paragraphs) {
      const wrapped = wrapAscii(para.trim(), helv, 11);
      for (const line of wrapped) {
        needSpace(16);
        page.drawText(line, { x: MARGIN, y, size: 11, font: helv, color: ink });
        y -= 16;
      }
      y -= 8;
    }
    y -= 12;
  }

  // -------- Disclaimer + footer with page numbers
  needSpace(80);
  page.drawText("Disclaimer", { x: MARGIN, y, size: 12, font: helvBold, color: gold });
  y -= 18;
  for (const line of wrapAscii(toAscii(content.meta.disclaimer), helvItalic, 10)) {
    needSpace(14);
    page.drawText(line, { x: MARGIN, y, size: 10, font: helvItalic, color: ink });
    y -= 14;
  }

  const pageCount = pdf.getPageCount();
  const pages = pdf.getPages();
  for (let i = 0; i < pageCount; i += 1) {
    const p = pages[i];
    const label = `${i + 1} / ${pageCount}`;
    const w = helv.widthOfTextAtSize(label, 9);
    p.drawText(label, {
      x: PAGE_WIDTH - MARGIN - w,
      y: MARGIN / 2,
      size: 9,
      font: helv,
      color: ink,
    });
  }

  drawFooter();
  return await pdf.save();
}
