import {
  buildAICAuthoringPatchPlan,
  renderAICAuthoringPatchPlanSummary
} from "@aicorg/spec";

const SNAPSHOT_EVENT = "aic:devtools:snapshot";

export const extensionManifest = {
  manifest_version: 3,
  name: "AIC Devtools",
  version: "0.2.0",
  description: "Inspect runtime AIC metadata in the current page.",
  action: {
    default_popup: "popup.html",
    default_title: "AIC Devtools"
  },
  background: {
    service_worker: "service-worker.js",
    type: "module"
  },
  content_scripts: [
    {
      js: ["content-script.js"],
      matches: ["<all_urls>"],
      run_at: "document_start"
    }
  ],
  devtools_page: "devtools.html",
  host_permissions: ["<all_urls>"],
  permissions: ["activeTab", "storage", "tabs"]
} as const;

const popupHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>AIC Devtools</title>
    <style>
      :root {
        color-scheme: dark;
        font-family: "Segoe UI", sans-serif;
      }
      body {
        background: linear-gradient(180deg, #07111a 0%, #0f172a 100%);
        color: #e2e8f0;
        margin: 0;
        min-height: 100vh;
        width: 360px;
      }
      main {
        display: grid;
        gap: 12px;
        padding: 16px;
      }
      .panel {
        background: rgba(15, 23, 42, 0.72);
        border: 1px solid rgba(148, 163, 184, 0.22);
        border-radius: 16px;
        padding: 12px;
      }
      h1 {
        font-size: 16px;
        letter-spacing: 0.06em;
        margin: 0 0 4px;
        text-transform: uppercase;
      }
      p, li, code, button, pre {
        font-size: 12px;
      }
      p {
        color: #94a3b8;
        margin: 0;
      }
      button {
        background: #0f766e;
        border: 0;
        border-radius: 999px;
        color: white;
        cursor: pointer;
        font-weight: 700;
        padding: 8px 12px;
      }
      button[disabled] {
        cursor: not-allowed;
        opacity: 0.45;
      }
      .actions {
        display: flex;
        gap: 8px;
      }
      .status {
        border-radius: 12px;
        padding: 10px 12px;
      }
      .status[data-tone="error"] {
        background: rgba(127, 29, 29, 0.45);
        color: #fecaca;
      }
      .status[data-tone="ok"] {
        background: rgba(6, 78, 59, 0.45);
        color: #bbf7d0;
      }
      .status[data-tone="neutral"] {
        background: rgba(30, 41, 59, 0.7);
        color: #cbd5e1;
      }
      ul {
        display: grid;
        gap: 8px;
        list-style: none;
        margin: 0;
        max-height: 160px;
        overflow: auto;
        padding: 0;
      }
      li {
        background: rgba(255, 255, 255, 0.04);
        border-radius: 10px;
        padding: 10px;
      }
      pre {
        background: rgba(255, 255, 255, 0.04);
        border-radius: 12px;
        margin: 0;
        max-height: 180px;
        overflow: auto;
        padding: 10px;
        white-space: pre-wrap;
        word-break: break-word;
      }
      code {
        color: #7dd3fc;
      }
      .muted {
        color: #94a3b8;
      }
    </style>
  </head>
  <body>
    <main>
      <section class="panel">
        <h1>AIC Devtools</h1>
        <p>Quick status for the active tab. Open the browser DevTools panel for the full inspector.</p>
      </section>

      <section class="panel status" data-tone="neutral" id="status">Waiting for active tab...</section>

      <section class="panel">
        <div class="actions">
          <button id="refresh" type="button">Refresh</button>
          <button id="open-endpoint" type="button" disabled>Open Endpoint</button>
          <button id="copy-json" type="button" disabled>Copy JSON</button>
        </div>
      </section>

      <section class="panel">
        <p id="meta">No manifest loaded yet.</p>
        <p class="muted" id="source">No connection yet.</p>
      </section>

      <section class="panel">
        <ul id="elements">
          <li>No runtime elements discovered yet.</li>
        </ul>
      </section>

      <section class="panel">
        <pre id="json">Awaiting manifest fetch...</pre>
      </section>
    </main>

    <script src="popup.js" type="module"></script>
  </body>
</html>`;

const popupJs = `const state = {
  endpoint: undefined,
  manifest: undefined,
  pageUrl: undefined,
  sourceLabel: "No connection yet."
};

const statusNode = document.getElementById("status");
const metaNode = document.getElementById("meta");
const sourceNode = document.getElementById("source");
const elementsNode = document.getElementById("elements");
const jsonNode = document.getElementById("json");
const refreshButton = document.getElementById("refresh");
const openEndpointButton = document.getElementById("open-endpoint");
const copyJsonButton = document.getElementById("copy-json");

function setStatus(message, tone = "neutral") {
  statusNode.textContent = message;
  statusNode.dataset.tone = tone;
}

function setButtonsEnabled(enabled) {
  openEndpointButton.disabled = !enabled;
  copyJsonButton.disabled = !enabled;
}

function buildEndpoint(tabUrl) {
  const url = new URL(tabUrl);
  return new URL("/.well-known/agent/ui", url.origin).toString();
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

async function getStoredSnapshot(tabId) {
  const response = await chrome.runtime.sendMessage({
    tabId,
    type: "aic:get-tab-snapshot"
  });
  return response?.snapshot ?? null;
}

function renderManifest(manifest) {
  const viewId = manifest?.view?.view_id || "unknown";
  const pageUrl = manifest?.page?.url || state.pageUrl || "unknown";
  const elements = Array.isArray(manifest?.elements) ? manifest.elements : [];

  metaNode.textContent = viewId + " · " + elements.length + " element(s) · " + pageUrl;
  sourceNode.textContent = state.sourceLabel;
  elementsNode.innerHTML = "";

  if (elements.length === 0) {
    const emptyNode = document.createElement("li");
    emptyNode.textContent = "The endpoint responded, but it did not include any elements.";
    elementsNode.appendChild(emptyNode);
  } else {
    elements.slice(0, 12).forEach((element) => {
      const item = document.createElement("li");
      const entity =
        element?.entity_ref?.entity_type && element?.entity_ref?.entity_id
          ? " -> " + element.entity_ref.entity_type + ":" + element.entity_ref.entity_id
          : "";
      item.textContent = element.role + " " + element.id + " [" + element.risk + "]" + entity;
      elementsNode.appendChild(item);
    });
  }

  jsonNode.textContent = JSON.stringify(manifest, null, 2);
}

async function loadManifest() {
  setStatus("Inspecting active tab...", "neutral");
  setButtonsEnabled(false);

  try {
    const activeTab = await getActiveTab();

    if (!activeTab || !activeTab.id || !activeTab.url) {
      throw new Error("No active tab URL is available.");
    }

    state.pageUrl = activeTab.url;
    state.endpoint = buildEndpoint(activeTab.url);

    const storedSnapshot = await getStoredSnapshot(activeTab.id);

    if (storedSnapshot?.manifest) {
      state.manifest = storedSnapshot.manifest;
      state.sourceLabel =
        "Live bridge snapshot · " + (storedSnapshot.captured_at || "unknown timestamp");
      renderManifest(state.manifest);
      setButtonsEnabled(true);
      setStatus("Loaded live registry snapshot from active tab.", "ok");
      return;
    }

    const response = await fetch(state.endpoint, {
      headers: {
        accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error("Runtime endpoint returned " + response.status + ".");
    }

    state.manifest = await response.json();
    state.sourceLabel = "Endpoint fallback · " + state.endpoint;
    renderManifest(state.manifest);
    setButtonsEnabled(true);
    setStatus("Loaded runtime manifest from endpoint fallback.", "ok");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown extension error";
    metaNode.textContent = state.endpoint
      ? "Tried " + state.endpoint
      : "Unable to resolve endpoint for the active tab.";
    sourceNode.textContent = "No live bridge snapshot or endpoint manifest was available.";
    elementsNode.innerHTML = "<li>Mount AICDevtoolsBridge in the app or expose /.well-known/agent/ui.</li>";
    jsonNode.textContent = message;
    setStatus(message, "error");
  }
}

refreshButton.addEventListener("click", () => {
  void loadManifest();
});

openEndpointButton.addEventListener("click", () => {
  if (state.endpoint) {
    void chrome.tabs.create({ url: state.endpoint });
  }
});

copyJsonButton.addEventListener("click", async () => {
  if (!state.manifest) {
    return;
  }

  await navigator.clipboard.writeText(JSON.stringify(state.manifest, null, 2));
  setStatus("Manifest JSON copied to clipboard.", "ok");
});

void loadManifest();
`;

const devtoolsHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>AIC Devtools</title>
    <script src="devtools.js" type="module"></script>
  </head>
  <body></body>
</html>`;

const devtoolsJs = `chrome.devtools.panels.create("AIC Inspector", "", "panel.html");
`;

const panelHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>AIC Inspector</title>
    <style>
      :root {
        color-scheme: dark;
        font-family: "Segoe UI", sans-serif;
      }
      body {
        background: #0b1120;
        color: #e2e8f0;
        margin: 0;
      }
      main {
        display: grid;
        gap: 12px;
        min-height: 100vh;
        padding: 12px;
      }
      .view-grid {
        display: grid;
        gap: 12px;
        grid-template-columns: minmax(260px, 320px) minmax(320px, 1fr) minmax(320px, 1fr);
      }
      .panel {
        background: rgba(15, 23, 42, 0.84);
        border: 1px solid rgba(148, 163, 184, 0.2);
        border-radius: 16px;
        display: grid;
        gap: 12px;
        padding: 12px;
      }
      .wide {
        grid-column: 1 / -1;
      }
      .hidden {
        display: none !important;
      }
      h1, h2 {
        margin: 0;
      }
      h1 {
        font-size: 16px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      h2 {
        font-size: 13px;
      }
      p, label, button, input, select, li, code, pre, summary {
        font-size: 12px;
      }
      p {
        color: #94a3b8;
        margin: 0;
      }
      .row {
        align-items: center;
        display: flex;
        gap: 8px;
      }
      .row.wrap {
        flex-wrap: wrap;
      }
      button {
        background: #0f766e;
        border: 0;
        border-radius: 999px;
        color: white;
        cursor: pointer;
        font-weight: 700;
        padding: 8px 12px;
      }
      button.secondary {
        background: #1e293b;
      }
      button[data-active="true"] {
        box-shadow: 0 0 0 1px rgba(125, 211, 252, 0.8) inset;
      }
      input, select {
        background: rgba(15, 23, 42, 0.9);
        border: 1px solid rgba(148, 163, 184, 0.22);
        border-radius: 10px;
        color: #e2e8f0;
        min-width: 0;
        padding: 8px 10px;
      }
      ul {
        display: grid;
        gap: 8px;
        list-style: none;
        margin: 0;
        max-height: 60vh;
        overflow: auto;
        padding: 0;
      }
      li {
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid transparent;
        border-radius: 12px;
        cursor: pointer;
        padding: 10px;
      }
      li[data-active="true"] {
        border-color: rgba(56, 189, 248, 0.8);
      }
      .badge {
        border-radius: 999px;
        display: inline-flex;
        padding: 4px 8px;
      }
      .badge[data-tone="bridge"] {
        background: rgba(6, 78, 59, 0.55);
        color: #bbf7d0;
      }
      .badge[data-tone="endpoint"] {
        background: rgba(30, 64, 175, 0.55);
        color: #bfdbfe;
      }
      .badge[data-tone="disconnected"] {
        background: rgba(127, 29, 29, 0.55);
        color: #fecaca;
      }
      pre {
        background: rgba(255, 255, 255, 0.04);
        border-radius: 12px;
        margin: 0;
        max-height: 60vh;
        overflow: auto;
        padding: 12px;
        white-space: pre-wrap;
        word-break: break-word;
      }
      .muted {
        color: #94a3b8;
      }
      .stack {
        display: grid;
        gap: 10px;
      }
      .stats {
        display: grid;
        gap: 6px;
      }
    </style>
  </head>
  <body>
    <main>
      <section class="panel wide">
        <div class="row wrap" style="justify-content: space-between;">
          <div class="stack">
            <h1>AIC Inspector</h1>
            <p id="meta">Waiting for inspected tab...</p>
            <div class="row wrap">
              <span class="badge" data-tone="disconnected" id="connection-badge">disconnected</span>
              <span class="muted" id="connection-detail">No live snapshot yet.</span>
            </div>
          </div>
          <div class="row wrap">
            <button id="inspect-tab" data-active="true" type="button">Inspect</button>
            <button class="secondary" id="author-tab" data-active="false" type="button">Author</button>
            <button id="refresh" type="button">Refresh</button>
            <button class="secondary" id="collect-dom" type="button">Collect DOM</button>
            <button class="secondary" id="capture-baseline" type="button">Capture Baseline</button>
            <button class="secondary" id="copy-json" type="button">Copy Snapshot</button>
            <button class="secondary" id="copy-diff" type="button">Copy Diff</button>
            <label class="row">
              <input checked id="auto-refresh" type="checkbox" />
              Auto refresh
            </label>
          </div>
        </div>
      </section>

      <section class="panel wide">
        <div class="row wrap">
          <button class="secondary" id="import-report" type="button">Import report.json</button>
          <button class="secondary" id="import-bootstrap" type="button">Import bootstrap review</button>
          <button class="secondary" id="copy-plan" type="button">Copy Plan JSON</button>
          <button class="secondary" id="download-plan" type="button">Download Plan</button>
          <button class="secondary" id="copy-summary" type="button">Copy Summary</button>
          <input class="hidden" id="report-file" accept="application/json" type="file" />
          <input class="hidden" id="bootstrap-file" accept="application/json" type="file" />
        </div>
      </section>

      <div class="view-grid" id="inspect-view">
        <section class="panel">
          <div class="stack">
            <h2>Filters</h2>
            <input id="query" placeholder="Search id, label, entity..." type="search" />
            <select id="risk-filter">
              <option value="all">All risks</option>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
              <option value="critical">critical</option>
            </select>
            <select id="role-filter">
              <option value="all">All roles</option>
              <option value="button">button</option>
              <option value="link">link</option>
              <option value="input">input</option>
              <option value="searchbox">searchbox</option>
              <option value="select">select</option>
              <option value="form">form</option>
              <option value="dialog">dialog</option>
              <option value="table">table</option>
              <option value="row">row</option>
              <option value="generic">generic</option>
            </select>
          </div>

          <div class="stack">
            <h2>Elements</h2>
            <ul id="elements">
              <li>No elements loaded yet.</li>
            </ul>
          </div>
        </section>

        <section class="panel">
          <div class="stack">
            <h2>Selected Element</h2>
            <pre id="element-json">Pick an element from the list.</pre>
          </div>
          <div class="stack">
            <h2>Snapshot Diff</h2>
            <pre id="diff-json">Capture a baseline to compare future snapshots.</pre>
          </div>
        </section>

        <section class="panel">
          <div class="stack">
            <h2>Raw Snapshot</h2>
            <pre id="raw-json">Awaiting snapshot...</pre>
          </div>
        </section>
      </div>

      <div class="view-grid hidden" id="author-view">
        <section class="panel">
          <div class="stack">
            <h2>Authoring Inputs</h2>
            <div class="stats" id="authoring-sources"></div>
          </div>

          <div class="stack">
            <h2>Proposal Filters</h2>
            <input id="proposal-query" placeholder="Search proposal id, label, file..." type="search" />
            <select id="proposal-filter">
              <option value="all">All proposals</option>
              <option value="ready">ready</option>
              <option value="apply-ready">apply-ready</option>
              <option value="unresolved">unresolved</option>
              <option value="source-backed">source-backed</option>
              <option value="bootstrap-backed">bootstrap-backed</option>
              <option value="ignored">ignored</option>
            </select>
            <select id="proposal-risk-filter">
              <option value="all">All risks</option>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
              <option value="critical">critical</option>
            </select>
          </div>

          <div class="stack">
            <h2>Proposals</h2>
            <ul id="proposal-list">
              <li>No authoring proposals generated yet.</li>
            </ul>
          </div>
        </section>

        <section class="panel">
          <div class="stack">
            <h2>Selected Proposal</h2>
            <pre id="proposal-json">Select a proposal from the list.</pre>
          </div>
          <div class="stack">
            <h2>Snippet Preview</h2>
            <pre id="proposal-snippet">Select a proposal from the list.</pre>
          </div>
          <div class="stack">
            <h2>Plan Summary</h2>
            <pre id="plan-summary">No authoring plan generated yet.</pre>
          </div>
        </section>

        <section class="panel">
          <div class="stack">
            <h2>Raw Patch Plan</h2>
            <pre id="plan-json">No authoring plan generated yet.</pre>
          </div>
        </section>
      </div>
    </main>

    <script src="panel.js" type="module"></script>
  </body>
</html>`;

const panelJs = `const POLL_INTERVAL_MS = 1500;
const buildAICAuthoringPatchPlan = ${buildAICAuthoringPatchPlan.toString()};
const renderAICAuthoringPatchPlanSummary = ${renderAICAuthoringPatchPlanSummary.toString()};

const state = {
  activeView: "inspect",
  autoRefresh: true,
  authoringPlan: undefined,
  baseline: undefined,
  bootstrapReview: undefined,
  connectionMode: "disconnected",
  connectionDetail: "No live snapshot yet.",
  domCandidates: [],
  envelope: undefined,
  projectReport: undefined,
  proposalFilter: "all",
  proposalKey: undefined,
  proposalQuery: "",
  proposalRisk: "all",
  query: "",
  risk: "all",
  role: "all",
  selectedId: undefined,
  tabId: chrome.devtools.inspectedWindow.tabId
};

const metaNode = document.getElementById("meta");
const connectionBadgeNode = document.getElementById("connection-badge");
const connectionDetailNode = document.getElementById("connection-detail");
const inspectTabButton = document.getElementById("inspect-tab");
const authorTabButton = document.getElementById("author-tab");
const refreshButton = document.getElementById("refresh");
const collectDomButton = document.getElementById("collect-dom");
const captureBaselineButton = document.getElementById("capture-baseline");
const copyJsonButton = document.getElementById("copy-json");
const copyDiffButton = document.getElementById("copy-diff");
const importReportButton = document.getElementById("import-report");
const importBootstrapButton = document.getElementById("import-bootstrap");
const copyPlanButton = document.getElementById("copy-plan");
const downloadPlanButton = document.getElementById("download-plan");
const copySummaryButton = document.getElementById("copy-summary");
const autoRefreshNode = document.getElementById("auto-refresh");
const reportFileNode = document.getElementById("report-file");
const bootstrapFileNode = document.getElementById("bootstrap-file");
const inspectViewNode = document.getElementById("inspect-view");
const authorViewNode = document.getElementById("author-view");
const queryNode = document.getElementById("query");
const riskFilterNode = document.getElementById("risk-filter");
const roleFilterNode = document.getElementById("role-filter");
const elementsNode = document.getElementById("elements");
const elementJsonNode = document.getElementById("element-json");
const diffJsonNode = document.getElementById("diff-json");
const rawJsonNode = document.getElementById("raw-json");
const authoringSourcesNode = document.getElementById("authoring-sources");
const proposalQueryNode = document.getElementById("proposal-query");
const proposalFilterNode = document.getElementById("proposal-filter");
const proposalRiskFilterNode = document.getElementById("proposal-risk-filter");
const proposalListNode = document.getElementById("proposal-list");
const proposalJsonNode = document.getElementById("proposal-json");
const proposalSnippetNode = document.getElementById("proposal-snippet");
const planSummaryNode = document.getElementById("plan-summary");
const planJsonNode = document.getElementById("plan-json");

let refreshTimer = undefined;

function sortJsonValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sortJsonValue(item));
  }

  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = sortJsonValue(value[key]);
        return result;
      }, {});
  }

  return value;
}

function stableEquals(before, after) {
  return JSON.stringify(sortJsonValue(before)) === JSON.stringify(sortJsonValue(after));
}

function diffFields(before, after, ignoredFields = new Set()) {
  return Array.from(new Set([...Object.keys(before), ...Object.keys(after)]))
    .filter((field) => !ignoredFields.has(field))
    .filter((field) => !stableEquals(before[field], after[field]))
    .sort();
}

function diffFieldEntries(before, after, ignoredFields = new Set()) {
  return diffFields(before, after, ignoredFields).map((field) => ({
    after: sortJsonValue(after[field]) ?? null,
    before: sortJsonValue(before[field]) ?? null,
    field
  }));
}

function diffUiDetailed(beforeManifest, afterManifest) {
  const beforeElements = new Map((beforeManifest?.elements || []).map((element) => [element.id, element]));
  const afterElements = new Map((afterManifest?.elements || []).map((element) => [element.id, element]));
  const added = Array.from(afterElements.keys()).filter((key) => !beforeElements.has(key)).sort();
  const removed = Array.from(beforeElements.keys()).filter((key) => !afterElements.has(key)).sort();
  const changed = Array.from(beforeElements.keys())
    .filter((key) => afterElements.has(key))
    .flatMap((key) => {
      const beforeElement = beforeElements.get(key);
      const afterElement = afterElements.get(key);
      const changes = diffFieldEntries(beforeElement, afterElement);
      return changes.length > 0 ? [{ changes, key }] : [];
    });

  return {
    added,
    changed,
    kind: "ui",
    removed,
    topLevelChanged: diffFieldEntries(beforeManifest || {}, afterManifest || {}, new Set(["elements", "updated_at", "manifest_version"]))
  };
}

async function sendMessage(message) {
  return chrome.runtime.sendMessage(message);
}

function buildEndpoint(pageUrl) {
  const url = new URL(pageUrl);
  return new URL("/.well-known/agent/ui", url.origin).toString();
}

async function getTabUrl() {
  const response = await sendMessage({
    tabId: state.tabId,
    type: "aic:get-tab-url"
  });
  return response?.url ?? null;
}

async function getLiveSnapshot() {
  const response = await sendMessage({
    tabId: state.tabId,
    type: "aic:get-tab-snapshot"
  });
  return response?.snapshot ?? null;
}

async function collectDomCandidates() {
  const response = await sendMessage({
    tabId: state.tabId,
    type: "aic:collect-dom-candidates"
  });
  return Array.isArray(response?.candidates) ? response.candidates : [];
}

async function fetchEndpointSnapshot() {
  const tabUrl = await getTabUrl();

  if (!tabUrl) {
    return null;
  }

  const endpoint = buildEndpoint(tabUrl);
  const response = await fetch(endpoint, {
    headers: {
      accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error("Endpoint fallback returned " + response.status + ".");
  }

  const manifest = await response.json();
  return {
    captured_at: new Date().toISOString(),
    manifest,
    source: "endpoint",
    version: manifest?.manifest_version || "0.1.0"
  };
}

function matchesFilters(element) {
  const query = state.query.trim().toLowerCase();

  if (state.risk !== "all" && element.risk !== state.risk) {
    return false;
  }

  if (state.role !== "all" && element.role !== state.role) {
    return false;
  }

  if (!query) {
    return true;
  }

  const haystack = [
    element.id,
    element.label,
    element.description,
    element.role,
    element.risk,
    element.entity_ref?.entity_type,
    element.entity_ref?.entity_id,
    element.entity_ref?.entity_label
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

function matchesProposalFilters(proposal) {
  const query = state.proposalQuery.trim().toLowerCase();
  const proposalRisk = proposal.recommended_props?.agentRisk || "low";

  if (state.proposalFilter === "ready" && proposal.status !== "ready") {
    return false;
  }

  if (state.proposalFilter === "apply-ready" && proposal.apply_status !== "eligible") {
    return false;
  }

  if (
    state.proposalFilter === "unresolved" &&
    proposal.status !== "needs_source_match" &&
    proposal.status !== "needs_id_review"
  ) {
    return false;
  }

  if (state.proposalFilter === "source-backed" && proposal.source_candidates.length === 0) {
    return false;
  }

  if (state.proposalFilter === "bootstrap-backed" && !proposal.bootstrap_backed) {
    return false;
  }

  if (state.proposalFilter === "ignored" && proposal.status !== "ignored") {
    return false;
  }

  if (state.proposalFilter !== "ignored" && state.proposalFilter !== "all" && proposal.status === "ignored") {
    return false;
  }

  if (state.proposalRisk !== "all" && proposalRisk !== state.proposalRisk) {
    return false;
  }

  if (!query) {
    return true;
  }

  const haystack = [
    proposal.key,
    proposal.recommended_props?.agentId,
    proposal.recommended_props?.agentDescription,
    proposal.recommended_props?.agentAction,
    proposal.recommended_props?.agentRisk,
    ...(proposal.source_candidates || []).flatMap((candidate) => [candidate.file, candidate.agentId])
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

function getCurrentElements() {
  return Array.isArray(state.envelope?.manifest?.elements)
    ? state.envelope.manifest.elements.filter(matchesFilters)
    : [];
}

function getCurrentPlan() {
  return state.authoringPlan;
}

function getVisibleProposals() {
  return Array.isArray(getCurrentPlan()?.proposals)
    ? getCurrentPlan().proposals.filter(matchesProposalFilters)
    : [];
}

function renderConnection() {
  connectionBadgeNode.textContent = state.connectionMode;
  connectionBadgeNode.dataset.tone = state.connectionMode;
  connectionDetailNode.textContent = state.connectionDetail;
}

function renderMeta() {
  const manifest = state.envelope?.manifest;

  if (!manifest) {
    metaNode.textContent = "Waiting for inspected tab...";
    return;
  }

  metaNode.textContent =
    manifest.view.view_id +
    " · " +
    manifest.elements.length +
    " element(s) · " +
    manifest.page.url;
}

function renderViews() {
  const inspectActive = state.activeView === "inspect";
  inspectViewNode.classList.toggle("hidden", !inspectActive);
  authorViewNode.classList.toggle("hidden", inspectActive);
  inspectTabButton.dataset.active = String(inspectActive);
  authorTabButton.dataset.active = String(!inspectActive);
}

function renderElements() {
  const elements = getCurrentElements();
  elementsNode.innerHTML = "";

  if (elements.length === 0) {
    const emptyNode = document.createElement("li");
    emptyNode.textContent = "No elements match the current filters.";
    elementsNode.appendChild(emptyNode);
    return;
  }

  elements.forEach((element) => {
    const item = document.createElement("li");
    item.dataset.active = String(state.selectedId === element.id);
    item.innerHTML =
      "<strong>" + element.id + "</strong><br />" +
      "<span class='muted'>" + element.role + " · " + element.risk + "</span>";
    item.addEventListener("click", () => {
      state.selectedId = element.id;
      render();
    });
    elementsNode.appendChild(item);
  });
}

function renderSelectedElement() {
  const elements = Array.isArray(state.envelope?.manifest?.elements) ? state.envelope.manifest.elements : [];
  const selected =
    elements.find((element) => element.id === state.selectedId) ||
    elements.find((element) => matchesFilters(element)) ||
    null;

  if (!selected) {
    elementJsonNode.textContent = "Pick an element from the list.";
    return;
  }

  state.selectedId = selected.id;
  elementJsonNode.textContent = JSON.stringify(selected, null, 2);
}

function renderDiff() {
  if (!state.baseline || !state.envelope?.manifest) {
    diffJsonNode.textContent = "Capture a baseline to compare future snapshots.";
    return;
  }

  diffJsonNode.textContent = JSON.stringify(diffUiDetailed(state.baseline, state.envelope.manifest), null, 2);
}

function renderRawJson() {
  rawJsonNode.textContent = state.envelope?.manifest
    ? JSON.stringify(state.envelope.manifest, null, 2)
    : "Awaiting snapshot...";
}

function renderAuthoringSources() {
  const plan = getCurrentPlan();
  const lines = [
    "Snapshot: " + (state.envelope?.manifest ? "loaded" : "not loaded"),
    "DOM candidates: " + state.domCandidates.length,
    "Project report: " + (state.projectReport ? "loaded" : "not loaded"),
    "Bootstrap review: " + (state.bootstrapReview ? "loaded" : "not loaded")
  ];

  if (plan?.summary) {
    lines.push("Ready proposals: " + plan.summary.ready);
    lines.push("Apply-ready proposals: " + plan.summary.apply_ready);
    lines.push("Blocked by JSX pattern: " + plan.summary.blocked_by_jsx_pattern);
    lines.push("Unresolved proposals: " + (plan.summary.needs_source_match + plan.summary.needs_id_review));
    lines.push("Review-only metadata: " + plan.summary.review_only_metadata);
  }

  authoringSourcesNode.innerHTML = lines.map((line) => "<div>" + line + "</div>").join("");
}

function renderProposalList() {
  const proposals = getVisibleProposals();
  proposalListNode.innerHTML = "";

  if (proposals.length === 0) {
    const emptyNode = document.createElement("li");
    emptyNode.textContent = "No authoring proposals match the current filters.";
    proposalListNode.appendChild(emptyNode);
    return;
  }

  proposals.forEach((proposal) => {
    const item = document.createElement("li");
    item.dataset.active = String(state.proposalKey === proposal.key);
    item.innerHTML =
      "<strong>" + proposal.recommended_props.agentId + "</strong><br />" +
      "<span class='muted'>" +
      proposal.status +
      " · " +
      proposal.apply_status +
      " · " +
      proposal.recommended_props.agentRisk +
      "</span>";
    item.addEventListener("click", () => {
      state.proposalKey = proposal.key;
      render();
    });
    proposalListNode.appendChild(item);
  });
}

function renderSelectedProposal() {
  const proposals = Array.isArray(getCurrentPlan()?.proposals) ? getCurrentPlan().proposals : [];
  const selected =
    proposals.find((proposal) => proposal.key === state.proposalKey) ||
    getVisibleProposals()[0] ||
    null;

  if (!selected) {
    proposalJsonNode.textContent = "Select a proposal from the list.";
    proposalSnippetNode.textContent = "Select a proposal from the list.";
    return;
  }

  state.proposalKey = selected.key;
  proposalJsonNode.textContent = JSON.stringify(selected, null, 2);
  proposalSnippetNode.textContent =
    (selected.snippet_preview || "No snippet preview available.") +
    "\\n\\nApply status: " +
    selected.apply_status +
    (selected.apply_block_reason ? "\\nBlock reason: " + selected.apply_block_reason : "") +
    (selected.recommended_optional_props
      ? "\\nOptional props: " + Object.keys(selected.recommended_optional_props).join(", ")
      : "") +
    (selected.apply_target
      ? "\\nSource target: " +
        selected.apply_target.file +
        ":" +
        selected.apply_target.line +
        ":" +
        selected.apply_target.column
      : "") +
    "\\n\\nCLI:\\naic apply authoring-plan ./aic-authoring-plan.json --project-root . --write";
}

function renderPlanSummary() {
  const plan = getCurrentPlan();
  planSummaryNode.textContent = plan
    ? renderAICAuthoringPatchPlanSummary(plan) +
      "\\n\\nCLI:\\naic apply authoring-plan ./aic-authoring-plan.json --project-root . --write"
    : "No authoring plan generated yet.";
}

function renderPlanJson() {
  const plan = getCurrentPlan();
  planJsonNode.textContent = plan
    ? JSON.stringify(plan, null, 2)
    : "No authoring plan generated yet.";
}

function refreshAuthoringPlan() {
  state.authoringPlan = buildAICAuthoringPatchPlan({
    bootstrap_review: state.bootstrapReview,
    dom_candidates: state.domCandidates,
    project_report: state.projectReport,
    snapshot: state.envelope?.manifest
  });
}

function render() {
  renderConnection();
  renderMeta();
  renderViews();
  renderElements();
  renderSelectedElement();
  renderDiff();
  renderRawJson();
  renderAuthoringSources();
  renderProposalList();
  renderSelectedProposal();
  renderPlanSummary();
  renderPlanJson();
}

async function refreshSnapshot() {
  try {
    const liveSnapshot = await getLiveSnapshot();

    if (liveSnapshot?.manifest) {
      state.envelope = liveSnapshot;
      state.connectionMode = "bridge";
      state.connectionDetail = "Live bridge snapshot · " + (liveSnapshot.captured_at || "unknown timestamp");
      refreshAuthoringPlan();
      render();
      return;
    }

    const endpointSnapshot = await fetchEndpointSnapshot();

    if (endpointSnapshot?.manifest) {
      state.envelope = endpointSnapshot;
      state.connectionMode = "endpoint";
      state.connectionDetail = "Endpoint fallback snapshot";
      refreshAuthoringPlan();
      render();
      return;
    }

    state.connectionMode = "disconnected";
    state.connectionDetail = "No live snapshot or endpoint fallback was available.";
    refreshAuthoringPlan();
    render();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown panel refresh error";
    state.connectionMode = "disconnected";
    state.connectionDetail = message;
    refreshAuthoringPlan();
    render();
  }
}

function syncPolling() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = undefined;
  }

  if (state.autoRefresh) {
    refreshTimer = setInterval(() => {
      void refreshSnapshot();
    }, POLL_INTERVAL_MS);
  }
}

async function loadJsonFile(inputNode) {
  const file = inputNode.files?.[0];

  if (!file) {
    return null;
  }

  const contents = await file.text();
  inputNode.value = "";
  return JSON.parse(contents);
}

function downloadTextFile(filename, contents) {
  const blob = new Blob([contents], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.download = filename;
  anchor.href = url;
  anchor.click();
  URL.revokeObjectURL(url);
}

inspectTabButton.addEventListener("click", () => {
  state.activeView = "inspect";
  render();
});

authorTabButton.addEventListener("click", () => {
  state.activeView = "author";
  render();
});

refreshButton.addEventListener("click", () => {
  void refreshSnapshot();
});

collectDomButton.addEventListener("click", async () => {
  state.domCandidates = await collectDomCandidates();
  refreshAuthoringPlan();
  render();
});

captureBaselineButton.addEventListener("click", () => {
  state.baseline = state.envelope?.manifest;
  render();
});

copyJsonButton.addEventListener("click", async () => {
  if (!state.envelope?.manifest) {
    return;
  }

  await navigator.clipboard.writeText(JSON.stringify(state.envelope.manifest, null, 2));
});

copyDiffButton.addEventListener("click", async () => {
  if (!state.baseline || !state.envelope?.manifest) {
    return;
  }

  await navigator.clipboard.writeText(JSON.stringify(diffUiDetailed(state.baseline, state.envelope.manifest), null, 2));
});

importReportButton.addEventListener("click", () => {
  reportFileNode.click();
});

importBootstrapButton.addEventListener("click", () => {
  bootstrapFileNode.click();
});

reportFileNode.addEventListener("change", async () => {
  state.projectReport = await loadJsonFile(reportFileNode);
  refreshAuthoringPlan();
  render();
});

bootstrapFileNode.addEventListener("change", async () => {
  state.bootstrapReview = await loadJsonFile(bootstrapFileNode);
  refreshAuthoringPlan();
  render();
});

copyPlanButton.addEventListener("click", async () => {
  if (!state.authoringPlan) {
    return;
  }

  await navigator.clipboard.writeText(JSON.stringify(state.authoringPlan, null, 2));
});

downloadPlanButton.addEventListener("click", () => {
  if (!state.authoringPlan) {
    return;
  }

  downloadTextFile("aic-authoring-plan.json", JSON.stringify(state.authoringPlan, null, 2));
});

copySummaryButton.addEventListener("click", async () => {
  if (!state.authoringPlan) {
    return;
  }

  await navigator.clipboard.writeText(renderAICAuthoringPatchPlanSummary(state.authoringPlan));
});

autoRefreshNode.addEventListener("change", () => {
  state.autoRefresh = autoRefreshNode.checked;
  syncPolling();
});

queryNode.addEventListener("input", () => {
  state.query = queryNode.value;
  render();
});

riskFilterNode.addEventListener("change", () => {
  state.risk = riskFilterNode.value;
  render();
});

roleFilterNode.addEventListener("change", () => {
  state.role = roleFilterNode.value;
  render();
});

proposalQueryNode.addEventListener("input", () => {
  state.proposalQuery = proposalQueryNode.value;
  render();
});

proposalFilterNode.addEventListener("change", () => {
  state.proposalFilter = proposalFilterNode.value;
  render();
});

proposalRiskFilterNode.addEventListener("change", () => {
  state.proposalRisk = proposalRiskFilterNode.value;
  render();
});

chrome.devtools.network.onNavigated.addListener(() => {
  state.domCandidates = [];
  void refreshSnapshot();
});

refreshAuthoringPlan();
syncPolling();
void refreshSnapshot();
`;

const contentScriptJs = `function normalizeLabel(value) {
  return String(value || "").replace(/\\s+/g, " ").trim();
}

function slugify(value) {
  return normalizeLabel(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "item";
}

function inferRole(element) {
  const explicitRole = element.getAttribute("role");

  switch ((explicitRole || "").toLowerCase()) {
    case "button":
      return "button";
    case "link":
      return "link";
    case "searchbox":
      return "searchbox";
    case "textbox":
      return "input";
    case "combobox":
      return "combobox";
    case "listbox":
      return "listbox";
    case "dialog":
      return "dialog";
    case "form":
      return "form";
    case "row":
      return "row";
    case "table":
      return "table";
    default:
      break;
  }

  switch (element.tagName.toLowerCase()) {
    case "a":
      return "link";
    case "button":
      return "button";
    case "select":
      return "select";
    case "textarea":
      return "textarea";
    case "input": {
      const type = (element.getAttribute("type") || "").toLowerCase();

      if (type === "checkbox") {
        return "checkbox";
      }

      if (type === "radio") {
        return "radio";
      }

      if (type === "search") {
        return "searchbox";
      }

      return "input";
    }
    default:
      return "generic";
  }
}

function isVisible(element) {
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();

  if (element.hidden || element.getAttribute("aria-hidden") === "true") {
    return false;
  }

  if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
    return false;
  }

  return rect.width > 0 && rect.height > 0;
}

function readLabel(element) {
  return normalizeLabel(
    element.getAttribute("aria-label") ||
      element.getAttribute("title") ||
      element.getAttribute("value") ||
      element.textContent ||
      ""
  );
}

function collectDomCandidates() {
  const pageUrl = window.location.href;
  const routePattern = window.location.pathname || "/";
  const seenKeys = new Set();
  const candidates = [];

  Array.from(document.querySelectorAll("button, a, input, select, textarea, [role]")).forEach((element) => {
    if (!isVisible(element)) {
      return;
    }

    const label = readLabel(element);

    if (!label) {
      return;
    }

    const role = inferRole(element);
    const key = routePattern + "::" + role + "::" + slugify(label);

    if (seenKeys.has(key)) {
      return;
    }

    seenKeys.add(key);
    candidates.push({
      annotated_agent_id:
        element.getAttribute("data-agent-id") ||
        element.getAttribute("data-aic-id") ||
        undefined,
      key,
      label,
      page_url: pageUrl,
      role,
      route_pattern: routePattern,
      selectors: {
        testId:
          element.getAttribute("data-testid") ||
          element.getAttribute("data-test-id") ||
          undefined,
        text: label
      },
      tag_name: element.tagName.toLowerCase()
    });
  });

  return candidates;
}

window.addEventListener("${SNAPSHOT_EVENT}", (event) => {
  const detail = event?.detail;

  if (!detail || typeof detail !== "object" || !detail.manifest) {
    return;
  }

  void chrome.runtime.sendMessage({
    envelope: detail,
    type: "aic:set-tab-snapshot"
  });
}, true);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "aic:collect-dom-candidates") {
    sendResponse({
      candidates: collectDomCandidates()
    });
    return true;
  }

  return false;
});
`;

const serviceWorkerJs = `const SNAPSHOT_PREFIX = "aic:snapshot:";

function snapshotKey(tabId) {
  return SNAPSHOT_PREFIX + String(tabId);
}

chrome.runtime.onInstalled.addListener(() => {
  console.log("AIC Devtools extension installed");
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void chrome.storage.session.remove(snapshotKey(tabId));
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "aic:set-tab-snapshot" && sender.tab?.id != null) {
    void chrome.storage.session
      .set({
        [snapshotKey(sender.tab.id)]: message.envelope
      })
      .then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message?.type === "aic:get-tab-snapshot" && message.tabId != null) {
    void chrome.storage.session.get(snapshotKey(message.tabId)).then((result) => {
      sendResponse({
        snapshot: result[snapshotKey(message.tabId)] || null
      });
    });
    return true;
  }

  if (message?.type === "aic:clear-tab-snapshot" && message.tabId != null) {
    void chrome.storage.session.remove(snapshotKey(message.tabId)).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message?.type === "aic:get-tab-url" && message.tabId != null) {
    void chrome.tabs.get(message.tabId).then((tab) => {
      sendResponse({
        url: tab?.url || null
      });
    });
    return true;
  }

  if (message?.type === "aic:collect-dom-candidates" && message.tabId != null) {
    void chrome.tabs
      .sendMessage(message.tabId, {
        type: "aic:collect-dom-candidates"
      })
      .then((response) => {
        sendResponse({
          candidates: Array.isArray(response?.candidates) ? response.candidates : []
        });
      })
      .catch(() => {
        sendResponse({
          candidates: []
        });
      });
    return true;
  }

  return false;
});
`;

export const extensionFileMap = {
  "content-script.js": contentScriptJs,
  "devtools.html": devtoolsHtml,
  "devtools.js": devtoolsJs,
  "manifest.json": JSON.stringify(extensionManifest, null, 2),
  "panel.html": panelHtml,
  "panel.js": panelJs,
  "popup.html": popupHtml,
  "popup.js": popupJs,
  "service-worker.js": serviceWorkerJs
};
