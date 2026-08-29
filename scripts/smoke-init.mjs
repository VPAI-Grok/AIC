import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const cliPath = resolve(repoRoot, "packages/cli/dist/cli/src/index.js");

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
  const tempDir = await mkdtemp(`${tmpdir()}/aic-init-`);

  try {
    await writeFile(
      resolve(tempDir, "package.json"),
      `${JSON.stringify(
        {
          name: "fresh-vite-smoke",
          private: true,
          dependencies: {
            react: "^19.0.0",
            vite: "^6.4.1"
          }
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const dryRun = await runCommand(process.execPath, [cliPath, "init", tempDir, "--dry-run"]);
    const dryRunPayload = JSON.parse(dryRun.stdout);
    assert.equal(dryRunPayload.artifact_type, "aic_init_result");
    assert.equal(dryRunPayload.framework, "vite");
    assert.equal(dryRunPayload.summary.planned, 7);

    const writeRun = await runCommand(process.execPath, [cliPath, "init", tempDir]);
    const writePayload = JSON.parse(writeRun.stdout);
    assert.equal(writePayload.framework, "vite");
    assert.equal(writePayload.summary.created, 7);

    const projectConfig = JSON.parse(await readFile(resolve(tempDir, "aic.project.json"), "utf8"));
    assert.equal(projectConfig.framework, "vite");
    assert.equal(projectConfig.viewId, "vite.root");

    const doctor = await runCommand(process.execPath, [cliPath, "doctor", tempDir]);
    const doctorPayload = JSON.parse(doctor.stdout);
    assert.equal(doctorPayload.summary.errors, 0);
    assert.equal(doctorPayload.onboarding.summary.present, 5);
    assert.equal(doctorPayload.findings.some((finding) => finding.code === "missing_project_config"), false);

    console.log("Init smoke passed.");
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}

void main();
