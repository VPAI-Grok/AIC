import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);

function parseJsonPayload(output) {
  const start = output.indexOf("{");
  const end = output.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`Could not find JSON payload in output:\n${output}`);
  }

  return JSON.parse(output.slice(start, end + 1));
}

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

async function main() {
  const tempDir = await mkdtemp(`${tmpdir()}/aic-smoke-`);
  const bootstrapPrompt = resolve(tempDir, "bootstrap-prompt.json");

  try {
    const help = await runCommand("pnpm", ["aic", "--help"]);
    assert.match(help.stdout, /\bAIC CLI\b[\s\S]*\bUsage:/i);

    await runCommand("pnpm", ["--dir", "examples/nextjs-checkout-demo", "run", "aic:generate"]);

    const checkoutDoctor = await runCommand("pnpm", ["--dir", "examples/nextjs-checkout-demo", "run", "aic:doctor"]);
    const checkoutDoctorPayload = parseJsonPayload(checkoutDoctor.stdout);
    assert.equal(checkoutDoctorPayload.summary.errors, 0);

    const checkoutInspect = await runCommand("pnpm", ["--dir", "examples/nextjs-checkout-demo", "run", "aic:inspect"]);
    assert.match(checkoutInspect.stdout, /agent_onboarding|onboarding|report/i);

    const reactDoctor = await runCommand("pnpm", ["--dir", "examples/react-basic", "run", "aic:doctor"]);
    const reactDoctorPayload = parseJsonPayload(reactDoctor.stdout);
    assert.equal(reactDoctorPayload.summary.errors, 0);

    const bootstrap = await runCommand("node", [
      "packages/cli/dist/cli/src/index.js",
      "bootstrap",
      "https://demo.example",
      "--app-name",
      "DemoBootstrap",
      "--captures-file",
      "examples/bootstrap-openai/captures/customers.json",
      "--prompt-file",
      bootstrapPrompt,
      "--print-prompt"
    ]);
    assert.match(bootstrap.stdout, /artifact_type|bootstrap|prompt/i);
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}

void main();
