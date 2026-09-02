/**
 * A minimal, clearly-labelled `document.modelContext` stand-in for browsers
 * that do not expose WebMCP.
 *
 * Why a shim rather than a mocked demo: every line of AIC's gating, and the
 * ungoverned control arm, run unchanged against this object. Only the browser
 * plumbing is substituted, so what a visitor sees is the real adapter making
 * the real decision. The page states which mode it is in, and the executed
 * evidence in `aic-injection-result.json` is recorded against native Chrome
 * only — `verify-injection.mjs` fails if it ever sees this shim.
 *
 * It installs only when the native API is absent and never overwrites it.
 */

const SHIM_FLAG = "__aicDemoModelContextShim";

export function installDemoModelContext() {
  if (typeof document === "undefined") {
    return "unsupported";
  }

  const target = /** @type {any} */ (document);

  if (target.modelContext && !target.modelContext[SHIM_FLAG]) {
    return "native";
  }

  if (target.modelContext?.[SHIM_FLAG]) {
    return "shim";
  }

  const tools = new Map();

  target.modelContext = {
    [SHIM_FLAG]: true,

    addEventListener() {
      // The demo re-renders on React state, so tool-change events are unused.
    },

    async executeTool(tool, inputJson) {
      const name = typeof tool === "string" ? tool : tool?.name;
      const entry = tools.get(name);
      if (!entry) {
        throw new Error(`Tool not found: ${name}`);
      }

      // Native Chrome hands `execute` a parsed object while `executeTool`
      // takes a JSON string. Mirror that asymmetry so the shim exercises the
      // same encoding path the real API does.
      const input = typeof inputJson === "string" ? JSON.parse(inputJson || "{}") : inputJson ?? {};
      return entry.execute(input, { signal: new AbortController().signal });
    },

    async getTools() {
      return [...tools.values()].map(({ execute, ...descriptor }) => descriptor);
    },

    async registerTool(descriptor, options = {}) {
      if (options.signal?.aborted) {
        throw new DOMException("Registration aborted.", "AbortError");
      }

      tools.set(descriptor.name, descriptor);

      options.signal?.addEventListener("abort", () => {
        tools.delete(descriptor.name);
      });
    }
  };

  return "shim";
}

export function modelContextMode() {
  if (typeof document === "undefined") {
    return "unsupported";
  }

  const target = /** @type {any} */ (document);
  if (!target.modelContext) return "unsupported";
  return target.modelContext[SHIM_FLAG] ? "shim" : "native";
}
