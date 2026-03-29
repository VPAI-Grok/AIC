import {
  analyzeProjectForAICAnnotations,
  generateProjectArtifacts,
  scanSourceForAICAnnotations,
  type AICProjectArtifacts,
  type AICProjectScanResult,
  type AICSourceScanMatch
} from "@aicorg/automation-core";
import type { AICPermissionsManifest, AICWorkflowManifest } from "@aicorg/spec";

export type NextScanMatch = AICSourceScanMatch;
export type AICNextScanResult = AICProjectScanResult;

export interface AICNextArtifactsOptions {
  appName: string;
  appVersion?: string;
  framework?: string;
  generatedAt?: string;
  notes?: string[];
  permissions?: Partial<AICPermissionsManifest>;
  projectRoot?: string;
  updatedAt?: string;
  viewId?: string;
  viewUrl?: string;
  workflows?: AICWorkflowManifest["workflows"];
}

export function scanNextSourceForAICAnnotations(source: string, file = "<memory>"): NextScanMatch[] {
  return scanSourceForAICAnnotations(source, file).matches;
}

export async function analyzeNextProjectForAICAnnotations(projectRoot: string): Promise<AICNextScanResult> {
  return analyzeProjectForAICAnnotations(projectRoot);
}

export async function scanNextProjectForAICAnnotations(projectRoot: string): Promise<NextScanMatch[]> {
  return (await analyzeNextProjectForAICAnnotations(projectRoot)).matches;
}

export async function generateNextArtifacts(options: AICNextArtifactsOptions): Promise<AICProjectArtifacts> {
  return generateProjectArtifacts({
    appName: options.appName,
    appVersion: options.appVersion,
    framework: options.framework ?? "nextjs",
    generatedAt: options.generatedAt,
    notes: options.notes,
    permissions: options.permissions,
    projectRoot: options.projectRoot,
    updatedAt: options.updatedAt,
    viewId: options.viewId ?? "next.root",
    viewUrl: options.viewUrl ?? "http://localhost:3000",
    workflows: options.workflows
  });
}

export function createAICNextPlugin(options: AICNextArtifactsOptions) {
  return {
    async resolveArtifacts() {
      return generateNextArtifacts(options);
    },
    name: "aic-next"
  };
}
