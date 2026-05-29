import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { runInitialAudit } from "./core/pipeline.ts";
import type { VisualizationMode } from "./types/audit.ts";

const args = process.argv.slice(2);
const inputPath = args[0];
const outputPath = readOption(args, "--out");
const mindmapOutputPath = readOption(args, "--out-mindmap");
const visualizationOutputPath = readOption(args, "--out-visualization");
const visualizationOutputMode = parseVisualizationMode(readOption(args, "--out-visualization-mode"));
const claimExtractionMode = readOption(args, "--extractor");
const claimExtractionModel = readOption(args, "--model");
const claimExtractionMaxSections = readNumberOption(args, "--max-sections");

if (!inputPath) {
  console.error(
    "Usage: node src/index.ts <document-path> [--out report.json] [--out-mindmap mindmap.mmd] [--out-visualization visualization.mmd] [--out-visualization-mode mode] [--extractor auto|heuristic|llm] [--model model-name] [--max-sections n]",
  );
  process.exit(1);
}

try {
  const report = await runInitialAudit({
    documentPath: resolve(inputPath),
    domain: "research",
    claimExtractionMode: parseClaimExtractionMode(claimExtractionMode),
    claimExtractionModel,
    claimExtractionMaxSections,
  });

  const serializedReport = JSON.stringify(report, null, 2);

  if (outputPath) {
    const resolvedOutputPath = resolve(outputPath);
    await mkdir(dirname(resolvedOutputPath), { recursive: true });
    await writeFile(resolvedOutputPath, `${serializedReport}\n`, "utf8");
    console.error(`Wrote audit report to ${resolvedOutputPath}`);
  } else {
    console.log(serializedReport);
  }

  if (mindmapOutputPath) {
    const resolvedMindmapOutputPath = resolve(mindmapOutputPath);
    await mkdir(dirname(resolvedMindmapOutputPath), { recursive: true });
    await writeFile(resolvedMindmapOutputPath, report.mindmapMermaid, "utf8");
    console.error(`Wrote mindmap to ${resolvedMindmapOutputPath}`);
  }

  if (visualizationOutputPath) {
    const resolvedVisualizationOutputPath = resolve(visualizationOutputPath);
    const visualizationMermaid = visualizationOutputMode
      ? findVisualizationMermaid(report.visualizationDiagrams, visualizationOutputMode)
      : report.primaryVisualizationMermaid;
    await mkdir(dirname(resolvedVisualizationOutputPath), { recursive: true });
    await writeFile(resolvedVisualizationOutputPath, visualizationMermaid, "utf8");
    console.error(`Wrote ${visualizationOutputMode ?? "primary"} visualization to ${resolvedVisualizationOutputPath}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

function readOption(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function readNumberOption(args: string[], name: string): number | undefined {
  const value = readOption(args, name);

  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function parseClaimExtractionMode(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  if (value === "auto" || value === "heuristic" || value === "llm") {
    return value;
  }

  throw new Error(`Unknown claim extractor mode: ${value}`);
}

function parseVisualizationMode(value: string | undefined): VisualizationMode | undefined {
  if (!value) {
    return undefined;
  }

  if (
    value === "mindmap" ||
    value === "claim-tree" ||
    value === "claim-evidence-graph" ||
    value === "causal-mechanism-map" ||
    value === "theorem-dependency-graph" ||
    value === "workflow-pipeline" ||
    value === "code-reproduction-map"
  ) {
    return value;
  }

  throw new Error(`Unknown visualization mode: ${value}`);
}

function findVisualizationMermaid(
  diagrams: Array<{ mode: VisualizationMode; mermaid: string }>,
  mode: VisualizationMode,
): string {
  const diagram = diagrams.find((candidate) => candidate.mode === mode);

  if (!diagram) {
    throw new Error(`Visualization mode was not generated: ${mode}`);
  }

  return diagram.mermaid;
}
