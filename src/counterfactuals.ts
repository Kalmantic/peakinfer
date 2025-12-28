/**
 * Counterfactual Insights Module (v1.5)
 *
 * Generates "what if" optimization scenarios for inference points based on:
 * - Model alternatives (cheaper/faster models)
 * - Pattern opportunities (batching, caching, streaming)
 * - Provider alternatives (cloud vs self-hosted)
 *
 * Shows the road not taken and its potential impact,
 * enabling informed optimization decisions.
 */

import type {
  Callsite,
  InferenceMap,
  Counterfactual,
  CounterfactualResult,
  CounterfactualSummary,
  CounterfactualType,
  CounterfactualState,
  CounterfactualImpact,
} from './types.js';

// =============================================================================
// CONSTANTS
// =============================================================================

// Model alternatives with their characteristics
const MODEL_ALTERNATIVES: Record<string, Array<{
  model: string;
  provider: string;
  latencyMultiplier: number;  // Relative to original (< 1 = faster)
  costMultiplier: number;     // Relative to original (< 1 = cheaper)
  tradeoffs: string[];
}>> = {
  // GPT-4 alternatives
  'gpt-4': [
    { model: 'gpt-4o', provider: 'openai', latencyMultiplier: 0.5, costMultiplier: 0.5, tradeoffs: ['Similar capability, significantly faster'] },
    { model: 'gpt-4o-mini', provider: 'openai', latencyMultiplier: 0.25, costMultiplier: 0.1, tradeoffs: ['Good for simpler tasks', 'May reduce quality on complex reasoning'] },
    { model: 'claude-3-haiku', provider: 'anthropic', latencyMultiplier: 0.25, costMultiplier: 0.08, tradeoffs: ['Fast and cheap', 'Different provider', 'May need prompt adjustments'] },
  ],
  'gpt-4-turbo': [
    { model: 'gpt-4o', provider: 'openai', latencyMultiplier: 0.7, costMultiplier: 0.7, tradeoffs: ['Newer model, similar capability'] },
    { model: 'gpt-4o-mini', provider: 'openai', latencyMultiplier: 0.3, costMultiplier: 0.15, tradeoffs: ['Good for simpler tasks'] },
  ],
  // Claude alternatives
  'claude-3-opus': [
    { model: 'claude-3-sonnet', provider: 'anthropic', latencyMultiplier: 0.5, costMultiplier: 0.2, tradeoffs: ['Good balance of speed and capability'] },
    { model: 'claude-3-haiku', provider: 'anthropic', latencyMultiplier: 0.2, costMultiplier: 0.04, tradeoffs: ['Very fast', 'Best for simple tasks'] },
    { model: 'claude-3.5-sonnet', provider: 'anthropic', latencyMultiplier: 0.4, costMultiplier: 0.15, tradeoffs: ['Often matches Opus quality at lower cost'] },
  ],
  'claude-3-sonnet': [
    { model: 'claude-3-haiku', provider: 'anthropic', latencyMultiplier: 0.4, costMultiplier: 0.2, tradeoffs: ['Faster', 'May reduce quality'] },
    { model: 'claude-3.5-sonnet', provider: 'anthropic', latencyMultiplier: 0.8, costMultiplier: 1.0, tradeoffs: ['Improved capability at similar cost'] },
  ],
  // Gemini alternatives
  'gemini-1.5-pro': [
    { model: 'gemini-1.5-flash', provider: 'google', latencyMultiplier: 0.2, costMultiplier: 0.1, tradeoffs: ['Much faster', 'Good for most tasks'] },
  ],
};

// Base costs per 1K calls (rough estimates for counterfactual calculations)
const MODEL_COSTS: Record<string, number> = {
  'gpt-4': 0.90,
  'gpt-4-turbo': 0.30,
  'gpt-4o': 0.15,
  'gpt-4o-mini': 0.015,
  'gpt-3.5-turbo': 0.015,
  'claude-3-opus': 0.45,
  'claude-3-sonnet': 0.09,
  'claude-3-haiku': 0.0075,
  'claude-3.5-sonnet': 0.09,
  'gemini-1.5-pro': 0.105,
  'gemini-1.5-flash': 0.0105,
  'gemini-pro': 0.015,
};

// Base latencies (p95 in ms)
const MODEL_LATENCIES: Record<string, number> = {
  'gpt-4': 5000,
  'gpt-4-turbo': 4000,
  'gpt-4o': 2500,
  'gpt-4o-mini': 1500,
  'gpt-3.5-turbo': 1500,
  'claude-3-opus': 8000,
  'claude-3-sonnet': 4000,
  'claude-3-haiku': 1500,
  'claude-3.5-sonnet': 3500,
  'gemini-1.5-pro': 4000,
  'gemini-1.5-flash': 800,
  'gemini-pro': 3000,
};

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Get model cost estimate.
 */
function getModelCost(model: string | null): number {
  if (!model) return 0.10; // Default
  const normalized = model.toLowerCase();
  for (const [key, cost] of Object.entries(MODEL_COSTS)) {
    if (normalized.includes(key.toLowerCase())) {
      return cost;
    }
  }
  return 0.10; // Default
}

/**
 * Get model latency estimate (p95 in ms).
 */
function getModelLatency(model: string | null): number {
  if (!model) return 3000; // Default
  const normalized = model.toLowerCase();
  for (const [key, latency] of Object.entries(MODEL_LATENCIES)) {
    if (normalized.includes(key.toLowerCase())) {
      return latency;
    }
  }
  return 3000; // Default
}

/**
 * Find model alternatives for a given model.
 */
function findModelAlternatives(model: string | null): typeof MODEL_ALTERNATIVES[string] | null {
  if (!model) return null;
  const normalized = model.toLowerCase();
  for (const [key, alternatives] of Object.entries(MODEL_ALTERNATIVES)) {
    if (normalized.includes(key.toLowerCase())) {
      return alternatives;
    }
  }
  return null;
}

/**
 * Generate a unique counterfactual ID.
 */
function generateId(): string {
  return `cf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// =============================================================================
// COUNTERFACTUAL GENERATORS
// =============================================================================

/**
 * Generate model swap counterfactuals.
 */
function generateModelSwapCounterfactuals(callsites: Callsite[]): Counterfactual[] {
  const counterfactuals: Counterfactual[] = [];

  // Group callsites by model
  const byModel = new Map<string, Callsite[]>();
  for (const cs of callsites) {
    if (cs.model) {
      if (!byModel.has(cs.model)) {
        byModel.set(cs.model, []);
      }
      byModel.get(cs.model)!.push(cs);
    }
  }

  // Generate alternatives for each model
  for (const [model, sites] of byModel) {
    const alternatives = findModelAlternatives(model);
    if (!alternatives) continue;

    const currentLatency = getModelLatency(model);
    const currentCost = getModelCost(model);

    for (const alt of alternatives) {
      const proposedLatency = Math.round(currentLatency * alt.latencyMultiplier);
      const proposedCost = currentCost * alt.costMultiplier;

      const latencyDelta = proposedLatency - currentLatency;
      const costDelta = proposedCost - currentCost;

      // Only suggest if there's meaningful improvement
      if (latencyDelta >= 0 && costDelta >= 0) continue;

      counterfactuals.push({
        id: generateId(),
        type: 'model_swap',
        headline: `Switch from ${model} to ${alt.model}`,
        description: `Replace ${model} with ${alt.model} for ${sites.length} inference point${sites.length !== 1 ? 's' : ''}`,
        currentState: {
          model,
          provider: sites[0]?.provider || undefined,
          estimatedLatency: currentLatency,
          estimatedCost: currentCost,
        },
        proposedState: {
          model: alt.model,
          provider: alt.provider,
          estimatedLatency: proposedLatency,
          estimatedCost: proposedCost,
        },
        impact: {
          latencyDelta,
          latencyDeltaPercent: Math.round((latencyDelta / currentLatency) * 100),
          costDelta,
          costDeltaPercent: Math.round((costDelta / currentCost) * 100),
          tradeoffs: alt.tradeoffs,
        },
        confidence: 'medium',
        confidenceReason: 'Based on typical model performance characteristics',
        affectedPoints: sites.map(s => s.id),
        effort: 'low',
      });
    }
  }

  return counterfactuals;
}

/**
 * Generate batching optimization counterfactuals.
 */
function generateBatchingCounterfactuals(callsites: Callsite[]): Counterfactual[] {
  const counterfactuals: Counterfactual[] = [];

  // Find inference points without batching
  const unbatched = callsites.filter(cs => !cs.patterns?.batching);
  if (unbatched.length < 2) return counterfactuals; // Need multiple calls to batch

  // Group by model for batch suggestions
  const byModel = new Map<string, Callsite[]>();
  for (const cs of unbatched) {
    const key = cs.model || 'unknown';
    if (!byModel.has(key)) {
      byModel.set(key, []);
    }
    byModel.get(key)!.push(cs);
  }

  for (const [model, sites] of byModel) {
    if (sites.length < 2) continue; // Need multiple for batching

    const currentLatency = getModelLatency(model);
    const currentCost = getModelCost(model);

    // Batching typically reduces per-request latency by 20% and cost by 10%
    const proposedLatency = Math.round(currentLatency * 0.8);
    const proposedCost = currentCost * 0.9;

    counterfactuals.push({
      id: generateId(),
      type: 'batch_optimization',
      headline: `Enable batching for ${model}`,
      description: `Batch ${sites.length} ${model} calls together to reduce overhead`,
      currentState: {
        model,
        pattern: 'individual requests',
        estimatedLatency: currentLatency,
        estimatedCost: currentCost,
      },
      proposedState: {
        model,
        pattern: 'batched requests',
        estimatedLatency: proposedLatency,
        estimatedCost: proposedCost,
      },
      impact: {
        latencyDelta: proposedLatency - currentLatency,
        latencyDeltaPercent: -20,
        costDelta: proposedCost - currentCost,
        costDeltaPercent: -10,
        tradeoffs: [
          'Requires collecting requests before processing',
          'May increase individual request latency if batch window is long',
          'Need to handle partial batch failures',
        ],
      },
      confidence: 'medium',
      confidenceReason: 'Batching typically provides 10-30% improvements',
      affectedPoints: sites.map(s => s.id),
      effort: 'medium',
    });
  }

  return counterfactuals;
}

/**
 * Generate caching counterfactuals.
 */
function generateCachingCounterfactuals(callsites: Callsite[]): Counterfactual[] {
  const counterfactuals: Counterfactual[] = [];

  // Find inference points without caching
  const uncached = callsites.filter(cs => !cs.patterns?.caching);
  if (uncached.length === 0) return counterfactuals;

  // Calculate aggregate impact
  const totalLatency = uncached.reduce((sum, cs) => sum + getModelLatency(cs.model), 0);
  const avgLatency = Math.round(totalLatency / uncached.length);
  const totalCost = uncached.reduce((sum, cs) => sum + getModelCost(cs.model), 0);
  const avgCost = totalCost / uncached.length;

  // Caching with 50% hit rate reduces effective latency and cost by 50%
  const cacheHitRate = 0.5;
  const proposedLatency = Math.round(avgLatency * (1 - cacheHitRate));
  const proposedCost = avgCost * (1 - cacheHitRate);

  counterfactuals.push({
    id: generateId(),
    type: 'cache_addition',
    headline: 'Add semantic caching layer',
    description: `Add caching for ${uncached.length} inference point${uncached.length !== 1 ? 's' : ''} to avoid redundant LLM calls`,
    currentState: {
      pattern: 'no caching',
      estimatedLatency: avgLatency,
      estimatedCost: avgCost,
    },
    proposedState: {
      pattern: 'semantic cache',
      estimatedLatency: proposedLatency,
      estimatedCost: proposedCost,
    },
    impact: {
      latencyDelta: proposedLatency - avgLatency,
      latencyDeltaPercent: -50,
      costDelta: proposedCost - avgCost,
      costDeltaPercent: -50,
      tradeoffs: [
        'Assumes ~50% cache hit rate (varies by use case)',
        'Need to manage cache invalidation',
        'May return stale results for time-sensitive queries',
        'Requires similarity matching infrastructure',
      ],
    },
    confidence: 'low',
    confidenceReason: 'Cache hit rate varies significantly by use case',
    affectedPoints: uncached.map(cs => cs.id),
    effort: 'high',
  });

  return counterfactuals;
}

/**
 * Generate streaming counterfactuals.
 */
function generateStreamingCounterfactuals(callsites: Callsite[]): Counterfactual[] {
  const counterfactuals: Counterfactual[] = [];

  // Find inference points without streaming
  const nonStreaming = callsites.filter(cs => !cs.patterns?.streaming);
  if (nonStreaming.length === 0) return counterfactuals;

  const avgLatency = Math.round(
    nonStreaming.reduce((sum, cs) => sum + getModelLatency(cs.model), 0) / nonStreaming.length
  );

  // Streaming reduces time-to-first-token significantly (perceived latency)
  const proposedPerceivedLatency = Math.round(avgLatency * 0.2); // First token in 20% of total time

  counterfactuals.push({
    id: generateId(),
    type: 'streaming_enable',
    headline: 'Enable response streaming',
    description: `Enable streaming for ${nonStreaming.length} inference point${nonStreaming.length !== 1 ? 's' : ''} to reduce perceived latency`,
    currentState: {
      pattern: 'synchronous',
      estimatedLatency: avgLatency,
      estimatedCost: 0, // Streaming doesn't affect cost
    },
    proposedState: {
      pattern: 'streaming',
      estimatedLatency: proposedPerceivedLatency, // Time to first token
      estimatedCost: 0,
    },
    impact: {
      latencyDelta: proposedPerceivedLatency - avgLatency,
      latencyDeltaPercent: -80, // 80% reduction in perceived latency
      costDelta: 0,
      costDeltaPercent: 0,
      tradeoffs: [
        'Total response time unchanged, but first token arrives faster',
        'Requires UI changes to display incremental output',
        'May complicate error handling',
      ],
    },
    confidence: 'high',
    confidenceReason: 'Streaming consistently improves perceived latency',
    affectedPoints: nonStreaming.map(cs => cs.id),
    effort: 'low',
  });

  return counterfactuals;
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Generate counterfactual insights for inference points.
 */
export function generateCounterfactuals(inferenceMap: InferenceMap): CounterfactualResult {
  const callsites = inferenceMap.callsites;
  const counterfactuals: Counterfactual[] = [];

  // Generate all types of counterfactuals
  counterfactuals.push(...generateModelSwapCounterfactuals(callsites));
  counterfactuals.push(...generateBatchingCounterfactuals(callsites));
  counterfactuals.push(...generateCachingCounterfactuals(callsites));
  counterfactuals.push(...generateStreamingCounterfactuals(callsites));

  // Sort by impact (latency savings)
  counterfactuals.sort((a, b) => a.impact.latencyDeltaPercent - b.impact.latencyDeltaPercent);

  // Calculate summary
  const summary = calculateSummary(counterfactuals);

  return {
    counterfactuals,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Calculate counterfactual summary.
 */
function calculateSummary(counterfactuals: Counterfactual[]): CounterfactualSummary {
  if (counterfactuals.length === 0) {
    return {
      totalOpportunities: 0,
      maxLatencySavingsMs: 0,
      maxLatencySavingsPercent: 0,
      maxCostSavings: 0,
      maxCostSavingsPercent: 0,
      byType: {},
    };
  }

  // Find max savings
  const maxLatencySavingsMs = Math.abs(Math.min(...counterfactuals.map(c => c.impact.latencyDelta)));
  const maxLatencySavingsPercent = Math.abs(Math.min(...counterfactuals.map(c => c.impact.latencyDeltaPercent)));
  const maxCostSavings = Math.abs(Math.min(...counterfactuals.map(c => c.impact.costDelta)));
  const maxCostSavingsPercent = Math.abs(Math.min(...counterfactuals.map(c => c.impact.costDeltaPercent)));

  // Count by type
  const byType: Record<string, number> = {};
  for (const cf of counterfactuals) {
    byType[cf.type] = (byType[cf.type] || 0) + 1;
  }

  return {
    totalOpportunities: counterfactuals.length,
    maxLatencySavingsMs,
    maxLatencySavingsPercent,
    maxCostSavings,
    maxCostSavingsPercent,
    byType,
  };
}

/**
 * Format counterfactual summary for display.
 */
export function formatCounterfactualSummary(result: CounterfactualResult): string {
  const { summary } = result;
  const lines: string[] = [];

  lines.push(`${summary.totalOpportunities} optimization opportunities identified`);
  lines.push('');

  if (summary.maxLatencySavingsPercent > 0) {
    lines.push(`  Max latency savings: ${summary.maxLatencySavingsPercent}% (${summary.maxLatencySavingsMs}ms)`);
  }
  if (summary.maxCostSavingsPercent > 0) {
    lines.push(`  Max cost savings: ${summary.maxCostSavingsPercent}%`);
  }

  return lines.join('\n');
}

/**
 * Check if there are significant counterfactual opportunities.
 */
export function hasSignificantOpportunities(result: CounterfactualResult): boolean {
  return result.summary.totalOpportunities > 0 &&
         (result.summary.maxLatencySavingsPercent >= 20 || result.summary.maxCostSavingsPercent >= 20);
}

/**
 * Rank counterfactuals by a specific priority.
 */
export function rankCounterfactuals(
  result: CounterfactualResult,
  priority: 'latency' | 'cost' | 'balanced'
): Counterfactual[] {
  const counterfactuals = [...result.counterfactuals];

  switch (priority) {
    case 'latency':
      return counterfactuals.sort((a, b) => a.impact.latencyDeltaPercent - b.impact.latencyDeltaPercent);
    case 'cost':
      return counterfactuals.sort((a, b) => a.impact.costDeltaPercent - b.impact.costDeltaPercent);
    case 'balanced':
    default:
      // Score combines latency and cost savings (both negative = better)
      return counterfactuals.sort((a, b) => {
        const scoreA = a.impact.latencyDeltaPercent + a.impact.costDeltaPercent;
        const scoreB = b.impact.latencyDeltaPercent + b.impact.costDeltaPercent;
        return scoreA - scoreB;
      });
  }
}
