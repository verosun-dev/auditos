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
