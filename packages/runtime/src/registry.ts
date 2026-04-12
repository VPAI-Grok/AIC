import {
  MANIFEST_VERSION,
  SPEC_VERSION,
  createEmptyPermissionsManifest,
  type AICDiscoveryCapabilities,
  type AICDiscoveryManifest,
  type AICElementAction,
  type AICElementManifest,
  type AICMetadataProvenance,
  type AICPermissionsManifest,
  type AICProvenanceSource,
  type AICRuntimeUiManifest,
  type AICWorkflowManifest,
  type JsonObject
} from "@aicorg/spec";

export interface AICRegistration {
  element: AICElementManifest;
  instanceId: string;
  source?: AICProvenanceSource;
}

export interface AICSerializedView {
  navigation_context?: string;
  pageTitle?: string;
  relationships?: AICRuntimeUiManifest["relationships"];
  route_pattern?: string;
  updated_at?: string;
  url: string;
  user_context?: JsonObject;
  view_id: string;
}

export interface AICDiscoveryOptions {
  appName: string;
  appVersion?: string;
  capabilities?: AICDiscoveryCapabilities;
  endpoints?: AICDiscoveryManifest["endpoints"];
  framework?: string;
  generated_at?: string;
  notes?: string[];
}

export interface AICOperateTextOptions {
  appName: string;
  endpoints?: AICDiscoveryManifest["endpoints"];
  notes?: string[];
}

export interface AICRuntimeEvent {
  element?: AICElementManifest;
  elementId?: string;
  payload?: JsonObject;
  source?: AICProvenanceSource;
  type:
    | "element_registered"
    | "element_updated"
    | "element_removed"
    | "action_started"
    | "action_completed"
    | "action_failed";
}

interface RegistryEntry {
  instanceId: string;
  merged: AICElementManifest;
  sources: Partial<Record<AICProvenanceSource, AICElementManifest>>;
}

type Listener = (event: AICRuntimeEvent) => void;

function uniqueStrings(values: Array<string[] | undefined>): string[] | undefined {
  const result = Array.from(new Set(values.flatMap((value) => value ?? [])));
  return result.length > 0 ? result : undefined;
}

function mergeActions(values: AICElementAction[][]): AICElementAction[] {
  const seen = new Set<string>();
  const merged: AICElementAction[] = [];

  values.flat().forEach((action) => {
    const key = `${action.type ?? "element_action"}:${action.name}:${action.target ?? ""}:${action.contract_ref ?? ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(action);
    }
  });

  return merged;
}

function mergeObjects<T extends object>(values: Array<T | undefined>): T | undefined {
  const merged = values.reduce<Record<string, unknown>>((accumulator, value) => {
    if (!value) {
      return accumulator;
    }

    Object.assign(accumulator, value);
    return accumulator;
  }, {});

  return Object.keys(merged).length > 0 ? (merged as T) : undefined;
}

function mergeProvenance(
  sources: Partial<Record<AICProvenanceSource, AICElementManifest>>
): Partial<Record<AICProvenanceSource, AICMetadataProvenance>> | undefined {
  const merged = Object.entries(sources).reduce<
    Partial<Record<AICProvenanceSource, AICMetadataProvenance>>
  >((accumulator, [source, element]) => {
    if (element?.provenance?.[source as AICProvenanceSource]) {
      accumulator[source as AICProvenanceSource] =
        element.provenance[source as AICProvenanceSource];
      return accumulator;
    }

    accumulator[source as AICProvenanceSource] = {
      source: source as AICProvenanceSource
    };
    return accumulator;
  }, {});

  return Object.keys(merged).length > 0 ? merged : undefined;
}

function mergeElementSources(
  sources: Partial<Record<AICProvenanceSource, AICElementManifest>>
): AICElementManifest {
  const order: AICProvenanceSource[] = ["ai_suggested", "inferred", "authored"];
  const elements = order.map((source) => sources[source]).filter(Boolean) as AICElementManifest[];
  const base = elements[0];

  if (!base) {
    throw new Error("Cannot merge element sources without at least one element");
  }

  const merged = elements.reduce<AICElementManifest>((current, next) => {
    return {
      ...current,
      ...next,
      actions: mergeActions([current.actions, next.actions]),
      aliases: uniqueStrings([current.aliases, next.aliases]),
      constraints: uniqueStrings([current.constraints, next.constraints]),
      effects: uniqueStrings([current.effects, next.effects]),
      examples: uniqueStrings([current.examples, next.examples]),
      execution: mergeObjects([current.execution, next.execution]),
      notes: uniqueStrings([current.notes, next.notes]),
      permissions: uniqueStrings([current.permissions, next.permissions]),
      provenance: mergeProvenance(sources),
      recovery: mergeObjects([current.recovery, next.recovery]),
      risk_flags: uniqueStrings([
        current.risk_flags as string[] | undefined,
        next.risk_flags as string[] | undefined
      ]) as AICElementManifest["risk_flags"],
      selectors: mergeObjects([current.selectors, next.selectors]),
      state: {
        ...current.state,
        ...next.state
      },
      validation: mergeObjects([current.validation, next.validation])
    };
  }, base);

  merged.provenance = mergeProvenance(sources);
  return merged;
}

export class AICRegistry {
  private readonly entries = new Map<string, RegistryEntry>();
  private readonly listeners = new Set<Listener>();

  register(registration: AICRegistration): () => void {
    const source = registration.source ?? "authored";
    const existing = this.entries.get(registration.element.id);

    if (existing && existing.instanceId !== registration.instanceId) {
      throw new Error(`Duplicate agent ID detected: ${registration.element.id}`);
    }

    const sources = {
      ...(existing?.sources ?? {}),
      [source]: registration.element
    };
    const merged = mergeElementSources(sources);
    const eventType = existing ? "element_updated" : "element_registered";

    this.entries.set(registration.element.id, {
      instanceId: registration.instanceId,
      merged,
      sources
    });
    this.emit({
      type: eventType,
      element: merged,
      elementId: merged.id,
      source
    });

    return () => {
      this.unregister(registration.element.id, registration.instanceId);
    };
  }

  update(registration: AICRegistration): void {
    this.register(registration);
  }

  unregister(id: string, instanceId?: string): void {
    const existing = this.entries.get(id);

    if (!existing) {
      return;
    }

    if (instanceId && existing.instanceId !== instanceId) {
      return;
    }

    this.entries.delete(id);
    this.emit({
      type: "element_removed",
      element: existing.merged,
      elementId: existing.merged.id
    });
  }

  emitActionEvent(
    type: "action_started" | "action_completed" | "action_failed",
    elementId: string,
    payload?: JsonObject
  ): void {
    this.emit({
      type,
      element: this.entries.get(elementId)?.merged,
      elementId,
      payload
    });
  }

  get(id: string): AICElementManifest | undefined {
    return this.entries.get(id)?.merged;
  }

  snapshot(): AICElementManifest[] {
    return Array.from(this.entries.values()).map((entry) => entry.merged);
  }

  serializeRuntimeUi(view: AICSerializedView): AICRuntimeUiManifest {
    return {
      spec: SPEC_VERSION,
      manifest_version: MANIFEST_VERSION,
      updated_at: view.updated_at ?? new Date().toISOString(),
      page: {
        title: view.pageTitle,
        url: view.url
      },
      view: {
        navigation_context: view.navigation_context,
        route_pattern: view.route_pattern,
        updated_at: view.updated_at ?? new Date().toISOString(),
        view_id: view.view_id
      },
      user_context: view.user_context,
      relationships: view.relationships,
      elements: this.snapshot()
    };
  }

  createDiscoveryManifest(options: AICDiscoveryOptions): AICDiscoveryManifest {
    return {
      spec: SPEC_VERSION,
      manifest_version: MANIFEST_VERSION,
      generated_at: options.generated_at ?? new Date().toISOString(),
      framework: options.framework,
      notes: options.notes,
      app: {
        name: options.appName,
        version: options.appVersion
      },
      capabilities: {
        runtimeUiTree: true,
        semanticActions: true,
        workflows: true,
        permissions: true,
        events: true,
        actionContracts: true,
        entityModel: true,
        executionModel: true,
        recoveryModel: true,
        ...options.capabilities
      },
      endpoints: {
        ui: "/.well-known/agent/ui",
        actions: "/.well-known/agent/actions",
        permissions: "/agent-permissions.json",
        workflows: "/agent-workflows.json",
        ...options.endpoints
      }
    };
  }

  createPermissionsManifest(overrides: Partial<AICPermissionsManifest> = {}): AICPermissionsManifest {
    return {
      ...createEmptyPermissionsManifest(),
      ...overrides,
      riskBands: {
        ...createEmptyPermissionsManifest().riskBands,
        ...(overrides.riskBands ?? {})
      }
    };
  }

  renderOperateText(options: AICOperateTextOptions): string {
    const lines = [
      `AIC is enabled for ${options.appName}.`,
      "Source of truth manifests:",
      `- UI: ${options.endpoints?.ui ?? "/.well-known/agent/ui"}`,
      `- Actions: ${options.endpoints?.actions ?? "/.well-known/agent/actions"}`,
      `- Permissions: ${options.endpoints?.permissions ?? "/agent-permissions.json"}`,
      `- Workflows: ${options.endpoints?.workflows ?? "/agent-workflows.json"}`
    ];

    if (options.notes && options.notes.length > 0) {
      lines.push("", "Notes:");
      options.notes.forEach((note) => {
        lines.push(`- ${note}`);
      });
    }

    return lines.join("\n");
  }

  serializeWorkflows(workflows: AICWorkflowManifest["workflows"]): AICWorkflowManifest {
    return {
      spec: SPEC_VERSION,
      manifest_version: MANIFEST_VERSION,
      generated_at: new Date().toISOString(),
      workflows
    };
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  clear(): void {
    this.entries.clear();
  }

  private emit(event: AICRuntimeEvent): void {
    this.listeners.forEach((listener) => listener(event));
  }
}

export type AgentRegistration = AICRegistration;
export type ManifestSnapshotOptions = AICSerializedView;
export type AgentRegistry = AICRegistry;
