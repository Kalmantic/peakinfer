/**
 * History Storage Module (v1.5)
 *
 * Enables persistent storage of analysis runs for:
 * - Historical comparison (Feature 2)
 * - Deploy-time prediction (Feature 3)
 *
 * Directory structure:
 *   .peakinfer/
 *   └── history/
 *       ├── index.json       # Global index of all runs
 *       └── <runId>/         # Individual run storage
 *           ├── manifest.json
 *           ├── inference-map.json
 *           └── analysis.json
 */
import type { HistoryManifest, AnalysisType, InferenceMap, Insight, JoinedOutput, RuntimeSummary } from './types.js';
export interface AnalysisData {
    inferenceMap?: InferenceMap;
    insights?: Insight[];
    joined?: JoinedOutput;
    runtime?: RuntimeSummary;
}
export interface SaveRunOptions {
    path: string;
    analysisType: AnalysisType;
    data: AnalysisData;
    durationMs?: number;
    htmlPath?: string;
    pdfPath?: string;
}
export interface LoadedRun {
    manifest: HistoryManifest;
    data: AnalysisData;
}
/**
 * Get the history directory path (relative to cwd or specified base)
 */
export declare function getHistoryDir(baseDir?: string): string;
/**
 * Create a deterministic hash from a normalized path.
 * Used for efficient lookup of runs for a specific project.
 */
export declare function hashPath(path: string): string;
/**
 * Save an analysis run to history.
 * Returns the run ID for reference.
 */
export declare function saveRun(options: SaveRunOptions, baseDir?: string): string;
/**
 * Load a specific run by ID.
 */
export declare function loadRun(runId: string, baseDir?: string): LoadedRun | null;
/**
 * List all runs for a specific path (or all runs if no path specified).
 * Returns runs sorted by timestamp (most recent first).
 */
export declare function listRuns(path?: string, baseDir?: string): HistoryManifest[];
/**
 * Get the most recent run for a path.
 * Returns null if no history exists.
 */
export declare function getLatestRun(path: string, baseDir?: string): LoadedRun | null;
/**
 * Prune old runs, keeping only the most recent N runs per path.
 * Returns the number of runs deleted.
 */
export declare function pruneHistory(keepCount?: number, baseDir?: string): number;
/**
 * Delete a specific run by ID.
 * Returns true if the run was deleted, false if not found.
 */
export declare function deleteRun(runId: string, baseDir?: string): boolean;
/**
 * Clear all history (delete everything).
 * Returns the number of runs deleted.
 */
export declare function clearAllHistory(baseDir?: string): number;
