# AuditOS

AuditOS is a research-reviewer prototype for auditing high-stakes knowledge claims.

The first milestone is **AuditOS Research Reviewer**: a local MVP that accepts a paper, extracts its structure and major claims, flags reasoning and methodology risks, generates reviewer-style questions, and exports an audit report.

## MVP Scope

- Ingest a research document.
- Parse sections.
- Extract main claims.
- Classify claims by type.
- Run discipline-aware audit checks.
- Generate reviewer questions.
- Produce a traceable audit report.

## Out of Scope for the First Prototype

- Full external evidence retrieval.
- Legal, clinical, finance, and policy modules.
- Full claim graph visualization.
- Simulation dashboards.
- Formal proof verification.

## Project Structure

```txt
src/
  adapters/
    research-reviewer.ts
  core/
    audit-engine.ts
    claim-classifier.ts
    claim-extractor.ts
    initialize-audit.ts
    pipeline.ts
    report-generator.ts
    section-parser.ts
  types/
    audit.ts
```

## First Development Path

1. Make `initializeAuditSession` create the audit workspace.
2. Make `runInitialAudit` pass data through the pipeline.
3. Replace the placeholder section parser with PDF extraction.
4. Replace heuristic claim extraction with an LLM-backed extractor.
5. Add a claim-evidence graph and report exporter.

## Run Locally

Run the sample text audit:

```bash
node src/index.ts examples/sample-paper.txt
```

Run a PDF audit and write a local report:

```bash
node src/index.ts /path/to/paper.pdf --out reports/paper-audit-report.json
```

PDF extraction currently uses Python with `pypdf`. Set `AUDITOS_PYTHON` if your preferred Python environment is not on the default path:

```bash
AUDITOS_PYTHON=/path/to/python3 node src/index.ts /path/to/paper.pdf
```
