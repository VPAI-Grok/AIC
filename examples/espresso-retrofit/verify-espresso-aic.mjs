/**
 * Drives the AIC-retrofitted espresso store in real Chrome with native WebMCP.
 *
 * The espresso store registers 16 tools. Two are now governed by @aicorg/webmcp:
 * `checkout` (critical, confirmed, verified) and `apply_coupon` (medium). The
 * other fourteen are untouched, exactly as the original author wrote them.
 *
 * This asserts the retrofit did not break the app and that the gate actually
 * holds on a real domain operation that charges money:
 *
 *   1. all 16 tools still register
 *   2. a read-only tool still works           (nothing regressed)
 *   3. apply_coupon works                      (governed, medium, no gate)
 *   4. checkout with confirmation DECLINED     -> refused, no order created
 *   5. checkout with confirmation ACCEPTED     -> order created, cart emptied
 *
 * Steps 4 and 5 are the point: same tool, same page, same browser. The only
 * difference is whether a human said yes.
 *
 *   node examples/espresso-retrofit/verify-espresso-aic.mjs [baseUrl]
 */

import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  executeNativeWebMCPTool,
  inspectNativeWebMCP,
  launchAICBrowserEvidence
} from "../../packages/evidence-playwright/dist/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const baseUrl = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const USER = "vince";
const PASSWORD = "espresso123";
const COUPON = "BARISTA10";

const observations = [];
function record(step, detail, passed) {
  observations.push({ detail, passed, step });
  process.stderr.write(`${passed ? "PASS" : "FAIL"}  ${step}\n`);
}

async function login(page) {
  await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
  await page.locator('input[name="username"], input#username').first().fill(USER);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 20000 });
  await page.waitForTimeout(1500);
}

/**
 * The community `use-webmcp-tool` hook wraps results in an MCP content
 * envelope; the AIC adapter returns the payload directly. Governed and
 * ungoverned tools therefore return different shapes on the same page, so
 * unwrap both.
 */
function parseToolResult(raw) {
  let value = raw;
  for (let depth = 0; depth < 3; depth += 1) {
    if (typeof value === "string") {
      try {
        value = JSON.parse(value);
      } catch {
        return value;
      }
      continue;
    }
    if (value && Array.isArray(value.content)) {
      value = value.content.map((part) => part?.text ?? "").join("");
      continue;
    }
    return value;
  }
  return value;
}

/** Answer the next window.confirm with `accept`, and capture the prompt text. */
function armConfirm(page, accept) {
  const seen = { prompt: null };
  page.once("dialog", async (dialog) => {
    seen.prompt = dialog.message();
    if (accept) await dialog.accept();
    else await dialog.dismiss();
  });
  return seen;
}

/**
 * Counts cart lines through the app's own untouched `get_cart` tool.
 * placeOrder empties the cart, so this is the declared postcondition observed
 * directly rather than inferred.
 */
async function cartLineCount(page) {
  const res = await executeNativeWebMCPTool({
    argumentEncoding: "json_string_compat",
    input: {},
    page,
    toolName: "get_cart"
  });
  const cart = parseToolResult(res.result);
  return Array.isArray(cart?.lines) ? cart.lines.length : -1;
}

async function main() {
  const session = await launchAICBrowserEvidence({
    channel: process.env.AIC_BROWSER_CHANNEL ?? "chrome"
  });

  try {
    const context = await session.newContext();
    const page = await context.newPage();
    await login(page);

    // 1. every tool still registers, and the two governed ones are present
    let names = [];
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const inspection = await inspectNativeWebMCP(page);
      if (!inspection.available) {
        throw new Error("Native document.modelContext unavailable — Chrome needs the WebMCP flag.");
      }
      names = inspection.tools.map((t) => t.name).sort();
      if (names.includes("checkout") && names.includes("apply_coupon") && names.length >= 16) break;
      await page.waitForTimeout(500);
    }
    record("all_16_tools_registered", { count: names.length, names }, names.length >= 16);
    record(
      "governed_tools_present",
      { checkout: names.includes("checkout"), apply_coupon: names.includes("apply_coupon") },
      names.includes("checkout") && names.includes("apply_coupon")
    );

    // 2. an untouched read-only tool still works
    const cart = await executeNativeWebMCPTool({
      argumentEncoding: "json_string_compat",
      input: {},
      page,
      toolName: "get_cart"
    });
    record("ungoverned_read_tool_intact", { result: String(cart.result).slice(0, 160) }, Boolean(cart.result));

    // 3. put something in the cart so checkout has work to do
    const products = await executeNativeWebMCPTool({
      argumentEncoding: "json_string_compat",
      input: { query: "grinder" },
      page,
      toolName: "search_products"
    });
    const parsedProducts = parseToolResult(products.result);
    const productList = Array.isArray(parsedProducts)
      ? parsedProducts
      : parsedProducts?.products ?? [];
    const firstSlug = productList[0]?.slug ?? null;
    if (firstSlug == null) throw new Error("Could not find a product slug from search_products.");
    await executeNativeWebMCPTool({
      argumentEncoding: "json_string_compat",
      input: { quantity: 1, slug: firstSlug },
      page,
      toolName: "add_to_cart"
    });
    const seeded = await cartLineCount(page);
    record("cart_seeded", { lines: seeded, slug: firstSlug }, seeded > 0);

    // 4. governed apply_coupon (medium risk, no confirmation gate)
    let couponOk = false;
    let couponDetail;
    try {
      const applied = await executeNativeWebMCPTool({
        argumentEncoding: "json_string_compat",
        input: { code: COUPON },
        page,
        toolName: "apply_coupon"
      });
      const appliedCart = parseToolResult(applied.result);
      couponDetail = JSON.stringify(appliedCart).slice(0, 200);
      couponOk = appliedCart?.coupon?.code?.toUpperCase() === COUPON;
    } catch (error) {
      couponDetail = error instanceof Error ? error.message : String(error);
    }
    record("governed_medium_risk_tool_succeeds", { detail: couponDetail }, couponOk);

    // 5. checkout with confirmation DECLINED — must not create an order
    const linesBefore = await cartLineCount(page);
    const declined = armConfirm(page, false);
    let declineBlocked = false;
    let declineDetail;
    try {
      await executeNativeWebMCPTool({
        argumentEncoding: "json_string_compat",
        input: {},
        page,
        toolName: "checkout"
      });
      declineDetail = "checkout resolved despite a declined confirmation";
    } catch (error) {
      declineBlocked = true;
      declineDetail = error instanceof Error ? error.message : String(error);
    }
    await page.waitForTimeout(800);
    const linesAfterDecline = await cartLineCount(page);
    record(
      "checkout_blocked_when_confirmation_declined",
      {
        detail: declineDetail,
        cart_lines_after: linesAfterDecline,
        cart_lines_before: linesBefore,
        prompt_shown: declined.prompt
      },
      declineBlocked && linesAfterDecline === linesBefore && linesBefore > 0
    );
    record(
      "confirmation_prompt_came_from_aic_contract",
      { prompt: declined.prompt },
      typeof declined.prompt === "string" &&
        /cannot be undone/i.test(declined.prompt) &&
        !declined.prompt.includes("{{")
    );

    // 6. checkout with confirmation ACCEPTED — must create an order
    const accepted = armConfirm(page, true);
    let placedDetail;
    let placed = false;
    try {
      const result = await executeNativeWebMCPTool({
        argumentEncoding: "json_string_compat",
        input: {},
        page,
        toolName: "checkout"
      });
      const placedOrder = parseToolResult(result.result);
      placedDetail = JSON.stringify(placedOrder).slice(0, 200);
      placed = Number.isInteger(placedOrder?.orderId) && placedOrder.orderId > 0;
    } catch (error) {
      placedDetail = error instanceof Error ? error.message : String(error);
    }
    await page.waitForTimeout(1200);
    const linesAfterAccept = await cartLineCount(page);
    record(
      "checkout_succeeds_when_human_approves",
      {
        detail: placedDetail,
        cart_lines_after: linesAfterAccept,
        cart_lines_before: linesAfterDecline,
        prompt_shown: accepted.prompt
      },
      placed && linesAfterAccept === 0
    );

    await page.screenshot({ path: resolve(here, "espresso-aic-retrofit.png"), fullPage: true });

    const result = {
      artifact_type: "aic_espresso_retrofit_verification",
      browser: session.metadata,
      generated_at: new Date().toISOString(),
      governed_tools: ["checkout", "apply_coupon"],
      observations,
      status: observations.every((o) => o.passed) ? "passed" : "failed",
      subject: "vincanger/webmcp-espresso-store (retrofitted with @aicorg/webmcp)",
      target: baseUrl,
      total_tools: names.length,
      ungoverned_tools: names.filter((n) => n !== "checkout" && n !== "apply_coupon").length
    };

    await writeFile(
      resolve(here, "espresso-aic-result.json"),
      `${JSON.stringify(result, null, 2)}\n`,
      "utf8"
    );
    console.log(JSON.stringify(result, null, 2));
    if (result.status !== "passed") process.exitCode = 1;
  } finally {
    await session.browser.close();
  }
}

await main();
