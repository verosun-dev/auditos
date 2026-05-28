import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { randomUUID } from "node:crypto";
import type { AuditDocument, Section } from "../types/audit.ts";

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

function inferTitle(rawText: string): string | undefined {
  const firstHeading = rawText.match(/^#\s+(.+)$/m);
  return firstHeading?.[1]?.trim();
}

function cryptoSafeId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}
