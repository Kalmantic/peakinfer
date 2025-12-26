import { describe, it, expect } from 'vitest';
import {
  generatePredictions,
  formatPredictionSummary,
  hasHighRiskPredictions,
} from '../src/prediction.js';
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

describe('prediction', () => {
  describe('generatePredictions', () => {
    it('should generate predictions for callsites', () => {
      const inferenceMap = createInferenceMap([
        createCallsite({ file: 'src/a.ts', line: 10, model: 'gpt-4o' }),
        createCallsite({ file: 'src/b.ts', line: 20, model: 'gpt-4o-mini' }),
      ]);

      const result = generatePredictions(inferenceMap);

      expect(result.predictions.length).toBe(2);
      expect(result.summary.totalPoints).toBe(2);
    });

    it('should assign risk levels based on latency', () => {
      const inferenceMap = createInferenceMap([
        createCallsite({ file: 'src/a.ts', line: 10, model: 'claude-3-opus' }), // high latency
        createCallsite({ file: 'src/b.ts', line: 20, model: 'gemini-1.5-flash' }), // low latency
      ]);

      const result = generatePredictions(inferenceMap);

      const opusPrediction = result.predictions.find(p => p.model?.includes('opus'));
      const flashPrediction = result.predictions.find(p => p.model?.includes('flash'));

      expect(opusPrediction?.risk).toBe('high');
      expect(flashPrediction?.risk).toBe('low');
    });

    it('should include prediction factors', () => {
      const inferenceMap = createInferenceMap([
        createCallsite({
          file: 'src/a.ts',
          line: 10,
          model: 'gpt-4o',
          patterns: { streaming: true },
        }),
      ]);

      const result = generatePredictions(inferenceMap);

      expect(result.predictions[0].factors.length).toBeGreaterThan(0);
      const streamingFactor = result.predictions[0].factors.find(f =>
        f.name.toLowerCase().includes('streaming')
      );
      expect(streamingFactor).toBeDefined();
      expect(streamingFactor?.impact).toBe('positive');
    });

    it('should reduce latency for patterns like batching and caching', () => {
      const baseInferenceMap = createInferenceMap([
        createCallsite({
          file: 'src/a.ts',
          line: 10,
          model: 'gpt-4o',
          patterns: {},
        }),
      ]);

      const optimizedInferenceMap = createInferenceMap([
        createCallsite({
          file: 'src/a.ts',
          line: 10,
          model: 'gpt-4o',
          patterns: { batching: true, caching: true },
        }),
      ]);

      const baseResult = generatePredictions(baseInferenceMap);
      const optimizedResult = generatePredictions(optimizedInferenceMap);

      expect(optimizedResult.predictions[0].predictedLatency.p95)
        .toBeLessThan(baseResult.predictions[0].predictedLatency.p95);
    });

    it('should calculate correct summary statistics', () => {
      const inferenceMap = createInferenceMap([
        createCallsite({ file: 'src/a.ts', line: 10, model: 'gpt-4' }), // high
        createCallsite({ file: 'src/b.ts', line: 20, model: 'gpt-4o' }), // medium
        createCallsite({ file: 'src/c.ts', line: 30, model: 'gpt-4o-mini' }), // low
      ]);

      const result = generatePredictions(inferenceMap);

      expect(result.summary.totalPoints).toBe(3);
      expect(result.summary.highRiskCount).toBeGreaterThanOrEqual(0);
      expect(result.summary.averageP95).toBeGreaterThan(0);
      expect(result.summary.worstP95).toBeGreaterThanOrEqual(result.summary.averageP95);
    });

    it('should check budget when targetP95 is specified', () => {
      const inferenceMap = createInferenceMap([
        createCallsite({ file: 'src/a.ts', line: 10, model: 'gpt-4' }), // p95 ~5000ms
      ]);

      const withinBudget = generatePredictions(inferenceMap, 0, { targetP95: 10000 });
      const overBudget = generatePredictions(inferenceMap, 0, { targetP95: 1000 });

      expect(withinBudget.summary.budgetExceeded).toBe(false);
      expect(overBudget.summary.budgetExceeded).toBe(true);
    });

    it('should handle empty inference map', () => {
      const inferenceMap = createInferenceMap([]);

      const result = generatePredictions(inferenceMap);

      expect(result.predictions.length).toBe(0);
      expect(result.summary.totalPoints).toBe(0);
      expect(result.summary.averageP95).toBe(0);
    });

    it('should handle unknown models with medium confidence when model is set', () => {
      const inferenceMap = createInferenceMap([
        createCallsite({
          file: 'src/a.ts',
          line: 10,
          model: 'custom-fine-tuned-model',
        }),
      ]);

      const result = generatePredictions(inferenceMap);

      expect(result.predictions.length).toBe(1);
      // When model is set (even unknown), confidence is medium; low only when no model
      expect(result.predictions[0].confidence).toBe('medium');
    });

    it('should include location in predictions', () => {
      const inferenceMap = createInferenceMap([
        createCallsite({ file: 'src/agent.ts', line: 42 }),
      ]);

      const result = generatePredictions(inferenceMap);

      expect(result.predictions[0].location).toBe('src/agent.ts:42');
    });
  });

  describe('formatPredictionSummary', () => {
    it('should format summary with risk counts', () => {
      const inferenceMap = createInferenceMap([
        createCallsite({ file: 'src/a.ts', line: 10, model: 'gpt-4' }),
        createCallsite({ file: 'src/b.ts', line: 20, model: 'gpt-4o-mini' }),
      ]);

      const result = generatePredictions(inferenceMap);
      const summary = formatPredictionSummary(result);

      expect(summary).toContain('inference points');
      expect(summary).toContain('p95');
    });

    it('should show budget status when target specified', () => {
      const inferenceMap = createInferenceMap([
        createCallsite({ file: 'src/a.ts', line: 10, model: 'gpt-4' }),
      ]);

      const result = generatePredictions(inferenceMap, 0, { targetP95: 1000 });
      const summary = formatPredictionSummary(result);

      expect(summary).toContain('Budget exceeded');
    });
  });

  describe('hasHighRiskPredictions', () => {
    it('should return true when high-risk predictions exist', () => {
      const inferenceMap = createInferenceMap([
        createCallsite({ file: 'src/a.ts', line: 10, model: 'claude-3-opus' }),
      ]);

      const result = generatePredictions(inferenceMap);

      expect(hasHighRiskPredictions(result)).toBe(true);
    });

    it('should return false when no high-risk predictions', () => {
      const inferenceMap = createInferenceMap([
        createCallsite({ file: 'src/a.ts', line: 10, model: 'gemini-1.5-flash' }),
      ]);

      const result = generatePredictions(inferenceMap);

      expect(hasHighRiskPredictions(result)).toBe(false);
    });

    it('should return false for empty predictions', () => {
      const inferenceMap = createInferenceMap([]);

      const result = generatePredictions(inferenceMap);

      expect(hasHighRiskPredictions(result)).toBe(false);
    });
  });

  describe('model latency estimates', () => {
    it('should estimate higher latency for Claude Opus vs Haiku', () => {
      const opus = createInferenceMap([
        createCallsite({ file: 'src/a.ts', line: 10, model: 'claude-3-opus' }),
      ]);

      const haiku = createInferenceMap([
        createCallsite({ file: 'src/a.ts', line: 10, model: 'claude-3-haiku' }),
      ]);

      const opusResult = generatePredictions(opus);
      const haikuResult = generatePredictions(haiku);

      // Opus should have higher latency than Haiku
      expect(opusResult.predictions[0].predictedLatency.p95)
        .toBeGreaterThan(haikuResult.predictions[0].predictedLatency.p95);
    });

    it('should estimate higher latency for o1 models', () => {
      const o1 = createInferenceMap([
        createCallsite({ file: 'src/a.ts', line: 10, model: 'o1-preview' }),
      ]);

      const gpt4 = createInferenceMap([
        createCallsite({ file: 'src/a.ts', line: 10, model: 'gpt-4' }),
      ]);

      const o1Result = generatePredictions(o1);
      const gpt4Result = generatePredictions(gpt4);

      expect(o1Result.predictions[0].predictedLatency.p95)
        .toBeGreaterThan(gpt4Result.predictions[0].predictedLatency.p95);
    });
  });

  describe('self-hosted providers', () => {
    it('should identify self-hosted providers as positive factor', () => {
      const inferenceMap = createInferenceMap([
        createCallsite({
          file: 'src/a.ts',
          line: 10,
          provider: 'vllm',
          model: 'llama-3.1-70b',
        }),
      ]);

      const result = generatePredictions(inferenceMap);

      const selfHostedFactor = result.predictions[0].factors.find(f =>
        f.name.toLowerCase().includes('self-hosted')
      );
      expect(selfHostedFactor).toBeDefined();
      expect(selfHostedFactor?.impact).toBe('positive');
    });
  });
});
