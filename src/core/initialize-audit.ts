import { randomUUID } from "node:crypto";
import type { AuditDomain, AuditSession } from "../types/audit.ts";

export function initializeAuditSession(input: {
  documentPath: string;
  domain?: AuditDomain;
}): AuditSession {
  return {
    sessionId: randomUUID(),
    createdAt: new Date().toISOString(),
    domain: input.domain ?? "research",
    documentPath: input.documentPath,
    status: "initialized",
    artifacts: {
      sections: [],
      claims: [],
      evidenceCandidates: [],
      assumptions: [],
      findings: [],
      reviewerQuestions: [],
    },
  };
}
