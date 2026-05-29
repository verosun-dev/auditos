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

## Phase 1: Claim Graph MVP

Goal: represent the document as a navigable graph rather than only a flat report.

Initial graph objects:

- Document node.
- Section nodes.
- Claim nodes.
- Finding nodes.
- Reviewer question nodes.

Initial graph edges:

- Document contains section.
- Section states claim.
- Claim triggers finding.
- Finding asks reviewer question.

Mindmap note:

- Some documents should also receive a claim-centric mindmap.
- The first version selects the most important claims as primary branches.
- Supporting section context, risk findings, suggested tests, and reviewer questions become child branches.
- Not every document should use the same graph layout; graph rendering should remain layout-adaptive.

## Phase 1: Claim Graph MVP

- Add claim-evidence-assumption graph.
- Link claims to source locations.
- Add claim type classification.
- Add citation-support warnings.
- Add risk heatmap.

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
