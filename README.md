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
    claim-graph.ts
    claim-classifier.ts
    claim-extractor.ts
    document-ingestion.ts
    initialize-audit.ts
    pdf-ingestion.ts
    pipeline.ts
    report-generator.ts
    section-parser.ts
    visualization-adapter.ts
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

Run a PDF audit and write a Mermaid mindmap:

```bash
node src/index.ts /path/to/paper.pdf --out reports/paper-audit-report.json --out-mindmap reports/paper-mindmap.mmd
```

The report includes a machine-readable `graph` and a claim-centric `mindmap`. The mindmap is a first-pass view: it selects the highest-risk or most structurally important claims as primary branches, then attaches section context, risk findings, and reviewer questions below each claim.

AuditOS also recommends an adaptive visualization mode in `metadata.visualization`:

- `mindmap` / `claim-tree` for conceptual, review, or theory papers.
- `claim-evidence-graph` for empirical papers.
- `causal-mechanism-map` for policy, social science, or causal inference papers.
- `theorem-dependency-graph` for mathematics and theoretical computer science.
- `workflow-pipeline` for ML, algorithm, or system papers.

Run with explicit heuristic extraction:

```bash
node src/index.ts /path/to/paper.pdf --extractor heuristic --out reports/paper-audit-report.json
```

Run with LLM-backed claim extraction:

```bash
OPENAI_API_KEY=... node src/index.ts /path/to/paper.pdf --extractor llm --model gpt-5.5 --out reports/paper-audit-report.json
```

The default extractor mode is `auto`: it uses LLM-backed extraction when `OPENAI_API_KEY` is set, and falls back to local heuristic extraction otherwise. Use `OPENAI_MODEL` or `--model` to select a different model.

Limit the number of PDF sections sent to the LLM:

```bash
node src/index.ts /path/to/paper.pdf --extractor llm --max-sections 12
```

PDF extraction currently uses Python with `pypdf`. Set `AUDITOS_PYTHON` if your preferred Python environment is not on the default path:

```bash
AUDITOS_PYTHON=/path/to/python3 node src/index.ts /path/to/paper.pdf
```
