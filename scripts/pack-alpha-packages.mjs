import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
  access,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const defaultRepoRoot = resolve(scriptDirectory, "..");
const alphaVersionPattern = /^\d+\.\d+\.\d+-alpha\.\d+$/u;
const packageNamePattern = /^@aicorg\/[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const utf8Decoder = new TextDecoder("utf-8", { fatal: true });

function parseArguments(argv) {
  const args = argv[0] === "--" ? argv.slice(1) : argv;
  let outDir = ".artifacts/npm-alpha";

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== "--out-dir" || !args[index + 1]) {
      throw new Error(
        "Usage: node scripts/pack-alpha-packages.mjs [--out-dir <directory>]"
      );
    }
    outDir = args[index + 1];
    index += 1;
  }

  return { outDir };
}

async function readJson(path) {
  return JSON.parse(utf8Decoder.decode(await readFile(path)));
}

function internalDependencies(manifest, packageNames) {
  const dependencySections = [manifest.dependencies, manifest.optionalDependencies];
  const dependencies = new Set();

  for (const section of dependencySections) {
    if (!section) {
      continue;
    }
    for (const name of Object.keys(section)) {
      if (packageNames.has(name)) {
        dependencies.add(name);
      }
    }
  }

  return [...dependencies].sort();
}

export async function discoverPublishablePackages(repoRoot = defaultRepoRoot) {
  const packagesRoot = resolve(repoRoot, "packages");
  const entries = (await readdir(packagesRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name));
  const packages = [];

  for (const entry of entries) {
    const packageRoot = join(packagesRoot, entry.name);
    const manifestPath = join(packageRoot, "package.json");

    try {
      await access(manifestPath);
    } catch {
      continue;
    }

    const manifest = await readJson(manifestPath);
    if (manifest.private === true) {
      continue;
    }
    if (manifest.publishConfig?.access !== "public") {
      throw new Error(`${relative(repoRoot, manifestPath)} must declare publishConfig.access=public`);
    }
    if (!packageNamePattern.test(manifest.name ?? "")) {
      throw new Error(`${relative(repoRoot, manifestPath)} has an invalid publishable package name`);
    }
    if (!alphaVersionPattern.test(manifest.version ?? "")) {
      throw new Error(
        `${manifest.name} must use an explicit alpha prerelease version before packing`
      );
    }

    packages.push({
      manifest,
      name: manifest.name,
      packageRoot,
      version: manifest.version
    });
  }

  if (packages.length === 0) {
    throw new Error("No public @aicorg packages were discovered");
  }

  return packages;
}

export function orderPublishablePackages(packages) {
  const byName = new Map(packages.map((entry) => [entry.name, entry]));
  if (byName.size !== packages.length) {
    throw new Error("Publishable package names must be unique");
  }

  const packageNames = new Set(byName.keys());
  const remainingDependencies = new Map(
    packages.map((entry) => [
      entry.name,
      new Set(internalDependencies(entry.manifest, packageNames))
    ])
  );
  const ordered = [];

  while (remainingDependencies.size > 0) {
    const ready = [...remainingDependencies.entries()]
      .filter(([, dependencies]) => dependencies.size === 0)
      .map(([name]) => name)
      .sort();

    if (ready.length === 0) {
      throw new Error(
        `Publishable packages contain a dependency cycle: ${[
          ...remainingDependencies.keys()
        ].sort().join(", ")}`
      );
    }

    for (const name of ready) {
      ordered.push(byName.get(name));
      remainingDependencies.delete(name);
      for (const dependencies of remainingDependencies.values()) {
        dependencies.delete(name);
      }
    }
  }

  return ordered;
}

async function ensureEmptyOutputDirectory(outDir) {
  try {
    const outputStat = await stat(outDir);
    if (!outputStat.isDirectory()) {
      throw new Error(`Pack output exists and is not a directory: ${outDir}`);
    }
    if ((await readdir(outDir)).length > 0) {
      throw new Error(`Pack output directory must be empty: ${outDir}`);
    }
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
    await mkdir(outDir, { recursive: true });
  }
}

async function sha256(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function packPackage(entry, repoRoot, stagingRoot, outDir) {
  const packageStagingDirectory = join(
    stagingRoot,
    entry.name.replace(/^@/u, "").replaceAll("/", "-")
  );
  await mkdir(packageStagingDirectory, { recursive: true });

  const pnpmCli = resolve(repoRoot, "node_modules/pnpm/bin/pnpm.cjs");
  await access(pnpmCli);
  await execFileAsync(
    process.execPath,
    [pnpmCli, "pack", "--pack-destination", packageStagingDirectory],
    {
      cwd: entry.packageRoot,
      env: {
        ...process.env,
        COREPACK_HOME: resolve(repoRoot, ".artifacts/corepack")
      },
      maxBuffer: 10 * 1024 * 1024
    }
  );

  const packedFiles = (await readdir(packageStagingDirectory)).filter((file) =>
    file.endsWith(".tgz")
  );
  if (packedFiles.length !== 1) {
    throw new Error(`${entry.name} produced ${packedFiles.length} tarballs; expected one`);
  }

  const filename = packedFiles[0];
  if (!/^aicorg-[a-z0-9-]+-\d+\.\d+\.\d+-alpha\.\d+\.tgz$/u.test(filename)) {
    throw new Error(`${entry.name} produced an unexpected tarball filename: ${filename}`);
  }

  const source = join(packageStagingDirectory, filename);
  const destination = join(outDir, filename);
  await rename(source, destination);

  const { stdout } = await execFileAsync(
    "tar",
    ["-xOf", destination, "package/package.json"],
    {
      encoding: "buffer",
      maxBuffer: 1024 * 1024
    }
  );
  const packedManifest = JSON.parse(utf8Decoder.decode(stdout));
  if (packedManifest.name !== entry.name || packedManifest.version !== entry.version) {
    throw new Error(
      `${filename} contains ${packedManifest.name}@${packedManifest.version}, expected ${entry.name}@${entry.version}`
    );
  }

  return {
    filename,
    name: entry.name,
    sha256: await sha256(destination),
    version: entry.version
  };
}

export async function packAlphaPackages({
  outDir = ".artifacts/npm-alpha",
  repoRoot = defaultRepoRoot
} = {}) {
  const resolvedRepoRoot = resolve(repoRoot);
  const resolvedOutDir = resolve(resolvedRepoRoot, outDir);
  const relativeOutput = relative(resolvedRepoRoot, resolvedOutDir);
  if (
    relativeOutput === "" ||
    relativeOutput.startsWith("..") ||
    resolve(resolvedRepoRoot, relativeOutput) !== resolvedOutDir
  ) {
    throw new Error("Pack output must be a directory inside the repository");
  }

  await ensureEmptyOutputDirectory(resolvedOutDir);
  const stagingRoot = join(resolvedOutDir, ".staging");
  await mkdir(stagingRoot);

  try {
    const packages = orderPublishablePackages(
      await discoverPublishablePackages(resolvedRepoRoot)
    );
    const artifacts = [];
    for (const entry of packages) {
      artifacts.push(
        await packPackage(entry, resolvedRepoRoot, stagingRoot, resolvedOutDir)
      );
    }

    const publishPlan = [
      "package\tversion\ttarball\tsha256",
      ...artifacts.map(
        (artifact) =>
          `${artifact.name}\t${artifact.version}\t${artifact.filename}\t${artifact.sha256}`
      ),
      ""
    ].join("\n");
    const checksums = [
      ...artifacts.map((artifact) => `${artifact.sha256}  ${artifact.filename}`),
      ""
    ].join("\n");

    await writeFile(join(resolvedOutDir, "publish-plan.tsv"), publishPlan, "utf8");
    await writeFile(join(resolvedOutDir, "SHA256SUMS"), checksums, "utf8");

    return artifacts;
  } finally {
    await rm(stagingRoot, { force: true, recursive: true });
  }
}

async function main() {
  const { outDir } = parseArguments(process.argv.slice(2));
  const artifacts = await packAlphaPackages({ outDir });
  process.stdout.write(
    `Packed ${artifacts.length} immutable alpha tarballs in ${outDir}\n`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
