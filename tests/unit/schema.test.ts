/**
 * Schema Validation Tests
 * Per Test Cases v1.9.3 - Critical Path Tests
 */
import { describe, test, expect } from 'vitest';
import { z } from 'zod';

// InferenceMap v0.1 Schema (from docs/inferencemap-spec.md)
const InferencePointSchema = z.object({
  id: z.string(),
  file: z.string(),
  line: z.number(),
  function: z.string().optional(),
  provider: z.string(),
  model: z.string(),
  streaming: z.boolean().optional(),
  costProfile: z.object({
    estimatedCostPer1K: z.number().optional(),
    inputTokens: z.number().optional(),
    outputTokens: z.number().optional(),
  }).optional(),
});

const IssueSchema = z.object({
  id: z.string(),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  category: z.enum(['cost', 'latency', 'throughput', 'reliability', 'drift']),
  title: z.string(),
  description: z.string(),
  file: z.string(),
  line: z.number(),
  impact: z.string().optional(),
  fix: z.object({
    description: z.string(),
    effort: z.string().optional(),
    code: z.string().optional(),
  }).optional(),
});

const InferenceMapSchema = z.object({
  version: z.string(),
  generated: z.string(),
  inferencePoints: z.array(InferencePointSchema),
  issues: z.array(IssueSchema),
  summary: z.object({
    totalInferencePoints: z.number(),
    providers: z.array(z.string()),
    criticalIssues: z.number(),
    highIssues: z.number(),
    mediumIssues: z.number(),
    lowIssues: z.number().optional(),
  }),
});

// Runtime Event Schema
const RuntimeEventSchema = z.object({
  id: z.string(),
  ts: z.string(),
  provider: z.string(),
  model: z.string(),
  input_tokens: z.number(),
  output_tokens: z.number(),
  latency_ms: z.number(),
  intent: z.string().optional(),
  callsite_id: z.string().optional(),
});

describe('InferenceMap Schema', () => {
  test('Valid InferenceMap passes validation', () => {
    const validMap = {
      version: '0.1',
      generated: '2025-12-24T00:00:00.000Z',
      inferencePoints: [
        {
          id: 'ip-1',
          file: 'src/chat.ts',
          line: 42,
          function: 'chat',
          provider: 'anthropic',
          model: 'claude-sonnet-4-20250514',
          streaming: true,
        },
      ],
      issues: [
        {
          id: 'issue-1',
          severity: 'high',
          category: 'cost',
          title: 'Overpowered model',
          description: 'Using expensive model for simple task',
          file: 'src/chat.ts',
          line: 42,
        },
      ],
      summary: {
        totalInferencePoints: 1,
        providers: ['anthropic'],
        criticalIssues: 0,
        highIssues: 1,
        mediumIssues: 0,
      },
    };

    expect(() => InferenceMapSchema.parse(validMap)).not.toThrow();
  });

  test('Missing version fails validation', () => {
    const invalidMap = {
      generated: '2025-12-24T00:00:00.000Z',
      inferencePoints: [],
      issues: [],
      summary: {
        totalInferencePoints: 0,
        providers: [],
        criticalIssues: 0,
        highIssues: 0,
        mediumIssues: 0,
      },
    };

    expect(() => InferenceMapSchema.parse(invalidMap)).toThrow();
  });

  test('Invalid severity fails validation', () => {
    const invalidMap = {
      version: '0.1',
      generated: '2025-12-24T00:00:00.000Z',
      inferencePoints: [],
      issues: [
        {
          id: 'issue-1',
          severity: 'super-critical', // Invalid
          category: 'cost',
          title: 'Test',
          description: 'Test',
          file: 'test.ts',
          line: 1,
        },
      ],
      summary: {
        totalInferencePoints: 0,
        providers: [],
        criticalIssues: 0,
        highIssues: 0,
        mediumIssues: 0,
      },
    };

    expect(() => InferenceMapSchema.parse(invalidMap)).toThrow();
  });

  test('Invalid category fails validation', () => {
    const invalidMap = {
      version: '0.1',
      generated: '2025-12-24T00:00:00.000Z',
      inferencePoints: [],
      issues: [
        {
          id: 'issue-1',
          severity: 'high',
          category: 'performance', // Invalid - should be cost/latency/throughput/reliability/drift
          title: 'Test',
          description: 'Test',
          file: 'test.ts',
          line: 1,
        },
      ],
      summary: {
        totalInferencePoints: 0,
        providers: [],
        criticalIssues: 0,
        highIssues: 0,
        mediumIssues: 0,
      },
    };

    expect(() => InferenceMapSchema.parse(invalidMap)).toThrow();
  });

  test('Empty arrays are valid', () => {
    const emptyMap = {
      version: '0.1',
      generated: '2025-12-24T00:00:00.000Z',
      inferencePoints: [],
      issues: [],
      summary: {
        totalInferencePoints: 0,
        providers: [],
        criticalIssues: 0,
        highIssues: 0,
        mediumIssues: 0,
      },
    };

    expect(() => InferenceMapSchema.parse(emptyMap)).not.toThrow();
  });
});

describe('Runtime Event Schema', () => {
  test('Valid runtime event passes validation', () => {
    const validEvent = {
      id: 'event-1',
      ts: '2025-12-24T00:00:00.000Z',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      input_tokens: 100,
      output_tokens: 200,
      latency_ms: 1500,
    };

    expect(() => RuntimeEventSchema.parse(validEvent)).not.toThrow();
  });

  test('Missing required fields fail validation', () => {
    const missingId = {
      ts: '2025-12-24T00:00:00.000Z',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      input_tokens: 100,
      output_tokens: 200,
      latency_ms: 1500,
    };

    expect(() => RuntimeEventSchema.parse(missingId)).toThrow();
  });

  test('Wrong type for latency_ms fails validation', () => {
    const wrongType = {
      id: 'event-1',
      ts: '2025-12-24T00:00:00.000Z',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      input_tokens: 100,
      output_tokens: 200,
      latency_ms: '1500', // Should be number
    };

    expect(() => RuntimeEventSchema.parse(wrongType)).toThrow();
  });

  test('Optional fields are accepted', () => {
    const withOptional = {
      id: 'event-1',
      ts: '2025-12-24T00:00:00.000Z',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      input_tokens: 100,
      output_tokens: 200,
      latency_ms: 1500,
      intent: 'chat',
      callsite_id: 'cs-1',
    };

    expect(() => RuntimeEventSchema.parse(withOptional)).not.toThrow();
  });
});

describe('Inference Point Schema', () => {
  test('Minimal inference point is valid', () => {
    const minimal = {
      id: 'ip-1',
      file: 'src/chat.ts',
      line: 42,
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
    };

    expect(() => InferencePointSchema.parse(minimal)).not.toThrow();
  });

  test('Full inference point is valid', () => {
    const full = {
      id: 'ip-1',
      file: 'src/chat.ts',
      line: 42,
      function: 'chat',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      streaming: true,
      costProfile: {
        estimatedCostPer1K: 0.015,
        inputTokens: 500,
        outputTokens: 2000,
      },
    };

    expect(() => InferencePointSchema.parse(full)).not.toThrow();
  });

  test('Missing id fails validation', () => {
    const noId = {
      file: 'src/chat.ts',
      line: 42,
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
    };

    expect(() => InferencePointSchema.parse(noId)).toThrow();
  });
});
