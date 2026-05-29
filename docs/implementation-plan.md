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

Current implementation:

- `reviewer-copilot.ts` classifies findings and citation-support warnings into major and minor reviewer concerns.
- Reports include `reviewerCopilot.summary`, `reviewerCopilot.majorConcerns`, and `reviewerCopilot.minorConcerns`.
- Reports include `reviewerCopilot.reviewOutline`, a draft review structure with summary, strengths, major issues, minor issues, required revisions, and closing assessment.
- `hidden-prompt-detector.ts` scans document sections for first-pass prompt-injection and hidden-instruction patterns.
- Reports include `promptInjectionScan.summary` and `promptInjectionScan.warnings`.

Remaining Phase 2 work:

- Add expert feedback controls.

## Web App and Interface Track

Goal: turn the audit engine into a usable product experience where a user can upload a paper, inspect the audit, switch visualizations, and act on reviewer guidance.

This track corresponds to the PDF's `5.8 Layer 8: User Interface and Workflow`.

Core screens:

- Document upload and audit initialization.
- Audit run status and extraction progress.
- Document reader with source-location anchors.
- Claim list and claim detail drawer.
- Adaptive visualization panel with `mindmap`, `claim-tree`, `claim-evidence-graph`, `causal-mechanism-map`, `theorem-dependency-graph`, and `workflow-pipeline` tabs.
- Risk heatmap dashboard.
- Reviewer Copilot panel with major/minor concerns and draft review outline.
- Export panel for JSON, Mermaid, and review outline artifacts.

Implementation steps:

- Add a local API boundary around `runInitialAudit`.
- Add a frontend app shell.
- Add a PDF/text upload workflow.
- Render audit summary, claims, findings, evidence candidates, assumptions, and source locations.
- Render Mermaid visualizations from `visualizationDiagrams` and `primaryVisualizationMermaid`.
- Render `riskHeatmap` as dashboard tiles and grouped tables.
- Render `reviewerCopilot` as a reviewer workspace.
- Add loading, empty, error, and rerun states.
- Add local sample fixtures so the UI can be tested without repeatedly processing the PDF.

Status:

- Backend report fields needed by the first UI are now present.
- The frontend app has not started yet.

## Phase 3: Testing and Simulation

- Generate robustness-check suggestions.
- Produce replication notebook skeletons.
- Extract causal graph candidates.
- Add sensitivity analysis templates.

## Phase 4: Math and Theory Workspace

Goal: support the PDF's math/theory direction beyond general claim auditing.

- Extract definitions, lemmas, propositions, theorems, assumptions, and proof dependencies.
- Generate proof-gap cards.
- Add theorem dependency graph refinements.
- Add mathematical stress-test suggestions.
- Keep formal proof verification out of scope until the surrounding workflow is stable.

## Phase 5: Professional Modules

Goal: extend AuditOS beyond the initial research-reviewer MVP into domain-specific audit workflows.

- Finance and investment research stress cards.
- Law-oriented argument and authority checks.
- Medicine and clinical research caution boundaries.
- Policy research causal and implementation-risk checks.
- Enterprise knowledge audit workflows.

## Safety, Privacy, and Governance Track

Goal: make the system safe enough for high-stakes document review.

- Add prompt-injection detection and quarantine behavior.
- Prompt-injection detection is implemented as a first-pass local scanner; quarantine is represented in `promptInjectionScan.summary.quarantined`.
- Keep professional boundary warnings visible in domain-specific modules.
- Add audit transparency metadata showing which parts are heuristic, LLM-generated, or user-reviewed.
- Avoid storing uploaded documents outside the local workspace in the prototype.

## Coverage Check Against `AuditOS.pdf`

Covered in code:

- Document ingestion.
- PDF extraction.
- Document structure parsing.
- Claim extraction.
- Claim graph construction.
- Evidence candidates.
- Assumption extraction.
- Citation-support warnings.
- Audit findings.
- Risk heatmap.
- Adaptive visualization recommendation and Mermaid rendering.
- Reviewer Copilot concern classification.
- Draft review outline.
- First-pass hidden prompt and prompt-injection detection.

Partially covered:

- Evidence retrieval and authority ranking: current implementation uses local evidence candidates, not external retrieval or authority ranking.
- Audit engines: causal, numerical, methodological, and normative checks exist as first-pass rules; statistical, mathematical, finance, law, clinical, and policy engines are not complete.
- Testing and simulation: planned but not implemented.
- User interface and workflow: planned here, not implemented yet.
- Safety and governance: prompt-injection detection exists as a local scanner, but deeper quarantine workflow and governance UX are not implemented.

Not yet covered:

- Full external evidence retrieval.
- Formal math/theory workspace.
- Professional modules for finance, law, medicine, policy, and enterprise use.
- Full web application experience.
