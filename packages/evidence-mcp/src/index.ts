import {
  AICEvidenceCollectionError,
  type AICCredentialResolver,
  type AICEvidenceAdapter,
  type AICEvidenceAdapterExecutionContext,
  type AICFetch,
  createAICEvidenceArtifact,
  createAICEvidenceDigest,
  evaluateAICEvidenceExpression,
  projectAICBehaviorObservation,
  timeoutSignal
} from "@aicorg/evidence-core";
import type {
  AICBehaviorObservation,
  AICEvidenceAdapterCollection,
  AICEvidenceHeaderValue,
  AICMcpEvidenceScenarioPlan,
  AICMcpEvidenceSurfacePlan,
  JsonValue
} from "@aicorg/spec";

export const AIC_MCP_EVIDENCE_ADAPTER_ID = "@aicorg/evidence-mcp";
export const AIC_MCP_EVIDENCE_ADAPTER_VERSION = "0.1.0-alpha.2";
export const AIC_MCP_PROTOCOL_VERSION = "2026-07-28";

const SENSITIVE_HEADERS = new Set([
  "authorization",
  "cookie",
  "proxy-authorization",
  "set-cookie",
  "x-api-key"
]);
const FORBIDDEN_HEADERS = new Set([
  "accept",
  "connection",
  "content-length",
  "content-type",
  "host",
  "mcp-method",
  "mcp-name",
  "mcp-protocol-version",
  "mcp-session-id",
  "proxy-authorization",
  "transfer-encoding"
]);

export interface AICMcpToolDefinition {
  annotations?: {
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
    readOnlyHint?: boolean;
    title?: string;
  };
  description?: string;
  inputSchema: Record<string, unknown>;
  name: string;
  outputSchema?: Record<string, unknown>;
  title?: string;
}

export interface AICMcpToolResult {
  content?: Array<Record<string, unknown>>;
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface AICMcpCaller {
  readonly protocolVersion: typeof AIC_MCP_PROTOCOL_VERSION;
  callTool(input: {
    arguments: Record<string, JsonValue>;
    signal: AbortSignal;
    tool: AICMcpToolDefinition;
  }): Promise<AICMcpToolResult>;
  listTools(input: { signal: AbortSignal }): Promise<AICMcpToolDefinition[]>;
}

export interface AICMcpInjectedCallerInput {
  callTool(input: {
    arguments: Record<string, JsonValue>;
    signal: AbortSignal;
    tool: AICMcpToolDefinition;
  }): Promise<AICMcpToolResult>;
  listTools(input: { signal: AbortSignal }): Promise<AICMcpToolDefinition[]>;
  protocolVersion: string;
}

interface JsonRpcResponse {
  error?: { code?: number; data?: unknown; message?: string };
  id?: number | string;
  jsonrpc?: string;
  result?: unknown;
}

interface McpTranscript {
  arguments_digest: string;
  is_error: boolean;
  kind: "invocation" | "probe";
  result_digest: string;
  tool: {
    annotations?: AICMcpToolDefinition["annotations"];
    input_schema_digest: string;
    name: string;
    output_schema_digest?: string;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || ["boolean", "number", "string"].includes(typeof value)) return typeof value !== "number" || Number.isFinite(value);
  if (Array.isArray(value)) return value.every((item) => isJsonValue(item));
  return isRecord(value) && Object.values(value).every((item) => isJsonValue(item));
}

function assertExactOrigin(value: string, origin: string): URL {
  let url: URL;
  try {
    url = new URL(value, origin);
  } catch {
    throw new AICEvidenceCollectionError("plan_invalid", "MCP endpoint is not a valid URL.");
  }
  if (url.origin !== origin || url.username || url.password) {
    throw new AICEvidenceCollectionError("target_rejected", "MCP endpoint must stay on the exact target origin.");
  }
  return url;
}

async function resolveHeaders(
  headers: Record<string, AICEvidenceHeaderValue> | undefined,
  credentials: AICCredentialResolver | undefined
): Promise<Record<string, string>> {
  const resolved: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers ?? {})) {
    const normalized = name.toLowerCase();
    if (FORBIDDEN_HEADERS.has(normalized)) throw new AICEvidenceCollectionError("plan_invalid", `MCP request header is reserved: ${name}.`);
    const headerValue = typeof value === "string"
      ? value
      : credentials
        ? await credentials(value.secret_ref)
        : undefined;
    if (!headerValue || /\r|\n/.test(headerValue)) throw new AICEvidenceCollectionError("plan_invalid", `MCP request header is empty or unsafe: ${name}.`);
    resolved[name] = headerValue;
  }
  return resolved;
}

function encodeHeaderValue(value: string): string {
  if (/^[\x21-\x7e](?:[\x20-\x7e]*[\x21-\x7e])?$/.test(value)) return value;
  return `=?base64?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

interface McpHeaderBinding {
  header: string;
  path: string[];
  type: "boolean" | "integer" | "string";
}

function collectMcpHeaderBindings(schema: Record<string, unknown>): McpHeaderBinding[] {
  const bindings: McpHeaderBinding[] = [];
  const names = new Set<string>();
  const visit = (
    value: unknown,
    propertyPath: string[],
    annotationAllowed: boolean,
    traversalAllowed: boolean
  ): void => {
    if (!isRecord(value)) return;
    if (Object.prototype.hasOwnProperty.call(value, "x-mcp-header")) {
      const header = value["x-mcp-header"];
      const type = value.type;
      if (
        !annotationAllowed ||
        !traversalAllowed ||
        typeof header !== "string" ||
        !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(header) ||
        !["boolean", "integer", "string"].includes(String(type)) ||
        names.has(header.toLowerCase())
      ) {
        throw new AICEvidenceCollectionError("tool_mismatch", "MCP tool has an invalid x-mcp-header annotation.");
      }
      names.add(header.toLowerCase());
      bindings.push({ header, path: propertyPath, type: type as McpHeaderBinding["type"] });
    }
    if (isRecord(value.properties)) {
      for (const [name, child] of Object.entries(value.properties)) {
        visit(child, [...propertyPath, name], true, traversalAllowed);
      }
    }
    for (const key of ["allOf", "anyOf", "oneOf", "not", "if", "then", "else", "items", "$ref"] as const) {
      if (value[key] === undefined) continue;
      const children = Array.isArray(value[key]) ? value[key] as unknown[] : [value[key]];
      children.forEach((child) => visit(child, propertyPath, false, false));
    }
  };
  visit(schema, [], false, true);
  return bindings;
}

function valueAtPath(value: unknown, path: string[]): unknown {
  let current = value;
  for (const part of path) {
    if (!isRecord(current) || !Object.prototype.hasOwnProperty.call(current, part)) return undefined;
    current = current[part];
  }
  return current;
}

function mcpParameterHeaders(
  tool: AICMcpToolDefinition,
  args: Record<string, JsonValue>
): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const binding of collectMcpHeaderBindings(tool.inputSchema)) {
    const value = valueAtPath(args, binding.path);
    if (value === undefined) continue;
    const valid =
      (binding.type === "string" && typeof value === "string") ||
      (binding.type === "boolean" && typeof value === "boolean") ||
      (binding.type === "integer" && typeof value === "number" && Number.isSafeInteger(value));
    if (!valid) throw new AICEvidenceCollectionError("tool_mismatch", `MCP header parameter ${binding.path.join(".")} has the wrong type.`);
    headers[`Mcp-Param-${binding.header}`] = encodeHeaderValue(String(value));
  }
  return headers;
}

const SUPPORTED_SCHEMA_KEYS = new Set([
  "$comment",
  "$id",
  "$schema",
  "additionalProperties",
  "const",
  "default",
  "deprecated",
  "description",
  "enum",
  "examples",
  "exclusiveMaximum",
  "exclusiveMinimum",
  "format",
  "items",
  "maxItems",
  "maxLength",
  "maxProperties",
  "maximum",
  "minItems",
  "minLength",
  "minProperties",
  "minimum",
  "multipleOf",
  "pattern",
  "properties",
  "readOnly",
  "required",
  "title",
  "type",
  "uniqueItems",
  "writeOnly",
  "x-mcp-header"
]);

function schemaFailure(message: string): never {
  throw new AICEvidenceCollectionError("tool_mismatch", message);
}

function validateSchemaIntegerKeyword(
  schema: Record<string, unknown>,
  keyword: string,
  minimum = 0
): number | undefined {
  const raw = schema[keyword];
  if (raw === undefined) return undefined;
  if (!Number.isSafeInteger(raw) || Number(raw) < minimum) {
    schemaFailure(`MCP JSON Schema keyword ${keyword} must be a safe integer of at least ${minimum}.`);
  }
  return Number(raw);
}

function validateSimpleJsonSchema(schemaValue: unknown, value: unknown, path = "$", depth = 0): void {
  if (!isJsonValue(value)) schemaFailure(`MCP value at ${path} must contain only JSON data.`);
  if (schemaValue === true) return;
  if (schemaValue === false) schemaFailure(`MCP value at ${path} is rejected by a false schema.`);
  if (!isRecord(schemaValue)) schemaFailure(`MCP JSON Schema at ${path} is not an object or boolean.`);
  if (depth > 32) schemaFailure("MCP JSON Schema exceeds the validation depth limit.");
  for (const keyword of Object.keys(schemaValue)) {
    if (!SUPPORTED_SCHEMA_KEYS.has(keyword) && !keyword.startsWith("x-")) {
      schemaFailure(`MCP JSON Schema at ${path} uses unsupported keyword ${keyword}.`);
    }
  }
  if (schemaValue.enum !== undefined) {
    if (!Array.isArray(schemaValue.enum) || schemaValue.enum.length === 0 || !schemaValue.enum.every(isJsonValue)) {
      schemaFailure(`MCP JSON Schema enum at ${path} must be a non-empty JSON array.`);
    }
    if (!schemaValue.enum.some((item) => createAICEvidenceDigest(item) === createAICEvidenceDigest(value))) {
      schemaFailure(`MCP value at ${path} is outside the schema enum.`);
    }
  }
  if (Object.prototype.hasOwnProperty.call(schemaValue, "const")) {
    if (!isJsonValue(schemaValue.const)) schemaFailure(`MCP JSON Schema const at ${path} must be JSON data.`);
    if (createAICEvidenceDigest(schemaValue.const) !== createAICEvidenceDigest(value)) {
      schemaFailure(`MCP value at ${path} does not match the schema const.`);
    }
  }
  const declaredTypes = Array.isArray(schemaValue.type) ? schemaValue.type : [schemaValue.type];
  const supportedTypes = new Set(["array", "boolean", "integer", "null", "number", "object", "string"]);
  if (
    schemaValue.type !== undefined &&
    (declaredTypes.length === 0 || declaredTypes.some((candidate) => typeof candidate !== "string" || !supportedTypes.has(candidate)))
  ) {
    schemaFailure(`MCP JSON Schema at ${path} declares an unsupported type.`);
  }
  if (declaredTypes.length > 1) {
    const failures: unknown[] = [];
    for (const candidate of declaredTypes) {
      try {
        validateSimpleJsonSchema({ ...schemaValue, type: candidate }, value, path, depth + 1);
        return;
      } catch (error) {
        failures.push(error);
      }
    }
    throw new AggregateError(failures, `MCP value at ${path} does not match any declared type.`);
  }
  const type = declaredTypes[0];
  if (type === "array" && !Array.isArray(value)) schemaFailure(`MCP value at ${path} must be an array.`);
  if (type === "object" && !isRecord(value)) schemaFailure(`MCP value at ${path} must be an object.`);
  if (type === "integer" && !(typeof value === "number" && Number.isSafeInteger(value))) schemaFailure(`MCP value at ${path} must be a safe integer.`);
  if (type === "number" && !(typeof value === "number" && Number.isFinite(value))) schemaFailure(`MCP value at ${path} must be a number.`);
  if (type === "string" && typeof value !== "string") schemaFailure(`MCP value at ${path} must be a string.`);
  if (type === "boolean" && typeof value !== "boolean") schemaFailure(`MCP value at ${path} must be a boolean.`);
  if (type === "null" && value !== null) schemaFailure(`MCP value at ${path} must be null.`);

  if (isRecord(value)) {
    if (schemaValue.properties !== undefined && !isRecord(schemaValue.properties)) {
      schemaFailure(`MCP JSON Schema properties at ${path} must be an object.`);
    }
    const properties = isRecord(schemaValue.properties) ? schemaValue.properties : {};
    if (schemaValue.required !== undefined) {
      if (
        !Array.isArray(schemaValue.required) ||
        !schemaValue.required.every((required) => typeof required === "string") ||
        new Set(schemaValue.required).size !== schemaValue.required.length
      ) {
        schemaFailure(`MCP JSON Schema required at ${path} must contain unique strings.`);
      }
      for (const required of schemaValue.required) {
        if (!Object.prototype.hasOwnProperty.call(value, required)) schemaFailure(`MCP value at ${path} is missing required property ${required}.`);
      }
    }
    if (
      schemaValue.additionalProperties !== undefined &&
      typeof schemaValue.additionalProperties !== "boolean" &&
      !isRecord(schemaValue.additionalProperties)
    ) {
      schemaFailure(`MCP JSON Schema additionalProperties at ${path} must be boolean or a schema.`);
    }
    for (const [key, propertyValue] of Object.entries(value)) {
      if (Object.prototype.hasOwnProperty.call(properties, key)) {
        validateSimpleJsonSchema(properties[key], propertyValue, `${path}.${key}`, depth + 1);
      } else if (schemaValue.additionalProperties === false) {
        schemaFailure(`MCP value at ${path} has unknown property ${key}.`);
      } else if (isRecord(schemaValue.additionalProperties)) {
        validateSimpleJsonSchema(schemaValue.additionalProperties, propertyValue, `${path}.${key}`, depth + 1);
      }
    }
    const minProperties = validateSchemaIntegerKeyword(schemaValue, "minProperties");
    const maxProperties = validateSchemaIntegerKeyword(schemaValue, "maxProperties");
    if (minProperties !== undefined && Object.keys(value).length < minProperties) schemaFailure(`MCP value at ${path} has too few properties.`);
    if (maxProperties !== undefined && Object.keys(value).length > maxProperties) schemaFailure(`MCP value at ${path} has too many properties.`);
  }

  if (Array.isArray(value)) {
    const minItems = validateSchemaIntegerKeyword(schemaValue, "minItems");
    const maxItems = validateSchemaIntegerKeyword(schemaValue, "maxItems");
    if (minItems !== undefined && value.length < minItems) schemaFailure(`MCP value at ${path} has too few items.`);
    if (maxItems !== undefined && value.length > maxItems) schemaFailure(`MCP value at ${path} has too many items.`);
    if (schemaValue.uniqueItems !== undefined && typeof schemaValue.uniqueItems !== "boolean") schemaFailure("MCP JSON Schema uniqueItems must be boolean.");
    if (schemaValue.uniqueItems === true) {
      const digests = value.map((item) => createAICEvidenceDigest(item));
      if (new Set(digests).size !== digests.length) schemaFailure(`MCP value at ${path} must contain unique items.`);
    }
    if (schemaValue.items !== undefined) {
      value.forEach((item, index) => validateSimpleJsonSchema(schemaValue.items, item, `${path}[${index}]`, depth + 1));
    }
  }

  if (typeof value === "string") {
    const minLength = validateSchemaIntegerKeyword(schemaValue, "minLength");
    const maxLength = validateSchemaIntegerKeyword(schemaValue, "maxLength");
    const length = [...value].length;
    if (minLength !== undefined && length < minLength) schemaFailure(`MCP value at ${path} is too short.`);
    if (maxLength !== undefined && length > maxLength) schemaFailure(`MCP value at ${path} is too long.`);
    if (schemaValue.pattern !== undefined) {
      if (typeof schemaValue.pattern !== "string") schemaFailure("MCP JSON Schema pattern must be a string.");
      let pattern: RegExp;
      try {
        pattern = new RegExp(schemaValue.pattern, "u");
      } catch {
        schemaFailure(`MCP JSON Schema pattern at ${path} is invalid.`);
      }
      if (!pattern!.test(value)) schemaFailure(`MCP value at ${path} does not match the schema pattern.`);
    }
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    for (const keyword of ["exclusiveMaximum", "exclusiveMinimum", "maximum", "minimum", "multipleOf"] as const) {
      if (schemaValue[keyword] !== undefined && (typeof schemaValue[keyword] !== "number" || !Number.isFinite(schemaValue[keyword]))) {
        schemaFailure(`MCP JSON Schema keyword ${keyword} must be a finite number.`);
      }
    }
    if (typeof schemaValue.minimum === "number" && value < schemaValue.minimum) schemaFailure(`MCP value at ${path} is below minimum.`);
    if (typeof schemaValue.maximum === "number" && value > schemaValue.maximum) schemaFailure(`MCP value at ${path} exceeds maximum.`);
    if (typeof schemaValue.exclusiveMinimum === "number" && value <= schemaValue.exclusiveMinimum) schemaFailure(`MCP value at ${path} is below exclusiveMinimum.`);
    if (typeof schemaValue.exclusiveMaximum === "number" && value >= schemaValue.exclusiveMaximum) schemaFailure(`MCP value at ${path} exceeds exclusiveMaximum.`);
    if (typeof schemaValue.multipleOf === "number") {
      if (schemaValue.multipleOf <= 0) schemaFailure("MCP JSON Schema multipleOf must be positive.");
      const quotient = value / schemaValue.multipleOf;
      if (Math.abs(quotient - Math.round(quotient)) > Number.EPSILON * Math.max(1, Math.abs(quotient))) schemaFailure(`MCP value at ${path} is not a multipleOf value.`);
    }
  }
}

function normalizeTool(value: unknown): AICMcpToolDefinition {
  if (!isRecord(value) || typeof value.name !== "string" || !value.name || !isRecord(value.inputSchema) || value.inputSchema.type !== "object") {
    throw new AICEvidenceCollectionError("tool_mismatch", "MCP tools/list returned an invalid tool definition.");
  }
  if (value.outputSchema !== undefined && !isRecord(value.outputSchema)) throw new AICEvidenceCollectionError("tool_mismatch", `MCP tool ${value.name} has an invalid output schema.`);
  if (value.annotations !== undefined) {
    if (!isRecord(value.annotations)) throw new AICEvidenceCollectionError("tool_mismatch", `MCP tool ${value.name} has invalid annotations.`);
    for (const field of ["destructiveHint", "idempotentHint", "openWorldHint", "readOnlyHint"] as const) {
      if (value.annotations[field] !== undefined && typeof value.annotations[field] !== "boolean") {
        throw new AICEvidenceCollectionError("tool_mismatch", `MCP tool ${value.name} annotation ${field} must be boolean.`);
      }
    }
    if (value.annotations.title !== undefined && typeof value.annotations.title !== "string") {
      throw new AICEvidenceCollectionError("tool_mismatch", `MCP tool ${value.name} annotation title must be a string.`);
    }
  }
  if (!isJsonValue(value.inputSchema) || (value.outputSchema !== undefined && !isJsonValue(value.outputSchema))) {
    throw new AICEvidenceCollectionError("tool_mismatch", `MCP tool ${value.name} schemas must contain only JSON data.`);
  }
  return value as unknown as AICMcpToolDefinition;
}

function parseSse(text: string, id: number | string): JsonRpcResponse {
  const candidates: JsonRpcResponse[] = [];
  for (const frame of text.split(/\r?\n\r?\n/)) {
    const data = frame
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!data) continue;
    try {
      const parsed = JSON.parse(data) as unknown;
      if (isRecord(parsed) && parsed.id === id) candidates.push(parsed as JsonRpcResponse);
    } catch {
      throw new AICEvidenceCollectionError("response_invalid", "MCP SSE response contains invalid JSON.", { execution: "started" });
    }
  }
  if (candidates.length !== 1) throw new AICEvidenceCollectionError("response_invalid", "MCP SSE response must contain exactly one final response.", { execution: "started" });
  return candidates[0];
}

async function readJsonRpcResponse(
  response: Awaited<ReturnType<AICFetch>>,
  id: number,
  maxBytes: number
): Promise<JsonRpcResponse> {
  if (response.status < 200 || response.status >= 300) {
    throw new AICEvidenceCollectionError("response_invalid", `MCP request returned HTTP ${response.status}.`, { execution: "started" });
  }
  if (response.headers.get("mcp-session-id")) {
    throw new AICEvidenceCollectionError("response_invalid", "MCP 2026-07-28 response unexpectedly created a protocol session.", { execution: "started" });
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > maxBytes) throw new AICEvidenceCollectionError("response_invalid", `MCP response exceeded ${maxBytes} bytes.`, { execution: "started" });
  const text = new TextDecoder().decode(bytes);
  const contentType = response.headers.get("content-type") ?? "";
  let parsed: unknown;
  if (/^text\/event-stream(?:;|$)/i.test(contentType)) parsed = parseSse(text, id);
  else if (/(^|[+/])json(?:;|$)/i.test(contentType)) {
    try {
      parsed = JSON.parse(text);
    } catch (cause) {
      throw new AICEvidenceCollectionError("response_invalid", "MCP response is not valid JSON.", { cause, execution: "started" });
    }
  } else {
    throw new AICEvidenceCollectionError("response_invalid", `MCP response has unsupported content type ${contentType || "none"}.`, { execution: "started" });
  }
  if (!isRecord(parsed) || parsed.jsonrpc !== "2.0" || parsed.id !== id || (parsed.result === undefined && parsed.error === undefined)) {
    throw new AICEvidenceCollectionError("response_invalid", "MCP response is not a matching JSON-RPC response.", { execution: "started" });
  }
  return parsed as JsonRpcResponse;
}

export function createAICMcpStatelessHttpCaller(input: {
  credentials?: AICCredentialResolver;
  endpoint: string;
  fetch: AICFetch;
  headers?: Record<string, AICEvidenceHeaderValue>;
  maxResponseBytes?: number;
  targetOrigin: string;
  timeoutMs?: number;
}): AICMcpCaller {
  const endpoint = assertExactOrigin(input.endpoint, input.targetOrigin);
  let nextId = 1;
  const request = async (method: string, params: Record<string, unknown>, signal: AbortSignal, name?: string, extraHeaders: Record<string, string> = {}): Promise<unknown> => {
    const id = nextId++;
    const customHeaders = await resolveHeaders(input.headers, input.credentials);
    const metadata = {
      "io.modelcontextprotocol/clientCapabilities": {},
      "io.modelcontextprotocol/clientInfo": { name: "@aicorg/evidence-mcp", version: AIC_MCP_EVIDENCE_ADAPTER_VERSION },
      "io.modelcontextprotocol/protocolVersion": AIC_MCP_PROTOCOL_VERSION
    };
    const body = JSON.stringify({
      jsonrpc: "2.0",
      id,
      method,
      params: { ...params, _meta: metadata }
    });
    let response: Awaited<ReturnType<AICFetch>>;
    try {
      response = await input.fetch(endpoint, {
        body,
        headers: {
          accept: "application/json, text/event-stream",
          "content-type": "application/json",
          "Mcp-Method": method,
          ...(name ? { "Mcp-Name": encodeHeaderValue(name) } : {}),
          "MCP-Protocol-Version": AIC_MCP_PROTOCOL_VERSION,
          ...customHeaders,
          ...extraHeaders
        },
        method: "POST",
        redirect: "manual",
        signal: timeoutSignal(input.timeoutMs ?? 10_000, signal)
      });
    } catch (cause) {
      throw new AICEvidenceCollectionError("transport_failed", `MCP ${method} request failed.`, { cause, execution: "started" });
    }
    if (response.status >= 300 && response.status < 400) throw new AICEvidenceCollectionError("target_rejected", `MCP redirect ${response.status} is not allowed.`, { execution: "started" });
    const message = await readJsonRpcResponse(response, id, input.maxResponseBytes ?? 1_048_576);
    if (message.error) throw new AICEvidenceCollectionError("response_invalid", `MCP ${method} returned JSON-RPC error ${message.error.code ?? "unknown"}: ${message.error.message ?? "unknown"}.`, { execution: "started" });
    return message.result;
  };
  return {
    protocolVersion: AIC_MCP_PROTOCOL_VERSION,
    async listTools({ signal }) {
      const tools: AICMcpToolDefinition[] = [];
      let cursor: string | undefined;
      for (let page = 0; page < 20; page += 1) {
        const result = await request("tools/list", cursor ? { cursor } : {}, signal);
        if (!isRecord(result) || !Array.isArray(result.tools)) throw new AICEvidenceCollectionError("response_invalid", "MCP tools/list result is invalid.", { execution: "started" });
        tools.push(...result.tools.map((tool) => normalizeTool(tool)));
        if (result.nextCursor === undefined) return tools;
        if (typeof result.nextCursor !== "string" || !result.nextCursor) throw new AICEvidenceCollectionError("response_invalid", "MCP tools/list cursor is invalid.", { execution: "started" });
        cursor = result.nextCursor;
      }
      throw new AICEvidenceCollectionError("response_invalid", "MCP tools/list exceeded 20 pages.", { execution: "started" });
    },
    async callTool({ arguments: args, signal, tool }) {
      validateSimpleJsonSchema(tool.inputSchema, args);
      const result = await request(
        "tools/call",
        { arguments: args, name: tool.name },
        signal,
        tool.name,
        mcpParameterHeaders(tool, args)
      );
      if (!isRecord(result)) throw new AICEvidenceCollectionError("response_invalid", `MCP tool ${tool.name} returned an invalid result.`, { execution: "started" });
      if (tool.outputSchema) {
        if (!isRecord(result.structuredContent)) throw new AICEvidenceCollectionError("response_invalid", `MCP tool ${tool.name} declares outputSchema but returned no structuredContent.`, { execution: "started" });
        try {
          validateSimpleJsonSchema(tool.outputSchema, result.structuredContent);
        } catch (cause) {
          throw new AICEvidenceCollectionError("response_invalid", `MCP tool ${tool.name} output does not match outputSchema.`, { cause, execution: "started" });
        }
      }
      return result as AICMcpToolResult;
    }
  };
}

export function createAICMcpInjectedCaller(input: AICMcpInjectedCallerInput): AICMcpCaller {
  if (input.protocolVersion !== AIC_MCP_PROTOCOL_VERSION) {
    throw new AICEvidenceCollectionError("tool_mismatch", `Injected MCP caller must pin ${AIC_MCP_PROTOCOL_VERSION}.`);
  }
  return {
    protocolVersion: AIC_MCP_PROTOCOL_VERSION,
    callTool: input.callTool,
    listTools: input.listTools
  };
}

function resultSources(result: AICMcpToolResult): Record<string, unknown> {
  const sources: Record<string, unknown> = {
    "mcp.content": result.content ?? [],
    "mcp.is_error": result.isError === true,
    "mcp.result": result
  };
  if (result.structuredContent !== undefined) sources["mcp.structured_content"] = result.structuredContent;
  const content = result.content ?? [];
  if (content.length === 1 && content[0]?.type === "text" && typeof content[0].text === "string") {
    try {
      sources["mcp.text_json"] = JSON.parse(content[0].text);
    } catch {
      // The source remains absent and any projection that requires it fails closed.
    }
  }
  return sources;
}

function assertToolSafety(input: {
  context: AICEvidenceAdapterExecutionContext;
  mutates: boolean;
  probe: boolean;
  tool: AICMcpToolDefinition;
}): void {
  if ((input.probe || !input.mutates) && input.tool.annotations?.readOnlyHint !== true) {
    throw new AICEvidenceCollectionError("tool_mismatch", `MCP tool ${input.tool.name} must explicitly declare readOnlyHint=true.`);
  }
  if (input.probe && input.tool.annotations?.destructiveHint === true) {
    throw new AICEvidenceCollectionError("tool_mismatch", `MCP probe ${input.tool.name} is destructive.`);
  }
  if (input.mutates && !input.context.allowedMutationOperations.has(input.context.contract.action.operation_id)) {
    throw new AICEvidenceCollectionError("target_rejected", `Mutation is not allowed for ${input.context.contract.action.operation_id}.`);
  }
  if (input.tool.annotations?.destructiveHint === true && !input.context.allowDestructive) {
    throw new AICEvidenceCollectionError("target_rejected", `Destructive MCP tool ${input.tool.name} is not allowed.`);
  }
}

async function callOnce(input: {
  arguments: Record<string, JsonValue>;
  caller: AICMcpCaller;
  context: AICEvidenceAdapterExecutionContext;
  kind: McpTranscript["kind"];
  mutates: boolean;
  timeoutMs: number;
  tool: AICMcpToolDefinition;
}): Promise<{ result: AICMcpToolResult; transcript: McpTranscript }> {
  assertToolSafety({ context: input.context, mutates: input.mutates, probe: input.kind === "probe", tool: input.tool });
  validateSimpleJsonSchema(input.tool.inputSchema, input.arguments);
  let result: AICMcpToolResult;
  try {
    result = await input.caller.callTool({
      arguments: input.arguments,
      signal: timeoutSignal(input.timeoutMs, input.context.signal),
      tool: input.tool
    });
    if (
      !isRecord(result) ||
      !isJsonValue(result) ||
      (result.isError !== undefined && typeof result.isError !== "boolean") ||
      (result.content !== undefined && (!Array.isArray(result.content) || !result.content.every(isRecord))) ||
      (result.structuredContent !== undefined && !isRecord(result.structuredContent))
    ) {
      throw new AICEvidenceCollectionError("response_invalid", `MCP tool ${input.tool.name} returned an invalid result.`, { execution: "started" });
    }
    if (input.tool.outputSchema) {
      if (!isRecord(result.structuredContent)) {
        throw new AICEvidenceCollectionError("response_invalid", `MCP tool ${input.tool.name} declares outputSchema but returned no structuredContent.`, { execution: "started" });
      }
      try {
        validateSimpleJsonSchema(input.tool.outputSchema, result.structuredContent);
      } catch (cause) {
        throw new AICEvidenceCollectionError("response_invalid", `MCP tool ${input.tool.name} output does not match outputSchema.`, { cause, execution: "started" });
      }
    }
  } catch (cause) {
    if (
      cause instanceof AICEvidenceCollectionError &&
      (!input.mutates || cause.execution === "not_started")
    ) {
      throw cause;
    }
    throw new AICEvidenceCollectionError(
      input.mutates ? "outcome_uncertain" : "transport_failed",
      input.mutates
        ? `Mutating MCP tool ${input.tool.name} has an uncertain outcome; it was not retried.`
        : `MCP tool ${input.tool.name} failed.`,
      { cause, execution: input.mutates ? "uncertain" : "started" }
    );
  }
  if (!isRecord(result)) throw new AICEvidenceCollectionError("response_invalid", `MCP tool ${input.tool.name} returned an invalid result.`, { execution: "started" });
  return {
    result,
    transcript: {
      arguments_digest: createAICEvidenceDigest(input.arguments),
      is_error: result.isError === true,
      kind: input.kind,
      result_digest: createAICEvidenceDigest(result),
      tool: {
        ...(input.tool.annotations ? { annotations: input.tool.annotations } : {}),
        input_schema_digest: createAICEvidenceDigest(input.tool.inputSchema),
        name: input.tool.name,
        ...(input.tool.outputSchema ? { output_schema_digest: createAICEvidenceDigest(input.tool.outputSchema) } : {})
      }
    }
  };
}

async function runScenario(input: {
  caller: AICMcpCaller;
  context: AICEvidenceAdapterExecutionContext;
  scenario: AICMcpEvidenceScenarioPlan;
  surface: AICMcpEvidenceSurfacePlan;
  tools: Map<string, AICMcpToolDefinition>;
}): Promise<{ artifact: ReturnType<typeof createAICEvidenceArtifact>; observation: AICBehaviorObservation; requests: number }> {
  const startedAt = input.context.now();
  const transcript: McpTranscript[] = [];
  const probeSources: Record<string, unknown> = {};
  let requests = 0;
  const runProbes = async (phase: "after" | "before") => {
    for (const probe of input.scenario.probes?.filter((candidate) => candidate.phase === phase) ?? []) {
      const tool = input.tools.get(probe.tool_name);
      if (!tool) throw new AICEvidenceCollectionError("tool_mismatch", `MCP probe tool not found: ${probe.tool_name}.`);
      const call = await callOnce({ arguments: probe.arguments, caller: input.caller, context: input.context, kind: "probe", mutates: false, timeoutMs: input.surface.timeout_ms ?? 10_000, tool });
      requests += 1;
      transcript.push(call.transcript);
      for (const [name, value] of Object.entries(resultSources(call.result))) probeSources[`probe.${probe.id}.${name.slice("mcp.".length)}`] = value;
    }
  };
  await runProbes("before");
  const tool = input.tools.get(input.scenario.tool_name);
  if (!tool) throw new AICEvidenceCollectionError("tool_mismatch", `MCP tool not found: ${input.scenario.tool_name}.`);
  const invocation = await callOnce({ arguments: input.scenario.arguments, caller: input.caller, context: input.context, kind: "invocation", mutates: input.scenario.mutates, timeoutMs: input.surface.timeout_ms ?? 10_000, tool });
  requests += 1;
  transcript.push(invocation.transcript);
  await runProbes("after");
  const sources = { ...resultSources(invocation.result), ...probeSources };
  const projectedStatus = evaluateAICEvidenceExpression(input.scenario.projection.status, sources);
  if (invocation.result.isError === true && projectedStatus === "succeeded") {
    throw new AICEvidenceCollectionError("response_invalid", `MCP tool ${tool.name} returned isError=true but projected a succeeded status.`, { execution: "started" });
  }
  const artifact = createAICEvidenceArtifact({
    content: {
      adapter: AIC_MCP_EVIDENCE_ADAPTER_ID,
      protocol_version: AIC_MCP_PROTOCOL_VERSION,
      scenario_id: input.scenario.scenario_id,
      surface_id: input.surface.surface_id,
      target_origin: input.context.targetOrigin,
      transcript
    } as unknown as JsonValue,
    kind: "trace"
  });
  const completedAt = input.context.now();
  return {
    artifact,
    observation: projectAICBehaviorObservation({
      capturedAt: completedAt.toISOString(),
      contract: input.context.contract,
      durationMs: Math.max(0, completedAt.getTime() - startedAt.getTime()),
      environment: {
        adapter: AIC_MCP_EVIDENCE_ADAPTER_ID,
        adapter_version: AIC_MCP_EVIDENCE_ADAPTER_VERSION,
        protocol_version: AIC_MCP_PROTOCOL_VERSION,
        target_origin: input.context.targetOrigin,
        transport: input.caller instanceof Object ? "stateless_or_injected" : "unknown"
      },
      evidence: [{ digest: artifact.digest, kind: "trace", ref: artifact.ref }],
      projection: input.scenario.projection,
      scenarioId: input.scenario.scenario_id,
      sources,
      surfaceId: input.surface.surface_id
    }),
    requests
  };
}

export type AICMcpCallerFactory = (input: {
  context: AICEvidenceAdapterExecutionContext;
  surface: AICMcpEvidenceSurfacePlan;
}) => Promise<AICMcpCaller> | AICMcpCaller;

export async function collectAICMcpEvidence(
  context: AICEvidenceAdapterExecutionContext,
  callerFactory?: AICMcpCallerFactory
): Promise<AICEvidenceAdapterCollection> {
  const surfaces = context.plan.surfaces.filter(
    (surface): surface is AICMcpEvidenceSurfacePlan => surface.adapter === AIC_MCP_EVIDENCE_ADAPTER_ID
  );
  const observations: AICBehaviorObservation[] = [];
  const artifacts = [];
  let requestCount = 0;
  const contractSurfaces = new Map(context.contract.surfaces.map((surface) => [surface.id, surface]));
  for (const surface of surfaces) {
    const contractSurface = contractSurfaces.get(surface.surface_id);
    if (!contractSurface) throw new AICEvidenceCollectionError("plan_invalid", `Unknown MCP evidence surface: ${surface.surface_id}.`);
    const defaultCaller = () => createAICMcpStatelessHttpCaller({
      credentials: context.credentials,
      endpoint: surface.endpoint,
      fetch: context.fetch,
      headers: surface.headers,
      maxResponseBytes: surface.max_response_bytes,
      targetOrigin: context.targetOrigin,
      timeoutMs: surface.timeout_ms
    });
    const caller = callerFactory
      ? await callerFactory({ context, surface })
      : defaultCaller();
    if (caller.protocolVersion !== AIC_MCP_PROTOCOL_VERSION) throw new AICEvidenceCollectionError("tool_mismatch", `MCP caller did not pin ${AIC_MCP_PROTOCOL_VERSION}.`);
    const tools = await caller.listTools({ signal: timeoutSignal(surface.timeout_ms ?? 10_000, context.signal) });
    requestCount += 1;
    const toolsByName = new Map<string, AICMcpToolDefinition>();
    for (const rawTool of tools) {
      const tool = normalizeTool(rawTool);
      if (toolsByName.has(tool.name)) throw new AICEvidenceCollectionError("tool_mismatch", `MCP tools/list returned duplicate tool ${tool.name}.`);
      collectMcpHeaderBindings(tool.inputSchema);
      toolsByName.set(tool.name, tool);
    }
    for (const scenario of surface.scenarios) {
      if (scenario.tool_name !== contractSurface.entrypoint) throw new AICEvidenceCollectionError("plan_invalid", `MCP tool ${scenario.tool_name} does not match surface entrypoint ${contractSurface.entrypoint}.`);
      const result = await runScenario({ caller, context, scenario, surface, tools: toolsByName });
      observations.push(result.observation);
      artifacts.push(result.artifact);
      requestCount += result.requests;
    }
  }
  return {
    adapter: {
      id: AIC_MCP_EVIDENCE_ADAPTER_ID,
      protocol_version: AIC_MCP_PROTOCOL_VERSION,
      version: AIC_MCP_EVIDENCE_ADAPTER_VERSION
    },
    artifacts,
    observations: {
      artifact_type: "aic_behavior_observation_set",
      contract_id: context.contract.id,
      generated_at: context.now().toISOString(),
      observations
    },
    request_count: requestCount
  };
}

export class AICMcpEvidenceAdapter implements AICEvidenceAdapter {
  readonly id = AIC_MCP_EVIDENCE_ADAPTER_ID;
  readonly protocolVersion = AIC_MCP_PROTOCOL_VERSION;
  readonly version = AIC_MCP_EVIDENCE_ADAPTER_VERSION;
  readonly #callerFactory?: AICMcpCallerFactory;

  constructor(options: { callerFactory?: AICMcpCallerFactory } = {}) {
    this.#callerFactory = options.callerFactory;
  }

  collect(context: AICEvidenceAdapterExecutionContext): Promise<AICEvidenceAdapterCollection> {
    return collectAICMcpEvidence(context, this.#callerFactory);
  }
}

export function createAICMcpEvidenceAdapter(options: { callerFactory?: AICMcpCallerFactory } = {}): AICMcpEvidenceAdapter {
  return new AICMcpEvidenceAdapter(options);
}
