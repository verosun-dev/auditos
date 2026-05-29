export type AuditDomain = "research" | "economics" | "machine-learning" | "applied-math";

export type AuditStatus = "initialized" | "running" | "completed" | "failed";

export type ClaimType =
  | "descriptive"
  | "numerical"
  | "causal"
  | "comparative"
  | "methodological"
  | "theoretical"
  | "forecast"
  | "normative";

export type RiskLevel = "low" | "medium" | "high";

export type ClaimExtractionMode = "auto" | "heuristic" | "llm";

export type ClaimExtractionMethod = "heuristic" | "llm";

export type VisualizationMode =
  | "mindmap"
  | "claim-tree"
  | "claim-evidence-graph"
  | "causal-mechanism-map"
  | "theorem-dependency-graph"
  | "workflow-pipeline";

export type VisualizationRecommendation = {
  primaryMode: VisualizationMode;
  secondaryModes: VisualizationMode[];
  rationale: string[];
  confidence: "low" | "medium" | "high";
  signals: {
    hasTheorems: boolean;
    hasEmpiricalDesign: boolean;
    hasCausalLanguage: boolean;
    hasMachineLearningWorkflow: boolean;
    hasSystemPipeline: boolean;
    hasConceptualStructure: boolean;
  };
};

export type EvidenceKind =
  | "citation"
  | "table"
  | "figure"
  | "dataset"
  | "method"
  | "quote"
  | "section-context"
  | "calculation";

export type EvidenceStrength = "weak" | "moderate" | "strong";

export type EvidenceCandidate = {
  id: string;
  claimId: string;
  sectionId: string;
  kind: EvidenceKind;
  text: string;
  strength: EvidenceStrength;
  sourceHint?: string;
};

export type AssumptionKind =
  | "causal-identification"
  | "measurement"
  | "external-validity"
  | "method-validity"
  | "data-quality"
  | "modeling"
  | "design-requirement"
  | "theoretical-condition";

export type Assumption = {
  id: string;
  claimId: string;
  kind: AssumptionKind;
  text: string;
  status: "candidate" | "stated" | "needs-verification";
};

export type AuditGraphNodeType = "document" | "section" | "claim" | "evidence" | "assumption" | "finding" | "question";

export type AuditGraphEdgeType =
  | "contains"
  | "states"
  | "supported_by"
  | "depends_on"
  | "flags"
  | "asks";

export type AuditGraphNode = {
  id: string;
  type: AuditGraphNodeType;
  label: string;
  metadata?: Record<string, unknown>;
};

export type AuditGraphEdge = {
  id: string;
  sourceId: string;
  targetId: string;
  type: AuditGraphEdgeType;
  label?: string;
};

export type AuditGraph = {
  nodes: AuditGraphNode[];
  edges: AuditGraphEdge[];
};

export type MindmapNodeType = "document" | "claim" | "section" | "evidence" | "assumption" | "finding" | "question";

export type MindmapNode = {
  id: string;
  type: MindmapNodeType;
  label: string;
  children: MindmapNode[];
  metadata?: Record<string, unknown>;
};

export type MindmapView = {
  root: MindmapNode;
  strategy: "claim-centric";
  maxClaims: number;
};

export type Section = {
  id: string;
  title: string;
  text: string;
  pageRange?: [number, number];
};

export type Reference = {
  id: string;
  rawText: string;
  title?: string;
  url?: string;
};

export type AuditDocument = {
  id: string;
  title?: string;
  sourcePath: string;
  rawText: string;
  sections: Section[];
  references: Reference[];
};

export type SourceLocation = {
  sectionId: string;
  sectionTitle?: string;
  pageRange?: [number, number];
  sentenceIndex?: number;
  characterRange?: [number, number];
  locator: string;
};

export type Claim = {
  id: string;
  text: string;
  type: ClaimType;
  sectionId: string;
  sourceLocation: SourceLocation;
  evidenceIds: string[];
  riskLevel?: RiskLevel;
};

export type AuditFinding = {
  id: string;
  claimId: string;
  riskType: string;
  riskLevel: RiskLevel;
  explanation: string;
  reviewerQuestion: string;
  suggestedTest?: string;
};

export type AuditSession = {
  sessionId: string;
  createdAt: string;
  domain: AuditDomain;
  documentPath: string;
  status: AuditStatus;
  artifacts: {
    sections: Section[];
    claims: Claim[];
    evidenceCandidates: EvidenceCandidate[];
    assumptions: Assumption[];
    findings: AuditFinding[];
    reviewerQuestions: string[];
  };
};

export type AuditReport = {
  session: AuditSession;
  document: AuditDocument;
  summary: string;
  metadata: {
    claimExtractionMethod: ClaimExtractionMethod;
    claimExtractionModel?: string;
    claimExtractionFallbackReason?: string;
    visualization: VisualizationRecommendation;
  };
  claims: Claim[];
  evidenceCandidates: EvidenceCandidate[];
  assumptions: Assumption[];
  findings: AuditFinding[];
  graph: AuditGraph;
  mindmap: MindmapView;
  mindmapMermaid: string;
  reviewerQuestions: string[];
  reproducibilityChecklist: string[];
};
