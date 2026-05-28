export type AuditDomain = "research" | "economics" | "machine-learning" | "applied-math";

export type AuditStatus = "initialized" | "running" | "completed" | "failed";

export type ClaimType =
  | "descriptive"
  | "numerical"
  | "causal"
  | "comparative"
  | "methodological"
  | "theoretical"
  | "forecast";

export type RiskLevel = "low" | "medium" | "high";

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
  claims: Claim[];
  findings: AuditFinding[];
  reviewerQuestions: string[];
  reproducibilityChecklist: string[];
};

