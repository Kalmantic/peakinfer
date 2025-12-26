import { describe, it, expect } from 'vitest';
import {
  compareSnapshots,
  formatComparisonSummary,
  hasSignificantChanges,
  type AnalysisSnapshot,
} from '../src/comparison.js';
import type { Callsite, Insight } from '../src/types.js';

// =============================================================================
// TEST FIXTURES
// =============================================================================

function createCallsite(overrides: Partial<Callsite> = {}): Callsite {
  return {
    id: `cs_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    file: 'src/agent.ts',
    line: 42,
    col: 10,
    provider: 'openai',
    model: 'gpt-4o',
    framework: null,
    runtime: null,
    patterns: {},
    confidence: 0.9,
    ...overrides,
  };
}

function createInsight(overrides: Partial<Insight> = {}): Insight {
  return {
    id: `insight_${Date.now()}`,
    severity: 'warning',
    category: 'cost',
    headline: 'Test insight',
    evidence: 'Test evidence',
    recommendation: 'Test recommendation',
    source: 'rules',
    ...overrides,
  } as Insight;
}

function createSnapshot(
  callsites: Callsite[],
  insights: Insight[] = [],
  runId = 'run_test'
): AnalysisSnapshot {
  return {
    runId,
    timestamp: new Date().toISOString(),
    callsites,
    insights,
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe('comparison', () => {
  describe('compareSnapshots', () => {
    it('should detect added inference points', () => {
      const baseline = createSnapshot([
        createCallsite({ file: 'src/a.ts', line: 10 }),
      ]);

      const current = createSnapshot([
        createCallsite({ file: 'src/a.ts', line: 10 }),
        createCallsite({ file: 'src/b.ts', line: 20 }),
      ]);

      const result = compareSnapshots(baseline, current);

      expect(result.added.length).toBe(1);
      expect(result.added[0].file).toBe('src/b.ts');
      expect(result.metrics.addedCount).toBe(1);
    });

    it('should detect removed inference points', () => {
      const baseline = createSnapshot([
        createCallsite({ file: 'src/a.ts', line: 10 }),
        createCallsite({ file: 'src/b.ts', line: 20 }),
      ]);

      const current = createSnapshot([
        createCallsite({ file: 'src/a.ts', line: 10 }),
      ]);

      const result = compareSnapshots(baseline, current);

      expect(result.removed.length).toBe(1);
      expect(result.removed[0].file).toBe('src/b.ts');
      expect(result.metrics.removedCount).toBe(1);
    });

    it('should detect changed inference points', () => {
      const baseline = createSnapshot([
        createCallsite({ file: 'src/a.ts', line: 10, model: 'gpt-4' }),
      ]);

      const current = createSnapshot([
        createCallsite({ file: 'src/a.ts', line: 10, model: 'gpt-4o' }),
      ]);

      const result = compareSnapshots(baseline, current);

      expect(result.changed.length).toBe(1);
      expect(result.changed[0].changes.length).toBeGreaterThan(0);
      expect(result.changed[0].changes[0].field).toBe('model');
      expect(result.changed[0].changes[0].before).toBe('gpt-4');
      expect(result.changed[0].changes[0].after).toBe('gpt-4o');
    });

    it('should detect pattern changes', () => {
      const baseline = createSnapshot([
        createCallsite({
          file: 'src/a.ts',
          line: 10,
          patterns: { streaming: false },
        }),
      ]);

      const current = createSnapshot([
        createCallsite({
          file: 'src/a.ts',
          line: 10,
          patterns: { streaming: true },
        }),
      ]);

      const result = compareSnapshots(baseline, current);

      expect(result.changed.length).toBe(1);
      const patternChange = result.changed[0].changes.find(c => c.field === 'patterns.streaming');
      expect(patternChange).toBeDefined();
      expect(patternChange?.before).toBe(false);
      expect(patternChange?.after).toBe(true);
    });

    it('should calculate correct metrics', () => {
      const baseline = createSnapshot([
        createCallsite({ file: 'src/a.ts', line: 10 }),
        createCallsite({ file: 'src/b.ts', line: 20 }),
        createCallsite({ file: 'src/c.ts', line: 30 }),
      ]);

      const current = createSnapshot([
        createCallsite({ file: 'src/a.ts', line: 10, model: 'gpt-4o-mini' }),
        // b.ts removed
        createCallsite({ file: 'src/d.ts', line: 40 }), // new
      ]);

      const result = compareSnapshots(baseline, current);

      expect(result.metrics.totalBefore).toBe(3);
      expect(result.metrics.totalAfter).toBe(2);
      expect(result.metrics.addedCount).toBe(1);
      expect(result.metrics.removedCount).toBe(2); // b.ts and c.ts
      expect(result.metrics.changedCount).toBe(1); // a.ts model changed
      expect(result.metrics.netChange).toBe(-1); // 1 added - 2 removed
    });

    it('should handle empty snapshots', () => {
      const baseline = createSnapshot([]);
      const current = createSnapshot([]);

      const result = compareSnapshots(baseline, current);

      expect(result.added.length).toBe(0);
      expect(result.removed.length).toBe(0);
      expect(result.changed.length).toBe(0);
      expect(result.metrics.netChange).toBe(0);
    });

    it('should compare insights when enabled', () => {
      const baseline = createSnapshot(
        [createCallsite({ file: 'src/a.ts', line: 10 })],
        [
          createInsight({ id: 'i1', severity: 'critical' }),
          createInsight({ id: 'i2', severity: 'warning' }),
        ]
      );

      const current = createSnapshot(
        [createCallsite({ file: 'src/a.ts', line: 10 })],
        [
          createInsight({ id: 'i1', severity: 'critical' }), // kept
          createInsight({ id: 'i3', severity: 'critical' }), // new critical
          createInsight({ id: 'i4', severity: 'warning' }), // new warning
        ]
      );

      const result = compareSnapshots(baseline, current, { compareInsights: true });

      expect(result.insightDeltas).toBeDefined();
      expect(result.insightDeltas?.newCritical).toBe(1);
      expect(result.insightDeltas?.newWarnings).toBe(1);
      expect(result.insightDeltas?.resolvedWarnings).toBe(1); // i2 resolved
    });
  });

  describe('formatComparisonSummary', () => {
    it('should format added/removed/changed counts', () => {
      const comparison = compareSnapshots(
        createSnapshot([
          createCallsite({ file: 'src/a.ts', line: 10 }),
          createCallsite({ file: 'src/b.ts', line: 20 }),
        ]),
        createSnapshot([
          createCallsite({ file: 'src/a.ts', line: 10, model: 'gpt-4o-mini' }),
          createCallsite({ file: 'src/c.ts', line: 30 }),
        ])
      );

      const summary = formatComparisonSummary(comparison);

      expect(summary).toContain('1 new inference point');
      expect(summary).toContain('1 removed inference point');
      expect(summary).toContain('1 modified inference point');
    });

    it('should show "No changes" when nothing changed', () => {
      const callsite = createCallsite({ file: 'src/a.ts', line: 10 });
      const comparison = compareSnapshots(
        createSnapshot([callsite]),
        createSnapshot([callsite])
      );

      const summary = formatComparisonSummary(comparison);

      expect(summary).toContain('No changes detected');
    });

    it('should show insight deltas', () => {
      const baseline = createSnapshot(
        [createCallsite({ file: 'src/a.ts', line: 10 })],
        [createInsight({ id: 'i1', severity: 'critical' })]
      );

      const current = createSnapshot(
        [createCallsite({ file: 'src/a.ts', line: 10 })],
        [
          createInsight({ id: 'i1', severity: 'critical' }),
          createInsight({ id: 'i2', severity: 'critical' }),
        ]
      );

      const comparison = compareSnapshots(baseline, current, { compareInsights: true });
      const summary = formatComparisonSummary(comparison);

      expect(summary).toContain('1 new critical issue');
    });
  });

  describe('hasSignificantChanges', () => {
    it('should return true when points are added', () => {
      const comparison = compareSnapshots(
        createSnapshot([]),
        createSnapshot([createCallsite({ file: 'src/a.ts', line: 10 })])
      );

      expect(hasSignificantChanges(comparison)).toBe(true);
    });

    it('should return true when points are removed', () => {
      const comparison = compareSnapshots(
        createSnapshot([createCallsite({ file: 'src/a.ts', line: 10 })]),
        createSnapshot([])
      );

      expect(hasSignificantChanges(comparison)).toBe(true);
    });

    it('should return true when points are changed', () => {
      const comparison = compareSnapshots(
        createSnapshot([createCallsite({ file: 'src/a.ts', line: 10, model: 'gpt-4' })]),
        createSnapshot([createCallsite({ file: 'src/a.ts', line: 10, model: 'gpt-4o' })])
      );

      expect(hasSignificantChanges(comparison)).toBe(true);
    });

    it('should return true when new critical insights', () => {
      const baseline = createSnapshot(
        [createCallsite({ file: 'src/a.ts', line: 10 })],
        []
      );

      const current = createSnapshot(
        [createCallsite({ file: 'src/a.ts', line: 10 })],
        [createInsight({ id: 'i1', severity: 'critical' })]
      );

      const comparison = compareSnapshots(baseline, current, { compareInsights: true });

      expect(hasSignificantChanges(comparison)).toBe(true);
    });

    it('should return false when nothing changed', () => {
      const callsite = createCallsite({ file: 'src/a.ts', line: 10 });
      const comparison = compareSnapshots(
        createSnapshot([callsite]),
        createSnapshot([callsite])
      );

      expect(hasSignificantChanges(comparison)).toBe(false);
    });
  });
});
