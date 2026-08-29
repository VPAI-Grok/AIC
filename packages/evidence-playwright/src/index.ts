import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

export type AICWebMCPArgumentEncoding = "json_string_compat" | "object_native";

export interface AICBrowserEvidenceMetadata {
  api: "document.modelContext";
  browser_name: string;
  browser_version: string;
  feature_mode: "ambient" | "testing_flag";
  headless: boolean;
  runner: "@aicorg/evidence-playwright";
}

export interface AICBrowserEvidenceSession {
  browser: Browser;
  metadata: AICBrowserEvidenceMetadata;
  newContext(): Promise<BrowserContext>;
}

export interface AICNativeWebMCPToolSummary {
  description?: string;
  name: string;
  title?: string;
}

export interface AICNativeWebMCPInspection {
  api: "document.modelContext";
  available: boolean;
  execute_tool: boolean;
  get_tools: boolean;
  secure_context: boolean;
  tools: AICNativeWebMCPToolSummary[];
}

export interface AICNativeWebMCPExecutionResult<TResult = unknown> {
  argument_encoding: AICWebMCPArgumentEncoding;
  result: TResult;
  tool_name: string;
}

export interface LaunchAICBrowserEvidenceOptions {
  channel?: "chrome" | "msedge";
  enableWebMCPTesting?: boolean;
  executablePath?: string;
  headless?: boolean;
  launchArgs?: string[];
}

function browserName(version: string, channel: string | undefined): string {
  if (channel === "msedge" || /edge/i.test(version)) return "Microsoft Edge";
  if (channel === "chrome" || /chrome|chromium/i.test(version)) return "Google Chrome";
  return "Chromium";
}

export async function launchAICBrowserEvidence(
  options: LaunchAICBrowserEvidenceOptions = {}
): Promise<AICBrowserEvidenceSession> {
  const headless = options.headless ?? true;
  const enableWebMCPTesting = options.enableWebMCPTesting ?? true;
  const launchArgs = [...(options.launchArgs ?? [])];
  if (enableWebMCPTesting) {
    launchArgs.push("--enable-features=WebMCPTesting,DevToolsWebMCPSupport");
  }
  const browser = await chromium.launch({
    ...(options.channel && !options.executablePath ? { channel: options.channel } : {}),
    ...(options.executablePath ? { executablePath: options.executablePath } : {}),
    args: [...new Set(launchArgs)],
    headless
  });
  const version = browser.version();
  return {
    browser,
    metadata: {
      api: "document.modelContext",
      browser_name: browserName(version, options.channel),
      browser_version: version,
      feature_mode: enableWebMCPTesting ? "testing_flag" : "ambient",
      headless,
      runner: "@aicorg/evidence-playwright"
    },
    newContext: () => browser.newContext()
  };
}

export async function inspectNativeWebMCP(page: Page): Promise<AICNativeWebMCPInspection> {
  return page.evaluate(async () => {
    const modelContext = (document as Document & {
      modelContext?: {
        executeTool?: unknown;
        getTools?: () => Promise<Array<{ description?: string; name: string; title?: string }>>;
      };
    }).modelContext;
    const getTools = typeof modelContext?.getTools === "function";
    const tools = getTools ? await modelContext.getTools?.() : [];
    return {
      api: "document.modelContext" as const,
      available: Boolean(modelContext),
      execute_tool: typeof modelContext?.executeTool === "function",
      get_tools: getTools,
      secure_context: window.isSecureContext,
      tools: (tools ?? []).map((tool) => ({
        ...(tool.description ? { description: tool.description } : {}),
        name: tool.name,
        ...(tool.title ? { title: tool.title } : {})
      }))
    };
  });
}

async function executeNativeTool<TResult>(
  page: Page,
  toolName: string,
  input: Record<string, unknown>,
  argumentEncoding: AICWebMCPArgumentEncoding
): Promise<TResult> {
  return page.evaluate(
    async ({ argumentEncoding, input, toolName }) => {
      const modelContext = (document as Document & {
        modelContext?: {
          executeTool?: (tool: unknown, input: unknown) => Promise<unknown>;
          getTools?: () => Promise<Array<{ name: string }>>;
        };
      }).modelContext;
      if (!modelContext || typeof modelContext.getTools !== "function" || typeof modelContext.executeTool !== "function") {
        throw new Error("Native document.modelContext getTools/executeTool is unavailable.");
      }
      const tools = await modelContext.getTools();
      const tool = tools.find((candidate) => candidate.name === toolName);
      if (!tool) throw new Error(`Native WebMCP tool not found: ${toolName}.`);
      const encodedInput = argumentEncoding === "json_string_compat" ? JSON.stringify(input) : input;
      return modelContext.executeTool(tool, encodedInput);
    },
    { argumentEncoding, input, toolName }
  ) as Promise<TResult>;
}

export async function probeNativeWebMCPArgumentEncoding(input: {
  input: Record<string, unknown>;
  page: Page;
  readOnlyConfirmed: true;
  toolName: string;
}): Promise<AICNativeWebMCPExecutionResult> {
  if (input.readOnlyConfirmed !== true) {
    throw new Error("Argument encoding probes may run only against a confirmed read-only tool.");
  }
  try {
    return {
      argument_encoding: "object_native",
      result: await executeNativeTool(input.page, input.toolName, input.input, "object_native"),
      tool_name: input.toolName
    };
  } catch (objectError) {
    try {
      return {
        argument_encoding: "json_string_compat",
        result: await executeNativeTool(input.page, input.toolName, input.input, "json_string_compat"),
        tool_name: input.toolName
      };
    } catch (stringError) {
      throw new AggregateError(
        [objectError, stringError],
        `Native WebMCP rejected object and JSON-string input for read-only probe tool ${input.toolName}.`
      );
    }
  }
}

export async function executeNativeWebMCPTool<TResult = unknown>(input: {
  argumentEncoding: AICWebMCPArgumentEncoding;
  input: Record<string, unknown>;
  page: Page;
  toolName: string;
}): Promise<AICNativeWebMCPExecutionResult<TResult>> {
  return {
    argument_encoding: input.argumentEncoding,
    result: await executeNativeTool<TResult>(
      input.page,
      input.toolName,
      input.input,
      input.argumentEncoding
    ),
    tool_name: input.toolName
  };
}

export type { Browser, BrowserContext, Page } from "playwright";
