import assert from "node:assert/strict";
import { access, mkdir, readFile, readdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import {
  createTempDir,
  resolveFromRepo,
  runNode,
  writeJsonFile
} from "./helpers.mjs";

const ecosystemPackages = [
  {
    exportName: "getAICBuiltInConformancePack",
    name: "@aicorg/conformance-packs",
    path: "packages/conformance-packs"
  },
  {
    exportName: "createAICEvidenceBundle",
    name: "@aicorg/evidence-core",
    path: "packages/evidence-core"
  },
  {
    exportName: "createAICHttpEvidenceAdapter",
    name: "@aicorg/evidence-http",
    path: "packages/evidence-http"
  },
  {
    exportName: "createAICMcpEvidenceAdapter",
    name: "@aicorg/evidence-mcp",
    path: "packages/evidence-mcp"
  },
  {
    exportName: "runAICRemoteObservation",
    name: "@aicorg/runner-remote",
    path: "packages/runner-remote"
  }
];

const pnpmCli = resolveFromRepo("node_modules/pnpm/bin/pnpm.cjs");

async function packPackage(packagePath, destination) {
  await mkdir(destination, { recursive: true });
  const result = await runNode(
    [pnpmCli, "pack", "--pack-destination", destination],
    { cwd: resolveFromRepo(packagePath) }
  );
  assert.equal(result.code, 0, result.stderr);
  const tarballs = (await readdir(destination)).filter((file) => file.endsWith(".tgz"));
  assert.equal(tarballs.length, 1);
  return resolve(destination, tarballs[0]);
}

test("packed conformance, evidence, and runner packages import from a clean consumer", async (t) => {
  const tempDir = await createTempDir("aic-evidence-pack-");
  t.after(async () => {
    await rm(tempDir, { force: true, recursive: true });
  });

  const packageDefinitions = [
    { name: "@aicorg/spec", path: "packages/spec" },
    ...ecosystemPackages
  ];
  const packed = new Map();
  for (const pkg of packageDefinitions) {
    packed.set(
      pkg.name,
      await packPackage(pkg.path, resolve(tempDir, "tarballs", pkg.name.replaceAll("/", "__")))
    );
  }

  const consumer = resolve(tempDir, "consumer");
  const tarballDependencies = Object.fromEntries(
    [...packed].map(([name, tarball]) => [name, `file:${tarball.replaceAll("\\", "/")}`])
  );
  await writeJsonFile(resolve(consumer, "package.json"), {
    dependencies: tarballDependencies,
    name: "aic-evidence-package-smoke",
    pnpm: { overrides: tarballDependencies },
    private: true,
    type: "module",
    version: "0.0.0"
  });
  const install = await runNode(
    [pnpmCli, "install", "--offline", "--ignore-scripts"],
    { cwd: consumer }
  );
  assert.equal(install.code, 0, `${install.stdout}\n${install.stderr}`);

  for (const pkg of ecosystemPackages) {
    const packageDirectory = resolve(consumer, "node_modules", ...pkg.name.split("/"));
    const manifest = JSON.parse(await readFile(resolve(packageDirectory, "package.json"), "utf8"));
    assert.equal(manifest.main, manifest.exports?.["."]?.import);
    assert.equal(manifest.types, manifest.exports?.["."]?.types);
    assert.match(manifest.main, /^\.\/dist\/.+\/src\/index\.js$/);
    assert.match(manifest.types, /^\.\/dist\/.+\/src\/index\.d\.ts$/);
    await access(resolve(packageDirectory, manifest.main));
    await access(resolve(packageDirectory, manifest.types));
  }

  const smokeSource = ecosystemPackages
    .map(
      (pkg, index) =>
        `const module${index} = await import(${JSON.stringify(pkg.name)});\n` +
        `if (typeof module${index}[${JSON.stringify(pkg.exportName)}] !== "function") throw new Error(${JSON.stringify(`Missing ${pkg.exportName} from ${pkg.name}`)});`
    )
    .join("\n");
  const imported = await runNode(["--input-type=module", "--eval", smokeSource], { cwd: consumer });
  assert.equal(imported.code, 0, imported.stderr);
});
