import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { randomUUID } from "node:crypto";
import type { AuditDocument, Section } from "../types/audit.ts";

export type PageText = {
  pageNumber: number;
  text: string;
};

export async function ingestTextDocument(sourcePath: string): Promise<AuditDocument> {
  const rawText = await readFile(sourcePath, "utf8");

  return {
    id: cryptoSafeId("doc"),
    title: inferTitle(rawText) ?? basename(sourcePath),
    sourcePath,
    rawText,
    sections: parseSections(rawText),
    references: [],
  };
}

export function parseSections(rawText: string): Section[] {
  if (!/^#{1,3}\s+/m.test(rawText)) {
    return parseSectionsFromPlainText(rawText);
  }

  const chunks = rawText.split(/\n(?=#{1,3}\s+)/g).filter(Boolean);

  if (chunks.length === 0) {
    return [
      {
        id: cryptoSafeId("section"),
        title: "Document",
        text: rawText.trim(),
      },
    ];
  }

  return chunks
    .map((chunk) => {
      const [firstLine = "Untitled", ...rest] = chunk.trim().split("\n");
      return {
        id: cryptoSafeId("section"),
        title: firstLine.replace(/^#{1,3}\s+/, "").trim(),
        text: rest.join("\n").trim(),
      };
    })
    .filter((section) => section.text.length > 0);
}

export function parseSectionsFromPages(pages: PageText[]): Section[] {
  const sections: Array<Section & { endPage?: number }> = [];
  let current: (Section & { endPage?: number }) | undefined;

  for (const page of pages) {
    const lines = page.text
      .split(/\r?\n/)
      .map((line) => cleanPdfLine(line, page.pageNumber))
      .filter(Boolean);

    for (const line of lines) {
      if (isPdfHeading(line)) {
        if (current && current.text.trim().length > 0) {
          sections.push(current);
        }

        current = {
          id: cryptoSafeId("section"),
          title: normalizeHeading(line),
          text: "",
          pageRange: [page.pageNumber, page.pageNumber],
          endPage: page.pageNumber,
        };
        continue;
      }

      if (current) {
        current.text = `${current.text}\n${line}`.trim();
        current.endPage = page.pageNumber;
        current.pageRange = [current.pageRange?.[0] ?? page.pageNumber, page.pageNumber];
      }
    }
  }

  if (current && current.text.trim().length > 0) {
    sections.push(current);
  }

  if (sections.length === 0) {
    return parseSectionsFromPlainText(pages.map((page) => page.text).join("\n\n"));
  }

  return sections.map(({ endPage: _endPage, ...section }) => ({
    ...section,
    text: normalizeBodyText(section.text),
  }));
}

function inferTitle(rawText: string): string | undefined {
  const firstHeading = rawText.match(/^#\s+(.+)$/m);
  return firstHeading?.[1]?.trim();
}

export function inferTitleFromText(rawText: string, fallback?: string): string | undefined {
  const markdownTitle = inferTitle(rawText);
  if (markdownTitle) {
    return markdownTitle;
  }

  const titleLines: string[] = [];
  for (const rawLine of rawText.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line) {
      if (titleLines.length > 0) {
        break;
      }
      continue;
    }

    if (line.toLowerCase() === "abstract" || isPdfHeading(line)) {
      break;
    }

    if (/^\d+$/.test(line)) {
      continue;
    }

    titleLines.push(line);

    if (titleLines.length >= 4) {
      break;
    }
  }

  return titleLines.join(" ").trim() || fallback;
}

function cryptoSafeId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

function parseSectionsFromPlainText(rawText: string): Section[] {
  const lines = rawText.split(/\r?\n/);
  const sections: Section[] = [];
  let current: Section | undefined;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    if (isPdfHeading(line)) {
      if (current && current.text.trim().length > 0) {
        sections.push(current);
      }

      current = {
        id: cryptoSafeId("section"),
        title: normalizeHeading(line),
        text: "",
      };
      continue;
    }

    if (!current) {
      current = {
        id: cryptoSafeId("section"),
        title: "Document",
        text: "",
      };
    }

    current.text = `${current.text}\n${line}`.trim();
  }

  if (current && current.text.trim().length > 0) {
    sections.push(current);
  }

  return sections.map((section) => ({
    ...section,
    text: normalizeBodyText(section.text),
  }));
}

function cleanPdfLine(line: string, pageNumber: number): string {
  const trimmed = line.trim();

  if (trimmed === String(pageNumber)) {
    return "";
  }

  return trimmed;
}

function isPdfHeading(line: string): boolean {
  return (
    /^(abstract|references|appendix|appendices)$/i.test(line) ||
    /^\d+(?:\.\d+)*\s+[A-Z][A-Za-z0-9,;:()\/\-\s]+$/.test(line)
  );
}

function normalizeHeading(line: string): string {
  return line.replace(/\s+/g, " ").trim();
}

function normalizeBodyText(text: string): string {
  return text
    .replace(/-\n(?=[a-z])/g, "")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
