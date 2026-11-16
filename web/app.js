const state = {
  report: null,
};

const form = document.querySelector("#auditForm");
const fileInput = document.querySelector("#paperFile");
const statusEl = document.querySelector("#appStatus");
const summaryText = document.querySelector("#summaryText");
const metricGrid = document.querySelector("#metricGrid");
const claimCount = document.querySelector("#claimCount");
const claimsList = document.querySelector("#claimsList");
const majorConcernsList = document.querySelector("#majorConcernsList");
const reviewOutline = document.querySelector("#reviewOutline");
const reviewPosture = document.querySelector("#reviewPosture");
const visualizationSelect = document.querySelector("#visualizationSelect");
const visualizationOutput = document.querySelector("#visualizationOutput");
const documentRisk = document.querySelector("#documentRisk");
const riskList = document.querySelector("#riskList");
const reproReadiness = document.querySelector("#reproReadiness");
const reproSteps = document.querySelector("#reproSteps");
const controlCount = document.querySelector("#controlCount");
const controlsList = document.querySelector("#controlsList");

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => activateView(button.dataset.view));
});

visualizationSelect.addEventListener("change", () => {
  renderSelectedVisualization();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const file = fileInput.files?.[0];

  if (!file) {
    setStatus("Choose file", true);
    return;
  }

  await runAudit(file);
});

async function runAudit(file) {
  setBusy(true);
  setStatus("Running", false);
  summaryText.textContent = "Processing document locally.";

  try {
    const contentBase64 = await fileToBase64(file);
    const response = await fetch("/api/audit", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        fileName: file.name,
        contentBase64,
        extractor: document.querySelector("#extractorMode").value,
        maxSections: readOptionalNumber("#maxSections"),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error ?? "Audit failed");
    }

    state.report = data;
    renderReport(data);
    setStatus("Complete", false);
  } catch (error) {
    setStatus("Error", true);
    summaryText.textContent = error instanceof Error ? error.message : String(error);
  } finally {
    setBusy(false);
  }
}

function renderReport(report) {
  const major = report.reviewerCopilot?.summary?.majorConcernCount ?? 0;
  const controls = report.expertFeedback?.summary?.openControlCount ?? 0;
  const metrics = [
    ["Sections", report.document?.sections?.length ?? 0],
    ["Claims", report.claims?.length ?? 0],
    ["Major", major],
    ["Controls", controls],
  ];

  metricGrid.innerHTML = metrics
    .map(([label, value]) => `<div class="metric"><span>${escapeHtml(label)}</span><strong>${value}</strong></div>`)
    .join("");

  summaryText.textContent = report.summary ?? "Audit complete.";
  renderClaims(report);
  renderReviewer(report);
  renderVisualizations(report);
  renderRisk(report);
  renderReproduction(report);
  renderControls(report);
}

function renderClaims(report) {
  const claims = report.claims ?? [];
  claimCount.textContent = String(claims.length);
  claimsList.innerHTML = claims
    .slice(0, 24)
    .map((claim) =>
      itemHtml({
        title: claim.text,
        badge: claim.type,
        body: claim.sourceLocation?.locator ?? claim.sectionId,
      }),
    )
    .join("");
}

function renderReviewer(report) {
  const copilot = report.reviewerCopilot;
  reviewPosture.textContent = copilot?.summary?.recommendedReviewPosture ?? "pending";
  majorConcernsList.innerHTML = (copilot?.majorConcerns ?? [])
    .slice(0, 12)
    .map((concern) =>
      itemHtml({
        title: concern.title,
        badge: concern.riskLevel,
        badgeClass: concern.riskLevel,
        body: concern.reviewerQuestion,
      }),
    )
    .join("");

  const outline = copilot?.reviewOutline;

  if (!outline) {
    reviewOutline.innerHTML = "";
    return;
  }

  reviewOutline.innerHTML = [
    `<div class="item"><div class="item-title">${escapeHtml(outline.recommendation)}</div><p>${escapeHtml(outline.executiveSummary)}</p></div>`,
    `<div class="item"><div class="item-title">Required revisions</div><ul>${outline.requiredRevisions
      .map((revision) => `<li>${escapeHtml(revision)}</li>`)
      .join("")}</ul></div>`,
  ].join("");
}

function renderVisualizations(report) {
  const diagrams = report.visualizationDiagrams ?? [];
  visualizationSelect.innerHTML = diagrams
    .map((diagram) => `<option value="${escapeHtml(diagram.mode)}">${escapeHtml(diagram.title)}</option>`)
    .join("");

  const primaryMode = report.metadata?.visualization?.primaryMode;

  if (primaryMode) {
    visualizationSelect.value = primaryMode;
  }

  renderSelectedVisualization();
}

function renderSelectedVisualization() {
  const diagrams = state.report?.visualizationDiagrams ?? [];
  const selected = diagrams.find((diagram) => diagram.mode === visualizationSelect.value) ?? diagrams[0];
  visualizationOutput.textContent = selected?.mermaid ?? "";
}

function renderRisk(report) {
  const heatmap = report.riskHeatmap;
  documentRisk.textContent = heatmap?.document?.riskLevel ?? "pending";
  riskList.innerHTML = (heatmap?.bySection ?? [])
    .slice(0, 12)
    .map((cell) =>
      itemHtml({
        title: cell.label,
        badge: `${cell.riskLevel} ${cell.riskScore}`,
        badgeClass: cell.riskLevel,
        body: (cell.topRisks ?? []).join(", ") || "No top risk",
      }),
    )
    .join("");
}

function renderReproduction(report) {
  const plan = report.codeReproductionPlan;
  reproReadiness.textContent = plan?.summary?.readiness ?? "pending";
  reproSteps.innerHTML = (plan?.steps ?? [])
    .map((step) =>
      itemHtml({
        title: step.title,
        badge: step.status,
        body: step.description,
      }),
    )
    .join("");
}

function renderControls(report) {
  const feedback = report.expertFeedback;
  controlCount.textContent = String(feedback?.summary?.openControlCount ?? 0);
  controlsList.innerHTML = (feedback?.controls ?? [])
    .slice(0, 24)
    .map((control) =>
      itemHtml({
        title: control.label,
        badge: control.priority,
        badgeClass: control.priority,
        body: `${control.targetType} | ${control.recommendedActions.map((action) => action.label).join(", ")}`,
      }),
    )
    .join("");
}

function itemHtml({ title, badge, badgeClass = "", body }) {
  return `
    <article class="item">
      <div class="item-title">
        <span>${escapeHtml(title ?? "")}</span>
        <span class="badge ${escapeHtml(badgeClass)}">${escapeHtml(badge ?? "")}</span>
      </div>
      <p>${escapeHtml(body ?? "")}</p>
    </article>
  `;
}

function activateView(name) {
  document.querySelectorAll(".tab").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === name);
  });
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("is-active", view.id === `${name}View`);
  });
}

function setBusy(isBusy) {
  form.querySelector("button").disabled = isBusy;
}

function setStatus(text, isError) {
  statusEl.textContent = text;
  statusEl.style.color = isError ? "#b4512a" : "";
}

function readOptionalNumber(selector) {
  const value = document.querySelector(selector).value;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

async function fileToBase64(file) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const chunkSize = 32_768;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
