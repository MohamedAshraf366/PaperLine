import { unzipSync, strFromU8 } from "fflate";

type PdfProxy = Awaited<ReturnType<typeof import("unpdf").getDocumentProxy>>;

export type ParsedDoc = { text: string; pageCount?: number; pages: string[] };

function clean(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Splits text with no real page breaks into readable, page-sized sections. */
function paginate(text: string, size = 3000): string[] {
  const paragraphs = text.split(/\n{2,}/);
  const pages: string[] = [];
  let current = "";
  for (const p of paragraphs) {
    if (current && (current + "\n\n" + p).length > size) {
      pages.push(current);
      current = p;
    } else {
      current = current ? `${current}\n\n${p}` : p;
    }
  }
  if (current.trim()) pages.push(current);
  return pages.length ? pages : [text];
}

async function parsePdf(bytes: Uint8Array): Promise<ParsedDoc> {
  // Use a single pdf.js build for extraction and OCR — two builds in one
  // process corrupt each other's shared worker state in Node.
  const { definePDFJSModule, extractText, getDocumentProxy } = await import("unpdf");
  await definePDFJSModule(() => import("pdfjs-dist/legacy/build/pdf.mjs"));
  const pdf = await getDocumentProxy(bytes);
  const { text, totalPages } = await extractText(pdf, { mergePages: false });
  const pages = (Array.isArray(text) ? text : [String(text)]).map((t) => clean(String(t)));
  const joined = clean(pages.join("\n\n"));
  if (joined.length >= 20) return { text: joined, pageCount: totalPages ?? pages.length, pages };
  return ocrPdf(pdf, totalPages ?? pages.length);
}

/** Highest number of scanned pages to OCR. */
const MAX_OCR_PAGES = 120;
type ExtractedImage = { data: Uint8ClampedArray; width: number; height: number; channels: number };

/** Picks the largest image on a page; scanned pages are usually a single full-page image. */
function pickLargest(images: ExtractedImage[]): ExtractedImage | null {
  let best: ExtractedImage | null = null;
  for (const img of images) {
    if (!best || img.width * img.height > best.width * best.height) best = img;
  }
  return best;
}

/** Re-encodes raw extracted image pixels into a PNG buffer for Tesseract. */
async function rawToPng(img: ExtractedImage): Promise<Buffer> {
  if (img.channels !== 1 && img.channels !== 3 && img.channels !== 4) {
    throw new Error(`Unsupported image channel count: ${img.channels}`);
  }
  const { createCanvas, ImageData } = await import("@napi-rs/canvas");
  const canvas = createCanvas(img.width, img.height);
  const rgba = new Uint8ClampedArray(img.width * img.height * 4);
  const { data, channels } = img;
  if (channels === 4) rgba.set(data);
  else {
    for (let i = 0; i < img.width * img.height; i++) {
      const r = channels === 1 ? data[i]! : data[i * 3]!;
      const g = channels === 1 ? data[i]! : data[i * 3 + 1]!;
      const b = channels === 1 ? data[i]! : data[i * 3 + 2]!;
      rgba[i * 4] = r;
      rgba[i * 4 + 1] = g;
      rgba[i * 4 + 2] = b;
      rgba[i * 4 + 3] = 255;
    }
  }
  canvas.getContext("2d").putImageData(new ImageData(rgba, img.width, img.height), 0, 0);
  return Buffer.from(await canvas.encode("png"));
}

/** Transcribes an image-only (scanned) PDF page by page with local Tesseract OCR. */
async function ocrPdf(pdf: PdfProxy, totalPages: number): Promise<ParsedDoc> {
  const { extractImages } = await import("unpdf");
  const { createWorker } = await import("tesseract.js");
  const { join } = await import("node:path");

  const pagesToScan = Math.min(totalPages, MAX_OCR_PAGES);
  const transcripts: string[] = new Array(pagesToScan);
  const cachePath = join(process.cwd(), "node_modules", ".cache", "tesseract");
  const engine = await createWorker("eng", 1, { cachePath, logger: () => {} });

  try {
    for (let i = 0; i < pagesToScan; i++) {
      try {
        const images = await extractImages(pdf, i + 1);
        const page = pickLargest(images);
        if (!page || page.width * page.height < 40_000) {
          transcripts[i] = "";
          continue;
        }
        const { data } = await engine.recognize(await rawToPng(page));
        transcripts[i] = clean(data.text);
      } catch {
        transcripts[i] = "";
      }
    }
  } finally {
    await engine.terminate();
    await pdf.loadingTask?.destroy();
  }

  const text = clean(transcripts.join("\n\n"));
  if (text.length < 20)
    throw new Error(
      "No readable text was found in this file (scanned pages could not be recognised).",
    );
  return { text, pageCount: totalPages, pages: transcripts };
}

function xmlText(xml: string): string {
  return xml
    .replace(/<w:p[^>]*>/g, "\n")
    .replace(/<w:tab[^>]*\/>/g, "\t")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function parseDocx(bytes: Uint8Array): ParsedDoc {
  const files = unzipSync(bytes);
  const doc = files["word/document.xml"];
  if (!doc) throw new Error("This Word file could not be read.");
  const text = clean(xmlText(strFromU8(doc)));
  return { text, pages: paginate(text) };
}

/** Returns the workbook's sheets in file order, matching each to its worksheet xml key. */
function xlsxSheets(files: Record<string, Uint8Array>): { name: string; file: string }[] {
  const relToTarget = new Map<string, string>();
  const relsRaw = files["xl/_rels/workbook.xml.rels"];
  if (relsRaw) {
    const rels = strFromU8(relsRaw);
    for (const m of rels.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
      const attrs = m[1] ?? "";
      const id = /(?:^|\s)Id="([^"]*)"/.exec(attrs)?.[1];
      const target = /(?:^|\s)Target="([^"]*)"/.exec(attrs)?.[1];
      if (id && target) relToTarget.set(id, target.replace(/^\//, ""));
    }
  }

  const sheets: { name: string; file: string }[] = [];
  const workbookRaw = files["xl/workbook.xml"];
  if (workbookRaw) {
    const wb = strFromU8(workbookRaw);
    for (const m of wb.matchAll(/<sheet\b([^>]*)\/?>/g)) {
      const attrs = m[1] ?? "";
      const name = /(?:^|\s)name="([^"]*)"/.exec(attrs)?.[1] ?? "";
      const rid =
        /(?:^|\s)r:id="([^"]*)"/.exec(attrs)?.[1] ?? /(?:^|\s)rid="([^"]*)"/.exec(attrs)?.[1] ?? "";
      if (!name) continue;
      const target = rid ? relToTarget.get(rid) : undefined;
      if (!target) continue;
      const file =
        target.includes("worksheets/") && !target.startsWith("xl/") ? `xl/${target}` : target;
      if (files[file]) sheets.push({ name, file });
    }
  }

  // Fallback when workbook.xml is missing or unreadable.
  if (!sheets.length) {
    for (const key of Object.keys(files)
      .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
      .sort()) {
      sheets.push({ name: key.split("/").pop() ?? key, file: key });
    }
  }
  return sheets;
}

function parseXlsx(bytes: Uint8Array): ParsedDoc {
  const files = unzipSync(bytes);
  const sharedRaw = files["xl/sharedStrings.xml"];
  const shared: string[] = [];
  if (sharedRaw) {
    const xml = strFromU8(sharedRaw);
    for (const m of xml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
      shared.push(
        xmlText(m[1] ?? "")
          .replace(/\s+/g, " ")
          .trim(),
      );
    }
  }
  const lines: string[] = [];
  for (const { name, file } of xlsxSheets(files)) {
    lines.push(`# ${name}`);
    const xml = strFromU8(files[file]!);
    for (const row of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
      const cells: string[] = [];
      for (const c of (row[1] ?? "").matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
        const attrs = c[1] ?? "";
        const inner = c[2] ?? "";
        const type = /(?:^|\s)t="([^"]+)"/.exec(attrs)?.[1];
        if (type === "s") {
          const v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
          const idx = v === undefined || v === "" ? -1 : Number(v);
          cells.push(idx >= 0 ? (shared[idx] ?? "") : "");
        } else if (type === "inlineStr") {
          cells.push(xmlText(inner).trim());
        } else {
          const v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1] ?? "";
          cells.push(v === "" ? "" : xmlText(v).trim());
        }
      }
      if (cells.some((c) => c !== "")) lines.push(cells.join(" | "));
    }
  }
  const text = clean(lines.join("\n"));
  return { text, pages: paginate(text) };
}

function parseCsv(bytes: Uint8Array): ParsedDoc {
  const text = clean(new TextDecoder().decode(bytes).replace(/^\uFEFF/, ""));
  return { text, pages: paginate(text) };
}

/** Transcribes a standalone image (png/jpg/bmp) with local Tesseract OCR. */
async function parseImage(bytes: Uint8Array): Promise<ParsedDoc> {
  const { createWorker } = await import("tesseract.js");
  const { join } = await import("node:path");

  const cachePath = join(process.cwd(), "node_modules", ".cache", "tesseract");
  const engine = await createWorker("eng", 1, { cachePath, logger: () => {} });
  try {
    const { data } = await engine.recognize(Buffer.from(bytes));
    const text = clean(data.text);
    if (text.length < 20) throw new Error("No readable text was found in this image.");
    return { text, pages: [text] };
  } finally {
    await engine.terminate();
  }
}

export async function parseFile(kind: string, bytes: Uint8Array): Promise<ParsedDoc> {
  if (kind === "pdf") return parsePdf(bytes);
  if (kind === "docx") return parseDocx(bytes);
  if (kind === "xlsx") return parseXlsx(bytes);
  if (kind === "csv") return parseCsv(bytes);
  return parseImage(bytes);
}

export function chunkText(text: string, size = 1200, overlap = 150): string[] {
  const paragraphs = text.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";
  for (const p of paragraphs) {
    if ((current + "\n\n" + p).length > size && current) {
      chunks.push(current.trim());
      current = current.slice(Math.max(0, current.length - overlap)) + "\n\n" + p;
    } else {
      current = current ? `${current}\n\n${p}` : p;
    }
    while (current.length > size * 2) {
      chunks.push(current.slice(0, size).trim());
      current = current.slice(size - overlap);
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.filter((c) => c.length > 20).slice(0, 400);
}

export type PageChunk = { content: string; page: number };

/** Chunks a document page by page so every chunk keeps its page number. */
export function chunkPages(pages: string[]): PageChunk[] {
  const out: PageChunk[] = [];
  pages.forEach((pageText, i) => {
    for (const content of chunkText(pageText)) out.push({ content, page: i + 1 });
  });
  return out.slice(0, 600);
}
