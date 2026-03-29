import { resolve } from "node:path";
import {
  analyzeProjectForAICAnnotations,
  generateProjectArtifacts,
  scanSourceForAICAnnotations,
  writeArtifactFiles,
  type AICProjectArtifacts,
  type AICProjectScanResult,
  type AICSourceScanMatch
} from "@aicorg/automation-core";
import type { AICPermissionsManifest, AICWorkflowManifest } from "@aicorg/spec";

export type ViteScanMatch = AICSourceScanMatch;
export type AICViteScanResult = AICProjectScanResult;

export interface AICViteArtifactsOptions {
  appName: string;
  appVersion?: string;
  generatedAt?: string;
  hmr?: boolean;
  notes?: string[];
  permissions?: Partial<AICPermissionsManifest>;
  projectRoot?: string;
  updatedAt?: string;
  viewId?: string;
  viewUrl?: string;
  workflows?: AICWorkflowManifest["workflows"];
}

const ARTIFACT_PATHS = new Set([
  "/.well-known/agent.json",
  "/.well-known/agent/ui",
  "/.well-known/agent/actions",
  "/agent-permissions.json",
  "/agent-workflows.json",
  "/operate.txt"
]);

export function scanViteSourceForAICAnnotations(source: string, file = "<memory>"): ViteScanMatch[] {
  return scanSourceForAICAnnotations(source, file).matches;
}

export async function analyzeViteProjectForAICAnnotations(projectRoot: string): Promise<AICViteScanResult> {
  return analyzeProjectForAICAnnotations(projectRoot);
}

export async function scanViteProjectForAICAnnotations(projectRoot: string): Promise<ViteScanMatch[]> {
  return (await analyzeViteProjectForAICAnnotations(projectRoot)).matches;
}

export async function generateViteArtifacts(
  options: AICViteArtifactsOptions
): Promise<AICProjectArtifacts & { hmr: boolean }> {
  const hmr = options.hmr ?? true;
  const artifacts = await generateProjectArtifacts({
    appName: options.appName,
    appVersion: options.appVersion,
    framework: "vite",
    generatedAt: options.generatedAt,
    notes: options.notes,
    operateNotes: [
      ...(options.notes ?? []),
      hmr ? "HMR metadata refresh enabled." : "HMR metadata refresh disabled."
    ],
    permissions: options.permissions,
    projectRoot: options.projectRoot,
    updatedAt: options.updatedAt,
    viewId: options.viewId ?? "vite.root",
    viewUrl: options.viewUrl ?? "http://localhost:5173",
    workflows: options.workflows
  });

  return {
    ...artifacts,
    hmr
  };
}

export function createAICVitePlugin(options: AICViteArtifactsOptions) {
  let projectRoot = options.projectRoot;
  let outDir = resolve(process.cwd(), "dist");

  return {
    hmr: options.hmr ?? true,
    name: "aic-vite",
    configResolved(config: { build?: { outDir?: string }; root?: string }) {
      projectRoot = options.projectRoot ?? config.root ?? process.cwd();
      outDir = resolve(config.root ?? process.cwd(), config.build?.outDir ?? "dist");
    },
    configureServer(server: {
      config: { root: string };
      middlewares: {
        use: (
          handler: (
            req: { url?: string },
            res: {
              end: (body: string) => void;
              setHeader: (name: string, value: string) => void;
              statusCode: number;
            },
            next: (error?: unknown) => void
          ) => void
        ) => void;
      };
    }) {
      server.middlewares.use((req, res, next) => {
        void (async () => {
          const pathname = (req.url ?? "").split("?")[0];

          if (!ARTIFACT_PATHS.has(pathname)) {
            next();
            return;
          }

          const artifacts = await generateViteArtifacts({
            ...options,
            projectRoot: projectRoot ?? server.config.root
          });
          const contents = artifacts.files[pathname];

          if (contents === undefined) {
            next();
            return;
          }

          res.statusCode = 200;
          res.setHeader(
            "content-type",
            pathname.endsWith(".txt") ? "text/plain; charset=utf-8" : "application/json; charset=utf-8"
          );
          res.end(contents);
        })().catch(next);
      });
    },
    async resolveArtifacts() {
      return generateViteArtifacts({
        ...options,
        projectRoot: projectRoot ?? options.projectRoot ?? process.cwd()
      });
    },
    async writeBundle() {
      const artifacts = await generateViteArtifacts({
        ...options,
        projectRoot: projectRoot ?? options.projectRoot ?? process.cwd()
      });
      await writeArtifactFiles(outDir, artifacts.files);
    }
  };
}
