/**
 * Historical Comparison Module (v1.5)
 *
 * Compares current analysis with previous runs to surface:
 * - New inference points (pre-deploy validation)
 * - Removed inference points (cleanup validation)
 * - Changed configurations (drift detection)
 *
 * Enables tracking changes over time for informed deployment decisions.
 */
import type { Callsite, Insight, ComparisonResult } from './types.js';
export interface CompareOptions {
    /** Specific run ID to compare against (default: latest) */
    baseRunId?: string;
    /** Include insight comparison (default: true) */
    compareInsights?: boolean;
}
export interface AnalysisSnapshot {
    runId: string;
    timestamp: string;
    callsites: Callsite[];
    insights?: Insight[];
}
/**
 * Compare two analysis snapshots.
 */
export declare function compareSnapshots(baseline: AnalysisSnapshot, current: AnalysisSnapshot, options?: CompareOptions): ComparisonResult;
/**
 * Compare current analysis with the latest historical run for a path.
 * Returns null if no history exists.
 */
export declare function compareWithLatest(path: string, current: AnalysisSnapshot, options?: CompareOptions): Promise<ComparisonResult | null>;
/**
 * Compare current analysis with a specific historical run.
 * Returns null if the run doesn't exist.
 */
export declare function compareWithRun(runId: string, current: AnalysisSnapshot, options?: CompareOptions): Promise<ComparisonResult | null>;
/**
 * Format a comparison result as a human-readable summary.
 * Provides concise, actionable summary for pre-deploy review.
 */
export declare function formatComparisonSummary(comparison: ComparisonResult): string;
/**
 * Check if comparison has significant changes that warrant attention.
 * Used to highlight important changes in the output.
 */
export declare function hasSignificantChanges(comparison: ComparisonResult): boolean;
