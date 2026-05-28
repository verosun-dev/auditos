import type {
  AuditDocument,
  AuditFinding,
  AuditReport,
  AuditSession,
  Claim,
  ClaimExtractionMethod,
} from "../types/audit.ts";

export function generateAuditReport(input: {
  session: AuditSession;
  document: AuditDocument;
  claims: Claim[];
  findings: AuditFinding[];
  claimExtraction: {
    method: ClaimExtractionMethod;
    model?: string;
    fallbackReason?: string;
  };
}): AuditReport {
  const reviewerQuestions = [...new Set(input.findings.map((finding) => finding.reviewerQuestion))];

  return {
    session: {
      ...input.session,
      status: "completed",
      artifacts: {
        sections: input.document.sections,
        claims: input.claims,
        findings: input.findings,
        reviewerQuestions,
      },
    },
    document: input.document,
    summary: summarizeDocument(input.document),
    metadata: {
      claimExtractionMethod: input.claimExtraction.method,
      claimExtractionModel: input.claimExtraction.model,
      claimExtractionFallbackReason: input.claimExtraction.fallbackReason,
    },
    claims: input.claims,
    findings: input.findings,
    reviewerQuestions,
    reproducibilityChecklist: [
      "Are all datasets named and accessible?",
      "Are sample restrictions stated clearly?",
      "Are main tables reproducible from the described data?",
      "Are robustness checks sufficient for the core claim?",
      "Are limitations and external-validity boundaries explicit?",
    ],
  };
}

function summarizeDocument(document: AuditDocument): string {
  return `${document.title ?? "Untitled document"} contains ${document.sections.length} parsed sections and is ready for claim-level review.`;
}
