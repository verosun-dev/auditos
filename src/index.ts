import { resolve } from "node:path";
import { runInitialAudit } from "./core/pipeline.ts";

const inputPath = process.argv[2];

if (!inputPath) {
  console.error("Usage: npm run audit:sample or tsx src/index.ts <document-path>");
  process.exit(1);
}

const report = await runInitialAudit({
  documentPath: resolve(inputPath),
  domain: "research",
});

console.log(JSON.stringify(report, null, 2));
