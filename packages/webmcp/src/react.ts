"use client";

import { useEffect, useState, type DependencyList } from "react";
import {
  registerAICWebMCPTool,
  type AICWebMCPError,
  type AICWebMCPReadinessReport,
  type AICWebMCPRegistration,
  type AICWebMCPRegistrationOptions,
  type AICWebMCPToolBinding
} from "./index.js";

export interface AICWebMCPHookOptions extends AICWebMCPRegistrationOptions {
  enabled?: boolean;
}

export interface AICWebMCPHookState {
  error?: AICWebMCPError | Error;
  readiness?: AICWebMCPReadinessReport;
  status: "disabled" | "idle" | "registered" | "registering" | "unsupported";
}

export function useAICWebMCPTool<
  TInput extends Record<string, unknown>,
  TResult
>(
  createBinding: () => AICWebMCPToolBinding<TInput, TResult>,
  dependencies: DependencyList,
  options: AICWebMCPHookOptions = {}
): AICWebMCPHookState {
  const [state, setState] = useState<AICWebMCPHookState>({
    status: options.enabled === false ? "disabled" : "idle"
  });
  const exposedToKey = options.exposedTo?.join("|") ?? "";

  useEffect(() => {
    if (options.enabled === false) {
      setState({ status: "disabled" });
      return;
    }

    let active = true;
    let registration: AICWebMCPRegistration | undefined;
    setState({ status: "registering" });

    void registerAICWebMCPTool(createBinding(), options)
      .then((value) => {
        if (!active) {
          value.dispose();
          return;
        }

        registration = value;
        setState({
          readiness: value.readiness,
          status: value.status
        });
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }

        setState({
          error: error instanceof Error ? error : new Error("WebMCP registration failed."),
          status: "idle"
        });
      });

    return () => {
      active = false;
      registration?.dispose();
    };
    // The caller supplies the binding dependencies, matching React's effect model.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.enabled, options.modelContext, options.requireSupport, options.signal, exposedToKey, ...dependencies]);

  return state;
}
