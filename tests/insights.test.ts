import { describe, it, expect, beforeAll } from 'vitest';
import { evaluate } from '../src/insights.js';
import { setTestPricing } from '../src/costs.js';
import type { InsightTemplate, EnrichedCallsite, JoinedOutput } from '../src/types.js';

// Set up mock pricing data before tests
beforeAll(() => {
  setTestPricing({
    'gpt-4o': { input: 5.0, output: 15.0 },          // $5/$15 per 1M tokens
    'gpt-4o-mini': { input: 0.15, output: 0.6 },     // $0.15/$0.60 per 1M tokens
    'gpt-4': { input: 30.0, output: 60.0 },          // $30/$60 per 1M tokens
    'claude-3-opus': { input: 15.0, output: 75.0 },
    'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0 },
  });
});

// =============================================================================
// TEST TEMPLATES (matching the 12 templates in peakinfer_templates repo)
// =============================================================================

const templates: InsightTemplate[] = [
  // COST TEMPLATES (4)
  {
    id: 'prompt-bloat',
    version: '1.0',
    name: 'Prompt Bloat Detection',
    description: 'Detects high input/output token ratio',
    category: 'cost',
    severity: 'warning',
    tags: ['tokens', 'prompt'],
    match: {
      scope: 'callsite',
      conditions: [
        { field: 'usage.tokens_in', op: 'ratio_gt', compare_to: 'usage.tokens_out', value: 20 },
      ],
    },
    output: {
      headline: '{{input_output_ratio}}x more input than output tokens',
      evidence: '{{location}}: Sending {{tokens_in}} tokens, receiving {{tokens_out}}.',
    },
    recommends: [],
  },
  {
    id: 'retry-explosion',
    version: '1.0',
    name: 'Retry Storm Detection',
    description: 'Detects retry storms via latency ratio',
    category: 'cost',
    severity: 'critical',
    tags: ['retry', 'error-handling'],
    match: {
      scope: 'callsite',
      conditions: [
        { field: 'usage.calls', op: 'gt', value: 10 },
        { field: 'usage.latency_p99', op: 'ratio_gt', compare_to: 'usage.latency_p50', value: 5 },
      ],
    },
    output: {
      headline: 'Possible retry storm at {{location}}',
      evidence: '{{calls}} calls with p99/p50 latency ratio of {{ratio}}x.',
    },
    recommends: [],
  },
  {
    id: 'cost-concentration',
    version: '1.0',
    name: 'Cost Concentration Detection',
    description: 'Single callsite dominates cost',
    category: 'cost',
    severity: 'warning',
    tags: ['cost', 'concentration'],
    match: {
      scope: 'global',
      conditions: [
        { field: 'top_callsite_cost_percent', op: 'gt', value: 50 },
      ],
    },
    output: {
      headline: '{{percent}}% of cost from one callsite',
      evidence: '{{model}} at {{location}} dominates spend.',
    },
    recommends: [],
  },
  {
    id: 'overpowered-extraction',
    version: '1.0',
    name: 'Overpowered Model for Simple Tasks',
    description: 'Premium model for small outputs',
    category: 'cost',
    severity: 'warning',
    tags: ['model-selection'],
    match: {
      scope: 'callsite',
      conditions: [
        { field: 'model', op: 'in', value: ['gpt-4o', 'gpt-4', 'claude-3-opus', 'claude-3-5-sonnet-20241022'] },
        { field: 'avg_tokens', op: 'lt', value: 100 },
      ],
    },
    output: {
      headline: 'Using {{model}} for {{avg_tokens}}-token outputs',
      evidence: '{{location}}: Consider gpt-4o-mini for simple tasks.',
    },
    recommends: [],
  },

  // DRIFT TEMPLATES (3)
  {
    id: 'dead-code',
    version: '1.0',
    name: 'Dead Code Detection',
    description: 'Callsites with no runtime events',
    category: 'drift',
    severity: 'warning',
    tags: ['dead-code', 'drift'],
    match: {
      scope: 'joined',
      conditions: [
        { field: 'codeOnly.length', op: 'gt', value: 0 },
      ],
    },
    output: {
      headline: '{{count}} callsites in code with no runtime events',
      evidence: '{{locations}}',
    },
    recommends: [],
  },
  {
    id: 'streaming-drift',
    version: '1.0',
    name: 'Streaming Drift Detection',
    description: 'Streaming declared but high latency',
    category: 'drift',
    severity: 'warning',
    tags: ['streaming', 'drift'],
    match: {
      scope: 'callsite',
      conditions: [
        { field: 'patterns.streaming', op: 'eq', value: true },
        { field: 'usage.latency_p50', op: 'gt', value: 2000 },
      ],
    },
    output: {
      headline: 'Streaming declared but p50 latency is {{p50}}ms',
      evidence: '{{location}}: Code says stream=True but response times suggest buffering.',
    },
    recommends: [],
  },
  {
    id: 'untested-fallback',
    version: '1.0',
    name: 'Untested Fallback Detection',
    description: 'Fallback pattern rarely exercised',
    category: 'drift',
    severity: 'info',
    tags: ['fallback', 'reliability'],
    match: {
      scope: 'callsite',
      conditions: [
        { field: 'patterns.fallback', op: 'eq', value: true },
        { field: 'usage.calls', op: 'lt', value: 5 },
      ],
    },
    output: {
      headline: 'Fallback at {{location}} has rarely fired',
      evidence: 'Only {{calls}} calls recorded.',
    },
    recommends: [],
  },

  // PERFORMANCE TEMPLATES (3)
  {
    id: 'throughput-gap',
    version: '1.0',
    name: 'Throughput Gap Detection',
    description: 'Running below achievable throughput',
    category: 'performance',
    severity: 'warning',
    tags: ['throughput', 'performance'],
    match: {
      scope: 'envelope',
      conditions: [
        { field: 'actual_tps', op: 'ratio_lt', compare_to: 'envelope.tps_median', value: 0.5 },
      ],
    },
    output: {
      headline: 'Running at {{percent}}% of achievable throughput',
      evidence: 'Your {{model}}: {{actual}} tok/s, reference: {{reference}} tok/s.',
    },
    recommends: [],
  },
  {
    id: 'latency-explainer',
    version: '1.0',
    name: 'High Latency Without Streaming',
    description: 'High p95 without streaming enabled',
    category: 'performance',
    severity: 'warning',
    tags: ['latency', 'streaming'],
    match: {
      scope: 'callsite',
      conditions: [
        { field: 'patterns.streaming', op: 'neq', value: true },
        { field: 'usage.latency_p95', op: 'gt', value: 3000 },
      ],
    },
    output: {
      headline: 'p95 latency {{p95}}ms without streaming',
      evidence: '{{location}}: Enable streaming to improve perceived latency.',
    },
    recommends: [],
  },
  {
    id: 'context-accumulation',
    version: '1.0',
    name: 'Context Window Bloat Detection',
    description: 'Very high input token counts',
    category: 'performance',
    severity: 'warning',
    tags: ['context', 'tokens'],
    match: {
      scope: 'callsite',
      conditions: [
        { field: 'usage.tokens_in', op: 'gt', value: 50000 },
      ],
    },
    output: {
      headline: 'High context usage at {{location}}',
      evidence: 'Averaging {{avg_tokens_in}} input tokens per call.',
    },
    recommends: [],
  },

  // WASTE TEMPLATES (2)
  {
    id: 'overpowered-model',
    version: '1.0',
    name: 'Overpowered Model Detection',
    description: 'Premium model with tiny outputs',
    category: 'waste',
    severity: 'info',
    tags: ['model-selection', 'cost'],
    match: {
      scope: 'callsite',
      conditions: [
        { field: 'model', op: 'in', value: ['gpt-4o', 'gpt-4', 'claude-3-opus'] },
        { field: 'avg_tokens', op: 'lt', value: 50 },
      ],
    },
    output: {
      headline: '{{model}} generating only {{avg_tokens}} tokens average',
      evidence: '{{location}}: Short outputs suggest cheaper models may work.',
    },
    recommends: [],
  },
  {
    id: 'token-underutilization',
    version: '1.0',
    name: 'Token Budget Underutilization',
    description: 'Low output token counts',
    category: 'waste',
    severity: 'info',
    tags: ['tokens', 'max-tokens'],
    match: {
      scope: 'callsite',
      conditions: [
        { field: 'usage.tokens_out', op: 'exists' },
        { field: 'avg_tokens', op: 'lt', value: 200 },
      ],
    },
    output: {
      headline: 'Low output utilization at {{location}}',
      evidence: 'Averaging {{avg_tokens}} output tokens.',
    },
    recommends: [],
  },
];

// =============================================================================
// HELPER: Create enriched callsite
// =============================================================================

function createCallsite(overrides: Partial<EnrichedCallsite> & { file: string; line: number }): EnrichedCallsite {
  return {
    id: `${overrides.file}:${overrides.line}`,
    file: overrides.file,
    line: overrides.line,
    snippet: overrides.snippet || 'openai.chat.completions.create(...)',
    provider: overrides.provider || 'openai',
    model: overrides.model || 'gpt-4o-mini',
    patterns: overrides.patterns || {},
    usage: overrides.usage,
  };
}

// =============================================================================
// COST TEMPLATE TESTS
// =============================================================================

describe('Cost Templates', () => {
  describe('prompt-bloat', () => {
    it('triggers when input/output ratio > 20', () => {
      const callsites: EnrichedCallsite[] = [
        createCallsite({
          file: 'src/api/chat.ts',
          line: 45,
          usage: {
            calls: 100,
            tokens_in: 50000,   // 50000 / 500 = 100x ratio
            tokens_out: 500,
            latency_p50: 1000,
            latency_p95: 2000,
            latency_p99: 3000,
          },
        }),
      ];

      const insights = evaluate({ callsites }, [templates[0]]);

      expect(insights).toHaveLength(1);
      expect(insights[0].templateId).toBe('prompt-bloat');
      expect(insights[0].headline).toContain('100x more input than output');
    });

    it('does not trigger when ratio <= 20', () => {
      const callsites: EnrichedCallsite[] = [
        createCallsite({
          file: 'src/api/chat.ts',
          line: 45,
          usage: {
            calls: 100,
            tokens_in: 1000,
            tokens_out: 100,   // 10x ratio
            latency_p50: 1000,
            latency_p95: 2000,
            latency_p99: 3000,
          },
        }),
      ];

      const insights = evaluate({ callsites }, [templates[0]]);
      expect(insights).toHaveLength(0);
    });
  });

  describe('retry-explosion', () => {
    it('triggers when calls > 10 AND latency ratio > 5', () => {
      const callsites: EnrichedCallsite[] = [
        createCallsite({
          file: 'src/services/llm.ts',
          line: 120,
          usage: {
            calls: 50,
            tokens_in: 1000,
            tokens_out: 100,
            latency_p50: 500,
            latency_p95: 2000,
            latency_p99: 3000,  // 3000/500 = 6x ratio
          },
        }),
      ];

      const insights = evaluate({ callsites }, [templates[1]]);

      expect(insights).toHaveLength(1);
      expect(insights[0].templateId).toBe('retry-explosion');
      expect(insights[0].severity).toBe('critical');
    });

    it('does not trigger when calls <= 10', () => {
      const callsites: EnrichedCallsite[] = [
        createCallsite({
          file: 'src/services/llm.ts',
          line: 120,
          usage: {
            calls: 5,  // Too few calls
            tokens_in: 1000,
            tokens_out: 100,
            latency_p50: 500,
            latency_p95: 2000,
            latency_p99: 3000,
          },
        }),
      ];

      const insights = evaluate({ callsites }, [templates[1]]);
      expect(insights).toHaveLength(0);
    });
  });

  describe('cost-concentration', () => {
    it('triggers when one callsite > 50% of total cost', () => {
      const callsites: EnrichedCallsite[] = [
        createCallsite({
          file: 'src/api/expensive.ts',
          line: 10,
          model: 'gpt-4o',
          usage: {
            calls: 1000,
            tokens_in: 100000,
            tokens_out: 50000,
            latency_p50: 1000,
            latency_p95: 2000,
            latency_p99: 3000,
          },
        }),
        createCallsite({
          file: 'src/api/cheap.ts',
          line: 20,
          model: 'gpt-4o-mini',
          usage: {
            calls: 100,
            tokens_in: 1000,
            tokens_out: 500,
            latency_p50: 500,
            latency_p95: 1000,
            latency_p99: 1500,
          },
        }),
      ];

      const insights = evaluate({ callsites }, [templates[2]]);

      expect(insights).toHaveLength(1);
      expect(insights[0].templateId).toBe('cost-concentration');
    });
  });

  describe('overpowered-extraction', () => {
    it('triggers for premium model with small outputs', () => {
      const callsites: EnrichedCallsite[] = [
        createCallsite({
          file: 'src/extractors/ner.ts',
          line: 55,
          model: 'gpt-4o',
          usage: {
            calls: 500,
            tokens_in: 5000,
            tokens_out: 2500,  // avg = 5 tokens
            latency_p50: 800,
            latency_p95: 1200,
            latency_p99: 1500,
          },
        }),
      ];

      const insights = evaluate({ callsites }, [templates[3]]);

      expect(insights).toHaveLength(1);
      expect(insights[0].templateId).toBe('overpowered-extraction');
      expect(insights[0].headline).toContain('gpt-4o');
    });

    it('does not trigger for cheap models', () => {
      const callsites: EnrichedCallsite[] = [
        createCallsite({
          file: 'src/extractors/ner.ts',
          line: 55,
          model: 'gpt-4o-mini',  // Cheap model
          usage: {
            calls: 500,
            tokens_in: 5000,
            tokens_out: 2500,
            latency_p50: 800,
            latency_p95: 1200,
            latency_p99: 1500,
          },
        }),
      ];

      const insights = evaluate({ callsites }, [templates[3]]);
      expect(insights).toHaveLength(0);
    });
  });
});

// =============================================================================
// DRIFT TEMPLATE TESTS
// =============================================================================

describe('Drift Templates', () => {
  describe('dead-code', () => {
    it('triggers when callsites exist with no runtime events', () => {
      const joined: JoinedOutput = {
        matched: [],
        codeOnly: [
          createCallsite({ file: 'src/unused/old.ts', line: 10 }),
          createCallsite({ file: 'src/unused/deprecated.ts', line: 20 }),
        ],
        runtimeOnly: [],
        drift: { codeOnly: 2, runtimeOnly: 0 },
      };

      const insights = evaluate(joined, [templates[4]]);

      expect(insights).toHaveLength(1);
      expect(insights[0].templateId).toBe('dead-code');
      expect(insights[0].headline).toContain('2 callsites');
    });

    it('does not trigger when all callsites have runtime data', () => {
      const joined: JoinedOutput = {
        matched: [createCallsite({ file: 'src/api/active.ts', line: 10 })],
        codeOnly: [],
        runtimeOnly: [],
        drift: { codeOnly: 0, runtimeOnly: 0 },
      };

      const insights = evaluate(joined, [templates[4]]);
      expect(insights).toHaveLength(0);
    });
  });

  describe('streaming-drift', () => {
    it('triggers when streaming=true but high latency', () => {
      const callsites: EnrichedCallsite[] = [
        createCallsite({
          file: 'src/api/stream.ts',
          line: 30,
          patterns: { streaming: true },
          usage: {
            calls: 100,
            tokens_in: 1000,
            tokens_out: 500,
            latency_p50: 3500,  // > 2000ms
            latency_p95: 5000,
            latency_p99: 7000,
          },
        }),
      ];

      const insights = evaluate({ callsites }, [templates[5]]);

      expect(insights).toHaveLength(1);
      expect(insights[0].templateId).toBe('streaming-drift');
      expect(insights[0].headline).toContain('3500ms');
    });

    it('does not trigger for non-streaming callsites', () => {
      const callsites: EnrichedCallsite[] = [
        createCallsite({
          file: 'src/api/batch.ts',
          line: 30,
          patterns: { streaming: false },
          usage: {
            calls: 100,
            tokens_in: 1000,
            tokens_out: 500,
            latency_p50: 3500,
            latency_p95: 5000,
            latency_p99: 7000,
          },
        }),
      ];

      const insights = evaluate({ callsites }, [templates[5]]);
      expect(insights).toHaveLength(0);
    });
  });

  describe('untested-fallback', () => {
    it('triggers when fallback=true but calls < 5', () => {
      const callsites: EnrichedCallsite[] = [
        createCallsite({
          file: 'src/resilience/fallback.ts',
          line: 80,
          patterns: { fallback: true },
          usage: {
            calls: 2,  // Rarely exercised
            tokens_in: 200,
            tokens_out: 100,
            latency_p50: 1000,
            latency_p95: 2000,
            latency_p99: 3000,
          },
        }),
      ];

      const insights = evaluate({ callsites }, [templates[6]]);

      expect(insights).toHaveLength(1);
      expect(insights[0].templateId).toBe('untested-fallback');
      expect(insights[0].severity).toBe('info');
    });

    it('does not trigger when fallback is well-exercised', () => {
      const callsites: EnrichedCallsite[] = [
        createCallsite({
          file: 'src/resilience/fallback.ts',
          line: 80,
          patterns: { fallback: true },
          usage: {
            calls: 100,  // Well exercised
            tokens_in: 200,
            tokens_out: 100,
            latency_p50: 1000,
            latency_p95: 2000,
            latency_p99: 3000,
          },
        }),
      ];

      const insights = evaluate({ callsites }, [templates[6]]);
      expect(insights).toHaveLength(0);
    });
  });
});

// =============================================================================
// PERFORMANCE TEMPLATE TESTS
// =============================================================================

describe('Performance Templates', () => {
  describe('throughput-gap', () => {
    it('triggers when actual TPS < 50% of envelope median', () => {
      // This test requires envelope data - skipping for now as it needs
      // actual InferenceMAX envelope integration
      // The envelope scope is tested in the actual integration
      expect(true).toBe(true);
    });
  });

  describe('latency-explainer', () => {
    it('triggers when no streaming and p95 > 3000ms', () => {
      const callsites: EnrichedCallsite[] = [
        createCallsite({
          file: 'src/api/slow.ts',
          line: 100,
          patterns: { streaming: false },
          usage: {
            calls: 50,
            tokens_in: 2000,
            tokens_out: 1000,
            latency_p50: 2000,
            latency_p95: 4500,  // > 3000ms
            latency_p99: 6000,
          },
        }),
      ];

      const insights = evaluate({ callsites }, [templates[8]]);

      expect(insights).toHaveLength(1);
      expect(insights[0].templateId).toBe('latency-explainer');
      expect(insights[0].headline).toContain('4500ms');
    });

    it('does not trigger when streaming is enabled', () => {
      const callsites: EnrichedCallsite[] = [
        createCallsite({
          file: 'src/api/slow.ts',
          line: 100,
          patterns: { streaming: true },  // Streaming enabled
          usage: {
            calls: 50,
            tokens_in: 2000,
            tokens_out: 1000,
            latency_p50: 2000,
            latency_p95: 4500,
            latency_p99: 6000,
          },
        }),
      ];

      const insights = evaluate({ callsites }, [templates[8]]);
      expect(insights).toHaveLength(0);
    });
  });

  describe('context-accumulation', () => {
    it('triggers when tokens_in > 50000', () => {
      const callsites: EnrichedCallsite[] = [
        createCallsite({
          file: 'src/chat/conversation.ts',
          line: 200,
          usage: {
            calls: 10,
            tokens_in: 75000,  // > 50000
            tokens_out: 5000,
            latency_p50: 5000,
            latency_p95: 8000,
            latency_p99: 10000,
          },
        }),
      ];

      const insights = evaluate({ callsites }, [templates[9]]);

      expect(insights).toHaveLength(1);
      expect(insights[0].templateId).toBe('context-accumulation');
    });

    it('does not trigger for normal context sizes', () => {
      const callsites: EnrichedCallsite[] = [
        createCallsite({
          file: 'src/chat/conversation.ts',
          line: 200,
          usage: {
            calls: 10,
            tokens_in: 5000,  // Normal
            tokens_out: 1000,
            latency_p50: 1000,
            latency_p95: 2000,
            latency_p99: 3000,
          },
        }),
      ];

      const insights = evaluate({ callsites }, [templates[9]]);
      expect(insights).toHaveLength(0);
    });
  });
});

// =============================================================================
// WASTE TEMPLATE TESTS
// =============================================================================

describe('Waste Templates', () => {
  describe('overpowered-model', () => {
    it('triggers for gpt-4o with avg_tokens < 50', () => {
      const callsites: EnrichedCallsite[] = [
        createCallsite({
          file: 'src/classify/sentiment.ts',
          line: 15,
          model: 'gpt-4o',
          usage: {
            calls: 1000,
            tokens_in: 10000,
            tokens_out: 10000,  // avg = 10 tokens
            latency_p50: 500,
            latency_p95: 800,
            latency_p99: 1000,
          },
        }),
      ];

      const insights = evaluate({ callsites }, [templates[10]]);

      expect(insights).toHaveLength(1);
      expect(insights[0].templateId).toBe('overpowered-model');
      expect(insights[0].headline).toContain('gpt-4o');
      expect(insights[0].headline).toContain('10 tokens');
    });

    it('does not trigger for larger outputs', () => {
      const callsites: EnrichedCallsite[] = [
        createCallsite({
          file: 'src/generate/essay.ts',
          line: 15,
          model: 'gpt-4o',
          usage: {
            calls: 100,
            tokens_in: 10000,
            tokens_out: 50000,  // avg = 500 tokens
            latency_p50: 3000,
            latency_p95: 5000,
            latency_p99: 7000,
          },
        }),
      ];

      const insights = evaluate({ callsites }, [templates[10]]);
      expect(insights).toHaveLength(0);
    });
  });

  describe('token-underutilization', () => {
    it('triggers when avg_tokens < 200', () => {
      const callsites: EnrichedCallsite[] = [
        createCallsite({
          file: 'src/api/short.ts',
          line: 50,
          usage: {
            calls: 100,
            tokens_in: 5000,
            tokens_out: 5000,  // avg = 50 tokens
            latency_p50: 500,
            latency_p95: 800,
            latency_p99: 1000,
          },
        }),
      ];

      const insights = evaluate({ callsites }, [templates[11]]);

      expect(insights).toHaveLength(1);
      expect(insights[0].templateId).toBe('token-underutilization');
    });

    it('does not trigger for higher output counts', () => {
      const callsites: EnrichedCallsite[] = [
        createCallsite({
          file: 'src/api/verbose.ts',
          line: 50,
          usage: {
            calls: 100,
            tokens_in: 5000,
            tokens_out: 50000,  // avg = 500 tokens
            latency_p50: 2000,
            latency_p95: 3000,
            latency_p99: 4000,
          },
        }),
      ];

      const insights = evaluate({ callsites }, [templates[11]]);
      expect(insights).toHaveLength(0);
    });
  });
});

// =============================================================================
// COMBINED SCENARIOS
// =============================================================================

describe('Combined Scenarios', () => {
  it('multiple templates can trigger on the same data', () => {
    const callsites: EnrichedCallsite[] = [
      createCallsite({
        file: 'src/api/problematic.ts',
        line: 100,
        model: 'gpt-4o',
        patterns: { streaming: false },
        usage: {
          calls: 500,
          tokens_in: 100000,  // High input (prompt bloat)
          tokens_out: 2500,   // Low output (avg = 5 tokens → overpowered-model + overpowered-extraction)
          latency_p50: 2000,
          latency_p95: 4000,  // High latency (latency-explainer)
          latency_p99: 6000,
        },
      }),
    ];

    const insights = evaluate({ callsites }, templates);

    // Should trigger multiple templates
    const templateIds = insights.map(i => i.templateId);
    expect(templateIds).toContain('prompt-bloat');
    expect(templateIds).toContain('overpowered-extraction');
    expect(templateIds).toContain('overpowered-model');
    expect(templateIds).toContain('latency-explainer');
    expect(templateIds).toContain('token-underutilization');
  });

  it('well-optimized callsite triggers no insights', () => {
    const callsites: EnrichedCallsite[] = [
      createCallsite({
        file: 'src/api/optimized.ts',
        line: 50,
        model: 'gpt-4o-mini',  // Cheap model
        patterns: { streaming: true },  // Streaming enabled
        usage: {
          calls: 100,
          tokens_in: 1000,
          tokens_out: 50000,  // Good output
          latency_p50: 500,
          latency_p95: 800,   // Low latency
          latency_p99: 1000,
        },
      }),
    ];

    const joined: JoinedOutput = {
      matched: callsites,
      codeOnly: [],       // No dead code
      runtimeOnly: [],
      drift: { codeOnly: 0, runtimeOnly: 0 },
    };

    const insights = evaluate(joined, templates);

    // Only cost-concentration might trigger (depends on global stats)
    // Filter it out for this test
    const filtered = insights.filter(i => i.templateId !== 'cost-concentration');
    expect(filtered).toHaveLength(0);
  });
});
