import {
  AIC_BOOTSTRAP_PROVIDER_DEFAULT_RETRIES,
  AIC_BOOTSTRAP_PROVIDER_DEFAULT_TIMEOUT_MS,
  AICBootstrapProviderError,
  createModelBootstrapSuggestionProvider,
  type AICBootstrapStructuredModelClient,
  type AICModelBootstrapProviderOptions
} from "@aicorg/ai-bootstrap";
import type { JsonObject, JsonValue } from "@aicorg/spec";

export interface AICHttpStructuredModelClientOptions {
  bearerToken?: string;
  endpoint: string;
  fetchImpl?: typeof fetch;
  headers?: Record<string, string>;
  retries?: number;
  responseSelector?: string;
  timeoutMs?: number;
}

export interface AICHttpBootstrapSuggestionProviderOptions
  extends Omit<AICModelBootstrapProviderOptions, "client">,
    AICHttpStructuredModelClientOptions {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readSelectedValue(payload: unknown, selector: string): unknown {
  return selector.split(".").reduce<unknown>((current, segment) => {
    return isRecord(current) ? current[segment] : undefined;
  }, payload);
}

function extractJsonPayload(payload: unknown, responseSelector?: string): unknown {
  if (responseSelector) {
    const selected = readSelectedValue(payload, responseSelector);

    if (selected === undefined) {
      throw new Error(`Provider response selector "${responseSelector}" did not resolve to a value.`);
    }

    return selected;
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  if (!isRecord(payload)) {
    return payload;
  }

  for (const key of ["json", "output", "data", "result", "suggestions"]) {
    if (payload[key] !== undefined) {
      return payload[key];
    }
  }

  return payload;
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
      message: `Provider request failed with status ${status}.`,
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
      message: "Provider request timed out.",
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
      message: "Provider response did not contain valid JSON.",
      provider,
      retryable: false
    });
  }

  if (error instanceof Error) {
    if (error.message.includes("response selector")) {
      return new AICBootstrapProviderError({
        attempts,
        cause: error,
        cause_message: error.message,
        kind: "invalid_response",
        message: error.message,
        provider,
        retryable: false
      });
    }

    return new AICBootstrapProviderError({
      attempts,
      cause: error,
      cause_message: error.message,
      kind: "network",
      message: "Provider request failed before a response was received.",
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

export function createHttpStructuredModelClient(
  options: AICHttpStructuredModelClientOptions
): AICBootstrapStructuredModelClient {
  const timeoutMs =
    options.timeoutMs && options.timeoutMs > 0
      ? options.timeoutMs
      : AIC_BOOTSTRAP_PROVIDER_DEFAULT_TIMEOUT_MS;
  const retries =
    typeof options.retries === "number" && options.retries >= 0
      ? Math.floor(options.retries)
      : AIC_BOOTSTRAP_PROVIDER_DEFAULT_RETRIES;
  const providerName = `http:${options.endpoint}`;

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
          const response = await (options.fetchImpl ?? fetch)(options.endpoint, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              ...(options.bearerToken ? { authorization: `Bearer ${options.bearerToken}` } : {}),
              ...(options.headers ?? {})
            },
            body: JSON.stringify({
              model: request.model,
              input: request.input,
              schema: request.schema,
              system_prompt: request.system_prompt
            } satisfies JsonObject),
            signal: controller.signal
          });

          if (!response.ok) {
            throw toBootstrapProviderError(providerName, null, attempt, response.status);
          }

          const payload = (await response.json()) as JsonValue;
          return extractJsonPayload(payload, options.responseSelector) as T;
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

export function createHttpBootstrapSuggestionProvider(
  options: AICHttpBootstrapSuggestionProviderOptions
) {
  return createModelBootstrapSuggestionProvider({
    client: createHttpStructuredModelClient(options),
    maxSuggestions: options.maxSuggestions,
    model: options.model,
    providerName: options.providerName ?? `http:${options.model}`,
    systemPrompt: options.systemPrompt
  });
}
