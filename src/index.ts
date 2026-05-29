import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { runInitialAudit } from "./core/pipeline.ts";

const args = process.argv.slice(2);
const inputPath = args[0];
const outputPath = readOption(args, "--out");
const mindmapOutputPath = readOption(args, "--out-mindmap");
const visualizationOutputPath = readOption(args, "--out-visualization");
const claimExtractionMode = readOption(args, "--extractor");
const claimExtractionModel = readOption(args, "--model");
const claimExtractionMaxSections = readNumberOption(args, "--max-sections");

if (!inputPath) {
  console.error(
    "Usage: node src/index.ts <document-path> [--out report.json] [--out-mindmap mindmap.mmd] [--out-visualization visualization.mmd] [--extractor auto|heuristic|llm] [--model model-name] [--max-sections n]",
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
    await mkdir(dirname(resolvedVisualizationOutputPath), { recursive: true });
    await writeFile(resolvedVisualizationOutputPath, report.primaryVisualizationMermaid, "utf8");
    console.error(`Wrote primary visualization to ${resolvedVisualizationOutputPath}`);
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
