# AuditOS Implementation Plan

## Phase 0: Prototype

Goal: turn one research document into a useful reviewer-style audit.

Inputs:

- PDF or extracted text.
- Optional metadata such as title, domain, and author notes.

Outputs:

- Structured paper summary.
- Main claim list.
- Methodology and reasoning risk flags.
- Reviewer-style questions.
- Reproducibility checklist.
- Exportable audit report.

Current status:

- Text ingestion is working.
- PDF ingestion is working through a local `pypdf` extractor.
- The pipeline produces sections, claims, risk findings, reviewer questions, and a reproducibility checklist.
- Claim extraction supports `auto`, `heuristic`, and `llm` modes.
- Claim graph and claim-centric mindmap outputs are working.

## Phase 1: Adaptive Visualization Graph MVP

Goal: represent the document as a navigable graph rather than only a flat report.

Initial graph objects:

- Document node.
- Section nodes.
- Claim nodes.
- Evidence candidate nodes.
- Assumption nodes.
- Finding nodes.
- Reviewer question nodes.

Initial graph edges:

- Document contains section.
- Section states claim.
- Claim is supported by candidate evidence.
- Claim depends on candidate assumptions.
- Claim triggers finding.
- Finding asks reviewer question.

Mindmap note:

- Some documents should also receive a claim-centric mindmap.
- The first version selects the most important claims as primary branches.
- Supporting section context, risk findings, suggested tests, and reviewer questions become child branches.
- Not every document should use the same graph layout; graph rendering should remain layout-adaptive.

Adaptive visualization modes:

| Document type | Visualization mode | Primary use |
| --- | --- | --- |
| Review, conceptual, theoretical, or clearly structured essay | `mindmap` / `claim-tree` | Show main claims as branches with supporting details below them. |
| Empirical paper | `claim-evidence-graph` | Show how claims are supported by methods, tables, figures, data, and citations. |
| Policy, social science, or causal inference paper | `causal-mechanism-map` | Show treatment, mechanism, outcome, confounders, assumptions, and external-validity boundaries. |
| Mathematics or theoretical computer science paper | `theorem-dependency-graph` | Show definitions, lemmas, propositions, theorems, assumptions, and proof dependencies. |
| ML, algorithm, or system paper | `workflow-pipeline` | Show data, preprocessing, model, training, evaluation, baselines, ablations, and deployment path. |

Current implementation:

- `visualization-adapter.ts` recommends a primary visualization mode.
- Reports include the recommendation in `metadata.visualization`.
- `visualization-renderer.ts` renders Mermaid variants for each adaptive visualization mode.
- Reports include `visualizationDiagrams` for mode switching and `primaryVisualizationMermaid` for the recommended view.
- `evidence-extractor.ts` generates local evidence candidates from source sections.
- `assumption-extractor.ts` generates candidate assumptions from claim type.
- Reports include `evidenceCandidates` and `assumptions`.
- Claims include source locations with section, page range, sentence index, and character range where available.
- `citation-support-engine.ts` generates first-pass warnings for missing, weak, or mismatched evidence support.
- `risk-heatmap.ts` aggregates findings and citation-support warnings by document, section, claim type, and highest-risk claims.

Remaining Phase 1 work:

- Phase 1 MVP is complete. Next work begins in Phase 2: Reviewer Copilot.

## Phase 2: Reviewer Copilot

- Generate major/minor concern classification.
- Draft review outline.
- Add hidden prompt detection.
- Add expert feedback controls.

## Phase 3: Testing and Simulation

- Generate robustness-check suggestions.
- Produce replication notebook skeletons.
- Extract causal graph candidates.
- Add sensitivity analysis templates.
