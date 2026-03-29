import { useEffect, useMemo, useRef, useState } from "react";
import { useAICRegistry } from "@aic/sdk-react";
import {
  buildAICAuthoringPatchPlan,
  diffAICManifestDetailed,
  renderAICAuthoringPatchPlanSummary,
  type AICAuthoringBootstrapReviewInput,
  type AICAuthoringInputs,
  type AICAuthoringPatchPlan,
  type AICAuthoringProjectReport,
  type AICDetailedManifestDiff,
  type AICDomDiscoveryCandidate,
  type AICElementManifest,
  type AICRisk,
  type AICRole,
  type AICRuntimeUiManifest
} from "@aic/spec";
import { extensionFileMap, extensionManifest } from "./extension-assets.js";

export const AIC_DEVTOOLS_SNAPSHOT_EVENT = "aic:devtools:snapshot";
export const AIC_DEVTOOLS_VERSION = "0.2.0";

export interface AICDevtoolsExtensionShell {
  files: Record<string, string>;
  manifest: Record<string, unknown>;
}

export interface AICDevtoolsSnapshotOptions {
  pageTitle?: string;
  route_pattern?: string;
  url: string;
  view_id: string;
}

export type AICDevtoolsSnapshotSource = "endpoint" | "registry";

export interface AICDevtoolsSnapshotEnvelope {
  captured_at: string;
  manifest: AICRuntimeUiManifest;
  source: AICDevtoolsSnapshotSource;
  version: string;
}

export interface AICDevtoolsConnectionState {
  last_error?: string;
  last_updated_at?: string;
  mode: "bridge" | "disconnected" | "endpoint";
}

export interface AICDevtoolsInspectorFilters {
  query?: string;
  risk?: AICRisk | "all";
  role?: AICRole | "all";
}

export interface AICDevtoolsBridgeProps extends AICDevtoolsSnapshotOptions {
  enabled?: boolean;
  throttleMs?: number;
}

export function createAICDevtoolsExtensionShell(): AICDevtoolsExtensionShell {
  return {
    files: extensionFileMap,
    manifest: extensionManifest
  };
}

export function createAICDevtoolsSnapshotEnvelope(
  manifest: AICRuntimeUiManifest,
  source: AICDevtoolsSnapshotSource = "registry"
): AICDevtoolsSnapshotEnvelope {
  return {
    captured_at: new Date().toISOString(),
    manifest,
    source,
    version: manifest.manifest_version ?? AIC_DEVTOOLS_VERSION
  };
}

export function dispatchAICDevtoolsSnapshot(envelope: AICDevtoolsSnapshotEnvelope): void {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(AIC_DEVTOOLS_SNAPSHOT_EVENT, {
      detail: envelope
    })
  );
}

export function useAICInspectorSnapshot(options: AICDevtoolsSnapshotOptions): AICRuntimeUiManifest {
  const registry = useAICRegistry();
  const [snapshot, setSnapshot] = useState<AICRuntimeUiManifest>(() =>
    registry.serializeRuntimeUi(options)
  );

  useEffect(() => {
    return registry.subscribe(() => {
      setSnapshot(registry.serializeRuntimeUi(options));
    });
  }, [options, registry]);

  return snapshot;
}

export function exportRuntimeManifest(manifest: AICRuntimeUiManifest): string {
  return JSON.stringify(manifest, null, 2);
}

export function createAICAuthoringPatchPlan(inputs: AICAuthoringInputs): AICAuthoringPatchPlan {
  return buildAICAuthoringPatchPlan(inputs);
}

export function exportAICAuthoringPatchPlan(plan: AICAuthoringPatchPlan): string {
  return JSON.stringify(plan, null, 2);
}

export function exportAICAuthoringPatchPlanSummary(plan: AICAuthoringPatchPlan): string {
  return renderAICAuthoringPatchPlanSummary(plan);
}

export function diffRuntimeUiSnapshots(
  before: AICRuntimeUiManifest,
  after: AICRuntimeUiManifest
): AICDetailedManifestDiff {
  return diffAICManifestDetailed("ui", before, after);
}

export function filterAICElements(
  elements: AICElementManifest[],
  filters: AICDevtoolsInspectorFilters
): AICElementManifest[] {
  const query = filters.query?.trim().toLowerCase() ?? "";

  return elements.filter((element) => {
    if (filters.risk && filters.risk !== "all" && element.risk !== filters.risk) {
      return false;
    }

    if (filters.role && filters.role !== "all" && element.role !== filters.role) {
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
  });
}

export function summarizeElements(elements: AICElementManifest[]): string[] {
  return elements.map((element) => {
    const entity =
      element.entity_ref?.entity_type && element.entity_ref?.entity_id
        ? ` -> ${element.entity_ref.entity_type}:${element.entity_ref.entity_id}`
        : "";
    return `${element.role} ${element.id} [${element.risk}]${entity}`;
  });
}

function normalizeDomLabel(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function slugifyDomCandidate(value: string): string {
  const slug = normalizeDomLabel(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return slug || "item";
}

function inferDomRole(element: {
  getAttribute?: (name: string) => string | null;
  tagName?: string;
}): AICRole {
  const explicitRole = element.getAttribute?.("role")?.toLowerCase();

  switch (explicitRole) {
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

  switch ((element.tagName ?? "").toLowerCase()) {
    case "a":
      return "link";
    case "button":
      return "button";
    case "select":
      return "select";
    case "textarea":
      return "textarea";
    case "input": {
      const type = element.getAttribute?.("type")?.toLowerCase();

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

function isVisibleDomElement(
  element: {
    getAttribute: (name: string) => string | null;
    getBoundingClientRect: () => { height: number; width: number };
    hidden?: boolean;
  },
  windowRef: Window & typeof globalThis
): boolean {
  const style = windowRef.getComputedStyle(element as Element);
  const rect = element.getBoundingClientRect();

  if (element.hidden || element.getAttribute("aria-hidden") === "true") {
    return false;
  }

  if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
    return false;
  }

  return rect.width > 0 && rect.height > 0;
}

function readDomLabel(element: {
  getAttribute: (name: string) => string | null;
  textContent: string | null;
}): string {
  return normalizeDomLabel(
    element.getAttribute("aria-label") ||
      element.getAttribute("title") ||
      element.getAttribute("value") ||
      element.textContent ||
      ""
  );
}

export function collectAICDomDiscoveryCandidates(
  root: ParentNode = document,
  options: {
    bootstrapReview?: AICAuthoringBootstrapReviewInput;
    pageUrl?: string;
    projectReport?: AICAuthoringProjectReport;
    routePattern?: string;
    snapshot?: AICRuntimeUiManifest;
    windowRef?: Window & typeof globalThis;
  } = {}
): AICDomDiscoveryCandidate[] {
  const windowRef = options.windowRef ?? window;
  const pageUrl = options.pageUrl ?? windowRef.location.href;
  const routePattern = options.routePattern ?? windowRef.location.pathname;
  const candidates = Array.from(
    root.querySelectorAll?.("button, a, input, select, textarea, [role]") ?? []
  );
  const seenKeys = new Set<string>();
  const normalizedCandidates: AICDomDiscoveryCandidate[] = [];

  candidates.forEach((element) => {
    if (
      !element ||
      typeof (element as Element).getAttribute !== "function" ||
      typeof (element as Element).getBoundingClientRect !== "function" ||
      !isVisibleDomElement(element as Element & {
        getAttribute: (name: string) => string | null;
        getBoundingClientRect: () => { height: number; width: number };
        hidden?: boolean;
      }, windowRef)
    ) {
      return;
    }

    const label = readDomLabel(element as HTMLElement);

    if (!label) {
      return;
    }

    const role = inferDomRole(element as HTMLElement);
    const key = `${routePattern}::${role}::${slugifyDomCandidate(label)}`;

    if (seenKeys.has(key)) {
      return;
    }

    seenKeys.add(key);
    normalizedCandidates.push({
      annotated_agent_id:
        element.getAttribute("data-agent-id") ??
        element.getAttribute("data-aic-id") ??
        undefined,
      key,
      label,
      page_url: pageUrl,
      role,
      route_pattern: routePattern,
      selectors: {
        testId:
          element.getAttribute("data-testid") ??
          element.getAttribute("data-test-id") ??
          undefined,
        text: label
      },
      tag_name: element.tagName.toLowerCase()
    });
  });

  return normalizedCandidates;
}

export function AICDevtoolsBridge({
  enabled = true,
  throttleMs = 150,
  ...snapshotOptions
}: AICDevtoolsBridgeProps) {
  const snapshot = useAICInspectorSnapshot(snapshotOptions);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || typeof window.dispatchEvent !== "function") {
      return undefined;
    }

    const dispatch = () => {
      dispatchAICDevtoolsSnapshot(createAICDevtoolsSnapshotEnvelope(snapshot, "registry"));
      timeoutRef.current = null;
    };

    if (throttleMs <= 0) {
      dispatch();
      return undefined;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(dispatch, throttleMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [enabled, snapshot, throttleMs]);

  return null;
}

export function AICDevtoolsOverlay(props: AICDevtoolsSnapshotOptions) {
  const snapshot = useAICInspectorSnapshot(props);
  const summaries = useMemo(() => summarizeElements(snapshot.elements), [snapshot.elements]);
  const [expanded, setExpanded] = useState(false);

  return (
    <aside
      style={{
        backdropFilter: "blur(12px)",
        background: "rgba(5, 10, 16, 0.92)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 20,
        bottom: 20,
        color: "#f5f7fb",
        fontFamily: "ui-monospace, SFMono-Regular, monospace",
        maxHeight: expanded ? "70vh" : 68,
        overflow: "hidden",
        padding: 16,
        position: "fixed",
        right: 20,
        width: 360,
        zIndex: 9999
      }}
    >
      <div
        style={{
          alignItems: "center",
          display: "flex",
          justifyContent: "space-between",
          marginBottom: expanded ? 12 : 0
        }}
      >
        <strong style={{ fontSize: 13, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          AIC Inspector
        </strong>
        <button
          onClick={() => setExpanded((value) => !value)}
          style={{
            background: "#0f766e",
            border: 0,
            borderRadius: 999,
            color: "white",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 700,
            padding: "8px 12px"
          }}
          type="button"
        >
          {expanded ? "Collapse" : "Expand"}
        </button>
      </div>

      {expanded ? (
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ color: "#9db0c3", fontSize: 12 }}>
            {snapshot.view.view_id} · {snapshot.elements.length} element(s)
          </div>
          <div
            style={{
              background: "rgba(255,255,255,0.04)",
              borderRadius: 14,
              display: "grid",
              gap: 8,
              maxHeight: 180,
              overflowY: "auto",
              padding: 12
            }}
          >
            {summaries.map((summary) => (
              <div key={summary} style={{ fontSize: 12 }}>
                {summary}
              </div>
            ))}
          </div>
          <pre
            style={{
              background: "rgba(255,255,255,0.04)",
              borderRadius: 14,
              fontSize: 11,
              margin: 0,
              maxHeight: 260,
              overflow: "auto",
              padding: 12,
              whiteSpace: "pre-wrap"
            }}
          >
            {exportRuntimeManifest(snapshot)}
          </pre>
        </div>
      ) : null}
    </aside>
  );
}
