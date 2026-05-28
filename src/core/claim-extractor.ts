import { randomUUID } from "node:crypto";
import type { Claim, Section } from "../types/audit.ts";

const CLAIM_SIGNAL =
  /\b(argues?|shows?|finds?|demonstrates?|causes?|reduced?|increased?|outperforms?|should|must|will|can|cannot|designed|supports?|evaluates?|identifies?|proposes?|requires?|depends|is expected to)\b/i;

export function extractClaims(sections: Section[]): Claim[] {
  return sections.flatMap((section) => {
    const sentences = section.text
      .replace(/\s+/g, " ")
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length >= 40 && sentence.length <= 900);

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
