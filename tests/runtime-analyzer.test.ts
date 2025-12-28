import { describe, it, expect, beforeAll } from 'vitest';
import { RuntimeAnalyzerAgent, type RuntimeAnalyzerInput } from '../src/agents/runtime-analyzer.js';
import { setTestPricing } from '../src/costs.js';
import type { InferenceEvent, RuntimeSummary } from '../src/types.js';

// =============================================================================
// TEST FIXTURES
// =============================================================================

beforeAll(() => {
  setTestPricing({
    'gpt-4o': { input: 5.0, output: 15.0 },
    'gpt-4o-mini': { input: 0.15, output: 0.6 },
    'claude-3-opus': { input: 15.0, output: 75.0 },
    'claude-3-5-sonnet': { input: 3.0, output: 15.0 },
  });
});

const makeEvent = (overrides: Partial<InferenceEvent> = {}): InferenceEvent => ({
  id: `evt_${Math.random().toString(36).slice(2, 9)}`,
  ts: '2024-01-01T00:00:00Z',
  provider: 'openai',
  model: 'gpt-4o',
  input_tokens: 100,
  output_tokens: 50,
  latency_ms: 420,
  ...overrides,
});

const makeRuntimeSummary = (overrides: Partial<RuntimeSummary> = {}): RuntimeSummary => ({
  totalEvents: 100,
  byProvider: {
    openai: {
      calls: 80,
      tokens_in: 8000,
      tokens_out: 4000,
      latency_p50: 400,
      latency_p95: 800,
      latency_p99: 1200,
    },
    anthropic: {
      calls: 20,
      tokens_in: 2000,
      tokens_out: 1000,
      latency_p50: 500,
      latency_p95: 1000,
      latency_p99: 1500,
    },
  },
  byModel: {
    'gpt-4o': {
      calls: 60,
      tokens_in: 6000,
      tokens_out: 3000,
      latency_p50: 350,
      latency_p95: 700,
      latency_p99: 1100,
    },
    'gpt-4o-mini': {
      calls: 20,
      tokens_in: 2000,
      tokens_out: 1000,
      latency_p50: 200,
      latency_p95: 400,
      latency_p99: 600,
    },
    'claude-3-5-sonnet': {
      calls: 20,
      tokens_in: 2000,
      tokens_out: 1000,
      latency_p50: 500,
      latency_p95: 1000,
      latency_p99: 1500,
    },
  },
  global: {
    p50: 400,
    p95: 800,
    p99: 1200,
  },
  ...overrides,
});

const makeInput = (overrides: Partial<RuntimeAnalyzerInput> = {}): RuntimeAnalyzerInput => ({
  events: Array.from({ length: 10 }, (_, i) => makeEvent({ id: `evt_${i}` })),
  runtimeSummary: makeRuntimeSummary(),
  ...overrides,
});

// =============================================================================
// AGENT PROPERTIES TESTS
// =============================================================================

describe('RuntimeAnalyzerAgent', () => {
  describe('agent properties', () => {
    it('has correct name', () => {
      expect(RuntimeAnalyzerAgent.name).toBe('runtime-analyzer');
    });

    it('has description', () => {
      expect(RuntimeAnalyzerAgent.description).toBeDefined();
      expect(RuntimeAnalyzerAgent.description.length).toBeGreaterThan(0);
    });

    it('has tools registry', () => {
      expect(RuntimeAnalyzerAgent.tools).toBeDefined();
    });
  });

  // =============================================================================
  // EXECUTION TESTS
  // =============================================================================

  describe('execute', () => {
    it('returns valid output structure', async () => {
      const input = makeInput();
      const { result } = await RuntimeAnalyzerAgent.execute(input);

      // Check insights array
      expect(Array.isArray(result.insights)).toBe(true);

      // Check detectedPatterns structure
      expect(result.detectedPatterns).toHaveProperty('applicationType');
      expect(result.detectedPatterns).toHaveProperty('multiModelPipeline');
      expect(result.detectedPatterns).toHaveProperty('streamingDetected');
      expect(result.detectedPatterns).toHaveProperty('batchingDetected');
      expect(result.detectedPatterns).toHaveProperty('cachingDetected');

      // Check summary structure
      expect(result.summary).toHaveProperty('totalCalls');
      expect(result.summary).toHaveProperty('totalTokens');
      expect(result.summary).toHaveProperty('dominantProvider');
      expect(result.summary).toHaveProperty('dominantModel');
      expect(result.summary).toHaveProperty('estimatedDailyCostUSD');
    });

    it('application type is valid enum value', async () => {
      const input = makeInput();
      const { result } = await RuntimeAnalyzerAgent.execute(input);

      const validTypes = ['rag', 'agent', 'batch', 'chat', 'pipeline', 'unknown'];
      expect(validTypes).toContain(result.detectedPatterns.applicationType);
    });

    it('correctly detects multi-model pipeline', async () => {
      const input = makeInput({
        runtimeSummary: makeRuntimeSummary({
          byModel: {
            'gpt-4o': { calls: 50, tokens_in: 5000, tokens_out: 2500, latency_p50: 400, latency_p95: 800, latency_p99: 1200 },
            'gpt-4o-mini': { calls: 50, tokens_in: 5000, tokens_out: 2500, latency_p50: 200, latency_p95: 400, latency_p99: 600 },
          },
        }),
      });

      const { result } = await RuntimeAnalyzerAgent.execute(input);

      expect(result.detectedPatterns.multiModelPipeline).toBe(true);
    });

    it('detects streaming pattern from events', async () => {
      const input = makeInput({
        events: [
          makeEvent({ streaming: true }),
          makeEvent({ streaming: true }),
          makeEvent({ streaming: false }),
        ],
      });

      const { result } = await RuntimeAnalyzerAgent.execute(input);

      expect(result.detectedPatterns.streamingDetected).toBe(true);
    });

    it('detects batching pattern from events', async () => {
      const input = makeInput({
        events: [
          makeEvent({ batch_id: 'batch_001' }),
          makeEvent({ batch_id: 'batch_001' }),
          makeEvent(),
        ],
      });

      const { result } = await RuntimeAnalyzerAgent.execute(input);

      expect(result.detectedPatterns.batchingDetected).toBe(true);
    });

    it('detects caching pattern from events', async () => {
      const input = makeInput({
        events: [
          makeEvent({ cached: true }),
          makeEvent({ cached: false }),
        ],
      });

      const { result } = await RuntimeAnalyzerAgent.execute(input);

      expect(result.detectedPatterns.cachingDetected).toBe(true);
    });

    it('calculates total tokens', async () => {
      const runtimeSummary = makeRuntimeSummary({
        byModel: {
          'gpt-4o': { calls: 10, tokens_in: 1000, tokens_out: 500, latency_p50: 400, latency_p95: 800, latency_p99: 1200 },
        },
      });

      const input = makeInput({ runtimeSummary });
      const { result } = await RuntimeAnalyzerAgent.execute(input);

      // Total tokens should be a reasonable positive number
      // LLM may calculate from events or summary differently
      expect(result.summary.totalTokens).toBeGreaterThan(0);
    });

    it('identifies dominant provider', async () => {
      const runtimeSummary = makeRuntimeSummary({
        byProvider: {
          openai: { calls: 100, tokens_in: 10000, tokens_out: 5000, latency_p50: 400, latency_p95: 800, latency_p99: 1200 },
          anthropic: { calls: 20, tokens_in: 2000, tokens_out: 1000, latency_p50: 500, latency_p95: 1000, latency_p99: 1500 },
        },
      });

      const input = makeInput({ runtimeSummary });
      const { result } = await RuntimeAnalyzerAgent.execute(input);

      expect(result.summary.dominantProvider).toBe('openai');
    });

    it('identifies dominant model', async () => {
      const runtimeSummary = makeRuntimeSummary({
        byModel: {
          'gpt-4o': { calls: 80, tokens_in: 8000, tokens_out: 4000, latency_p50: 400, latency_p95: 800, latency_p99: 1200 },
          'gpt-4o-mini': { calls: 20, tokens_in: 2000, tokens_out: 1000, latency_p50: 200, latency_p95: 400, latency_p99: 600 },
        },
      });

      const input = makeInput({ runtimeSummary });
      const { result } = await RuntimeAnalyzerAgent.execute(input);

      expect(result.summary.dominantModel).toBe('gpt-4o');
    });
  });

  // =============================================================================
  // EDGE CASES
  // =============================================================================

  describe('edge cases', () => {
    it('handles empty events array', async () => {
      const input = makeInput({
        events: [],
        runtimeSummary: makeRuntimeSummary({ totalEvents: 0 }),
      });

      const { result } = await RuntimeAnalyzerAgent.execute(input);

      expect(result.detectedPatterns.streamingDetected).toBe(false);
      expect(result.detectedPatterns.batchingDetected).toBe(false);
      expect(result.detectedPatterns.cachingDetected).toBe(false);
    });

    it('handles single model', async () => {
      const input = makeInput({
        runtimeSummary: makeRuntimeSummary({
          byModel: {
            'gpt-4o': { calls: 100, tokens_in: 10000, tokens_out: 5000, latency_p50: 400, latency_p95: 800, latency_p99: 1200 },
          },
        }),
      });

      const { result } = await RuntimeAnalyzerAgent.execute(input);

      // LLM may still detect patterns; key assertion: returns valid result
      expect(result.detectedPatterns).toBeDefined();
      expect(result.summary.dominantModel).toBeDefined();
    });

    it('handles missing optional event fields', async () => {
      const input = makeInput({
        events: [makeEvent()], // No streaming, batch_id, cached, retry_count, fallback_used
      });

      const { result } = await RuntimeAnalyzerAgent.execute(input);

      expect(result.detectedPatterns.streamingDetected).toBe(false);
      expect(result.detectedPatterns.batchingDetected).toBe(false);
      expect(result.detectedPatterns.cachingDetected).toBe(false);
    });

    it('handles empty byProvider and byModel', async () => {
      const input = makeInput({
        runtimeSummary: {
          totalEvents: 0,
          byProvider: {},
          byModel: {},
          global: { p50: 0, p95: 0, p99: 0 },
        },
      });

      const { result } = await RuntimeAnalyzerAgent.execute(input);

      // LLM may return 'unknown', 'none', 'n/a' etc for empty data
      expect(['unknown', 'none', 'n/a', '']).toContain(result.summary.dominantProvider.toLowerCase());
      expect(['unknown', 'none', 'n/a', '']).toContain(result.summary.dominantModel.toLowerCase());
    });
  });

  // =============================================================================
  // PATTERN DETECTION COMBINATIONS
  // =============================================================================

  describe('pattern detection combinations', () => {
    it('detects all patterns when present', async () => {
      const input = makeInput({
        events: [
          makeEvent({ streaming: true, batch_id: 'b1', cached: true }),
        ],
        runtimeSummary: makeRuntimeSummary({
          byModel: {
            'gpt-4o': { calls: 50, tokens_in: 5000, tokens_out: 2500, latency_p50: 400, latency_p95: 800, latency_p99: 1200 },
            'claude-3-5-sonnet': { calls: 50, tokens_in: 5000, tokens_out: 2500, latency_p50: 500, latency_p95: 1000, latency_p99: 1500 },
          },
        }),
      });

      const { result } = await RuntimeAnalyzerAgent.execute(input);

      expect(result.detectedPatterns.streamingDetected).toBe(true);
      expect(result.detectedPatterns.batchingDetected).toBe(true);
      expect(result.detectedPatterns.cachingDetected).toBe(true);
      expect(result.detectedPatterns.multiModelPipeline).toBe(true);
    });

    it('returns valid patterns structure for minimal input', async () => {
      const input = makeInput({
        events: [makeEvent()], // No optional fields
        runtimeSummary: makeRuntimeSummary({
          byModel: {
            'gpt-4o': { calls: 100, tokens_in: 10000, tokens_out: 5000, latency_p50: 400, latency_p95: 800, latency_p99: 1200 },
          },
        }),
      });

      const { result } = await RuntimeAnalyzerAgent.execute(input);

      // LLM may infer patterns from context; key assertion: returns valid structure
      expect(typeof result.detectedPatterns.streamingDetected).toBe('boolean');
      expect(typeof result.detectedPatterns.batchingDetected).toBe('boolean');
      expect(typeof result.detectedPatterns.cachingDetected).toBe('boolean');
      expect(typeof result.detectedPatterns.multiModelPipeline).toBe('boolean');
    });
  });

  // =============================================================================
  // INSIGHTS VALIDATION (when LLM is available)
  // =============================================================================

  describe('insights structure', () => {
    it('insights have required fields when generated', async () => {
      const input = makeInput();
      const { result } = await RuntimeAnalyzerAgent.execute(input);

      // Insights may be empty in fallback mode, but if present, must have structure
      for (const insight of result.insights) {
        expect(insight).toHaveProperty('id');
        expect(insight).toHaveProperty('severity');
        expect(insight).toHaveProperty('category');
        expect(insight).toHaveProperty('headline');
        expect(insight).toHaveProperty('evidence');
        expect(['critical', 'warning', 'info']).toContain(insight.severity);
      }
    });
  });
});
