import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, readdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";

import { createTempDir, resolveFromRepo } from "./helpers.mjs";

const publishablePackages = [
  {
    hasBin: false,
    hasClientExport: false,
    name: "@aicorg/spec",
    path: "packages/spec"
  },
  {
    hasBin: false,
    hasClientExport: false,
    name: "@aicorg/runtime",
    path: "packages/runtime"
  },
  {
    hasBin: false,
    hasClientExport: true,
    name: "@aicorg/sdk-react",
    path: "packages/sdk-react"
  },
  {
    hasBin: false,
    hasClientExport: false,
    name: "@aicorg/automation-core",
    path: "packages/automation-core"
  },
  {
    hasBin: true,
    hasClientExport: false,
    name: "@aicorg/cli",
    path: "packages/cli"
  },
  {
    hasBin: false,
    hasClientExport: false,
    name: "@aicorg/plugin-vite",
    path: "packages/plugin-vite"
  },
  {
    hasBin: false,
    hasClientExport: false,
    name: "@aicorg/plugin-next",
    path: "packages/plugin-next"
  },
  {
    hasBin: false,
    hasClientExport: false,
    name: "@aicorg/integrations-radix",
    path: "packages/integrations-radix"
  },
  {
    hasBin: false,
    hasClientExport: true,
    name: "@aicorg/integrations-shadcn",
    path: "packages/integrations-shadcn"
  },
  {
    hasBin: false,
    hasClientExport: false,
    name: "@aicorg/ai-bootstrap",
    path: "packages/ai-bootstrap"
  },
  {
    hasBin: false,
    hasClientExport: false,
    name: "@aicorg/ai-bootstrap-http",
    path: "packages/ai-bootstrap-http"
  },
  {
    hasBin: false,
    hasClientExport: false,
    name: "@aicorg/ai-bootstrap-openai",
    path: "packages/ai-bootstrap-openai"
  },
  {
    hasBin: "aic-mcp-server",
    hasClientExport: false,
    name: "@aicorg/mcp-server",
    path: "packages/mcp-server"
  }
];

const deferredPrivatePackages = [
  "packages/devtools/package.json",
  "examples/bootstrap-openai/package.json",
  "examples/nextjs-checkout-demo/package.json",
  "examples/react-basic/package.json"
];

function runCommand(command, args, options = {}) {
  const { cwd = process.cwd(), env = {} } = options;

  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd,
      env: {
        ...process.env,
        ...env
      },
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
      resolvePromise({
        code: code ?? 1,
        stderr,
        stdout
      });
    });
  });
}

async function packPackage(packagePath, outDir) {
  const cwd = resolveFromRepo(packagePath);
  const command = process.platform === "win32" ? "corepack.cmd" : "corepack";
  const result = await runCommand(
    command,
    ["pnpm", "pack", "--pack-destination", outDir],
    {
      cwd,
      env: {
        COREPACK_HOME: "/tmp/corepack"
      }
    }
  );

  assert.equal(result.code, 0, result.stderr);

  const files = await readdir(outDir);
  assert.equal(files.length, 1);
  return join(outDir, files[0]);
}

async function readTarMember(tarballPath, memberPath) {
  const result = await runCommand("tar", ["-xOf", tarballPath, memberPath]);
  assert.equal(result.code, 0, result.stderr);
  return result.stdout;
}

async function listTarMembers(tarballPath) {
  const result = await runCommand("tar", ["-tf", tarballPath]);
  assert.equal(result.code, 0, result.stderr);
  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

test("publish wave package manifests are public and alpha-versioned", async () => {
  for (const pkg of publishablePackages) {
    const packageJson = JSON.parse(await readFile(resolveFromRepo(pkg.path, "package.json"), "utf8"));

    assert.equal(packageJson.private, undefined);
    assert.equal(packageJson.version, "0.1.0-alpha.0");
    assert.equal(packageJson.publishConfig?.access, "public");
    assert.deepEqual(packageJson.files, ["dist"]);
    assert.equal(typeof packageJson.description, "string");
    assert.equal(packageJson.license, "PolyForm-Noncommercial-1.0.0");
    assert.equal(packageJson.repository?.url, "https://github.com/VPAI-Grok/AIC.git");
    assert.equal(packageJson.bugs?.url, "https://github.com/VPAI-Grok/AIC/issues");
    assert.ok(Array.isArray(packageJson.keywords));

    if (pkg.hasClientExport) {
      assert.ok(packageJson.exports["./client"]);
    }

    if (pkg.hasBin) {
      const binKey = typeof pkg.hasBin === "string" ? pkg.hasBin : "aic";
      assert.equal(typeof packageJson.bin?.[binKey], "string");
    }
  }
});

test("deferred packages and examples remain private", async () => {
  for (const relativePath of deferredPrivatePackages) {
    const packageJson = JSON.parse(await readFile(resolveFromRepo(relativePath), "utf8"));
    assert.equal(packageJson.private, true);
  }
});

test("packed npm tarballs rewrite workspace dependencies and only ship built files", async (t) => {
  const tempDir = await createTempDir("aic-pack-");
  t.after(async () => {
    await rm(tempDir, { force: true, recursive: true });
  });

  for (const pkg of publishablePackages) {
    const packageOutDir = resolve(tempDir, pkg.name.replaceAll("/", "__"));
    const tarballPath = await packPackage(pkg.path, packageOutDir);
    const packedManifest = JSON.parse(await readTarMember(tarballPath, "package/package.json"));
    const members = await listTarMembers(tarballPath);

    assert.equal(packedManifest.private, undefined);
    assert.equal(packedManifest.version, "0.1.0-alpha.0");
    assert.ok(members.some((member) => member.startsWith("package/dist/")));
    assert.equal(members.some((member) => member.startsWith("package/src/")), false);

    for (const dependencyBucket of ["dependencies", "peerDependencies", "optionalDependencies"]) {
      const bucket = packedManifest[dependencyBucket];

      if (!bucket || typeof bucket !== "object") {
        continue;
      }

      for (const version of Object.values(bucket)) {
        assert.equal(String(version).includes("workspace:"), false);
      }
    }

    if (pkg.hasClientExport) {
      assert.ok(members.includes("package/dist/sdk-react/src/client.js") || members.includes("package/dist/integrations-shadcn/src/client.js"));
    }

    if (pkg.hasBin) {
      const binKey = typeof pkg.hasBin === "string" ? pkg.hasBin : "aic";
      assert.equal(typeof packedManifest.bin?.[binKey], "string");
      const binPath = packedManifest.bin[binKey];
      assert.ok(members.some((m) => m.includes(binPath.replace("./", ""))));
    }
  }
});
