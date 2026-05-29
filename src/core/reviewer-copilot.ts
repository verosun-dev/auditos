import { randomUUID } from "node:crypto";
import type {
  AuditFinding,
  CitationSupportWarning,
  CitationSupportWarningType,
  Claim,
  ClaimType,
  ReviewerConcern,
  ReviewerConcernSeverity,
  ReviewerCopilot,
  ReviewerReviewPosture,
  RiskLevel,
} from "../types/audit.ts";

const MAX_CONCERNS_PER_SEVERITY = 12;

export function buildReviewerCopilot(input: {
  claims: Claim[];
  findings: AuditFinding[];
  citationSupportWarnings: CitationSupportWarning[];
}): ReviewerCopilot {
  const claimsById = new Map(input.claims.map((claim) => [claim.id, claim]));
  const concerns = dedupeConcerns([
    ...input.findings
      .map((finding) => concernFromFinding(finding, claimsById.get(finding.claimId)))
      .filter(isConcern),
    ...input.citationSupportWarnings
      .map((warning) => concernFromWarning(warning, claimsById.get(warning.claimId)))
      .filter(isConcern),
  ]).sort(compareConcerns);
  const allMajorConcerns = concerns.filter((concern) => concern.severity === "major");
  const allMinorConcerns = concerns.filter((concern) => concern.severity === "minor");
  const majorConcerns = allMajorConcerns.slice(0, MAX_CONCERNS_PER_SEVERITY);
  const minorConcerns = allMinorConcerns.slice(0, MAX_CONCERNS_PER_SEVERITY);

  return {
    summary: {
      majorConcernCount: allMajorConcerns.length,
      minorConcernCount: allMinorConcerns.length,
      displayedMajorConcernCount: majorConcerns.length,
      displayedMinorConcernCount: minorConcerns.length,
      recommendedReviewPosture: recommendReviewPosture(allMajorConcerns, allMinorConcerns),
      rationale: buildSummaryRationale(allMajorConcerns, allMinorConcerns),
    },
    majorConcerns,
    minorConcerns,
  };
}

function concernFromFinding(finding: AuditFinding, claim: Claim | undefined): ReviewerConcern | undefined {
  if (!claim) {
    return undefined;
  }

  const severity = classifyFindingSeverity(finding, claim);

  return {
    id: randomUUID(),
    severity,
    source: "audit-finding",
    sourceId: finding.id,
    claimId: claim.id,
    claimText: claim.text,
    claimType: claim.type,
    riskLevel: finding.riskLevel,
    title: `${titleCase(finding.riskType)} in ${titleCase(claim.type)} claim`,
    rationale: finding.explanation,
    reviewerQuestion: finding.reviewerQuestion,
    suggestedAction: finding.suggestedTest ?? defaultSuggestedAction(claim.type),
    sourceLocation: claim.sourceLocation,
    tags: concernTags(claim.type, finding.riskLevel, finding.riskType),
  };
}

function concernFromWarning(warning: CitationSupportWarning, claim: Claim | undefined): ReviewerConcern | undefined {
  if (!claim) {
    return undefined;
  }

  const severity = classifyWarningSeverity(warning, claim);

  return {
    id: randomUUID(),
    severity,
    source: "citation-support-warning",
    sourceId: warning.id,
    claimId: claim.id,
    claimText: claim.text,
    claimType: claim.type,
    riskLevel: warning.severity,
    title: titleCase(warning.warningType),
    rationale: warning.message,
    reviewerQuestion: reviewerQuestionForWarning(warning.warningType),
    suggestedAction: warning.suggestedAction,
    sourceLocation: claim.sourceLocation,
    tags: concernTags(claim.type, warning.severity, warning.warningType),
  };
}

function classifyFindingSeverity(finding: AuditFinding, claim: Claim): ReviewerConcernSeverity {
  if (finding.riskLevel === "high") {
    return "major";
  }

  if (claim.type === "causal" || claim.type === "numerical" || claim.type === "methodological") {
    return finding.riskLevel === "medium" ? "major" : "minor";
  }

  return "minor";
}

function classifyWarningSeverity(warning: CitationSupportWarning, claim: Claim): ReviewerConcernSeverity {
  if (warning.severity === "high") {
    return "major";
  }

  if (
    warning.warningType === "missing-evidence" ||
    warning.warningType === "causal-claim-without-design-evidence" ||
    warning.warningType === "numerical-claim-without-traceable-source"
  ) {
    return "major";
  }

  if (claim.type === "causal" && warning.warningType === "weak-evidence") {
    return "major";
  }

  return "minor";
}

function recommendReviewPosture(
  majorConcerns: ReviewerConcern[],
  minorConcerns: ReviewerConcern[],
): ReviewerReviewPosture {
  const highRiskMajorCount = majorConcerns.filter((concern) => concern.riskLevel === "high").length;

  if (majorConcerns.length >= 4 || highRiskMajorCount >= 2) {
    return "major-revision";
  }

  if (majorConcerns.length > 0) {
    return "focused-revision";
  }

  if (minorConcerns.length > 0) {
    return "minor-revision";
  }

  return "light-review";
}

function buildSummaryRationale(majorConcerns: ReviewerConcern[], minorConcerns: ReviewerConcern[]): string[] {
  const rationale: string[] = [];

  if (majorConcerns.length > 0) {
    rationale.push(`${majorConcerns.length} major concern(s) require claim-level evidence or methodology review.`);
  }

  if (minorConcerns.length > 0) {
    rationale.push(`${minorConcerns.length} minor concern(s) should be addressed for clarity, traceability, or completeness.`);
  }

  if (majorConcerns.some((concern) => concern.claimType === "causal")) {
    rationale.push("At least one causal claim needs identification, confounding, or mechanism scrutiny.");
  }

  if (majorConcerns.some((concern) => concern.source === "citation-support-warning")) {
    rationale.push("At least one major concern comes from missing, weak, or mismatched support evidence.");
  }

  if (rationale.length === 0) {
    rationale.push("No major or minor concerns were generated by the current local audit rules.");
  }

  return rationale;
}

function reviewerQuestionForWarning(type: CitationSupportWarningType): string {
  switch (type) {
    case "missing-evidence":
      return "What source, citation, table, method, or quoted passage directly supports this claim?";
    case "weak-evidence":
      return "Can the claim be linked to stronger evidence than local section context?";
    case "causal-claim-without-design-evidence":
      return "Which identification strategy, comparison group, or design evidence supports the causal interpretation?";
    case "numerical-claim-without-traceable-source":
      return "Where is the number sourced, and can the calculation be reproduced?";
    case "methodological-claim-without-method-evidence":
      return "Which method description or robustness evidence supports this methodological claim?";
    case "normative-claim-without-requirement-evidence":
      return "What user need, safety constraint, governance rule, or workflow requirement justifies this claim?";
  }
}

function defaultSuggestedAction(type: ClaimType): string {
  switch (type) {
    case "causal":
      return "Add identification evidence, confounder analysis, and alternative-mechanism checks.";
    case "numerical":
      return "Trace the number to a table, dataset, citation, or reproducible calculation.";
    case "methodological":
      return "State assumptions and add robustness or ablation checks.";
    case "normative":
      return "Link the requirement to user, safety, workflow, or governance evidence.";
    case "theoretical":
      return "Clarify definitions, assumptions, and proof dependencies.";
    case "forecast":
      return "Add uncertainty, sensitivity analysis, and validation evidence.";
    case "comparative":
      return "Clarify comparison criteria and evidence for each side.";
    case "descriptive":
      return "Add direct source support or tighten the claim wording.";
  }
}

function dedupeConcerns(concerns: ReviewerConcern[]): ReviewerConcern[] {
  const seen = new Set<string>();
  const uniqueConcerns: ReviewerConcern[] = [];

  for (const concern of concerns) {
    const key = `${concern.claimId}:${concern.source}:${concern.title}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    uniqueConcerns.push(concern);
  }

  return uniqueConcerns;
}

function compareConcerns(left: ReviewerConcern, right: ReviewerConcern): number {
  const rightScore = concernScore(right);
  const leftScore = concernScore(left);

  if (rightScore !== leftScore) {
    return rightScore - leftScore;
  }

  return left.claimText.length - right.claimText.length;
}

function concernScore(concern: ReviewerConcern): number {
  return riskLevelWeight(concern.riskLevel) * 10 + claimTypeWeight(concern.claimType) + sourceWeight(concern.source);
}

function riskLevelWeight(level: RiskLevel): number {
  if (level === "high") {
    return 3;
  }

  if (level === "medium") {
    return 2;
  }

  return 1;
}

function claimTypeWeight(type: ClaimType): number {
  switch (type) {
    case "causal":
      return 8;
    case "numerical":
      return 7;
    case "methodological":
      return 6;
    case "normative":
      return 5;
    case "theoretical":
      return 4;
    case "forecast":
      return 3;
    case "comparative":
      return 2;
    case "descriptive":
      return 1;
  }
}

function sourceWeight(source: ReviewerConcern["source"]): number {
  return source === "citation-support-warning" ? 2 : 1;
}

function concernTags(claimType: ClaimType, riskLevel: RiskLevel, riskType: string): string[] {
  return [claimType, riskLevel, ...riskType.split("-").filter(Boolean)];
}

function titleCase(value: string): string {
  return value
    .split("-")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function isConcern(value: ReviewerConcern | undefined): value is ReviewerConcern {
  return Boolean(value);
}
