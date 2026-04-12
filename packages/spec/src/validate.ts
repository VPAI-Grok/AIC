import {
  AIC_ACTIONS,
  AIC_CONFIRMATION_TYPES,
  AIC_RISKS,
  AIC_ROLES,
  MANIFEST_VERSION,
  SPEC_VERSION,
  type AICActionContract,
  type AICConfirmationProtocol,
  type AICElementManifest,
  type AICPermissionsManifest,
  type AICRuntimeUiManifest,
  type AICSemanticActionsManifest,
  type AICValidationIssue,
  type AICValidationSeverity,
  type AICWorkflowManifest,
  type AICDiscoveryManifest,
  type ValidationResult
} from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === "number");
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function pushIssue(
  issues: AICValidationIssue[],
  severity: AICValidationSeverity,
  path: string,
  message: string,
  rule?: string
): void {
  issues.push({ severity, path, message, rule });
}

function hasBlockingIssues(issues: AICValidationIssue[]): boolean {
  return issues.some((issue) => issue.severity === "error" || issue.severity === "fatal");
}

function createResult<T>(value: T, issues: AICValidationIssue[]): ValidationResult<T> {
  return hasBlockingIssues(issues) ? { ok: false, issues } : { ok: true, value, issues };
}

function isKnownRole(value: unknown): boolean {
  return typeof value === "string" && (AIC_ROLES as readonly string[]).includes(value);
}

function isKnownAction(value: unknown): boolean {
  return typeof value === "string" && (AIC_ACTIONS as readonly string[]).includes(value);
}

function isKnownRisk(value: unknown): boolean {
  return typeof value === "string" && (AIC_RISKS as readonly string[]).includes(value);
}

function validateConfirmation(
  value: unknown,
  path: string,
  issues: AICValidationIssue[]
): value is AICConfirmationProtocol {
  if (!isRecord(value)) {
    pushIssue(issues, "error", path, "Expected an object", "confirmation.object");
    return false;
  }

  if (
    typeof value.type !== "string" ||
    !(AIC_CONFIRMATION_TYPES as readonly string[]).includes(value.type)
  ) {
    pushIssue(
      issues,
      "error",
      `${path}.type`,
      "Expected a supported confirmation type",
      "confirmation.type"
    );
  }

  if (value.prompt_template !== undefined && typeof value.prompt_template !== "string") {
    pushIssue(
      issues,
      "error",
      `${path}.prompt_template`,
      "Expected a string",
      "confirmation.prompt_template"
    );
  }

  if (value.summary_fields !== undefined && !isStringArray(value.summary_fields)) {
    pushIssue(
      issues,
      "error",
      `${path}.summary_fields`,
      "Expected an array of strings",
      "confirmation.summary_fields"
    );
  }

  return !hasBlockingIssues(issues);
}

function validateActionContract(
  value: unknown,
  path: string,
  issues: AICValidationIssue[]
): value is AICActionContract {
  if (!isRecord(value)) {
    pushIssue(issues, "fatal", path, "Expected an object", "action_contract.object");
    return false;
  }

  const requiredStringFields = ["name", "title", "target"] as const;
  requiredStringFields.forEach((field) => {
    if (typeof value[field] !== "string" || value[field].length === 0) {
      pushIssue(
        issues,
        "error",
        `${path}.${field}`,
        "Expected a non-empty string",
        `action_contract.${field}`
      );
    }
  });

  if (!isStringArray(value.preconditions)) {
    pushIssue(
      issues,
      "error",
      `${path}.preconditions`,
      "Expected an array of strings",
      "action_contract.preconditions"
    );
  }

  if (!isStringArray(value.postconditions)) {
    pushIssue(
      issues,
      "error",
      `${path}.postconditions`,
      "Expected an array of strings",
      "action_contract.postconditions"
    );
  }

  if (!isStringArray(value.side_effects)) {
    pushIssue(
      issues,
      "error",
      `${path}.side_effects`,
      "Expected an array of strings",
      "action_contract.side_effects"
    );
  }

  if (!isBoolean(value.idempotent)) {
    pushIssue(
      issues,
      "error",
      `${path}.idempotent`,
      "Expected a boolean",
      "action_contract.idempotent"
    );
  }

  if (!isBoolean(value.undoable)) {
    pushIssue(
      issues,
      "error",
      `${path}.undoable`,
      "Expected a boolean",
      "action_contract.undoable"
    );
  }

  if (typeof value.estimated_latency_ms !== "number") {
    pushIssue(
      issues,
      "error",
      `${path}.estimated_latency_ms`,
      "Expected a number",
      "action_contract.estimated_latency_ms"
    );
  }

  if (!isRecord(value.completion_signal)) {
    pushIssue(
      issues,
      "error",
      `${path}.completion_signal`,
      "Expected an object",
      "action_contract.completion_signal"
    );
  }

  if (!isStringArray(value.failure_modes) || value.failure_modes.length === 0) {
    pushIssue(
      issues,
      "error",
      `${path}.failure_modes`,
      "Expected at least one failure mode",
      "action_contract.failure_modes"
    );
  }

  if (value.batch !== undefined) {
    if (!isRecord(value.batch) || !isBoolean(value.batch.supported)) {
      pushIssue(
        issues,
        "error",
        `${path}.batch`,
        "Expected batch.supported to be defined",
        "action_contract.batch"
      );
    } else if (value.batch.supported && typeof value.batch.max_items !== "number") {
      pushIssue(
        issues,
        "error",
        `${path}.batch.max_items`,
        "Batch actions must declare max_items",
        "action_contract.batch_max_items"
      );
    }
  }

  return !hasBlockingIssues(issues);
}

function validateElement(
  value: unknown,
  path: string,
  issues: AICValidationIssue[]
): value is AICElementManifest {
  if (!isRecord(value)) {
    pushIssue(issues, "fatal", path, "Expected an object", "element.object");
    return false;
  }

  if (typeof value.id !== "string" || value.id.length === 0) {
    pushIssue(issues, "error", `${path}.id`, "Expected a non-empty string", "element.id");
  }

  if (!isKnownRole(value.role)) {
    pushIssue(issues, "error", `${path}.role`, "Expected a supported role", "element.role");
  }

  if (typeof value.label !== "string" || value.label.length === 0) {
    pushIssue(issues, "error", `${path}.label`, "Expected a non-empty string", "element.label");
  }

  if (!Array.isArray(value.actions) || value.actions.length === 0) {
    pushIssue(
      issues,
      "error",
      `${path}.actions`,
      "Expected at least one action",
      "element.actions"
    );
  } else {
    value.actions.forEach((action, index) => {
      if (!isRecord(action) || typeof action.name !== "string" || action.name.length === 0) {
        pushIssue(
          issues,
          "error",
          `${path}.actions[${index}].name`,
          "Expected a non-empty action name",
          "element.actions.name"
        );
        return;
      }

      if (!isKnownAction(action.name) && action.type !== "semantic_action") {
        pushIssue(
          issues,
          "warning",
          `${path}.actions[${index}].name`,
          "Unknown action name; use semantic_action for custom app-level actions",
          "element.actions.known"
        );
      }
    });
  }

  if (!isKnownRisk(value.risk)) {
    pushIssue(issues, "error", `${path}.risk`, "Expected a supported risk", "element.risk");
  }

  if (!isRecord(value.state)) {
    pushIssue(issues, "error", `${path}.state`, "Expected a state object", "element.state");
  }

  if (value.aliases !== undefined && !isStringArray(value.aliases)) {
    pushIssue(
      issues,
      "error",
      `${path}.aliases`,
      "Expected an array of strings",
      "element.aliases"
    );
  }

  if (value.effects !== undefined && !isStringArray(value.effects)) {
    pushIssue(
      issues,
      "error",
      `${path}.effects`,
      "Expected an array of strings",
      "element.effects"
    );
  }

  if (value.notes !== undefined && !isStringArray(value.notes)) {
    pushIssue(
      issues,
      "error",
      `${path}.notes`,
      "Expected an array of strings",
      "element.notes"
    );
  }

  if (value.examples !== undefined && !isStringArray(value.examples)) {
    pushIssue(
      issues,
      "error",
      `${path}.examples`,
      "Expected an array of strings",
      "element.examples"
    );
  }

  if (value.permissions !== undefined && !isStringArray(value.permissions)) {
    pushIssue(
      issues,
      "error",
      `${path}.permissions`,
      "Expected an array of strings",
      "element.permissions"
    );
  }

  if (value.requires_confirmation !== undefined && !isBoolean(value.requires_confirmation)) {
    pushIssue(
      issues,
      "error",
      `${path}.requires_confirmation`,
      "Expected a boolean",
      "element.requires_confirmation"
    );
  }

  if (value.requires_confirmation === true) {
    validateConfirmation(value.confirmation, `${path}.confirmation`, issues);
  }

  if (
    value.risk === "critical" &&
    (value.requires_confirmation !== true || !isRecord(value.confirmation))
  ) {
    pushIssue(
      issues,
      "error",
      `${path}.confirmation`,
      "Critical actions require structured confirmation details",
      "element.critical_confirmation"
    );
  }

  if (isRecord(value.execution)) {
    if (
      value.execution.estimated_latency_ms !== undefined &&
      typeof value.execution.estimated_latency_ms !== "number"
    ) {
      pushIssue(
        issues,
        "error",
        `${path}.execution.estimated_latency_ms`,
        "Expected a number",
        "element.execution.estimated_latency_ms"
      );
    }

    if (
      value.execution.ready_when !== undefined &&
      !isStringArray(value.execution.ready_when)
    ) {
      pushIssue(
        issues,
        "error",
        `${path}.execution.ready_when`,
        "Expected an array of strings",
        "element.execution.ready_when"
      );
    }
  }

  const hasAsyncExecution =
    isRecord(value.execution) &&
    (value.execution.estimated_latency_ms !== undefined ||
      value.execution.ready_when !== undefined ||
      value.execution.settled_when !== undefined);
  const parentId = typeof value.parent_id === "string" ? value.parent_id : "";
  const elementId = typeof value.id === "string" ? value.id : "";

  if (hasAsyncExecution && !Array.isArray(value.effects)) {
    pushIssue(
      issues,
      "warning",
      `${path}.effects`,
      "Async or long-running elements should describe effects",
      "element.async_effects"
    );
  }

  if (
    (value.role === "row" ||
      parentId.includes("table") ||
      parentId.includes("grid") ||
      elementId.includes(".row.")) &&
    !isRecord(value.entity_ref)
  ) {
    pushIssue(
      issues,
      "warning",
      `${path}.entity_ref`,
      "Row- or grid-associated actions should provide entity identity",
      "element.entity_ref"
    );
  }

  if (isRecord(value.validation) && value.validation.examples !== undefined) {
    if (!Array.isArray(value.validation.examples)) {
      pushIssue(
        issues,
        "error",
        `${path}.validation.examples`,
        "Expected an array",
        "element.validation.examples"
      );
    }
  }

  if (value.recovery !== undefined && !isRecord(value.recovery)) {
    pushIssue(
      issues,
      "error",
      `${path}.recovery`,
      "Expected an object",
      "element.recovery"
    );
  }

  return !hasBlockingIssues(issues);
}

export function validateDiscoveryManifest(value: unknown): ValidationResult<AICDiscoveryManifest> {
  const issues: AICValidationIssue[] = [];
  const capabilityEndpointPairs = [
    {
      capability: "runtimeUiTree",
      endpoint: "ui",
      label: "runtime UI"
    },
    {
      capability: "semanticActions",
      endpoint: "actions",
      label: "semantic actions"
    },
    {
      capability: "permissions",
      endpoint: "permissions",
      label: "permissions"
    },
    {
      capability: "workflows",
      endpoint: "workflows",
      label: "workflows"
    }
  ] as const;

  if (!isRecord(value)) {
    pushIssue(issues, "fatal", "$", "Expected an object", "discovery.object");
    return { ok: false, issues };
  }

  if (value.spec !== SPEC_VERSION) {
    pushIssue(
      issues,
      "error",
      "$.spec",
      `Expected spec to equal ${SPEC_VERSION}`,
      "discovery.spec"
    );
  }

  if (!isRecord(value.app) || typeof value.app.name !== "string" || value.app.name.length === 0) {
    pushIssue(issues, "error", "$.app.name", "Expected a non-empty string", "discovery.app");
  }

  if (!isRecord(value.capabilities)) {
    pushIssue(
      issues,
      "error",
      "$.capabilities",
      "Expected a capabilities object",
      "discovery.capabilities"
    );
  }

  if (!isRecord(value.endpoints)) {
    pushIssue(
      issues,
      "error",
      "$.endpoints",
      "Expected an endpoints object",
      "discovery.endpoints"
    );
  }

  if (typeof value.generated_at !== "string" || value.generated_at.length === 0) {
    pushIssue(
      issues,
      "error",
      "$.generated_at",
      "Expected an ISO timestamp string",
      "discovery.generated_at"
    );
  }

  if (value.notes !== undefined && !isStringArray(value.notes)) {
    pushIssue(issues, "warning", "$.notes", "Expected an array of strings", "discovery.notes");
  }

  if (isRecord(value.capabilities) && isRecord(value.endpoints)) {
    for (const { capability, endpoint, label } of capabilityEndpointPairs) {
      const capabilityValue = value.capabilities[capability];
      const endpointValue = value.endpoints[endpoint];

      if (capabilityValue !== undefined && typeof capabilityValue !== "boolean") {
        pushIssue(
          issues,
          "error",
          `$.capabilities.${capability}`,
          "Expected a boolean",
          "discovery.capabilities"
        );
      }

      if (endpointValue !== undefined && (typeof endpointValue !== "string" || endpointValue.length === 0)) {
        pushIssue(
          issues,
          "error",
          `$.endpoints.${endpoint}`,
          "Expected a non-empty string",
          "discovery.endpoints"
        );
        continue;
      }

      if (capabilityValue === true && typeof endpointValue !== "string") {
        pushIssue(
          issues,
          "error",
          `$.endpoints.${endpoint}`,
          `Expected an endpoint for advertised ${label} capability`,
          "discovery.endpoint_capability_mismatch"
        );
      }

      if (capabilityValue === false && typeof endpointValue === "string") {
        pushIssue(
          issues,
          "warning",
          `$.endpoints.${endpoint}`,
          `Endpoint is present but ${label} capability is disabled`,
          "discovery.endpoint_capability_mismatch"
        );
      }
    }
  }

  return createResult(value as unknown as AICDiscoveryManifest, issues);
}

export function validateRuntimeUiManifest(value: unknown): ValidationResult<AICRuntimeUiManifest> {
  const issues: AICValidationIssue[] = [];

  if (!isRecord(value)) {
    pushIssue(issues, "fatal", "$", "Expected an object", "ui.object");
    return { ok: false, issues };
  }

  if (value.spec !== SPEC_VERSION) {
    pushIssue(issues, "error", "$.spec", `Expected spec to equal ${SPEC_VERSION}`, "ui.spec");
  }

  if (!isRecord(value.page) || typeof value.page.url !== "string") {
    pushIssue(issues, "error", "$.page.url", "Expected a page.url string", "ui.page");
  }

  if (!isRecord(value.view) || typeof value.view.view_id !== "string") {
    pushIssue(issues, "error", "$.view.view_id", "Expected a view_id string", "ui.view");
  }

  if (typeof value.updated_at !== "string" || value.updated_at.length === 0) {
    pushIssue(
      issues,
      "error",
      "$.updated_at",
      "Expected an ISO timestamp string",
      "ui.updated_at"
    );
  }

  if (!Array.isArray(value.elements)) {
    pushIssue(issues, "fatal", "$.elements", "Expected an array", "ui.elements");
    return { ok: false, issues };
  }

  const seenIds = new Set<string>();
  value.elements.forEach((element, index) => {
    const path = `$.elements[${index}]`;
    validateElement(element, path, issues);

    if (isRecord(element) && typeof element.id === "string") {
      if (seenIds.has(element.id)) {
        pushIssue(issues, "fatal", `${path}.id`, "Duplicate element ID", "ui.duplicate_id");
      } else {
        seenIds.add(element.id);
      }
    }
  });

  if (value.relationships !== undefined && !Array.isArray(value.relationships)) {
    pushIssue(
      issues,
      "error",
      "$.relationships",
      "Expected an array",
      "ui.relationships"
    );
  }

  return createResult(value as unknown as AICRuntimeUiManifest, issues);
}

export function validatePermissionsManifest(
  value: unknown
): ValidationResult<AICPermissionsManifest> {
  const issues: AICValidationIssue[] = [];

  if (!isRecord(value)) {
    pushIssue(issues, "fatal", "$", "Expected an object", "permissions.object");
    return { ok: false, issues };
  }

  if (value.spec !== SPEC_VERSION) {
    pushIssue(
      issues,
      "error",
      "$.spec",
      `Expected spec to equal ${SPEC_VERSION}`,
      "permissions.spec"
    );
  }

  if (!isRecord(value.riskBands)) {
    pushIssue(
      issues,
      "fatal",
      "$.riskBands",
      "Expected a riskBands object",
      "permissions.riskBands"
    );
  } else {
    const riskBands = value.riskBands as Record<string, unknown>;
    AIC_RISKS.forEach((risk) => {
      if (!isRecord(riskBands[risk])) {
        pushIssue(
          issues,
          "error",
          `$.riskBands.${risk}`,
          "Expected a risk band policy",
          "permissions.riskBand"
        );
      }
    });
  }

  if (value.forbiddenActions !== undefined && !isStringArray(value.forbiddenActions)) {
    pushIssue(
      issues,
      "error",
      "$.forbiddenActions",
      "Expected an array of strings",
      "permissions.forbiddenActions"
    );
  }

  return createResult(value as unknown as AICPermissionsManifest, issues);
}

export function validateWorkflowManifest(value: unknown): ValidationResult<AICWorkflowManifest> {
  const issues: AICValidationIssue[] = [];

  if (!isRecord(value)) {
    pushIssue(issues, "fatal", "$", "Expected an object", "workflows.object");
    return { ok: false, issues };
  }

  if (value.spec !== SPEC_VERSION) {
    pushIssue(
      issues,
      "error",
      "$.spec",
      `Expected spec to equal ${SPEC_VERSION}`,
      "workflows.spec"
    );
  }

  if (!Array.isArray(value.workflows)) {
    pushIssue(
      issues,
      "fatal",
      "$.workflows",
      "Expected an array",
      "workflows.workflows"
    );
    return { ok: false, issues };
  }

  value.workflows.forEach((workflow, index) => {
    if (!isRecord(workflow)) {
      pushIssue(
        issues,
        "error",
        `$.workflows[${index}]`,
        "Expected an object",
        "workflows.workflow"
      );
      return;
    }

    if (typeof workflow.id !== "string" || workflow.id.length === 0) {
      pushIssue(
        issues,
        "error",
        `$.workflows[${index}].id`,
        "Expected a non-empty string",
        "workflows.id"
      );
    }

    if (!isStringArray(workflow.entry_points)) {
      pushIssue(
        issues,
        "error",
        `$.workflows[${index}].entry_points`,
        "Expected an array of strings",
        "workflows.entry_points"
      );
    }

    if (!Array.isArray(workflow.steps) || workflow.steps.length === 0) {
      pushIssue(
        issues,
        "error",
        `$.workflows[${index}].steps`,
        "Expected at least one workflow step",
        "workflows.steps"
      );
    }
  });

  return createResult(value as unknown as AICWorkflowManifest, issues);
}

export function validateSemanticActionsManifest(
  value: unknown
): ValidationResult<AICSemanticActionsManifest> {
  const issues: AICValidationIssue[] = [];

  if (!isRecord(value)) {
    pushIssue(issues, "fatal", "$", "Expected an object", "actions.object");
    return { ok: false, issues };
  }

  if (value.spec !== SPEC_VERSION) {
    pushIssue(
      issues,
      "error",
      "$.spec",
      `Expected spec to equal ${SPEC_VERSION}`,
      "actions.spec"
    );
  }

  if (!Array.isArray(value.actions)) {
    pushIssue(issues, "fatal", "$.actions", "Expected an array", "actions.actions");
    return { ok: false, issues };
  }

  value.actions.forEach((action, index) => {
    validateActionContract(action, `$.actions[${index}]`, issues);
  });

  return createResult(value as unknown as AICSemanticActionsManifest, issues);
}

export function createEmptyPermissionsManifest(): AICPermissionsManifest {
  return {
    spec: SPEC_VERSION,
    manifest_version: MANIFEST_VERSION,
    generated_at: new Date().toISOString(),
    riskBands: {
      low: { requiresConfirmation: false },
      medium: { requiresConfirmation: false },
      high: { requiresConfirmation: true },
      critical: { requiresConfirmation: true }
    }
  };
}

export const validateAgentUiManifest = validateRuntimeUiManifest;
