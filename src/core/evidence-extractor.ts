import { randomUUID } from "node:crypto";
import type { Claim, EvidenceCandidate, EvidenceKind, EvidenceStrength, Section } from "../types/audit.ts";

const EVIDENCE_SIGNAL =
  /\b(table|figure|dataset|data|sample|citation|cited|section|appendix|regression|experiment|trial|survey|interview|source|evidence|results?|estimate|confidence interval|p-value|robustness|placebo)\b/i;

export function extractEvidenceCandidates(input: {
  claims: Claim[];
  sections: Section[];
}): EvidenceCandidate[] {
  const sectionsById = new Map(input.sections.map((section) => [section.id, section]));

  return input.claims.flatMap((claim) => {
    const section = sectionsById.get(claim.sectionId);

    if (!section) {
      return [];
    }

    return findEvidenceForClaim(claim, section);
  });
}

function findEvidenceForClaim(claim: Claim, section: Section): EvidenceCandidate[] {
  const sentences = section.text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 25 && sentence.length <= 700);
  const candidates = sentences
    .filter((sentence) => sentence !== claim.text)
    .filter((sentence) => EVIDENCE_SIGNAL.test(sentence) || sharesImportantTerms(sentence, claim.text))
    .slice(0, 3)
    .map((sentence) => ({
      id: randomUUID(),
      claimId: claim.id,
      sectionId: claim.sectionId,
      kind: inferEvidenceKind(sentence),
      text: sentence,
      strength: inferEvidenceStrength(sentence),
      sourceHint: section.pageRange ? `pages ${section.pageRange.join("-")}` : section.title,
    }));

  if (candidates.length > 0) {
    return candidates;
  }

  return [
    {
      id: randomUUID(),
      claimId: claim.id,
      sectionId: claim.sectionId,
      kind: "section-context",
      text: section.text.slice(0, 420),
      strength: "weak",
      sourceHint: section.pageRange ? `pages ${section.pageRange.join("-")}` : section.title,
    },
  ];
}

function inferEvidenceKind(text: string): EvidenceKind {
  if (/\btable\b/i.test(text)) {
    return "table";
  }

  if (/\bfigure\b/i.test(text)) {
    return "figure";
  }

  if (/\b(dataset|data|sample)\b/i.test(text)) {
    return "dataset";
  }

  if (/\b(regression|experiment|trial|survey|method|strategy|estimator|model)\b/i.test(text)) {
    return "method";
  }

  if (/\b(citation|cited|source|references?)\b/i.test(text)) {
    return "citation";
  }

  if (/\b(estimate|calculation|confidence interval|p-value)\b/i.test(text)) {
    return "calculation";
  }

  return "section-context";
}

function inferEvidenceStrength(text: string): EvidenceStrength {
  if (/\b(randomized|replication|robustness|placebo|confidence interval|systematic review|formal proof)\b/i.test(text)) {
    return "strong";
  }

  if (/\b(table|figure|dataset|regression|experiment|trial|citation|source)\b/i.test(text)) {
    return "moderate";
  }

  return "weak";
}

function sharesImportantTerms(left: string, right: string): boolean {
  const leftTerms = importantTerms(left);
  const rightTerms = importantTerms(right);
  let overlap = 0;

  for (const term of rightTerms) {
    if (leftTerms.has(term)) {
      overlap += 1;
    }
  }

  return overlap >= 3;
}

function importantTerms(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((term) => term.length >= 5)
      .filter((term) => !STOP_WORDS.has(term)),
  );
}

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "because",
  "between",
  "claim",
  "could",
  "document",
  "should",
  "their",
  "there",
  "these",
  "those",
  "which",
  "where",
  "would",
]);
