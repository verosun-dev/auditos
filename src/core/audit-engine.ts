import { randomUUID } from "node:crypto";
import type { AuditFinding, Claim } from "../types/audit.ts";

export function auditClaims(claims: Claim[]): AuditFinding[] {
  return claims.flatMap((claim) => {
    if (claim.type === "causal") {
      return [
        {
          id: randomUUID(),
          claimId: claim.id,
          riskType: "causal-identification",
          riskLevel: "high",
          explanation:
            "The claim uses causal language. The audit should verify identification strategy, pre-trends, confounding, and alternative mechanisms.",
          reviewerQuestion:
            "What evidence shows that the observed change was caused by the intervention rather than confounding trends or selection effects?",
          suggestedTest: "Add placebo tests, pre-trend visualizations, and sensitivity analysis.",
        },
      ];
    }

    if (claim.type === "numerical") {
      return [
        {
          id: randomUUID(),
          claimId: claim.id,
          riskType: "numerical-support",
          riskLevel: "medium",
          explanation:
            "The claim contains a quantitative assertion. The audit should trace it to a table, dataset, citation, or calculation.",
          reviewerQuestion:
            "Where does this number come from, and can the calculation be reproduced from the cited source or data?",
          suggestedTest: "Link the number to a source table or reproducible calculation.",
        },
      ];
    }

    if (claim.type === "methodological") {
      return [
        {
          id: randomUUID(),
          claimId: claim.id,
          riskType: "methodology-validity",
          riskLevel: "medium",
          explanation:
            "The claim depends on the validity of a method. The audit should inspect assumptions, data construction, and robustness checks.",
          reviewerQuestion:
            "Which assumptions are required for this method to support the paper's conclusion?",
          suggestedTest: "Add robustness checks and a concise assumption list.",
        },
      ];
    }

    if (claim.type === "normative") {
      return [
        {
          id: randomUUID(),
          claimId: claim.id,
          riskType: "design-assumption",
          riskLevel: "medium",
          explanation:
            "The claim states what the system should or must do. The audit should trace this to user needs, safety constraints, or domain requirements.",
          reviewerQuestion:
            "What user, safety, regulatory, or workflow evidence makes this design requirement necessary?",
          suggestedTest: "Add a product requirement note linking this claim to a user workflow or governance constraint.",
        },
      ];
    }

    return [];
  });
}
