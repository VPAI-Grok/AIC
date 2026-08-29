import type { AICRegistry } from "@aicorg/runtime";
import type {
  AICActionContract,
  AICConfirmationProtocol,
  AICElementManifest,
  JsonObject
} from "@aicorg/spec";

export const AIC_WEBMCP_DRAFT_BASELINE = "2026-08-26";
export const AIC_WEBMCP_TYPES_BASELINE = "0.1.5";
export const AIC_WEBMCP_API = "document.modelContext";

export type AICWebMCPMaybePromise<T> = T | Promise<T>;

export interface AICWebMCPToolAnnotations {
  readOnlyHint?: boolean;
  untrustedContentHint?: boolean;
}

export interface AICWebMCPToolDescriptor {
  annotations?: AICWebMCPToolAnnotations;
  description: string;
  inputSchema: Record<string, unknown>;
  name: string;
  title?: string;
}

export interface AICWebMCPNativeTool extends AICWebMCPToolDescriptor {
  execute: (
    input: Record<string, unknown>,
    options: { signal: AbortSignal }
  ) => AICWebMCPMaybePromise<unknown>;
}

export interface AICWebMCPModelContext {
  registerTool(
    tool: AICWebMCPNativeTool,
    options?: { exposedTo?: string[]; signal?: AbortSignal }
  ): Promise<void>;
}

export interface AICWebMCPExecutionContext {
  action: AICActionContract;
  element: AICElementManifest;
  signal: AbortSignal;
  tool: AICWebMCPToolDescriptor;
}

export interface AICWebMCPConfirmationRequest<TInput extends Record<string, unknown>> {
  input: TInput;
  prompt: string;
  protocol: AICConfirmationProtocol;
  summary: Record<string, unknown>;
}

export interface AICWebMCPToolBinding<
  TInput extends Record<string, unknown> = Record<string, unknown>,
  TResult = unknown
> {
  action: AICActionContract;
  authorize?: (
    input: TInput,
    context: AICWebMCPExecutionContext
  ) => AICWebMCPMaybePromise<boolean>;
  confirm?: (
    request: AICWebMCPConfirmationRequest<TInput>,
    context: AICWebMCPExecutionContext
  ) => AICWebMCPMaybePromise<boolean>;
  element: AICElementManifest;
  execute: (
    input: TInput,
    context: AICWebMCPExecutionContext
  ) => AICWebMCPMaybePromise<TResult>;
  registry?: Pick<AICRegistry, "emitActionEvent">;
  tool: AICWebMCPToolDescriptor;
  validate: (
    input: TInput,
    context: AICWebMCPExecutionContext
  ) => AICWebMCPMaybePromise<void>;
  verify?: (
    result: TResult,
    input: TInput,
    context: AICWebMCPExecutionContext
  ) => AICWebMCPMaybePromise<boolean>;
}

export type AICWebMCPReadinessFindingCode =
  | "action_not_authored"
  | "action_not_execution_ready"
  | "confirmation_handler_missing"
  | "confirmation_metadata_missing"
  | "high_risk_authorization_missing"
  | "critical_entity_missing"
  | "critical_permission_missing"
  | "description_budget_exceeded"
  | "explicit_failure_modes_missing"
  | "input_schema_invalid"
  | "mutating_side_effects_missing"
  | "mutating_verification_missing"
  | "read_only_side_effect_conflict"
  | "target_mismatch"
  | "tool_description_missing"
  | "tool_name_invalid"
  | "tool_name_recommended_budget_exceeded"
  | "verifiable_completion_missing";

export interface AICWebMCPReadinessFinding {
  code: AICWebMCPReadinessFindingCode;
  message: string;
  severity: "blocker" | "warning";
}

export interface AICWebMCPReadinessReport {
  baseline: {
    api: typeof AIC_WEBMCP_API;
    draft: typeof AIC_WEBMCP_DRAFT_BASELINE;
    types: typeof AIC_WEBMCP_TYPES_BASELINE;
  };
  findings: AICWebMCPReadinessFinding[];
  ready: boolean;
  tool_name: string;
}

export type AICWebMCPErrorCode =
  | "authorization_denied"
  | "confirmation_declined"
  | "execution_aborted"
  | "execution_failed"
  | "registration_aborted"
  | "registration_blocked"
  | "registration_failed"
  | "unsupported_browser"
  | "verification_failed";

export class AICWebMCPError extends Error {
  readonly code: AICWebMCPErrorCode;
  readonly findings?: AICWebMCPReadinessFinding[];

  constructor(
    code: AICWebMCPErrorCode,
    message: string,
    options: { cause?: unknown; findings?: AICWebMCPReadinessFinding[] } = {}
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "AICWebMCPError";
    this.code = code;
    this.findings = options.findings;
  }
}

export interface AICWebMCPRegistrationOptions {
  exposedTo?: string[];
  modelContext?: AICWebMCPModelContext;
  requireSupport?: boolean;
  signal?: AbortSignal;
}

export interface AICWebMCPRegistration {
  dispose(): void;
  readiness: AICWebMCPReadinessReport;
  status: "registered" | "unsupported";
}

function hasCompleteEntity(element: AICElementManifest): boolean {
  return Boolean(element.entity_ref?.entity_id && element.entity_ref.entity_type);
}

function hasStructuredConfirmation(element: AICElementManifest): boolean {
  return Boolean(
    element.requires_confirmation === true &&
      element.confirmation?.type &&
      element.confirmation.prompt_template?.trim()
  );
}

function hasPlaceholderCompletion(action: AICActionContract): boolean {
  return (
    action.completion_signal.value === "review_required" ||
    action.completion_signal.value.endsWith(".completed = true")
  );
}

function hasPlaceholderFailureModes(action: AICActionContract): boolean {
  return action.failure_modes.some(
    (failureMode) => failureMode === "unknown_failure" || failureMode === "review_required"
  );
}

function addFinding(
  findings: AICWebMCPReadinessFinding[],
  code: AICWebMCPReadinessFindingCode,
  message: string,
  severity: AICWebMCPReadinessFinding["severity"] = "blocker"
): void {
  findings.push({ code, message, severity });
}

export function auditAICWebMCPTool<
  TInput extends Record<string, unknown>,
  TResult
>(
  binding: AICWebMCPToolBinding<TInput, TResult>
): AICWebMCPReadinessReport {
  const findings: AICWebMCPReadinessFinding[] = [];
  const { action, element, tool } = binding;
  const readiness = action.execution_readiness;
  const readOnly = tool.annotations?.readOnlyHint === true;
  const requiresConfirmation = element.risk === "critical" || element.requires_confirmation === true;

  if (!/^[A-Za-z0-9_.-]{1,128}$/.test(tool.name)) {
    addFinding(
      findings,
      "tool_name_invalid",
      "WebMCP tool names must be 1-128 ASCII letters, numbers, underscore, hyphen, or period."
    );
  } else if (tool.name.length > 30) {
    addFinding(
      findings,
      "tool_name_recommended_budget_exceeded",
      "Tool name exceeds AIC's 30-character interoperability budget.",
      "warning"
    );
  }

  if (!tool.description.trim()) {
    addFinding(findings, "tool_description_missing", "WebMCP tools require a clear description.");
  } else if (tool.description.length > 500) {
    addFinding(
      findings,
      "description_budget_exceeded",
      "Tool description exceeds AIC's 500-character context budget.",
      "warning"
    );
  }

  if (!tool.inputSchema || tool.inputSchema.type !== "object") {
    addFinding(
      findings,
      "input_schema_invalid",
      "AIC-governed WebMCP tools require an object JSON input schema plus application validation."
    );
  }

  if (action.target !== element.id) {
    addFinding(
      findings,
      "target_mismatch",
      `Action target ${action.target} does not match AIC element ${element.id}.`
    );
  }

  if (
    readiness?.status !== "execution_ready" ||
    (readiness.blockers?.length ?? 0) > 0
  ) {
    addFinding(
      findings,
      "action_not_execution_ready",
      "Only action contracts explicitly marked execution_ready can become WebMCP tools."
    );
  }

  if (readiness?.source !== "authored") {
    addFinding(
      findings,
      "action_not_authored",
      "Inferred and AI-suggested action contracts cannot become executable WebMCP tools."
    );
  }

  if (hasPlaceholderCompletion(action)) {
    addFinding(
      findings,
      "verifiable_completion_missing",
      "The action contract must declare a real app-verifiable completion signal."
    );
  }

  if (hasPlaceholderFailureModes(action)) {
    addFinding(
      findings,
      "explicit_failure_modes_missing",
      "The action contract must replace placeholder failures with explicit application failure modes."
    );
  }

  if (readOnly && action.side_effects.length > 0) {
    addFinding(
      findings,
      "read_only_side_effect_conflict",
      "A tool marked read-only cannot reference an action contract with side effects."
    );
  }

  if (!readOnly && action.side_effects.length === 0) {
    addFinding(
      findings,
      "mutating_side_effects_missing",
      "Mutating WebMCP tools must declare their side effects."
    );
  }

  if (!readOnly && !binding.verify) {
    addFinding(
      findings,
      "mutating_verification_missing",
      "Mutating WebMCP tools require an application-level completion verifier."
    );
  }

  if (requiresConfirmation && !hasStructuredConfirmation(element)) {
    addFinding(
      findings,
      "confirmation_metadata_missing",
      "Critical or confirmation-gated tools require a structured AIC confirmation protocol and prompt."
    );
  }

  if (requiresConfirmation && !binding.confirm) {
    addFinding(
      findings,
      "confirmation_handler_missing",
      "Critical or confirmation-gated tools require an explicit human confirmation handler."
    );
  }

  if ((element.risk === "high" || element.risk === "critical") && !binding.authorize) {
    addFinding(
      findings,
      "high_risk_authorization_missing",
      "High and critical tools require an application authorization callback."
    );
  }

  if (element.risk === "critical" && !hasCompleteEntity(element)) {
    addFinding(
      findings,
      "critical_entity_missing",
      "Critical tools require an explicit backing entity ID and type."
    );
  }

  if (element.risk === "critical" && (element.permissions?.length ?? 0) === 0) {
    addFinding(
      findings,
      "critical_permission_missing",
      "Critical tools require at least one explicit AIC permission key."
    );
  }

  return {
    baseline: {
      api: AIC_WEBMCP_API,
      draft: AIC_WEBMCP_DRAFT_BASELINE,
      types: AIC_WEBMCP_TYPES_BASELINE
    },
    findings,
    ready: findings.every((finding) => finding.severity !== "blocker"),
    tool_name: tool.name
  };
}

function resolveModelContext(
  provided: AICWebMCPModelContext | undefined
): AICWebMCPModelContext | undefined {
  if (provided) {
    return provided;
  }

  if (typeof document === "undefined") {
    return undefined;
  }

  return document.modelContext as AICWebMCPModelContext | undefined;
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new AICWebMCPError("execution_aborted", "WebMCP tool execution was cancelled.");
  }
}

function renderConfirmationPrompt(
  protocol: AICConfirmationProtocol,
  input: Record<string, unknown>
): string {
  const template = protocol.prompt_template ?? "Confirm this action?";
  return template.replace(/\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g, (match, key: string) => {
    const value = input[key];
    return value === undefined || value === null ? match : String(value);
  });
}

function createConfirmationSummary(
  protocol: AICConfirmationProtocol,
  input: Record<string, unknown>
): Record<string, unknown> {
  return Object.fromEntries(
    (protocol.summary_fields ?? [])
      .filter((field) => Object.hasOwn(input, field))
      .map((field) => [field, input[field]])
  );
}

function eventPayload<TInput extends Record<string, unknown>, TResult>(
  binding: AICWebMCPToolBinding<TInput, TResult>,
  phase: string,
  code?: string
): JsonObject {
  return {
    action_id: binding.action.name,
    phase,
    tool_name: binding.tool.name,
    ...(code ? { error_code: code } : {})
  };
}

function normalizeExecutionError(error: unknown): AICWebMCPError {
  if (error instanceof AICWebMCPError) {
    return error;
  }

  return new AICWebMCPError(
    "execution_failed",
    error instanceof Error ? error.message : "WebMCP tool execution failed.",
    { cause: error }
  );
}

function createNativeTool<TInput extends Record<string, unknown>, TResult>(
  binding: AICWebMCPToolBinding<TInput, TResult>,
  registrationSignal: AbortSignal
): AICWebMCPNativeTool {
  const nativeTool: AICWebMCPNativeTool = {
    ...binding.tool,
    execute: async (untrustedInput, options) => {
      // Early browser implementations invoke the draft callback with only the
      // input object. Fall back to the registration lifecycle so cancellation
      // remains fail-closed without crashing before validation.
      const signal = options?.signal ?? registrationSignal;
      const input = untrustedInput as TInput;
      const context: AICWebMCPExecutionContext = {
        action: binding.action,
        element: binding.element,
        signal,
        tool: binding.tool
      };

      binding.registry?.emitActionEvent(
        "action_started",
        binding.element.id,
        eventPayload(binding, "started")
      );

      try {
        throwIfAborted(signal);
        await binding.validate(input, context);
        throwIfAborted(signal);

        if (binding.authorize && !(await binding.authorize(input, context))) {
          throw new AICWebMCPError(
            "authorization_denied",
            "Application authorization denied this WebMCP action."
          );
        }

        throwIfAborted(signal);

        const protocol = binding.element.confirmation;
        if (binding.element.risk === "critical" || binding.element.requires_confirmation === true) {
          if (!protocol || !binding.confirm) {
            throw new AICWebMCPError(
              "registration_blocked",
              "Confirmation metadata or handler disappeared after WebMCP registration."
            );
          }

          const confirmed = await binding.confirm(
            {
              input,
              prompt: renderConfirmationPrompt(protocol, input),
              protocol,
              summary: createConfirmationSummary(protocol, input)
            },
            context
          );

          if (!confirmed) {
            throw new AICWebMCPError(
              "confirmation_declined",
              "Human confirmation was declined."
            );
          }
        }

        throwIfAborted(signal);
        const result = await binding.execute(input, context);
        throwIfAborted(signal);

        if (binding.verify && !(await binding.verify(result, input, context))) {
          throw new AICWebMCPError(
            "verification_failed",
            "The application completion verifier did not observe the declared result."
          );
        }

        binding.registry?.emitActionEvent(
          "action_completed",
          binding.element.id,
          eventPayload(binding, "completed")
        );
        return result;
      } catch (error) {
        const normalized = normalizeExecutionError(error);
        binding.registry?.emitActionEvent(
          "action_failed",
          binding.element.id,
          eventPayload(binding, "failed", normalized.code)
        );
        throw normalized;
      }
    }
  };

  const officialCompatibilityCheck: WebMCP.ModelContextTool = nativeTool;
  void officialCompatibilityCheck;
  return nativeTool;
}

function validateExposedOrigins(exposedTo: string[] | undefined): void {
  for (const origin of exposedTo ?? []) {
    let parsed: URL;

    try {
      parsed = new URL(origin);
    } catch {
      throw new AICWebMCPError(
        "registration_blocked",
        `Invalid WebMCP exposedTo origin: ${origin}`
      );
    }

    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
      throw new AICWebMCPError(
        "registration_blocked",
        `WebMCP cross-origin exposure must use a secure origin: ${origin}`
      );
    }
  }
}

export async function registerAICWebMCPTool<
  TInput extends Record<string, unknown>,
  TResult
>(
  binding: AICWebMCPToolBinding<TInput, TResult>,
  options: AICWebMCPRegistrationOptions = {}
): Promise<AICWebMCPRegistration> {
  const readiness = auditAICWebMCPTool(binding);

  if (!readiness.ready) {
    throw new AICWebMCPError(
      "registration_blocked",
      `AIC blocked WebMCP registration for ${binding.tool.name}.`,
      { findings: readiness.findings }
    );
  }

  validateExposedOrigins(options.exposedTo);

  if (options.signal?.aborted) {
    throw new AICWebMCPError("registration_aborted", "WebMCP registration was cancelled.");
  }

  const modelContext = resolveModelContext(options.modelContext);
  if (!modelContext) {
    if (options.requireSupport) {
      throw new AICWebMCPError(
        "unsupported_browser",
        "This browser does not expose document.modelContext."
      );
    }

    return {
      dispose() {},
      readiness,
      status: "unsupported"
    };
  }

  const lifecycle = new AbortController();
  const forwardAbort = () => lifecycle.abort(options.signal?.reason);
  options.signal?.addEventListener("abort", forwardAbort, { once: true });

  try {
    await modelContext.registerTool(createNativeTool(binding, lifecycle.signal), {
      exposedTo: options.exposedTo,
      signal: lifecycle.signal
    });
  } catch (error) {
    lifecycle.abort();
    options.signal?.removeEventListener("abort", forwardAbort);
    throw new AICWebMCPError(
      "registration_failed",
      error instanceof Error ? error.message : "Browser WebMCP registration failed.",
      { cause: error }
    );
  }

  let disposed = false;
  return {
    dispose() {
      if (disposed) {
        return;
      }

      disposed = true;
      options.signal?.removeEventListener("abort", forwardAbort);
      lifecycle.abort();
    },
    readiness,
    status: "registered"
  };
}
