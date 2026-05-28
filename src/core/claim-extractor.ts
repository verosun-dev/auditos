import { randomUUID } from "node:crypto";
import { createStructuredResponse } from "./openai-client.ts";
import type { Claim, ClaimExtractionMethod, ClaimExtractionMode, ClaimType, Section } from "../types/audit.ts";

const CLAIM_SIGNAL =
  /\b(argues?|shows?|finds?|demonstrates?|causes?|reduced?|increased?|outperforms?|should|must|will|can|cannot|designed|supports?|evaluates?|identifies?|proposes?|requires?|depends|is expected to)\b/i;

const DEFAULT_LLM_MODEL = "gpt-5.5";
const DEFAULT_BATCH_MAX_CHARS = 14000;
const DEFAULT_BATCH_MAX_SECTIONS = 6;
const DEFAULT_LLM_MAX_SECTIONS = 40;

export type ClaimExtractionResult = {
  claims: Claim[];
  method: ClaimExtractionMethod;
  model?: string;
  fallbackReason?: string;
};

export type ClaimExtractionOptions = {
  mode?: ClaimExtractionMode;
  model?: string;
  apiKey?: string;
  maxSections?: number;
};

type LlmClaim = {
  text: string;
  type: ClaimType;
  sectionId: string;
  evidenceIds: string[];
};

type LlmClaimBatch = {
  claims: LlmClaim[];
};

export async function extractClaims(
  sections: Section[],
  options: ClaimExtractionOptions = {},
): Promise<ClaimExtractionResult> {
  const mode = options.mode ?? "auto";

  if (mode === "heuristic") {
    return {
      claims: extractClaimsHeuristic(sections),
      method: "heuristic",
    };
  }

  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;

  if (!apiKey) {
    if (mode === "llm") {
      throw new Error("OPENAI_API_KEY is required when claim extractor mode is 'llm'.");
    }

    return {
      claims: extractClaimsHeuristic(sections),
      method: "heuristic",
      fallbackReason: "OPENAI_API_KEY is not set.",
    };
  }

  const model = options.model ?? process.env.OPENAI_MODEL ?? DEFAULT_LLM_MODEL;

  try {
    return {
      claims: await extractClaimsWithLlm(sections, {
        apiKey,
        model,
        maxSections: options.maxSections,
      }),
      method: "llm",
      model,
    };
  } catch (error) {
    if (mode === "llm") {
      throw error;
    }

    return {
      claims: extractClaimsHeuristic(sections),
      method: "heuristic",
      model,
      fallbackReason: error instanceof Error ? error.message : String(error),
    };
  }
}

function extractClaimsHeuristic(sections: Section[]): Claim[] {
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

async function extractClaimsWithLlm(
  sections: Section[],
  options: {
    apiKey: string;
    model: string;
    maxSections?: number;
  },
): Promise<Claim[]> {
  const sectionLimit = options.maxSections ?? readNumberEnv("AUDITOS_LLM_MAX_SECTIONS") ?? DEFAULT_LLM_MAX_SECTIONS;
  const candidateSections = sections
    .filter((section) => section.text.trim().length >= 80)
    .slice(0, sectionLimit);

  const batches = buildSectionBatches(candidateSections);
  const claims: Claim[] = [];

  for (const batch of batches) {
    const response = await createStructuredResponse<LlmClaimBatch>({
      apiKey: options.apiKey,
      model: options.model,
      instructions: [
        "You extract auditable claims from research and professional documents.",
        "A claim is an assertion that contributes to the document's argument, product design, evidence standard, method, conclusion, or risk boundary.",
        "Return only claims grounded in the provided section text.",
        "Preserve the author's wording as much as possible.",
        "Do not invent evidence, do not summarize whole sections, and do not include headings as claims.",
      ].join(" "),
      input: {
        sections: batch.map((section) => ({
          id: section.id,
          title: section.title,
          pageRange: section.pageRange,
          text: truncateForLlm(section.text, 3500),
        })),
      },
      schemaName: "claim_extraction",
      schema: CLAIM_EXTRACTION_SCHEMA,
    });

    claims.push(...normalizeLlmClaims(response.claims, batch));
  }

  return dedupeClaims(claims);
}

function buildSectionBatches(sections: Section[]): Section[][] {
  const batches: Section[][] = [];
  let currentBatch: Section[] = [];
  let currentChars = 0;

  for (const section of sections) {
    const sectionChars = section.text.length;
    const wouldOverflow =
      currentBatch.length >= DEFAULT_BATCH_MAX_SECTIONS || currentChars + sectionChars > DEFAULT_BATCH_MAX_CHARS;

    if (currentBatch.length > 0 && wouldOverflow) {
      batches.push(currentBatch);
      currentBatch = [];
      currentChars = 0;
    }

    currentBatch.push(section);
    currentChars += sectionChars;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

function normalizeLlmClaims(claims: LlmClaim[], sections: Section[]): Claim[] {
  const sectionIds = new Set(sections.map((section) => section.id));

  return claims
    .filter((claim) => sectionIds.has(claim.sectionId))
    .filter((claim) => claim.text.trim().length >= 20)
    .map((claim) => ({
      id: randomUUID(),
      text: claim.text.trim(),
      type: claim.type,
      sectionId: claim.sectionId,
      evidenceIds: claim.evidenceIds ?? [],
    }));
}

function dedupeClaims(claims: Claim[]): Claim[] {
  const seen = new Set<string>();
  const deduped: Claim[] = [];

  for (const claim of claims) {
    const key = claim.text.toLowerCase().replace(/\s+/g, " ").trim();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(claim);
  }

  return deduped;
}

function truncateForLlm(text: string, maxChars: number): string {
  return text.length <= maxChars ? text : `${text.slice(0, maxChars)}...`;
}

function readNumberEnv(name: string): number | undefined {
  const value = process.env[name];
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

const CLAIM_EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    claims: {
      type: "array",
      maxItems: 80,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          text: {
            type: "string",
            minLength: 20,
          },
          type: {
            type: "string",
            enum: [
              "descriptive",
              "numerical",
              "causal",
              "comparative",
              "methodological",
              "theoretical",
              "forecast",
              "normative",
            ],
          },
          sectionId: {
            type: "string",
          },
          evidenceIds: {
            type: "array",
            items: {
              type: "string",
            },
          },
        },
        required: ["text", "type", "sectionId", "evidenceIds"],
      },
    },
  },
  required: ["claims"],
} satisfies Record<string, unknown>;
