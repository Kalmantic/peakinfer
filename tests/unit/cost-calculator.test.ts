/**
 * Cost Calculator Tests
 * Per Test Cases v1.9.3 - Core Analysis Tests
 */
import { describe, test, expect } from 'vitest';

// Types for cost calculation
interface ModelPricing {
  provider: string;
  model: string;
  inputPer1M: number;  // Cost per 1M input tokens
  outputPer1M: number; // Cost per 1M output tokens
  cachedInputPer1M?: number; // Cost for cached input tokens
}

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
}

interface CostEstimate {
  inputCost: number;
  outputCost: number;
  cachedCost: number;
  totalCost: number;
}

// Model pricing database (subset from LiteLLM pricing)
const MODEL_PRICING: ModelPricing[] = [
  // Anthropic
  { provider: 'anthropic', model: 'claude-opus-4-20250514', inputPer1M: 15, outputPer1M: 75, cachedInputPer1M: 1.5 },
  { provider: 'anthropic', model: 'claude-sonnet-4-20250514', inputPer1M: 3, outputPer1M: 15, cachedInputPer1M: 0.3 },
  { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', inputPer1M: 3, outputPer1M: 15, cachedInputPer1M: 0.3 },
  { provider: 'anthropic', model: 'claude-haiku-3-20240307', inputPer1M: 0.25, outputPer1M: 1.25, cachedInputPer1M: 0.03 },
  // OpenAI
  { provider: 'openai', model: 'gpt-4o', inputPer1M: 2.5, outputPer1M: 10, cachedInputPer1M: 1.25 },
  { provider: 'openai', model: 'gpt-4o-mini', inputPer1M: 0.15, outputPer1M: 0.6, cachedInputPer1M: 0.075 },
  { provider: 'openai', model: 'gpt-4-turbo', inputPer1M: 10, outputPer1M: 30 },
  { provider: 'openai', model: 'o1', inputPer1M: 15, outputPer1M: 60, cachedInputPer1M: 7.5 },
  { provider: 'openai', model: 'o1-mini', inputPer1M: 1.1, outputPer1M: 4.4, cachedInputPer1M: 0.55 },
  // Embeddings
  { provider: 'openai', model: 'text-embedding-3-small', inputPer1M: 0.02, outputPer1M: 0 },
  { provider: 'openai', model: 'text-embedding-3-large', inputPer1M: 0.13, outputPer1M: 0 },
];

// Cost calculation functions
function getPricing(provider: string, model: string): ModelPricing | null {
  // Try exact match first
  let pricing = MODEL_PRICING.find(p => p.provider === provider && p.model === model);
  if (pricing) return pricing;

  // Try partial match (model name contains)
  pricing = MODEL_PRICING.find(p => p.provider === provider && model.includes(p.model));
  if (pricing) return pricing;

  // Try partial match (pricing model contains model name)
  pricing = MODEL_PRICING.find(p => p.provider === provider && p.model.includes(model));
  return pricing || null;
}

function calculateCost(pricing: ModelPricing, usage: TokenUsage): CostEstimate {
  const inputCost = (usage.inputTokens / 1_000_000) * pricing.inputPer1M;
  const outputCost = (usage.outputTokens / 1_000_000) * pricing.outputPer1M;
  const cachedCost = usage.cachedTokens && pricing.cachedInputPer1M
    ? (usage.cachedTokens / 1_000_000) * pricing.cachedInputPer1M
    : 0;

  return {
    inputCost,
    outputCost,
    cachedCost,
    totalCost: inputCost + outputCost + cachedCost,
  };
}

function estimateMonthlyCost(
  pricing: ModelPricing,
  usage: TokenUsage,
  requestsPerDay: number
): number {
  const perRequest = calculateCost(pricing, usage).totalCost;
  return perRequest * requestsPerDay * 30;
}

function compareCosts(
  usage: TokenUsage,
  model1: { provider: string; model: string },
  model2: { provider: string; model: string }
): { savings: number; percentSaved: number } | null {
  const pricing1 = getPricing(model1.provider, model1.model);
  const pricing2 = getPricing(model2.provider, model2.model);

  if (!pricing1 || !pricing2) return null;

  const cost1 = calculateCost(pricing1, usage).totalCost;
  const cost2 = calculateCost(pricing2, usage).totalCost;

  const savings = cost1 - cost2;
  const percentSaved = cost1 > 0 ? (savings / cost1) * 100 : 0;

  return { savings, percentSaved };
}

describe('Model Pricing Lookup', () => {
  test('Finds exact model match', () => {
    const pricing = getPricing('anthropic', 'claude-sonnet-4-20250514');
    expect(pricing).not.toBeNull();
    expect(pricing?.inputPer1M).toBe(3);
    expect(pricing?.outputPer1M).toBe(15);
  });

  test('Returns null for unknown model', () => {
    const pricing = getPricing('anthropic', 'unknown-model');
    expect(pricing).toBeNull();
  });

  test('Returns null for unknown provider', () => {
    const pricing = getPricing('unknown-provider', 'gpt-4');
    expect(pricing).toBeNull();
  });

  test('Finds OpenAI models', () => {
    const pricing = getPricing('openai', 'gpt-4o');
    expect(pricing).not.toBeNull();
    expect(pricing?.inputPer1M).toBe(2.5);
  });

  test('Finds embedding models', () => {
    const pricing = getPricing('openai', 'text-embedding-3-small');
    expect(pricing).not.toBeNull();
    expect(pricing?.outputPer1M).toBe(0); // Embeddings have no output cost
  });
});

describe('Cost Calculation', () => {
  test('Calculates cost for typical usage', () => {
    const pricing = getPricing('anthropic', 'claude-sonnet-4-20250514')!;
    const usage: TokenUsage = {
      inputTokens: 1000,
      outputTokens: 500,
    };

    const cost = calculateCost(pricing, usage);

    // 1000 input tokens at $3/1M = $0.003
    expect(cost.inputCost).toBeCloseTo(0.003, 6);
    // 500 output tokens at $15/1M = $0.0075
    expect(cost.outputCost).toBeCloseTo(0.0075, 6);
    expect(cost.totalCost).toBeCloseTo(0.0105, 6);
  });

  test('Calculates cost with cached tokens', () => {
    const pricing = getPricing('anthropic', 'claude-sonnet-4-20250514')!;
    const usage: TokenUsage = {
      inputTokens: 500,
      outputTokens: 500,
      cachedTokens: 500,
    };

    const cost = calculateCost(pricing, usage);

    // 500 input tokens at $3/1M = $0.0015
    expect(cost.inputCost).toBeCloseTo(0.0015, 6);
    // 500 cached tokens at $0.30/1M = $0.00015
    expect(cost.cachedCost).toBeCloseTo(0.00015, 6);
    expect(cost.totalCost).toBeCloseTo(0.0015 + 0.0075 + 0.00015, 6);
  });

  test('Handles zero tokens', () => {
    const pricing = getPricing('anthropic', 'claude-sonnet-4-20250514')!;
    const usage: TokenUsage = {
      inputTokens: 0,
      outputTokens: 0,
    };

    const cost = calculateCost(pricing, usage);

    expect(cost.totalCost).toBe(0);
  });

  test('Handles large token counts', () => {
    const pricing = getPricing('openai', 'gpt-4o')!;
    const usage: TokenUsage = {
      inputTokens: 1_000_000,
      outputTokens: 500_000,
    };

    const cost = calculateCost(pricing, usage);

    // 1M input at $2.5/1M = $2.5
    expect(cost.inputCost).toBeCloseTo(2.5, 2);
    // 500K output at $10/1M = $5
    expect(cost.outputCost).toBeCloseTo(5, 2);
    expect(cost.totalCost).toBeCloseTo(7.5, 2);
  });
});

describe('Monthly Cost Estimation', () => {
  test('Estimates monthly cost correctly', () => {
    const pricing = getPricing('anthropic', 'claude-sonnet-4-20250514')!;
    const usage: TokenUsage = {
      inputTokens: 2000,
      outputTokens: 1000,
    };

    const monthlyCost = estimateMonthlyCost(pricing, usage, 100); // 100 requests/day

    // Per request: (2000 * 3 + 1000 * 15) / 1M = 0.021
    // Monthly: 0.021 * 100 * 30 = 63
    expect(monthlyCost).toBeCloseTo(63, 0);
  });

  test('Handles zero requests', () => {
    const pricing = getPricing('anthropic', 'claude-sonnet-4-20250514')!;
    const usage: TokenUsage = { inputTokens: 1000, outputTokens: 1000 };

    const monthlyCost = estimateMonthlyCost(pricing, usage, 0);

    expect(monthlyCost).toBe(0);
  });
});

describe('Cost Comparison', () => {
  test('Compares costs between models', () => {
    const usage: TokenUsage = {
      inputTokens: 10000,
      outputTokens: 5000,
    };

    const comparison = compareCosts(
      usage,
      { provider: 'anthropic', model: 'claude-opus-4-20250514' },
      { provider: 'anthropic', model: 'claude-sonnet-4-20250514' }
    );

    expect(comparison).not.toBeNull();
    expect(comparison!.savings).toBeGreaterThan(0); // Opus is more expensive
    expect(comparison!.percentSaved).toBeGreaterThan(0);
  });

  test('Shows negative savings when upgrading to expensive model', () => {
    const usage: TokenUsage = {
      inputTokens: 10000,
      outputTokens: 5000,
    };

    const comparison = compareCosts(
      usage,
      { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
      { provider: 'anthropic', model: 'claude-opus-4-20250514' }
    );

    expect(comparison).not.toBeNull();
    expect(comparison!.savings).toBeLessThan(0); // Sonnet is cheaper
  });

  test('Returns null for unknown models', () => {
    const usage: TokenUsage = { inputTokens: 1000, outputTokens: 1000 };

    const comparison = compareCosts(
      usage,
      { provider: 'anthropic', model: 'unknown' },
      { provider: 'anthropic', model: 'claude-sonnet-4-20250514' }
    );

    expect(comparison).toBeNull();
  });

  test('Calculates significant savings for haiku vs opus', () => {
    const usage: TokenUsage = {
      inputTokens: 100000,
      outputTokens: 50000,
    };

    const comparison = compareCosts(
      usage,
      { provider: 'anthropic', model: 'claude-opus-4-20250514' },
      { provider: 'anthropic', model: 'claude-haiku-3-20240307' }
    );

    expect(comparison).not.toBeNull();
    // Haiku should be ~60x cheaper for input, ~60x cheaper for output
    expect(comparison!.percentSaved).toBeGreaterThan(90);
  });
});

describe('Embedding Costs', () => {
  test('Calculates embedding costs (output is zero)', () => {
    const pricing = getPricing('openai', 'text-embedding-3-small')!;
    const usage: TokenUsage = {
      inputTokens: 8000, // Typical embedding request
      outputTokens: 0,
    };

    const cost = calculateCost(pricing, usage);

    // 8000 tokens at $0.02/1M = $0.00016
    expect(cost.inputCost).toBeCloseTo(0.00016, 6);
    expect(cost.outputCost).toBe(0);
    expect(cost.totalCost).toBeCloseTo(0.00016, 6);
  });
});
