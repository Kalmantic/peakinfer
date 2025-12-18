/**
 * Diff-Aware Filtering (v1.6)
 *
 * Gets changed files in PR and filters insights to only those
 * affecting changed files.
 */

import type { Insight } from '../types.js';

/**
 * Parse location string to extract file path
 */
function parseLocationFile(location?: string): string | undefined {
  if (!location) return undefined;
  const match = location.match(/^(.+):(\d+)$/);
  if (match) {
    return match[1];
  }
  return location;
}

// =============================================================================
// TYPES
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Octokit = any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Context = any;

// =============================================================================
// MAIN
// =============================================================================

/**
 * Get list of files changed in the PR
 */
export async function getChangedFiles(
  octokit: Octokit,
  context: Context
): Promise<string[]> {
  const pr = context.payload.pull_request;
  if (!pr) {
    return [];
  }

  try {
    const { data } = await octokit.rest.pulls.listFiles({
      owner: context.repo.owner,
      repo: context.repo.repo,
      pull_number: pr.number,
    });

    return data.map((f: { filename: string }) => f.filename);
  } catch {
    return [];
  }
}

/**
 * Filter insights to those affecting changed files
 *
 * Returns:
 * - newIssues: Issues in files changed by this PR
 * - preExisting: Issues in files not changed by this PR
 */
export function filterToChangedFiles(
  insights: Insight[],
  changedFiles: string[]
): { newIssues: Insight[]; preExisting: Insight[] } {
  // Normalize paths for comparison
  const normalizedChanged = new Set(
    changedFiles.map(f => f.replace(/^\.\//, ''))
  );

  const newIssues: Insight[] = [];
  const preExisting: Insight[] = [];

  for (const insight of insights) {
    const file = parseLocationFile(insight.location);
    if (!file) {
      // No file associated, treat as new
      newIssues.push(insight);
      continue;
    }

    const normalizedFile = file.replace(/^\.\//, '');

    if (normalizedChanged.has(normalizedFile)) {
      newIssues.push(insight);
    } else {
      preExisting.push(insight);
    }
  }

  return { newIssues, preExisting };
}
