/**
 * Template Conformance Tests
 *
 * Validates that LLM responses from RuntimeAnalyzerAgent and CorrelationAnalyzerAgent
 * conform to the expected output format defined in their YAML prompts.
 *
 * Run with API key for real LLM testing:
 *   source .env && npx vitest run tests/template-conformance.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { z } from 'zod';
import { RuntimeAnalyzerAgent, type RuntimeAnalyzerInput } from '../src/agents/runtime-analyzer.js';
import { CorrelationAnalyzerAgent, type CorrelationAnalyzerInput } from '../src/agents/correlation-analyzer.js';
import { setTestPricing } from '../src/costs.js';
import type { Callsite, InferenceEvent, RuntimeSummary } from '../src/types.js';

// =============================================================================
// EXPECTED SCHEMAS (from prompts/*.yaml output_format sections)
// =============================================================================

/**
 * RuntimeAnalyzerAgent expected output schema
 * From: prompts/runtime-analyzer.yaml <output_format>
 */
const RuntimeInsightSchema = z.object({
  severity: z.enum(['critical', 'warning', 'info']),
  category: z.enum(['cost', 'latency', 'reliability', 'throughput', 'waste']),
  headline: z.string().min(1),
  evidence: z.string().min(1),
  recommendation: z.string().optional(),
  impact: z.object({
    layer: z.enum(['application', 'model', 'runtime', 'infrastructure']),
    impactType: z.enum(['cost', 'latency', 'throughput']),
    estimatedImpactPercent: z.number().min(0).max(100),
    effort: z.enum(['low', 'medium', 'high']),
  }).optional(),
});

const RuntimeDetectedPatternsSchema = z.object({
  applicationType: z.enum(['rag', 'agent', 'batch', 'chat', 'pipeline', 'unknown']),
  multiModelPipeline: z.boolean(),
  streamingDetected: z.boolean(),
  batchingDetected: z.boolean(),
  cachingDetected: z.boolean(),
});

const RuntimeSummaryOutputSchema = z.object({
  totalCalls: z.number(),
  totalTokens: z.number(),
  dominantProvider: z.string(),
  dominantModel: z.string(),
  estimatedDailyCostUSD: z.number(),
});

const RuntimeAnalyzerOutputSchema = z.object({
  insights: z.array(RuntimeInsightSchema),
  detectedPatterns: RuntimeDetectedPatternsSchema,
  summary: RuntimeSummaryOutputSchema,
});

/**
 * CorrelationAnalyzerAgent expected output schema
 * From: prompts/correlation-analyzer.yaml <output_format>
 */
const DriftSignalSchema = z.object({
  type: z.enum(['codeOnly', 'runtimeOnly', 'mismatch', 'patternDrift']),
  provider: z.string().optional(),
  model: z.string().optional(),
  callsiteId: z.string().optional(),
  message: z.string(),
});

const CorrelationSummarySchema = z.object({
  totalCodeCallsites: z.number(),
  totalRuntimeModels: z.number(),
  matched: z.number(),
  codeOnly: z.number(),
  runtimeOnly: z.number(),
  mismatched: z.number(),
});

const CorrelationInsightSchema = z.object({
  id: z.string().optional(),
  severity: z.enum(['critical', 'warning', 'info']),
  category: z.enum(['cost', 'latency', 'drift', 'reliability', 'waste', 'throughput', 'security', 'best-practice']),
  headline: z.string().min(1),
  evidence: z.string().min(1),
  location: z.string().optional(),
  recommendation: z.string().optional(),
  source: z.enum(['template', 'llm']).optional(),
  impact: z.object({
    layer: z.enum(['application', 'model', 'runtime', 'infrastructure']),
    impactType: z.enum(['cost', 'latency', 'throughput']),
    estimatedImpactPercent: z.number().min(0).max(100),
    effort: z.enum(['low', 'medium', 'high']),
    confidence: z.number().min(0).max(1).optional(),
  }).optional(),
});

const CorrelationAnalyzerOutputSchema = z.object({
  insights: z.array(CorrelationInsightSchema),
  driftSignals: z.array(DriftSignalSchema),
  correlationSummary: CorrelationSummarySchema,
  alignmentScore: z.number().min(0).max(1),
  overallAssessment: z.string().min(1),
});

// =============================================================================
// TEST FIXTURES
// =============================================================================

beforeAll(() => {
  setTestPricing({
    'gpt-4o': { input: 5.0, output: 15.0 },
    'gpt-4o-mini': { input: 0.15, output: 0.6 },
    'claude-3-opus': { input: 15.0, output: 75.0 },
    'text-embedding-3-large': { input: 0.13, output: 0.0 },
  });
});

const makeEvent = (overrides: Partial<InferenceEvent> = {}): InferenceEvent => ({
  id: `evt_${Math.random().toString(36).slice(2, 9)}`,
  ts: '2024-01-15T10:30:00Z',
  provider: 'openai',
  model: 'gpt-4o',
  input_tokens: 500,
  output_tokens: 200,
  latency_ms: 1200,
  ...overrides,
});

const makeCallsite = (overrides: Partial<Callsite> = {}): Callsite => ({
  id: `cs_${Math.random().toString(36).slice(2, 9)}`,
  file: 'src/api/chat.ts',
  line: 42,
  provider: 'openai',
  model: 'gpt-4o',
  framework: null,
  runtime: null,
  patterns: { streaming: true },
  confidence: 0.95,
  ...overrides,
});

const makeRuntimeSummary = (): RuntimeSummary => ({
  totalEvents: 100,
  byProvider: {
    openai: { calls: 80, tokens_in: 40000, tokens_out: 16000, latency_p50: 1000, latency_p95: 2500, latency_p99: 4000 },
    anthropic: { calls: 20, tokens_in: 10000, tokens_out: 4000, latency_p50: 1200, latency_p95: 2800, latency_p99: 4500 },
  },
  byModel: {
    'gpt-4o': { calls: 60, tokens_in: 30000, tokens_out: 12000, latency_p50: 1000, latency_p95: 2500, latency_p99: 4000 },
    'gpt-4o-mini': { calls: 20, tokens_in: 10000, tokens_out: 4000, latency_p50: 400, latency_p95: 800, latency_p99: 1200 },
    'claude-3-opus': { calls: 20, tokens_in: 10000, tokens_out: 4000, latency_p50: 1200, latency_p95: 2800, latency_p99: 4500 },
  },
  global: { p50: 1000, p95: 2500, p99: 4000 },
});

// =============================================================================
// RUNTIME ANALYZER TEMPLATE CONFORMANCE TESTS
// =============================================================================

describe('RuntimeAnalyzerAgent Template Conformance', () => {
  describe('output schema validation', () => {
    it('returns output conforming to template schema', async () => {
      const input: RuntimeAnalyzerInput = {
        events: Array.from({ length: 20 }, (_, i) => makeEvent({
          id: `evt_${i}`,
          model: i < 15 ? 'gpt-4o' : 'gpt-4o-mini',
          input_tokens: 500 + (i * 50),
          output_tokens: 100 + (i * 10),
          latency_ms: 800 + (i * 100),
        })),
        runtimeSummary: makeRuntimeSummary(),
      };

      const { result } = await RuntimeAnalyzerAgent.execute(input);

      // Validate against schema
      const validation = RuntimeAnalyzerOutputSchema.safeParse(result);

      if (!validation.success) {
        console.error('Schema validation errors:', JSON.stringify(validation.error.issues, null, 2));
      }

      expect(validation.success).toBe(true);
    });

    it('insights have all required fields from template', async () => {
      const input: RuntimeAnalyzerInput = {
        events: [
          makeEvent({ model: 'gpt-4o', input_tokens: 10000, output_tokens: 100 }), // Prompt bloat
        ],
        runtimeSummary: makeRuntimeSummary(),
      };

      const { result } = await RuntimeAnalyzerAgent.execute(input);

      for (const insight of result.insights) {
        // Required fields from <output_format>
        expect(insight).toHaveProperty('severity');
        expect(insight).toHaveProperty('category');
        expect(insight).toHaveProperty('headline');
        expect(insight).toHaveProperty('evidence');

        // Enum validation
        expect(['critical', 'warning', 'info']).toContain(insight.severity);
        expect(['cost', 'latency', 'reliability', 'throughput', 'waste']).toContain(insight.category);

        // Non-empty strings
        expect(insight.headline.length).toBeGreaterThan(0);
        expect(insight.evidence.length).toBeGreaterThan(0);
      }
    });

    it('detected_patterns matches template enum values', async () => {
      const input: RuntimeAnalyzerInput = {
        events: [makeEvent({ streaming: true, batch_id: 'b1' })],
        runtimeSummary: makeRuntimeSummary(),
      };

      const { result } = await RuntimeAnalyzerAgent.execute(input);

      // application_type enum from template
      const validAppTypes = ['rag', 'agent', 'batch', 'chat', 'pipeline', 'unknown'];
      expect(validAppTypes).toContain(result.detectedPatterns.applicationType);

      // Boolean fields
      expect(typeof result.detectedPatterns.multiModelPipeline).toBe('boolean');
      expect(typeof result.detectedPatterns.streamingDetected).toBe('boolean');
      expect(typeof result.detectedPatterns.batchingDetected).toBe('boolean');
      expect(typeof result.detectedPatterns.cachingDetected).toBe('boolean');
    });

    it('impact estimates follow template constraints', async () => {
      const input: RuntimeAnalyzerInput = {
        events: Array.from({ length: 10 }, () => makeEvent()),
        runtimeSummary: makeRuntimeSummary(),
      };

      const { result } = await RuntimeAnalyzerAgent.execute(input);

      for (const insight of result.insights) {
        if (insight.impact) {
          // layer enum from template
          expect(['application', 'model', 'runtime', 'infrastructure']).toContain(insight.impact.layer);

          // impactType enum
          expect(['cost', 'latency', 'throughput']).toContain(insight.impact.impactType);

          // estimatedImpactPercent range (0-100)
          expect(insight.impact.estimatedImpactPercent).toBeGreaterThanOrEqual(0);
          expect(insight.impact.estimatedImpactPercent).toBeLessThanOrEqual(100);

          // effort enum
          expect(['low', 'medium', 'high']).toContain(insight.impact.effort);
        }
      }
    });

    it('respects max 10 insights constraint from template', async () => {
      const input: RuntimeAnalyzerInput = {
        events: Array.from({ length: 100 }, (_, i) => makeEvent({
          id: `evt_${i}`,
          model: ['gpt-4o', 'gpt-4o-mini', 'claude-3-opus'][i % 3],
        })),
        runtimeSummary: makeRuntimeSummary(),
      };

      const { result } = await RuntimeAnalyzerAgent.execute(input);

      // Template says "Maximum 10 insights, ranked by impact"
      expect(result.insights.length).toBeLessThanOrEqual(10);
    });
  });

  describe('semantic validation', () => {
    it('insights reference actual data from input', async () => {
      const input: RuntimeAnalyzerInput = {
        events: [
          makeEvent({ model: 'gpt-4o', latency_ms: 5000 }),
          makeEvent({ model: 'gpt-4o', latency_ms: 5500 }),
        ],
        runtimeSummary: {
          totalEvents: 2,
          byProvider: { openai: { calls: 2, tokens_in: 1000, tokens_out: 400, latency_p50: 5250, latency_p95: 5500, latency_p99: 5500 } },
          byModel: { 'gpt-4o': { calls: 2, tokens_in: 1000, tokens_out: 400, latency_p50: 5250, latency_p95: 5500, latency_p99: 5500 } },
          global: { p50: 5250, p95: 5500, p99: 5500 },
        },
      };

      const { result } = await RuntimeAnalyzerAgent.execute(input);

      // Summary should reflect actual data
      expect(result.summary.dominantModel).toContain('gpt');
      expect(result.summary.totalCalls).toBeGreaterThanOrEqual(0);
    });
  });
});

// =============================================================================
// CORRELATION ANALYZER TEMPLATE CONFORMANCE TESTS
// =============================================================================

describe('CorrelationAnalyzerAgent Template Conformance', () => {
  describe('output schema validation', () => {
    it('returns output conforming to template schema', async () => {
      const input: CorrelationAnalyzerInput = {
        callsites: [
          makeCallsite({ provider: 'openai', model: 'gpt-4o' }),
          makeCallsite({ provider: 'anthropic', model: 'claude-3-opus' }),
        ],
        events: [makeEvent({ provider: 'openai', model: 'gpt-4o-mini' })],
        runtimeSummary: makeRuntimeSummary(),
      };

      const { result } = await CorrelationAnalyzerAgent.execute(input);

      // Validate against schema
      const validation = CorrelationAnalyzerOutputSchema.safeParse(result);

      if (!validation.success) {
        console.error('Schema validation errors:', JSON.stringify(validation.error.issues, null, 2));
      }

      expect(validation.success).toBe(true);
    });

    it('drift signals have correct type enum from template', async () => {
      const input: CorrelationAnalyzerInput = {
        callsites: [makeCallsite({ provider: 'anthropic', model: 'claude-3-opus' })],
        events: [makeEvent({ provider: 'openai', model: 'gpt-4o' })],
        runtimeSummary: makeRuntimeSummary(),
      };

      const { result } = await CorrelationAnalyzerAgent.execute(input);

      // Template defines: codeOnly|runtimeOnly|modelMismatch|patternMismatch|providerMismatch
      // Our code normalizes to: codeOnly|runtimeOnly|mismatch|patternDrift
      const validTypes = ['codeOnly', 'runtimeOnly', 'mismatch', 'patternDrift', 'modelMismatch', 'patternMismatch', 'providerMismatch'];

      for (const signal of result.driftSignals) {
        expect(validTypes).toContain(signal.type);
      }
    });

    it('alignment_score is between 0.0 and 1.0 as per template', async () => {
      const input: CorrelationAnalyzerInput = {
        callsites: [makeCallsite()],
        events: [makeEvent()],
        runtimeSummary: makeRuntimeSummary(),
      };

      const { result } = await CorrelationAnalyzerAgent.execute(input);

      expect(result.alignmentScore).toBeGreaterThanOrEqual(0.0);
      expect(result.alignmentScore).toBeLessThanOrEqual(1.0);
    });

    it('correlation_summary has all fields from template', async () => {
      const input: CorrelationAnalyzerInput = {
        callsites: [makeCallsite(), makeCallsite()],
        events: [makeEvent()],
        runtimeSummary: makeRuntimeSummary(),
      };

      const { result } = await CorrelationAnalyzerAgent.execute(input);

      // Required fields from template
      expect(result.correlationSummary).toHaveProperty('totalCodeCallsites');
      expect(result.correlationSummary).toHaveProperty('totalRuntimeModels');
      expect(result.correlationSummary).toHaveProperty('matched');
      expect(result.correlationSummary).toHaveProperty('codeOnly');
      expect(result.correlationSummary).toHaveProperty('runtimeOnly');
      expect(result.correlationSummary).toHaveProperty('mismatched');

      // All should be numbers
      expect(typeof result.correlationSummary.totalCodeCallsites).toBe('number');
      expect(typeof result.correlationSummary.matched).toBe('number');
    });

    it('overall_assessment is non-empty string as per template', async () => {
      const input: CorrelationAnalyzerInput = {
        callsites: [makeCallsite()],
        events: [makeEvent()],
        runtimeSummary: makeRuntimeSummary(),
      };

      const { result } = await CorrelationAnalyzerAgent.execute(input);

      expect(typeof result.overallAssessment).toBe('string');
      expect(result.overallAssessment.length).toBeGreaterThan(0);
    });

    it('respects max 15 drift signals constraint from template', async () => {
      const input: CorrelationAnalyzerInput = {
        callsites: Array.from({ length: 20 }, (_, i) =>
          makeCallsite({ id: `cs_${i}`, model: `model-${i}` })
        ),
        events: Array.from({ length: 20 }, (_, i) =>
          makeEvent({ id: `evt_${i}`, model: `other-model-${i}` })
        ),
        runtimeSummary: makeRuntimeSummary(),
      };

      const { result } = await CorrelationAnalyzerAgent.execute(input);

      // Template says "Maximum 15 drift signals, prioritized by severity"
      expect(result.driftSignals.length).toBeLessThanOrEqual(15);
    });
  });

  describe('semantic validation', () => {
    it('detects model mismatch correctly', async () => {
      // Code says gpt-4o, runtime shows gpt-4o-mini
      const input: CorrelationAnalyzerInput = {
        callsites: [makeCallsite({ provider: 'openai', model: 'gpt-4o' })],
        events: [makeEvent({ provider: 'openai', model: 'gpt-4o-mini' })],
        runtimeSummary: {
          totalEvents: 1,
          byProvider: { openai: { calls: 1, tokens_in: 500, tokens_out: 200, latency_p50: 400, latency_p95: 400, latency_p99: 400 } },
          byModel: { 'gpt-4o-mini': { calls: 1, tokens_in: 500, tokens_out: 200, latency_p50: 400, latency_p95: 400, latency_p99: 400 } },
          global: { p50: 400, p95: 400, p99: 400 },
        },
      };

      const { result } = await CorrelationAnalyzerAgent.execute(input);

      // Should detect drift (either as mismatch, codeOnly + runtimeOnly, or low alignment)
      const hasDrift =
        result.driftSignals.length > 0 ||
        result.correlationSummary.mismatched > 0 ||
        result.correlationSummary.codeOnly > 0 ||
        result.correlationSummary.runtimeOnly > 0 ||
        result.alignmentScore < 1.0;

      expect(hasDrift).toBe(true);
    });

    it('perfect match has high alignment score', async () => {
      // Same provider:model in code and runtime
      const input: CorrelationAnalyzerInput = {
        callsites: [makeCallsite({ provider: 'openai', model: 'gpt-4o' })],
        events: [makeEvent({ provider: 'openai', model: 'gpt-4o' })],
        runtimeSummary: {
          totalEvents: 1,
          byProvider: { openai: { calls: 1, tokens_in: 500, tokens_out: 200, latency_p50: 1200, latency_p95: 1200, latency_p99: 1200 } },
          byModel: { 'gpt-4o': { calls: 1, tokens_in: 500, tokens_out: 200, latency_p50: 1200, latency_p95: 1200, latency_p99: 1200 } },
          global: { p50: 1200, p95: 1200, p99: 1200 },
        },
      };

      const { result } = await CorrelationAnalyzerAgent.execute(input);

      // Perfect match should have high alignment
      expect(result.alignmentScore).toBeGreaterThanOrEqual(0.5);
    });
  });
});

// =============================================================================
// CROSS-AGENT CONSISTENCY TESTS
// =============================================================================

describe('Cross-Agent Template Consistency', () => {
  it('both agents use consistent severity levels', async () => {
    const runtimeInput: RuntimeAnalyzerInput = {
      events: [makeEvent()],
      runtimeSummary: makeRuntimeSummary(),
    };

    const correlationInput: CorrelationAnalyzerInput = {
      callsites: [makeCallsite()],
      events: [makeEvent()],
      runtimeSummary: makeRuntimeSummary(),
    };

    const [runtimeResult, correlationResult] = await Promise.all([
      RuntimeAnalyzerAgent.execute(runtimeInput),
      CorrelationAnalyzerAgent.execute(correlationInput),
    ]);

    const validSeverities = ['critical', 'warning', 'info'];

    for (const insight of runtimeResult.result.insights) {
      expect(validSeverities).toContain(insight.severity);
    }

    for (const insight of correlationResult.result.insights) {
      expect(validSeverities).toContain(insight.severity);
    }
  });

  it('both agents use consistent impact layer enum', async () => {
    const runtimeInput: RuntimeAnalyzerInput = {
      events: Array.from({ length: 10 }, () => makeEvent()),
      runtimeSummary: makeRuntimeSummary(),
    };

    const correlationInput: CorrelationAnalyzerInput = {
      callsites: [makeCallsite({ model: 'claude-3-opus' })],
      events: [makeEvent({ model: 'gpt-4o' })],
      runtimeSummary: makeRuntimeSummary(),
    };

    const [runtimeResult, correlationResult] = await Promise.all([
      RuntimeAnalyzerAgent.execute(runtimeInput),
      CorrelationAnalyzerAgent.execute(correlationInput),
    ]);

    const validLayers = ['application', 'model', 'runtime', 'infrastructure'];

    for (const insight of runtimeResult.result.insights) {
      if (insight.impact) {
        expect(validLayers).toContain(insight.impact.layer);
      }
    }

    for (const insight of correlationResult.result.insights) {
      if (insight.impact) {
        expect(validLayers).toContain(insight.impact.layer);
      }
    }
  });
});
