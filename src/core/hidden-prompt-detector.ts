import { randomUUID } from "node:crypto";
import type {
  AuditDocument,
  PromptInjectionScan,
  PromptInjectionWarning,
  PromptInjectionWarningType,
  RiskLevel,
  Section,
} from "../types/audit.ts";

type PromptInjectionRule = {
  warningType: PromptInjectionWarningType;
  severity: RiskLevel;
  trigger: string;
  pattern: RegExp;
  rationale: string;
  suggestedAction: string;
};

const PROMPT_INJECTION_RULES: PromptInjectionRule[] = [
  {
    warningType: "instruction-override",
    severity: "high",
    trigger: "Instruction override",
    pattern:
      /\b(ignore|disregard|forget|override|bypass)\b[\s\S]{0,80}\b(previous|above|prior|system|developer|assistant|safety|policy|instructions?)\b/i,
    rationale: "The text appears to instruct a model or reviewer to override higher-priority instructions.",
    suggestedAction: "Treat this passage as untrusted document content and prevent it from controlling the audit workflow.",
  },
  {
    warningType: "role-impersonation",
    severity: "medium",
    trigger: "Role impersonation",
    pattern: /\b(you are now|act as|pretend to be)\b[\s\S]{0,80}\b(system|developer|administrator|root|unrestricted|jailbreak)\b/i,
    rationale: "The text appears to assign a new role that could hijack model behavior.",
    suggestedAction: "Preserve the passage for review, but do not execute or obey role instructions embedded in the document.",
  },
  {
    warningType: "secret-exfiltration",
    severity: "high",
    trigger: "Secret exfiltration",
    pattern:
      /\b(reveal|print|exfiltrate|leak|show|send)\b[\s\S]{0,80}\b(api key|secret|token|password|system prompt|hidden prompt|developer message)\b/i,
    rationale: "The text appears to request confidential prompts, credentials, or hidden system information.",
    suggestedAction: "Block the request from tool or model execution and flag it for safety review.",
  },
  {
    warningType: "tool-command-injection",
    severity: "high",
    trigger: "Tool command injection",
    pattern: /\b(run|execute|call|open)\b[\s\S]{0,80}\b(shell|terminal|bash|powershell|curl|sudo|rm -rf|osascript)\b/i,
    rationale: "The text appears to request tool or command execution from inside the document.",
    suggestedAction: "Do not execute embedded commands; isolate the passage and require explicit user confirmation for any tool action.",
  },
  {
    warningType: "hidden-payload-marker",
    severity: "medium",
    trigger: "Hidden payload marker",
    pattern: /\b(invisible|hidden|white text|tiny text|metadata instruction|base64|rot13)\b[\s\S]{0,80}\b(instruction|prompt|message|payload)\b/i,
    rationale: "The text may be describing or carrying a concealed prompt payload.",
    suggestedAction: "Surface the passage in the UI and require reviewer acknowledgement before using nearby text as model context.",
  },
  {
    warningType: "policy-bypass",
    severity: "high",
    trigger: "Policy bypass",
    pattern: /\b(jailbreak|DAN mode|bypass safety|no restrictions|uncensored|ignore safety)\b/i,
    rationale: "The text contains common jailbreak or policy-bypass language.",
    suggestedAction: "Quarantine the passage as untrusted input and keep it out of instruction channels.",
  },
  {
    warningType: "output-control",
    severity: "medium",
    trigger: "Output control",
    pattern: /\b(do not mention|do not disclose|hide this|only output|return exactly)\b[\s\S]{0,80}\b(audit|review|analysis|answer|json)\b/i,
    rationale: "The text appears to constrain the audit output rather than contribute document content.",
    suggestedAction: "Ignore embedded output-format instructions unless they came from the user or application code.",
  },
];

const MAX_WARNINGS = 24;

export function detectHiddenPrompts(document: AuditDocument): PromptInjectionScan {
  const warnings = document.sections
    .flatMap((section) => scanSection(section))
    .sort(compareWarnings)
    .slice(0, MAX_WARNINGS);
  const highSeverityCount = warnings.filter((warning) => warning.severity === "high").length;

  return {
    summary: {
      warningCount: warnings.length,
      highSeverityCount,
      quarantined: highSeverityCount > 0,
      rationale: buildScanRationale(warnings, highSeverityCount),
    },
    warnings,
  };
}

function scanSection(section: Section): PromptInjectionWarning[] {
  const warnings: PromptInjectionWarning[] = [];

  for (const rule of PROMPT_INJECTION_RULES) {
    const match = rule.pattern.exec(section.text);

    if (!match || match.index === undefined) {
      continue;
    }

    const matchedText = snippetAroundMatch(section.text, match.index, match[0].length);

    if (isDescriptiveSecurityDiscussion(rule, section, matchedText)) {
      continue;
    }

    warnings.push({
      id: randomUUID(),
      warningType: rule.warningType,
      severity: rule.severity,
      sectionId: section.id,
      sectionTitle: section.title,
      pageRange: section.pageRange,
      characterRange: [match.index, match.index + match[0].length],
      matchedText,
      trigger: rule.trigger,
      rationale: rule.rationale,
      suggestedAction: rule.suggestedAction,
    });
  }

  return warnings;
}

function isDescriptiveSecurityDiscussion(
  rule: PromptInjectionRule,
  section: Section,
  matchedText: string,
): boolean {
  if (rule.warningType !== "hidden-payload-marker") {
    return false;
  }

  return (
    /\b(prompt injection|defense|safety|governance|copilot|phase)\b/i.test(section.title) &&
    /\b(detect|detection|defense|scan|scanner|should scan|capability|add:|platform|system)\b/i.test(matchedText)
  );
}

function buildScanRationale(warnings: PromptInjectionWarning[], highSeverityCount: number): string[] {
  if (warnings.length === 0) {
    return ["No hidden prompt or prompt-injection patterns were detected by the local scanner."];
  }

  const rationale = [`Detected ${warnings.length} potential prompt-injection warning(s).`];

  if (highSeverityCount > 0) {
    rationale.push(`${highSeverityCount} high-severity warning(s) should be quarantined from instruction channels.`);
  }

  if (warnings.some((warning) => warning.warningType === "tool-command-injection")) {
    rationale.push("At least one passage appears to request tool or command execution.");
  }

  if (warnings.some((warning) => warning.warningType === "secret-exfiltration")) {
    rationale.push("At least one passage appears to request secrets, credentials, or hidden prompts.");
  }

  return rationale;
}

function compareWarnings(left: PromptInjectionWarning, right: PromptInjectionWarning): number {
  const rightScore = severityScore(right.severity);
  const leftScore = severityScore(left.severity);

  if (rightScore !== leftScore) {
    return rightScore - leftScore;
  }

  return left.sectionTitle.localeCompare(right.sectionTitle);
}

function severityScore(severity: RiskLevel): number {
  if (severity === "high") {
    return 3;
  }

  if (severity === "medium") {
    return 2;
  }

  return 1;
}

function snippetAroundMatch(text: string, start: number, length: number): string {
  const snippetStart = Math.max(0, start - 80);
  const snippetEnd = Math.min(text.length, start + length + 80);
  const prefix = snippetStart > 0 ? "..." : "";
  const suffix = snippetEnd < text.length ? "..." : "";
  return `${prefix}${text.slice(snippetStart, snippetEnd).replace(/\s+/g, " ").trim()}${suffix}`;
}
