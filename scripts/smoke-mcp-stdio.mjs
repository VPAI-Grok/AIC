import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import http from "node:http";
import { spawn } from "node:child_process";
import { extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const checkoutRoot = resolve(repoRoot, "examples/nextjs-checkout-demo");
const publicRoot = resolve(checkoutRoot, "public");
const sdkRoot = resolve(
  repoRoot,
  "packages/mcp-server/node_modules/@modelcontextprotocol/sdk/dist/esm"
);
const { Client } = await import(pathToFileURL(resolve(sdkRoot, "client/index.js")).href);
const { StdioClientTransport } = await import(pathToFileURL(resolve(sdkRoot, "client/stdio.js")).href);

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
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(text);
    });

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text);
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
    close: () =>
      new Promise((resolvePromise, rejectPromise) => {
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
  await runCommand("pnpm", ["--dir", "examples/nextjs-checkout-demo", "run", "aic:generate"]);

  console.log("Starting static manifest host...");
  const server = await startStaticServer(publicRoot);
  console.log(`Static host ready at ${server.baseUrl}`);

  const transport = new StdioClientTransport({
    command: "node",
    args: ["packages/mcp-server/dist/mcp-server/src/index.js"],
    cwd: repoRoot,
    stderr: "pipe"
  });

  const stderrChunks = [];
  transport.stderr?.on("data", (chunk) => {
    stderrChunks.push(chunk.toString());
  });

  const client = new Client({
    name: "aic-stdio-smoke",
    version: "0.1.0"
  });

  try {
    console.log("Connecting to MCP server over stdio...");
    await client.connect(transport);

    const listed = await client.listTools();
    assert.ok(
      listed.tools.some((tool) => tool.name === "discover_aic_app"),
      "Expected discover_aic_app to be registered on stdio MCP server"
    );

    const discover = await client.callTool({
      name: "discover_aic_app",
      arguments: { base_url: server.baseUrl }
    });
    const discoverPayload = JSON.parse(discover.content[0]?.text ?? "{}");
    assert.equal(discoverPayload.success, true);
    assert.equal(discoverPayload.framework, "nextjs");

    const listElements = await client.callTool({
      name: "list_aic_elements",
      arguments: {
        base_url: server.baseUrl,
        risk: "critical",
        query: "submit",
        actionable_only: true
      }
    });
    const listPayload = JSON.parse(listElements.content[0]?.text ?? "{}");
    assert.equal(listPayload.success, true);
    assert.ok(
      listPayload.elements.some((element) => element.id === "checkout.submit_order"),
      "Expected checkout.submit_order in stdio MCP tool results"
    );

    assert.ok(
      stderrChunks.some((text) => text.includes("AIC MCP Server running on stdio")),
      "Expected MCP server startup message on stderr"
    );

    console.log("MCP stdio smoke passed.");
  } finally {
    await transport.close();
    await server.close();
  }
}

void main();
