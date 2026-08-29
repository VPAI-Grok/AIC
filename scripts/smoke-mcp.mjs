import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import http from "node:http";
import { resolve, extname } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const pnpmCliPath = process.env.npm_execpath;

if (!pnpmCliPath || !pnpmCliPath.toLowerCase().includes("pnpm")) {
  throw new Error("Run this smoke through pnpm so its CLI path is available.");
}
const checkoutRoot = resolve(repoRoot, "examples/nextjs-checkout-demo");
const publicRoot = resolve(checkoutRoot, "public");
const mcpToolsIndexPath = resolve(
  repoRoot,
  "packages/mcp-server/dist/mcp-server/src/tools/discover.js"
);
const mcpToolsListElementsPath = resolve(
  repoRoot,
  "packages/mcp-server/dist/mcp-server/src/tools/list-elements.js"
);
const mcpToolsUiStatePath = resolve(
  repoRoot,
  "packages/mcp-server/dist/mcp-server/src/tools/ui-state.js"
);
const mcpToolsWorkflowsPath = resolve(
  repoRoot,
  "packages/mcp-server/dist/mcp-server/src/tools/workflows.js"
);
const mcpToolsActionsPath = resolve(
  repoRoot,
  "packages/mcp-server/dist/mcp-server/src/tools/actions.js"
);
const { handleDiscover } = await import(pathToFileURL(mcpToolsIndexPath).href);
const { handleListElements } = await import(pathToFileURL(mcpToolsListElementsPath).href);
const { handleUiState } = await import(pathToFileURL(mcpToolsUiStatePath).href);
const { handleWorkflows } = await import(pathToFileURL(mcpToolsWorkflowsPath).href);
const { handleActions } = await import(pathToFileURL(mcpToolsActionsPath).href);

function runCommand(command, args, options = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? repoRoot,
      env: { ...process.env, ...(options.env ?? {}) },
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", rejectPromise);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise({ stdout, stderr });
        return;
      }

      rejectPromise(
        new Error(
          `Command failed (${code}): ${command} ${args.join(" ")}\n${stderr || stdout}`.trim()
        )
      );
    });
  });
}

function contentTypeFor(pathname) {
  switch (extname(pathname)) {
    case ".json":
      return "application/json; charset=utf-8";
    case ".txt":
      return "text/plain; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

async function startStaticServer(rootDir) {
  const server = http.createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url ?? "/", "http://127.0.0.1");
      const pathname = requestUrl.pathname === "/" ? "/.well-known/agent.json" : requestUrl.pathname;
      const filePath = resolve(rootDir, `.${pathname}`);

      if (!filePath.startsWith(rootDir)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }

      const body = await readFile(filePath);
      res.writeHead(200, { "content-type": contentTypeFor(filePath) });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });

  await new Promise((resolvePromise) => server.listen(0, "127.0.0.1", resolvePromise));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind static server");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolvePromise, rejectPromise) => {
      server.close((error) => {
        if (error) {
          rejectPromise(error);
          return;
        }
        resolvePromise();
      });
    })
  };
}

async function main() {
  console.log("Generating checkout artifacts...");
  await runCommand(process.execPath, [
    pnpmCliPath,
    "--dir",
    "examples/nextjs-checkout-demo",
    "run",
    "aic:generate"
  ]);
  console.log("Starting static manifest host...");
  const server = await startStaticServer(publicRoot);
  console.log(`Static host ready at ${server.baseUrl}`);

  try {
    console.log("Calling discover_aic_app...");
    const discover = JSON.parse(await handleDiscover({ base_url: server.baseUrl }));
    assert.equal(discover.success, true);
    assert.equal(discover.framework, "nextjs");

    console.log("Calling list_aic_elements...");
    const elements = JSON.parse(
      await handleListElements({
        base_url: server.baseUrl,
        risk: "critical",
        query: "submit",
        actionable_only: true
      })
    );
    assert.equal(elements.success, true);
    assert.ok(
      elements.elements.some((element) => element.id === "checkout.submit_order"),
      "Expected checkout.submit_order in MCP element results"
    );

    console.log("Calling get_aic_workflows...");
    const workflows = JSON.parse(
      await handleWorkflows({
        base_url: server.baseUrl,
        workflow_id: "checkout.review"
      })
    );
    assert.equal(workflows.success, true);
    assert.equal(workflows.workflow_count, 1);

    console.log("Calling get_aic_actions...");
    const actions = JSON.parse(
      await handleActions({
        base_url: server.baseUrl,
        action_name: "checkout.complete"
      })
    );
    assert.equal(actions.success, true);
    assert.equal(actions.action_count, 1);

    console.log("Calling get_aic_ui_state...");
    const uiState = JSON.parse(await handleUiState({ base_url: server.baseUrl }));
    assert.equal(uiState.success, true);
    assert.ok(uiState.element_count >= 6, "Expected checkout UI state to include extracted elements");

    console.log("MCP smoke passed.");
  } finally {
    await server.close();
  }
}

void main();
