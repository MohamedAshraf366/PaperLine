import { unzipSync, strFromU8 } from "fflate";

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
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes);
  const { text, totalPages } = await extractText(pdf, { mergePages: false });
  const pages = (Array.isArray(text) ? text : [String(text)]).map((t) => clean(String(t)));
  return { text: clean(pages.join("\n\n")), pageCount: totalPages ?? pages.length, pages };
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
  const sheetNames = Object.keys(files)
    .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
    .sort();
  for (const name of sheetNames) {
    lines.push(`# ${name.split("/").pop()}`);
    const xml = strFromU8(files[name]!);
    for (const row of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
      const cells: string[] = [];
      for (const c of (row[1] ?? "").matchAll(/<c[^>]*?(?:\st="(\w+)")?[^>]*>([\s\S]*?)<\/c>/g)) {
        const type = c[1];
        const inner = c[2] ?? "";
        const v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1] ?? "";
        if (type === "s") cells.push(shared[Number(v)] ?? "");
        else if (type === "inlineStr") cells.push(xmlText(inner).trim());
        else cells.push(v);
      }
      if (cells.some((c) => c !== "")) lines.push(cells.join(" | "));
    }
  }
  const text = clean(lines.join("\n"));
  return { text, pages: paginate(text) };
}

function parseCsv(bytes: Uint8Array): ParsedDoc {
  const text = clean(new TextDecoder().decode(bytes));
  return { text, pages: paginate(text) };
}

export async function parseFile(kind: string, bytes: Uint8Array): Promise<ParsedDoc> {
  if (kind === "pdf") return parsePdf(bytes);
  if (kind === "docx") return parseDocx(bytes);
  if (kind === "xlsx") return parseXlsx(bytes);
  return parseCsv(bytes);
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
