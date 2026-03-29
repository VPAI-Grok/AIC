import {
  MANIFEST_VERSION,
  SPEC_VERSION,
  type AICActionName,
  type AICConfirmationProtocol,
  type AICDiscoveryManifest,
  type AICRisk,
  type AICRole,
  type AICRuntimeUiManifest,
  type AICValidationIssue,
  type AICValidationSeverity,
  type JsonObject,
  validateDiscoveryManifest,
  validateRuntimeUiManifest
} from "@aicorg/spec";

export interface AICBootstrapPageCapture {
  accessibility?: JsonObject;
  dom?: string;
  route: string;
  screenshot?: string;
  title?: string;
  url: string;
  visible_labels: string[];
}

export interface AICBootstrapSuggestion {
  action: AICActionName;
  ambiguity_notes?: string[];
  confidence_score: number;
  label: string;
  patch_summary?: string;
  provider: string;
  review_required: boolean;
  risk: AICRisk;
  role: AICRole;
  route: string;
  source: "accessibility" | "visible_label";
  target: string;
}

export interface AICBootstrapDraft {
  discovery: AICDiscoveryManifest;
  provider_name?: string;
  suggestions: AICBootstrapSuggestion[];
  ui: AICRuntimeUiManifest[];
}

export type AICBootstrapReviewSuggestionStatus = "accepted" | "filtered_out";
export type AICBootstrapReviewIssueCode =
  | "below_min_confidence"
  | "duplicate_target"
  | "exceeds_max_suggestions"
  | "invalid_suggestion_field"
  | "manifest_validation"
  | "missing_capture_route";

export interface AICBootstrapReviewOptions {
  maxSuggestions?: number;
  minConfidence?: number;
}

export interface AICBootstrapReviewIssue {
  candidate_index?: number;
  code: AICBootstrapReviewIssueCode;
  manifest_kind?: "discovery" | "ui";
  manifest_route?: string;
  message: string;
  path?: string;
  route?: string;
  severity: AICValidationSeverity;
  suggestion_target?: string;
  validator_issue?: AICValidationIssue;
}

export interface AICBootstrapReviewSuggestion {
  candidate_index: number;
  issues: AICBootstrapReviewIssue[];
  raw: unknown;
  status: AICBootstrapReviewSuggestionStatus;
  suggestion?: AICBootstrapSuggestion;
}

export interface AICBootstrapReviewSummary {
  accepted_suggestions: number;
  capture_count: number;
  filtered_suggestions: number;
  review_required_suggestions: number;
  total_suggestions: number;
  validation_issue_count: number;
}

export interface AICBootstrapReview {
  artifact_type: "aic_bootstrap_review";
  captures: AICBootstrapCaptureSummary[];
  draft: AICBootstrapDraft;
  generated_at: string;
  issues: AICBootstrapReviewIssue[];
  options: AICBootstrapReviewOptions;
  provider_name?: string;
  suggestions: AICBootstrapReviewSuggestion[];
  summary: AICBootstrapReviewSummary;
}

export interface AICBootstrapOptions {
  appName: string;
  appVersion?: string;
  routes?: string[];
  targetUrl: string;
}

export interface AICPlaywrightCaptureOptions extends AICBootstrapOptions {
  headless?: boolean;
  maxLabels?: number;
  screenshot?: boolean;
  timeoutMs?: number;
}

export interface AICBootstrapSuggestionProviderContext {
  captures: AICBootstrapPageCapture[];
  options: AICBootstrapOptions;
}

export interface AICBootstrapSuggestionProvider {
  name: string;
  suggest(
    context: AICBootstrapSuggestionProviderContext
  ): Promise<AICBootstrapSuggestion[]>;
  suggestRaw?(
    context: AICBootstrapSuggestionProviderContext
  ): Promise<unknown>;
}

export interface AICBootstrapCaptureSummary {
  accessibility_elements: Array<{
    label: string;
    role?: string;
  }>;
  route: string;
  title?: string;
  url: string;
  visible_labels: string[];
}

export interface AICBootstrapPromptPayload {
  input: JsonObject;
  schema: JsonObject;
  system_prompt: string;
}

export interface AICBootstrapStructuredModelClient {
  completeJson<T>(request: {
    input: JsonObject;
    model: string;
    schema: JsonObject;
    system_prompt: string;
  }): Promise<T>;
}

export const AIC_BOOTSTRAP_PROVIDER_DEFAULT_TIMEOUT_MS = 30000;
export const AIC_BOOTSTRAP_PROVIDER_DEFAULT_RETRIES = 2;

export type AICBootstrapProviderErrorKind =
  | "timeout"
  | "network"
  | "rate_limit"
  | "server"
  | "auth"
  | "client"
  | "invalid_json"
  | "invalid_response"
  | "model_refusal"
  | "unknown";

export interface AICBootstrapProviderErrorOptions {
  attempts?: number;
  cause?: unknown;
  cause_message?: string;
  kind: AICBootstrapProviderErrorKind;
  message: string;
  provider: string;
  retryable: boolean;
  status?: number;
}

export class AICBootstrapProviderError extends Error {
  attempts?: number;
  cause_message?: string;
  kind: AICBootstrapProviderErrorKind;
  provider: string;
  retryable: boolean;
  status?: number;

  constructor(options: AICBootstrapProviderErrorOptions) {
    super(options.message, options.cause instanceof Error ? { cause: options.cause } : undefined);
    this.name = "AICBootstrapProviderError";
    this.attempts = options.attempts;
    this.cause_message = options.cause_message;
    this.kind = options.kind;
    this.provider = options.provider;
    this.retryable = options.retryable;
    this.status = options.status;
  }
}

export function isAICBootstrapProviderError(value: unknown): value is AICBootstrapProviderError {
  if (value instanceof AICBootstrapProviderError) {
    return true;
  }

  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.message === "string" &&
    typeof record.provider === "string" &&
    typeof record.kind === "string" &&
    typeof record.retryable === "boolean"
  );
}

export interface AICModelBootstrapProviderOptions {
  client: AICBootstrapStructuredModelClient;
  maxSuggestions?: number;
  model: string;
  providerName?: string;
  systemPrompt?: string;
}

export interface AICHeuristicBootstrapProviderOptions {
  maxSuggestionsPerPage?: number;
}

type PlaywrightPage = {
  accessibility: { snapshot: () => Promise<unknown> };
  content: () => Promise<string>;
  evaluate: <T>(pageFunction: () => T) => Promise<T>;
  goto: (
    url: string,
    options?: { timeout?: number; waitUntil?: "load" | "domcontentloaded" | "networkidle" }
  ) => Promise<unknown>;
  screenshot: (options: { fullPage?: boolean; type?: "png" }) => Promise<Buffer>;
  title: () => Promise<string>;
};

type AccessibilityNode = {
  children?: unknown[];
  name?: string;
  role?: string;
};

type SuggestionSeed = {
  label: string;
  role?: string;
  source: "accessibility" | "visible_label";
};

type SuggestionCandidate = {
  action?: string;
  ambiguity_notes?: unknown;
  confidence_score?: unknown;
  label?: unknown;
  patch_summary?: unknown;
  review_required?: unknown;
  risk?: string;
  role?: string;
  route?: unknown;
  source?: unknown;
  target?: unknown;
};

type RouteNormalizationResult = {
  issue?: AICBootstrapReviewIssue;
  route?: string;
};

function normalizeRoute(route: string): string {
  return route === "/" ? "/" : `/${route.replace(/^\/+/, "")}`;
}

function joinUrl(baseUrl: string, route: string): string {
  const normalizedRoute = normalizeRoute(route);
  return normalizedRoute === "/" ? baseUrl.replace(/\/$/, "") : `${baseUrl.replace(/\/$/, "")}${normalizedRoute}`;
}

function normalizeLabel(label: string): string {
  return label.replace(/\s+/g, " ").trim();
}

function slugifyLabel(label: string): string {
  const slug = normalizeLabel(label)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return slug || "item";
}

function routePrefix(route: string): string {
  return route.replaceAll("/", ".").replace(/^\./, "") || "root";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function createReviewIssue(
  code: AICBootstrapReviewIssueCode,
  severity: AICValidationSeverity,
  message: string,
  options: Partial<Omit<AICBootstrapReviewIssue, "code" | "message" | "severity">> = {}
): AICBootstrapReviewIssue {
  return {
    code,
    message,
    severity,
    ...options
  };
}

function createFilteredSuggestion(
  candidateIndex: number,
  raw: unknown,
  issue: AICBootstrapReviewIssue
): AICBootstrapReviewSuggestion {
  return {
    candidate_index: candidateIndex,
    issues: [issue],
    raw,
    status: "filtered_out"
  };
}

function collectAccessibilitySeeds(node: unknown, seeds: SuggestionSeed[] = []): SuggestionSeed[] {
  if (!node || typeof node !== "object") {
    return seeds;
  }

  const candidate = node as AccessibilityNode;
  const label = typeof candidate.name === "string" ? normalizeLabel(candidate.name) : "";

  if (label) {
    seeds.push({
      label,
      role: typeof candidate.role === "string" ? candidate.role : undefined,
      source: "accessibility"
    });
  }

  if (Array.isArray(candidate.children)) {
    candidate.children.forEach((child) => collectAccessibilitySeeds(child, seeds));
  }

  return seeds;
}

function inferRole(role: string | undefined, label: string): AICRole {
  const normalizedRole = role?.toLowerCase();
  const normalizedLabel = label.toLowerCase();

  switch (normalizedRole) {
    case "button":
      return "button";
    case "link":
      return "link";
    case "textbox":
    case "input":
      return normalizedLabel.includes("search") ? "searchbox" : "input";
    case "searchbox":
      return "searchbox";
    case "textarea":
      return "textarea";
    case "checkbox":
      return "checkbox";
    case "radio":
      return "radio";
    case "switch":
      return "switch";
    case "combobox":
      return "combobox";
    case "listbox":
      return "listbox";
    case "option":
      return "option";
    case "grid":
      return "grid";
    case "row":
      return "row";
    case "cell":
      return "cell";
    case "table":
      return "table";
    case "form":
      return "form";
    case "dialog":
      return "dialog";
    case "tab":
      return "tab";
    case "tabpanel":
      return "tabpanel";
    case "menu":
      return "menu";
    case "menuitem":
      return "menuitem";
    default:
      if (normalizedLabel.includes("search")) {
        return "searchbox";
      }
      if (normalizedLabel.includes("upload")) {
        return "upload";
      }
      return "generic";
  }
}

function inferAction(role: AICRole, label: string): AICActionName {
  const normalizedLabel = label.toLowerCase();

  if (role === "link" || /^go to\b|^view\b|^open\b/.test(normalizedLabel)) {
    return "navigate";
  }

  if (role === "input" || role === "textarea" || role === "searchbox") {
    return "input";
  }

  if (role === "select" || role === "option" || role === "combobox" || role === "listbox") {
    return "select";
  }

  if (role === "checkbox" || role === "radio" || role === "switch") {
    return "toggle";
  }

  if (role === "upload" || normalizedLabel.includes("upload")) {
    return "upload";
  }

  if (/submit|save|place order|confirm|checkout|pay|purchase/.test(normalizedLabel)) {
    return "submit";
  }

  if (/download|export/.test(normalizedLabel)) {
    return "download";
  }

  return "click";
}

function inferRisk(label: string): AICRisk {
  const normalizedLabel = label.toLowerCase();

  if (/delete account|place order|charge|pay now|purchase/.test(normalizedLabel)) {
    return "critical";
  }

  if (/delete|remove|refund|cancel subscription|publish|archive/.test(normalizedLabel)) {
    return "high";
  }

  if (/save|update|create|invite|submit/.test(normalizedLabel)) {
    return "medium";
  }

  return "low";
}

function createAmbiguityNotes(role: AICRole, source: "accessibility" | "visible_label"): string[] | undefined {
  const notes: string[] = [];

  if (source === "visible_label") {
    notes.push("Derived from visible label text only");
  }

  if (role === "generic") {
    notes.push("Unable to infer a specific control role from available capture data");
  }

  return notes.length > 0 ? notes : undefined;
}

function buildPatchSummary(target: string, label: string, action: AICActionName): string {
  return `Annotate "${label}" with agentId="${target}" and agentAction="${action}"`;
}

function clampConfidence(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : fallback;
}

function normalizeNotes(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const notes = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return notes.length > 0 ? notes : undefined;
}

function normalizeAction(action: string | undefined, role: AICRole, label: string): AICActionName {
  const normalizedAction = action?.toLowerCase();

  switch (normalizedAction) {
    case "click":
    case "submit":
    case "navigate":
    case "toggle":
    case "select":
    case "input":
    case "read":
    case "upload":
    case "download":
    case "custom":
      return normalizedAction;
    default:
      return inferAction(role, label);
  }
}

function normalizeRisk(risk: string | undefined, label: string): AICRisk {
  switch (risk?.toLowerCase()) {
    case "low":
      return "low";
    case "medium":
      return "medium";
    case "high":
      return "high";
    case "critical":
      return "critical";
    default:
      return inferRisk(label);
  }
}

function normalizeSource(value: unknown): "accessibility" | "visible_label" {
  return value === "accessibility" ? "accessibility" : "visible_label";
}

function normalizeRouteForCandidate(
  value: unknown,
  captures: AICBootstrapPageCapture[],
  candidateIndex: number
): RouteNormalizationResult {
  if (typeof value !== "string" || value.trim().length === 0) {
    return {
      issue: createReviewIssue(
        "missing_capture_route",
        "warning",
        "Suggestion route was missing or empty.",
        {
          candidate_index: candidateIndex,
          path: `suggestions[${candidateIndex}].route`
        }
      )
    };
  }

  const normalized = normalizeRoute(value);
  const hasMatchingCapture =
    captures.length === 0 || captures.some((capture) => capture.route === normalized);

  if (!hasMatchingCapture) {
    return {
      issue: createReviewIssue(
        "missing_capture_route",
        "warning",
        `Suggestion route "${normalized}" was not captured.`,
        {
          candidate_index: candidateIndex,
          path: `suggestions[${candidateIndex}].route`,
          route: normalized
        }
      )
    };
  }

  return {
    route: normalized
  };
}

function normalizeSuggestionCandidate(
  candidate: SuggestionCandidate,
  captures: AICBootstrapPageCapture[],
  providerName: string,
  index: number
): AICBootstrapReviewSuggestion {
  if (!isRecord(candidate)) {
    return createFilteredSuggestion(
      index,
      candidate,
      createReviewIssue(
        "invalid_suggestion_field",
        "warning",
        "Suggestion candidate must be an object.",
        {
          candidate_index: index,
          path: `suggestions[${index}]`
        }
      )
    );
  }

  const issues: AICBootstrapReviewIssue[] = [];
  const label = typeof candidate.label === "string" ? normalizeLabel(candidate.label) : "";

  if (!label) {
    return createFilteredSuggestion(
      index,
      candidate,
      createReviewIssue(
        "invalid_suggestion_field",
        "warning",
        "Suggestion label must be a non-empty string.",
        {
          candidate_index: index,
          path: `suggestions[${index}].label`
        }
      )
    );
  }

  const routeResult = normalizeRouteForCandidate(candidate.route, captures, index);

  if (routeResult.issue) {
    return createFilteredSuggestion(index, candidate, routeResult.issue);
  }

  const route = routeResult.route ?? captures[0]?.route ?? "/";
  const role = inferRole(candidate.role, label);
  const action = normalizeAction(candidate.action, role, label);
  const risk = normalizeRisk(candidate.risk, label);
  const confidenceScore = clampConfidence(candidate.confidence_score, 0.72);

  if (candidate.confidence_score !== undefined && typeof candidate.confidence_score !== "number") {
    issues.push(
      createReviewIssue(
        "invalid_suggestion_field",
        "warning",
        "Suggestion confidence_score must be numeric when provided.",
        {
          candidate_index: index,
          path: `suggestions[${index}].confidence_score`
        }
      )
    );
  }

  const target =
    typeof candidate.target === "string" && candidate.target.trim().length > 0
      ? candidate.target
      : `${routePrefix(route)}.${slugifyLabel(label)}_${index + 1}`;

  if (candidate.target !== undefined && typeof candidate.target !== "string") {
    issues.push(
      createReviewIssue(
        "invalid_suggestion_field",
        "warning",
        "Suggestion target must be a string when provided.",
        {
          candidate_index: index,
          path: `suggestions[${index}].target`,
          route,
          suggestion_target: target
        }
      )
    );
  }

  if (candidate.review_required !== undefined && typeof candidate.review_required !== "boolean") {
    issues.push(
      createReviewIssue(
        "invalid_suggestion_field",
        "warning",
        "Suggestion review_required must be a boolean when provided.",
        {
          candidate_index: index,
          path: `suggestions[${index}].review_required`,
          route,
          suggestion_target: target
        }
      )
    );
  }

  if (candidate.patch_summary !== undefined && typeof candidate.patch_summary !== "string") {
    issues.push(
      createReviewIssue(
        "invalid_suggestion_field",
        "warning",
        "Suggestion patch_summary must be a string when provided.",
        {
          candidate_index: index,
          path: `suggestions[${index}].patch_summary`,
          route,
          suggestion_target: target
        }
      )
    );
  }

  if (candidate.ambiguity_notes !== undefined && !Array.isArray(candidate.ambiguity_notes)) {
    issues.push(
      createReviewIssue(
        "invalid_suggestion_field",
        "warning",
        "Suggestion ambiguity_notes must be an array of strings when provided.",
        {
          candidate_index: index,
          path: `suggestions[${index}].ambiguity_notes`,
          route,
          suggestion_target: target
        }
      )
    );
  }

  return {
    candidate_index: index,
    issues,
    raw: candidate,
    status: "accepted",
    suggestion: {
      action,
      ambiguity_notes:
        normalizeNotes(candidate.ambiguity_notes) ??
        createAmbiguityNotes(role, normalizeSource(candidate.source)),
      confidence_score: confidenceScore,
      label,
      patch_summary:
        typeof candidate.patch_summary === "string"
          ? candidate.patch_summary
          : buildPatchSummary(target, label, action),
      provider: providerName,
      review_required:
        typeof candidate.review_required === "boolean"
          ? candidate.review_required
          : confidenceScore < 0.85 || risk === "high" || risk === "critical",
      risk,
      role,
      route,
      source: normalizeSource(candidate.source),
      target
    }
  };
}

function normalizeSuggestionList(
  value: unknown,
  captures: AICBootstrapPageCapture[],
  providerName: string
): AICBootstrapSuggestion[] {
  return normalizeSuggestionListForReview(value, captures, providerName).suggestions
    .filter((entry): entry is AICBootstrapReviewSuggestion & { suggestion: AICBootstrapSuggestion } => {
      return entry.status === "accepted" && Boolean(entry.suggestion);
    })
    .map((entry) => entry.suggestion);
}

function normalizeSuggestionListForReview(
  value: unknown,
  captures: AICBootstrapPageCapture[],
  providerName: string
): {
  issues: AICBootstrapReviewIssue[];
  suggestions: AICBootstrapReviewSuggestion[];
} {
  if (!Array.isArray(value)) {
    return {
      issues: [
        createReviewIssue(
          "invalid_suggestion_field",
          "warning",
          "Suggestion provider output must be an array.",
          {
            path: "suggestions"
          }
        )
      ],
      suggestions: []
    };
  }

  return {
    issues: [],
    suggestions: value.map((candidate, index) =>
      normalizeSuggestionCandidate(candidate as SuggestionCandidate, captures, providerName, index)
    )
  };
}

function dedupeSuggestions(suggestions: AICBootstrapSuggestion[]): AICBootstrapSuggestion[] {
  const seenTargets = new Set<string>();
  const deduped: AICBootstrapSuggestion[] = [];

  suggestions.forEach((suggestion) => {
    const key = `${suggestion.route}::${suggestion.target}`;

    if (seenTargets.has(key)) {
      return;
    }

    seenTargets.add(key);
    deduped.push(suggestion);
  });

  return deduped;
}

function buildHeuristicSuggestions(
  context: AICBootstrapSuggestionProviderContext,
  options: AICHeuristicBootstrapProviderOptions = {}
): AICBootstrapSuggestion[] {
  const maxSuggestionsPerPage = options.maxSuggestionsPerPage ?? 12;

  return dedupeSuggestions(
    context.captures.flatMap((capture) => {
      const accessibilitySeeds = collectAccessibilitySeeds(capture.accessibility);
      const visibleLabelSeeds = capture.visible_labels.map<SuggestionSeed>((label) => ({
        label: normalizeLabel(label),
        source: "visible_label"
      }));
      const uniqueSeeds = [...accessibilitySeeds, ...visibleLabelSeeds].filter((seed, index, allSeeds) => {
        return (
          seed.label.length > 0 &&
          allSeeds.findIndex(
            (candidate) => candidate.label.toLowerCase() === seed.label.toLowerCase() && candidate.source === seed.source
          ) === index
        );
      });

      return uniqueSeeds.slice(0, maxSuggestionsPerPage).map((seed, index) => {
        const role = inferRole(seed.role, seed.label);
        const action = inferAction(role, seed.label);
        const risk = inferRisk(seed.label);
        const confidenceScore = seed.source === "accessibility" ? (role === "generic" ? 0.7 : 0.84) : 0.58;
        const target = `${routePrefix(capture.route)}.${slugifyLabel(seed.label)}_${index + 1}`;

        return {
          action,
          ambiguity_notes: createAmbiguityNotes(role, seed.source),
          confidence_score: confidenceScore,
          label: seed.label,
          patch_summary: buildPatchSummary(target, seed.label, action),
          provider: "heuristic",
          review_required: confidenceScore < 0.8 || risk === "high" || risk === "critical",
          risk,
          role,
          route: capture.route,
          source: seed.source,
          target
        };
      });
    })
  );
}

export function summarizeBootstrapCaptures(
  captures: AICBootstrapPageCapture[],
  maxAccessibilityElements = 24
): AICBootstrapCaptureSummary[] {
  return captures.map((capture) => ({
    accessibility_elements: collectAccessibilitySeeds(capture.accessibility).slice(0, maxAccessibilityElements).map((seed) => ({
      label: seed.label,
      role: seed.role
    })),
    route: capture.route,
    title: capture.title,
    url: capture.url,
    visible_labels: capture.visible_labels
  }));
}

function serializeBootstrapCaptureSummaries(captures: AICBootstrapPageCapture[]): JsonObject[] {
  return summarizeBootstrapCaptures(captures).map((summary) => ({
    accessibility_elements: summary.accessibility_elements.map((element) => ({
      label: element.label,
      role: element.role ?? null
    })),
    route: summary.route,
    title: summary.title ?? null,
    url: summary.url,
    visible_labels: summary.visible_labels
  }));
}

export function createBootstrapSuggestionPrompt(
  options: AICBootstrapOptions,
  captures: AICBootstrapPageCapture[],
  maxSuggestions = 24
): AICBootstrapPromptPayload {
  return {
    system_prompt:
      "You are generating AIC bootstrap suggestions for a web app. Return only JSON. Prefer stable, semantic agent IDs. Infer role, action, risk, and review-required state conservatively.",
    input: {
      app: {
        name: options.appName,
        version: options.appVersion ?? null,
        target_url: options.targetUrl
      },
      max_suggestions: maxSuggestions,
      routes: createBootstrapCrawlerPlan(options),
      captures: serializeBootstrapCaptureSummaries(captures)
    },
    schema: {
      type: "array",
      items: {
        type: "object",
        required: ["label", "route"],
        properties: {
          target: { type: "string" },
          label: { type: "string" },
          route: { type: "string" },
          role: { type: "string" },
          action: { type: "string" },
          risk: { type: "string", enum: ["low", "medium", "high", "critical"] },
          confidence_score: { type: "number" },
          source: { type: "string", enum: ["accessibility", "visible_label"] },
          review_required: { type: "boolean" },
          ambiguity_notes: {
            type: "array",
            items: { type: "string" }
          },
          patch_summary: { type: "string" }
        }
      }
    }
  };
}

export function createStaticBootstrapSuggestionProvider(
  suggestions: unknown,
  providerName = "static"
): AICBootstrapSuggestionProvider {
  return {
    name: providerName,
    async suggest(context) {
      return normalizeSuggestionList(suggestions, context.captures, providerName);
    },
    async suggestRaw() {
      return suggestions;
    }
  };
}

export function createModelBootstrapSuggestionProvider(
  options: AICModelBootstrapProviderOptions
): AICBootstrapSuggestionProvider {
  const providerName = options.providerName ?? `model:${options.model}`;
  const loadSuggestions = async (context: AICBootstrapSuggestionProviderContext): Promise<unknown> => {
    const prompt = createBootstrapSuggestionPrompt(
      context.options,
      context.captures,
      options.maxSuggestions ?? 24
    );

    return options.client.completeJson<unknown>({
      input: prompt.input,
      model: options.model,
      schema: prompt.schema,
      system_prompt: options.systemPrompt ?? prompt.system_prompt
    });
  };

  return {
    name: providerName,
    async suggest(context) {
      const response = await loadSuggestions(context);
      return normalizeSuggestionList(response, context.captures, providerName);
    },
    async suggestRaw(context) {
      return loadSuggestions(context);
    }
  };
}

function buildDraftFromSuggestions(
  options: AICBootstrapOptions,
  captures: AICBootstrapPageCapture[],
  suggestions: AICBootstrapSuggestion[],
  providerName?: string
): AICBootstrapDraft {
  const discovery: AICDiscoveryManifest = {
    spec: SPEC_VERSION,
    manifest_version: MANIFEST_VERSION,
    generated_at: new Date().toISOString(),
    app: {
      name: options.appName,
      version: options.appVersion
    },
    capabilities: {
      runtimeUiTree: true,
      semanticActions: true,
      workflows: true,
      permissions: true,
      actionContracts: true,
      entityModel: true,
      executionModel: true,
      recoveryModel: true
    },
    endpoints: {
      ui: "/.well-known/agent/ui",
      actions: "/.well-known/agent/actions",
      permissions: "/.well-known/agent-permissions.json",
      workflows: "/.well-known/agent-workflows.json"
    },
    notes: [
      "AI bootstrap draft. Human review required before merge.",
      providerName ? `Suggestion provider: ${providerName}.` : "Suggestion provider: heuristic."
    ]
  };

  const ui = captures.map<AICRuntimeUiManifest>((capture) => {
    const routeSuggestions = suggestions.filter((suggestion) => suggestion.route === capture.route);

    return {
      spec: SPEC_VERSION,
      manifest_version: MANIFEST_VERSION,
      updated_at: new Date().toISOString(),
      page: {
        title: capture.title,
        url: capture.url
      },
      view: {
        route_pattern: capture.route,
        view_id: routePrefix(capture.route)
      },
      elements: routeSuggestions.map((suggestion) => ({
        id: suggestion.target,
        label: suggestion.label,
        description: `Suggested from ${suggestion.source.replace("_", " ")} capture data`,
        actions: [
          {
            name: suggestion.action,
            type: "semantic_action"
          }
        ],
        notes: suggestion.patch_summary ? [suggestion.patch_summary] : undefined,
        provenance: {
          ai_suggested: {
            source: "ai_suggested",
            confidence_score: suggestion.confidence_score,
            ambiguity_notes: suggestion.ambiguity_notes,
            requires_human_review_if_below: 0.8
          }
        },
        confirmation: createConfirmationProtocol(suggestion),
        requires_confirmation: suggestion.risk === "high" || suggestion.risk === "critical",
        risk: suggestion.risk,
        role: suggestion.role,
        selectors: {
          text: suggestion.label
        },
        state: {
          visible: true
        }
      }))
    };
  });

  return {
    discovery,
    provider_name: providerName,
    suggestions,
    ui
  };
}

function createConfirmationProtocol(
  suggestion: AICBootstrapSuggestion
): AICConfirmationProtocol | undefined {
  if (suggestion.risk !== "high" && suggestion.risk !== "critical") {
    return undefined;
  }

  return {
    prompt_template: `Confirm ${suggestion.label}`,
    requires_manual_phrase: suggestion.risk === "critical",
    summary_fields: ["label", "risk"],
    type: suggestion.risk === "critical" ? "manual_phrase" : "human_review"
  };
}

function applyBootstrapReviewDecision(
  entry: AICBootstrapReviewSuggestion,
  issue: AICBootstrapReviewIssue
): void {
  entry.status = "filtered_out";
  entry.issues.push(issue);
}

function createDuplicateKey(suggestion: AICBootstrapSuggestion): string {
  return `${suggestion.route}::${suggestion.target}`;
}

function applyDuplicateSuggestionFiltering(
  suggestions: AICBootstrapReviewSuggestion[]
): void {
  const acceptedSuggestions = suggestions
    .filter((entry): entry is AICBootstrapReviewSuggestion & { suggestion: AICBootstrapSuggestion } => {
      return entry.status === "accepted" && Boolean(entry.suggestion);
    })
    .sort((left, right) => {
      const confidenceDelta =
        right.suggestion.confidence_score - left.suggestion.confidence_score;

      if (confidenceDelta !== 0) {
        return confidenceDelta;
      }

      return left.candidate_index - right.candidate_index;
    });
  const seenKeys = new Set<string>();

  acceptedSuggestions.forEach((entry) => {
    const key = createDuplicateKey(entry.suggestion);

    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      return;
    }

    applyBootstrapReviewDecision(
      entry,
      createReviewIssue(
        "duplicate_target",
        "warning",
        `Suggestion target "${entry.suggestion.target}" was duplicated for route "${entry.suggestion.route}".`,
        {
          candidate_index: entry.candidate_index,
          path: `suggestions[${entry.candidate_index}]`,
          route: entry.suggestion.route,
          suggestion_target: entry.suggestion.target
        }
      )
    );
  });
}

function applyMinimumConfidenceFiltering(
  suggestions: AICBootstrapReviewSuggestion[],
  minConfidence: number | undefined
): void {
  if (minConfidence === undefined) {
    return;
  }

  suggestions.forEach((entry) => {
    if (entry.status !== "accepted" || !entry.suggestion) {
      return;
    }

    if (entry.suggestion.confidence_score >= minConfidence) {
      return;
    }

    applyBootstrapReviewDecision(
      entry,
      createReviewIssue(
        "below_min_confidence",
        "warning",
        `Suggestion confidence ${entry.suggestion.confidence_score.toFixed(2)} is below the configured minimum ${minConfidence.toFixed(2)}.`,
        {
          candidate_index: entry.candidate_index,
          path: `suggestions[${entry.candidate_index}].confidence_score`,
          route: entry.suggestion.route,
          suggestion_target: entry.suggestion.target
        }
      )
    );
  });
}

function applyMaxSuggestionFiltering(
  suggestions: AICBootstrapReviewSuggestion[],
  maxSuggestions: number | undefined
): void {
  if (maxSuggestions === undefined) {
    return;
  }

  const acceptedSuggestions = suggestions
    .filter((entry): entry is AICBootstrapReviewSuggestion & { suggestion: AICBootstrapSuggestion } => {
      return entry.status === "accepted" && Boolean(entry.suggestion);
    })
    .sort((left, right) => {
      const confidenceDelta =
        right.suggestion.confidence_score - left.suggestion.confidence_score;

      if (confidenceDelta !== 0) {
        return confidenceDelta;
      }

      return left.candidate_index - right.candidate_index;
    });

  acceptedSuggestions.slice(maxSuggestions).forEach((entry) => {
    applyBootstrapReviewDecision(
      entry,
      createReviewIssue(
        "exceeds_max_suggestions",
        "info",
        `Suggestion was filtered because it exceeded the configured maxSuggestions limit of ${maxSuggestions}.`,
        {
          candidate_index: entry.candidate_index,
          path: `suggestions[${entry.candidate_index}]`,
          route: entry.suggestion.route,
          suggestion_target: entry.suggestion.target
        }
      )
    );
  });
}

function collectAcceptedSuggestions(
  suggestions: AICBootstrapReviewSuggestion[]
): AICBootstrapSuggestion[] {
  return suggestions.flatMap((entry) => {
    return entry.status === "accepted" && entry.suggestion ? [entry.suggestion] : [];
  });
}

function collectManifestValidationIssues(
  draft: AICBootstrapDraft
): AICBootstrapReviewIssue[] {
  const issues: AICBootstrapReviewIssue[] = [];

  validateDiscoveryManifest(draft.discovery).issues.forEach((issue) => {
    issues.push(
      createReviewIssue("manifest_validation", issue.severity, issue.message, {
        manifest_kind: "discovery",
        path: issue.path,
        validator_issue: issue
      })
    );
  });

  draft.ui.forEach((manifest) => {
    validateRuntimeUiManifest(manifest).issues.forEach((issue) => {
      issues.push(
        createReviewIssue("manifest_validation", issue.severity, issue.message, {
          manifest_kind: "ui",
          manifest_route: manifest.view.route_pattern ?? manifest.page.url,
          path: issue.path,
          validator_issue: issue
        })
      );
    });
  });

  return issues;
}

function clampReviewOptions(
  options: AICBootstrapReviewOptions | undefined
): AICBootstrapReviewOptions {
  const normalized: AICBootstrapReviewOptions = {};

  if (typeof options?.minConfidence === "number" && Number.isFinite(options.minConfidence)) {
    normalized.minConfidence = Math.max(0, Math.min(1, options.minConfidence));
  }

  if (
    typeof options?.maxSuggestions === "number" &&
    Number.isFinite(options.maxSuggestions) &&
    options.maxSuggestions > 0
  ) {
    normalized.maxSuggestions = Math.floor(options.maxSuggestions);
  }

  return normalized;
}

async function resolveProviderSuggestionValue(
  provider: AICBootstrapSuggestionProvider,
  context: AICBootstrapSuggestionProviderContext
): Promise<unknown> {
  if (provider.suggestRaw) {
    return provider.suggestRaw(context);
  }

  return provider.suggest(context);
}

export async function generateBootstrapReview(
  options: AICBootstrapOptions,
  captures: AICBootstrapPageCapture[],
  provider: AICBootstrapSuggestionProvider = createHeuristicBootstrapSuggestionProvider(),
  reviewOptions: AICBootstrapReviewOptions = {}
): Promise<AICBootstrapReview> {
  const providerContext = {
    captures,
    options
  };
  const rawSuggestions = await resolveProviderSuggestionValue(provider, providerContext);
  const normalizedOptions = clampReviewOptions(reviewOptions);
  const normalized = normalizeSuggestionListForReview(rawSuggestions, captures, provider.name);

  applyDuplicateSuggestionFiltering(normalized.suggestions);
  applyMinimumConfidenceFiltering(normalized.suggestions, normalizedOptions.minConfidence);
  applyMaxSuggestionFiltering(normalized.suggestions, normalizedOptions.maxSuggestions);

  const acceptedSuggestions = collectAcceptedSuggestions(normalized.suggestions);
  const draft = buildDraftFromSuggestions(options, captures, acceptedSuggestions, provider.name);
  const validationIssues = collectManifestValidationIssues(draft);
  const issues = [
    ...normalized.issues,
    ...normalized.suggestions.flatMap((entry) => entry.issues),
    ...validationIssues
  ];

  return {
    artifact_type: "aic_bootstrap_review",
    captures: summarizeBootstrapCaptures(captures),
    draft,
    generated_at: new Date().toISOString(),
    issues,
    options: normalizedOptions,
    provider_name: provider.name,
    suggestions: normalized.suggestions,
    summary: {
      accepted_suggestions: acceptedSuggestions.length,
      capture_count: captures.length,
      filtered_suggestions: normalized.suggestions.filter((entry) => entry.status === "filtered_out").length,
      review_required_suggestions: acceptedSuggestions.filter((suggestion) => suggestion.review_required).length,
      total_suggestions: normalized.suggestions.length,
      validation_issue_count: validationIssues.length
    }
  };
}

export function createHeuristicBootstrapSuggestionProvider(
  options: AICHeuristicBootstrapProviderOptions = {}
): AICBootstrapSuggestionProvider {
  return {
    name: "heuristic",
    async suggest(context) {
      return buildHeuristicSuggestions(context, options);
    },
    async suggestRaw(context) {
      return buildHeuristicSuggestions(context, options);
    }
  };
}

export function createBootstrapCrawlerPlan(options: AICBootstrapOptions): string[] {
  return options.routes && options.routes.length > 0 ? options.routes.map(normalizeRoute) : ["/"];
}

async function collectVisibleLabels(page: PlaywrightPage, maxLabels: number): Promise<string[]> {
  return page
    .evaluate(() => {
      const globalDocument = (globalThis as unknown as {
        document?: {
          querySelectorAll?: (selector: string) => ArrayLike<unknown>;
        };
      }).document;
      const candidates = Array.from(
        globalDocument?.querySelectorAll?.(
          "button, a, input, select, textarea, [role], [data-agent-id]"
        ) ?? []
      );

      return candidates
        .map((element) => {
          const candidate = element as {
            getAttribute?: (name: string) => string | null;
            innerText?: string;
          };

          return (
            candidate.getAttribute?.("aria-label") ||
            candidate.innerText ||
            candidate.getAttribute?.("title") ||
            candidate.getAttribute?.("value") ||
            ""
          ).trim();
        })
        .filter((label) => label.length > 0);
    })
    .then((labels) => labels.slice(0, maxLabels));
}

export async function capturePagesWithPlaywright(
  options: AICPlaywrightCaptureOptions
): Promise<AICBootstrapPageCapture[]> {
  const playwright = await import("playwright");
  const browser = await playwright.chromium.launch({
    headless: options.headless ?? true
  });

  try {
    const page = (await browser.newPage()) as unknown as PlaywrightPage;
    const captures: AICBootstrapPageCapture[] = [];

    for (const route of createBootstrapCrawlerPlan(options)) {
      const url = joinUrl(options.targetUrl, route);
      await page.goto(url, {
        timeout: options.timeoutMs ?? 30000,
        waitUntil: "networkidle"
      });

      const screenshot =
        options.screenshot === false
          ? undefined
          : (await page.screenshot({ fullPage: true, type: "png" })).toString("base64");

      captures.push({
        accessibility: (await page.accessibility.snapshot()) as JsonObject,
        dom: await page.content(),
        route,
        screenshot,
        title: await page.title(),
        url,
        visible_labels: await collectVisibleLabels(page, options.maxLabels ?? 20)
      });
    }

    return captures;
  } finally {
    await browser.close();
  }
}

export function createBootstrapDraft(
  options: AICBootstrapOptions,
  captures: AICBootstrapPageCapture[]
): AICBootstrapDraft {
  const suggestions = buildHeuristicSuggestions({
    captures,
    options
  });

  return buildDraftFromSuggestions(options, captures, suggestions, "heuristic");
}

export async function generateBootstrapDraft(
  options: AICBootstrapOptions,
  captures: AICBootstrapPageCapture[],
  provider: AICBootstrapSuggestionProvider = createHeuristicBootstrapSuggestionProvider()
): Promise<AICBootstrapDraft> {
  const review = await generateBootstrapReview(options, captures, provider);
  return review.draft;
}

export function renderBootstrapReviewReport(review: AICBootstrapReview): string {
  const lines = [
    `Bootstrap review for ${review.draft.discovery.app.name}`,
    `Spec: ${review.draft.discovery.spec}`,
    `Suggestion provider: ${review.provider_name ?? "heuristic"}`,
    `Capture summaries: ${review.summary.capture_count}`,
    `Accepted suggestions: ${review.summary.accepted_suggestions}`,
    `Filtered suggestions: ${review.summary.filtered_suggestions}`,
    `Suggestions requiring review: ${review.summary.review_required_suggestions}`,
    `Validation issues: ${review.summary.validation_issue_count}`,
    "",
    "Accepted targets:"
  ];

  review.draft.suggestions.forEach((suggestion) => {
    lines.push(
      `- ${suggestion.target} [${suggestion.route}] ${suggestion.action} ${suggestion.role} (${Math.round(
        suggestion.confidence_score * 100
      )}% confidence)`
    );
  });

  const filteredSuggestions = review.suggestions.filter((entry) => entry.status === "filtered_out");
  if (filteredSuggestions.length > 0) {
    lines.push("", "Filtered suggestions:");
    filteredSuggestions.forEach((entry) => {
      const label =
        entry.suggestion?.target ??
        (isRecord(entry.raw) && typeof entry.raw.target === "string" ? entry.raw.target : `candidate ${entry.candidate_index + 1}`);
      lines.push(`- ${label}: ${entry.issues.map((issue) => issue.code).join(", ")}`);
    });
  }

  if (review.summary.validation_issue_count > 0) {
    lines.push("", "Validation issues:");
    review.issues
      .filter((issue) => issue.code === "manifest_validation")
      .forEach((issue) => {
        lines.push(`- [${issue.severity}] ${issue.path ?? "$"}: ${issue.message}`);
      });
  }

  return lines.join("\n");
}

export function renderBootstrapReport(draft: AICBootstrapDraft): string {
  return renderBootstrapReviewReport({
    artifact_type: "aic_bootstrap_review",
    captures: draft.ui.map((manifest) => ({
      accessibility_elements: [],
      route: manifest.view.route_pattern ?? "/",
      title: manifest.page.title,
      url: manifest.page.url,
      visible_labels: manifest.elements.map((element) => element.label)
    })),
    draft,
    generated_at: new Date().toISOString(),
    issues: [],
    options: {},
    provider_name: draft.provider_name,
    suggestions: draft.suggestions.map((suggestion, candidateIndex) => ({
      candidate_index: candidateIndex,
      issues: [],
      raw: suggestion,
      status: "accepted",
      suggestion
    })),
    summary: {
      accepted_suggestions: draft.suggestions.length,
      capture_count: draft.ui.length,
      filtered_suggestions: 0,
      review_required_suggestions: draft.suggestions.filter((suggestion) => suggestion.review_required).length,
      total_suggestions: draft.suggestions.length,
      validation_issue_count: 0
    }
  });
}
