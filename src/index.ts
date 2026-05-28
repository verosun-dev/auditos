import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { runInitialAudit } from "./core/pipeline.ts";

const args = process.argv.slice(2);
const inputPath = args[0];
const outputPath = readOption(args, "--out");

if (!inputPath) {
  console.error("Usage: node src/index.ts <document-path> [--out report.json]");
  process.exit(1);
}

const report = await runInitialAudit({
  documentPath: resolve(inputPath),
  domain: "research",
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

function readOption(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}
