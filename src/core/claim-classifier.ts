import type { Claim, ClaimType } from "../types/audit.ts";

export function classifyClaims(claims: Claim[]): Claim[] {
  return claims.map((claim) => ({
    ...claim,
    type: inferClaimType(claim.text),
  }));
}

function inferClaimType(text: string): ClaimType {
  if (/\b(caused?|reduced?|increased?|impact|effect|because of|due to)\b/i.test(text)) {
    return "causal";
  }

  if (/\b\d+(\.\d+)?\s?(%|percent|million|billion|x)\b/i.test(text)) {
    return "numerical";
  }

  if (/\b(outperforms?|higher than|lower than|relative to|compared with)\b/i.test(text)) {
    return "comparative";
  }

  if (/\b(strategy|identification|regression|sample|dataset|estimator|model)\b/i.test(text)) {
    return "methodological";
  }

  if (/\b(theorem|lemma|proof|operator|compact|converges?)\b/i.test(text)) {
    return "theoretical";
  }

  if (/\b(will|forecast|expected to|projected to)\b/i.test(text)) {
    return "forecast";
  }

  return "descriptive";
}
