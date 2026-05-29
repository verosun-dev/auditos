import type {
  AuditDocument,
  AuditFinding,
  AuditGraph,
  AuditGraphEdge,
  AuditGraphNode,
  Claim,
  MindmapNode,
  MindmapView,
  Section,
} from "../types/audit.ts";

const DEFAULT_MINDMAP_MAX_CLAIMS = 8;

export function buildClaimGraph(input: {
  document: AuditDocument;
  claims: Claim[];
  findings: AuditFinding[];
  reviewerQuestions: string[];
}): AuditGraph {
  const nodes: AuditGraphNode[] = [
    {
      id: input.document.id,
      type: "document",
      label: input.document.title ?? "Untitled document",
      metadata: {
        sourcePath: input.document.sourcePath,
        sectionCount: input.document.sections.length,
        claimCount: input.claims.length,
        findingCount: input.findings.length,
      },
    },
  ];
  const edges: AuditGraphEdge[] = [];

  for (const section of input.document.sections) {
    nodes.push({
      id: section.id,
      type: "section",
      label: section.title,
      metadata: {
        pageRange: section.pageRange,
      },
    });
    edges.push(edge(input.document.id, section.id, "contains"));
  }

  for (const claim of input.claims) {
    nodes.push({
      id: claim.id,
      type: "claim",
      label: claim.text,
      metadata: {
        claimType: claim.type,
        sectionId: claim.sectionId,
      },
    });
    edges.push(edge(claim.sectionId, claim.id, "states"));
  }

  for (const finding of input.findings) {
    nodes.push({
      id: finding.id,
      type: "finding",
      label: finding.riskType,
      metadata: {
        claimId: finding.claimId,
        riskLevel: finding.riskLevel,
        explanation: finding.explanation,
        suggestedTest: finding.suggestedTest,
      },
    });
    edges.push(edge(finding.claimId, finding.id, "flags"));
  }

  for (const finding of input.findings) {
    const questionId = questionNodeId(finding.id);
    nodes.push({
      id: questionId,
      type: "question",
      label: finding.reviewerQuestion,
      metadata: {
        findingId: finding.id,
        claimId: finding.claimId,
      },
    });
    edges.push(edge(finding.id, questionId, "asks"));
  }

  return {
    nodes,
    edges,
  };
}

export function buildClaimMindmap(input: {
  document: AuditDocument;
  claims: Claim[];
  findings: AuditFinding[];
  maxClaims?: number;
}): MindmapView {
  const maxClaims = input.maxClaims ?? readNumberEnv("AUDITOS_MINDMAP_MAX_CLAIMS") ?? DEFAULT_MINDMAP_MAX_CLAIMS;
  const sectionsById = new Map(input.document.sections.map((section) => [section.id, section]));
  const findingsByClaimId = groupFindingsByClaimId(input.findings);
  const selectedClaims = selectMindmapClaims(input.claims, input.findings, sectionsById, maxClaims);

  return {
    strategy: "claim-centric",
    maxClaims,
    root: {
      id: input.document.id,
      type: "document",
      label: input.document.title ?? "Untitled document",
      metadata: {
        sourcePath: input.document.sourcePath,
        totalClaims: input.claims.length,
        displayedClaims: selectedClaims.length,
      },
      children: selectedClaims.map((claim) =>
        claimToMindmapNode({
          claim,
          section: sectionsById.get(claim.sectionId),
          findings: findingsByClaimId.get(claim.id) ?? [],
        }),
      ),
    },
  };
}

export function renderMindmapMermaid(mindmap: MindmapView): string {
  const lines = ["mindmap"];
  appendMindmapNode(lines, mindmap.root, 1);
  return `${lines.join("\n")}\n`;
}

function claimToMindmapNode(input: {
  claim: Claim;
  section?: Section;
  findings: AuditFinding[];
}): MindmapNode {
  const children: MindmapNode[] = [];

  if (input.section) {
    children.push({
      id: `${input.claim.id}:section`,
      type: "section",
      label: `Section: ${input.section.title}`,
      children: [],
      metadata: {
        sectionId: input.section.id,
        pageRange: input.section.pageRange,
      },
    });
  }

  for (const finding of input.findings) {
    children.push({
      id: finding.id,
      type: "finding",
      label: `${finding.riskLevel.toUpperCase()} ${finding.riskType}`,
      metadata: {
        explanation: finding.explanation,
        suggestedTest: finding.suggestedTest,
      },
      children: [
        {
          id: questionNodeId(finding.id),
          type: "question",
          label: finding.reviewerQuestion,
          children: [],
        },
      ],
    });
  }

  return {
    id: input.claim.id,
    type: "claim",
    label: input.claim.text,
    children,
    metadata: {
      claimType: input.claim.type,
      findingCount: input.findings.length,
    },
  };
}

function selectMindmapClaims(
  claims: Claim[],
  findings: AuditFinding[],
  sectionsById: Map<string, Section>,
  maxClaims: number,
): Claim[] {
  const highestRiskByClaimId = new Map<string, number>();

  for (const finding of findings) {
    const score = riskScore(finding.riskLevel);
    highestRiskByClaimId.set(finding.claimId, Math.max(score, highestRiskByClaimId.get(finding.claimId) ?? 0));
  }

  return [...claims]
    .sort((left, right) => {
      const rightScore = mindmapClaimScore(
        right,
        highestRiskByClaimId.get(right.id) ?? 0,
        sectionsById.get(right.sectionId),
      );
      const leftScore = mindmapClaimScore(
        left,
        highestRiskByClaimId.get(left.id) ?? 0,
        sectionsById.get(left.sectionId),
      );

      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }

      return left.text.length - right.text.length;
    })
    .slice(0, maxClaims);
}

function mindmapClaimScore(claim: Claim, riskScoreValue: number, section?: Section): number {
  return claimTypeWeight(claim.type) + riskScoreValue * 2 + sectionPriority(section?.title) + textPriority(claim.text);
}

function groupFindingsByClaimId(findings: AuditFinding[]): Map<string, AuditFinding[]> {
  const grouped = new Map<string, AuditFinding[]>();

  for (const finding of findings) {
    const existing = grouped.get(finding.claimId) ?? [];
    existing.push(finding);
    grouped.set(finding.claimId, existing);
  }

  return grouped;
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
      return 6;
    case "methodological":
      return 5;
    case "normative":
      return 7;
    case "numerical":
      return 4;
    case "forecast":
      return 3;
    case "comparative":
      return 2;
    case "theoretical":
      return 1;
    case "descriptive":
      return 0;
  }
}

function sectionPriority(sectionTitle: string | undefined): number {
  if (!sectionTitle) {
    return 0;
  }

  if (/abstract/i.test(sectionTitle)) {
    return 8;
  }

  if (/core thesis/i.test(sectionTitle)) {
    return 7;
  }

  if (/product overview|mvp definition|conclusion/i.test(sectionTitle)) {
    return 5;
  }

  if (/claim extraction|professional risk engine|references/i.test(sectionTitle)) {
    return -5;
  }

  return 0;
}

function textPriority(text: string): number {
  let score = 0;

  if (/\b(core thesis|high-stakes document|central data structure|first version|recommended MVP)\b/i.test(text)) {
    score += 8;
  }

  if (/\b(AuditOS is|AuditOS addresses|AuditOS differs|The platform is|The system decomposes)\b/i.test(text)) {
    score += 6;
  }

  if (/\b(not a general chatbot|claim graph|machine-readable graph|human-in-the-loop|verifiability|traceability)\b/i.test(text)) {
    score += 5;
  }

  if (/^(Forecast|Claim Type|Example|Tool Type)\b/i.test(text)) {
    score -= 8;
  }

  if (text.includes("•")) {
    score -= 4;
  }

  if (/\bsuch as:\s*•/i.test(text)) {
    score -= 4;
  }

  return score;
}

function appendMindmapNode(lines: string[], node: MindmapNode, depth: number): void {
  lines.push(`${"  ".repeat(depth)}${formatMermaidLabel(node.label)}`);

  for (const child of node.children) {
    appendMindmapNode(lines, child, depth + 1);
  }
}

function formatMermaidLabel(label: string): string {
  const compact = label
    .replace(/[()[\]{}"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const truncated = compact.length > 110 ? `${compact.slice(0, 107)}...` : compact;
  return truncated;
}

function edge(sourceId: string, targetId: string, type: AuditGraphEdge["type"]): AuditGraphEdge {
  return {
    id: `${sourceId}:${type}:${targetId}`,
    sourceId,
    targetId,
    type,
  };
}

function questionNodeId(findingId: string): string {
  return `${findingId}:question`;
}

function readNumberEnv(name: string): number | undefined {
  const value = process.env[name];

  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
