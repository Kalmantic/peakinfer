/**
 * Inline PR Comments (v1.6 - Option A)
 *
 * With Option A, the summary comment is minimal (verdict only).
 * All details are in inline comments on specific files/lines.
 *
 * Design: User goes to "Files changed" tab, sees issues in context,
 * clicks "Apply suggestion" → fixed. No copy-paste.
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
 * Get severity emoji for visual indication.
 */
function getSeverityEmoji(severity: string): string {
  switch (severity) {
    case 'critical': return '🔴';
    case 'warning': return '🟡';
    default: return '⚪';
  }
}

/**
 * Format insight as inline comment body with optional suggested fix.
 * Uses GitHub's suggestion syntax when a fix is available.
 *
 * With Option A, these comments carry all the detail (summary is minimal).
 */
function formatInlineComment(insight: Insight): string {
  const lines: string[] = [];
  const title = getIssueTitle(insight);
  const emoji = getSeverityEmoji(insight.severity);

  // Clear headline with severity - what's the problem
  lines.push(`${emoji} **${title}**`);
  lines.push('');

  // Why it matters - not just "this is bad"
  if (insight.evidence) {
    lines.push(`> ${insight.evidence}`);
    lines.push('');
  }

  // Suggested fix using GitHub's suggestion syntax
  // When user clicks "Apply suggestion", it's committed automatically
  const suggestedFix = (insight as unknown as { suggestedFix?: string }).suggestedFix;
  if (suggestedFix) {
    lines.push('**Suggested fix:**');
    lines.push('```suggestion');
    lines.push(suggestedFix);
    lines.push('```');
    lines.push('');
    lines.push('Click **Apply suggestion** to commit this fix.');
  } else if (insight.recommendation) {
    // Fallback to text recommendation if no code fix available
    lines.push(`**Recommendation:** ${insight.recommendation}`);
    lines.push('');
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
