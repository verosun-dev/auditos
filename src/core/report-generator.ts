import type {
  AuditDocument,
  AuditFinding,
  AuditReport,
  AuditSession,
  Assumption,
  CitationSupportWarning,
  Claim,
  ClaimExtractionMethod,
  CodeReproductionPlan,
  EvidenceCandidate,
  PromptInjectionScan,
} from "../types/audit.ts";
import { buildClaimGraph, buildClaimMindmap, renderMindmapMermaid } from "./claim-graph.ts";
import { buildExpertFeedback } from "./expert-feedback.ts";
import { buildReviewerCopilot } from "./reviewer-copilot.ts";
import { buildRiskHeatmap } from "./risk-heatmap.ts";
import { recommendVisualization } from "./visualization-adapter.ts";
import { renderVisualizationDiagrams } from "./visualization-renderer.ts";

export function generateAuditReport(input: {
  session: AuditSession;
  document: AuditDocument;
  claims: Claim[];
  evidenceCandidates: EvidenceCandidate[];
  citationSupportWarnings: CitationSupportWarning[];
  promptInjectionScan: PromptInjectionScan;
  codeReproductionPlan: CodeReproductionPlan;
  assumptions: Assumption[];
  findings: AuditFinding[];
  claimExtraction: {
    method: ClaimExtractionMethod;
    model?: string;
    fallbackReason?: string;
  };
}): AuditReport {
  const reviewerQuestions = [...new Set(input.findings.map((finding) => finding.reviewerQuestion))];
  const graph = buildClaimGraph({
    document: input.document,
    claims: input.claims,
    findings: input.findings,
    reviewerQuestions,
    evidenceCandidates: input.evidenceCandidates,
    assumptions: input.assumptions,
  });
  const mindmap = buildClaimMindmap({
    document: input.document,
    claims: input.claims,
    evidenceCandidates: input.evidenceCandidates,
    assumptions: input.assumptions,
    findings: input.findings,
  });
  const visualization = recommendVisualization({
    document: input.document,
    claims: input.claims,
  });
  const mindmapMermaid = renderMindmapMermaid(mindmap);
  const visualizationDiagrams = renderVisualizationDiagrams({
    document: input.document,
    claims: input.claims,
    evidenceCandidates: input.evidenceCandidates,
    citationSupportWarnings: input.citationSupportWarnings,
    assumptions: input.assumptions,
    findings: input.findings,
    mindmap,
    codeReproductionPlan: input.codeReproductionPlan,
  });
  const primaryVisualizationMermaid =
    visualizationDiagrams.find((diagram) => diagram.mode === visualization.primaryMode)?.mermaid ?? mindmapMermaid;
  const riskHeatmap = buildRiskHeatmap({
    document: input.document,
    claims: input.claims,
    findings: input.findings,
    citationSupportWarnings: input.citationSupportWarnings,
  });
  const reviewerCopilot = buildReviewerCopilot({
    documentTitle: input.document.title,
    claims: input.claims,
    findings: input.findings,
    citationSupportWarnings: input.citationSupportWarnings,
  });
  const expertFeedback = buildExpertFeedback({
    claims: input.claims,
    promptInjectionScan: input.promptInjectionScan,
    codeReproductionPlan: input.codeReproductionPlan,
    reviewerCopilot,
    visualization,
  });

  return {
    session: {
      ...input.session,
      status: "completed",
      artifacts: {
        sections: input.document.sections,
        claims: input.claims,
        evidenceCandidates: input.evidenceCandidates,
        citationSupportWarnings: input.citationSupportWarnings,
        promptInjectionScan: input.promptInjectionScan,
        codeReproductionPlan: input.codeReproductionPlan,
        assumptions: input.assumptions,
        findings: input.findings,
        expertFeedback,
        reviewerQuestions,
      },
    },
    document: input.document,
    summary: summarizeDocument(input.document),
    metadata: {
      claimExtractionMethod: input.claimExtraction.method,
      claimExtractionModel: input.claimExtraction.model,
      claimExtractionFallbackReason: input.claimExtraction.fallbackReason,
      visualization,
    },
    claims: input.claims,
    evidenceCandidates: input.evidenceCandidates,
    citationSupportWarnings: input.citationSupportWarnings,
    promptInjectionScan: input.promptInjectionScan,
    codeReproductionPlan: input.codeReproductionPlan,
    assumptions: input.assumptions,
    findings: input.findings,
    riskHeatmap,
    graph,
    mindmap,
    mindmapMermaid,
    visualizationDiagrams,
    primaryVisualizationMermaid,
    reviewerCopilot,
    expertFeedback,
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
