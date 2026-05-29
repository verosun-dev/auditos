import { randomUUID } from "node:crypto";
import type { Assumption, AssumptionKind, Claim } from "../types/audit.ts";

export function extractAssumptions(claims: Claim[]): Assumption[] {
  return claims.flatMap((claim) => assumptionsForClaim(claim));
}

function assumptionsForClaim(claim: Claim): Assumption[] {
  const assumptions: Assumption[] = [];

  if (claim.type === "causal") {
    assumptions.push(
      assumption(claim.id, "causal-identification", "The design rules out major confounding, reverse causality, and selection effects."),
      assumption(claim.id, "external-validity", "The claimed causal relationship generalizes beyond the observed setting."),
    );
  }

  if (claim.type === "methodological") {
    assumptions.push(
      assumption(claim.id, "method-validity", "The method's identifying or modeling assumptions are satisfied in this document's setting."),
      assumption(claim.id, "data-quality", "The data and measurement process are reliable enough to support the methodological claim."),
    );
  }

  if (claim.type === "numerical" || claim.type === "forecast") {
    assumptions.push(
      assumption(claim.id, "measurement", "The quantity is measured consistently and can be traced to a table, source, or calculation."),
      assumption(claim.id, "modeling", "The projection or numerical estimate is robust to plausible alternative assumptions."),
    );
  }

  if (claim.type === "normative") {
    assumptions.push(
      assumption(claim.id, "design-requirement", "The design requirement follows from a user need, safety boundary, or workflow constraint."),
    );
  }

  if (claim.type === "theoretical") {
    assumptions.push(
      assumption(claim.id, "theoretical-condition", "Definitions, regularity conditions, and dependency assumptions are stated before the claim is used."),
    );
  }

  return dedupeAssumptions(assumptions);
}

function assumption(claimId: string, kind: AssumptionKind, text: string): Assumption {
  return {
    id: randomUUID(),
    claimId,
    kind,
    text,
    status: "candidate",
  };
}

function dedupeAssumptions(assumptions: Assumption[]): Assumption[] {
  const seen = new Set<string>();
  const deduped: Assumption[] = [];

  for (const item of assumptions) {
    const key = `${item.claimId}:${item.kind}:${item.text}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(item);
  }

  return deduped;
}
