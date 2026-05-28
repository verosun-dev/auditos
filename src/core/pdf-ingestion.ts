import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { access } from "node:fs/promises";
import { basename } from "node:path";
import { promisify } from "node:util";
import type { AuditDocument } from "../types/audit.ts";
import { inferTitleFromText, parseSectionsFromPages, type PageText } from "./section-parser.ts";

const execFileAsync = promisify(execFile);

type PdfExtraction = {
  pages: PageText[];
};

export async function ingestPdfDocument(sourcePath: string): Promise<AuditDocument> {
  const extraction = await extractPdfText(sourcePath);
  const rawText = extraction.pages.map((page) => page.text).join("\n\n");

  return {
    id: `doc_${randomUUID()}`,
    title: inferTitleFromText(rawText, basename(sourcePath)),
    sourcePath,
    rawText,
    sections: parseSectionsFromPages(extraction.pages),
    references: [],
  };
}

async function extractPdfText(sourcePath: string): Promise<PdfExtraction> {
  const candidates = await getPythonCandidates();
  const errors: string[] = [];

  for (const pythonPath of candidates) {
    try {
      const { stdout } = await execFileAsync(pythonPath, ["-c", PYTHON_PDF_EXTRACTOR, sourcePath], {
        maxBuffer: 20 * 1024 * 1024,
      });
      return JSON.parse(stdout) as PdfExtraction;
    } catch (error) {
      errors.push(`${pythonPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(
    [
      "Unable to extract PDF text. Install pypdf for python3 or set AUDITOS_PYTHON to a Python executable with pypdf available.",
      ...errors,
    ].join("\n"),
  );
}

async function getPythonCandidates(): Promise<string[]> {
  const candidates = [
    process.env.AUDITOS_PYTHON,
    "/Users/veronicasun/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3",
    "python3",
  ].filter(Boolean) as string[];

  const available: string[] = [];

  for (const candidate of candidates) {
    if (candidate.includes("/")) {
      try {
        await access(candidate);
        available.push(candidate);
      } catch {
        continue;
      }
    } else {
      available.push(candidate);
    }
  }

  return [...new Set(available)];
}

const PYTHON_PDF_EXTRACTOR = String.raw`
import json
import sys
from pypdf import PdfReader

reader = PdfReader(sys.argv[1])
pages = []

for page_number, page in enumerate(reader.pages, start=1):
    pages.append({
        "pageNumber": page_number,
        "text": page.extract_text() or "",
    })

print(json.dumps({"pages": pages}, ensure_ascii=False))
`;
