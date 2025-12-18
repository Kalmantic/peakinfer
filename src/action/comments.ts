/**
 * PR Comment Generation (v1.6)
 *
 * Generates markdown PR comments for analysis results.
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

interface BaselineData {
  inferencePoints?: number;
  p95Latency?: number;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Format status indicator
 */
function formatStatus(status: 'pass' | 'warning' | 'fail'): string {
  const indicators: Record<string, string> = {
    pass: '[PASS]',
    warning: '[WARN]',
    fail: '[FAIL]',
  };
  return indicators[status] || status;
}

/**
 * Format baseline comparison
 */
function formatBaselineComparison(results: CommentData['results'], baseline: unknown): string {
  if (!baseline || typeof baseline !== 'object') return '';

  const base = baseline as BaselineData;
  const lines: string[] = [];

  lines.push('\n### Changes vs Baseline\n');
  lines.push('| Metric | Previous | Current | Delta |');
  lines.push('|--------|----------|---------|-------|');

  // Inference points
  const currentPoints = results.inferenceMap?.summary?.totalCallsites || 0;
  if (base.inferencePoints !== undefined) {
    const delta = currentPoints - base.inferencePoints;
    const deltaStr = delta >= 0 ? `+${delta}` : `${delta}`;
    lines.push(`| Inference Points | ${base.inferencePoints} | ${currentPoints} | ${deltaStr} |`);
  }

  // p95 Latency
  const currentLatency = results.runtime?.global?.p95;
  if (base.p95Latency !== undefined && currentLatency !== undefined) {
    const delta = currentLatency - base.p95Latency;
    const deltaPercent = (delta / base.p95Latency) * 100;
    const status = deltaPercent > 25 ? ' [!]' : '';
    lines.push(`| p95 Latency | ${base.p95Latency}ms | ${currentLatency}ms | ${deltaPercent >= 0 ? '+' : ''}${deltaPercent.toFixed(0)}%${status} |`);
  }

  return lines.join('\n');
}

/**
 * Format new issues section
 */
function formatNewIssues(newIssues: Insight[]): string {
  if (newIssues.length === 0) {
    return '\n### Changes in This PR\n\nNo new issues introduced.\n';
  }

  const lines: string[] = [];
  lines.push('\n### Changes in This PR\n');

  const bySeverity = {
    critical: newIssues.filter(i => i.severity === 'critical'),
    warning: newIssues.filter(i => i.severity === 'warning'),
    info: newIssues.filter(i => i.severity === 'info'),
  };

  for (const [severity, issues] of Object.entries(bySeverity)) {
    if (issues.length > 0) {
      lines.push(`\n**${severity.toUpperCase()}** (${issues.length}):\n`);
      for (const issue of issues.slice(0, 5)) {
        // Support both 'headline' (CLI) and 'title' (API) formats
        const title = issue.headline || (issue as unknown as { title?: string }).title || 'Issue';
        lines.push(`- ${title}`);
        if (issue.location) {
          lines.push(`  \`${issue.location}\``);
        }
      }
      if (issues.length > 5) {
        lines.push(`\n_...and ${issues.length - 5} more_`);
      }
    }
  }

  return lines.join('\n');
}

// =============================================================================
// MAIN
// =============================================================================

/**
 * Generate PR comment markdown
 */
export function generatePRComment(data: CommentData): string {
  const { results, baseline, status, regressions, newIssues } = data;

  const lines: string[] = [];

  // Header
  lines.push('## PeakInfer Analysis\n');

  // Summary table
  lines.push('### Summary\n');
  lines.push('| Metric | Value | Status |');
  lines.push('|--------|-------|--------|');

  const inferencePoints = results.inferenceMap?.summary?.totalCallsites || 0;
  lines.push(`| Inference Points | ${inferencePoints} | - |`);

  if (results.runtime?.global?.p95) {
    const p95Status = regressions.some(r => r.includes('latency')) ? '[!]' : '[OK]';
    lines.push(`| p95 Latency | ${results.runtime.global.p95}ms | ${p95Status} |`);
  }

  if (results.joined?.drift && Array.isArray(results.joined.drift)) {
    const driftCount = results.joined.drift.length;
    const driftStatus = driftCount > 0 ? '[*]' : '[OK]';
    lines.push(`| Drift Signals | ${driftCount} | ${driftStatus} |`);
  }

  const insightCount = results.insights?.length || 0;
  lines.push(`| Insights | ${insightCount} | - |`);

  // Baseline comparison
  if (baseline) {
    lines.push(formatBaselineComparison(results, baseline));
  }

  // New issues
  lines.push(formatNewIssues(newIssues));

  // Regressions
  if (regressions.length > 0) {
    lines.push('\n### Regressions\n');
    for (const r of regressions) {
      lines.push(`- ${r}`);
    }
  }

  // Status
  lines.push(`\n---\n**Status:** ${formatStatus(status)}`);

  // Footer
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
