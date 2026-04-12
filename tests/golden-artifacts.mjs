import assert from "node:assert/strict";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { importWorkspaceModule, readJsonFile, resolveFromRepo } from "./helpers.mjs";

const automationCore = await importWorkspaceModule(
  "packages/automation-core/dist/automation-core/src/index.js"
);
const pluginNext = await importWorkspaceModule("packages/plugin-next/dist/plugin-next/src/index.js");
const pluginVite = await importWorkspaceModule("packages/plugin-vite/dist/plugin-vite/src/index.js");

const fixtureRoot = resolveFromRepo("tests/fixtures/plugin-app");

const PROJECT_FIXTURES = {
  "example-nextjs-checkout-demo": {
    configFile: resolveFromRepo("examples/nextjs-checkout-demo/aic.project.json"),
    expectedDir: resolveFromRepo("examples/nextjs-checkout-demo/public"),
    framework: "nextjs",
    generator: "project"
  },
  "example-react-basic": {
    configFile: resolveFromRepo("examples/react-basic/aic.project.json"),
    expectedDir: resolveFromRepo("examples/react-basic/public"),
    framework: "vite",
    generator: "project"
  },
  next: {
    configFile: resolveFromRepo("tests/fixtures/plugin-app/project.next.json"),
    expectedDir: resolveFromRepo("tests/fixtures/plugin-app/expected/next"),
    framework: "nextjs",
    generator: "plugin-next"
  },
  vite: {
    configFile: resolveFromRepo("tests/fixtures/plugin-app/project.vite.json"),
    expectedDir: resolveFromRepo("tests/fixtures/plugin-app/expected/vite"),
    framework: "vite",
    generator: "plugin-vite"
  }
};

function normalizeRelativePath(pathValue) {
  return pathValue.replaceAll("\\", "/").replace(/^\/+/, "");
}

function sortObject(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sortObject(item));
  }

  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = sortObject(value[key]);
        return result;
      }, {});
  }

  return value;
}

async function ensureCleanDirectory(rootDir) {
  await rm(rootDir, { force: true, recursive: true });
  await mkdir(rootDir, { recursive: true });
}

async function writeFileMap(rootDir, fileMap) {
  await Promise.all(
    Object.entries(fileMap).map(async ([relativePath, contents]) => {
      const filePath = resolve(rootDir, relativePath);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, contents, "utf8");
    })
  );
}

export async function readDirectoryFileMap(rootDir, baseDir = rootDir) {
  const resolvedRoot = resolve(rootDir);
  const resolvedBaseDir = resolve(baseDir);
  const rootStat = await stat(resolvedRoot).catch(() => undefined);

  if (!rootStat?.isDirectory()) {
    return {};
  }

  const entries = await readdir(resolvedRoot, { withFileTypes: true });
  const nestedEntries = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = resolve(resolvedRoot, entry.name);

      if (entry.isDirectory()) {
        return readDirectoryFileMap(entryPath, resolvedBaseDir);
      }

      return {
        [normalizeRelativePath(entryPath.slice(`${resolvedBaseDir}/`.length))]: await readFile(entryPath, "utf8")
      };
    })
  );

  return nestedEntries.reduce((result, entry) => Object.assign(result, entry), {});
}

function compareFileMaps(expected, actual) {
  const mismatches = [];
  const paths = Array.from(new Set([...Object.keys(expected), ...Object.keys(actual)])).sort();

  paths.forEach((relativePath) => {
    if (!(relativePath in expected)) {
      mismatches.push({ path: relativePath, reason: "unexpected" });
      return;
    }

    if (!(relativePath in actual)) {
      mismatches.push({ path: relativePath, reason: "missing" });
      return;
    }

    if (expected[relativePath] !== actual[relativePath]) {
      mismatches.push({ path: relativePath, reason: "changed" });
    }
  });

  return mismatches;
}

async function loadProjectFixtureConfig(name) {
  const fixture = PROJECT_FIXTURES[name];

  if (!fixture) {
    throw new Error(`Unknown golden fixture "${name}".`);
  }

  const config = await readJsonFile(fixture.configFile);
  return {
    ...config,
    projectRoot:
      fixture.generator === "project"
        ? resolve(dirname(fixture.configFile), config.projectRoot ?? ".")
        : resolve(fixtureRoot, config.projectRoot ?? ".")
  };
}

function getOperateNotes(config) {
  return config.framework === "vite"
    ? [
        ...(config.notes ?? []),
        config.hmr === false ? "HMR metadata refresh disabled." : "HMR metadata refresh enabled."
      ]
    : config.notes;
}

export async function generateGoldenProjectFixture(name) {
  const fixture = PROJECT_FIXTURES[name];
  const config = await loadProjectFixtureConfig(name);
  const artifacts =
    fixture.generator === "project"
      ? await automationCore.generateProjectArtifacts({
          ...config,
          operateNotes: getOperateNotes(config)
        })
      : fixture.generator === "plugin-vite"
        ? await pluginVite.generateViteArtifacts(config)
        : await pluginNext.generateNextArtifacts(config);
  const report = automationCore.createProjectArtifactReport(fixture.framework, artifacts, {
    projectRoot: config.projectRoot
  });
  const files = Object.fromEntries(
    Object.entries({
      ...artifacts.files,
      "/report.json": `${JSON.stringify(sortObject(report), null, 2)}\n`
    }).map(([relativePath, contents]) => [normalizeRelativePath(relativePath), contents])
  );

  return {
    artifacts,
    expectedDir: fixture.expectedDir,
    files,
    framework: fixture.framework,
    report
  };
}

export async function readExpectedGoldenProjectFixture(name) {
  const fixture = PROJECT_FIXTURES[name];

  if (!fixture) {
    throw new Error(`Unknown golden fixture "${name}".`);
  }

  return {
    expectedDir: fixture.expectedDir,
    files: await readDirectoryFileMap(fixture.expectedDir),
    framework: fixture.framework
  };
}

export async function assertGoldenProjectFixture(name, actualFiles) {
  const expected = await readExpectedGoldenProjectFixture(name);
  assert.deepEqual(sortObject(actualFiles), sortObject(expected.files));
}

export async function verifyGoldenProjectFixtures(options = {}) {
  const actualDir = options.actualDir ? resolve(options.actualDir) : undefined;
  const results = [];

  if (actualDir) {
    await ensureCleanDirectory(actualDir);
  }

  for (const name of Object.keys(PROJECT_FIXTURES).sort()) {
    const generated = await generateGoldenProjectFixture(name);
    const expected = await readExpectedGoldenProjectFixture(name);
    const mismatches = compareFileMaps(expected.files, generated.files);

    if (actualDir) {
      await writeFileMap(resolve(actualDir, name), generated.files);
    }

    results.push({
      expectedDir: expected.expectedDir,
      framework: generated.framework,
      mismatches,
      name
    });
  }

  if (actualDir) {
    await writeFile(
      resolve(actualDir, "comparison.json"),
      `${JSON.stringify(sortObject({ results }), null, 2)}\n`,
      "utf8"
    );
  }

  return {
    ok: results.every((result) => result.mismatches.length === 0),
    results
  };
}

export async function updateGoldenProjectFixtures() {
  for (const name of Object.keys(PROJECT_FIXTURES).sort()) {
    const generated = await generateGoldenProjectFixture(name);
    await ensureCleanDirectory(generated.expectedDir);
    await writeFileMap(generated.expectedDir, generated.files);
  }
}
