import type { AuditDocument, Claim, Section, VisualizationMode, VisualizationRecommendation } from "../types/audit.ts";

type VisualizationSignalScores = Record<VisualizationMode, number>;

export function recommendVisualization(input: {
  document: AuditDocument;
  claims: Claim[];
}): VisualizationRecommendation {
  const signalText = buildSignalText(input.document.sections, input.claims);
  const signals = {
    hasTheorems: hasTheorems(signalText),
    hasEmpiricalDesign: hasEmpiricalDesign(signalText),
    hasCausalLanguage: hasCausalLanguage(input.claims, signalText),
    hasMachineLearningWorkflow: hasMachineLearningWorkflow(signalText),
    hasSystemPipeline: hasSystemPipeline(signalText),
    hasConceptualStructure: hasConceptualStructure(input.document.sections, input.claims, signalText),
  };
  const scores: VisualizationSignalScores = {
    mindmap: 0,
    "claim-tree": 0,
    "claim-evidence-graph": 0,
    "causal-mechanism-map": 0,
    "theorem-dependency-graph": 0,
    "workflow-pipeline": 0,
  };

  if (signals.hasTheorems) {
    scores["theorem-dependency-graph"] += 8;
  }

  if (signals.hasEmpiricalDesign) {
    scores["claim-evidence-graph"] += 7;
  }

  if (signals.hasCausalLanguage) {
    scores["causal-mechanism-map"] += 7;
  }

  if (signals.hasMachineLearningWorkflow || signals.hasSystemPipeline) {
    scores["workflow-pipeline"] += 7;
  }

  if (signals.hasConceptualStructure) {
    scores.mindmap += 8;
    scores["claim-tree"] += 7;
  }

  scores["claim-tree"] += Math.min(input.claims.length / 12, 3);
  scores.mindmap += Math.min(input.document.sections.length / 20, 3);

  const rankedModes = rankModes(scores);
  const primaryMode = rankedModes[0] ?? "mindmap";

  return {
    primaryMode,
    secondaryModes: rankedModes.slice(1, 3),
    rationale: buildRationale(primaryMode, signals),
    confidence: scoreConfidence(scores[primaryMode]),
    signals,
  };
}

function buildSignalText(sections: Section[], claims: Claim[]): string {
  return [
    ...sections.map((section) => `${section.title}\n${section.text.slice(0, 800)}`),
    ...claims.map((claim) => claim.text),
  ]
    .join("\n")
    .toLowerCase();
}

function hasTheorems(text: string): boolean {
  return /\b(theorem|lemma|proposition|corollary|proof|definition|formalization|lean)\b/i.test(text);
}

function hasEmpiricalDesign(text: string): boolean {
  return /\b(empirical strategy|regression|dataset|sample|table|figure|robustness|placebo|identification|difference-in-differences|instrumental variable|p-value|confidence interval)\b/i.test(
    text,
  );
}

function hasCausalLanguage(claims: Claim[], text: string): boolean {
  return (
    claims.some((claim) => claim.type === "causal") ||
    /\b(causal|causes?|mechanism|treatment|intervention|confound|selection bias|reverse causality|external validity)\b/i.test(
      text,
    )
  );
}

function hasMachineLearningWorkflow(text: string): boolean {
  return /\b(machine learning|model training|train-test|baseline|ablation|hyperparameter|benchmark|dataset split|evaluation metric|data leakage)\b/i.test(
    text,
  );
}

function hasSystemPipeline(text: string): boolean {
  return /\b(system architecture|pipeline|ingestion|parser|retriever|orchestration|workflow|dashboard|api|layer \d+)\b/i.test(
    text,
  );
}

function hasConceptualStructure(sections: Section[], claims: Claim[], text: string): boolean {
  return (
    sections.length >= 5 ||
    claims.some((claim) => claim.type === "normative" || claim.type === "theoretical") ||
    /\b(concept paper|core thesis|design principles|product overview|roadmap|strategic rationale)\b/i.test(text)
  );
}

function rankModes(scores: VisualizationSignalScores): VisualizationMode[] {
  const maxScore = Math.max(...Object.values(scores));

  return (Object.entries(scores) as Array<[VisualizationMode, number]>)
    .sort((left, right) => right[1] - left[1])
    .filter(([, score]) => score > 0 && maxScore - score <= 5)
    .map(([mode]) => mode);
}

function buildRationale(
  primaryMode: VisualizationMode,
  signals: VisualizationRecommendation["signals"],
): string[] {
  const rationale: string[] = [];

  if (primaryMode === "mindmap" || primaryMode === "claim-tree") {
    rationale.push("Document appears to have a conceptual or hierarchical argument structure.");
  }

  if (primaryMode === "claim-evidence-graph") {
    rationale.push("Document contains empirical design, data, tables, or robustness-check signals.");
  }

  if (primaryMode === "causal-mechanism-map") {
    rationale.push("Document contains causal language or mechanism-oriented claims.");
  }

  if (primaryMode === "theorem-dependency-graph") {
    rationale.push("Document contains theorem, proof, lemma, or formalization signals.");
  }

  if (primaryMode === "workflow-pipeline") {
    rationale.push("Document contains model, system, algorithm, or pipeline workflow signals.");
  }

  if (signals.hasConceptualStructure) {
    rationale.push("Mindmap remains useful as a secondary high-level reading view.");
  }

  return rationale;
}

function scoreConfidence(score: number): VisualizationRecommendation["confidence"] {
  if (score >= 8) {
    return "high";
  }

  if (score >= 5) {
    return "medium";
  }

  return "low";
}
