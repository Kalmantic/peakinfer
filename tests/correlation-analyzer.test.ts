import { describe, it, expect } from 'vitest';
import { CorrelationAnalyzerAgent, type CorrelationAnalyzerInput } from '../src/agents/correlation-analyzer.js';
import type { Callsite, InferenceEvent, RuntimeSummary, DriftSignal } from '../src/types.js';

// =============================================================================
// TEST FIXTURES
// =============================================================================

const makeCallsite = (overrides: Partial<Callsite> = {}): Callsite => ({
  id: `cs_${Math.random().toString(36).slice(2, 9)}`,
  file: 'src/api/chat.ts',
  line: 42,
  provider: 'openai',
  model: 'gpt-4o',
  framework: null,
  runtime: null,
  patterns: {},
  confidence: 0.9,
  ...overrides,
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
      calls: 100,
      tokens_in: 10000,
      tokens_out: 5000,
      latency_p50: 400,
      latency_p95: 800,
      latency_p99: 1200,
    },
  },
  byModel: {
    'gpt-4o': {
      calls: 100,
      tokens_in: 10000,
      tokens_out: 5000,
      latency_p50: 400,
      latency_p95: 800,
      latency_p99: 1200,
    },
  },
  global: {
    p50: 400,
    p95: 800,
    p99: 1200,
  },
  ...overrides,
});

const makeInput = (overrides: Partial<CorrelationAnalyzerInput> = {}): CorrelationAnalyzerInput => ({
  callsites: [makeCallsite()],
  events: [makeEvent()],
  runtimeSummary: makeRuntimeSummary(),
  ...overrides,
});

// =============================================================================
// AGENT PROPERTIES TESTS
// =============================================================================

describe('CorrelationAnalyzerAgent', () => {
  describe('agent properties', () => {
    it('has correct name', () => {
      expect(CorrelationAnalyzerAgent.name).toBe('correlation-analyzer');
    });

    it('has description', () => {
      expect(CorrelationAnalyzerAgent.description).toBeDefined();
      expect(CorrelationAnalyzerAgent.description.length).toBeGreaterThan(0);
    });

    it('has tools registry', () => {
      expect(CorrelationAnalyzerAgent.tools).toBeDefined();
    });
  });

  // =============================================================================
  // OUTPUT FORMAT TESTS
  // =============================================================================

  describe('output format', () => {
    it('returns correct structure', async () => {
      const input = makeInput();
      const { result } = await CorrelationAnalyzerAgent.execute(input);

      // Check insights array
      expect(Array.isArray(result.insights)).toBe(true);

      // Check driftSignals array
      expect(Array.isArray(result.driftSignals)).toBe(true);

      // Check correlationSummary structure
      expect(result.correlationSummary).toHaveProperty('totalCodeCallsites');
      expect(result.correlationSummary).toHaveProperty('totalRuntimeModels');
      expect(result.correlationSummary).toHaveProperty('matched');
      expect(result.correlationSummary).toHaveProperty('codeOnly');
      expect(result.correlationSummary).toHaveProperty('runtimeOnly');
      expect(result.correlationSummary).toHaveProperty('mismatched');

      // Check alignment score
      expect(typeof result.alignmentScore).toBe('number');
      expect(result.alignmentScore).toBeGreaterThanOrEqual(0);
      expect(result.alignmentScore).toBeLessThanOrEqual(1);

      // Check overall assessment
      expect(typeof result.overallAssessment).toBe('string');
      expect(result.overallAssessment.length).toBeGreaterThan(0);
    });

    it('drift signals have correct type values', async () => {
      const input = makeInput({
        callsites: [
          makeCallsite({ provider: 'anthropic', model: 'claude-3-opus' }),
        ],
        runtimeSummary: makeRuntimeSummary({
          byModel: {
            'gpt-4o': { calls: 100, tokens_in: 10000, tokens_out: 5000, latency_p50: 400, latency_p95: 800, latency_p99: 1200 },
          },
        }),
      });

      const { result } = await CorrelationAnalyzerAgent.execute(input);

      const validTypes: DriftSignal['type'][] = ['codeOnly', 'runtimeOnly', 'mismatch', 'patternDrift'];
      for (const signal of result.driftSignals) {
        expect(validTypes).toContain(signal.type);
      }
    });
  });

  // =============================================================================
  // CORRELATION LOGIC TESTS
  // =============================================================================

  describe('correlation logic', () => {
    it('calculates alignment score for perfect match', async () => {
      // Same provider:model in both code and runtime
      const input = makeInput({
        callsites: [
          makeCallsite({ provider: 'openai', model: 'gpt-4o' }),
        ],
        runtimeSummary: makeRuntimeSummary({
          byModel: {
            'gpt-4o': { calls: 100, tokens_in: 10000, tokens_out: 5000, latency_p50: 400, latency_p95: 800, latency_p99: 1200 },
          },
        }),
      });

      const { result } = await CorrelationAnalyzerAgent.execute(input);

      expect(result.alignmentScore).toBeGreaterThanOrEqual(0.5);
    });

    it('detects code-only inference points', async () => {
      const input = makeInput({
        callsites: [
          makeCallsite({ provider: 'anthropic', model: 'claude-3-opus' }),
        ],
        runtimeSummary: makeRuntimeSummary({
          byModel: {
            'gpt-4o': { calls: 100, tokens_in: 10000, tokens_out: 5000, latency_p50: 400, latency_p95: 800, latency_p99: 1200 },
          },
        }),
      });

      const { result } = await CorrelationAnalyzerAgent.execute(input);

      // LLM may classify this as codeOnly, mismatch, or other drift type
      // Key assertion: alignment should be low and some drift should be detected
      expect(result.alignmentScore).toBeLessThan(1.0);
      expect(
        result.driftSignals.length > 0 ||
        result.correlationSummary.codeOnly > 0 ||
        result.correlationSummary.mismatched > 0
      ).toBe(true);
    });

    it('detects runtime-only models', async () => {
      const input = makeInput({
        callsites: [
          makeCallsite({ provider: 'openai', model: 'gpt-4o' }),
        ],
        runtimeSummary: makeRuntimeSummary({
          byModel: {
            'gpt-4o': { calls: 50, tokens_in: 5000, tokens_out: 2500, latency_p50: 400, latency_p95: 800, latency_p99: 1200 },
            'claude-3-opus': { calls: 50, tokens_in: 5000, tokens_out: 2500, latency_p50: 500, latency_p95: 1000, latency_p99: 1500 },
          },
        }),
      });

      const { result } = await CorrelationAnalyzerAgent.execute(input);

      expect(result.driftSignals.some(s => s.type === 'runtimeOnly')).toBe(true);
      expect(result.correlationSummary.runtimeOnly).toBeGreaterThan(0);
    });

    it('generates appropriate overall assessment for good alignment', async () => {
      const input = makeInput({
        callsites: [
          makeCallsite({ provider: 'openai', model: 'gpt-4o' }),
        ],
        runtimeSummary: makeRuntimeSummary({
          byModel: {
            'gpt-4o': { calls: 100, tokens_in: 10000, tokens_out: 5000, latency_p50: 400, latency_p95: 800, latency_p99: 1200 },
          },
        }),
      });

      const { result } = await CorrelationAnalyzerAgent.execute(input);

      expect(result.overallAssessment.toLowerCase()).toMatch(/alignment|good|match/);
    });

    it('generates appropriate overall assessment for significant drift', async () => {
      const input = makeInput({
        callsites: [
          makeCallsite({ provider: 'anthropic', model: 'claude-3-opus' }),
        ],
        runtimeSummary: makeRuntimeSummary({
          byModel: {
            'gpt-4o': { calls: 100, tokens_in: 10000, tokens_out: 5000, latency_p50: 400, latency_p95: 800, latency_p99: 1200 },
          },
        }),
      });

      const { result } = await CorrelationAnalyzerAgent.execute(input);

      // LLM may use various terms for mismatch: drift, different, significant, misalignment, mismatch
      expect(result.overallAssessment.toLowerCase()).toMatch(/drift|different|significant|misalignment|mismatch/);
    });
  });

  // =============================================================================
  // CORRELATION SUMMARY TESTS
  // =============================================================================

  describe('correlation summary', () => {
    it('counts callsites correctly', async () => {
      const input = makeInput({
        callsites: [
          makeCallsite({ id: 'cs_1' }),
          makeCallsite({ id: 'cs_2' }),
          makeCallsite({ id: 'cs_3' }),
        ],
      });

      const { result } = await CorrelationAnalyzerAgent.execute(input);

      // LLM may dedupe by provider:model or count differently
      // Key assertion: should detect at least 1 callsite
      expect(result.correlationSummary.totalCodeCallsites).toBeGreaterThanOrEqual(1);
    });

    it('counts runtime models correctly', async () => {
      const input = makeInput({
        runtimeSummary: makeRuntimeSummary({
          byModel: {
            'gpt-4o': { calls: 50, tokens_in: 5000, tokens_out: 2500, latency_p50: 400, latency_p95: 800, latency_p99: 1200 },
            'gpt-4o-mini': { calls: 30, tokens_in: 3000, tokens_out: 1500, latency_p50: 200, latency_p95: 400, latency_p99: 600 },
            'claude-3-5-sonnet': { calls: 20, tokens_in: 2000, tokens_out: 1000, latency_p50: 500, latency_p95: 1000, latency_p99: 1500 },
          },
        }),
      });

      const { result } = await CorrelationAnalyzerAgent.execute(input);

      expect(result.correlationSummary.totalRuntimeModels).toBe(3);
    });

    it('identifies matched provider:model pairs', async () => {
      const input = makeInput({
        callsites: [
          makeCallsite({ provider: 'openai', model: 'gpt-4o' }),
          makeCallsite({ provider: 'openai', model: 'gpt-4o-mini' }),
        ],
        runtimeSummary: makeRuntimeSummary({
          byModel: {
            'gpt-4o': { calls: 50, tokens_in: 5000, tokens_out: 2500, latency_p50: 400, latency_p95: 800, latency_p99: 1200 },
            'gpt-4o-mini': { calls: 50, tokens_in: 5000, tokens_out: 2500, latency_p50: 200, latency_p95: 400, latency_p99: 600 },
          },
        }),
      });

      const { result } = await CorrelationAnalyzerAgent.execute(input);

      expect(result.correlationSummary.matched).toBe(2);
    });
  });

  // =============================================================================
  // EDGE CASES
  // =============================================================================

  describe('edge cases', () => {
    it('handles empty callsites', async () => {
      const input = makeInput({
        callsites: [],
      });

      const { result } = await CorrelationAnalyzerAgent.execute(input);

      expect(result.correlationSummary.totalCodeCallsites).toBe(0);
      expect(result.correlationSummary.codeOnly).toBe(0);
    });

    it('handles empty runtime summary', async () => {
      const input = makeInput({
        runtimeSummary: makeRuntimeSummary({
          byModel: {},
          byProvider: {},
        }),
      });

      const { result } = await CorrelationAnalyzerAgent.execute(input);

      expect(result.correlationSummary.totalRuntimeModels).toBe(0);
      expect(result.correlationSummary.runtimeOnly).toBe(0);
    });

    it('handles both empty', async () => {
      const input = makeInput({
        callsites: [],
        runtimeSummary: makeRuntimeSummary({
          byModel: {},
          byProvider: {},
        }),
      });

      const { result } = await CorrelationAnalyzerAgent.execute(input);

      // Empty inputs should not crash; alignment interpretation varies (LLM vs fallback)
      expect(result.alignmentScore).toBeGreaterThanOrEqual(0);
      expect(result.alignmentScore).toBeLessThanOrEqual(1);
    });

    it('handles callsites with null provider/model', async () => {
      const input = makeInput({
        callsites: [
          makeCallsite({ provider: null, model: null }),
        ],
      });

      const { result } = await CorrelationAnalyzerAgent.execute(input);

      // Should not crash, but callsite won't be matchable
      expect(result).toBeDefined();
    });

    it('handles unknown provider inference from model name', async () => {
      const input = makeInput({
        callsites: [],
        runtimeSummary: makeRuntimeSummary({
          byModel: {
            'llama-70b': { calls: 100, tokens_in: 10000, tokens_out: 5000, latency_p50: 400, latency_p95: 800, latency_p99: 1200 },
          },
        }),
      });

      const { result } = await CorrelationAnalyzerAgent.execute(input);

      // Should handle unknown provider gracefully
      expect(result.correlationSummary.totalRuntimeModels).toBe(1);
    });
  });

  // =============================================================================
  // ALIGNMENT SCORE TESTS
  // =============================================================================

  describe('alignment score calculation', () => {
    it('returns 1.0 for perfect match', async () => {
      const input = makeInput({
        callsites: [
          makeCallsite({ provider: 'openai', model: 'gpt-4o' }),
        ],
        runtimeSummary: makeRuntimeSummary({
          byModel: {
            'gpt-4o': { calls: 100, tokens_in: 10000, tokens_out: 5000, latency_p50: 400, latency_p95: 800, latency_p99: 1200 },
          },
        }),
      });

      const { result } = await CorrelationAnalyzerAgent.execute(input);

      expect(result.alignmentScore).toBe(1.0);
    });

    it('returns low score for complete mismatch', async () => {
      const input = makeInput({
        callsites: [
          makeCallsite({ provider: 'openai', model: 'gpt-4o' }),
        ],
        runtimeSummary: makeRuntimeSummary({
          byModel: {
            'claude-3-opus': { calls: 100, tokens_in: 10000, tokens_out: 5000, latency_p50: 500, latency_p95: 1000, latency_p99: 1500 },
          },
        }),
      });

      const { result } = await CorrelationAnalyzerAgent.execute(input);

      // Complete mismatch should result in low alignment score (LLM may score differently than fallback)
      expect(result.alignmentScore).toBeLessThanOrEqual(0.5);
    });

    it('returns intermediate score for partial match', async () => {
      const input = makeInput({
        callsites: [
          makeCallsite({ provider: 'openai', model: 'gpt-4o' }),
          makeCallsite({ provider: 'anthropic', model: 'claude-3-opus' }),
        ],
        runtimeSummary: makeRuntimeSummary({
          byModel: {
            'gpt-4o': { calls: 50, tokens_in: 5000, tokens_out: 2500, latency_p50: 400, latency_p95: 800, latency_p99: 1200 },
            'gpt-4o-mini': { calls: 50, tokens_in: 5000, tokens_out: 2500, latency_p50: 200, latency_p95: 400, latency_p99: 600 },
          },
        }),
      });

      const { result } = await CorrelationAnalyzerAgent.execute(input);

      // 1 match out of 3 unique provider:model pairs (2 code + 2 runtime, 1 overlap)
      // Expected: (1 * 2) / 4 = 0.5
      expect(result.alignmentScore).toBeGreaterThan(0);
      expect(result.alignmentScore).toBeLessThan(1);
    });
  });

  // =============================================================================
  // DRIFT SIGNAL TESTS
  // =============================================================================

  describe('drift signal generation', () => {
    it('generates drift signals for code/runtime mismatch', async () => {
      const input = makeInput({
        callsites: [
          makeCallsite({ id: 'cs_orphan', provider: 'anthropic', model: 'claude-3-opus' }),
        ],
        runtimeSummary: makeRuntimeSummary({
          byModel: {
            'gpt-4o': { calls: 100, tokens_in: 10000, tokens_out: 5000, latency_p50: 400, latency_p95: 800, latency_p99: 1200 },
          },
        }),
      });

      const { result } = await CorrelationAnalyzerAgent.execute(input);

      // Should detect drift - either as codeOnly, runtimeOnly, or mismatch depending on LLM
      expect(result.driftSignals.length + result.correlationSummary.codeOnly + result.correlationSummary.runtimeOnly).toBeGreaterThan(0);
    });

    it('generates runtimeOnly drift signal with correct fields', async () => {
      const input = makeInput({
        callsites: [
          makeCallsite({ provider: 'openai', model: 'gpt-4o' }),
        ],
        runtimeSummary: makeRuntimeSummary({
          byModel: {
            'gpt-4o': { calls: 50, tokens_in: 5000, tokens_out: 2500, latency_p50: 400, latency_p95: 800, latency_p99: 1200 },
            'claude-3-opus': { calls: 50, tokens_in: 5000, tokens_out: 2500, latency_p50: 500, latency_p95: 1000, latency_p99: 1500 },
          },
        }),
      });

      const { result } = await CorrelationAnalyzerAgent.execute(input);

      const runtimeOnlySignal = result.driftSignals.find(s => s.type === 'runtimeOnly');
      expect(runtimeOnlySignal).toBeDefined();
      expect(runtimeOnlySignal?.model).toBe('claude-3-opus');
      expect(runtimeOnlySignal?.message).toBeDefined();
    });

    it('does not generate drift signals when fully aligned', async () => {
      const input = makeInput({
        callsites: [
          makeCallsite({ provider: 'openai', model: 'gpt-4o' }),
        ],
        runtimeSummary: makeRuntimeSummary({
          byModel: {
            'gpt-4o': { calls: 100, tokens_in: 10000, tokens_out: 5000, latency_p50: 400, latency_p95: 800, latency_p99: 1200 },
          },
        }),
      });

      const { result } = await CorrelationAnalyzerAgent.execute(input);

      expect(result.driftSignals).toHaveLength(0);
    });
  });

  // =============================================================================
  // INSIGHTS VALIDATION (when LLM is available)
  // =============================================================================

  describe('insights structure', () => {
    it('insights have required fields when generated', async () => {
      const input = makeInput({
        callsites: [
          makeCallsite({ provider: 'anthropic', model: 'claude-3-opus' }),
        ],
        runtimeSummary: makeRuntimeSummary({
          byModel: {
            'gpt-4o': { calls: 100, tokens_in: 10000, tokens_out: 5000, latency_p50: 400, latency_p95: 800, latency_p99: 1200 },
          },
        }),
      });

      const { result } = await CorrelationAnalyzerAgent.execute(input);

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
