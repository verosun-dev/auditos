import type {
  Assumption,
  AuditDocument,
  AuditFinding,
  CitationSupportWarning,
  Claim,
  EvidenceCandidate,
  MindmapView,
  VisualizationDiagram,
} from "../types/audit.ts";
import { renderMindmapMermaid } from "./claim-graph.ts";

const DEFAULT_MAX_RENDERED_CLAIMS = 8;

export function renderVisualizationDiagrams(input: {
  document: AuditDocument;
  claims: Claim[];
  evidenceCandidates: EvidenceCandidate[];
  citationSupportWarnings: CitationSupportWarning[];
  assumptions: Assumption[];
  findings: AuditFinding[];
  mindmap: MindmapView;
}): VisualizationDiagram[] {
  return [
    {
      mode: "mindmap",
      format: "mermaid",
      title: "Claim Mindmap",
      description: "Claim-centric mindmap with section context, evidence, assumptions, findings, and reviewer questions.",
      mermaid: renderMindmapMermaid(input.mindmap),
    },
    {
      mode: "claim-tree",
      format: "mermaid",
      title: "Claim Tree",
      description: "Tree view that starts from the document and expands into important claims and their audit children.",
      mermaid: renderClaimTree(input),
    },
    {
      mode: "claim-evidence-graph",
      format: "mermaid",
      title: "Claim Evidence Graph",
      description: "Graph view that emphasizes which claims are supported by candidate evidence and support warnings.",
      mermaid: renderClaimEvidenceGraph(input),
    },
    {
      mode: "causal-mechanism-map",
      format: "mermaid",
      title: "Causal Mechanism Map",
      description: "Causal audit view for interventions, mechanisms, outcomes, confounders, assumptions, and tests.",
      mermaid: renderCausalMechanismMap(input),
    },
    {
      mode: "theorem-dependency-graph",
      format: "mermaid",
      title: "Theorem Dependency Graph",
      description: "Theory-oriented view for definitions, assumptions, propositions, proof dependencies, and gaps.",
      mermaid: renderTheoremDependencyGraph(input),
    },
    {
      mode: "workflow-pipeline",
      format: "mermaid",
      title: "Workflow Pipeline",
      description: "Pipeline view for data, preprocessing, method, model or system claims, evaluation, and audit risks.",
      mermaid: renderWorkflowPipeline(input),
    },
  ];
}

function renderClaimTree(input: {
  document: AuditDocument;
  claims: Claim[];
  evidenceCandidates: EvidenceCandidate[];
  citationSupportWarnings: CitationSupportWarning[];
  assumptions: Assumption[];
  findings: AuditFinding[];
}): string {
  const selectedClaims = selectClaims(input, () => true);
  const evidenceByClaimId = groupByClaimId(input.evidenceCandidates);
  const assumptionsByClaimId = groupByClaimId(input.assumptions);
  const findingsByClaimId = groupByClaimId(input.findings);
  const warningsByClaimId = groupByClaimId(input.citationSupportWarnings);
  const sectionsById = new Map(input.document.sections.map((section) => [section.id, section]));
  const lines = mermaidHeader("TD", input.document.title ?? "Untitled document");

  for (const [claimIndex, claim] of selectedClaims.entries()) {
    const claimId = `claim_${claimIndex}`;
    appendNode(lines, claimId, claim.text);
    appendEdge(lines, "document", claimId, claim.type);

    const section = sectionsById.get(claim.sectionId);
    if (section) {
      const sectionId = `${claimId}_section`;
      appendNode(lines, sectionId, `Section: ${section.title}`);
      appendEdge(lines, claimId, sectionId, "located in");
    }

    appendLimitedChildren(lines, claimId, "evidence", evidenceByClaimId.get(claim.id), (evidence) =>
      `Evidence: ${evidence.kind} (${evidence.strength})`,
    );
    appendLimitedChildren(lines, claimId, "assumption", assumptionsByClaimId.get(claim.id), (assumption) =>
      `Assumption: ${assumption.kind}`,
    );
    appendLimitedChildren(lines, claimId, "finding", findingsByClaimId.get(claim.id), (finding) =>
      `${finding.riskLevel.toUpperCase()} ${finding.riskType}`,
    );
    appendLimitedChildren(lines, claimId, "warning", warningsByClaimId.get(claim.id), (warning) =>
      `${warning.severity.toUpperCase()} ${warning.warningType}`,
    );
  }

  return finalizeMermaid(lines);
}

function renderClaimEvidenceGraph(input: {
  document: AuditDocument;
  claims: Claim[];
  evidenceCandidates: EvidenceCandidate[];
  citationSupportWarnings: CitationSupportWarning[];
  findings: AuditFinding[];
}): string {
  const selectedClaims = selectClaims(input, (claim) => claim.evidenceIds.length > 0 || hasClaimSupportWarning(input, claim.id));
  const evidenceByClaimId = groupByClaimId(input.evidenceCandidates);
  const warningsByClaimId = groupByClaimId(input.citationSupportWarnings);
  const findingsByClaimId = groupByClaimId(input.findings);
  const lines = mermaidHeader("LR", input.document.title ?? "Untitled document");

  for (const [claimIndex, claim] of selectedClaims.entries()) {
    const claimId = `claim_${claimIndex}`;
    appendNode(lines, claimId, claim.text);
    appendEdge(lines, "document", claimId, claim.type);

    const evidenceList = evidenceByClaimId.get(claim.id) ?? [];
    if (evidenceList.length === 0) {
      const missingEvidenceId = `${claimId}_missing_evidence`;
      appendNode(lines, missingEvidenceId, "Missing traceable evidence");
      appendEdge(lines, claimId, missingEvidenceId, "needs");
    }

    for (const [evidenceIndex, evidence] of evidenceList.slice(0, 3).entries()) {
      const evidenceId = `${claimId}_evidence_${evidenceIndex}`;
      appendNode(lines, evidenceId, `${evidence.kind}: ${evidence.text}`);
      appendEdge(lines, claimId, evidenceId, evidence.strength);
    }

    for (const [warningIndex, warning] of (warningsByClaimId.get(claim.id) ?? []).slice(0, 2).entries()) {
      const warningId = `${claimId}_warning_${warningIndex}`;
      appendNode(lines, warningId, warning.message);
      appendEdge(lines, claimId, warningId, warning.severity);
    }

    for (const [findingIndex, finding] of (findingsByClaimId.get(claim.id) ?? []).slice(0, 1).entries()) {
      const findingId = `${claimId}_finding_${findingIndex}`;
      appendNode(lines, findingId, finding.reviewerQuestion);
      appendEdge(lines, claimId, findingId, "review");
    }
  }

  return finalizeMermaid(lines);
}

function renderCausalMechanismMap(input: {
  document: AuditDocument;
  claims: Claim[];
  assumptions: Assumption[];
  findings: AuditFinding[];
}): string {
  const selectedClaims = selectClaims(input, (claim) => claim.type === "causal");
  const assumptionsByClaimId = groupByClaimId(input.assumptions);
  const findingsByClaimId = groupByClaimId(input.findings);
  const lines = mermaidHeader("LR", input.document.title ?? "Untitled document");

  for (const [claimIndex, claim] of selectedClaims.entries()) {
    const treatmentId = `causal_${claimIndex}_treatment`;
    const mechanismId = `causal_${claimIndex}_mechanism`;
    const outcomeId = `causal_${claimIndex}_outcome`;
    const confounderId = `causal_${claimIndex}_confounder`;
    const claimId = `causal_${claimIndex}_claim`;

    appendNode(lines, treatmentId, "Treatment or intervention");
    appendNode(lines, mechanismId, "Mechanism to verify");
    appendNode(lines, outcomeId, "Claimed outcome");
    appendNode(lines, confounderId, "Confounders / selection / reverse causality");
    appendNode(lines, claimId, claim.text);
    appendEdge(lines, "document", claimId, "causal claim");
    appendEdge(lines, treatmentId, mechanismId, "affects");
    appendEdge(lines, mechanismId, outcomeId, "produces");
    appendEdge(lines, claimId, treatmentId, "implies");
    appendEdge(lines, claimId, outcomeId, "asserts");
    appendEdge(lines, confounderId, outcomeId, "could explain");

    for (const [assumptionIndex, assumption] of (assumptionsByClaimId.get(claim.id) ?? []).slice(0, 3).entries()) {
      const assumptionId = `causal_${claimIndex}_assumption_${assumptionIndex}`;
      appendNode(lines, assumptionId, `${assumption.kind}: ${assumption.text}`);
      appendEdge(lines, assumptionId, claimId, "must hold");
    }

    for (const [findingIndex, finding] of (findingsByClaimId.get(claim.id) ?? []).slice(0, 2).entries()) {
      const findingId = `causal_${claimIndex}_finding_${findingIndex}`;
      appendNode(lines, findingId, finding.suggestedTest ?? finding.reviewerQuestion);
      appendEdge(lines, claimId, findingId, "test");
    }
  }

  return finalizeMermaid(lines);
}

function renderTheoremDependencyGraph(input: {
  document: AuditDocument;
  claims: Claim[];
  evidenceCandidates: EvidenceCandidate[];
  assumptions: Assumption[];
  findings: AuditFinding[];
}): string {
  const selectedClaims = selectClaims(input, (claim) => claim.type === "theoretical" || hasTheorySignal(claim.text));
  const evidenceByClaimId = groupByClaimId(input.evidenceCandidates);
  const assumptionsByClaimId = groupByClaimId(input.assumptions);
  const findingsByClaimId = groupByClaimId(input.findings);
  const lines = mermaidHeader("TD", input.document.title ?? "Untitled document");
  const setupId = "theory_setup";
  appendNode(lines, setupId, "Definitions / setup / notation");
  appendEdge(lines, "document", setupId, "formal basis");

  for (const [claimIndex, claim] of selectedClaims.entries()) {
    const claimId = `theory_claim_${claimIndex}`;
    appendNode(lines, claimId, claim.text);
    appendEdge(lines, setupId, claimId, "supports");

    for (const [assumptionIndex, assumption] of (assumptionsByClaimId.get(claim.id) ?? []).slice(0, 3).entries()) {
      const assumptionId = `theory_${claimIndex}_assumption_${assumptionIndex}`;
      appendNode(lines, assumptionId, `${assumption.kind}: ${assumption.text}`);
      appendEdge(lines, assumptionId, claimId, "condition");
    }

    for (const [evidenceIndex, evidence] of (evidenceByClaimId.get(claim.id) ?? []).slice(0, 2).entries()) {
      const evidenceId = `theory_${claimIndex}_evidence_${evidenceIndex}`;
      appendNode(lines, evidenceId, `${evidence.kind}: ${evidence.text}`);
      appendEdge(lines, evidenceId, claimId, "proof context");
    }

    for (const [findingIndex, finding] of (findingsByClaimId.get(claim.id) ?? []).slice(0, 1).entries()) {
      const findingId = `theory_${claimIndex}_finding_${findingIndex}`;
      appendNode(lines, findingId, finding.reviewerQuestion);
      appendEdge(lines, claimId, findingId, "gap");
    }
  }

  return finalizeMermaid(lines);
}

function renderWorkflowPipeline(input: {
  document: AuditDocument;
  claims: Claim[];
  evidenceCandidates: EvidenceCandidate[];
  findings: AuditFinding[];
}): string {
  const pipelineClaims = selectClaims(
    input,
    (claim) =>
      claim.type === "methodological" ||
      claim.type === "numerical" ||
      /\b(data|dataset|model|training|evaluation|baseline|ablation|pipeline|workflow|system|algorithm)\b/i.test(claim.text),
  );
  const lines = mermaidHeader("LR", input.document.title ?? "Untitled document");
  const dataId = "pipeline_data";
  const preprocessId = "pipeline_preprocess";
  const methodId = "pipeline_method";
  const evaluationId = "pipeline_evaluation";
  const riskId = "pipeline_risk";

  appendNode(lines, dataId, "Data / sources");
  appendNode(lines, preprocessId, "Preprocessing / construction");
  appendNode(lines, methodId, "Method / model / system");
  appendNode(lines, evaluationId, "Evaluation / tables / figures");
  appendNode(lines, riskId, "Audit risks / reviewer checks");
  appendEdge(lines, "document", dataId, "extracts");
  appendEdge(lines, dataId, preprocessId);
  appendEdge(lines, preprocessId, methodId);
  appendEdge(lines, methodId, evaluationId);
  appendEdge(lines, evaluationId, riskId);

  appendEvidencePool(lines, dataId, input.evidenceCandidates, ["dataset", "citation", "section-context"], "source");
  appendEvidencePool(lines, evaluationId, input.evidenceCandidates, ["table", "figure", "calculation"], "result");

  for (const [claimIndex, claim] of pipelineClaims.slice(0, DEFAULT_MAX_RENDERED_CLAIMS).entries()) {
    const claimId = `pipeline_claim_${claimIndex}`;
    appendNode(lines, claimId, claim.text);
    appendEdge(lines, methodId, claimId, claim.type);
    appendEdge(lines, claimId, evaluationId, "validated by");
  }

  for (const [findingIndex, finding] of input.findings.slice(0, 4).entries()) {
    const findingId = `pipeline_finding_${findingIndex}`;
    appendNode(lines, findingId, finding.reviewerQuestion);
    appendEdge(lines, riskId, findingId, finding.riskLevel);
  }

  return finalizeMermaid(lines);
}

function appendEvidencePool(
  lines: string[],
  parentId: string,
  evidenceCandidates: EvidenceCandidate[],
  kinds: EvidenceCandidate["kind"][],
  edgeLabel: string,
): void {
  const selectedEvidence = evidenceCandidates.filter((evidence) => kinds.includes(evidence.kind)).slice(0, 3);

  for (const [evidenceIndex, evidence] of selectedEvidence.entries()) {
    const evidenceId = `${parentId}_evidence_${evidenceIndex}`;
    appendNode(lines, evidenceId, `${evidence.kind}: ${evidence.text}`);
    appendEdge(lines, parentId, evidenceId, edgeLabel);
  }
}

function appendLimitedChildren<T>(
  lines: string[],
  parentId: string,
  childPrefix: string,
  children: T[] | undefined,
  label: (child: T) => string,
): void {
  for (const [childIndex, child] of (children ?? []).slice(0, 2).entries()) {
    const childId = `${parentId}_${childPrefix}_${childIndex}`;
    appendNode(lines, childId, label(child));
    appendEdge(lines, parentId, childId);
  }
}

function selectClaims(
  input: {
    claims: Claim[];
    evidenceCandidates?: EvidenceCandidate[];
    citationSupportWarnings?: CitationSupportWarning[];
    assumptions?: Assumption[];
    findings?: AuditFinding[];
  },
  predicate: (claim: Claim) => boolean,
  maxClaims = DEFAULT_MAX_RENDERED_CLAIMS,
): Claim[] {
  const filtered = input.claims.filter(predicate);
  const candidates = filtered.length > 0 ? filtered : input.claims;
  const evidenceByClaimId = groupByClaimId(input.evidenceCandidates ?? []);
  const warningsByClaimId = groupByClaimId(input.citationSupportWarnings ?? []);
  const assumptionsByClaimId = groupByClaimId(input.assumptions ?? []);
  const findingsByClaimId = groupByClaimId(input.findings ?? []);

  return [...candidates]
    .sort((left, right) => {
      const rightScore = scoreClaimForRendering({
        claim: right,
        evidenceCount: evidenceByClaimId.get(right.id)?.length ?? 0,
        warningCount: warningsByClaimId.get(right.id)?.length ?? 0,
        assumptionCount: assumptionsByClaimId.get(right.id)?.length ?? 0,
        findings: findingsByClaimId.get(right.id) ?? [],
      });
      const leftScore = scoreClaimForRendering({
        claim: left,
        evidenceCount: evidenceByClaimId.get(left.id)?.length ?? 0,
        warningCount: warningsByClaimId.get(left.id)?.length ?? 0,
        assumptionCount: assumptionsByClaimId.get(left.id)?.length ?? 0,
        findings: findingsByClaimId.get(left.id) ?? [],
      });

      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }

      return left.text.length - right.text.length;
    })
    .slice(0, maxClaims);
}

function scoreClaimForRendering(input: {
  claim: Claim;
  evidenceCount: number;
  warningCount: number;
  assumptionCount: number;
  findings: AuditFinding[];
}): number {
  return (
    claimTypeWeight(input.claim.type) +
    input.evidenceCount +
    input.warningCount * 3 +
    input.assumptionCount +
    input.findings.reduce((score, finding) => score + riskScore(finding.riskLevel), 0)
  );
}

function hasClaimSupportWarning(input: { citationSupportWarnings: CitationSupportWarning[] }, claimId: string): boolean {
  return input.citationSupportWarnings.some((warning) => warning.claimId === claimId);
}

function hasTheorySignal(text: string): boolean {
  return /\b(theorem|lemma|proof|proposition|corollary|definition|formal|converges?|bound)\b/i.test(text);
}

function groupByClaimId<T extends { claimId: string }>(items: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();

  for (const item of items) {
    const existing = grouped.get(item.claimId) ?? [];
    existing.push(item);
    grouped.set(item.claimId, existing);
  }

  return grouped;
}

function mermaidHeader(direction: "LR" | "TD", documentTitle: string): string[] {
  const lines = [`flowchart ${direction}`];
  appendNode(lines, "document", documentTitle);
  return lines;
}

function appendNode(lines: string[], nodeId: string, label: string): void {
  lines.push(`  ${nodeId}["${escapeMermaidLabel(label)}"]`);
}

function appendEdge(lines: string[], sourceId: string, targetId: string, label?: string): void {
  if (label) {
    lines.push(`  ${sourceId} -->|${escapeMermaidEdgeLabel(label)}| ${targetId}`);
    return;
  }

  lines.push(`  ${sourceId} --> ${targetId}`);
}

function finalizeMermaid(lines: string[]): string {
  return `${lines.join("\n")}\n`;
}

function escapeMermaidLabel(label: string): string {
  return truncate(label)
    .replace(/"/g, "'")
    .replace(/[<>\[\]{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeMermaidEdgeLabel(label: string): string {
  return truncate(label, 42)
    .replace(/[|"<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value: string, maxLength = 92): string {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > maxLength ? `${compact.slice(0, maxLength - 3)}...` : compact;
}

function riskScore(riskLevel: AuditFinding["riskLevel"]): number {
  if (riskLevel === "high") {
    return 3;
  }

  if (riskLevel === "medium") {
    return 2;
  }

  return 1;
}

function claimTypeWeight(type: Claim["type"]): number {
  switch (type) {
    case "causal":
      return 7;
    case "methodological":
      return 6;
    case "normative":
      return 5;
    case "numerical":
      return 4;
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
