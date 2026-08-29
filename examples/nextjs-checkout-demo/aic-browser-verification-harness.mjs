import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  executeNativeWebMCPTool,
  inspectNativeWebMCP,
  launchAICBrowserEvidence,
  probeNativeWebMCPArgumentEncoding
} from "@aicorg/evidence-playwright";
import { CHECKOUT_REQUEST } from "./app/checkout-operation.mjs";

const demoRoot = dirname(fileURLToPath(import.meta.url));
const OPERATION_ID = "checkout.complete.domain";

function passed(requirement_id, condition, actual) {
  return {
    actual,
    passed: Boolean(condition),
    requirement_id,
    ...(condition ? {} : { message: `Browser evidence did not satisfy ${requirement_id}.` })
  };
}

function notObserved(requirement_id, condition, actual) {
  return {
    actual,
    passed: !condition,
    requirement_id,
    ...(condition ? {} : { message: `Browser evidence unexpectedly observed ${requirement_id}.` })
  };
}

function parseToolResult(value) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

async function waitForServer(baseUrl, timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  let serverErrorCount = 0;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl, { redirect: "manual" });
      if (response.status < 500) return;
      serverErrorCount += 1;
      const body = (await response.text()).trim().slice(0, 2000);
      lastError = new Error(`HTTP ${response.status}${body ? `: ${body}` : ""}`);
      if (serverErrorCount >= 5) break;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error(`Checkout demo did not become ready at ${baseUrl}: ${String(lastError)}`);
}

async function ensureDemoServer(baseUrl) {
  try {
    await waitForServer(baseUrl, 1000);
    return async () => undefined;
  } catch {
    if (process.env.AIC_BROWSER_MANAGE_SERVER === "false") {
      throw new Error(`No checkout server is available at ${baseUrl}.`);
    }
  }

  const url = new URL(baseUrl);
  if (!["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
    throw new Error("The browser harness starts servers only on localhost. Set AIC_BROWSER_MANAGE_SERVER=false for remote targets.");
  }
  const nextBin = resolve(demoRoot, "node_modules", "next", "dist", "bin", "next");
  const child = spawn(
    process.execPath,
    [nextBin, "dev", "--webpack", "--hostname", url.hostname, "--port", url.port || "80"],
    {
      cwd: demoRoot,
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
      stdio: ["ignore", "pipe", "pipe"]
    }
  );
  let outputStart = "";
  let outputTail = "";
  const captureOutput = (chunk) => {
    const text = chunk.toString();
    if (outputStart.length < 6000) outputStart = `${outputStart}${text}`.slice(0, 6000);
    outputTail = `${outputTail}${text}`.slice(-12000);
  };
  child.stdout.on("data", (chunk) => {
    captureOutput(chunk);
  });
  child.stderr.on("data", (chunk) => {
    captureOutput(chunk);
  });
  try {
    await waitForServer(baseUrl);
  } catch (error) {
    child.kill();
    throw new Error(`${String(error)}\n--- server start ---\n${outputStart}\n--- server tail ---\n${outputTail}`);
  }
  return async () => {
    if (child.exitCode !== null) return;
    child.kill();
    await Promise.race([
      new Promise((resolvePromise) => child.once("exit", resolvePromise)),
      new Promise((resolvePromise) => setTimeout(resolvePromise, 5000))
    ]);
  };
}

async function readState(page) {
  const locator = page.locator('[data-aic-evidence="checkout-state"]');
  await locator.waitFor({ state: "visible" });
  return locator.evaluate((element) => {
    const html = /** @type {HTMLElement} */ (element);
    return {
      attemptCount: Number(html.dataset.attemptCount ?? "0"),
      auditCount: Number(html.dataset.auditCount ?? "0"),
      chargeCount: Number(html.dataset.chargeCount ?? "0"),
      confirmation: html.dataset.confirmation ?? "not_reached",
      errorCode: html.dataset.errorCode ?? "",
      orderId: html.dataset.orderId ?? "",
      orderStatus: html.dataset.orderStatus ?? "unknown",
      orderTotal: html.dataset.orderTotal ?? "",
      paymentMethod: html.dataset.paymentMethod ?? "",
      paymentStatus: html.dataset.paymentStatus ?? "unknown",
      recovered: html.dataset.recovered === "true"
    };
  });
}

async function waitForFinalState(page, scenarioId) {
  await page.waitForFunction((scenario) => {
    const element = /** @type {HTMLElement | null} */ (
      document.querySelector('[data-aic-evidence="checkout-state"]')
    );
    if (!element) return false;
    if (scenario === "success") {
      return (
        element.dataset.orderStatus === "submitted" &&
        element.dataset.attemptCount === "1" &&
        element.dataset.chargeCount === "1" &&
        element.dataset.auditCount === "1"
      );
    }
    if (scenario === "authorization-denied") return element.dataset.errorCode === "authorization_denied";
    if (scenario === "confirmation-declined") return element.dataset.confirmation === "declined";
    if (scenario === "business-failure") {
      return (
        element.dataset.errorCode === "payment_provider_unavailable" &&
        element.dataset.orderStatus === "draft" &&
        element.dataset.attemptCount === "1"
      );
    }
    return (
      scenario === "recovery" &&
      element.dataset.recovered === "true" &&
      element.dataset.orderStatus === "submitted" &&
      element.dataset.attemptCount === "2" &&
      element.dataset.chargeCount === "1" &&
      element.dataset.auditCount === "1"
    );
  }, scenarioId);
  return readState(page);
}

async function waitForNativeTools(page) {
  const deadline = Date.now() + 15000;
  let inspection;
  while (Date.now() < deadline) {
    inspection = await inspectNativeWebMCP(page);
    const names = inspection.tools.map((tool) => tool.name);
    if (inspection.available && names.includes("get_checkout_summary") && names.includes("complete_checkout")) {
      return inspection;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  throw new Error(`Native WebMCP tools did not register: ${JSON.stringify(inspection)}`);
}

async function screenshotEvidence(page, evidenceDirectory, scenarioId, surfaceId) {
  await mkdir(evidenceDirectory, { recursive: true });
  const filePath = resolve(evidenceDirectory, `${scenarioId}--${surfaceId}.png`);
  await page.screenshot({ fullPage: true, path: filePath });
  const digest = createHash("sha256").update(await readFile(filePath)).digest("hex");
  return {
    digest: `sha256:${digest}`,
    kind: "screenshot",
    ref: relative(demoRoot, filePath).replaceAll("\\", "/")
  };
}

function observationFromState({
  argumentEncoding,
  browserMetadata,
  capturedAt,
  durationMs,
  evidence,
  initialState,
  nativeInspection,
  scenarioId,
  state,
  surfaceId,
  toolResult
}) {
  const common = {
    artifact_type: "aic_behavior_observation",
    captured_at: capturedAt,
    contract_id: "checkout.complete.behavior",
    duration_ms: durationMs,
    environment: {
      adapter: "@aicorg/evidence-playwright",
      argument_encoding: argumentEncoding ?? "not_applicable",
      browser: browserMetadata.browser_name,
      browser_version: browserMetadata.browser_version,
      feature_mode: browserMetadata.feature_mode,
      native_webmcp: String(nativeInspection?.available === true),
      surface: surfaceId,
      tool_result_type: toolResult === undefined ? "none" : typeof toolResult,
      webmcp_api: nativeInspection?.api ?? "not_applicable"
    },
    evidence: [evidence],
    mode: "executed",
    operation_id: OPERATION_ID,
    surface_id: surfaceId
  };
  const unchanged =
    state.orderStatus === "draft" &&
    state.paymentStatus === "unpaid" &&
    state.chargeCount === 0 &&
    state.auditCount === 0;
  const committedExactlyOnce =
    state.orderStatus === "submitted" &&
    state.paymentStatus === "charged" &&
    state.chargeCount === 1 &&
    state.auditCount === 1;
  const exactScope =
    state.orderId === CHECKOUT_REQUEST.order_id &&
    state.orderTotal === CHECKOUT_REQUEST.order_total &&
    state.paymentMethod === CHECKOUT_REQUEST.payment_method;
  const initialChecks = [
    passed("order.is_draft", initialState.orderStatus === "draft", initialState.orderStatus),
    passed("checkout.exact_scope", exactScope, {
      order_id: state.orderId,
      order_total: state.orderTotal,
      payment_method: state.paymentMethod
    })
  ];
  const outcome = {
    order_id: state.orderId,
    order_status: state.orderStatus,
    payment_status: state.paymentStatus
  };

  if (scenarioId === "authorization-denied") {
    return {
      ...common,
      checks: [
        ...initialChecks,
        passed("authorization.denied", state.errorCode === "authorization_denied", state.errorCode),
        passed("order.unchanged", unchanged, outcome),
        notObserved("authorization.allowed", true, false),
        notObserved("confirmation.accepted", state.confirmation !== "accepted", state.confirmation),
        notObserved("confirmation.declined", state.confirmation !== "declined", state.confirmation),
        notObserved("payment.idempotent", state.attemptCount === 0, state.attemptCount),
        notObserved("execution.failure_isolated", state.errorCode !== "payment_provider_unavailable", state.errorCode),
        notObserved("payment.charge", state.chargeCount === 0, state.chargeCount),
        notObserved("order.submitted", state.orderStatus !== "submitted", state.orderStatus),
        notObserved("payment.charged", state.paymentStatus !== "charged", state.paymentStatus),
        notObserved("checkout.audit_recorded", state.auditCount === 0, state.auditCount),
        notObserved("checkout.safe_recovery", !state.recovered, state.recovered)
      ],
      confirmation: "not_reached",
      error_code: state.errorCode || "browser_outcome_mismatch",
      outcome,
      scenario_id: scenarioId,
      status: state.errorCode === "authorization_denied" ? "denied" : "failed"
    };
  }

  if (scenarioId === "confirmation-declined") {
    return {
      ...common,
      checks: [
        ...initialChecks,
        passed("authorization.allowed", state.confirmation === "declined", state.confirmation),
        passed("confirmation.declined", state.confirmation === "declined", state.confirmation),
        passed("order.unchanged", unchanged, outcome),
        notObserved("authorization.denied", state.errorCode !== "authorization_denied", state.errorCode),
        notObserved("confirmation.accepted", state.confirmation !== "accepted", state.confirmation),
        notObserved("payment.idempotent", state.attemptCount === 0, state.attemptCount),
        notObserved("execution.failure_isolated", state.errorCode !== "payment_provider_unavailable", state.errorCode),
        notObserved("payment.charge", state.chargeCount === 0, state.chargeCount),
        notObserved("order.submitted", state.orderStatus !== "submitted", state.orderStatus),
        notObserved("payment.charged", state.paymentStatus !== "charged", state.paymentStatus),
        notObserved("checkout.audit_recorded", state.auditCount === 0, state.auditCount),
        notObserved("checkout.safe_recovery", !state.recovered, state.recovered)
      ],
      confirmation: state.confirmation,
      error_code: state.errorCode || "browser_outcome_mismatch",
      outcome,
      scenario_id: scenarioId,
      status: state.confirmation === "declined" ? "cancelled" : "failed"
    };
  }

  if (scenarioId === "business-failure") {
    const isolated =
      unchanged &&
      state.attemptCount === 1 &&
      state.errorCode === "payment_provider_unavailable";
    return {
      ...common,
      checks: [
        ...initialChecks,
        passed("authorization.allowed", state.confirmation === "accepted", state.confirmation),
        passed("confirmation.accepted", state.confirmation === "accepted", state.confirmation),
        passed("execution.failure_isolated", isolated, {
          attempt_count: state.attemptCount,
          audit_count: state.auditCount,
          charge_count: state.chargeCount,
          error_code: state.errorCode
        }),
        passed("order.unchanged", unchanged, outcome),
        notObserved("authorization.denied", state.errorCode !== "authorization_denied", state.errorCode),
        notObserved("confirmation.declined", state.confirmation !== "declined", state.confirmation),
        notObserved("payment.idempotent", state.chargeCount === 0, state.chargeCount),
        notObserved("payment.charge", state.chargeCount === 0, state.chargeCount),
        notObserved("order.submitted", state.orderStatus !== "submitted", state.orderStatus),
        notObserved("payment.charged", state.paymentStatus !== "charged", state.paymentStatus),
        notObserved("checkout.audit_recorded", state.auditCount === 0, state.auditCount),
        notObserved("checkout.safe_recovery", !state.recovered, state.recovered)
      ],
      confirmation: state.confirmation,
      error_code: state.errorCode || "browser_outcome_mismatch",
      outcome,
      scenario_id: scenarioId,
      status: isolated ? "failed" : "succeeded"
    };
  }

  if (scenarioId === "recovery") {
    const recoveredExactlyOnce =
      committedExactlyOnce && state.attemptCount === 2 && state.recovered;
    return {
      ...common,
      checks: [
        ...initialChecks,
        passed("authorization.allowed", state.confirmation === "accepted", state.confirmation),
        passed("confirmation.accepted", state.confirmation === "accepted", state.confirmation),
        passed("execution.failure_isolated", state.recovered && state.attemptCount === 2, {
          attempt_count: state.attemptCount,
          recovered: state.recovered
        }),
        passed("payment.idempotent", recoveredExactlyOnce, {
          attempt_count: state.attemptCount,
          audit_count: state.auditCount,
          charge_count: state.chargeCount
        }),
        passed("payment.charge", state.chargeCount === 1, state.chargeCount),
        passed("order.submitted", state.orderStatus === "submitted", state.orderStatus),
        passed("payment.charged", state.paymentStatus === "charged", state.paymentStatus),
        passed("checkout.audit_recorded", state.auditCount === 1, state.auditCount),
        passed("checkout.safe_recovery", recoveredExactlyOnce, {
          attempt_count: state.attemptCount,
          recovered: state.recovered
        }),
        notObserved("authorization.denied", state.errorCode !== "authorization_denied", state.errorCode),
        notObserved("confirmation.declined", state.confirmation !== "declined", state.confirmation),
        notObserved("order.unchanged", !unchanged, outcome)
      ],
      confirmation: state.confirmation,
      outcome,
      scenario_id: scenarioId,
      status: recoveredExactlyOnce ? "recovered" : "failed"
    };
  }

  return {
    ...common,
    checks: [
      ...initialChecks,
      passed("authorization.allowed", state.confirmation === "accepted", state.confirmation),
      passed("confirmation.accepted", state.confirmation === "accepted", state.confirmation),
      passed("payment.idempotent", committedExactlyOnce && state.attemptCount === 1, {
        attempt_count: state.attemptCount,
        audit_count: state.auditCount,
        charge_count: state.chargeCount
      }),
      passed("payment.charge", state.chargeCount === 1, state.chargeCount),
      passed("order.submitted", state.orderStatus === "submitted", state.orderStatus),
      passed("payment.charged", state.paymentStatus === "charged", state.paymentStatus),
      passed("checkout.audit_recorded", state.auditCount === 1, state.auditCount),
      notObserved("authorization.denied", state.errorCode !== "authorization_denied", state.errorCode),
      notObserved("confirmation.declined", state.confirmation !== "declined", state.confirmation),
      notObserved("execution.failure_isolated", state.errorCode !== "payment_provider_unavailable", state.errorCode),
      notObserved("order.unchanged", !unchanged, outcome),
      notObserved("checkout.safe_recovery", !state.recovered, state.recovered)
    ],
    confirmation: state.confirmation,
    outcome,
    scenario_id: scenarioId,
    status:
      committedExactlyOnce && state.attemptCount === 1
        ? "succeeded"
        : "failed"
  };
}

async function runBrowserScenario({
  baseUrl,
  browserMetadata,
  capturedAt,
  evidenceDirectory,
  scenarioId,
  session,
  surfaceId
}) {
  const context = await session.newContext();
  const page = await context.newPage();
  const url = new URL(baseUrl);
  if (scenarioId === "authorization-denied") {
    url.searchParams.set("aic_fixture_permission", "denied");
  }
  if (scenarioId === "business-failure") {
    url.searchParams.set("aic_fixture_execution", "fail");
  } else if (scenarioId === "recovery") {
    url.searchParams.set("aic_fixture_execution", "recover");
  }
  const startedAt = Date.now();
  let nativeInspection;
  let argumentEncoding;
  let toolResult;
  try {
    await page.goto(url.href, { waitUntil: "networkidle" });
    const initialState = await readState(page);
    if (surfaceId === "human-ui") {
      if (scenarioId !== "authorization-denied") {
        page.once("dialog", async (dialog) => {
          if (scenarioId === "confirmation-declined") await dialog.dismiss();
          else await dialog.accept();
        });
      }
      await page.locator('[data-agent-id="checkout.submit_order"]').click();
    } else if (surfaceId === "webmcp") {
      nativeInspection = await waitForNativeTools(page);
      const probe = await probeNativeWebMCPArgumentEncoding({
        input: {},
        page,
        readOnlyConfirmed: true,
        toolName: "get_checkout_summary"
      });
      argumentEncoding = probe.argument_encoding;
      if (scenarioId !== "authorization-denied") {
        page.once("dialog", async (dialog) => {
          if (scenarioId === "confirmation-declined") await dialog.dismiss();
          else await dialog.accept();
        });
      }
      try {
        const execution = await executeNativeWebMCPTool({
          argumentEncoding,
          input: CHECKOUT_REQUEST,
          page,
          toolName: "complete_checkout"
        });
        toolResult = parseToolResult(execution.result);
      } catch (error) {
        toolResult = { error: error instanceof Error ? error.message : String(error) };
      }
    } else {
      throw new Error(`Unsupported browser evidence surface: ${surfaceId}.`);
    }
    const state = await waitForFinalState(page, scenarioId);
    const evidence = await screenshotEvidence(page, evidenceDirectory, scenarioId, surfaceId);
    return observationFromState({
      argumentEncoding,
      browserMetadata,
      capturedAt,
      durationMs: Date.now() - startedAt,
      evidence,
      initialState,
      nativeInspection,
      scenarioId,
      state,
      surfaceId,
      toolResult
    });
  } finally {
    await context.close();
  }
}

export async function collectAICBehaviorObservations({ contract }) {
  const baseUrl = process.env.AIC_BROWSER_BASE_URL ?? "http://127.0.0.1:3100";
  const capturedAt = process.env.AIC_BROWSER_CAPTURED_AT ?? new Date().toISOString();
  const evidenceDirectory = resolve(
    demoRoot,
    process.env.AIC_BROWSER_EVIDENCE_DIR ?? "aic-browser-evidence"
  );
  const stopServer = await ensureDemoServer(baseUrl);
  const session = await launchAICBrowserEvidence({
    channel: process.env.AIC_BROWSER_CHANNEL ?? "chrome",
    ...(process.env.AIC_BROWSER_EXECUTABLE_PATH
      ? { executablePath: process.env.AIC_BROWSER_EXECUTABLE_PATH }
      : {}),
    headless: process.env.AIC_BROWSER_HEADLESS !== "false"
  });
  try {
    const observations = [];
    for (const scenario of contract.scenarios) {
      for (const surfaceId of scenario.surfaces) {
        observations.push(
          await runBrowserScenario({
            baseUrl,
            browserMetadata: session.metadata,
            capturedAt,
            evidenceDirectory,
            scenarioId: scenario.id,
            session,
            surfaceId
          })
        );
      }
    }
    return {
      artifact_type: "aic_behavior_observation_set",
      contract_id: contract.id,
      generated_at: capturedAt,
      observations
    };
  } finally {
    await session.browser.close();
    await stopServer();
  }
}
