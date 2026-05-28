import type { AuditDomain } from "../types/audit.ts";

export const researchReviewerAdapter = {
  domain: "research" satisfies AuditDomain,
  claimTaxonomy: [
    "descriptive",
    "numerical",
    "causal",
    "comparative",
    "methodological",
    "theoretical",
    "forecast",
    "normative",
  ],
  riskCategories: [
    "unsupported-claim",
    "causal-identification",
    "numerical-support",
    "methodology-validity",
    "citation-overreach",
    "missing-robustness-check",
    "external-validity",
    "design-assumption",
  ],
  outputStyle: "reviewer-facing",
};
