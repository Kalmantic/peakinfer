import type { InferenceMap, Insight, JoinedOutput, RuntimeSummary } from './types.js';
import { type RunInputs } from './runid.js';
export interface ArtifactData {
    inferenceMap?: InferenceMap;
    insights?: Insight[];
    joined?: JoinedOutput;
    runtime?: RuntimeSummary;
    html?: string;
}
export interface SaveOptions {
    runId?: string;
    inputs?: RunInputs;
    projectName?: string;
}
/**
 * Save all analysis artifacts to .peakinfer/runs/<runId>/ directory
 * Also maintains backward compatibility with root-level artifacts
 */
export declare function saveArtifacts(data: ArtifactData, outputDir?: string, options?: SaveOptions): string[];
/**
 * Get the output directory path
 */
export declare function getOutputDir(): string;
/**
 * Check if artifacts exist from a previous run
 */
export declare function artifactsExist(outputDir?: string): boolean;
/**
 * Check if a run can be resumed with cached artifacts
 */
export declare function checkResumable(inputs: RunInputs, outputDir?: string): {
    canResume: boolean;
    runId: string;
    runDir: string;
};
/**
 * Load artifacts from a previous run
 */
export declare function loadArtifacts(runDir: string): ArtifactData;
/**
 * Get a new run ID for given inputs
 */
export { generateRunId } from './runid.js';
