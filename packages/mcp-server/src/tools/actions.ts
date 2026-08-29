import { z } from "zod";
import { validateSemanticActionsManifest } from "@aicorg/spec";
import {
  fetchDiscovery,
  fetchManifest,
  resolveEndpointUrl
} from "../fetch-manifest.js";
import type { AICSemanticActionsManifest } from "@aicorg/spec";

export const actionsToolName = "get_aic_actions";

export const actionsToolDescription =
  "Get the semantic action contracts for an AIC-instrumented web app. " +
  "Semantic actions are app-level operations (like 'submit_order' or 'archive_customer') " +
  "with structured contracts including preconditions, postconditions, side effects, " +
  "failure modes, undo capabilities, idempotency guarantees, batch configuration, " +
  "estimated latency, completion signals, execution readiness, and dry-run support. " +
  "Review-required actions are descriptive contracts and must not be treated as executable authority. " +
  "These are safer abstractions than replaying raw UI clicks. " +
  "Optionally filter to a single action by name.";

export const actionsToolSchema = {
  base_url: z
    .string()
    .describe("Base URL of the AIC-instrumented web app (e.g. http://localhost:3000)"),
  action_name: z
    .string()
    .optional()
    .describe("Optional: return only the action contract with this name")
};

export async function handleActions(args: {
  base_url: string;
  action_name?: string;
}): Promise<string> {
  const discovery = await fetchDiscovery(args.base_url);

  const actionsUrl = discovery.ok
    ? resolveEndpointUrl(
        args.base_url,
        discovery.data.endpoints?.actions,
        "/.well-known/agent/actions"
      )
    : resolveEndpointUrl(args.base_url, undefined, "/.well-known/agent/actions");

  const result = await fetchManifest<AICSemanticActionsManifest>(actionsUrl);

  if (!result.ok) {
    return JSON.stringify({
      success: false,
      error: result.error,
      hint: "Actions manifest may not be configured. The app may not define semantic action contracts."
    });
  }

  const validation = validateSemanticActionsManifest(result.data);
  let actions = result.data.actions ?? [];

  if (args.action_name) {
    actions = actions.filter((a) => a.name === args.action_name);

    if (actions.length === 0) {
      const available = (result.data.actions ?? []).map((a) => a.name);
      return JSON.stringify({
        success: false,
        error: `Action "${args.action_name}" not found.`,
        available_actions: available
      });
    }
  }

  return JSON.stringify({
    success: true,
    action_count: actions.length,
    actions: actions.map((a) => ({
      name: a.name,
      title: a.title,
      target: a.target,
      preconditions: a.preconditions,
      postconditions: a.postconditions,
      side_effects: a.side_effects,
      failure_modes: a.failure_modes,
      idempotent: a.idempotent,
      undoable: a.undoable,
      undo_action: a.undo_action ?? null,
      undo_window_seconds: a.undo_window_seconds ?? null,
      estimated_latency_ms: a.estimated_latency_ms,
      execution_readiness: a.execution_readiness ?? {
        status: "review_required",
        source: "inferred",
        blockers: ["Legacy action contract has no explicit execution-readiness declaration."]
      },
      completion_signal: a.completion_signal,
      supports_dry_run: a.supports_dry_run ?? false,
      dry_run_action: a.dry_run_action ?? null,
      batch: a.batch ?? null
    })),
    validation: {
      valid: validation.ok,
      issues: validation.issues.length > 0 ? validation.issues : undefined
    }
  });
}
