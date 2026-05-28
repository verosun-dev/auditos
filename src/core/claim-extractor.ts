import { randomUUID } from "node:crypto";
import type { Claim, Section } from "../types/audit.ts";

const CLAIM_SIGNAL =
  /\b(argues?|shows?|finds?|demonstrates?|causes?|reduced?|increased?|outperforms?|should|must|will|is expected to)\b/i;

export function extractClaims(sections: Section[]): Claim[] {
  return sections.flatMap((section) => {
    const sentences = section.text
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter(Boolean);

    return sentences
      .filter((sentence) => CLAIM_SIGNAL.test(sentence))
      .map((sentence) => ({
        id: randomUUID(),
        text: sentence,
        type: "descriptive",
        sectionId: section.id,
        evidenceIds: [],
      }));
  });
}
