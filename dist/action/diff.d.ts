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