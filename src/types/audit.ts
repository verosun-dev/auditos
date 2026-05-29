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

export type AuditGraphNodeType = "document" | "section" | "claim" | "finding" | "question";

export type AuditGraphEdgeType = "contains" | "states" | "flags" | "asks";

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

export type MindmapNodeType = "document" | "claim" | "section" | "finding" | "question";

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

export type Claim = {
  id: string;
  text: string;
  type: ClaimType;
  sectionId: string;
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
  };
  claims: Claim[];
  findings: AuditFinding[];
  graph: AuditGraph;
  mindmap: MindmapView;
  mindmapMermaid: string;
  reviewerQuestions: string[];
  reproducibilityChecklist: string[];
};
