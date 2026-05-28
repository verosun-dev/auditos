import { extname } from "node:path";
import type { AuditDocument } from "../types/audit.ts";
import { ingestPdfDocument } from "./pdf-ingestion.ts";
import { ingestTextDocument } from "./section-parser.ts";

export async function ingestDocument(sourcePath: string): Promise<AuditDocument> {
  const extension = extname(sourcePath).toLowerCase();

  if (extension === ".pdf") {
    return ingestPdfDocument(sourcePath);
  }

  return ingestTextDocument(sourcePath);
}
