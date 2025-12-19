/**
 * PR Comment Generation (v1.6)
 *
 * Generates markdown PR comments with verdict-first UX.
 * Design principle: User decides in 5 seconds, acts in 30.
 */

import type { Insight } from '../types.js';

// =============================================================================
// TYPES
// =============================================================================

interface CommentData {
  results: {
    inferenceMap?: {
      callsites: unknown[];
      summary: { totalCallsites: number; providers: string[]; models: string[] };
    };
    insights?: Insight[];
    runtime?: { global?: { p95: number } };
    joined?: { drift?: unknown[] };
  };
  baseline: unknown | null;
  status: 'pass' | 'warning' | 'fail';
  regressions: string[];
  newIssues: Insight[];
  changedFiles: string[];
  credits?: { used: number; limit: number; remaining: number };
}

interface Verdict {
  label: string;
  message: string;
  emoji: string;
}

interface BaselineData {
  inferencePoints?: number;
  p95Latency?: number;
}

// =============================================================================
// VERDICT LOGIC
// =============================================================================

/**
 * Determine verdict based on issues found.
 * Verdict is the first thing user sees - enables 5-second decision.
 */
function getVerdict(issues: Insight[]): Verdict {
  const critical = issues.filter(i => i.severity === 'critical');
  const warnings = issues.filter(i => i.severity === 'warning');

  if (critical.length >= 2) {
    return {
      label: 'Changes Requested',
      emoji: '🔴',
      message: `${critical.length} issues need attention before merge`,
    };
  }

  if (critical.length === 1) {
    return {
      label: 'Review Recommended',
      emoji: '🟡',
      message: '1 issue needs attention',
    };
  }

  if (warnings.length > 5) {
    return {
      label: 'Review Recommended',
      emoji: '🟡',
      message: `${warnings.length} improvements suggested`,
    };
  }

  if (warnings.length > 0) {
    return {
      label: 'Mostly Good',
      emoji: '🟢',
      message: `${warnings.length} optional improvement${warnings.length > 1 ? 's' : ''}`,
    };
  }

  return {
    label: 'Safe to Merge',
    emoji: '✅',
    message: 'No issues found',
  };
}

/**
 * Get the single most important issue to highlight.
 * User acts on one thing at a time - show them which one.
 */
function getTopIssue(issues: Insight[]): Insight | null {
  if (issues.length === 0) return null;

  // Priority: critical > warning > info
  const critical = issues.filter(i => i.severity === 'critical');
  if (critical.length > 0) return critical[0];

  const warnings = issues.filter(i => i.severity === 'warning');
  if (warnings.length > 0) return warnings[0];

  return issues[0];
}

/**
 * Get issue title, supporting both formats.
 */
function getIssueTitle(issue: Insight): string {
  return issue.headline || (issue as unknown as { title?: string }).title || 'Issue';
}

// =============================================================================
// FORMATTING
// =============================================================================

/**
 * Format the collapsible details section.
 * Shows ALL issues with locations and issue numbers for /fix commands.
 */
function formatDetailsSection(issues: Insight[]): string {
  if (issues.length <= 1) return '';

  const lines: string[] = [];

  lines.push(`\n<details open>`);
  lines.push(`<summary><strong>All ${issues.length} issues</strong> (click to collapse)</summary>\n`);
  lines.push('');
  lines.push('| # | Issue | Location | Fix |');
  lines.push('|---|-------|----------|-----|');

  // Show ALL issues with numbers for /fix command
  issues.forEach((issue, index) => {
    const num = index + 1;
    const title = getIssueTitle(issue);
    const location = issue.location ? `\`${issue.location}\`` : '-';
    const severity = issue.severity === 'critical' ? '🔴' : issue.severity === 'warning' ? '🟡' : '⚪';
    lines.push(`| ${severity} ${num} | ${title} | ${location} | \`/fix ${num}\` |`);
  });

  lines.push('\n</details>');
  return lines.join('\n');
}

// =============================================================================
// MAIN
// =============================================================================

/**
 * Generate PR comment markdown with verdict-first UX.
 *
 * Design: User decides in 5 seconds, acts in 30.
 * - Verdict first (Safe/Review/Changes Requested)
 * - Top issue highlighted (what to fix first)
 * - Details collapsed (for power users)
 * - Inline suggestions posted separately
 */
export function generatePRComment(data: CommentData): string {
  const { results, newIssues } = data;

  const lines: string[] = [];
  const verdict = getVerdict(newIssues);
  const topIssue = getTopIssue(newIssues);
  const inferencePoints = results.inferenceMap?.summary?.totalCallsites || 0;

  // Header with verdict - user knows in 5 seconds
  lines.push('## PeakInfer Analysis\n');
  lines.push(`**${verdict.emoji} ${verdict.label}** — ${verdict.message}\n`);

  // Top issue highlight - what to fix first
  if (topIssue) {
    const title = getIssueTitle(topIssue);
    lines.push('| | |');
    lines.push('|---|---|');
    lines.push(`| **Top Issue** | ${title} |`);
    if (topIssue.location) {
      lines.push(`| **Location** | \`${topIssue.location}\` |`);
    }
    if (topIssue.evidence) {
      lines.push(`| **Why it matters** | ${topIssue.evidence} |`);
    }
  } else {
    // Zero state - clean and simple
    lines.push(`Analyzed ${inferencePoints} inference point${inferencePoints !== 1 ? 's' : ''}, all following best practices.`);
  }

  // Collapsible details - for power users who want to see everything
  if (newIssues.length > 1) {
    lines.push(formatDetailsSection(newIssues));
  }

  // Commands footer - enable user interaction
  if (newIssues.length > 0) {
    lines.push('\n---');
    lines.push('**Commands:** `/fix 1` · `/dismiss 1` · `/fix all` · `/peakinfer`');
    lines.push('');
    lines.push('<sub>See inline comments for suggested fixes</sub>');
  }

  lines.push('\n<sub>Generated by [PeakInfer](https://github.com/Kalmantic/peakinfer)</sub>');

  return lines.join('\n');
}

/**
 * Generate comment for exhausted credits
 */
export function generateExhaustedComment(used: number, limit: number): string {
  const lines: string[] = [];

  lines.push('## PeakInfer Analysis\n');
  lines.push('### Free Tier Limit Reached\n');
  lines.push(`You've used **${used}/${limit}** free analyses this month.\n`);
  lines.push('**Options:**\n');
  lines.push('1. **Wait** - Limit resets at the start of next month');
  lines.push('2. **Use CLI (always free)** - Run with your own API key:');
  lines.push('   ```bash');
  lines.push('   npm i -g @kalmantic/peakinfer');
  lines.push('   export ANTHROPIC_API_KEY=your-key');
  lines.push('   peakinfer analyze ./src');
  lines.push('   ```');
  lines.push('\n---');
  lines.push('<sub>Generated by [PeakInfer](https://github.com/Kalmantic/peakinfer)</sub>');

  return lines.join('\n');
}
