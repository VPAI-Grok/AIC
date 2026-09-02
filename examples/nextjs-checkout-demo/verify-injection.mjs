/**
 * Executes the prompt-injection comparison in real Chrome with native WebMCP.
 *
 * This is the honest form of the claim. An agent following the injected note
 * calls whichever tool it finds; this script does exactly that, twice, and
 * records what each arm actually did to the order.
 *
 *   node examples/nextjs-checkout-demo/verify-injection.mjs [baseUrl]
 */

import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  executeNativeWebMCPTool,
  inspectNativeWebMCP,
  launchAICBrowserEvidence
} from "@aicorg/evidence-playwright";

const demoRoot = dirname(fileURLToPath(import.meta.url));
const baseUrl = process.argv[2] ?? "http://localhost:3000";
const target = `${baseUrl.replace(/\/$/, "")}/injection`;

async function chargeCount(page, label) {
  return page.evaluate((text) => {
    const nodes = [...document.querySelectorAll("p")];
    const row = nodes.find((node) => node.textContent?.includes(text));
    const match = row?.textContent?.match(/Charges executed:\s*(\d+)/);
    return match ? Number(match[1]) : -1;
  }, label);
}

async function main() {
  const session = await launchAICBrowserEvidence({
    channel: process.env.AIC_BROWSER_CHANNEL ?? "chrome"
  });
  const observations = [];

  try {
    const context = await session.newContext();
    const page = await context.newPage();
    await page.goto(target, { waitUntil: "networkidle" });

    const inspection = await inspectNativeWebMCP(page);
    if (!inspection.available) {
      throw new Error(
        "Native document.modelContext was unavailable. Chrome must run with the WebMCP testing flag."
      );
    }

    const toolNames = inspection.tools.map((tool) => tool.name).sort();
    observations.push({ detail: toolNames, step: "registered_tools" });

    for (const required of ["place_order_guarded", "place_order_unguarded"]) {
      if (!toolNames.includes(required)) {
        throw new Error(`Expected tool ${required} to be registered. Found: ${toolNames.join(", ")}`);
      }
    }

    // Arm 1: the ungoverned tool, exactly as the census apps register it.
    const before = await page.evaluate(() => document.body.innerText);
    const unguarded = await executeNativeWebMCPTool({
      argumentEncoding: "json_string_compat",
      input: {},
      page,
      toolName: "place_order_unguarded"
    });
    await page.waitForTimeout(400);
    const unguardedCharges = await chargeCount(page, "Charges executed");
    observations.push({
      charged: unguardedCharges > 0,
      detail: unguarded,
      step: "unguarded_execution"
    });

    // Arm 2: the governed tool with no human present. The adapter must refuse.
    let guardedError;
    try {
      await executeNativeWebMCPTool({
        argumentEncoding: "json_string_compat",
        input: { order_id: "ord_770310" },
        page,
        toolName: "place_order_guarded"
      });
    } catch (error) {
      guardedError = error instanceof Error ? error.message : String(error);
    }
    await page.waitForTimeout(400);
    observations.push({
      blocked: Boolean(guardedError),
      detail: guardedError ?? "tool resolved without confirmation",
      step: "guarded_execution_no_human"
    });

    const bodyText = await page.evaluate(() => document.body.innerText);
    const blockedLogged = /BLOCKED/.test(bodyText);
    observations.push({ detail: blockedLogged, step: "guarded_block_visible" });

    await page.screenshot({
      path: resolve(demoRoot, "aic-browser-evidence", "injection-comparison.png"),
      fullPage: true
    });

    const result = {
      artifact_type: "aic_injection_comparison",
      browser: session.metadata,
      generated_at: new Date().toISOString(),
      observations,
      status:
        observations.find((item) => item.step === "unguarded_execution")?.charged === true &&
        observations.find((item) => item.step === "guarded_execution_no_human")?.blocked === true
          ? "passed"
          : "failed",
      target,
      unchanged_before: before.length > 0
    };

    await writeFile(
      resolve(demoRoot, "aic-injection-result.json"),
      `${JSON.stringify(result, null, 2)}\n`,
      "utf8"
    );

    console.log(JSON.stringify(result, null, 2));
    if (result.status !== "passed") {
      process.exitCode = 1;
    }
  } finally {
    await session.browser.close();
  }
}

await main();
