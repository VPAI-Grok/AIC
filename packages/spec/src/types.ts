export const AIC_SPEC = "aic/0.1";
export const SPEC_VERSION = AIC_SPEC;
export const MANIFEST_VERSION = "0.1.0";

export const AIC_RISKS = ["low", "medium", "high", "critical"] as const;
export const AIC_RISK_FLAGS = [
  "financial",
  "irreversible",
  "external_side_effect",
  "customer_visible",
  "privacy_sensitive",
  "destructive",
  "compliance_relevant"
] as const;
export const AIC_ACTIONS = [
  "click",
  "submit",
  "navigate",
  "toggle",
  "select",
  "input",
  "read",
  "upload",
  "download",
  "custom"
] as const;
export const AIC_ROLES = [
  "button",
  "link",
  "input",
  "textarea",
  "searchbox",
  "select",
  "option",
  "checkbox",
  "radio",
  "switch",
  "tab",
  "tablist",
  "tabpanel",
  "menu",
  "menuitem",
  "dialog_trigger",
  "dialog",
  "form",
  "upload",
  "grid",
  "row",
  "cell",
  "listbox",
  "combobox",
  "table",
  "generic"
] as const;
export const AIC_CONFIRMATION_TYPES = [
  "human_review",
  "manual_phrase",
  "inline_modal",
  "secondary_approval"
] as const;
export const AIC_PROVENANCE_SOURCES = ["authored", "inferred", "ai_suggested"] as const;
export const AIC_VALIDATION_SEVERITIES = ["info", "warning", "error", "fatal"] as const;

export type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue;
}

export type AICRisk = (typeof AIC_RISKS)[number];
export type AICRiskFlag = (typeof AIC_RISK_FLAGS)[number];
export type AICActionName = (typeof AIC_ACTIONS)[number];
export type AICRole = (typeof AIC_ROLES)[number];
export type AICConfirmationType = (typeof AIC_CONFIRMATION_TYPES)[number];
export type AICProvenanceSource = (typeof AIC_PROVENANCE_SOURCES)[number];
export type AICValidationSeverity = (typeof AIC_VALIDATION_SEVERITIES)[number];

export interface AICCompatibility {
  deprecated_fields?: string[];
  minimum_agent_version?: string;
}

export interface AICDiscoveryCapabilities {
  runtimeUiTree?: boolean;
  semanticActions?: boolean;
  workflows?: boolean;
  permissions?: boolean;
  events?: boolean;
  actionContracts?: boolean;
  entityModel?: boolean;
  executionModel?: boolean;
  recoveryModel?: boolean;
}

export interface AICDiscoveryEndpoints {
  actions?: string;
  permissions?: string;
  ui?: string;
  workflows?: string;
}

export interface AICDiscoveryManifest {
  spec: string;
  app: {
    name: string;
    version?: string;
  };
  capabilities: AICDiscoveryCapabilities;
  endpoints: AICDiscoveryEndpoints;
  compatibility?: AICCompatibility;
  framework?: string;
  generated_at: string;
  manifest_version?: string;
  notes?: string[];
}

export interface AICPageMetadata {
  title?: string;
  url: string;
}

export interface AICViewMetadata {
  navigation_context?: string;
  route_pattern?: string;
  updated_at?: string;
  view_id: string;
}

export interface AICConfirmationProtocol {
  expires_in_seconds?: number;
  prompt_template?: string;
  requires_manual_phrase?: boolean;
  reusable_for_batch?: boolean;
  summary_fields?: string[];
  type: AICConfirmationType;
}

export interface AICCompletionSignal {
  type: "toast" | "toast_or_navigation" | "navigation" | "dialog" | "state_change" | "custom";
  value: string;
}

export interface AICValidationMetadata {
  cross_field_dependencies?: string[];
  enum?: JsonPrimitive[];
  examples?: JsonPrimitive[];
  format?: string;
  max_length?: number;
  maximum?: number;
  min_length?: number;
  minimum?: number;
  pattern?: string;
  required?: boolean;
  server_unique?: boolean;
}

export interface AICRecoveryMetadata {
  error_code?: string;
  human_escalation_required?: boolean;
  partial_state_changed?: boolean;
  recovery?: string;
  retry_after_ms?: number;
  retryable?: boolean;
}

export interface AICExecutionMetadata {
  async_job_id?: string;
  busy_when?: string[];
  estimated_latency_ms?: number;
  invalidation_triggers?: string[];
  poll_endpoint?: string;
  ready_when?: string[];
  retry_after_ms?: number;
  settled_when?: string[];
}

export interface AICEntityRef {
  backing_resource?: string;
  entity_id: string;
  entity_label?: string;
  entity_type: string;
  parent_entity_id?: string;
  row_key?: string;
}

export interface AICBatchMetadata {
  concurrency_limit?: number;
  max_items?: number;
  mode?: "all_or_nothing" | "partial_success";
  per_item_results?: boolean;
  supported: boolean;
}

export interface AICActionContract {
  batch?: AICBatchMetadata;
  completion_signal: AICCompletionSignal;
  dry_run_action?: string;
  estimated_latency_ms: number;
  failure_modes: string[];
  idempotent: boolean;
  name: string;
  postconditions: string[];
  preconditions: string[];
  preview_fields?: string[];
  side_effects: string[];
  simulation_limitations?: string[];
  supports_dry_run?: boolean;
  target: string;
  title: string;
  undo_action?: string;
  undo_window_seconds?: number;
  undoable: boolean;
}

export interface AICSemanticActionsManifest {
  actions: AICActionContract[];
  generated_at: string;
  manifest_version?: string;
  spec: string;
}

export interface AICElementAction {
  contract_ref?: string;
  name: AICActionName | string;
  target?: string;
  type?: "element_action" | "semantic_action";
}

export interface AICElementState {
  busy?: boolean;
  enabled?: boolean;
  expanded?: boolean;
  hidden?: boolean;
  row_count?: number;
  selected?: boolean;
  value?: JsonPrimitive;
  virtualized?: boolean;
  visible?: boolean;
}

export interface AICMetadataProvenance {
  ambiguity_notes?: string[];
  confidence_score?: number;
  requires_human_review_if_below?: number;
  source: AICProvenanceSource;
}

export interface AICElementManifest {
  actions: AICElementAction[];
  aliases?: string[];
  confirmation?: AICConfirmationProtocol;
  constraints?: string[];
  description?: string;
  effects?: string[];
  entity_ref?: AICEntityRef;
  examples?: string[];
  execution?: AICExecutionMetadata;
  id: string;
  label: string;
  notes?: string[];
  parent_id?: string;
  permissions?: string[];
  provenance?: Partial<Record<AICProvenanceSource, AICMetadataProvenance>>;
  recovery?: AICRecoveryMetadata;
  requires_confirmation?: boolean;
  risk: AICRisk;
  risk_flags?: AICRiskFlag[];
  role: AICRole;
  selectors?: {
    css?: string;
    testId?: string;
    text?: string;
  };
  state: AICElementState;
  validation?: AICValidationMetadata;
  workflow_ref?: string;
}

export interface AICRelationship {
  from: string;
  kind: "contains" | "controls" | "describes" | "relates_to";
  to: string;
}

export interface AICRuntimeUiManifest {
  elements: AICElementManifest[];
  manifest_version?: string;
  page: AICPageMetadata;
  relationships?: AICRelationship[];
  spec: string;
  updated_at: string;
  user_context?: JsonObject;
  view: AICViewMetadata;
}

export interface AICRiskBandPolicy {
  audit?: boolean;
  requiresConfirmation: boolean;
}

export interface AICActionPolicy {
  audit?: boolean;
  requiresConfirmation?: boolean;
  risk?: AICRisk;
  roleRequirements?: string[];
}

export interface AICPermissionsManifest {
  actionPolicies?: Record<string, AICActionPolicy>;
  forbiddenActions?: string[];
  generated_at: string;
  manifest_version?: string;
  mutationPolicy?: string;
  reauthRequiredFor?: string[];
  riskBands: Record<AICRisk, AICRiskBandPolicy>;
  spec: string;
}

export interface AICWorkflowStep {
  action?: string;
  id: string;
  requires_confirmation?: boolean;
  target?: string;
  type: "element_action" | "semantic_action";
}

export interface AICWorkflowDefinition {
  checkpoint_steps?: string[];
  completion_signal?: AICCompletionSignal;
  entry_points: string[];
  estimated_duration_ms?: number;
  fallback_steps?: string[];
  human_approval_steps?: string[];
  id: string;
  preconditions?: string[];
  retryable_steps?: string[];
  rollback_steps?: string[];
  steps: AICWorkflowStep[];
  title: string;
}

export interface AICWorkflowManifest {
  generated_at: string;
  manifest_version?: string;
  spec: string;
  workflows: AICWorkflowDefinition[];
}

export type AICManifestKind = "actions" | "discovery" | "permissions" | "ui" | "workflows";

export interface AICCollectionDiffEntry {
  fields: string[];
  key: string;
}

export interface AICDetailedCollectionDiffEntry {
  changes: AICFieldDiffEntry[];
  key: string;
}

export interface AICFieldDiffEntry {
  after: JsonValue | null;
  before: JsonValue | null;
  field: string;
}

export interface AICManifestDiff {
  added: string[];
  changed: AICCollectionDiffEntry[] | AICFieldDiffEntry[];
  kind: AICManifestKind;
  removed: string[];
  topLevelChanged?: string[];
}

export interface AICDetailedManifestDiff {
  added: string[];
  changed: AICDetailedCollectionDiffEntry[] | AICFieldDiffEntry[];
  kind: AICManifestKind;
  removed: string[];
  topLevelChanged?: AICFieldDiffEntry[];
}

export interface AICValidationIssue {
  message: string;
  path: string;
  rule?: string;
  severity: AICValidationSeverity;
}

export interface AICAuthoringReportDiagnostic {
  attribute?: string;
  code:
    | "cyclic_static_reference"
    | "missing_value"
    | "unresolved_identifier"
    | "unsupported_call_expression"
    | "unsupported_expression"
    | "unsupported_import_reference"
    | "unsupported_member_expression";
  column: number;
  file: string;
  line: number;
  message: string;
  severity: "warning" | "error";
}

export interface AICAuthoringReportMatch {
  action?: string;
  agentDescription?: string;
  agentId: string;
  column: number;
  file: string;
  line: number;
  risk?: string;
  source_key: string;
  tagName: string;
}

export interface AICAgentOnboardingFileStatus {
  kind: "canonical" | "copilot_instructions" | "cursor_rule" | "wrapper";
  path: string;
  recommended: boolean;
  status: "missing" | "present" | "stale";
  template_version?: string;
}

export interface AICAgentOnboardingWarning {
  code: "missing_agent_onboarding_file" | "stale_agent_onboarding_file";
  file: string;
  message: string;
  severity: "warning";
}

export interface AICAgentOnboardingSummary {
  missing: number;
  present: number;
  recommended: number;
  stale: number;
  warnings: number;
}

export interface AICAgentOnboardingReport {
  files: AICAgentOnboardingFileStatus[];
  summary: AICAgentOnboardingSummary;
  template_version: string;
  warnings: AICAgentOnboardingWarning[];
}

export interface AICInitFileResult {
  action: "create" | "overwrite" | "skip";
  kind: "canonical" | "copilot_instructions" | "cursor_rule" | "project_config" | "wrapper";
  path: string;
  status: "created" | "overwritten" | "planned" | "skipped";
  template_version?: string;
}

export interface AICInitSummary {
  created: number;
  overwritten: number;
  planned: number;
  skipped: number;
  total: number;
}

export interface AICInitResult {
  app_name: string;
  artifact_type: "aic_init_result";
  config_file: string;
  dry_run: boolean;
  files: AICInitFileResult[];
  framework: "nextjs" | "react" | "vite";
  next_steps: string[];
  project_root: string;
  summary: AICInitSummary;
}

export interface AICDoctorFinding {
  code:
    | "extraction_diagnostics_present"
    | "invalid_generated_manifest"
    | "invalid_project_config"
    | "missing_agent_onboarding_file"
    | "missing_project_config"
    | "no_aic_annotations_found"
    | "no_permission_policies_configured"
    | "no_workflows_configured"
    | "stale_agent_onboarding_file"
    | "unreadable_project_root"
    | "unsupported_framework";
  file?: string;
  fix_hint?: string;
  manifest_kind?: AICManifestKind;
  message: string;
  related_count?: number;
  severity: "warning" | "error";
}

export interface AICDoctorScanSummary {
  diagnostics: number;
  files_scanned: number;
  matches: number;
  source_inventory: number;
}

export interface AICDoctorSummary {
  errors: number;
  findings: number;
  warnings: number;
}

export interface AICDoctorReport {
  artifact_type: "aic_doctor_report";
  config_file?: string;
  detected_framework?: "nextjs" | "react" | "vite";
  findings: AICDoctorFinding[];
  framework?: "nextjs" | "react" | "vite";
  onboarding: AICAgentOnboardingReport;
  project_root: string;
  scan: AICDoctorScanSummary;
  summary: AICDoctorSummary;
}

export interface AICAuthoringProjectReport {
  agent_onboarding?: AICAgentOnboardingReport;
  diagnostics: AICAuthoringReportDiagnostic[];
  filesScanned: number;
  framework: string;
  matches: AICAuthoringReportMatch[];
  source_inventory?: AICAuthoringSourceInventoryEntry[];
}

export interface AICAuthoringSourceInventoryEntry {
  annotated_agent_id?: string;
  column: number;
  file: string;
  has_spread_attributes?: boolean;
  label: string;
  line: number;
  opening_tag_signature?: string;
  duplicate_aic_props?: string[];
  role: AICRole;
  route_pattern?: string;
  selectors?: {
    testId?: string;
    text?: string;
  };
  source_key: string;
  tagName: string;
  unsupported_aic_props?: string[];
}

export interface AICDomDiscoveryCandidate {
  annotated_agent_id?: string;
  key: string;
  label: string;
  page_url: string;
  role: AICRole;
  route_pattern?: string;
  selectors?: {
    testId?: string;
    text?: string;
  };
  tag_name?: string;
}

export interface AICAuthoringBootstrapSuggestionInput {
  action: AICActionName | string;
  confidence_score: number;
  label: string;
  patch_summary?: string;
  review_required: boolean;
  risk: AICRisk;
  role: AICRole;
  route: string;
  status?: "accepted" | "filtered_out";
  target: string;
}

export interface AICAuthoringBootstrapReviewInput {
  artifact_type?: string;
  draft?: {
    suggestions?: AICAuthoringBootstrapSuggestionInput[];
  };
  provider_name?: string;
  suggestions?: Array<{
    status: "accepted" | "filtered_out";
    suggestion?: AICAuthoringBootstrapSuggestionInput;
  }>;
}

export interface AICAuthoringSourceCandidate {
  action?: string;
  agentDescription?: string;
  agentId?: string;
  column: number;
  file: string;
  has_spread_attributes?: boolean;
  line: number;
  match_kind: "agent_id_exact" | "label_action" | "source_inventory_exact";
  opening_tag_signature?: string;
  duplicate_aic_props?: string[];
  risk?: string;
  source_key: string;
  tagName: string;
  unsupported_aic_props?: string[];
}

export interface AICAuthoringIssue {
  code:
    | "ambiguous_bootstrap_match"
    | "ambiguous_source_match"
    | "duplicate_aic_prop"
    | "duplicate_dom_candidate"
    | "duplicate_proposed_id"
    | "duplicate_runtime_match"
    | "dynamic_aic_prop"
    | "missing_source_match"
    | "review_only_object_metadata"
    | "spread_attributes_present";
  message: string;
  proposal_key?: string;
  severity: "info" | "warning";
}

export interface AICAuthoringProposal {
  apply_block_reason?:
    | "ambiguous_exact_source_match"
    | "duplicate_aic_props"
    | "dynamic_existing_aic_prop"
    | "ignored"
    | "missing_exact_source_match"
    | "not_ready"
    | "review_only_source_match"
    | "spread_attributes_present";
  apply_status: "blocked" | "eligible";
  apply_target?: {
    column: number;
    file: string;
    line: number;
    match_kind: "agent_id_exact" | "source_inventory_exact";
    opening_tag_signature?: string;
    source_key: string;
  };
  bootstrap_backed: boolean;
  evidence: {
    bootstrap_suggestion?: AICAuthoringBootstrapSuggestionInput;
    dom_candidate?: AICDomDiscoveryCandidate;
    snapshot_element?: AICElementManifest;
  };
  issues: AICAuthoringIssue[];
  key: string;
  kind: "new_annotation" | "refine_existing";
  recommended_props: {
    agentAction: string;
    agentDescription: string;
    agentId: string;
    agentRisk: AICRisk;
  };
  recommended_optional_props?: {
    agentEntityId?: string;
    agentEntityLabel?: string;
    agentEntityType?: string;
    agentRequiresConfirmation?: boolean;
    agentRole?: AICRole;
    agentWorkflowStep?: string;
  };
  snippet_preview: string;
  source_candidates: AICAuthoringSourceCandidate[];
  status: "ignored" | "needs_id_review" | "needs_source_match" | "ready";
}

export interface AICAuthoringPatchPlanSummary {
  apply_ready: number;
  blocked_by_jsx_pattern: number;
  bootstrap_backed_proposals: number;
  ignored: number;
  needs_id_review: number;
  needs_source_match: number;
  ready: number;
  review_only_metadata: number;
  source_resolved_proposals: number;
  total_proposals: number;
}

export interface AICAuthoringInputs {
  bootstrap_review?: AICAuthoringBootstrapReviewInput;
  dom_candidates?: AICDomDiscoveryCandidate[];
  project_report?: AICAuthoringProjectReport;
  snapshot?: AICRuntimeUiManifest;
}

export interface AICAuthoringPatchPlan {
  artifact_type: "aic_authoring_patch_plan";
  generated_at: string;
  inputs: AICAuthoringInputs;
  issues: AICAuthoringIssue[];
  proposals: AICAuthoringProposal[];
  summary: AICAuthoringPatchPlanSummary;
}

export interface AICAuthoringApplyOutcome {
  changed_fields: string[];
  file?: string;
  message: string;
  proposal_key: string;
  source_key?: string;
  status: "applied" | "failed" | "skipped";
}

export interface AICAuthoringApplyResultSummary {
  applied: number;
  changed_files: number;
  failed: number;
  skipped: number;
  total: number;
}

export interface AICAuthoringApplyResult {
  artifact_type: "aic_authoring_apply_result";
  dry_run: boolean;
  generated_at: string;
  outcomes: AICAuthoringApplyOutcome[];
  plan_generated_at?: string;
  project_root: string;
  summary: AICAuthoringApplyResultSummary;
}

export type ValidationResult<T> =
  | {
      issues: AICValidationIssue[];
      ok: true;
      value: T;
    }
  | {
      issues: AICValidationIssue[];
      ok: false;
    };

export type AgentRisk = AICRisk;
export type AgentAction = AICActionName;
export type AgentNodeState = AICElementState;
export type AgentNodeManifest = AICElementManifest;
export type DiscoveryManifest = AICDiscoveryManifest;
export type AgentUiManifest = AICRuntimeUiManifest;
export type AgentPermissionsManifest = AICPermissionsManifest;
export type AgentWorkflowDefinition = AICWorkflowDefinition;
export type AgentWorkflowsManifest = AICWorkflowManifest;
export type ValidationIssue = AICValidationIssue;

export const AGENT_RISKS = AIC_RISKS;
export const AGENT_ACTIONS = AIC_ACTIONS;
