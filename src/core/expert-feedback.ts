import { randomUUID } from "node:crypto";
import type {
  Claim,
  CodeReproductionPlan,
  CodeReproductionStep,
  ExpertFeedback,
  ExpertFeedbackAction,
  ExpertFeedbackControl,
  PromptInjectionScan,
  PromptInjectionWarning,
  ReviewerConcern,
  ReviewerCopilot,
  RiskLevel,
  VisualizationRecommendation,
} from "../types/audit.ts";

const MAX_FEEDBACK_CONTROLS = 32;

export function buildExpertFeedback(input: {
  claims: Claim[];
  promptInjectionScan: PromptInjectionScan;
  codeReproductionPlan: CodeReproductionPlan;
  reviewerCopilot: ReviewerCopilot;
  visualization: VisualizationRecommendation;
}): ExpertFeedback {
  const majorClaimControls = claimControlsFromConcerns(input.claims, input.reviewerCopilot.majorConcerns);
  const codeControls =
    input.codeReproductionPlan.summary.readiness === "not-enough-information"
      ? []
      : input.codeReproductionPlan.steps.map((step) => codeReproductionControl(step, input.codeReproductionPlan));
  const controls = [
    ...majorClaimControls,
    ...input.reviewerCopilot.majorConcerns.flatMap((concern) => concernControls(concern)),
    ...input.reviewerCopilot.minorConcerns.slice(0, 4).map((concern) => minorConcernControl(concern)),
    ...input.promptInjectionScan.warnings.map((warning) => promptInjectionControl(warning)),
    ...codeControls,
    reviewOutlineControl(input.reviewerCopilot),
    visualizationControl(input.visualization),
  ]
    .sort(compareControls)
    .slice(0, MAX_FEEDBACK_CONTROLS);

  return {
    summary: {
      openControlCount: controls.filter((control) => control.status === "open").length,
      highPriorityCount: controls.filter((control) => control.priority === "high").length,
      requiredExpertDecisionCount: controls.filter((control) => requiresExpertDecision(control)).length,
      rationale: buildSummaryRationale(controls),
    },
    controls,
  };
}

function claimControlsFromConcerns(claims: Claim[], concerns: ReviewerConcern[]): ExpertFeedbackControl[] {
  const claimsById = new Map(claims.map((claim) => [claim.id, claim]));
  const claimIds = [...new Set(concerns.map((concern) => concern.claimId))].slice(0, 6);

  return claimIds
    .map((claimId) => {
      const claim = claimsById.get(claimId);

      if (!claim) {
        return undefined;
      }

      return {
        id: randomUUID(),
        targetType: "claim",
        targetId: claim.id,
        label: `Validate claim: ${truncate(claim.text, 80)}`,
        priority: claim.riskLevel ?? "medium",
        status: "open",
        rationale: "Major reviewer concerns depend on this claim, so an expert should confirm its wording, type, and source location.",
        recommendedActions: [
          action("approve", "Accept claim", "Confirm that the extracted claim is accurate and reviewable."),
          action("edit-text", "Edit claim", "Revise the extracted claim text or classification."),
          action("request-evidence", "Request support", "Ask for stronger source support before relying on this claim."),
        ],
        sourceLocation: claim.sourceLocation,
        metadata: {
          claimType: claim.type,
          sectionId: claim.sectionId,
        },
      } satisfies ExpertFeedbackControl;
    })
    .filter(isFeedbackControl);
}

function concernControls(concern: ReviewerConcern): ExpertFeedbackControl[] {
  return [
    {
      id: randomUUID(),
      targetType: "reviewer-concern",
      targetId: concern.id,
      label: `Review major concern: ${concern.title}`,
      priority: concern.riskLevel,
      status: "open",
      rationale: concern.rationale,
      recommendedActions: [
        action("approve", "Accept concern", "Keep this concern in the review and require the suggested action."),
        action("dismiss", "Dismiss concern", "Mark this concern as not applicable after expert review."),
        action("adjust-severity", "Adjust severity", "Change this concern's severity if the local rules over- or under-estimated it."),
        action("request-evidence", "Request evidence", "Ask the author or analyst for direct support for this claim."),
      ],
      sourceLocation: concern.sourceLocation,
      metadata: {
        claimId: concern.claimId,
        claimType: concern.claimType,
        source: concern.source,
      },
    },
  ];
}

function minorConcernControl(concern: ReviewerConcern): ExpertFeedbackControl {
  return {
    id: randomUUID(),
    targetType: "reviewer-concern",
    targetId: concern.id,
    label: `Review minor concern: ${concern.title}`,
    priority: "low",
    status: "open",
    rationale: concern.rationale,
    recommendedActions: [
      action("mark-reviewed", "Mark reviewed", "Confirm this concern has been checked."),
      action("dismiss", "Dismiss concern", "Mark this concern as not applicable."),
      action("edit-text", "Edit wording", "Revise the reviewer-facing wording before export."),
    ],
    sourceLocation: concern.sourceLocation,
    metadata: {
      claimId: concern.claimId,
      claimType: concern.claimType,
      source: concern.source,
    },
  };
}

function promptInjectionControl(warning: PromptInjectionWarning): ExpertFeedbackControl {
  return {
    id: randomUUID(),
    targetType: "prompt-injection-warning",
    targetId: warning.id,
    label: `Inspect prompt-injection warning: ${warning.trigger}`,
    priority: warning.severity,
    status: "open",
    rationale: warning.rationale,
    recommendedActions: [
      action("quarantine", "Quarantine passage", "Keep this passage out of instruction channels and model prompts."),
      action("dismiss", "Dismiss warning", "Mark this warning as benign document content."),
      action("mark-reviewed", "Mark reviewed", "Record that an expert inspected this passage."),
    ],
    metadata: {
      sectionId: warning.sectionId,
      sectionTitle: warning.sectionTitle,
      warningType: warning.warningType,
      matchedText: warning.matchedText,
    },
  };
}

function codeReproductionControl(
  step: CodeReproductionStep,
  plan: CodeReproductionPlan,
): ExpertFeedbackControl {
  const priority = codeStepPriority(step, plan);

  return {
    id: randomUUID(),
    targetType: "code-reproduction-step",
    targetId: step.id,
    label: `Review reproduction step: ${step.title}`,
    priority,
    status: "open",
    rationale: step.description,
    recommendedActions: [
      action("mark-reviewed", "Mark reviewed", "Confirm this reproduction step has been inspected."),
      action("request-evidence", "Request missing artifact", "Ask for the missing repository, command, dataset, or environment detail."),
      action("sandbox-run", "Approve sandbox run", "Allow this step to proceed only inside a sandbox after expert confirmation."),
      action("dismiss", "Mark not applicable", "Treat this step as not applicable for this paper."),
    ],
    metadata: {
      status: step.status,
      artifactIds: step.artifactIds,
      readiness: plan.summary.readiness,
    },
  };
}

function reviewOutlineControl(copilot: ReviewerCopilot): ExpertFeedbackControl {
  return {
    id: randomUUID(),
    targetType: "review-outline",
    targetId: "reviewerCopilot.reviewOutline",
    label: "Approve or edit draft review outline",
    priority: copilot.summary.majorConcernCount > 0 ? "medium" : "low",
    status: "open",
    rationale: "The draft review outline should be expert-reviewed before it is exported or sent to an author.",
    recommendedActions: [
      action("approve", "Approve outline", "Accept the generated outline for export."),
      action("edit-text", "Edit outline", "Revise summary, strengths, issues, revisions, or closing assessment."),
      action("dismiss", "Do not use outline", "Hide this generated outline from the final review package."),
    ],
    metadata: {
      recommendation: copilot.reviewOutline.recommendation,
      majorIssueCount: copilot.reviewOutline.majorIssues.length,
      minorIssueCount: copilot.reviewOutline.minorIssues.length,
    },
  };
}

function visualizationControl(visualization: VisualizationRecommendation): ExpertFeedbackControl {
  return {
    id: randomUUID(),
    targetType: "visualization",
    targetId: visualization.primaryMode,
    label: `Confirm visualization mode: ${visualization.primaryMode}`,
    priority: "low",
    status: "open",
    rationale: "The recommended graph mode should be confirmed because different papers may need different visual layouts.",
    recommendedActions: [
      action("select-visualization", "Use recommended view", "Keep this mode as the primary visualization."),
      action("select-visualization", "Choose alternate view", "Switch to one of the secondary or available visualization modes."),
      action("mark-reviewed", "Mark reviewed", "Record that the visualization choice has been inspected."),
    ],
    metadata: {
      primaryMode: visualization.primaryMode,
      secondaryModes: visualization.secondaryModes,
      confidence: visualization.confidence,
    },
  };
}

function codeStepPriority(step: CodeReproductionStep, plan: CodeReproductionPlan): RiskLevel {
  if (step.status === "missing" && plan.summary.readiness !== "not-enough-information") {
    return "medium";
  }

  if (step.title === "Run reproduction command" && step.status === "available") {
    return "high";
  }

  return step.status === "missing" ? "low" : "medium";
}

function buildSummaryRationale(controls: ExpertFeedbackControl[]): string[] {
  const rationale: string[] = [];
  const highPriorityCount = controls.filter((control) => control.priority === "high").length;
  const revisionControlCount = controls.filter((control) =>
    control.recommendedActions.some((actionItem) => actionItem.actionType === "request-evidence"),
  ).length;

  if (highPriorityCount > 0) {
    rationale.push(`${highPriorityCount} high-priority control(s) should be reviewed before export or execution.`);
  }

  if (revisionControlCount > 0) {
    rationale.push(`${revisionControlCount} control(s) can request more evidence or missing reproduction artifacts.`);
  }

  if (controls.some((control) => control.targetType === "code-reproduction-step")) {
    rationale.push("Code reproduction controls require sandboxing and explicit expert confirmation before execution.");
  }

  if (rationale.length === 0) {
    rationale.push("Only low-priority review controls were generated by the current local rules.");
  }

  return rationale;
}

function compareControls(left: ExpertFeedbackControl, right: ExpertFeedbackControl): number {
  const rightScore = priorityScore(right.priority) + targetWeight(right.targetType);
  const leftScore = priorityScore(left.priority) + targetWeight(left.targetType);

  if (rightScore !== leftScore) {
    return rightScore - leftScore;
  }

  return left.label.localeCompare(right.label);
}

function requiresExpertDecision(control: ExpertFeedbackControl): boolean {
  return (
    control.priority === "high" ||
    control.targetType === "claim" ||
    control.targetType === "reviewer-concern" ||
    control.targetType === "code-reproduction-step"
  );
}

function priorityScore(priority: RiskLevel): number {
  if (priority === "high") {
    return 30;
  }

  if (priority === "medium") {
    return 20;
  }

  return 10;
}

function targetWeight(targetType: ExpertFeedbackControl["targetType"]): number {
  switch (targetType) {
    case "prompt-injection-warning":
      return 8;
    case "code-reproduction-step":
      return 7;
    case "reviewer-concern":
      return 6;
    case "review-outline":
      return 4;
    case "claim":
      return 3;
    case "visualization":
      return 1;
  }
}

function action(
  actionType: ExpertFeedbackAction["actionType"],
  label: string,
  description: string,
): ExpertFeedbackAction {
  return {
    actionType,
    label,
    description,
  };
}

function truncate(value: string, maxLength: number): string {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > maxLength ? `${compact.slice(0, maxLength - 3)}...` : compact;
}

function isFeedbackControl(value: ExpertFeedbackControl | undefined): value is ExpertFeedbackControl {
  return Boolean(value);
}
