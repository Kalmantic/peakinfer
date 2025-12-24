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
 * Filter source files to only those changed in the PR.
 * Used for faster "changed-files-only" analysis mode.
 */
export function filterFilesToChanged(
  files: Array<{ path: string; content: string }>,
  changedFiles: string[]
): Array<{ path: string; content: string }> {
  if (changedFiles.length === 0) {
    return files; // No PR context, return all files
  }

  // Normalize paths for comparison
  const normalizedChanged = new Set(
    changedFiles.map(f => f.replace(/^\.\//, '').toLowerCase())
  );

  return files.filter(file => {
    // Normalize the file path for comparison
    const normalizedPath = file.path
      .replace(/^\.\//, '')
      .replace(/\\/g, '/')
      .toLowerCase();

    // Check if file or any of its path variants are in changed files
    return normalizedChanged.has(normalizedPath) ||
           changedFiles.some(cf =>
             normalizedPath.endsWith(cf.replace(/^\.\//, '').toLowerCase())
           );
  });
}

/**
 * Detect events file in PR (auto-discovery per PRD v1.9.3).
 *
 * User flow:
 * 1. User sees PR comment showing static analysis
 * 2. Curious about runtime — exports logs locally
 * 3. Commits events.jsonl to branch or uploads to .peakinfer/
 * 4. Action detects and re-runs with full correlation
 */
export async function detectEventsFile(
  octokit: Octokit,
  context: Context
): Promise<string | null> {
  const pr = context.payload.pull_request;
  if (!pr) {
    return null;
  }

  try {
    const { data: files } = await octokit.rest.pulls.listFiles({
      owner: context.repo.owner,
      repo: context.repo.repo,
      pull_number: pr.number,
    });

    // Look for events files in order of preference:
    // 1. .peakinfer/events.jsonl
    // 2. events.jsonl in root
    // 3. Any file ending with events.jsonl
    // 4. Any file in .peakinfer/ with .jsonl extension
    const eventPatterns = [
      /^\.peakinfer\/events\.jsonl$/,
      /^events\.jsonl$/,
      /events\.jsonl$/,
      /^\.peakinfer\/.+\.jsonl$/,
      /^\.peakinfer\/.+\.json$/,
    ];

    for (const pattern of eventPatterns) {
      const match = files.find((f: { filename: string }) => pattern.test(f.filename));
      if (match) {
        return match.filename;
      }
    }

    return null;
  } catch {
    return null;
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
