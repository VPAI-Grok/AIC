import {
  AIC_BOOTSTRAP_PROVIDER_DEFAULT_RETRIES,
  AIC_BOOTSTRAP_PROVIDER_DEFAULT_TIMEOUT_MS,
  AICBootstrapProviderError,
  createModelBootstrapSuggestionProvider,
  type AICBootstrapStructuredModelClient,
  type AICModelBootstrapProviderOptions
} from "@aicorg/ai-bootstrap";
import type { JsonObject, JsonValue } from "@aicorg/spec";

export interface AICOpenAIStructuredModelClientOptions {
  apiKey?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  headers?: Record<string, string>;
  maxOutputTokens?: number;
  organization?: string;
  project?: string;
  retries?: number;
  schemaName?: string;
  timeoutMs?: number;
}

export interface AICOpenAIBootstrapSuggestionProviderOptions
  extends Omit<AICModelBootstrapProviderOptions, "client">,
    AICOpenAIStructuredModelClientOptions {}

type OpenAITextContentItem = {
  text?: string;
  type?: string;
};

type OpenAIOutputItem = {
  content?: unknown[];
  refusal?: string;
  type?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function resolveBaseUrl(baseUrl: string | undefined): string {
  return (baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
}

function extractOutputText(payload: unknown): string {
  if (!isRecord(payload)) {
    throw new AICBootstrapProviderError({
      kind: "invalid_response",
      message: "OpenAI response payload was not an object.",
      provider: "openai",
      retryable: false
    });
  }

  if (typeof payload.output_text === "string" && payload.output_text.trim().length > 0) {
    return payload.output_text;
  }

  if (Array.isArray(payload.output)) {
    for (const item of payload.output as OpenAIOutputItem[]) {
      if (typeof item.refusal === "string" && item.refusal.length > 0) {
        throw new AICBootstrapProviderError({
          cause_message: item.refusal,
          kind: "model_refusal",
          message: "OpenAI model refused structured output.",
          provider: "openai",
          retryable: false
        });
      }

      if (!Array.isArray(item.content)) {
        continue;
      }

      for (const contentItem of item.content as OpenAITextContentItem[]) {
        if (typeof contentItem.text === "string" && contentItem.text.trim().length > 0) {
          return contentItem.text;
        }
      }
    }
  }

  throw new AICBootstrapProviderError({
    kind: "invalid_response",
    message: "OpenAI response did not include output_text.",
    provider: "openai",
    retryable: false
  });
}

function classifyStatus(status: number): {
  kind: AICBootstrapProviderError["kind"];
  retryable: boolean;
} {
  if (status === 429) {
    return {
      kind: "rate_limit",
      retryable: true
    };
  }

  if (status === 401 || status === 403) {
    return {
      kind: "auth",
      retryable: false
    };
  }

  if (status >= 500) {
    return {
      kind: "server",
      retryable: true
    };
  }

  return {
    kind: "client",
    retryable: false
  };
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof DOMException
      ? error.name === "AbortError"
      : error instanceof Error && error.name === "AbortError"
  );
}

function toBootstrapProviderError(
  provider: string,
  error: unknown,
  attempts: number,
  status?: number
): AICBootstrapProviderError {
  if (error instanceof AICBootstrapProviderError) {
    return new AICBootstrapProviderError({
      attempts,
      cause: error,
      cause_message: error.cause_message ?? error.message,
      kind: error.kind,
      message: error.message,
      provider,
      retryable: error.retryable,
      status: error.status ?? status
    });
  }

  if (status !== undefined) {
    const classified = classifyStatus(status);
    return new AICBootstrapProviderError({
      attempts,
      cause: error,
      cause_message: error instanceof Error ? error.message : undefined,
      kind: classified.kind,
      message: `OpenAI provider request failed with status ${status}.`,
      provider,
      retryable: classified.retryable,
      status
    });
  }

  if (isAbortError(error)) {
    return new AICBootstrapProviderError({
      attempts,
      cause: error,
      cause_message: error instanceof Error ? error.message : undefined,
      kind: "timeout",
      message: "OpenAI provider request timed out.",
      provider,
      retryable: true
    });
  }

  if (error instanceof SyntaxError) {
    return new AICBootstrapProviderError({
      attempts,
      cause: error,
      cause_message: error.message,
      kind: "invalid_json",
      message: "OpenAI response did not contain valid JSON.",
      provider,
      retryable: false
    });
  }

  if (error instanceof Error) {
    return new AICBootstrapProviderError({
      attempts,
      cause: error,
      cause_message: error.message,
      kind: "network",
      message: "OpenAI provider request failed before a response was received.",
      provider,
      retryable: true
    });
  }

  return new AICBootstrapProviderError({
    attempts,
    kind: "unknown",
    message: "Unknown provider failure.",
    provider,
    retryable: false
  });
}

export function createOpenAIStructuredModelClient(
  options: AICOpenAIStructuredModelClientOptions = {}
): AICBootstrapStructuredModelClient {
  const timeoutMs =
    options.timeoutMs && options.timeoutMs > 0
      ? options.timeoutMs
      : AIC_BOOTSTRAP_PROVIDER_DEFAULT_TIMEOUT_MS;
  const retries =
    typeof options.retries === "number" && options.retries >= 0
      ? Math.floor(options.retries)
      : AIC_BOOTSTRAP_PROVIDER_DEFAULT_RETRIES;
  const providerName = options.baseUrl ? `openai:${resolveBaseUrl(options.baseUrl)}` : "openai";

  return {
    async completeJson<T>(request: {
      input: JsonObject;
      model: string;
      schema: JsonObject;
      system_prompt: string;
    }) {
      const maxAttempts = retries + 1;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
          const response = await (options.fetchImpl ?? fetch)(`${resolveBaseUrl(options.baseUrl)}/responses`, {
            method: "POST",
            headers: {
              authorization: `Bearer ${options.apiKey ?? ""}`,
              "content-type": "application/json",
              ...(options.organization ? { "OpenAI-Organization": options.organization } : {}),
              ...(options.project ? { "OpenAI-Project": options.project } : {}),
              ...(options.headers ?? {})
            },
            body: JSON.stringify({
              model: request.model,
              input: [
                {
                  role: "system",
                  content: request.system_prompt
                },
                {
                  role: "user",
                  content: JSON.stringify(request.input)
                }
              ],
              ...(options.maxOutputTokens ? { max_output_tokens: options.maxOutputTokens } : {}),
              text: {
                format: {
                  type: "json_schema",
                  name: options.schemaName ?? "aic_bootstrap_suggestions",
                  schema: request.schema,
                  strict: true
                }
              }
            } satisfies JsonObject),
            signal: controller.signal
          });

          if (!response.ok) {
            throw toBootstrapProviderError(providerName, null, attempt, response.status);
          }

          const payload = (await response.json()) as JsonValue;
          return JSON.parse(extractOutputText(payload)) as T;
        } catch (error) {
          const normalized =
            error instanceof AICBootstrapProviderError &&
            error.provider === providerName &&
            error.attempts === attempt
              ? error
              : toBootstrapProviderError(providerName, error, attempt);

          if (normalized.retryable && attempt < maxAttempts) {
            continue;
          }

          throw normalized;
        } finally {
          clearTimeout(timeoutId);
        }
      }

      throw new AICBootstrapProviderError({
        attempts: maxAttempts,
        kind: "unknown",
        message: "Unknown provider failure.",
        provider: providerName,
        retryable: false
      });
    }
  };
}

export function createOpenAIBootstrapSuggestionProvider(
  options: AICOpenAIBootstrapSuggestionProviderOptions
) {
  return createModelBootstrapSuggestionProvider({
    client: createOpenAIStructuredModelClient(options),
    maxSuggestions: options.maxSuggestions,
    model: options.model,
    providerName: options.providerName ?? `openai:${options.model}`,
    systemPrompt: options.systemPrompt
  });
}
