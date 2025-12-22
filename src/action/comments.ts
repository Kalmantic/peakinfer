/**
 * PR Comment Generation (v1.6)
 *
 * Generates markdown PR comments aligned with CLI UX and DD v1.6.
 * Structure: Summary → Issues → Verdict
 * Design: Clean, accessible, text labels not colors.
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
  repoContext?: {
    owner: string;
    repo: string;
    sha: string;
    baseSha?: string;
    prNumber?: number;
  };
  // v1.8: Runtime correlation gap messaging
  hasRuntime?: boolean;
  runtimeEventCount?: number;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Get issue title, supporting both formats.
 */
function getIssueTitle(issue: Insight): string {
  return issue.headline || (issue as unknown as { title?: string }).title || 'Issue';
}

/**
 * Generate GitHub blob link for file:line
 */
function formatLocation(
  location: string | undefined,
  repoContext?: { owner: string; repo: string; sha: string }
): string {
  if (!location) return '-';

  // Parse file:line format
  const match = location.match(/^(.+):(\d+)$/);
  if (!match) return `\`${location}\``;

  const [, file, line] = match;

  // If we have repo context, make it a clickable link
  if (repoContext) {
    const { owner, repo, sha } = repoContext;
    const url = `https://github.com/${owner}/${repo}/blob/${sha}/${file}#L${line}`;
    return `[${file}:${line}](${url})`;
  }

  return `\`${file}:${line}\``;
}

/**
 * Determine verdict text based on issues found.
 * Uses text labels per DD Section 3.7 (Accessible by Design).
 */
function getVerdictText(critical: number, warnings: number): string {
  if (critical >= 2) {
    return `**Review required** — ${critical} critical issues need attention before merge.`;
  }
  if (critical === 1) {
    return `**Review recommended** — 1 critical issue needs attention.`;
  }
  if (warnings > 5) {
    return `**Review recommended** — ${warnings} warnings found.`;
  }
  if (warnings > 0) {
    return `**Safe to merge** — ${warnings} optional improvement${warnings > 1 ? 's' : ''} found.`;
  }
  return `**Safe to merge** — No issues found.`;
}

// =============================================================================
// MAIN
// =============================================================================

/**
 * Get severity badge (CodeRabbit style)
 */
function getSeverityBadge(severity: string): string {
  switch (severity) {
    case 'critical': return '🔴 Critical';
    case 'warning': return '🟡 Medium';
    default: return '🔵 Low';
  }
}

/**
 * Generate PR comment markdown (CodeRabbit style).
 *
 * Structure: Header → Commits → Files → Summary → Issues → Verdict → Finishing Touches
 */
export function generatePRComment(data: CommentData): string {
  const { results, newIssues, credits, repoContext, changedFiles } = data;

  const lines: string[] = [];
  const inferencePoints = results.inferenceMap?.summary?.totalCallsites || 0;
  const criticalIssues = newIssues.filter(i => i.severity === 'critical');
  const warningIssues = newIssues.filter(i => i.severity === 'warning');

  // Header
  lines.push('## 🏔️ PeakInfer Analysis\n');

  // Commits section (CodeRabbit style - collapsible)
  if (repoContext?.baseSha && repoContext?.sha) {
    lines.push('<details>');
    lines.push('<summary>📝 Commits</summary>\n');
    const shortBase = repoContext.baseSha.substring(0, 7);
    const shortHead = repoContext.sha.substring(0, 7);
    lines.push(`Reviewing files from \`${shortBase}\` to \`${shortHead}\``);
    lines.push('\n</details>\n');
  }

  // Files section (CodeRabbit style - collapsible)
  if (changedFiles && changedFiles.length > 0) {
    lines.push('<details>');
    lines.push(`<summary>📁 Files analyzed (${changedFiles.length})</summary>\n`);
    for (const file of changedFiles.slice(0, 20)) {
      lines.push(`- \`${file}\``);
    }
    if (changedFiles.length > 20) {
      lines.push(`- ... and ${changedFiles.length - 20} more`);
    }
    lines.push('\n</details>\n');
  }

  // Summary section
  lines.push('### Summary\n');
  lines.push(`**Inference Points:** ${inferencePoints}  `);
  if (newIssues.length > 0) {
    const parts: string[] = [];
    if (criticalIssues.length > 0) parts.push(`🔴 ${criticalIssues.length} critical`);
    if (warningIssues.length > 0) parts.push(`🟡 ${warningIssues.length} warning${warningIssues.length > 1 ? 's' : ''}`);
    lines.push(`**Issues:** ${parts.join(', ')}\n`);
  } else {
    lines.push('**Issues:** ✅ None\n');
  }

  // v1.8: Runtime Correlation section (per PRD v1.9 §0 - Ship the JOIN)
  // v1.8.2: Updated with concrete example per Magic Moment Implementation Spec
  lines.push('### Runtime Correlation\n');
  if (data.hasRuntime) {
    lines.push(`✅ Analyzed **${data.runtimeEventCount?.toLocaleString() || 0} runtime events**\n`);
    if (results.joined?.drift && Array.isArray(results.joined.drift) && results.joined.drift.length > 0) {
      lines.push('**🔴 Drift Detected** — Code behavior differs from runtime reality.\n');
    }
  } else {
    // Concrete example instead of feature list (Magic Moment spec)
    lines.push('🔒 **What You\'re Missing**\n');
    lines.push('');
    lines.push('**Real finding from similar codebase:**\n');
    lines.push('');
    lines.push('| Code | Runtime | Impact |');
    lines.push('|------|---------|--------|');
    lines.push('| `streaming: true` | 0% actual streams | **6x latency** |');
    lines.push('');
    lines.push(`This PR touches **${inferencePoints} inference point${inferencePoints !== 1 ? 's' : ''}**. What's YOUR drift?\n`);
    lines.push('');
    lines.push('<details>');
    lines.push('<summary>📊 Add runtime correlation</summary>\n');
    lines.push('```yaml');
    lines.push('- uses: kalmantic/peakinfer-action@v1');
    lines.push('  with:');
    lines.push('    path: ./src');
    lines.push('    runtime: ./events.jsonl  # Your production logs');
    lines.push('```');
    lines.push('');
    lines.push('→ [Events format guide](https://peakinfer.com/docs/events)');
    lines.push('\n</details>\n');
  }

  // Issues section with inline fixes
  if (newIssues.length > 0) {
    lines.push('### Issues\n');

    // Show issues with locations and fixes
    const issuesWithLocations = newIssues.filter(i => i.location);
    const issuesWithoutLocations = newIssues.filter(i => !i.location);

    // Issues with locations - show with code fixes (CodeRabbit style)
    if (issuesWithLocations.length > 0) {
      // Group by location to avoid duplicate entries
      const byLocation = new Map<string, typeof issuesWithLocations>();
      for (const issue of issuesWithLocations) {
        const loc = issue.location || '';
        if (!byLocation.has(loc)) byLocation.set(loc, []);
        byLocation.get(loc)!.push(issue);
      }

      let count = 0;
      for (const [loc, issues] of byLocation) {
        if (count >= 5) break;
        count++;

        const location = formatLocation(loc, repoContext);
        const criticals = issues.filter(i => i.severity === 'critical');
        const warnings = issues.filter(i => i.severity === 'warning');

        lines.push(`#### ${location}`);

        // Show issues at this location (CodeRabbit style)
        for (const issue of [...criticals, ...warnings].slice(0, 3)) {
          const title = getIssueTitle(issue);
          const badge = getSeverityBadge(issue.severity);
          const fullLineFix = (issue as unknown as { fullLineFix?: string }).fullLineFix;
          const originalCode = (issue as unknown as { originalCode?: string }).originalCode;

          lines.push(`**⚠️ ${title}** | ${badge}`);
          if (issue.evidence) {
            lines.push(`> ${issue.evidence}`);
          }

          if (fullLineFix) {
            lines.push('<details>');
            lines.push(`<summary>🔧 Proposed fix: ${issue.recommendation || 'Apply this change'}</summary>\n`);

            if (originalCode) {
              lines.push('```diff');
              lines.push(`- ${originalCode.trim()}`);
              lines.push(`+ ${fullLineFix.trim()}`);
              lines.push('```');
            } else {
              lines.push('```typescript');
              lines.push(`// Replace with:`);
              lines.push(fullLineFix);
              lines.push('```');
            }
            lines.push('\n</details>');
          } else if (issue.recommendation) {
            lines.push(`**🔧 Fix:** ${issue.recommendation}`);
          }
          lines.push('');
        }
      }
    }

    // Generic issues collapsed
    if (issuesWithoutLocations.length > 0) {
      lines.push('<details>');
      lines.push(`<summary>📋 ${issuesWithoutLocations.length} general recommendations</summary>\n`);
      for (const issue of issuesWithoutLocations.slice(0, 10)) {
        const title = getIssueTitle(issue);
        lines.push(`- ${title}`);
      }
      lines.push('\n</details>\n');
    }
  }

  // Verdict section
  lines.push('### Verdict\n');
  lines.push(getVerdictText(criticalIssues.length, warningIssues.length));
  lines.push('');

  // Finishing touches section (CodeRabbit style)
  lines.push('<details>');
  lines.push('<summary>✨ Finishing touches</summary>\n');
  lines.push('#### Follow-up actions');
  lines.push('- [ ] Review inline comments and apply suggested fixes');
  lines.push('- [ ] Add error handling where missing');
  lines.push('- [ ] Consider model downgrades for cost optimization');
  lines.push('\n</details>\n');

  // Footer
  lines.push('---');
  if (credits) {
    lines.push(`<sub>📊 ${credits.used}/${credits.limit} free analyses this month · [PeakInfer](https://github.com/Kalmantic/peakinfer)</sub>`);
  } else {
    lines.push('<sub>Generated by [PeakInfer](https://github.com/Kalmantic/peakinfer)</sub>');
  }

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
  lines.push('1. **Wait** — Limit resets at the start of next month');
  lines.push('2. **Use CLI (always free)** — Run with your own API key:');
  lines.push('   ```bash');
  lines.push('   npm i -g @kalmantic/peakinfer');
  lines.push('   export ANTHROPIC_API_KEY=your-key');
  lines.push('   peakinfer analyze ./src');
  lines.push('   ```');
  lines.push('\n---');
  lines.push('<sub>Generated by [PeakInfer](https://github.com/Kalmantic/peakinfer)</sub>');

  return lines.join('\n');
}
