import type {
  AICDetailedCollectionDiffEntry,
  AICDetailedManifestDiff,
  AICDiscoveryManifest,
  AICFieldDiffEntry,
  AICManifestDiff,
  AICManifestKind,
  AICPermissionsManifest,
  AICRuntimeUiManifest,
  AICSemanticActionsManifest,
  AICWorkflowManifest,
  JsonValue
} from "./types.js";

function sortJsonValue(value: JsonValue | undefined): JsonValue | undefined {
  if (Array.isArray(value)) {
    return value.map((item) => sortJsonValue(item as JsonValue)) as JsonValue;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [
          key,
          sortJsonValue((value as Record<string, JsonValue | undefined>)[key])
        ])
    ) as JsonValue;
  }

  return value;
}

function stableEquals(before: unknown, after: unknown): boolean {
  return JSON.stringify(sortJsonValue(before as JsonValue)) === JSON.stringify(sortJsonValue(after as JsonValue));
}

function diffFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  ignoredFields: Set<string> = new Set()
): string[] {
  return Array.from(new Set([...Object.keys(before), ...Object.keys(after)]))
    .filter((field) => !ignoredFields.has(field))
    .filter((field) => !stableEquals(before[field], after[field]))
    .sort();
}

function diffFieldEntries(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  ignoredFields: Set<string> = new Set()
): AICFieldDiffEntry[] {
  return diffFields(before, after, ignoredFields).map((field) => ({
    after: sortJsonValue(after[field] as JsonValue | undefined) ?? null,
    before: sortJsonValue(before[field] as JsonValue | undefined) ?? null,
    field
  }));
}

function diffCollectionDetailed<T>(
  beforeItems: T[],
  afterItems: T[],
  keyOf: (item: T) => string
): Pick<AICDetailedManifestDiff, "added" | "changed" | "removed"> {
  const beforeMap = new Map(beforeItems.map((item) => [keyOf(item), item]));
  const afterMap = new Map(afterItems.map((item) => [keyOf(item), item]));
  const added = Array.from(afterMap.keys()).filter((key) => !beforeMap.has(key)).sort();
  const removed = Array.from(beforeMap.keys()).filter((key) => !afterMap.has(key)).sort();
  const changed = Array.from(beforeMap.keys())
    .filter((key) => afterMap.has(key))
    .flatMap((key) => {
      const before = beforeMap.get(key) as Record<string, unknown>;
      const after = afterMap.get(key) as Record<string, unknown>;
      const changes = diffFieldEntries(before, after);
      return changes.length > 0 ? [{ changes, key }] : [];
    });

  return {
    added,
    changed,
    removed
  };
}

function diffSingletonDetailed(
  kind: AICManifestKind,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  ignoredFields: Set<string>
): AICDetailedManifestDiff {
  return {
    added: [],
    changed: diffFieldEntries(before, after, ignoredFields),
    kind,
    removed: []
  };
}

export function diffAICManifestDetailed(
  kind: AICManifestKind,
  before: unknown,
  after: unknown
): AICDetailedManifestDiff {
  switch (kind) {
    case "ui": {
      const beforeManifest = before as AICRuntimeUiManifest;
      const afterManifest = after as AICRuntimeUiManifest;
      const collection = diffCollectionDetailed(beforeManifest.elements, afterManifest.elements, (element) => element.id);

      return {
        ...collection,
        kind,
        topLevelChanged: diffFieldEntries(
          beforeManifest as unknown as Record<string, unknown>,
          afterManifest as unknown as Record<string, unknown>,
          new Set(["elements", "updated_at", "manifest_version"])
        )
      };
    }
    case "actions": {
      const beforeManifest = before as AICSemanticActionsManifest;
      const afterManifest = after as AICSemanticActionsManifest;
      const collection = diffCollectionDetailed(
        beforeManifest.actions,
        afterManifest.actions,
        (action) => `${action.target}:${action.name}`
      );

      return {
        ...collection,
        kind,
        topLevelChanged: diffFieldEntries(
          beforeManifest as unknown as Record<string, unknown>,
          afterManifest as unknown as Record<string, unknown>,
          new Set(["actions", "generated_at", "manifest_version"])
        )
      };
    }
    case "workflows": {
      const beforeManifest = before as AICWorkflowManifest;
      const afterManifest = after as AICWorkflowManifest;
      const collection = diffCollectionDetailed(
        beforeManifest.workflows,
        afterManifest.workflows,
        (workflow) => workflow.id
      );

      return {
        ...collection,
        kind,
        topLevelChanged: diffFieldEntries(
          beforeManifest as unknown as Record<string, unknown>,
          afterManifest as unknown as Record<string, unknown>,
          new Set(["workflows", "generated_at", "manifest_version"])
        )
      };
    }
    case "discovery":
      return diffSingletonDetailed(
        kind,
        before as Record<string, unknown>,
        after as Record<string, unknown>,
        new Set(["generated_at", "manifest_version"])
      );
    case "permissions":
      return diffSingletonDetailed(
        kind,
        before as Record<string, unknown>,
        after as Record<string, unknown>,
        new Set(["generated_at", "manifest_version"])
      );
  }
}

export function diffAICManifestSummary(
  kind: AICManifestKind,
  before: unknown,
  after: unknown
): AICManifestDiff {
  const detailed = diffAICManifestDetailed(kind, before, after);
  const changed =
    detailed.changed.length > 0 && "key" in detailed.changed[0]
      ? (detailed.changed as AICDetailedCollectionDiffEntry[]).map((entry) => ({
          fields: entry.changes.map((change) => change.field),
          key: entry.key
        }))
      : (detailed.changed as AICFieldDiffEntry[]);

  return {
    added: detailed.added,
    changed,
    kind: detailed.kind,
    removed: detailed.removed,
    topLevelChanged: detailed.topLevelChanged?.map((entry) => entry.field)
  };
}

export const diffManifestValues = diffAICManifestSummary;
export const diffManifestValuesDetailed = diffAICManifestDetailed;
