import { randomUUID } from "node:crypto";
import type {
  AuditDocument,
  CodeReproductionArtifact,
  CodeReproductionArtifactKind,
  CodeReproductionPlan,
  CodeReproductionReadiness,
  CodeReproductionStep,
  Section,
} from "../types/audit.ts";

type ArtifactRule = {
  kind: CodeReproductionArtifactKind;
  label: string;
  pattern: RegExp;
};

const ARTIFACT_RULES: ArtifactRule[] = [
  {
    kind: "repository",
    label: "Code repository",
    pattern: /\b(https?:\/\/(?:github|gitlab|bitbucket)\.com\/[^\s),.;]+|github\.com\/[^\s),.;]+)\b/i,
  },
  {
    kind: "command",
    label: "Reproduction command",
    pattern:
      /\b(?:python3?\s+\S+\.py|pip install\b[^\n.]*|conda (?:env|install|create)\b[^\n.]*|poetry install\b[^\n.]*|npm install\b[^\n.]*|yarn install\b[^\n.]*|snakemake\b[^\n.]*|Rscript\s+\S+|julia\s+\S+|docker (?:run|compose)\b[^\n.]*|bash\s+\S+)|(?:^|[\n`$>])\s*make\s+\w+/i,
  },
  {
    kind: "environment",
    label: "Execution environment",
    pattern: /\b(requirements\.txt|environment\.ya?ml|conda|docker|container|cuda|python\s*\d(?:\.\d+)?|R version|package versions?|runtime environment|software environment)\b[^\n.]{0,120}/i,
  },
  {
    kind: "dataset",
    label: "Dataset or benchmark",
    pattern: /\b(dataset|benchmark|corpus|data are available|data is available|download the data|training data|test set|validation set|ImageNet|MNIST|CIFAR|UCI|Hugging Face)\b[^\n.]{0,140}/i,
  },
  {
    kind: "result",
    label: "Target result",
    pattern: /\b(table|figure|main result|reported result|accuracy|F1|AUC|RMSE|p-value|confidence interval|baseline|ablation|replicate|reproduce)\b[^\n.]{0,140}/i,
  },
  {
    kind: "hardware",
    label: "Hardware requirement",
    pattern: /\b(GPU|TPU|CPU|A100|V100|RTX|CUDA|memory|RAM|cluster|compute)\b[^\n.]{0,120}/i,
  },
  {
    kind: "random-seed",
    label: "Random seed",
    pattern: /\b(seed|random state|random initialization|deterministic|reproducible run)\b[^\n.]{0,120}/i,
  },
  {
    kind: "dependency",
    label: "Dependency",
    pattern: /\b(PyTorch|TensorFlow|scikit-learn|numpy|pandas|statsmodels|Stata|MATLAB|R package|library version|dependency|dependencies)\b[^\n.]{0,120}/i,
  },
  {
    kind: "license",
    label: "License or access boundary",
    pattern: /\b(license|licensed|proprietary|restricted access|IRB|data use agreement|credential|permission required)\b[^\n.]{0,120}/i,
  },
];

const MAX_ARTIFACTS = 40;

export function buildCodeReproductionPlan(document: AuditDocument): CodeReproductionPlan {
  const artifacts = document.sections
    .flatMap((section) => extractArtifactsFromSection(section))
    .slice(0, MAX_ARTIFACTS);
  const steps = buildReproductionSteps(artifacts);
  const readiness = classifyReadiness(artifacts);

  return {
    summary: {
      readiness,
      artifactCount: artifacts.length,
      repositoryCount: countArtifacts(artifacts, "repository"),
      commandCount: countArtifacts(artifacts, "command"),
      datasetCount: countArtifacts(artifacts, "dataset"),
      rationale: buildReadinessRationale(artifacts, readiness),
    },
    artifacts,
    steps,
    safetyNotes: [
      "Do not execute paper-provided code automatically; run it only in a sandboxed environment after reviewer confirmation.",
      "Treat downloaded datasets, notebooks, shell scripts, and dependency files as untrusted until inspected.",
      "Record environment versions, seeds, hardware, and expected outputs before comparing reproduced results.",
    ],
  };
}

function extractArtifactsFromSection(section: Section): CodeReproductionArtifact[] {
  const artifacts: CodeReproductionArtifact[] = [];

  for (const rule of ARTIFACT_RULES) {
    const match = rule.pattern.exec(section.text);

    if (!match) {
      continue;
    }

    artifacts.push({
      id: randomUUID(),
      kind: rule.kind,
      label: rule.label,
      text: cleanSnippet(match[0]),
      sectionId: section.id,
      sectionTitle: section.title,
      pageRange: section.pageRange,
    });
  }

  return artifacts;
}

function buildReproductionSteps(artifacts: CodeReproductionArtifact[]): CodeReproductionStep[] {
  return [
    reproductionStep({
      title: "Locate paper code",
      description: "Find the official repository, supplemental archive, or executable notebook linked by the paper.",
      artifacts,
      kinds: ["repository"],
    }),
    reproductionStep({
      title: "Prepare environment",
      description: "Create the runtime environment from requirements, package versions, containers, CUDA notes, or language versions.",
      artifacts,
      kinds: ["environment", "dependency", "hardware"],
    }),
    reproductionStep({
      title: "Acquire data",
      description: "Download or reconstruct the dataset, benchmark split, or restricted data access path described by the paper.",
      artifacts,
      kinds: ["dataset", "license"],
    }),
    reproductionStep({
      title: "Run reproduction command",
      description: "Run the paper's training, evaluation, replication, or notebook command in a sandboxed workspace.",
      artifacts,
      kinds: ["command", "random-seed"],
    }),
    reproductionStep({
      title: "Compare outputs",
      description: "Compare reproduced metrics, tables, figures, and qualitative outputs against the paper's reported results.",
      artifacts,
      kinds: ["result"],
    }),
  ];
}

function reproductionStep(input: {
  title: string;
  description: string;
  artifacts: CodeReproductionArtifact[];
  kinds: CodeReproductionArtifactKind[];
}): CodeReproductionStep {
  const matchingArtifacts = input.artifacts.filter((artifact) => input.kinds.includes(artifact.kind));

  return {
    id: randomUUID(),
    title: input.title,
    description: input.description,
    artifactIds: matchingArtifacts.map((artifact) => artifact.id),
    status: matchingArtifacts.length > 0 ? "available" : "missing",
  };
}

function classifyReadiness(artifacts: CodeReproductionArtifact[]): CodeReproductionReadiness {
  const hasRepository = hasArtifact(artifacts, "repository");
  const hasCommand = hasArtifact(artifacts, "command");
  const hasDataset = hasArtifact(artifacts, "dataset");
  const hasEnvironment = hasArtifact(artifacts, "environment") || hasArtifact(artifacts, "dependency");
  const hasResult = hasArtifact(artifacts, "result");

  if (hasRepository && hasCommand && hasDataset && hasEnvironment && hasResult) {
    return "ready-candidate";
  }

  if ([hasRepository, hasCommand, hasDataset, hasEnvironment, hasResult].filter(Boolean).length >= 2) {
    return "partial";
  }

  return "not-enough-information";
}

function buildReadinessRationale(
  artifacts: CodeReproductionArtifact[],
  readiness: CodeReproductionReadiness,
): string[] {
  const rationale: string[] = [];

  if (readiness === "ready-candidate") {
    rationale.push("The paper appears to include enough code, data, environment, command, and result signals for a sandboxed reproduction attempt.");
  } else if (readiness === "partial") {
    rationale.push("The paper includes some reproduction signals, but at least one key ingredient is missing or needs reviewer confirmation.");
  } else {
    rationale.push("The paper does not expose enough code-reproduction signals for a direct reproduction attempt.");
  }

  for (const kind of ["repository", "command", "dataset", "environment", "dependency", "result"] as const) {
    const count = countArtifacts(artifacts, kind);
    rationale.push(`${kind}: ${count > 0 ? `${count} signal(s) found` : "not found"}.`);
  }

  return rationale;
}

function countArtifacts(artifacts: CodeReproductionArtifact[], kind: CodeReproductionArtifactKind): number {
  return artifacts.filter((artifact) => artifact.kind === kind).length;
}

function hasArtifact(artifacts: CodeReproductionArtifact[], kind: CodeReproductionArtifactKind): boolean {
  return artifacts.some((artifact) => artifact.kind === kind);
}

function cleanSnippet(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
