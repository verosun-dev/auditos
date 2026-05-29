import { auditClaims } from "./audit-engine.ts";
import { extractAssumptions } from "./assumption-extractor.ts";
import { classifyClaims } from "./claim-classifier.ts";
import { extractClaims } from "./claim-extractor.ts";
import { ingestDocument } from "./document-ingestion.ts";
import { extractEvidenceCandidates } from "./evidence-extractor.ts";
import { initializeAuditSession } from "./initialize-audit.ts";
import { generateAuditReport } from "./report-generator.ts";
import type { AuditDomain, AuditReport, ClaimExtractionMode } from "../types/audit.ts";

export async function runInitialAudit(input: {
  documentPath: string;
  domain?: AuditDomain;
  claimExtractionMode?: ClaimExtractionMode;
  claimExtractionModel?: string;
  claimExtractionMaxSections?: number;
}): Promise<AuditReport> {
  const session = initializeAuditSession(input);
  const document = await ingestDocument(input.documentPath);
  const extraction = await extractClaims(document.sections, {
    mode: input.claimExtractionMode,
    model: input.claimExtractionModel,
    maxSections: input.claimExtractionMaxSections,
  });
  const claims = extraction.method === "llm" ? extraction.claims : classifyClaims(extraction.claims);
  const evidenceCandidates = extractEvidenceCandidates({
    claims,
    sections: document.sections,
  });
  const assumptions = extractAssumptions(claims);
  const findings = auditClaims(claims);

  return generateAuditReport({
    session,
    document,
    claims,
    evidenceCandidates,
    assumptions,
    findings,
    claimExtraction: {
      method: extraction.method,
      model: extraction.model,
      fallbackReason: extraction.fallbackReason,
    },
  });
}
