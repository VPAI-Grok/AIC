import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  discoverPublishablePackages,
  orderPublishablePackages
} from "../scripts/pack-alpha-packages.mjs";
import { repoRoot, resolveFromRepo } from "./helpers.mjs";

const actionPins = new Set([
  "actions/checkout@11d5960a326750d5838078e36cf38b85af677262",
  "pnpm/action-setup@f40ffcd9367d9f12939873eb1018b921a783ffaa",
  "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020",
  "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02",
  "actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093"
]);

const reviewedPackageNames = [
  "@aicorg/ai-bootstrap",
  "@aicorg/ai-bootstrap-http",
  "@aicorg/ai-bootstrap-openai",
  "@aicorg/automation-core",
  "@aicorg/cli",
  "@aicorg/conformance-packs",
  "@aicorg/devtools",
  "@aicorg/evidence-core",
  "@aicorg/evidence-http",
  "@aicorg/evidence-mcp",
  "@aicorg/evidence-playwright",
  "@aicorg/integrations-radix",
  "@aicorg/integrations-shadcn",
  "@aicorg/mcp-server",
  "@aicorg/plugin-next",
  "@aicorg/plugin-vite",
  "@aicorg/reliance-server",
  "@aicorg/rely",
  "@aicorg/runner-remote",
  "@aicorg/runtime",
  "@aicorg/sdk-react",
  "@aicorg/spec",
  "@aicorg/verify-core",
  "@aicorg/webmcp"
];

function extractJob(workflow, jobName) {
  const lines = workflow.replaceAll("\r\n", "\n").split("\n");
  const start = lines.findIndex((line) => line === `  ${jobName}:`);
  assert.notEqual(start, -1, `Missing workflow job ${jobName}`);
  const end = lines.findIndex(
    (line, index) => index > start && /^  [a-zA-Z0-9_-]+:$/u.test(line)
  );
  return lines.slice(start, end === -1 ? undefined : end).join("\n");
}

test("publish workflow isolates OIDC from all repository execution", async () => {
  const workflow = await readFile(
    resolveFromRepo(".github/workflows/publish-packages.yml"),
    "utf8"
  );
  const verifyJob = extractJob(workflow, "verify-and-pack");
  const publishJob = extractJob(workflow, "publish-alpha");

  assert.match(workflow, /^permissions: \{\}$/mu);
  assert.match(verifyJob, /permissions:\n      contents: read/u);
  assert.doesNotMatch(verifyJob, /id-token:/u);
  assert.equal(workflow.match(/id-token:\s*write/gu)?.length, 1);
  assert.match(publishJob, /environment:\n      name: npm-alpha/u);
  assert.match(publishJob, /permissions:\n      id-token: write/u);
  assert.match(publishJob, /needs: verify-and-pack/u);
  assert.match(verifyJob, /if: github\.ref == 'refs\/heads\/main'/u);
  assert.match(publishJob, /if: github\.ref == 'refs\/heads\/main'/u);
  assert.match(verifyJob, /test "\$\{GITHUB_REF\}" = "refs\/heads\/main"/u);
  assert.match(verifyJob, /test "\$\(git rev-parse HEAD\)" = "\$\{GITHUB_SHA\}"/u);

  assert.match(verifyJob, /pnpm install --frozen-lockfile --ignore-scripts/u);
  assert.match(
    verifyJob,
    /npm --prefix actions\/aic-rely ci --ignore-scripts --no-audit --no-fund/u
  );
  assert.match(verifyJob, /pnpm verify:action-bundle/u);
  assert.match(verifyJob, /persist-credentials: false/u);
  assert.match(verifyJob, /pnpm check/u);
  assert.match(verifyJob, /pnpm build/u);
  assert.match(verifyJob, /pnpm test:contracts/u);
  assert.match(verifyJob, /pnpm test:goldens/u);
  assert.match(verifyJob, /pnpm test:packaging/u);
  assert.match(verifyJob, /pnpm release:pack/u);
  assert.match(verifyJob, /actions\/upload-artifact@/u);
  assert.ok(
    verifyJob.indexOf("pnpm release:pack") < verifyJob.indexOf("actions/upload-artifact@"),
    "Packing must complete before artifact upload"
  );

  assert.match(publishJob, /actions\/download-artifact@/u);
  assert.match(
    publishJob,
    /artifact-ids: \$\{\{ needs\.verify-and-pack\.outputs\.artifact-id \}\}/u
  );
  assert.match(publishJob, /merge-multiple: true/u);
  assert.match(publishJob, /sha256sum --check --strict SHA256SUMS/u);
  assert.match(publishJob, /downloaded_files/u);
  assert.match(publishJob, /! -type f/u);
  assert.match(publishJob, /npm >=11\.5\.1 is required/u);
  assert.match(publishJob, /registry-url: https:\/\/registry\.npmjs\.org\//u);
  assert.equal(
    publishJob.match(/--registry https:\/\/registry\.npmjs\.org\//gu)?.length,
    3
  );
  assert.match(
    publishJob,
    /npm view "\$package_name@\$package_version" version --json --registry https:\/\/registry\.npmjs\.org\//u
  );
  assert.match(
    publishJob,
    /npm view "\$package_name@\$package_version" dist\.integrity --json --registry https:\/\/registry\.npmjs\.org\//u
  );
  assert.match(publishJob, /test "\$registry_integrity" = "\$local_integrity"/u);
  assert.match(
    publishJob,
    /npm publish "\.\/\$tarball" --tag alpha --access public --provenance --ignore-scripts --registry https:\/\/registry\.npmjs\.org\//u
  );
  assert.doesNotMatch(publishJob, /actions\/checkout|pnpm\/action-setup/u);
  assert.doesNotMatch(publishJob, /\bpnpm\b|npm\s+(?:ci|i|install|exec)\b|\bnpx\b/u);
  assert.doesNotMatch(publishJob, /(?:node|bash|sh)\s+(?:\.\/)?scripts\//u);
  assert.doesNotMatch(workflow, /NODE_AUTH_TOKEN|NPM_TOKEN|npm-token/u);
});

test("every action in the publish workflow is pinned to its reviewed SHA", async () => {
  const workflow = await readFile(
    resolveFromRepo(".github/workflows/publish-packages.yml"),
    "utf8"
  );
  const refs = [...workflow.matchAll(/^\s*uses:\s*([^\s#]+)/gmu)].map(
    (match) => match[1]
  );

  assert.equal(refs.length, 6);
  for (const ref of refs) {
    assert.match(ref, /@[0-9a-f]{40}$/u);
    assert.ok(actionPins.has(ref), `Unreviewed action pin: ${ref}`);
  }
  for (const pin of actionPins) {
    assert.ok(refs.includes(pin), `Required action pin is absent: ${pin}`);
  }
});

test("publish workflow accepts every npm release at or above the trusted-publishing floor", async () => {
  const workflow = await readFile(
    resolveFromRepo(".github/workflows/publish-packages.yml"),
    "utf8"
  );
  const match = workflow.match(
    /node --input-type=module -e '\r?\n([\s\S]*?)\r?\n\s*' "\$npm_version"/u
  );
  assert.ok(match, "Unable to locate the inline npm version gate");

  for (const [version, expectedSuccess] of [
    ["11.5.0", false],
    ["11.5.1", true],
    ["11.5.2", true],
    ["11.6.0", true],
    ["12.0.0", true]
  ]) {
    const result = spawnSync(
      process.execPath,
      ["--input-type=module", "-e", match[1], version],
      { encoding: "utf8" }
    );
    assert.equal(
      result.status === 0,
      expectedSuccess,
      `${version}: ${result.stderr || result.stdout}`
    );
  }
  assert.equal(workflow.match(/node-version: 24\.20\.0/gu)?.length, 2);
});

test("existing-version idempotence compares registry SRI to the exact local tarball bytes", async () => {
  const workflow = await readFile(
    resolveFromRepo(".github/workflows/publish-packages.yml"),
    "utf8"
  );
  const match = workflow.match(
    /local_integrity="\$\(node --input-type=module -e '\r?\n([\s\S]*?)\r?\n\s*' "\$tarball"\)"/u
  );
  assert.ok(match, "Unable to locate the inline local SRI calculation");
  const fixture = resolveFromRepo("package.json");
  const expected = `sha512-${createHash("sha512")
    .update(await readFile(fixture))
    .digest("base64")}`;
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", match[1], fixture],
    { encoding: "utf8" }
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, expected);
});

test("alpha pack discovery and dependency order stay on the reviewed public surface", async () => {
  const discovered = await discoverPublishablePackages(repoRoot);
  assert.deepEqual(
    discovered.map((entry) => entry.name).sort(),
    reviewedPackageNames
  );

  const ordered = orderPublishablePackages(discovered);
  const positions = new Map(ordered.map((entry, index) => [entry.name, index]));
  for (const entry of ordered) {
    for (const section of [entry.manifest.dependencies, entry.manifest.optionalDependencies]) {
      for (const dependency of Object.keys(section ?? {})) {
        if (positions.has(dependency)) {
          assert.ok(
            positions.get(dependency) < positions.get(entry.name),
            `${dependency} must be packed before ${entry.name}`
          );
        }
      }
    }
  }
});

test("release docs identify the external protected-environment trust boundary", async () => {
  const documentation = await readFile(
    resolveFromRepo("docs/npm-trusted-publishing.md"),
    "utf8"
  );

  assert.match(documentation, /GitHub environment named exactly `npm-alpha`/u);
  assert.match(documentation, /required reviewer/u);
  assert.match(documentation, /Trusted Publisher/u);
  assert.match(documentation, /publish-packages\.yml/u);
  assert.match(documentation, /must not contain `NPM_TOKEN`/u);
  assert.match(documentation, /npm 11\.5\.1/u);
});
