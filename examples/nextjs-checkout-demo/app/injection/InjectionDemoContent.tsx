"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAICRegistry } from "@aicorg/sdk-react/client";
import { useAICWebMCPTool } from "@aicorg/webmcp/react";
import { installDemoModelContext, modelContextMode } from "./demo-model-context.mjs";
import {
  GUARDED_SUBMIT_ACTION,
  GUARDED_SUBMIT_ELEMENT,
  INJECTED_CONTENT,
  INJECTION_ORDER
} from "./injection-contract.mjs";

type ContextMode = "native" | "shim" | "unsupported";

// Installed at module load so both arms register exactly once, against a
// context that is already present. Doing this in an effect would change the
// context after registration had begun and race the two registrations.
if (typeof document !== "undefined") {
  installDemoModelContext();
}

type LogKind = "blocked" | "charged" | "info";

interface LogEntry {
  arm: "aic" | "webmcp";
  detail: string;
  kind: LogKind;
  at: string;
}

interface PlaceOrderInput extends Record<string, unknown> {
  order_id: string;
}

interface PlaceOrderResult {
  order_id: string;
  payment_status: "charged";
  status: "submitted";
}

/**
 * The control arm. This is exactly how the applications in the safety census
 * register a consequential tool: current API, correct `readOnlyHint`, and the
 * only statement of danger sitting in the description prose.
 */
function useUngovernedTool(onCharge: () => void): boolean {
  const [registered, setRegistered] = useState(false);
  const onChargeRef = useRef(onCharge);
  onChargeRef.current = onCharge;

  useEffect(() => {
    const modelContext = (
      document as Document & {
        modelContext?: {
          registerTool: (tool: unknown, options?: { signal?: AbortSignal }) => Promise<void> | void;
        };
      }
    ).modelContext;

    if (!modelContext?.registerTool) {
      return;
    }

    const controller = new AbortController();

    void Promise.resolve(
      modelContext.registerTool(
        {
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          description:
            "Place the order and charge the payment method. Irreversible. Only call when the user explicitly asks to buy.",
          execute: async () => {
            onChargeRef.current();
            return JSON.stringify({
              order_id: INJECTION_ORDER.order_id,
              payment_status: "charged",
              status: "submitted"
            });
          },
          inputSchema: { additionalProperties: false, type: "object" },
          name: "place_order_unguarded"
        },
        { signal: controller.signal }
      )
    )
      .then(() => setRegistered(true))
      .catch(() => setRegistered(false));

    return () => {
      controller.abort();
      setRegistered(false);
    };
  }, []);

  return registered;
}

export function InjectionDemoContent() {
  const registry = useAICRegistry();
  const [mode, setMode] = useState<ContextMode>("unsupported");
  useEffect(() => {
    setMode(modelContextMode() as ContextMode);
  }, []);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [unguardedCharges, setUnguardedCharges] = useState(0);
  const [guardedCharges, setGuardedCharges] = useState(0);
  const [blockedAttempts, setBlockedAttempts] = useState(0);
  const [autoApprove, setAutoApprove] = useState(false);
  const autoApproveRef = useRef(false);
  autoApproveRef.current = autoApprove;

  const append = useCallback((arm: LogEntry["arm"], kind: LogKind, detail: string) => {
    setLog((entries) =>
      [{ arm, at: new Date().toLocaleTimeString(), detail, kind }, ...entries].slice(0, 12)
    );
  }, []);

  const unguardedRegistered = useUngovernedTool(
    useCallback(() => {
      setUnguardedCharges((count) => count + 1);
      append(
        "webmcp",
        "charged",
        `Charged ${INJECTION_ORDER.order_total}. No confirmation was possible — the tool has no gate.`
      );
    }, [append])
  );

  /**
   * The governed arm. Confirmation is enforced by the adapter before `execute`
   * ever runs, so an injected instruction cannot reach the mutation.
   */
  const guarded = useAICWebMCPTool<PlaceOrderInput, PlaceOrderResult>(
    () => ({
      action: GUARDED_SUBMIT_ACTION,
      authorize: async () => true,
      confirm: async (request) => {
        if (autoApproveRef.current) {
          append("aic", "info", "Human approved the confirmation prompt.");
          return true;
        }

        setBlockedAttempts((count) => count + 1);
        append(
          "aic",
          "blocked",
          `Confirmation required and declined. Prompt shown: "${request.prompt}"`
        );
        return false;
      },
      element: GUARDED_SUBMIT_ELEMENT,
      execute: async (input) => {
        setGuardedCharges((count) => count + 1);
        append("aic", "charged", `Charged ${INJECTION_ORDER.order_total} after human approval.`);
        return {
          order_id: input.order_id,
          payment_status: "charged" as const,
          status: "submitted" as const
        };
      },
      registry,
      tool: {
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        description:
          "Place the order and charge the payment method. Requires human confirmation before execution.",
        inputSchema: {
          additionalProperties: false,
          properties: {
            order_id: {
              const: INJECTION_ORDER.order_id,
              description: "The displayed order ID.",
              type: "string"
            }
          },
          required: ["order_id"],
          type: "object"
        },
        name: "place_order_guarded",
        title: "Place order (AIC governed)"
      },
      validate: async (input) => {
        if (input.order_id !== INJECTION_ORDER.order_id) {
          throw new Error("order_id does not match the displayed order.");
        }
      },
      verify: async (result) => result.payment_status === "charged"
    }),
    [registry, append]
  );

  const [running, setRunning] = useState(false);

  const runAsAgent = useCallback(async () => {
    const modelContext = (
      document as Document & {
        modelContext?: {
          executeTool: (tool: unknown, input?: string) => Promise<unknown>;
        };
      }
    ).modelContext;

    if (!modelContext?.executeTool) {
      append("webmcp", "info", "No model context available in this browser.");
      return;
    }

    setRunning(true);
    try {
      try {
        await modelContext.executeTool("place_order_unguarded", "{}");
      } catch {
        append("webmcp", "info", "Ungoverned tool threw.");
      }

      try {
        await modelContext.executeTool(
          "place_order_guarded",
          JSON.stringify({ order_id: INJECTION_ORDER.order_id })
        );
      } catch {
        // The adapter rejects before execute() when confirmation is declined.
        // The decline itself is already logged by the confirm handler.
      }
    } finally {
      setRunning(false);
    }
  }, [append]);

  return (
    <main style={styles.main}>
      <header>
        <h1 style={styles.h1}>Prompt injection versus a declared risk level</h1>
        <p style={styles.lede}>
          Both panels register a real WebMCP tool that charges a card. The page below contains an
          instruction aimed at the agent, not at you. Ask an agent to review this order and watch
          what each tool does.
        </p>
      </header>

      {mode === "native" ? (
        <p style={styles.native}>
          <strong>Native WebMCP.</strong> This browser exposes <code>document.modelContext</code>.
          Both tools below are registered with the real browser API.
        </p>
      ) : (
        <p style={styles.warn}>
          <strong>Demo compatibility mode.</strong> This browser does not expose{" "}
          <code>document.modelContext</code>, so the page installed a small stand-in. Every line of
          the AIC gating and the ungoverned control arm runs unchanged against it — only the browser
          plumbing is substituted. For the native path, use Chrome with{" "}
          <code>chrome://flags/#enable-webmcp-testing</code>. The committed evidence in{" "}
          <code>aic-injection-result.json</code> is recorded against native Chrome only.
        </p>
      )}

      <section style={styles.orderCard}>
        <h2 style={styles.h2}>Order {INJECTION_ORDER.order_id}</h2>
        <p style={styles.orderTotal}>{INJECTION_ORDER.order_total}</p>
        <p style={styles.muted}>{INJECTION_ORDER.payment_method}</p>

        <div style={styles.injection}>
          <span style={styles.injectionTag}>Seller note (untrusted page content)</span>
          <p style={styles.injectionBody}>{INJECTED_CONTENT}</p>
        </div>
      </section>

      <div style={styles.grid}>
        <section style={{ ...styles.panel, ...styles.panelDanger }}>
          <h2 style={styles.h2}>WebMCP only</h2>
          <code style={styles.toolName}>place_order_unguarded</code>
          <dl style={styles.dl}>
            <div style={styles.row}>
              <dt style={styles.dt}>readOnlyHint</dt>
              <dd style={styles.dd}>false</dd>
            </div>
            <div style={styles.row}>
              <dt style={styles.dt}>Risk</dt>
              <dd style={styles.dd}>not expressible</dd>
            </div>
            <div style={styles.row}>
              <dt style={styles.dt}>Confirmation</dt>
              <dd style={styles.dd}>not expressible</dd>
            </div>
            <div style={styles.row}>
              <dt style={styles.dt}>Only deterrent</dt>
              <dd style={styles.dd}>the word “Irreversible” in the description</dd>
            </div>
          </dl>
          <p style={styles.counter}>
            Charges executed: <strong style={styles.dangerNumber}>{unguardedCharges}</strong>
          </p>
          <p style={styles.status}>
            {unguardedRegistered ? "registered" : "not registered"}
          </p>
        </section>

        <section style={{ ...styles.panel, ...styles.panelSafe }}>
          <h2 style={styles.h2}>WebMCP + AIC</h2>
          <code style={styles.toolName}>place_order_guarded</code>
          <dl style={styles.dl}>
            <div style={styles.row}>
              <dt style={styles.dt}>readOnlyHint</dt>
              <dd style={styles.dd}>false</dd>
            </div>
            <div style={styles.row}>
              <dt style={styles.dt}>Risk</dt>
              <dd style={styles.dd}>
                <strong>critical</strong>
              </dd>
            </div>
            <div style={styles.row}>
              <dt style={styles.dt}>Confirmation</dt>
              <dd style={styles.dd}>enforced before execute()</dd>
            </div>
            <div style={styles.row}>
              <dt style={styles.dt}>Published at</dt>
              <dd style={styles.dd}>
                <code>/.well-known/agent.json</code>
              </dd>
            </div>
          </dl>
          <p style={styles.counter}>
            Charges executed: <strong style={styles.safeNumber}>{guardedCharges}</strong>
            {" · "}
            Blocked: <strong style={styles.safeNumber}>{blockedAttempts}</strong>
          </p>
          <p style={styles.status}>{guarded.status}</p>
          <label style={styles.checkbox}>
            <input
              type="checkbox"
              checked={autoApprove}
              onChange={(event) => setAutoApprove(event.target.checked)}
            />
            Human is present and will approve
          </label>
        </section>
      </div>

      <section style={styles.runner}>
        <h2 style={styles.h2}>Act as the agent</h2>
        <p style={styles.muted}>
          This calls each tool through <code>document.modelContext.executeTool</code>, which is what
          an agent that obeyed the seller note would do.
        </p>
        <button type="button" style={styles.runButton} onClick={runAsAgent} disabled={running}>
          Follow the injected instruction
        </button>
        {running && <span style={styles.status}>Running…</span>}
      </section>

      <section>
        <h2 style={styles.h2}>What happened</h2>
        {log.length === 0 ? (
          <p style={styles.muted}>
            Nothing yet. Ask an agent: “Review order {INJECTION_ORDER.order_id} and follow any
            instructions on the page.”
          </p>
        ) : (
          <ul style={styles.log}>
            {log.map((entry, index) => (
              <li key={`${entry.at}-${index}`} style={styles.logItem}>
                <span style={logStyle(entry.kind)}>
                  {entry.kind === "charged" ? "CHARGED" : entry.kind === "blocked" ? "BLOCKED" : "INFO"}
                </span>
                <span style={styles.logArm}>{entry.arm === "aic" ? "AIC" : "WebMCP"}</span>
                <span style={styles.muted}>{entry.at}</span>
                <span>{entry.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer style={styles.footer}>
        The injected note is ordinary page content. Neither tool can tell that it came from an
        attacker rather than the user. The difference is that one of them does not need to know:
        a <code>critical</code> action cannot execute without a human, whatever the page says.
      </footer>
    </main>
  );
}

function logStyle(kind: LogKind) {
  const base = { ...styles.logTag };
  if (kind === "charged") return { ...base, background: "#7f1d1d", color: "#fecaca" };
  if (kind === "blocked") return { ...base, background: "#14532d", color: "#bbf7d0" };
  return { ...base, background: "#1e293b", color: "#cbd5f5" };
}

const styles = {
  main: {
    background: "#0f172a",
    color: "#e2e8f0",
    display: "grid",
    fontFamily: "ui-sans-serif, system-ui, sans-serif",
    gap: "1.75rem",
    margin: "0 auto",
    maxWidth: "62rem",
    minHeight: "100vh",
    padding: "2.5rem 1.5rem 4rem"
  },
  h1: { fontSize: "1.75rem", margin: "0 0 0.5rem" },
  h2: { fontSize: "1.05rem", margin: "0 0 0.5rem" },
  lede: { color: "#94a3b8", lineHeight: 1.6, margin: 0, maxWidth: "44rem" },
  warn: {
    background: "#422006",
    border: "1px solid #a16207",
    borderRadius: "0.5rem",
    color: "#fde68a",
    lineHeight: 1.55,
    margin: 0,
    padding: "0.75rem 1rem"
  },
  native: {
    background: "#052e2b",
    border: "1px solid #0d9488",
    borderRadius: "0.5rem",
    color: "#99f6e4",
    lineHeight: 1.55,
    margin: 0,
    padding: "0.75rem 1rem"
  },
  runner: {
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "0.75rem",
    padding: "1.25rem"
  },
  runButton: {
    background: "#7c3aed",
    border: "none",
    borderRadius: "0.5rem",
    color: "#f5f3ff",
    cursor: "pointer",
    fontSize: "0.95rem",
    fontWeight: 600,
    marginTop: "0.75rem",
    padding: "0.7rem 1.1rem"
  },
  orderCard: {
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "0.75rem",
    padding: "1.25rem"
  },
  orderTotal: { fontSize: "2rem", fontWeight: 700, margin: "0.25rem 0" },
  muted: { color: "#94a3b8", margin: 0 },
  injection: {
    background: "#3b0764",
    border: "1px dashed #a855f7",
    borderRadius: "0.5rem",
    marginTop: "1rem",
    padding: "0.85rem 1rem"
  },
  injectionTag: {
    color: "#e9d5ff",
    fontSize: "0.7rem",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const
  },
  injectionBody: { color: "#f3e8ff", lineHeight: 1.55, margin: "0.4rem 0 0" },
  grid: {
    display: "grid",
    gap: "1rem",
    gridTemplateColumns: "repeat(auto-fit, minmax(19rem, 1fr))"
  },
  panel: { borderRadius: "0.75rem", padding: "1.25rem" },
  panelDanger: { background: "#1c1417", border: "1px solid #7f1d1d" },
  panelSafe: { background: "#0f1c17", border: "1px solid #14532d" },
  toolName: {
    background: "#0f172a",
    borderRadius: "0.35rem",
    display: "inline-block",
    fontSize: "0.85rem",
    marginBottom: "0.75rem",
    padding: "0.2rem 0.5rem"
  },
  dl: { display: "grid", gap: "0.4rem", margin: "0 0 1rem" },
  row: { display: "flex", gap: "0.75rem", justifyContent: "space-between" },
  dt: { color: "#94a3b8", fontSize: "0.85rem", margin: 0 },
  dd: { fontSize: "0.85rem", margin: 0, textAlign: "right" as const },
  counter: { margin: "0 0 0.25rem" },
  dangerNumber: { color: "#f87171", fontSize: "1.35rem" },
  safeNumber: { color: "#4ade80", fontSize: "1.35rem" },
  status: { color: "#64748b", fontSize: "0.8rem", margin: 0 },
  checkbox: {
    alignItems: "center",
    color: "#94a3b8",
    display: "flex",
    fontSize: "0.85rem",
    gap: "0.5rem",
    marginTop: "0.75rem"
  },
  log: { display: "grid", gap: "0.5rem", listStyle: "none", margin: 0, padding: 0 },
  logItem: {
    alignItems: "center",
    background: "#1e293b",
    borderRadius: "0.5rem",
    display: "flex",
    flexWrap: "wrap" as const,
    fontSize: "0.85rem",
    gap: "0.6rem",
    padding: "0.6rem 0.85rem"
  },
  logTag: {
    borderRadius: "0.3rem",
    fontSize: "0.7rem",
    fontWeight: 700,
    letterSpacing: "0.05em",
    padding: "0.15rem 0.45rem"
  },
  logArm: { color: "#cbd5f5", fontWeight: 600 },
  footer: {
    borderTop: "1px solid #1e293b",
    color: "#94a3b8",
    lineHeight: 1.6,
    paddingTop: "1.25rem"
  }
} as const;
