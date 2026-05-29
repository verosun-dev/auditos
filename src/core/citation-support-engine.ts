import { randomUUID } from "node:crypto";
import type {
  CitationSupportWarning,
  CitationSupportWarningType,
  Claim,
  EvidenceCandidate,
  EvidenceKind,
  RiskLevel,
} from "../types/audit.ts";

export function generateCitationSupportWarnings(input: {
  claims: Claim[];
  evidenceCandidates: EvidenceCandidate[];
}): CitationSupportWarning[] {
  const evidenceByClaimId = groupEvidenceByClaimId(input.evidenceCandidates);

  return input.claims.flatMap((claim) => {
    const evidence = evidenceByClaimId.get(claim.id) ?? [];
    return warningsForClaim(claim, evidence);
  });
}

function warningsForClaim(claim: Claim, evidence: EvidenceCandidate[]): CitationSupportWarning[] {
  const warnings: CitationSupportWarning[] = [];

  if (evidence.length === 0) {
    warnings.push(
      warning({
        claim,
        evidence,
        warningType: "missing-evidence",
        severity: "high",
        message: "No candidate evidence was found for this claim.",
        suggestedAction: "Link this claim to a source passage, citation, table, figure, dataset, or method description.",
      }),
    );
    return warnings;
  }

  if (allWeakSectionContext(evidence) && claim.type !== "descriptive" && claim.type !== "comparative") {
    warnings.push(
      warning({
        claim,
        evidence,
        warningType: "weak-evidence",
        severity: severityForClaimType(claim.type),
        message: "Only weak section-context evidence was found for this claim.",
        suggestedAction: "Add or link more specific evidence, such as a citation, table, figure, dataset, method, or calculation.",
      }),
    );
  }

  if (claim.type === "causal" && !hasAnyEvidenceKind(evidence, ["method", "dataset", "table", "figure", "citation"])) {
    warnings.push(
      warning({
        claim,
        evidence,
        warningType: "causal-claim-without-design-evidence",
        severity: "high",
        message: "The claim uses causal language but lacks design-oriented evidence candidates.",
        suggestedAction:
          "Link the claim to identification strategy, data, robustness checks, placebo tests, or a directly supporting citation.",
      }),
    );
  }

  if (claim.type === "numerical" && !hasAnyEvidenceKind(evidence, ["table", "calculation", "dataset", "citation"])) {
    warnings.push(
      warning({
        claim,
        evidence,
        warningType: "numerical-claim-without-traceable-source",
        severity: "medium",
        message: "The claim contains a numerical assertion but lacks a traceable quantitative source.",
        suggestedAction: "Link the number to a table, calculation, dataset, or cited source.",
      }),
    );
  }

  if (claim.type === "methodological" && !hasAnyEvidenceKind(evidence, ["method", "dataset", "citation"])) {
    warnings.push(
      warning({
        claim,
        evidence,
        warningType: "methodological-claim-without-method-evidence",
        severity: "medium",
        message: "The claim depends on method validity but lacks method or data evidence candidates.",
        suggestedAction: "Link this claim to the method, model, data construction, or assumption discussion.",
      }),
    );
  }

  if (claim.type === "normative" && !hasAnyEvidenceKind(evidence, ["citation", "method", "dataset"])) {
    warnings.push(
      warning({
        claim,
        evidence,
        warningType: "normative-claim-without-requirement-evidence",
        severity: "medium",
        message: "The claim states a design or governance requirement without a clear requirement evidence candidate.",
        suggestedAction: "Link this requirement to user research, safety constraints, governance policy, or workflow evidence.",
      }),
    );
  }

  return dedupeWarnings(warnings);
}

function warning(input: {
  claim: Claim;
  evidence: EvidenceCandidate[];
  warningType: CitationSupportWarningType;
  severity: RiskLevel;
  message: string;
  suggestedAction: string;
}): CitationSupportWarning {
  return {
    id: randomUUID(),
    claimId: input.claim.id,
    warningType: input.warningType,
    severity: input.severity,
    message: input.message,
    evidenceIds: input.evidence.map((evidence) => evidence.id),
    suggestedAction: input.suggestedAction,
  };
}

function groupEvidenceByClaimId(evidenceCandidates: EvidenceCandidate[]): Map<string, EvidenceCandidate[]> {
  const grouped = new Map<string, EvidenceCandidate[]>();

  for (const evidence of evidenceCandidates) {
    const existing = grouped.get(evidence.claimId) ?? [];
    existing.push(evidence);
    grouped.set(evidence.claimId, existing);
  }

  return grouped;
}

function allWeakSectionContext(evidence: EvidenceCandidate[]): boolean {
  return evidence.every((item) => item.kind === "section-context" && item.strength === "weak");
}

function hasAnyEvidenceKind(evidence: EvidenceCandidate[], kinds: EvidenceKind[]): boolean {
  return evidence.some((item) => kinds.includes(item.kind));
}

function severityForClaimType(type: Claim["type"]): RiskLevel {
  if (type === "causal" || type === "forecast") {
    return "high";
  }

  if (type === "numerical" || type === "methodological" || type === "normative") {
    return "medium";
  }

  return "low";
}

function dedupeWarnings(warnings: CitationSupportWarning[]): CitationSupportWarning[] {
  const seen = new Set<string>();
  const deduped: CitationSupportWarning[] = [];

  for (const item of warnings) {
    const key = `${item.claimId}:${item.warningType}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(item);
  }

  return deduped;
}
