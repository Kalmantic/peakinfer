import { describe, it, expect } from 'vitest';
import { generatePRComment, generateExhaustedComment } from '../../src/action/comments.js';
import type { Insight } from '../../src/types.js';

// =============================================================================
// HELPER: Create mock insight
// =============================================================================

function createInsight(overrides: Partial<Insight> = {}): Insight {
  return {
    templateId: overrides.templateId || 'test-template',
    headline: overrides.headline || 'Test issue headline',
    evidence: overrides.evidence || 'Test evidence',
    severity: overrides.severity || 'warning',
    category: overrides.category || 'cost',
    location: overrides.location || 'src/test.ts:10',
    recommendation: overrides.recommendation,
  };
}

// =============================================================================
// VERDICT TESTS
// =============================================================================

describe('Verdict Logic', () => {
  it('returns "Safe to Merge" when no issues', () => {
    const comment = generatePRComment({
      results: {
        inferenceMap: {
          callsites: [],
          summary: { totalCallsites: 5, providers: ['openai'], models: ['gpt-4'] },
        },
      },
      baseline: null,
      status: 'pass',
      regressions: [],
      newIssues: [],
      changedFiles: [],
    });

    expect(comment).toContain('✅ Safe to Merge');
    expect(comment).toContain('No issues found');
    expect(comment).toContain('5 inference points');
  });

  it('returns "Mostly Good" for 1-5 warnings', () => {
    const comment = generatePRComment({
      results: {
        inferenceMap: {
          callsites: [],
          summary: { totalCallsites: 3, providers: ['openai'], models: ['gpt-4'] },
        },
      },
      baseline: null,
      status: 'warning',
      regressions: [],
      newIssues: [
        createInsight({ severity: 'warning', headline: 'Warning 1' }),
        createInsight({ severity: 'warning', headline: 'Warning 2' }),
      ],
      changedFiles: [],
    });

    expect(comment).toContain('🟢 Mostly Good');
    expect(comment).toContain('2 optional improvements');
  });

  it('returns "Review Recommended" for 1 critical issue', () => {
    const comment = generatePRComment({
      results: {
        inferenceMap: {
          callsites: [],
          summary: { totalCallsites: 3, providers: ['openai'], models: ['gpt-4'] },
        },
      },
      baseline: null,
      status: 'warning',
      regressions: [],
      newIssues: [
        createInsight({ severity: 'critical', headline: 'Critical issue' }),
      ],
      changedFiles: [],
    });

    expect(comment).toContain('🟡 Review Recommended');
    expect(comment).toContain('1 issue needs attention');
  });

  it('returns "Review Recommended" for >5 warnings', () => {
    const warnings = Array(7).fill(null).map((_, i) =>
      createInsight({ severity: 'warning', headline: `Warning ${i + 1}` })
    );

    const comment = generatePRComment({
      results: {
        inferenceMap: {
          callsites: [],
          summary: { totalCallsites: 3, providers: ['openai'], models: ['gpt-4'] },
        },
      },
      baseline: null,
      status: 'warning',
      regressions: [],
      newIssues: warnings,
      changedFiles: [],
    });

    expect(comment).toContain('🟡 Review Recommended');
    expect(comment).toContain('7 improvements suggested');
  });

  it('returns "Changes Requested" for ≥2 critical issues', () => {
    const comment = generatePRComment({
      results: {
        inferenceMap: {
          callsites: [],
          summary: { totalCallsites: 3, providers: ['openai'], models: ['gpt-4'] },
        },
      },
      baseline: null,
      status: 'fail',
      regressions: [],
      newIssues: [
        createInsight({ severity: 'critical', headline: 'Critical 1' }),
        createInsight({ severity: 'critical', headline: 'Critical 2' }),
        createInsight({ severity: 'critical', headline: 'Critical 3' }),
      ],
      changedFiles: [],
    });

    expect(comment).toContain('🔴 Changes Requested');
    expect(comment).toContain('3 issues need attention before merge');
  });
});

// =============================================================================
// TOP ISSUE TESTS
// =============================================================================

describe('Top Issue Highlight', () => {
  it('shows the highest severity issue first', () => {
    const comment = generatePRComment({
      results: {
        inferenceMap: {
          callsites: [],
          summary: { totalCallsites: 3, providers: ['openai'], models: ['gpt-4'] },
        },
      },
      baseline: null,
      status: 'warning',
      regressions: [],
      newIssues: [
        createInsight({ severity: 'info', headline: 'Info issue' }),
        createInsight({ severity: 'critical', headline: 'Critical issue', location: 'src/api.ts:45' }),
        createInsight({ severity: 'warning', headline: 'Warning issue' }),
      ],
      changedFiles: [],
    });

    expect(comment).toContain('**Top Issue**');
    expect(comment).toContain('Critical issue');
    expect(comment).toContain('`src/api.ts:45`');
  });

  it('shows evidence as "Why it matters"', () => {
    const comment = generatePRComment({
      results: {
        inferenceMap: {
          callsites: [],
          summary: { totalCallsites: 3, providers: ['openai'], models: ['gpt-4'] },
        },
      },
      baseline: null,
      status: 'warning',
      regressions: [],
      newIssues: [
        createInsight({
          severity: 'critical',
          headline: 'Missing error handling',
          evidence: 'Unhandled failures will crash the service',
        }),
      ],
      changedFiles: [],
    });

    expect(comment).toContain('**Why it matters**');
    expect(comment).toContain('Unhandled failures will crash the service');
  });
});

// =============================================================================
// COLLAPSIBLE DETAILS TESTS
// =============================================================================

describe('Collapsible Details', () => {
  it('does not show details section for single issue', () => {
    const comment = generatePRComment({
      results: {
        inferenceMap: {
          callsites: [],
          summary: { totalCallsites: 3, providers: ['openai'], models: ['gpt-4'] },
        },
      },
      baseline: null,
      status: 'warning',
      regressions: [],
      newIssues: [
        createInsight({ severity: 'critical', headline: 'Single issue' }),
      ],
      changedFiles: [],
    });

    expect(comment).not.toContain('<details>');
  });

  it('shows collapsible details for multiple issues', () => {
    const comment = generatePRComment({
      results: {
        inferenceMap: {
          callsites: [],
          summary: { totalCallsites: 3, providers: ['openai'], models: ['gpt-4'] },
        },
      },
      baseline: null,
      status: 'warning',
      regressions: [],
      newIssues: [
        createInsight({ severity: 'critical', headline: 'Critical 1' }),
        createInsight({ severity: 'warning', headline: 'Warning 1' }),
        createInsight({ severity: 'warning', headline: 'Warning 2' }),
      ],
      changedFiles: [],
    });

    expect(comment).toContain('<details>');
    expect(comment).toContain('See all 3 issues');
    expect(comment).toContain('</details>');
  });

  it('groups issues by severity in details', () => {
    const comment = generatePRComment({
      results: {
        inferenceMap: {
          callsites: [],
          summary: { totalCallsites: 3, providers: ['openai'], models: ['gpt-4'] },
        },
      },
      baseline: null,
      status: 'warning',
      regressions: [],
      newIssues: [
        createInsight({ severity: 'critical', headline: 'Critical 1' }),
        createInsight({ severity: 'critical', headline: 'Critical 2' }),
        createInsight({ severity: 'warning', headline: 'Warning 1' }),
        createInsight({ severity: 'info', headline: 'Info 1' }),
      ],
      changedFiles: [],
    });

    // Critical shown as top issue, so details shows remaining:
    // 1 critical, 1 warning, 1 info
    expect(comment).toContain('**Critical**');
    expect(comment).toContain('**Warning**');
    expect(comment).toContain('**Info**');
  });
});

// =============================================================================
// COMMANDS FOOTER TESTS
// =============================================================================

describe('Commands Footer', () => {
  it('shows commands when issues exist', () => {
    const comment = generatePRComment({
      results: {
        inferenceMap: {
          callsites: [],
          summary: { totalCallsites: 3, providers: ['openai'], models: ['gpt-4'] },
        },
      },
      baseline: null,
      status: 'warning',
      regressions: [],
      newIssues: [
        createInsight({ severity: 'warning', headline: 'Test issue' }),
      ],
      changedFiles: [],
    });

    expect(comment).toContain('/fix 1');
    expect(comment).toContain('/dismiss 1');
    expect(comment).toContain('/fix all');
    expect(comment).toContain('/peakinfer');
  });

  it('does not show commands when no issues', () => {
    const comment = generatePRComment({
      results: {
        inferenceMap: {
          callsites: [],
          summary: { totalCallsites: 3, providers: ['openai'], models: ['gpt-4'] },
        },
      },
      baseline: null,
      status: 'pass',
      regressions: [],
      newIssues: [],
      changedFiles: [],
    });

    expect(comment).not.toContain('/fix');
    expect(comment).not.toContain('/dismiss');
  });

  it('always includes PeakInfer attribution', () => {
    const comment = generatePRComment({
      results: {
        inferenceMap: {
          callsites: [],
          summary: { totalCallsites: 3, providers: ['openai'], models: ['gpt-4'] },
        },
      },
      baseline: null,
      status: 'pass',
      regressions: [],
      newIssues: [],
      changedFiles: [],
    });

    expect(comment).toContain('Generated by');
    expect(comment).toContain('PeakInfer');
  });
});

// =============================================================================
// EXHAUSTED CREDITS TESTS
// =============================================================================

describe('Exhausted Credits Comment', () => {
  it('shows usage and alternatives', () => {
    const comment = generateExhaustedComment(300, 300);

    expect(comment).toContain('Free Tier Limit Reached');
    expect(comment).toContain('300/300');
    expect(comment).toContain('npm i -g @kalmantic/peakinfer');
  });
});
