/**
 * Diff-Aware Filtering (v1.6)
 *
 * Gets changed files in PR and filters insights to only those
 * affecting changed files.
 */
import type { Insight } from '../types.js';
type Octokit = any;
type Context = any;
/**
 * Get list of files changed in the PR
 */
export declare function getChangedFiles(octokit: Octokit, context: Context): Promise<string[]>;
/**
 * Filter source files to only those changed in the PR.
 * Used for faster "changed-files-only" analysis mode.
 */
export declare function filterFilesToChanged(files: Array<{
    path: string;
    content: string;
}>, changedFiles: string[]): Array<{
    path: string;
    content: string;
}>;
/**
 * Detect events file in PR (auto-discovery per PRD v1.9.3).
 *
 * User flow:
 * 1. User sees PR comment showing static analysis
 * 2. Curious about runtime — exports logs locally
 * 3. Commits events.jsonl to branch or uploads to .peakinfer/
 * 4. Action detects and re-runs with full correlation
 */
export declare function detectEventsFile(octokit: Octokit, context: Context): Promise<string | null>;
/**
 * Filter insights to those affecting changed files
 *
 * Returns:
 * - newIssues: Issues in files changed by this PR
 * - preExisting: Issues in files not changed by this PR
 */
export declare function filterToChangedFiles(insights: Insight[], changedFiles: string[]): {
    newIssues: Insight[];
    preExisting: Insight[];
};
export {};
//# sourceMappingURL=diff.d.ts.map