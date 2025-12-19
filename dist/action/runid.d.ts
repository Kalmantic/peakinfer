import type { InferenceMap, Insight, JoinedOutput, RuntimeSummary } from './types.js';
export interface RunInputs {
    repoRoot?: string;
    eventsPath?: string;
    offline?: boolean;
}
export interface RunManifest {
    runId: string;
    version: string;
    createdAt: string;
    inputs: {
        repoRoot?: string;
        repoHash?: string;
        eventsPath?: string;
        eventsHash?: string;
        offline: boolean;
    };
    artifacts: string[];
    status: 'complete' | 'partial' | 'failed';
}
export interface CachedArtifacts {
    inferenceMap?: InferenceMap;
    insights?: Insight[];
    joined?: JoinedOutput;
    runtime?: RuntimeSummary;
}
/**
 * Generate a deterministic run ID based on inputs
 *
 * runId = hash(version, repoHash?, eventsHash?, offline)
 *
 * This ensures:
 * - Same inputs = same runId = can resume
 * - Changed inputs = new runId = fresh analysis
 */
export declare function generateRunId(inputs: RunInputs): string;
/**
 * Get the run directory path
 */
export declare function getRunDir(baseDir: string, runId: string): string;
/**
 * Create run manifest
 */
export declare function createManifest(runId: string, inputs: RunInputs, artifacts: string[], status: 'complete' | 'partial' | 'failed'): RunManifest;
/**
 * Load run manifest if it exists
 */
export declare function loadManifest(runDir: string): RunManifest | null;
/**
 * Check if a run can be resumed (all artifacts exist and inputs haven't changed)
 */
export declare function canResume(runDir: string, inputs: RunInputs): boolean;
/**
 * Load cached artifacts from a previous run
 */
export declare function loadCachedArtifacts(runDir: string): CachedArtifacts;
