import { existsSync, readFileSync } from "node:fs";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, extname, relative, resolve } from "node:path";
import ts from "typescript";
import { AICRegistry } from "@aic/runtime";
import {
  type AICAgentOnboardingFileStatus,
  type AICAgentOnboardingReport,
  type AICAgentOnboardingWarning,
  type AICAuthoringApplyResult,
  type AICAuthoringPatchPlan,
  type AICAuthoringProjectReport,
  type AICAuthoringSourceInventoryEntry,
  diffAICManifestDetailed,
  diffAICManifestSummary,
  type AICCollectionDiffEntry,
  type AICDetailedCollectionDiffEntry,
  type AICDetailedManifestDiff,
  AICActionContract,
  AICDiscoveryManifest,
  AICElementManifest,
  type AICFieldDiffEntry,
  type AICManifestDiff,
  type AICManifestKind,
  AICPermissionsManifest,
  type AICRole,
  AICRuntimeUiManifest,
  AICSemanticActionsManifest,
  AICWorkflowManifest
} from "@aic/spec";

export type AICAutomationSeverity = "warning" | "error";
export type AICAutomationManifestKind = AICManifestKind;

export interface AICExtractionDiagnostic {
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
  severity: AICAutomationSeverity;
}

export interface AICSourceScanMatch {
  action?: string;
  agentDescription?: string;
  agentId: string;
  column: number;
  file: string;
  line: number;
  role: AICRole;
  risk?: string;
  source_key: string;
  tagName: string;
}

export interface AICFileScanResult {
  diagnostics: AICExtractionDiagnostic[];
  file: string;
  matches: AICSourceScanMatch[];
  source_inventory: AICAuthoringSourceInventoryEntry[];
}

export interface AICProjectScanResult {
  diagnostics: AICExtractionDiagnostic[];
  files: string[];
  matches: AICSourceScanMatch[];
  source_inventory: AICAuthoringSourceInventoryEntry[];
}

export interface AICProjectArtifactsOptions {
  appName: string;
  appVersion?: string;
  framework: string;
  generatedAt?: string;
  notes?: string[];
  operateNotes?: string[];
  permissions?: Partial<AICPermissionsManifest>;
  projectRoot?: string;
  updatedAt?: string;
  viewId?: string;
  viewUrl?: string;
  workflows?: AICWorkflowManifest["workflows"];
}

export interface AICProjectArtifacts {
  actions: AICSemanticActionsManifest;
  diagnostics: AICExtractionDiagnostic[];
  discovery: AICDiscoveryManifest;
  files: Record<string, string>;
  matches: AICSourceScanMatch[];
  operate: string;
  permissions: AICPermissionsManifest;
  scan: {
    filesScanned: number;
  };
  source_inventory: AICAuthoringSourceInventoryEntry[];
  ui: AICRuntimeUiManifest;
  workflows: AICWorkflowManifest;
}

export type {
  AICCollectionDiffEntry,
  AICDetailedCollectionDiffEntry,
  AICDetailedManifestDiff,
  AICFieldDiffEntry,
  AICManifestDiff
};

export type AICProjectArtifactReport = AICAuthoringProjectReport;

export const AIC_AGENT_ONBOARDING_TEMPLATE_VERSION = "1";

const aicAgentOnboardingFiles: Array<{
  kind: AICAgentOnboardingFileStatus["kind"];
  path: string;
  recommended: boolean;
}> = [
  { kind: "canonical", path: "AGENTS.md", recommended: true },
  { kind: "wrapper", path: "CLAUDE.md", recommended: true },
  { kind: "wrapper", path: "GEMINI.md", recommended: true },
  {
    kind: "copilot_instructions",
    path: ".github/copilot-instructions.md",
    recommended: true
  },
  { kind: "cursor_rule", path: ".cursor/rules/aic.mdc", recommended: true },
  {
    kind: "wrapper",
    path: ".github/skills/aic-onboarding/SKILL.md",
    recommended: false
  }
];

function getAICAgentOnboardingReport(projectRoot: string): AICAgentOnboardingReport {
  const files: AICAgentOnboardingFileStatus[] = [];
  const warnings: AICAgentOnboardingWarning[] = [];
  const versionPattern = /AIC_AGENT_ONBOARDING_TEMPLATE_VERSION:\s*([^\s>]+)/;

  for (const expectedFile of aicAgentOnboardingFiles) {
    const resolvedPath = resolve(projectRoot, expectedFile.path);
    let status: AICAgentOnboardingFileStatus["status"] = "missing";
    let templateVersion: string | undefined;

    if (existsSync(resolvedPath)) {
      status = "present";

      try {
        const contents = readFileSync(resolvedPath, "utf8");
        const versionMatch = contents.match(versionPattern);

        if (versionMatch) {
          templateVersion = versionMatch[1];

          if (templateVersion !== AIC_AGENT_ONBOARDING_TEMPLATE_VERSION) {
            status = "stale";
          }
        }
      } catch {
        status = "stale";
      }
    }

    files.push({
      kind: expectedFile.kind,
      path: expectedFile.path,
      recommended: expectedFile.recommended,
      status,
      template_version: templateVersion
    });

    if (!expectedFile.recommended) {
      continue;
    }

    if (status === "missing") {
      warnings.push({
        code: "missing_agent_onboarding_file",
        file: expectedFile.path,
        message: `Recommended AIC agent onboarding file is missing: ${expectedFile.path}`,
        severity: "warning"
      });
    }

    if (status === "stale") {
      warnings.push({
        code: "stale_agent_onboarding_file",
        file: expectedFile.path,
        message: `AIC onboarding template marker in ${expectedFile.path} is stale. Expected version ${AIC_AGENT_ONBOARDING_TEMPLATE_VERSION}.`,
        severity: "warning"
      });
    }
  }

  return {
    files,
    summary: {
      missing: files.filter((file) => file.recommended && file.status === "missing").length,
      present: files.filter((file) => file.recommended && file.status === "present").length,
      recommended: files.filter((file) => file.recommended).length,
      stale: files.filter((file) => file.recommended && file.status === "stale").length,
      warnings: warnings.length
    },
    template_version: AIC_AGENT_ONBOARDING_TEMPLATE_VERSION,
    warnings
  };
}

interface ParsedJsxElementRecord {
  action?: string;
  agentDescription?: string;
  agentId?: string;
  attributes: Map<string, ts.JsxAttribute>;
  column: number;
  diagnostics: AICExtractionDiagnostic[];
  duplicateAicProps: string[];
  file: string;
  hasSpreadAttributes: boolean;
  label?: string;
  line: number;
  node: ts.JsxOpeningElement | ts.JsxSelfClosingElement;
  opening_tag_signature: string;
  risk?: string;
  role: AICRole;
  selectors: {
    testId?: string;
    text?: string;
  };
  sourceFile: ts.SourceFile;
  source_key: string;
  tagName: string;
  unsupportedAicProps: string[];
}

interface ParsedSourceAnalysis {
  diagnostics: AICExtractionDiagnostic[];
  matches: AICSourceScanMatch[];
  source_inventory: AICAuthoringSourceInventoryEntry[];
}

interface ApplyParsedFile {
  staticResolver: StaticValueResolverContext;
  records: ParsedJsxElementRecord[];
  source: string;
  sourceFile: ts.SourceFile;
}

type StaticValue =
  | {
      kind: "object";
      properties: Map<string, StaticValue>;
    }
  | {
      kind: "string";
      value: string;
    };

type StaticNamedDeclaration =
  | {
      expression: ts.Expression;
      kind: "value";
    }
  | {
      kind: "helper";
      node: ts.ArrowFunction | ts.FunctionDeclaration | ts.FunctionExpression;
    };

interface StaticValueResolverContext {
  declarations: Map<string, StaticNamedDeclaration>;
  importedNames: Set<string>;
  maxDepth: number;
  sourceFile: ts.SourceFile;
}

interface StaticResolutionError {
  code: AICExtractionDiagnostic["code"];
  message: string;
  node: ts.Node;
}

type StaticResolutionResult =
  | {
      ok: true;
      value: StaticValue;
    }
  | {
      error: StaticResolutionError;
      ok: false;
    };

type StaticStringResolutionResult =
  | {
      ok: true;
      value: string;
    }
  | {
      error: StaticResolutionError;
      ok: false;
    };

const IGNORED_DIRECTORIES = new Set([".git", ".next", "dist", "node_modules"]);
const SOURCE_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx"]);
const MUTABLE_STRING_AIC_PROP_NAMES = [
  "agentAction",
  "agentDescription",
  "agentEntityId",
  "agentEntityLabel",
  "agentEntityType",
  "agentId",
  "agentRisk",
  "agentRole",
  "agentWorkflowStep"
] as const;
const MUTABLE_BOOLEAN_AIC_PROP_NAMES = ["agentRequiresConfirmation"] as const;
const MUTABLE_AIC_PROP_NAMES = new Set<string>([
  ...MUTABLE_STRING_AIC_PROP_NAMES,
  ...MUTABLE_BOOLEAN_AIC_PROP_NAMES
]);

type MutableStringAicPropName = (typeof MUTABLE_STRING_AIC_PROP_NAMES)[number];
type MutableBooleanAicPropName = (typeof MUTABLE_BOOLEAN_AIC_PROP_NAMES)[number];
type MutableAicPropName = MutableBooleanAicPropName | MutableStringAicPropName;
type DesiredMutableAicProps = Partial<Record<MutableAicPropName, string | boolean>>;

function isConstVariableDeclaration(node: ts.VariableDeclaration): boolean {
  return ts.isVariableDeclarationList(node.parent) && (node.parent.flags & ts.NodeFlags.Const) !== 0;
}

function getLineColumn(sourceFile: ts.SourceFile, node: ts.Node): { column: number; line: number } {
  const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return {
    column: position.character + 1,
    line: position.line + 1
  };
}

function createDiagnostic(
  sourceFile: ts.SourceFile,
  file: string,
  node: ts.Node,
  severity: AICAutomationSeverity,
  code: AICExtractionDiagnostic["code"],
  message: string,
  attribute?: string
): AICExtractionDiagnostic {
  const location = getLineColumn(sourceFile, node);
  return {
    attribute,
    code,
    column: location.column,
    file,
    line: location.line,
    message,
    severity
  };
}

function readLiteralString(node: ts.Expression | undefined): string | undefined {
  if (!node) {
    return undefined;
  }

  if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }

  return undefined;
}

function unwrapStaticExpression(expression: ts.Expression): ts.Expression {
  let current = expression;

  while (
    ts.isAsExpression(current) ||
    ts.isParenthesizedExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isNonNullExpression(current)
  ) {
    current = current.expression;
  }

  return current;
}

function createStaticResolutionError(
  code: AICExtractionDiagnostic["code"],
  node: ts.Node,
  message: string
): StaticResolutionResult {
  return {
    error: {
      code,
      message,
      node
    },
    ok: false
  };
}

function createStaticValueResolver(sourceFile: ts.SourceFile): StaticValueResolverContext {
  const declarations = new Map<string, StaticNamedDeclaration>();
  const importedNames = new Set<string>();
  const duplicates = new Set<string>();

  const unregister = (name: string) => {
    declarations.delete(name);
    importedNames.delete(name);
  };

  const registerDeclaration = (name: string, declaration: StaticNamedDeclaration) => {
    if (duplicates.has(name)) {
      return;
    }

    if (declarations.has(name) || importedNames.has(name)) {
      duplicates.add(name);
      unregister(name);
      return;
    }

    declarations.set(name, declaration);
  };

  const registerImport = (name: string) => {
    if (duplicates.has(name)) {
      return;
    }

    if (declarations.has(name) || importedNames.has(name)) {
      duplicates.add(name);
      unregister(name);
      return;
    }

    importedNames.add(name);
  };

  const visit = (node: ts.Node) => {
    if (ts.isImportClause(node) && node.name) {
      registerImport(node.name.text);
    }

    if (ts.isImportEqualsDeclaration(node)) {
      registerImport(node.name.text);
    }

    if (ts.isNamespaceImport(node) || ts.isImportSpecifier(node)) {
      registerImport(node.name.text);
    }

    if (ts.isFunctionDeclaration(node) && node.name) {
      registerDeclaration(node.name.text, {
        kind: "helper",
        node
      });
    }

    if (ts.isVariableDeclaration(node) && isConstVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      const identifier = node.name.text;
      const initializer = node.initializer ? unwrapStaticExpression(node.initializer) : undefined;

      if (!initializer) {
        ts.forEachChild(node, visit);
        return;
      }

      if (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)) {
        registerDeclaration(identifier, {
          kind: "helper",
          node: initializer
        });
      } else {
        registerDeclaration(identifier, {
          expression: initializer,
          kind: "value"
        });
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return {
    declarations,
    importedNames,
    maxDepth: 12,
    sourceFile
  };
}

function getObjectPropertyKey(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNoSubstitutionTemplateLiteral(name)) {
    return name.text;
  }

  return undefined;
}

function getHelperReturnExpression(
  helper: ts.ArrowFunction | ts.FunctionDeclaration | ts.FunctionExpression
): ts.Expression | undefined {
  if (helper.parameters.length !== 0) {
    return undefined;
  }

  if (ts.isArrowFunction(helper) && !ts.isBlock(helper.body)) {
    return unwrapStaticExpression(helper.body);
  }

  const body = helper.body;
  if (!body || !ts.isBlock(body) || body.statements.length !== 1) {
    return undefined;
  }

  const [statement] = body.statements;
  if (!ts.isReturnStatement(statement) || !statement.expression) {
    return undefined;
  }

  return unwrapStaticExpression(statement.expression);
}

function resolveStaticValue(
  expression: ts.Expression,
  resolver: StaticValueResolverContext,
  contextLabel: string,
  state: { depth: number; seen: Set<string> }
): StaticResolutionResult {
  const currentExpression = unwrapStaticExpression(expression);

  if (state.depth > resolver.maxDepth) {
    return createStaticResolutionError(
      "cyclic_static_reference",
      currentExpression,
      `${contextLabel} exceeded the same-file static resolution depth limit.`
    );
  }

  const literal = readLiteralString(currentExpression);
  if (literal !== undefined) {
    return {
      ok: true,
      value: {
        kind: "string",
        value: literal
      }
    };
  }

  if (ts.isIdentifier(currentExpression)) {
    const identifier = currentExpression.text;

    if (resolver.importedNames.has(identifier)) {
      return createStaticResolutionError(
        "unsupported_import_reference",
        currentExpression,
        `${contextLabel} references imported symbol "${identifier}", which is outside same-file deterministic extraction.`
      );
    }

    const declaration = resolver.declarations.get(identifier);
    if (!declaration) {
      return createStaticResolutionError(
        "unresolved_identifier",
        currentExpression,
        `${contextLabel} references "${identifier}", which is not a same-file deterministic static value.`
      );
    }

    if (declaration.kind === "helper") {
      return createStaticResolutionError(
        "unsupported_call_expression",
        currentExpression,
        `${contextLabel} references helper "${identifier}" without invoking it. Use a same-file zero-arg helper call instead.`
      );
    }

    const seenKey = `value:${identifier}`;
    if (state.seen.has(seenKey)) {
      return createStaticResolutionError(
        "cyclic_static_reference",
        currentExpression,
        `${contextLabel} contains a cyclic same-file static reference through "${identifier}".`
      );
    }

    const nextSeen = new Set(state.seen);
    nextSeen.add(seenKey);
    return resolveStaticValue(declaration.expression, resolver, contextLabel, {
      depth: state.depth + 1,
      seen: nextSeen
    });
  }

  if (ts.isObjectLiteralExpression(currentExpression)) {
    const properties = new Map<string, StaticValue>();

    for (const property of currentExpression.properties) {
      if (!ts.isPropertyAssignment(property)) {
        return createStaticResolutionError(
          "unsupported_member_expression",
          property,
          `${contextLabel} uses an unsupported object literal member. Use plain same-file const object literals without spreads, methods, or shorthand.`
        );
      }

      const propertyName = getObjectPropertyKey(property.name);
      if (!propertyName) {
        return createStaticResolutionError(
          "unsupported_member_expression",
          property.name,
          `${contextLabel} uses an unsupported object literal key. Use identifier or string-literal keys only.`
        );
      }

      const resolvedProperty = resolveStaticValue(
        property.initializer,
        resolver,
        contextLabel,
        state
      );
      if (!resolvedProperty.ok) {
        return resolvedProperty;
      }

      properties.set(propertyName, resolvedProperty.value);
    }

    return {
      ok: true,
      value: {
        kind: "object",
        properties
      }
    };
  }

  if (ts.isPropertyAccessExpression(currentExpression) || ts.isElementAccessExpression(currentExpression)) {
    const objectExpression = currentExpression.expression;
    const resolvedObject = resolveStaticValue(objectExpression, resolver, contextLabel, state);

    if (!resolvedObject.ok) {
      return resolvedObject;
    }

    if (resolvedObject.value.kind !== "object") {
      return createStaticResolutionError(
        "unsupported_member_expression",
        currentExpression,
        `${contextLabel} uses a member expression on a non-object static value.`
      );
    }

    const propertyName = ts.isPropertyAccessExpression(currentExpression)
      ? currentExpression.name.text
      : readLiteralString(
          currentExpression.argumentExpression
            ? unwrapStaticExpression(currentExpression.argumentExpression)
            : undefined
        );

    if (!propertyName) {
      return createStaticResolutionError(
        "unsupported_member_expression",
        currentExpression,
        `${contextLabel} uses an unsupported member expression. Use plain property access or string-literal bracket access only.`
      );
    }

    const resolvedProperty = resolvedObject.value.properties.get(propertyName);
    if (!resolvedProperty) {
      return createStaticResolutionError(
        "unsupported_member_expression",
        currentExpression,
        `${contextLabel} references member "${propertyName}", which is not available on a same-file const object literal.`
      );
    }

    return {
      ok: true,
      value: resolvedProperty
    };
  }

  if (ts.isCallExpression(currentExpression)) {
    if (!ts.isIdentifier(currentExpression.expression)) {
      return createStaticResolutionError(
        "unsupported_call_expression",
        currentExpression,
        `${contextLabel} uses an unsupported helper call. Use a same-file zero-arg helper identifier.`
      );
    }

    const helperName = currentExpression.expression.text;
    if (resolver.importedNames.has(helperName)) {
      return createStaticResolutionError(
        "unsupported_import_reference",
        currentExpression.expression,
        `${contextLabel} references imported helper "${helperName}", which is outside same-file deterministic extraction.`
      );
    }

    if (currentExpression.arguments.length > 0) {
      return createStaticResolutionError(
        "unsupported_call_expression",
        currentExpression,
        `${contextLabel} uses helper "${helperName}" with arguments. Use a same-file zero-arg helper with a single static return expression.`
      );
    }

    const declaration = resolver.declarations.get(helperName);
    if (!declaration || declaration.kind !== "helper") {
      return createStaticResolutionError(
        "unsupported_call_expression",
        currentExpression,
        `${contextLabel} uses helper "${helperName}", which is not a supported same-file zero-arg helper.`
      );
    }

    const helperExpression = getHelperReturnExpression(declaration.node);
    if (!helperExpression) {
      return createStaticResolutionError(
        "unsupported_call_expression",
        currentExpression,
        `${contextLabel} uses helper "${helperName}", which must have a single static return expression and no parameters.`
      );
    }

    const seenKey = `helper:${helperName}`;
    if (state.seen.has(seenKey)) {
      return createStaticResolutionError(
        "cyclic_static_reference",
        currentExpression,
        `${contextLabel} contains a cyclic same-file static helper reference through "${helperName}".`
      );
    }

    const nextSeen = new Set(state.seen);
    nextSeen.add(seenKey);
    return resolveStaticValue(helperExpression, resolver, contextLabel, {
      depth: state.depth + 1,
      seen: nextSeen
    });
  }

  return createStaticResolutionError(
    "unsupported_expression",
    currentExpression,
    `${contextLabel} uses an unsupported dynamic expression. Use a string literal, template literal, or supported same-file deterministic expression.`
  );
}

function resolveStaticStringExpression(
  expression: ts.Expression,
  resolver: StaticValueResolverContext,
  contextLabel: string
): StaticStringResolutionResult {
  const resolved = resolveStaticValue(expression, resolver, contextLabel, {
    depth: 0,
    seen: new Set<string>()
  });

  if (!resolved.ok) {
    return {
      error: resolved.error,
      ok: false
    };
  }

  if (resolved.value.kind !== "string") {
    return {
      error: {
        code: "unsupported_expression",
        message: `${contextLabel} must resolve to a static string value.`,
        node: expression
      },
      ok: false
    };
  }

  return {
    ok: true,
    value: resolved.value.value
  };
}

function pushStaticResolutionDiagnostic(
  sourceFile: ts.SourceFile,
  file: string,
  diagnostics: AICExtractionDiagnostic[],
  result: StaticResolutionResult | StaticStringResolutionResult,
  attribute?: string
): void {
  if (result.ok) {
    return;
  }

  diagnostics.push(
    createDiagnostic(
      sourceFile,
      file,
      result.error.node,
      "warning",
      result.error.code,
      result.error.message,
      attribute
    )
  );
}

function readJsxAttributeValue(
  attribute: ts.JsxAttribute,
  sourceFile: ts.SourceFile,
  file: string,
  staticResolver: StaticValueResolverContext,
  diagnostics: AICExtractionDiagnostic[]
): string | undefined {
  const initializer = attribute.initializer;
  const attributeName = ts.isIdentifier(attribute.name) ? attribute.name.text : attribute.name.getText(sourceFile);

  if (!initializer) {
    diagnostics.push(
      createDiagnostic(
        sourceFile,
        file,
        attribute,
        "warning",
        "missing_value",
        `${attributeName} must use a string literal, template literal, or supported same-file deterministic expression.`,
        attributeName
      )
    );
    return undefined;
  }

  if (ts.isStringLiteral(initializer)) {
    return initializer.text;
  }

  if (!ts.isJsxExpression(initializer) || !initializer.expression) {
    diagnostics.push(
      createDiagnostic(
        sourceFile,
        file,
        attribute,
        "warning",
        "missing_value",
        `${attributeName} must evaluate to a static string value.`,
        attributeName
      )
    );
    return undefined;
  }

  const resolved = resolveStaticStringExpression(
    initializer.expression,
    staticResolver,
    attributeName
  );

  if (!resolved.ok) {
    pushStaticResolutionDiagnostic(sourceFile, file, diagnostics, resolved, attributeName);
    return undefined;
  }

  return resolved.value;
}

function readJsxBooleanAttributeValue(
  attribute: ts.JsxAttribute,
  sourceFile: ts.SourceFile,
  file: string,
  diagnostics: AICExtractionDiagnostic[]
): boolean | undefined {
  const initializer = attribute.initializer;
  const attributeName = ts.isIdentifier(attribute.name) ? attribute.name.text : attribute.name.getText(sourceFile);

  if (!initializer) {
    return true;
  }

  if (!ts.isJsxExpression(initializer) || !initializer.expression) {
    diagnostics.push(
      createDiagnostic(
        sourceFile,
        file,
        attribute,
        "warning",
        "missing_value",
        `${attributeName} must use a boolean literal or shorthand form.`,
        attributeName
      )
    );
    return undefined;
  }

  if (initializer.expression.kind === ts.SyntaxKind.TrueKeyword) {
    return true;
  }

  if (initializer.expression.kind === ts.SyntaxKind.FalseKeyword) {
    return false;
  }

  diagnostics.push(
    createDiagnostic(
      sourceFile,
      file,
      initializer.expression,
      "warning",
      "unsupported_expression",
      `${attributeName} uses an unsupported dynamic expression. Use a boolean literal or shorthand form.`,
      attributeName
    )
  );
  return undefined;
}

function readJsxAttributeName(attribute: ts.JsxAttribute): string {
  return ts.isIdentifier(attribute.name) ? attribute.name.text : attribute.name.getText();
}

function readElementLabel(
  node: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
  sourceFile: ts.SourceFile,
  file: string,
  attributeMap: Map<string, ts.JsxAttribute>,
  staticResolver: StaticValueResolverContext,
  diagnostics: AICExtractionDiagnostic[]
): string | undefined {
  const attributeLabel =
    attributeMap.get("aria-label") ??
    attributeMap.get("title") ??
    attributeMap.get("value") ??
    attributeMap.get("placeholder");

  if (attributeLabel) {
    return readJsxAttributeValue(attributeLabel, sourceFile, file, staticResolver, diagnostics)?.trim();
  }

  if (ts.isJsxSelfClosingElement(node)) {
    return undefined;
  }

  const parent = node.parent;
  if (!ts.isJsxElement(parent)) {
    return undefined;
  }

  const textParts: string[] = [];
  let hasDynamicContent = false;
  let firstDynamicError: StaticStringResolutionResult | undefined;

  parent.children.forEach((child) => {
    if (ts.isJsxText(child)) {
      const value = child.getText(sourceFile).replace(/\s+/g, " ").trim();
      if (value) {
        textParts.push(value);
      }
      return;
    }

    if (ts.isJsxExpression(child) && child.expression) {
      const resolved = resolveStaticStringExpression(
        child.expression,
        staticResolver,
        "Element label"
      );

      if (resolved.ok) {
        const value = resolved.value.replace(/\s+/g, " ").trim();
        if (value) {
          textParts.push(value);
        }
        return;
      }

      if (!firstDynamicError) {
        firstDynamicError = resolved;
      }

      const literal = readLiteralString(child.expression);
      if (literal !== undefined) {
        const value = literal.replace(/\s+/g, " ").trim();
        if (value) {
          textParts.push(value);
        }
        return;
      }
    }

    hasDynamicContent = true;
  });

  if (textParts.length > 0) {
    return textParts.join(" ").replace(/\s+/g, " ").trim();
  }

  if (hasDynamicContent) {
    if (firstDynamicError && !firstDynamicError.ok) {
      pushStaticResolutionDiagnostic(sourceFile, file, diagnostics, firstDynamicError);
    } else {
      diagnostics.push(
        createDiagnostic(
          sourceFile,
          file,
          node,
          "warning",
          "unsupported_expression",
          "Element label uses unsupported dynamic content. Use literal child text or a supported same-file deterministic string expression."
        )
      );
    }
  }

  return undefined;
}

function inferRoleFromTag(tagName: string): AICElementManifest["role"] {
  switch (tagName.toLowerCase()) {
    case "button":
      return "button";
    case "a":
      return "link";
    case "input":
      return "input";
    case "select":
      return "select";
    case "form":
      return "form";
    case "table":
      return "table";
    default:
      return "generic";
  }
}

function normalizeRole(value: string | undefined, tagName: string): AICRole {
  const normalized = value?.trim().toLowerCase();

  switch (normalized) {
    case "button":
    case "link":
    case "searchbox":
    case "input":
    case "textarea":
    case "select":
    case "option":
    case "checkbox":
    case "radio":
    case "switch":
    case "tab":
    case "tabpanel":
    case "menu":
    case "menuitem":
    case "dialog_trigger":
    case "dialog":
    case "form":
    case "upload":
    case "grid":
    case "row":
    case "cell":
    case "listbox":
    case "combobox":
    case "table":
    case "generic":
      return normalized;
    case "textbox":
      return "input";
    default:
      return inferRoleFromTag(tagName);
  }
}

function isSourceInventoryCandidate(tagName: string, explicitRole: string | undefined): boolean {
  const normalizedTag = tagName.toLowerCase();

  return (
    ["a", "button", "input", "select", "textarea"].includes(normalizedTag) ||
    typeof explicitRole === "string"
  );
}

function createSourceKey(file: string, line: number, column: number, tagName: string): string {
  return `${file}:${line}:${column}:${tagName}`;
}

function getOpeningTagSignature(
  source: string,
  sourceFile: ts.SourceFile,
  node: ts.JsxOpeningElement | ts.JsxSelfClosingElement
): string {
  return source
    .slice(node.getStart(sourceFile), node.end)
    .replace(/\s+/g, " ")
    .trim();
}

function buildAttributeInventory(
  node: ts.JsxOpeningElement | ts.JsxSelfClosingElement
): {
  attributes: Map<string, ts.JsxAttribute>;
  duplicateAicProps: string[];
  hasSpreadAttributes: boolean;
} {
  const attributes = new Map<string, ts.JsxAttribute>();
  const duplicateAicProps = new Set<string>();
  let hasSpreadAttributes = false;

  node.attributes.properties.forEach((attribute) => {
    if (ts.isJsxSpreadAttribute(attribute)) {
      hasSpreadAttributes = true;
      return;
    }

    const attributeName = readJsxAttributeName(attribute);
    if (attributes.has(attributeName)) {
      if (attributeName.startsWith("agent")) {
        duplicateAicProps.add(attributeName);
      }
      return;
    }

    attributes.set(attributeName, attribute);
  });

  return {
    attributes,
    duplicateAicProps: Array.from(duplicateAicProps).sort(),
    hasSpreadAttributes
  };
}

function readMutableAicAttributeValue(
  attributeName: MutableAicPropName,
  attribute: ts.JsxAttribute,
  sourceFile: ts.SourceFile,
  file: string,
  staticResolver: StaticValueResolverContext,
  diagnostics: AICExtractionDiagnostic[]
): string | boolean | undefined {
  if (attributeName === "agentRequiresConfirmation") {
    return readJsxBooleanAttributeValue(attribute, sourceFile, file, diagnostics);
  }

  return readJsxAttributeValue(attribute, sourceFile, file, staticResolver, diagnostics);
}

function collectUnsupportedMutableAicProps(
  attributes: Map<string, ts.JsxAttribute>,
  sourceFile: ts.SourceFile,
  file: string,
  staticResolver: StaticValueResolverContext
): string[] {
  const unsupported = new Set<string>();

  MUTABLE_AIC_PROP_NAMES.forEach((attributeName) => {
    const attribute = attributes.get(attributeName);

    if (!attribute) {
      return;
    }

    const diagnostics: AICExtractionDiagnostic[] = [];
    const value = readMutableAicAttributeValue(
      attributeName as MutableAicPropName,
      attribute,
      sourceFile,
      file,
      staticResolver,
      diagnostics
    );

    if (value === undefined) {
      unsupported.add(attributeName);
    }
  });

  return Array.from(unsupported).sort();
}

function normalizeRisk(risk: string | undefined): AICElementManifest["risk"] {
  return risk === "low" || risk === "medium" || risk === "high" || risk === "critical"
    ? risk
    : "medium";
}

function humanizeAgentId(agentId: string): string {
  return agentId.split(".").at(-1)?.replaceAll("_", " ") ?? agentId;
}

function createElements(matches: AICSourceScanMatch[]): AICElementManifest[] {
  return matches.map((match) => ({
    id: match.agentId,
    label: match.agentDescription ?? humanizeAgentId(match.agentId),
    description: match.agentDescription,
    role: match.role,
    actions: [
      {
        name: match.action ?? "click",
        target: match.agentId,
        type: "element_action"
      }
    ],
    risk: normalizeRisk(match.risk),
    state: {
      visible: true
    },
    notes: [`Extracted from ${match.file}:${match.line}`]
  }));
}

function createActionContracts(matches: AICSourceScanMatch[]): AICActionContract[] {
  return matches.map((match) => ({
    name: match.agentId,
    title: match.agentDescription ?? match.agentId,
    target: match.agentId,
    preconditions: [],
    postconditions: [],
    side_effects: [],
    idempotent: false,
    undoable: false,
    estimated_latency_ms: 1000,
    completion_signal: {
      type: "state_change",
      value: `${match.agentId}.completed = true`
    },
    failure_modes: ["unknown_failure"]
  }));
}

function toPortablePath(pathValue: string): string {
  return pathValue.replaceAll("\\", "/");
}

export async function collectSourceFiles(rootDir: string): Promise<string[]> {
  const fullPath = resolve(rootDir);
  const targetStat = await stat(fullPath);

  if (targetStat.isFile()) {
    return SOURCE_EXTENSIONS.has(extname(fullPath)) ? [fullPath] : [];
  }

  const entries = await readdir(fullPath, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = `${fullPath}/${entry.name}`;

      if (entry.isDirectory()) {
        if (IGNORED_DIRECTORIES.has(entry.name)) {
          return [];
        }

        return collectSourceFiles(entryPath);
      }

      return SOURCE_EXTENSIONS.has(extname(entryPath)) ? [entryPath] : [];
    })
  );

  return files.flat().sort();
}

function parseSourceAnalysis(source: string, file: string): ParsedSourceAnalysis {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const staticResolver = createStaticValueResolver(sourceFile);
  const diagnostics: AICExtractionDiagnostic[] = [];
  const records: ParsedJsxElementRecord[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      const attributeInventory = buildAttributeInventory(node);
      const attributeMap = attributeInventory.attributes;
      const explicitRoleAttribute =
        (attributeMap.get("agentRole") as ts.JsxAttribute | undefined) ??
        (attributeMap.get("role") as ts.JsxAttribute | undefined);
      const explicitRole = explicitRoleAttribute
        ? readJsxAttributeValue(explicitRoleAttribute, sourceFile, file, staticResolver, diagnostics)
        : undefined;
      const tagName = node.tagName.getText(sourceFile);
      const role = normalizeRole(explicitRole, tagName);
      const location = getLineColumn(sourceFile, node);
      const opening_tag_signature = getOpeningTagSignature(source, sourceFile, node);
      const agentIdAttribute = attributeMap.get("agentId");
      const shouldInspectLabel = Boolean(agentIdAttribute) || isSourceInventoryCandidate(tagName, explicitRole);
      const label = shouldInspectLabel
        ? readElementLabel(node, sourceFile, file, attributeMap, staticResolver, diagnostics)
        : undefined;
      const source_key = createSourceKey(file, location.line, location.column, tagName);
      const agentId = agentIdAttribute
        ? readJsxAttributeValue(agentIdAttribute, sourceFile, file, staticResolver, diagnostics)
        : undefined;
      const action = attributeMap.get("agentAction")
        ? readJsxAttributeValue(attributeMap.get("agentAction") as ts.JsxAttribute, sourceFile, file, staticResolver, diagnostics)
        : undefined;
      const agentDescription = attributeMap.get("agentDescription")
        ? readJsxAttributeValue(
            attributeMap.get("agentDescription") as ts.JsxAttribute,
            sourceFile,
            file,
            staticResolver,
            diagnostics
          )
        : undefined;
      const risk = attributeMap.get("agentRisk")
        ? readJsxAttributeValue(attributeMap.get("agentRisk") as ts.JsxAttribute, sourceFile, file, staticResolver, diagnostics)
        : undefined;
      const unsupportedAicProps = collectUnsupportedMutableAicProps(
        attributeMap,
        sourceFile,
        file,
        staticResolver
      );
      const selectors = {
        testId:
          (attributeMap.get("data-testid") &&
            readJsxAttributeValue(
              attributeMap.get("data-testid") as ts.JsxAttribute,
              sourceFile,
              file,
              staticResolver,
              diagnostics
            )) ||
          (attributeMap.get("data-test-id") &&
            readJsxAttributeValue(
              attributeMap.get("data-test-id") as ts.JsxAttribute,
              sourceFile,
              file,
              staticResolver,
              diagnostics
            )) ||
          undefined,
        text: label
      };

      if (agentId || (label && isSourceInventoryCandidate(tagName, explicitRole))) {
        records.push({
          action,
          agentDescription,
          agentId,
          attributes: attributeMap,
          column: location.column,
          diagnostics,
          duplicateAicProps: attributeInventory.duplicateAicProps,
          file,
          hasSpreadAttributes: attributeInventory.hasSpreadAttributes,
          label,
          line: location.line,
          node,
          opening_tag_signature,
          risk,
          role,
          selectors,
          sourceFile,
          source_key,
          tagName,
          unsupportedAicProps
        });
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return {
    diagnostics,
    matches: records
      .filter((record) => record.agentId)
      .map((record) => ({
        action: record.action,
        agentDescription: record.agentDescription,
        agentId: record.agentId as string,
        column: record.column,
        file: record.file,
        line: record.line,
        role: record.role,
        risk: record.risk,
        source_key: record.source_key,
        tagName: record.tagName
      })),
    source_inventory: records.map((record) => ({
      annotated_agent_id: record.agentId,
      column: record.column,
      duplicate_aic_props: record.duplicateAicProps.length > 0 ? record.duplicateAicProps : undefined,
      file: record.file,
      has_spread_attributes: record.hasSpreadAttributes || undefined,
      label: record.label ?? record.agentDescription ?? humanizeAgentId(record.agentId ?? record.source_key),
      line: record.line,
      opening_tag_signature: record.opening_tag_signature,
      role: record.role,
      selectors: record.selectors,
      source_key: record.source_key,
      tagName: record.tagName,
      unsupported_aic_props: record.unsupportedAicProps.length > 0 ? record.unsupportedAicProps : undefined
    }))
  };
}

function parseSourceFileForApply(source: string, file: string): ApplyParsedFile {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const staticResolver = createStaticValueResolver(sourceFile);
  const diagnostics: AICExtractionDiagnostic[] = [];
  const records: ParsedJsxElementRecord[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      const attributeInventory = buildAttributeInventory(node);
      const attributeMap = attributeInventory.attributes;
      const tagName = node.tagName.getText(sourceFile);
      const explicitRoleAttribute =
        (attributeMap.get("agentRole") as ts.JsxAttribute | undefined) ??
        (attributeMap.get("role") as ts.JsxAttribute | undefined);
      const explicitRole = explicitRoleAttribute
        ? readJsxAttributeValue(explicitRoleAttribute, sourceFile, file, staticResolver, diagnostics)
        : undefined;
      const location = getLineColumn(sourceFile, node);
      const shouldInspectLabel =
        Boolean(attributeMap.get("agentId")) || isSourceInventoryCandidate(tagName, explicitRole);
      const label = shouldInspectLabel
        ? readElementLabel(node, sourceFile, file, attributeMap, staticResolver, diagnostics)
        : undefined;
      const opening_tag_signature = getOpeningTagSignature(source, sourceFile, node);
      const unsupportedAicProps = collectUnsupportedMutableAicProps(
        attributeMap,
        sourceFile,
        file,
        staticResolver
      );

      records.push({
        action: attributeMap.get("agentAction")
          ? readJsxAttributeValue(attributeMap.get("agentAction") as ts.JsxAttribute, sourceFile, file, staticResolver, diagnostics)
          : undefined,
        agentDescription: attributeMap.get("agentDescription")
          ? readJsxAttributeValue(
              attributeMap.get("agentDescription") as ts.JsxAttribute,
              sourceFile,
              file,
              staticResolver,
              diagnostics
            )
          : undefined,
        agentId: attributeMap.get("agentId")
          ? readJsxAttributeValue(attributeMap.get("agentId") as ts.JsxAttribute, sourceFile, file, staticResolver, diagnostics)
          : undefined,
        attributes: attributeMap,
        column: location.column,
        diagnostics,
        duplicateAicProps: attributeInventory.duplicateAicProps,
        file,
        hasSpreadAttributes: attributeInventory.hasSpreadAttributes,
        label,
        line: location.line,
        node,
        opening_tag_signature,
        risk: attributeMap.get("agentRisk")
          ? readJsxAttributeValue(attributeMap.get("agentRisk") as ts.JsxAttribute, sourceFile, file, staticResolver, diagnostics)
          : undefined,
        role: normalizeRole(explicitRole, tagName),
        selectors: {
          testId:
            (attributeMap.get("data-testid") &&
              readJsxAttributeValue(
                attributeMap.get("data-testid") as ts.JsxAttribute,
                sourceFile,
                file,
                staticResolver,
                diagnostics
              )) ||
            (attributeMap.get("data-test-id") &&
              readJsxAttributeValue(
                attributeMap.get("data-test-id") as ts.JsxAttribute,
                sourceFile,
                file,
                staticResolver,
                diagnostics
              )) ||
            undefined,
          text: label
        },
        sourceFile,
        source_key: createSourceKey(file, location.line, location.column, tagName),
        tagName,
        unsupportedAicProps
      });
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return {
    staticResolver,
    records,
    source,
    sourceFile
  };
}

export function scanSourceForAICAnnotations(source: string, file = "<memory>"): AICFileScanResult {
  const parsed = parseSourceAnalysis(source, file);
  return {
    diagnostics: parsed.diagnostics,
    file,
    matches: parsed.matches,
    source_inventory: parsed.source_inventory
  };
}

export async function analyzeProjectForAICAnnotations(projectRoot: string): Promise<AICProjectScanResult> {
  const resolvedRoot = resolve(projectRoot);
  const files = await collectSourceFiles(resolvedRoot);
  const fileResults = await Promise.all(
    files.map(async (file) => {
      const displayFile = toPortablePath(relative(resolvedRoot, file) || file);
      return scanSourceForAICAnnotations(await readFile(file, "utf8"), displayFile);
    })
  );

  return {
    diagnostics: fileResults.flatMap((result) => result.diagnostics),
    files: fileResults.map((result) => result.file),
    matches: fileResults.flatMap((result) => result.matches),
    source_inventory: fileResults.flatMap((result) => result.source_inventory)
  };
}

export async function generateProjectArtifacts(
  options: AICProjectArtifactsOptions
): Promise<AICProjectArtifacts> {
  const registry = new AICRegistry();
  const scanResult = options.projectRoot
    ? await analyzeProjectForAICAnnotations(options.projectRoot)
    : { diagnostics: [], files: [], matches: [], source_inventory: [] };
  const timestamp = options.generatedAt ?? new Date().toISOString();
  const updatedAt = options.updatedAt ?? timestamp;
  const discovery = registry.createDiscoveryManifest({
    appName: options.appName,
    appVersion: options.appVersion,
    framework: options.framework,
    generated_at: timestamp,
    notes: options.notes
  });
  const permissions = registry.createPermissionsManifest(options.permissions);
  permissions.generated_at = timestamp;
  const workflows = registry.serializeWorkflows(options.workflows ?? []);
  workflows.generated_at = timestamp;
  const operate = registry.renderOperateText({
    appName: options.appName,
    endpoints: discovery.endpoints,
    notes: options.operateNotes ?? options.notes
  });
  const ui: AICRuntimeUiManifest = {
    spec: discovery.spec,
    manifest_version: discovery.manifest_version,
    updated_at: updatedAt,
    page: {
      url: options.viewUrl ?? "http://localhost:3000"
    },
    view: {
      view_id: options.viewId ?? `${options.framework}.root`
    },
    elements: createElements(scanResult.matches)
  };
  const actions: AICSemanticActionsManifest = {
    spec: discovery.spec,
    manifest_version: discovery.manifest_version,
    generated_at: timestamp,
    actions: createActionContracts(scanResult.matches)
  };

  return {
    actions,
    diagnostics: scanResult.diagnostics,
    discovery,
    files: {
      "/.well-known/agent.json": JSON.stringify(discovery, null, 2),
      "/.well-known/agent/ui": `${JSON.stringify(ui, null, 2)}\n`,
      "/.well-known/agent/actions": `${JSON.stringify(actions, null, 2)}\n`,
      "/agent-permissions.json": JSON.stringify(permissions, null, 2),
      "/agent-workflows.json": JSON.stringify(workflows, null, 2),
      "/operate.txt": operate
    },
    matches: scanResult.matches,
    operate,
    permissions,
    scan: {
      filesScanned: scanResult.files.length
    },
    source_inventory: scanResult.source_inventory,
    ui,
    workflows
  };
}

export async function writeArtifactFiles(
  outDir: string,
  files: Record<string, string>
): Promise<void> {
  await Promise.all(
    Object.entries(files).map(async ([relativePath, contents]) => {
      const filePath = resolve(outDir, relativePath.replace(/^\/+/, ""));
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, contents, "utf8");
    })
  );
}

export function createProjectArtifactReport(
  framework: string,
  artifacts: Pick<AICProjectArtifacts, "diagnostics" | "matches" | "scan" | "source_inventory">,
  options: {
    projectRoot?: string;
  } = {}
): AICProjectArtifactReport {
  return {
    agent_onboarding: getAICAgentOnboardingReport(options.projectRoot ?? process.cwd()),
    diagnostics: artifacts.diagnostics,
    filesScanned: artifacts.scan.filesScanned,
    framework,
    matches: artifacts.matches,
    source_inventory: artifacts.source_inventory
  };
}

export interface AICAuthoringApplyOptions {
  projectRoot?: string;
  write?: boolean;
}

function escapeJsxAttributeValue(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
}

function formatJsxAttribute(name: string, value: string | boolean): string {
  if (typeof value === "boolean") {
    return value ? name : `${name}={false}`;
  }

  return `${name}="${escapeJsxAttributeValue(value)}"`;
}

function getTagInsertIndex(source: string, node: ts.JsxOpeningElement | ts.JsxSelfClosingElement): number {
  let index = node.end - 1;

  while (index > node.getStart(node.getSourceFile()) && /\s/.test(source[index - 1] ?? "")) {
    index -= 1;
  }

  if (source[index - 1] === "/") {
    return index - 1;
  }

  return index;
}

function getAttributeIndentation(
  source: string,
  sourceFile: ts.SourceFile,
  node: ts.JsxOpeningElement | ts.JsxSelfClosingElement
): { indent: string; multiline: boolean } {
  const openingText = source.slice(node.getStart(sourceFile), node.end);

  if (!openingText.includes("\n")) {
    return {
      indent: " ",
      multiline: false
    };
  }

  const attributes = node.attributes.properties.filter(ts.isJsxAttribute);
  if (attributes.length > 0) {
    const attributeStart = attributes[0].getStart(sourceFile);
    const lineStart = source.lastIndexOf("\n", attributeStart - 1) + 1;
    return {
      indent: source.slice(lineStart, attributeStart),
      multiline: true
    };
  }

  const nodeStart = node.getStart(sourceFile);
  const lineStart = source.lastIndexOf("\n", nodeStart - 1) + 1;
  const baseIndent = source.slice(lineStart, nodeStart).match(/^\s*/)?.[0] ?? "";
  return {
    indent: `${baseIndent}  `,
    multiline: true
  };
}

function applyEdits(
  source: string,
  edits: Array<{ end: number; start: number; text: string }>
): string {
  return edits
    .sort((left, right) => right.start - left.start)
    .reduce((currentSource, edit) => {
      return `${currentSource.slice(0, edit.start)}${edit.text}${currentSource.slice(edit.end)}`;
    }, source);
}

function normalizeText(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function recordMatchesProposalIdentity(
  record: ParsedJsxElementRecord,
  proposal: AICAuthoringPatchPlan["proposals"][number]
): boolean {
  const applyTarget = proposal.apply_target;

  if (!applyTarget) {
    return false;
  }

  if (applyTarget.match_kind === "agent_id_exact") {
    return record.agentId === proposal.recommended_props.agentId;
  }

  if (record.agentId) {
    return false;
  }

  const expectedLabel =
    proposal.evidence.dom_candidate?.label ??
    proposal.evidence.snapshot_element?.label ??
    proposal.recommended_props.agentDescription;
  const expectedRole =
    proposal.evidence.dom_candidate?.role ?? proposal.evidence.snapshot_element?.role;

  return normalizeText(record.label) === normalizeText(expectedLabel) && record.role === expectedRole;
}

function resolveApplyRecord(
  records: ParsedJsxElementRecord[],
  proposal: AICAuthoringPatchPlan["proposals"][number]
): {
  ambiguous_signature_match?: boolean;
  record?: ParsedJsxElementRecord;
  resolved_via_signature?: boolean;
} {
  const applyTarget = proposal.apply_target;

  if (!applyTarget) {
    return {};
  }

  const exactSourceKeyMatches = records.filter(
    (record) => record.source_key === applyTarget.source_key && recordMatchesProposalIdentity(record, proposal)
  );

  if (exactSourceKeyMatches.length === 1) {
    return {
      record: exactSourceKeyMatches[0],
      resolved_via_signature: false
    };
  }

  if (exactSourceKeyMatches.length > 1) {
    return {
      ambiguous_signature_match: true
    };
  }

  if (!applyTarget.opening_tag_signature) {
    return {};
  }

  const signatureMatches = records.filter(
    (record) =>
      record.opening_tag_signature === applyTarget.opening_tag_signature &&
      recordMatchesProposalIdentity(record, proposal)
  );

  if (signatureMatches.length === 1) {
    return {
      record: signatureMatches[0],
      resolved_via_signature: true
    };
  }

  if (signatureMatches.length > 1) {
    return {
      ambiguous_signature_match: true
    };
  }

  return {};
}

function buildDesiredProps(
  proposal: AICAuthoringPatchPlan["proposals"][number]
): DesiredMutableAicProps {
  const desiredProps: DesiredMutableAicProps = {
    agentAction: proposal.recommended_props.agentAction,
    agentDescription: proposal.recommended_props.agentDescription,
    agentId: proposal.recommended_props.agentId,
    agentRisk: proposal.recommended_props.agentRisk
  };

  if (proposal.recommended_optional_props?.agentEntityId) {
    desiredProps.agentEntityId = proposal.recommended_optional_props.agentEntityId;
  }

  if (proposal.recommended_optional_props?.agentEntityLabel) {
    desiredProps.agentEntityLabel = proposal.recommended_optional_props.agentEntityLabel;
  }

  if (proposal.recommended_optional_props?.agentEntityType) {
    desiredProps.agentEntityType = proposal.recommended_optional_props.agentEntityType;
  }

  if (proposal.recommended_optional_props?.agentRequiresConfirmation) {
    desiredProps.agentRequiresConfirmation = true;
  }

  if (proposal.recommended_optional_props?.agentRole) {
    desiredProps.agentRole = proposal.recommended_optional_props.agentRole;
  }

  if (proposal.recommended_optional_props?.agentWorkflowStep) {
    desiredProps.agentWorkflowStep = proposal.recommended_optional_props.agentWorkflowStep;
  }

  return desiredProps;
}

function getRecordApplyBlockReason(
  record: ParsedJsxElementRecord,
  proposal: AICAuthoringPatchPlan["proposals"][number]
): AICAuthoringPatchPlan["proposals"][number]["apply_block_reason"] | undefined {
  if (record.hasSpreadAttributes) {
    return "spread_attributes_present";
  }

  if (record.duplicateAicProps.length > 0) {
    return "duplicate_aic_props";
  }

  const desiredPropNames = new Set(Object.keys(buildDesiredProps(proposal)));
  if (record.unsupportedAicProps.some((attributeName) => desiredPropNames.has(attributeName))) {
    return "dynamic_existing_aic_prop";
  }

  return undefined;
}

function formatApplyBlockMessage(
  reason: AICAuthoringPatchPlan["proposals"][number]["apply_block_reason"] | undefined
): string {
  switch (reason) {
    case "ignored":
      return "Proposal is ignored and will not be applied.";
    case "not_ready":
      return "Proposal is not ready for apply.";
    case "review_only_source_match":
      return "Proposal only has review-only source candidates and requires an exact source match.";
    case "ambiguous_exact_source_match":
      return "Proposal has multiple exact source matches and requires review.";
    case "spread_attributes_present":
      return "Guarded apply skipped this source because the opening tag uses JSX spread attributes.";
    case "duplicate_aic_props":
      return "Guarded apply skipped this source because the opening tag contains duplicate AIC props.";
    case "dynamic_existing_aic_prop":
      return "Guarded apply skipped this source because existing AIC props use unsupported dynamic expressions.";
    default:
      return "Proposal does not have an exact source match.";
  };
}

function applyPropsToRecord(
  parsedFile: ApplyParsedFile,
  currentSource: string,
  record: ParsedJsxElementRecord,
  desiredProps: DesiredMutableAicProps
): { changed_fields: string[]; source: string } {
  const updates: Array<{ end: number; start: number; text: string }> = [];
  const missingAttributes: string[] = [];
  const changedFields: string[] = [];

  (Object.entries(desiredProps) as Array<[MutableAicPropName, string | boolean]>).forEach(
    ([attributeName, desiredValue]) => {
      const attribute = record.attributes.get(attributeName);

      if (!attribute) {
        missingAttributes.push(formatJsxAttribute(attributeName, desiredValue));
        changedFields.push(attributeName);
        return;
      }

      const currentValue = readMutableAicAttributeValue(
        attributeName,
        attribute,
        parsedFile.sourceFile,
        record.file,
        parsedFile.staticResolver,
        []
      );

      if (currentValue === desiredValue) {
        return;
      }

      updates.push({
        end: attribute.end,
        start: attribute.getStart(parsedFile.sourceFile),
        text: formatJsxAttribute(attributeName, desiredValue)
      });
      changedFields.push(attributeName);
    }
  );

  if (missingAttributes.length > 0) {
    const insertionIndex = getTagInsertIndex(currentSource, record.node);
    const indentation = getAttributeIndentation(currentSource, parsedFile.sourceFile, record.node);
    updates.push({
      end: insertionIndex,
      start: insertionIndex,
      text: indentation.multiline
        ? missingAttributes.map((attribute) => `\n${indentation.indent}${attribute}`).join("")
        : ` ${missingAttributes.join(" ")}`
    });
  }

  if (updates.length === 0) {
    return {
      changed_fields: [],
      source: currentSource
    };
  }

  return {
    changed_fields: changedFields,
    source: applyEdits(currentSource, updates)
  };
}

export async function applyAuthoringPatchPlan(
  plan: AICAuthoringPatchPlan,
  options: AICAuthoringApplyOptions = {}
): Promise<AICAuthoringApplyResult> {
  const projectRoot = resolve(options.projectRoot ?? process.cwd());
  const dryRun = options.write !== true;
  const outcomes: AICAuthoringApplyResult["outcomes"] = [];
  const eligibleProposals = new Map<string, Array<AICAuthoringPatchPlan["proposals"][number]>>();

  plan.proposals.forEach((proposal) => {
    if (proposal.apply_status !== "eligible" || !proposal.apply_target) {
      outcomes.push({
        changed_fields: [],
        file: proposal.apply_target?.file,
        message: formatApplyBlockMessage(proposal.apply_block_reason),
        proposal_key: proposal.key,
        source_key: proposal.apply_target?.source_key,
        status: "skipped"
      });
      return;
    }

    const group = eligibleProposals.get(proposal.apply_target.file) ?? [];
    group.push(proposal);
    eligibleProposals.set(proposal.apply_target.file, group);
  });

  const changedFiles = new Set<string>();

  for (const [relativeFile, fileProposals] of eligibleProposals) {
    const resolvedFile = resolve(projectRoot, relativeFile);
    let originalSource: string;

    try {
      originalSource = await readFile(resolvedFile, "utf8");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to read source file.";
      fileProposals.forEach((proposal) => {
        outcomes.push({
          changed_fields: [],
          file: relativeFile,
          message,
          proposal_key: proposal.key,
          source_key: proposal.apply_target?.source_key,
          status: "failed"
        });
      });
      continue;
    }

    const parsedFile = parseSourceFileForApply(originalSource, relativeFile);
    const resolvedEntries = fileProposals
      .map((proposal) => {
        const resolution = resolveApplyRecord(parsedFile.records, proposal);
        return {
          proposal,
          ...resolution
        };
      })
      .sort((left, right) => {
        const leftStart = left.record?.node.getStart(parsedFile.sourceFile) ?? -1;
        const rightStart = right.record?.node.getStart(parsedFile.sourceFile) ?? -1;
        return rightStart - leftStart;
      });

    let nextSource = originalSource;
    const successfulOutcomes: Array<{
      changed_fields: string[];
      proposal: AICAuthoringPatchPlan["proposals"][number];
      resolved_via_signature?: boolean;
    }> = [];

    for (const entry of resolvedEntries) {
      if (entry.ambiguous_signature_match) {
        outcomes.push({
          changed_fields: [],
          file: relativeFile,
          message:
            "Recorded source target drifted and the opening tag signature matched multiple current locations.",
          proposal_key: entry.proposal.key,
          source_key: entry.proposal.apply_target?.source_key,
          status: "skipped"
        });
        continue;
      }

      if (!entry.record) {
        outcomes.push({
          changed_fields: [],
          file: relativeFile,
          message: "Recorded source target no longer matches the current file.",
          proposal_key: entry.proposal.key,
          source_key: entry.proposal.apply_target?.source_key,
          status: "skipped"
        });
        continue;
      }

      const applyBlockReason = getRecordApplyBlockReason(entry.record, entry.proposal);
      if (applyBlockReason) {
        outcomes.push({
          changed_fields: [],
          file: relativeFile,
          message: formatApplyBlockMessage(applyBlockReason),
          proposal_key: entry.proposal.key,
          source_key: entry.proposal.apply_target?.source_key,
          status: "skipped"
        });
        continue;
      }

      const applied = applyPropsToRecord(parsedFile, nextSource, entry.record, buildDesiredProps(entry.proposal));
      nextSource = applied.source;
      const signatureRecoveryPrefix = entry.resolved_via_signature
        ? "Recovered source by opening tag signature. "
        : "";

      if (applied.changed_fields.length === 0) {
        outcomes.push({
          changed_fields: [],
          file: relativeFile,
          message: `${signatureRecoveryPrefix}Source already matches the recommended props.`,
          proposal_key: entry.proposal.key,
          source_key: entry.proposal.apply_target?.source_key,
          status: "skipped"
        });
        continue;
      }

      successfulOutcomes.push({
        changed_fields: applied.changed_fields,
        proposal: entry.proposal,
        resolved_via_signature: entry.resolved_via_signature
      });
    }

    if (successfulOutcomes.length === 0) {
      continue;
    }

    if (!dryRun) {
      try {
        await writeFile(resolvedFile, nextSource, "utf8");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to write source file.";
        successfulOutcomes.forEach((entry) => {
          outcomes.push({
            changed_fields: entry.changed_fields,
            file: relativeFile,
            message,
            proposal_key: entry.proposal.key,
            source_key: entry.proposal.apply_target?.source_key,
            status: "failed"
          });
        });
        continue;
      }
    }

    changedFiles.add(relativeFile);
    successfulOutcomes.forEach((entry) => {
      const signatureRecoveryPrefix = entry.resolved_via_signature
        ? "Recovered source by opening tag signature. "
        : "";
      outcomes.push({
        changed_fields: entry.changed_fields,
        file: relativeFile,
        message: dryRun
          ? `${signatureRecoveryPrefix}Dry run: would apply ${entry.changed_fields.join(", ")}.`
          : `${signatureRecoveryPrefix}Applied ${entry.changed_fields.join(", ")}.`,
        proposal_key: entry.proposal.key,
        source_key: entry.proposal.apply_target?.source_key,
        status: "applied"
      });
    });
  }

  return {
    artifact_type: "aic_authoring_apply_result",
    dry_run: dryRun,
    generated_at: new Date().toISOString(),
    outcomes,
    plan_generated_at: plan.generated_at,
    project_root: projectRoot,
    summary: {
      applied: outcomes.filter((outcome) => outcome.status === "applied").length,
      changed_files: changedFiles.size,
      failed: outcomes.filter((outcome) => outcome.status === "failed").length,
      skipped: outcomes.filter((outcome) => outcome.status === "skipped").length,
      total: outcomes.length
    }
  };
}

export function diffManifestValues(
  kind: AICAutomationManifestKind,
  before: unknown,
  after: unknown
): AICManifestDiff {
  return diffAICManifestSummary(kind, before, after);
}

export function diffManifestValuesDetailed(
  kind: AICAutomationManifestKind,
  before: unknown,
  after: unknown
): AICDetailedManifestDiff {
  return diffAICManifestDetailed(kind, before, after);
}
