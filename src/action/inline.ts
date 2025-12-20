/**
 * Inline PR Comments (v1.6)
 *
 * Posts inline comments with suggested fixes on specific files/lines.
 * Design aligned with DD v1.6: Clean, text labels, no emoji clutter.
 */

import type { Insight } from '../types.js';

/**
 * Parse location string to file and line
 */
function parseLocation(location?: string): { file?: string; line?: number } {
  if (!location) return {};
  const match = location.match(/^(.+):(\d+)$/);
  if (match) {
    return { file: match[1], line: parseInt(match[2], 10) };
  }
  return { file: location };
}

// =============================================================================
// CONSTANTS
// =============================================================================

// With Option A (minimal summary), inline comments carry all the detail
// Increased to 10 to cover most issues
const MAX_INLINE_COMMENTS = 10;

// =============================================================================
// TYPES
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Octokit = any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Context = any;

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Get severity score for sorting
 */
function severityScore(insight: Insight): number {
  const scores: Record<string, number> = {
    critical: 3,
    warning: 2,
    info: 1,
  };
  return scores[insight.severity] || 0;
}

/**
 * Get issue title, supporting both formats.
 */
function getIssueTitle(insight: Insight): string {
  return insight.headline || (insight as unknown as { title?: string }).title || 'Issue';
}

/**
 * Get severity label for accessible indication.
 * Uses text labels per DD Section 3.7 (don't rely on color alone).
 */
function getSeverityLabel(severity: string): string {
  switch (severity) {
    case 'critical': return 'CRITICAL';
    case 'warning': return 'WARNING';
    default: return 'INFO';
  }
}

/**
 * Format insight as inline comment body with optional suggested fix.
 * Uses GitHub's suggestion syntax when a fix is available.
 * Design: Clean, text labels, show line context.
 */
function formatInlineComment(insight: Insight, originalLine?: string): string {
  const lines: string[] = [];
  const title = getIssueTitle(insight);
  const label = getSeverityLabel(insight.severity);

  // Clear headline with severity label
  lines.push(`**${label}:** ${title}`);
  lines.push('');

  // Why it matters
  if (insight.evidence) {
    lines.push(insight.evidence);
    lines.push('');
  }

  // Suggested fix using GitHub's suggestion syntax
  const suggestedFix = (insight as unknown as { suggestedFix?: string }).suggestedFix;
  const fullLineFix = (insight as unknown as { fullLineFix?: string }).fullLineFix;

  if (fullLineFix) {
    // Full line replacement - shows "Apply suggestion" button
    lines.push('**Fix:** Click "Apply suggestion" below');
    lines.push('```suggestion');
    lines.push(fullLineFix);
    lines.push('```');
  } else if (suggestedFix) {
    lines.push(`**Fix:** Add \`${suggestedFix.trim()}\``);
  } else if (insight.recommendation) {
    lines.push(`**Fix:** ${insight.recommendation}`);
  }

  lines.push('');
  lines.push('<sub>PeakInfer</sub>');

  return lines.join('\n');
}

// =============================================================================
// MAIN
// =============================================================================

/**
 * Post inline comments on PR files
 *
 * Returns count of posted and omitted comments
 */
export async function postInlineComments(
  octokit: Octokit,
  context: Context,
  insights: Insight[]
): Promise<{ posted: number; omitted: number }> {
  const pr = context.payload.pull_request;
  if (!pr) {
    return { posted: 0, omitted: 0 };
  }

  // Sort by severity and take top N (only those with valid locations)
  const topInsights = insights
    .filter(i => {
      const loc = parseLocation(i.location);
      return loc.file && loc.line;
    })
    .sort((a, b) => severityScore(b) - severityScore(a))
    .slice(0, MAX_INLINE_COMMENTS);

  let posted = 0;

  for (const insight of topInsights) {
    const loc = parseLocation(insight.location);
    if (!loc.file || !loc.line) continue;

    try {
      await octokit.rest.pulls.createReviewComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        pull_number: pr.number,
        body: formatInlineComment(insight),
        commit_id: pr.head.sha,
        path: loc.file,
        line: loc.line,
        side: 'RIGHT',
      });
      posted++;
    } catch {
      // Skip if comment fails (e.g., file not in PR diff)
      continue;
    }
  }

  const omitted = Math.max(0, insights.length - MAX_INLINE_COMMENTS);
  return { posted, omitted };
}
