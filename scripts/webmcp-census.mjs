#!/usr/bin/env node
// Scans public WebMCP repositories and records how many registered tools carry
// enforceable risk semantics. Reproducible: clone the listed repos, point the
// script at the parent directory, and re-run.
//
//   node scripts/webmcp-census.mjs <clone-parent-dir> --out-file docs/evidence/webmcp-census.json

import { execFile } from "node:child_process";
import { readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const CLI = resolve("packages/cli/dist/cli/src/index.js");

/**
 * `kind` separates applications that expose tools to agents from libraries that
 * implement the registration API. Counting a polyfill's own `registerTool` as
 * an ungoverned application tool would inflate the result.
 */
const SUBJECTS = [
  { repo: "GoogleChromeLabs/webmcp-tools", dir: "webmcp-tools", kind: "application", note: "Official Chrome demos and inspector" },
  { repo: "vincanger/webmcp-espresso-store", dir: "espresso", kind: "application", note: "Wasp storefront, 16 hand-written tools" },
  { repo: "WebMCP-org/examples", dir: "examples", kind: "application", note: "Framework integration examples" },
  {
    repo: "Leanmcp-Community/music-composer-webmcp",
    dir: "music-composer-webmcp",
    kind: "application",
    note: "Piano-roll composer with an app-local runtime shim",
    // Registers through its own runtime singleton, which assigns to
    // navigator.modelContext. Static scanning cannot attribute those calls to
    // WebMCP without matching every `.registerTool(` in any codebase, so the
    // tool count here was counted by hand and is marked as such.
    undetected_pattern: "app_local_runtime_shim",
    manual_tool_count: 23
  },
  { repo: "WebMCP-org/chrome-devtools-quickstart", dir: "chrome-devtools-quickstart", kind: "application", note: "DevTools MCP quickstart" },
  { repo: "GoogleChromeLabs/use-webmcp-tool", dir: "use-webmcp-tool", kind: "library", note: "Official React hook" },
  { repo: "WebMCP-org/npm-packages", dir: "npm-packages", kind: "library", note: "Polyfill, hooks, transports" },
  { repo: "LeanMCP/leanmcp-sdk", dir: "leanmcp-sdk", kind: "library", note: "TypeScript/Python SDK" }
];

// Verbs that denote a state change a user would not want an agent to take
// uninvited. Used only to characterize the sample, never to gate anything.
const MUTATION_VERBS =
  /^(add|apply|book|buy|cancel|checkout|clear|confirm|create|customize|delete|humanize|order|pay|place|remove|reset|save|send|set|submit|update)_/;

async function scan(path) {
  try {
    const { stdout } = await run(process.execPath, [CLI, "scan", path, "--webmcp"], {
      maxBuffer: 64 * 1024 * 1024
    });
    return JSON.parse(stdout);
  } catch (error) {
    // `aic scan --webmcp` exits non-zero when it finds blockers; the report is
    // still on stdout and is exactly what the census needs.
    if (error.stdout) {
      try {
        return JSON.parse(error.stdout);
      } catch {
        /* fall through */
      }
    }
    return undefined;
  }
}

async function collectToolNames(root) {
  const names = new Set();
  const stack = [root];

  while (stack.length > 0) {
    const current = stack.pop();
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const path = resolve(current, entry.name);
      if (entry.isDirectory()) {
        if (["node_modules", ".git", "dist", "build", ".next"].includes(entry.name)) continue;
        stack.push(path);
        continue;
      }
      if (!/\.(ts|tsx|js|jsx|mjs)$/.test(entry.name)) continue;

      const source = await readFileSafe(path);
      for (const match of source.matchAll(/\bname:\s*["']([a-z][a-z0-9_]{2,})["']/g)) {
        names.add(match[1]);
      }
    }
  }

  return [...names].sort();
}

async function readFileSafe(path) {
  const { readFile } = await import("node:fs/promises");
  try {
    return await readFile(path, "utf8");
  } catch {
    return "";
  }
}

async function main() {
  const [parentDir] = process.argv.slice(2).filter((value) => !value.startsWith("--"));
  if (!parentDir) {
    console.error("usage: node scripts/webmcp-census.mjs <clone-parent-dir> [--out-file <path>]");
    process.exit(2);
  }

  const outIndex = process.argv.indexOf("--out-file");
  const outFile = outIndex === -1 ? undefined : process.argv[outIndex + 1];
  const subjects = [];

  for (const subject of SUBJECTS) {
    const path = resolve(parentDir, `census-${subject.dir}`);
    const report = await scan(path);
    if (!report) {
      subjects.push({ ...subject, error: "scan_failed" });
      continue;
    }

    const toolNames = await collectToolNames(path);
    const mutations = toolNames.filter((name) => MUTATION_VERBS.test(name));

    subjects.push({
      ...subject,
      declarative_tools: report.summary.declarative_tools,
      detected_registrations: report.summary.current_native_registrations,
      files_scanned: report.summary.files_scanned,
      governed_registrations: report.summary.governed_registrations,
      mutation_tool_names: mutations,
      obsolete_api_usages: report.summary.obsolete_api_usages,
      status: report.status,
      tool_names_found: toolNames.length,
      ungoverned_registrations: report.summary.direct_native_registrations,
      ...(subject.manual_tool_count === undefined
        ? {}
        : { manual_tool_count: subject.manual_tool_count }),
      ...(subject.undetected_pattern === undefined
        ? {}
        : { undetected_pattern: subject.undetected_pattern })
    });
  }

  const applications = subjects.filter((item) => item.kind === "application" && !item.error);
  const sum = (items, key) => items.reduce((total, item) => total + (item[key] ?? 0), 0);

  const census = {
    artifact_type: "aic_webmcp_census",
    generated_at: new Date().toISOString(),
    method:
      "aic scan <repo> --webmcp over shallow clones of every public WebMCP repository discoverable from awesome-webmcp, the WebMCP spec repo, and GoogleChromeLabs.",
    subjects,
    totals: {
      applications: applications.length,
      application_governed_registrations: sum(applications, "governed_registrations"),
      application_registrations: sum(applications, "detected_registrations"),
      application_ungoverned_registrations: sum(applications, "ungoverned_registrations"),
      obsolete_api_usages: sum(subjects.filter((item) => !item.error), "obsolete_api_usages"),
      // Tools that exist and are callable but that static scanning does not
      // attribute, because the app wraps registration in its own abstraction.
      manually_counted_tools: sum(applications, "manual_tool_count"),
      repositories: subjects.length
    }
  };

  const serialized = `${JSON.stringify(census, null, 2)}\n`;
  if (outFile) {
    await writeFile(resolve(outFile), serialized, "utf8");
    console.error(`wrote ${outFile}`);
  } else {
    process.stdout.write(serialized);
  }
}

await main();
