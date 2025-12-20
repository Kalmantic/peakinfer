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
 * Get severity icon and label (CodeRabbit style)
 */
function getSeverityBadge(severity: string): { icon: string; label: string } {
  switch (severity) {
    case 'critical':
      return { icon: '🔴', label: 'Critical' };
    case 'warning':
      return { icon: '🟡', label: 'Medium' };
    default:
      return { icon: '🔵', label: 'Low' };
  }
}

/**
 * Format insight as inline comment body (CodeRabbit style).
 * Structure: Severity badge → Explanation → Collapsible fix with diff
 */
function formatInlineComment(insight: Insight, originalLine?: string): string {
  const lines: string[] = [];
  const title = getIssueTitle(insight);
  const badge = getSeverityBadge(insight.severity);

  // Severity badge header (CodeRabbit style)
  lines.push(`**⚠️ ${title}** | ${badge.icon} ${badge.label}`);
  lines.push('');

  // Full explanation
  if (insight.evidence) {
    lines.push(insight.evidence);
    lines.push('');
  }

  // Get fix content
  const suggestedFix = (insight as unknown as { suggestedFix?: string }).suggestedFix;
  const fullLineFix = (insight as unknown as { fullLineFix?: string }).fullLineFix;
  const originalCode = (insight as unknown as { originalCode?: string }).originalCode;

  // Collapsible proposed fix section (CodeRabbit style)
  if (fullLineFix) {
    const fixDescription = insight.recommendation || 'Apply this fix';
    lines.push('<details>');
    lines.push(`<summary>🔧 Proposed fix: ${fixDescription}</summary>`);
    lines.push('');

    // Show diff if we have original code
    if (originalCode) {
      lines.push('```diff');
      lines.push(`- ${originalCode.trim()}`);
      lines.push(`+ ${fullLineFix.trim()}`);
      lines.push('```');
    } else {
      // Fallback to suggestion syntax for one-click apply
      lines.push('```suggestion');
      lines.push(fullLineFix);
      lines.push('```');
    }

    lines.push('');
    lines.push('</details>');
  } else if (suggestedFix) {
    lines.push('<details>');
    lines.push(`<summary>🔧 Proposed fix: Add ${suggestedFix.trim()}</summary>`);
    lines.push('');
    lines.push('```typescript');
    lines.push(suggestedFix);
    lines.push('```');
    lines.push('');
    lines.push('</details>');
  } else if (insight.recommendation) {
    lines.push(`**🔧 Fix:** ${insight.recommendation}`);
  }

  lines.push('');
  lines.push('---');
  lines.push('<sub>🏔️ PeakInfer</sub>');

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
