import { auditClaims } from "./audit-engine.ts";
import { classifyClaims } from "./claim-classifier.ts";
import { extractClaims } from "./claim-extractor.ts";
import { ingestDocument } from "./document-ingestion.ts";
import { initializeAuditSession } from "./initialize-audit.ts";
import { generateAuditReport } from "./report-generator.ts";
import type { AuditDomain, AuditReport } from "../types/audit.ts";

export async function runInitialAudit(input: {
  documentPath: string;
  domain?: AuditDomain;
}): Promise<AuditReport> {
  const session = initializeAuditSession(input);
  const document = await ingestDocument(input.documentPath);
  const extractedClaims = extractClaims(document.sections);
  const claims = classifyClaims(extractedClaims);
  const findings = auditClaims(claims);

  return generateAuditReport({
    session,
    document,
    claims,
    findings,
  });
}
