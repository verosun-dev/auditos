import type {
  AuditDocument,
  AuditFinding,
  CitationSupportWarning,
  Claim,
  ClaimType,
  RiskHeatmap,
  RiskHeatmapCell,
  RiskHeatmapClaim,
  RiskHeatmapSignal,
  RiskLevel,
  RiskSignalCounts,
} from "../types/audit.ts";

const DEFAULT_MAX_HEATMAP_CLAIMS = 12;

export function buildRiskHeatmap(input: {
  document: AuditDocument;
  claims: Claim[];
  findings: AuditFinding[];
  citationSupportWarnings: CitationSupportWarning[];
}): RiskHeatmap {
  const claimsById = new Map(input.claims.map((claim) => [claim.id, claim]));
  const signals = buildRiskSignals(input.findings, input.citationSupportWarnings);
  const signalsByClaimId = groupSignalsByClaimId(signals);

  return {
    document: buildCell({
      id: input.document.id,
      scope: "document",
      label: input.document.title ?? "Document",
      claimIds: input.claims.map((claim) => claim.id),
      signals,
    }),
    bySection: buildSectionCells(input.document, input.claims, signalsByClaimId),
    byClaimType: buildClaimTypeCells(input.claims, signalsByClaimId),
    highestRiskClaims: buildHighestRiskClaims(input.claims, signalsByClaimId, claimsById),
    legend: {
      low: "One or more low-severity signals; track but usually not blocking.",
      medium: "Moderate audit concern; should be checked before relying on the claim.",
      high: "High audit concern; causal, quantitative, or support-critical issue needs review.",
    },
  };
}

function buildRiskSignals(
  findings: AuditFinding[],
  citationSupportWarnings: CitationSupportWarning[],
): RiskHeatmapSignal[] {
  return [
    ...findings.map((finding) => ({
      id: finding.id,
      source: "audit-finding" as const,
      claimId: finding.claimId,
      riskType: finding.riskType,
      riskLevel: finding.riskLevel,
      message: finding.explanation,
    })),
    ...citationSupportWarnings.map((warning) => ({
      id: warning.id,
      source: "citation-support-warning" as const,
      claimId: warning.claimId,
      riskType: warning.warningType,
      riskLevel: warning.severity,
      message: warning.message,
    })),
  ];
}

function buildSectionCells(
  document: AuditDocument,
  claims: Claim[],
  signalsByClaimId: Map<string, RiskHeatmapSignal[]>,
): RiskHeatmapCell[] {
  const claimsBySectionId = new Map<string, Claim[]>();

  for (const claim of claims) {
    const existing = claimsBySectionId.get(claim.sectionId) ?? [];
    existing.push(claim);
    claimsBySectionId.set(claim.sectionId, existing);
  }

  return document.sections
    .map((section) => {
      const sectionClaims = claimsBySectionId.get(section.id) ?? [];
      return buildCell({
        id: section.id,
        scope: "section",
        label: section.title,
        claimIds: sectionClaims.map((claim) => claim.id),
        signals: sectionClaims.flatMap((claim) => signalsByClaimId.get(claim.id) ?? []),
      });
    })
    .filter((cell) => cell.riskScore > 0)
    .sort(compareCells);
}

function buildClaimTypeCells(
  claims: Claim[],
  signalsByClaimId: Map<string, RiskHeatmapSignal[]>,
): RiskHeatmapCell[] {
  const claimsByType = new Map<ClaimType, Claim[]>();

  for (const claim of claims) {
    const existing = claimsByType.get(claim.type) ?? [];
    existing.push(claim);
    claimsByType.set(claim.type, existing);
  }

  return [...claimsByType.entries()]
    .map(([claimType, groupedClaims]) =>
      buildCell({
        id: `claim-type:${claimType}`,
        scope: "claim-type",
        label: claimType,
        claimIds: groupedClaims.map((claim) => claim.id),
        signals: groupedClaims.flatMap((claim) => signalsByClaimId.get(claim.id) ?? []),
      }),
    )
    .filter((cell) => cell.riskScore > 0)
    .sort(compareCells);
}

function buildHighestRiskClaims(
  claims: Claim[],
  signalsByClaimId: Map<string, RiskHeatmapSignal[]>,
  claimsById: Map<string, Claim>,
): RiskHeatmapClaim[] {
  const maxClaims = readNumberEnv("AUDITOS_HEATMAP_MAX_CLAIMS") ?? DEFAULT_MAX_HEATMAP_CLAIMS;

  return claims
    .map((claim) => {
      const signals = signalsByClaimId.get(claim.id) ?? [];
      const signalCounts = countSignals(signals);
      const riskScore = scoreSignals(signals);

      return {
        claimId: claim.id,
        claimText: claim.text,
        claimType: claim.type,
        sourceLocation: claim.sourceLocation,
        riskScore,
        riskLevel: riskLevelForSignals(signals),
        signalCounts,
        topRisks: topRiskTypes(signals),
      };
    })
    .filter((claim) => claim.riskScore > 0 && claimsById.has(claim.claimId))
    .sort((left, right) => {
      if (right.riskScore !== left.riskScore) {
        return right.riskScore - left.riskScore;
      }

      return riskLevelWeight(right.riskLevel) - riskLevelWeight(left.riskLevel);
    })
    .slice(0, maxClaims);
}

function buildCell(input: {
  id: string;
  scope: RiskHeatmapCell["scope"];
  label: string;
  claimIds: string[];
  signals: RiskHeatmapSignal[];
}): RiskHeatmapCell {
  return {
    id: input.id,
    scope: input.scope,
    label: input.label,
    riskScore: scoreSignals(input.signals),
    riskLevel: riskLevelForSignals(input.signals),
    claimIds: [...new Set(input.claimIds)],
    signalCounts: countSignals(input.signals),
    topRisks: topRiskTypes(input.signals),
  };
}

function groupSignalsByClaimId(signals: RiskHeatmapSignal[]): Map<string, RiskHeatmapSignal[]> {
  const grouped = new Map<string, RiskHeatmapSignal[]>();

  for (const signal of signals) {
    const existing = grouped.get(signal.claimId) ?? [];
    existing.push(signal);
    grouped.set(signal.claimId, existing);
  }

  return grouped;
}

function scoreSignals(signals: RiskHeatmapSignal[]): number {
  return signals.reduce((score, signal) => score + riskLevelWeight(signal.riskLevel), 0);
}

function countSignals(signals: RiskHeatmapSignal[]): RiskSignalCounts {
  return signals.reduce<RiskSignalCounts>(
    (counts, signal) => ({
      ...counts,
      [signal.riskLevel]: counts[signal.riskLevel] + 1,
    }),
    {
      low: 0,
      medium: 0,
      high: 0,
    },
  );
}

function topRiskTypes(signals: RiskHeatmapSignal[]): string[] {
  const counts = new Map<string, number>();

  for (const signal of signals) {
    counts.set(signal.riskType, (counts.get(signal.riskType) ?? 0) + riskLevelWeight(signal.riskLevel));
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([riskType]) => riskType);
}

function riskLevelForSignals(signals: RiskHeatmapSignal[]): RiskLevel {
  const counts = countSignals(signals);
  const score = scoreSignals(signals);

  if (counts.high >= 2 || score >= 8) {
    return "high";
  }

  if (counts.high >= 1 || counts.medium >= 2 || score >= 4) {
    return "medium";
  }

  return "low";
}

function riskLevelWeight(riskLevel: RiskLevel): number {
  if (riskLevel === "high") {
    return 3;
  }

  if (riskLevel === "medium") {
    return 2;
  }

  return 1;
}

function compareCells(left: RiskHeatmapCell, right: RiskHeatmapCell): number {
  if (right.riskScore !== left.riskScore) {
    return right.riskScore - left.riskScore;
  }

  return right.claimIds.length - left.claimIds.length;
}

function readNumberEnv(name: string): number | undefined {
  const value = process.env[name];

  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
