import { randomUUID } from "node:crypto";
import { createStructuredResponse } from "./openai-client.ts";
import type {
  Claim,
  ClaimExtractionMethod,
  ClaimExtractionMode,
  ClaimType,
  Section,
  SourceLocation,
} from "../types/audit.ts";

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

type SentenceLocation = {
  text: string;
  sentenceIndex: number;
  characterRange: [number, number];
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
    const sentences = locateSentences(section.text)
      .filter((sentence) => sentence.text.length >= 40 && sentence.text.length <= 900);

    return sentences
      .filter((sentence) => CLAIM_SIGNAL.test(sentence.text))
      .map((sentence) => ({
        id: randomUUID(),
        text: sentence.text,
        type: "descriptive",
        sectionId: section.id,
        sourceLocation: sourceLocationFromSentence(section, sentence),
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
  const sectionsById = new Map(sections.map((section) => [section.id, section]));

  return claims
    .filter((claim) => sectionsById.has(claim.sectionId))
    .filter((claim) => claim.text.trim().length >= 20)
    .map((claim) => {
      const section = sectionsById.get(claim.sectionId);
      const text = claim.text.trim();

      return {
        id: randomUUID(),
        text,
        type: claim.type,
        sectionId: claim.sectionId,
        sourceLocation: sourceLocationForClaimText(section, text),
        evidenceIds: claim.evidenceIds ?? [],
      };
    });
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

function locateSentences(text: string): SentenceLocation[] {
  const sentencePattern = /[^.!?]+[.!?]+|[^.!?]+$/g;
  const sentences: SentenceLocation[] = [];
  let match: RegExpExecArray | null;
  let sentenceIndex = 0;

  while ((match = sentencePattern.exec(text)) !== null) {
    const rawSentence = match[0];
    const trimmedSentence = rawSentence.trim();

    if (!trimmedSentence) {
      continue;
    }

    const leadingWhitespace = rawSentence.search(/\S/);
    const start = match.index + Math.max(leadingWhitespace, 0);
    const end = start + trimmedSentence.length;

    sentences.push({
      text: trimmedSentence,
      sentenceIndex,
      characterRange: [start, end],
    });
    sentenceIndex += 1;
  }

  return sentences;
}

function sourceLocationForClaimText(section: Section | undefined, claimText: string): SourceLocation {
  if (!section) {
    return {
      sectionId: "unknown",
      locator: "unknown section",
    };
  }

  const exactIndex = section.text.indexOf(claimText);

  if (exactIndex >= 0) {
    return sourceLocationFromSentence(section, {
      text: claimText,
      sentenceIndex: sentenceIndexForOffset(section.text, exactIndex),
      characterRange: [exactIndex, exactIndex + claimText.length],
    });
  }

  const bestSentence = findBestSentenceMatch(section.text, claimText);
  return bestSentence ? sourceLocationFromSentence(section, bestSentence) : sourceLocationFromSection(section);
}

function findBestSentenceMatch(sectionText: string, claimText: string): SentenceLocation | undefined {
  const claimTerms = importantTerms(claimText);
  let bestSentence: SentenceLocation | undefined;
  let bestOverlap = 0;

  for (const sentence of locateSentences(sectionText)) {
    const sentenceTerms = importantTerms(sentence.text);
    let overlap = 0;

    for (const term of claimTerms) {
      if (sentenceTerms.has(term)) {
        overlap += 1;
      }
    }

    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      bestSentence = sentence;
    }
  }

  return bestOverlap >= 2 ? bestSentence : undefined;
}

function sourceLocationFromSentence(section: Section, sentence: SentenceLocation): SourceLocation {
  return {
    sectionId: section.id,
    sectionTitle: section.title,
    pageRange: section.pageRange,
    sentenceIndex: sentence.sentenceIndex,
    characterRange: sentence.characterRange,
    locator: formatLocator(section, sentence.sentenceIndex),
  };
}

function sourceLocationFromSection(section: Section): SourceLocation {
  return {
    sectionId: section.id,
    sectionTitle: section.title,
    pageRange: section.pageRange,
    locator: formatLocator(section),
  };
}

function formatLocator(section: Section, sentenceIndex?: number): string {
  const pageLabel = section.pageRange ? `pages ${section.pageRange.join("-")}` : "page unknown";
  const sentenceLabel = sentenceIndex === undefined ? "" : `, sentence ${sentenceIndex + 1}`;
  return `${section.title} (${pageLabel}${sentenceLabel})`;
}

function sentenceIndexForOffset(text: string, offset: number): number {
  const sentences = locateSentences(text);
  const index = sentences.findIndex(
    (sentence) => offset >= sentence.characterRange[0] && offset <= sentence.characterRange[1],
  );

  return index >= 0 ? index : 0;
}

function importantTerms(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((term) => term.length >= 5)
      .filter((term) => !CLAIM_LOCATION_STOP_WORDS.has(term)),
  );
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

const CLAIM_LOCATION_STOP_WORDS = new Set([
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
