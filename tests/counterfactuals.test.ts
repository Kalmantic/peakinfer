import { describe, it, expect } from 'vitest';
import {
  generateCounterfactuals,
  formatCounterfactualSummary,
  hasSignificantOpportunities,
  rankCounterfactuals,
} from '../src/counterfactuals.js';
import type { Callsite, InferenceMap } from '../src/types.js';

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

function createInferenceMap(callsites: Callsite[]): InferenceMap {
  return {
    version: '0.1',
    callsites,
    frameworks: {},
    scanResult: {
      root: '/test',
      files: [],
      summary: { totalFiles: 0, totalLoc: 0, languages: [], totalCandidates: 0 },
    },
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe('counterfactuals', () => {
  describe('generateCounterfactuals', () => {
    it('should generate model swap counterfactuals for GPT-4', () => {
      const inferenceMap = createInferenceMap([
        createCallsite({ file: 'src/a.ts', line: 10, model: 'gpt-4' }),
      ]);

      const result = generateCounterfactuals(inferenceMap);

      const modelSwaps = result.counterfactuals.filter(cf => cf.type === 'model_swap');
      expect(modelSwaps.length).toBeGreaterThan(0);

      // Should suggest gpt-4o and gpt-4o-mini as alternatives
      const suggestedModels = modelSwaps.map(cf => cf.proposedState.model);
      expect(suggestedModels).toContain('gpt-4o');
    });

    it('should generate model swap counterfactuals for Claude Opus', () => {
      const inferenceMap = createInferenceMap([
        createCallsite({ file: 'src/a.ts', line: 10, model: 'claude-3-opus' }),
      ]);

      const result = generateCounterfactuals(inferenceMap);

      const modelSwaps = result.counterfactuals.filter(cf => cf.type === 'model_swap');
      expect(modelSwaps.length).toBeGreaterThan(0);

      // Should suggest Claude Sonnet/Haiku as alternatives
      const suggestedModels = modelSwaps.map(cf => cf.proposedState.model);
      expect(suggestedModels.some(m => m.includes('sonnet') || m.includes('haiku'))).toBe(true);
    });

    it('should generate batching counterfactuals for multiple unbatched callsites', () => {
      const inferenceMap = createInferenceMap([
        createCallsite({ file: 'src/a.ts', line: 10, model: 'gpt-4o', patterns: {} }),
        createCallsite({ file: 'src/b.ts', line: 20, model: 'gpt-4o', patterns: {} }),
        createCallsite({ file: 'src/c.ts', line: 30, model: 'gpt-4o', patterns: {} }),
      ]);

      const result = generateCounterfactuals(inferenceMap);

      const batchingCfs = result.counterfactuals.filter(cf => cf.type === 'batch_optimization');
      expect(batchingCfs.length).toBeGreaterThan(0);
    });

    it('should not generate batching counterfactuals for single callsite', () => {
      const inferenceMap = createInferenceMap([
        createCallsite({ file: 'src/a.ts', line: 10, model: 'gpt-4o', patterns: {} }),
      ]);

      const result = generateCounterfactuals(inferenceMap);

      const batchingCfs = result.counterfactuals.filter(cf => cf.type === 'batch_optimization');
      expect(batchingCfs.length).toBe(0);
    });

    it('should generate caching counterfactuals for uncached callsites', () => {
      const inferenceMap = createInferenceMap([
        createCallsite({ file: 'src/a.ts', line: 10, patterns: {} }),
      ]);

      const result = generateCounterfactuals(inferenceMap);

      const cachingCfs = result.counterfactuals.filter(cf => cf.type === 'cache_addition');
      expect(cachingCfs.length).toBe(1);
    });

    it('should not generate caching counterfactuals for cached callsites', () => {
      const inferenceMap = createInferenceMap([
        createCallsite({ file: 'src/a.ts', line: 10, patterns: { caching: true } }),
      ]);

      const result = generateCounterfactuals(inferenceMap);

      const cachingCfs = result.counterfactuals.filter(cf => cf.type === 'cache_addition');
      expect(cachingCfs.length).toBe(0);
    });

    it('should generate streaming counterfactuals for non-streaming callsites', () => {
      const inferenceMap = createInferenceMap([
        createCallsite({ file: 'src/a.ts', line: 10, patterns: {} }),
      ]);

      const result = generateCounterfactuals(inferenceMap);

      const streamingCfs = result.counterfactuals.filter(cf => cf.type === 'streaming_enable');
      expect(streamingCfs.length).toBe(1);
    });

    it('should not generate streaming counterfactuals for streaming callsites', () => {
      const inferenceMap = createInferenceMap([
        createCallsite({ file: 'src/a.ts', line: 10, patterns: { streaming: true } }),
      ]);

      const result = generateCounterfactuals(inferenceMap);

      const streamingCfs = result.counterfactuals.filter(cf => cf.type === 'streaming_enable');
      expect(streamingCfs.length).toBe(0);
    });

    it('should calculate impact for each counterfactual', () => {
      const inferenceMap = createInferenceMap([
        createCallsite({ file: 'src/a.ts', line: 10, model: 'gpt-4', patterns: {} }),
      ]);

      const result = generateCounterfactuals(inferenceMap);

      for (const cf of result.counterfactuals) {
        expect(cf.impact).toBeDefined();
        expect(cf.impact.latencyDeltaPercent).toBeDefined();
        expect(cf.impact.costDeltaPercent).toBeDefined();
      }
    });

    it('should include tradeoffs for each counterfactual', () => {
      const inferenceMap = createInferenceMap([
        createCallsite({ file: 'src/a.ts', line: 10, model: 'gpt-4', patterns: {} }),
      ]);

      const result = generateCounterfactuals(inferenceMap);

      for (const cf of result.counterfactuals) {
        expect(cf.impact.tradeoffs).toBeDefined();
        expect(Array.isArray(cf.impact.tradeoffs)).toBe(true);
      }
    });

    it('should handle empty inference map', () => {
      const inferenceMap = createInferenceMap([]);

      const result = generateCounterfactuals(inferenceMap);

      expect(result.counterfactuals.length).toBe(0);
      expect(result.summary.totalOpportunities).toBe(0);
    });

    it('should calculate summary correctly', () => {
      const inferenceMap = createInferenceMap([
        createCallsite({ file: 'src/a.ts', line: 10, model: 'gpt-4', patterns: {} }),
      ]);

      const result = generateCounterfactuals(inferenceMap);

      expect(result.summary.totalOpportunities).toBe(result.counterfactuals.length);
      expect(result.summary.maxLatencySavingsPercent).toBeGreaterThanOrEqual(0);
    });

    it('should include affected points for each counterfactual', () => {
      const callsite1 = createCallsite({ file: 'src/a.ts', line: 10, model: 'gpt-4' });
      const inferenceMap = createInferenceMap([callsite1]);

      const result = generateCounterfactuals(inferenceMap);

      for (const cf of result.counterfactuals) {
        expect(cf.affectedPoints).toBeDefined();
        expect(Array.isArray(cf.affectedPoints)).toBe(true);
      }
    });
  });

  describe('formatCounterfactualSummary', () => {
    it('should format summary with opportunity count', () => {
      const inferenceMap = createInferenceMap([
        createCallsite({ file: 'src/a.ts', line: 10, model: 'gpt-4', patterns: {} }),
      ]);

      const result = generateCounterfactuals(inferenceMap);
      const summary = formatCounterfactualSummary(result);

      expect(summary).toContain('optimization opportunities');
    });

    it('should include latency savings in summary', () => {
      const inferenceMap = createInferenceMap([
        createCallsite({ file: 'src/a.ts', line: 10, model: 'gpt-4', patterns: {} }),
      ]);

      const result = generateCounterfactuals(inferenceMap);
      const summary = formatCounterfactualSummary(result);

      expect(summary).toContain('latency savings');
    });
  });

  describe('hasSignificantOpportunities', () => {
    it('should return true when high-impact opportunities exist', () => {
      const inferenceMap = createInferenceMap([
        createCallsite({ file: 'src/a.ts', line: 10, model: 'gpt-4', patterns: {} }),
      ]);

      const result = generateCounterfactuals(inferenceMap);

      expect(hasSignificantOpportunities(result)).toBe(true);
    });

    it('should return false when no opportunities', () => {
      const inferenceMap = createInferenceMap([]);

      const result = generateCounterfactuals(inferenceMap);

      expect(hasSignificantOpportunities(result)).toBe(false);
    });
  });

  describe('rankCounterfactuals', () => {
    it('should rank by latency when priority is latency', () => {
      const inferenceMap = createInferenceMap([
        createCallsite({ file: 'src/a.ts', line: 10, model: 'gpt-4', patterns: {} }),
        createCallsite({ file: 'src/b.ts', line: 20, model: 'gpt-4', patterns: {} }),
      ]);

      const result = generateCounterfactuals(inferenceMap);
      const ranked = rankCounterfactuals(result, 'latency');

      // Should be sorted by latency delta (most negative first)
      for (let i = 1; i < ranked.length; i++) {
        expect(ranked[i].impact.latencyDeltaPercent)
          .toBeGreaterThanOrEqual(ranked[i - 1].impact.latencyDeltaPercent);
      }
    });

    it('should rank by cost when priority is cost', () => {
      const inferenceMap = createInferenceMap([
        createCallsite({ file: 'src/a.ts', line: 10, model: 'gpt-4', patterns: {} }),
        createCallsite({ file: 'src/b.ts', line: 20, model: 'gpt-4', patterns: {} }),
      ]);

      const result = generateCounterfactuals(inferenceMap);
      const ranked = rankCounterfactuals(result, 'cost');

      // Should be sorted by cost delta (most negative first)
      for (let i = 1; i < ranked.length; i++) {
        expect(ranked[i].impact.costDeltaPercent)
          .toBeGreaterThanOrEqual(ranked[i - 1].impact.costDeltaPercent);
      }
    });

    it('should rank by combined score when priority is balanced', () => {
      const inferenceMap = createInferenceMap([
        createCallsite({ file: 'src/a.ts', line: 10, model: 'gpt-4', patterns: {} }),
        createCallsite({ file: 'src/b.ts', line: 20, model: 'gpt-4', patterns: {} }),
      ]);

      const result = generateCounterfactuals(inferenceMap);
      const ranked = rankCounterfactuals(result, 'balanced');

      // Should be sorted by combined score (latency + cost)
      for (let i = 1; i < ranked.length; i++) {
        const scorePrev = ranked[i - 1].impact.latencyDeltaPercent + ranked[i - 1].impact.costDeltaPercent;
        const scoreCurr = ranked[i].impact.latencyDeltaPercent + ranked[i].impact.costDeltaPercent;
        expect(scoreCurr).toBeGreaterThanOrEqual(scorePrev);
      }
    });
  });

  describe('counterfactual types', () => {
    it('should generate model_swap with correct structure', () => {
      const inferenceMap = createInferenceMap([
        createCallsite({ file: 'src/a.ts', line: 10, model: 'gpt-4' }),
      ]);

      const result = generateCounterfactuals(inferenceMap);
      const modelSwap = result.counterfactuals.find(cf => cf.type === 'model_swap');

      expect(modelSwap).toBeDefined();
      expect(modelSwap?.currentState.model).toBe('gpt-4');
      expect(modelSwap?.proposedState.model).toBeDefined();
      expect(modelSwap?.confidence).toBeDefined();
      expect(modelSwap?.effort).toBeDefined();
    });

    it('should generate cache_addition with correct structure', () => {
      const inferenceMap = createInferenceMap([
        createCallsite({ file: 'src/a.ts', line: 10, patterns: {} }),
      ]);

      const result = generateCounterfactuals(inferenceMap);
      const caching = result.counterfactuals.find(cf => cf.type === 'cache_addition');

      expect(caching).toBeDefined();
      expect(caching?.currentState.pattern).toBe('no caching');
      expect(caching?.proposedState.pattern).toBe('semantic cache');
      expect(caching?.impact.costDeltaPercent).toBe(-50);
    });

    it('should generate streaming_enable with correct structure', () => {
      const inferenceMap = createInferenceMap([
        createCallsite({ file: 'src/a.ts', line: 10, patterns: {} }),
      ]);

      const result = generateCounterfactuals(inferenceMap);
      const streaming = result.counterfactuals.find(cf => cf.type === 'streaming_enable');

      expect(streaming).toBeDefined();
      expect(streaming?.currentState.pattern).toBe('synchronous');
      expect(streaming?.proposedState.pattern).toBe('streaming');
      expect(streaming?.impact.latencyDeltaPercent).toBe(-80);
      expect(streaming?.impact.costDeltaPercent).toBe(0); // Streaming doesn't affect cost
    });
  });
});
