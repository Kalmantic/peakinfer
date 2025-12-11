/**
 * Performance Benchmark Module — Real-time Performance Analysis
 *
 * Responsibility (per Tech Design v1.1):
 * - Real-time performance data from LiteLLM (1000+ models)
 * - Fallback to static benchmarks when offline
 * - Throughput/latency estimation per callsite
 * - Provider/model aggregation
 * - Hotspot identification
 *
 * Design: Async initialization, pure calculation functions.
 */

import type { ClassifiedCallsite, ModelPricing, CallsiteCost, PricingSummary } from './types.js';
import {
  initializePricing,
  getPricing,
  normalizeModelName,
  type NormalizedPricing,
} from './pricing-fetcher.js';

// =============================================================================
// STATIC BENCHMARK DATA (throughput/latency baselines, as of Jan 2025)
// =============================================================================

/** Static benchmark data as fallback when LiteLLM fetch fails */
export const STATIC_PRICING_DATA: Record<string, Record<string, { inputPer1M: number; outputPer1M: number }>> = {
  openai: {
    'gpt-4o': { inputPer1M: 2.50, outputPer1M: 10.00 },
    'gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.60 },
    'gpt-4-turbo': { inputPer1M: 10.00, outputPer1M: 30.00 },
    'gpt-3.5-turbo': { inputPer1M: 0.50, outputPer1M: 1.50 },
    'o1': { inputPer1M: 15.00, outputPer1M: 60.00 },
    'o1-mini': { inputPer1M: 3.00, outputPer1M: 12.00 },
    'o3-mini': { inputPer1M: 1.10, outputPer1M: 4.40 },
  },
  anthropic: {
    'claude-3-5-sonnet': { inputPer1M: 3.00, outputPer1M: 15.00 },
    'claude-3-5-haiku': { inputPer1M: 0.80, outputPer1M: 4.00 },
    'claude-3-opus': { inputPer1M: 15.00, outputPer1M: 75.00 },
    'claude-3-sonnet': { inputPer1M: 3.00, outputPer1M: 15.00 },
    'claude-3-haiku': { inputPer1M: 0.25, outputPer1M: 1.25 },
    'claude-sonnet-4': { inputPer1M: 3.00, outputPer1M: 15.00 },
    'claude-opus-4': { inputPer1M: 15.00, outputPer1M: 75.00 },
  },
  google: {
    'gemini-1.5-pro': { inputPer1M: 1.25, outputPer1M: 5.00 },
    'gemini-1.5-flash': { inputPer1M: 0.075, outputPer1M: 0.30 },
    'gemini-2.0-flash': { inputPer1M: 0.10, outputPer1M: 0.40 },
    'gemini-2.5-pro': { inputPer1M: 1.25, outputPer1M: 10.00 },
  },
  cohere: {
    'command-r-plus': { inputPer1M: 2.50, outputPer1M: 10.00 },
    'command-r': { inputPer1M: 0.15, outputPer1M: 0.60 },
  },
  mistral: {
    'mistral-large': { inputPer1M: 2.00, outputPer1M: 6.00 },
    'mistral-small': { inputPer1M: 0.20, outputPer1M: 0.60 },
    'mixtral-8x22b': { inputPer1M: 0.90, outputPer1M: 0.90 },
  },
  groq: {
    'llama-3.1-70b': { inputPer1M: 0.59, outputPer1M: 0.79 },
    'llama-3.1-8b': { inputPer1M: 0.05, outputPer1M: 0.08 },
    'mixtral-8x7b': { inputPer1M: 0.24, outputPer1M: 0.24 },
  },
  together: {
    'llama-3.1-405b': { inputPer1M: 3.50, outputPer1M: 3.50 },
    'llama-3.1-70b': { inputPer1M: 0.88, outputPer1M: 0.88 },
    'mixtral-8x22b': { inputPer1M: 0.90, outputPer1M: 0.90 },
  },
};

/** Keep PRICING_DATA as alias for backwards compatibility */
export const PRICING_DATA = STATIC_PRICING_DATA;

// =============================================================================
// PRICING STATE
// =============================================================================

/** Whether real-time pricing has been initialized */
let pricingInitialized = false;

/** Whether we're using real-time or static pricing */
let usingRealTimePricing = false;

// =============================================================================
// DEFAULT USAGE ESTIMATES (per callsite/month)
// =============================================================================

/** Default token estimates for throughput range calculation */
const DEFAULT_USAGE = {
  // Conservative (low estimate)
  low: { inputTokens: 1000, outputTokens: 500, callsPerMonth: 100 },
  // Aggressive (high estimate)
  high: { inputTokens: 5000, outputTokens: 2000, callsPerMonth: 1000 },
};

// =============================================================================
// OPTIMIZATION SUGGESTIONS (per model)
// =============================================================================

/** Suggestions for performance optimization by model */
const MODEL_SUGGESTIONS: Record<string, string> = {
  // OpenAI premium → faster alternatives (Cross-provider)
  'gpt-4o': 'consider gpt-4o-mini (4x faster throughput) or Llama-3-70b via Groq for high speed',
  'gpt-4-turbo': 'migrate to gpt-4o or Claude 3.5 Sonnet for better throughput',
  'o1': 'reserve for complex reasoning; use gpt-4o or Claude 3.5 Sonnet for general tasks',
  'o1-mini': 'consider gpt-4o-mini or Gemini Flash for non-reasoning tasks',

  // Anthropic premium
  'claude-3-opus': 'consider claude-3-5-sonnet for 3x throughput with similar quality',
  'claude-3-5-sonnet': 'consider claude-3-5-haiku or Llama-3-70b for simpler tasks',
  'claude-3-sonnet': 'upgrade to claude-3-5-sonnet for better quality and throughput',

  // Google
  'gemini-1.5-pro': 'consider gemini-1.5-flash (5x throughput) or Llama-3-8b for extreme efficiency',

  // Cohere
  'command-r-plus': 'consider command-r or Llama-3-70b for simpler tasks',
};

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Initialize pricing engine.
 * Fetches real-time pricing from LiteLLM, falls back to static data.
 * Call this once before using calculatePricing.
 */
export async function initPricingEngine(): Promise<{ source: 'realtime' | 'static'; modelCount: number }> {
  if (pricingInitialized) {
    return {
      source: usingRealTimePricing ? 'realtime' : 'static',
      modelCount: usingRealTimePricing ? 1000 : Object.values(STATIC_PRICING_DATA).reduce((n, p) => n + Object.keys(p).length, 0),
    };
  }

  try {
    usingRealTimePricing = await initializePricing();
    pricingInitialized = true;

    if (usingRealTimePricing) {
      return { source: 'realtime', modelCount: 1000 }; // LiteLLM has ~1000 models
    }
  } catch {
    // Fall through to static
  }

  pricingInitialized = true;
  usingRealTimePricing = false;
  return {
    source: 'static',
    modelCount: Object.values(STATIC_PRICING_DATA).reduce((n, p) => n + Object.keys(p).length, 0),
  };
}

/**
 * Get pricing for a specific model.
 * Tries real-time pricing first, falls back to static.
 *
 * @param provider - Provider name (lowercase)
 * @param model - Model name
 * @returns ModelPricing or null if not found
 */
export function getModelPrice(
  provider: string | null,
  model: string | null
): ModelPricing | null {
  if (!model) return null;

  // Try real-time pricing first
  if (usingRealTimePricing) {
    const realtimePricing = getPricing(model);
    if (realtimePricing) {
      return {
        provider: realtimePricing.provider,
        model: realtimePricing.model,
        inputPer1M: realtimePricing.inputPer1M,
        outputPer1M: realtimePricing.outputPer1M,
      };
    }
  }

  // Fall back to static pricing
  return getStaticModelPrice(provider, model);
}

/**
 * Get pricing from static data only.
 */
function getStaticModelPrice(
  provider: string | null,
  model: string | null
): ModelPricing | null {
  if (!model || !provider) return null;

  // Normalize model name for matching
  const normalizedModel = normalizeModelName(model);

  // Try exact provider match
  const providerData = STATIC_PRICING_DATA[provider];
  if (!providerData) return null;

  // Try exact model match
  if (providerData[model]) {
    return {
      provider,
      model,
      inputPer1M: providerData[model].inputPer1M,
      outputPer1M: providerData[model].outputPer1M,
    };
  }

  // Try normalized match
  if (providerData[normalizedModel]) {
    return {
      provider,
      model: normalizedModel,
      inputPer1M: providerData[normalizedModel].inputPer1M,
      outputPer1M: providerData[normalizedModel].outputPer1M,
    };
  }

  return null;
}

/**
 * Calculate pricing summary from classified callsites.
 *
 * @param callsites - Array of classified callsites
 * @returns Complete pricing summary
 */
export function calculatePricing(callsites: ClassifiedCallsite[]): PricingSummary {
  if (callsites.length === 0) {
    return {
      estimatedRange: { low: 0, high: 0 },
      mostExpensiveModel: null,
      byProvider: [],
      byModel: [],
      hotspots: [],
    };
  }

  // Calculate performance per callsite (includes provider info)
  const performanceWithProvider = callsites.map((cs) => calculateCallsitePerformance(cs));

  // Aggregate totals
  const totalLow = performanceWithProvider.reduce((sum, c) => sum + c.estimatedMonthlyLow, 0);
  const totalHigh = performanceWithProvider.reduce((sum, c) => sum + c.estimatedMonthlyHigh, 0);

  // By provider (uses provider from benchmark lookup)
  const byProvider = aggregateByProvider(performanceWithProvider, totalHigh);

  // By model
  const byModel = aggregateByModel(performanceWithProvider);

  // Highest latency model (performance bottleneck)
  const mostExpensiveModel = byModel.length > 0 ? byModel[0].model : null;

  // Hotspots (sorted by throughput impact descending, strip provider for API compatibility)
  const sortedPerformance = [...performanceWithProvider].sort((a, b) => b.estimatedMonthlyHigh - a.estimatedMonthlyHigh);
  const hotspots: CallsiteCost[] = sortedPerformance.map(({ file, line, model, estimatedThroughputLow, estimatedThroughputHigh, estimatedMonthlyLow, estimatedMonthlyHigh, suggestion }) => ({
    file,
    line,
    model,
    estimatedThroughputLow,
    estimatedThroughputHigh,
    estimatedMonthlyLow,
    estimatedMonthlyHigh,
    suggestion,
  }));

  return {
    estimatedRange: { low: totalLow, high: totalHigh },
    mostExpensiveModel,
    byProvider,
    byModel,
    hotspots,
  };
}

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

/**
 * Calculate performance metrics for a single callsite.
 * Returns extended performance data with provider info for aggregation.
 */
function calculateCallsitePerformance(cs: ClassifiedCallsite): PerformanceWithProvider {
  const pricing = getModelPrice(cs.provider, cs.model);
  const model = cs.model || 'unknown';
  const normalizedModel = normalizeModelName(model);

  if (!pricing) {
    return {
      file: cs.file,
      line: cs.line,
      model,
      provider: cs.provider || 'unknown',
      estimatedThroughputLow: 0,
      estimatedThroughputHigh: 0,
      estimatedMonthlyLow: 0,
      estimatedMonthlyHigh: 0,
      suggestion: model !== 'unknown' ? 'benchmark data unavailable for this model' : undefined,
    };
  }

  const lowThroughput = calculateMonthlyThroughput(pricing, DEFAULT_USAGE.low);
  const highThroughput = calculateMonthlyThroughput(pricing, DEFAULT_USAGE.high);

  // Get optimization suggestion: prefer agent's dynamic analysis, fall back to static map
  // SLC: Mark as AI suggestion if from code analysis, or factual if from JSONL data
  // When hasUsageData is true (from events.jsonl), the suggestion is based on actual metrics
  const hasUsageData = cs.hasUsageData === true;
  const suggestion = cs.optimizationSuggestion
    ? (hasUsageData
        ? `[Based on usage data] ${cs.optimizationSuggestion}`
        : `[AI Suggestion - verify with your usage data] ${cs.optimizationSuggestion}`)
    : (MODEL_SUGGESTIONS[model] || MODEL_SUGGESTIONS[normalizedModel]);

  return {
    file: cs.file,
    line: cs.line,
    model,
    provider: pricing.provider,
    estimatedThroughputLow: lowThroughput,
    estimatedThroughputHigh: highThroughput,
    estimatedMonthlyLow: lowThroughput,
    estimatedMonthlyHigh: highThroughput,
    suggestion,
  };
}

/**
 * Calculate monthly throughput capacity for given usage.
 */
function calculateMonthlyThroughput(
  pricing: ModelPricing,
  usage: { inputTokens: number; outputTokens: number; callsPerMonth: number }
): number {
  const inputThroughput = (usage.inputTokens / 1_000_000) * pricing.inputPer1M * usage.callsPerMonth;
  const outputThroughput = (usage.outputTokens / 1_000_000) * pricing.outputPer1M * usage.callsPerMonth;
  return inputThroughput + outputThroughput;
}

/** Extended performance info with provider */
interface PerformanceWithProvider extends CallsiteCost {
  provider: string;
}

/**
 * Aggregate performance metrics by provider.
 * Uses provider from benchmark lookup for accuracy.
 */
function aggregateByProvider(
  metrics: PerformanceWithProvider[],
  total: number
): Array<{ provider: string; throughput: number; percentage: number }> {
  const providerMetrics = new Map<string, number>();

  for (const metric of metrics) {
    const provider = metric.provider || 'unknown';
    providerMetrics.set(provider, (providerMetrics.get(provider) || 0) + metric.estimatedMonthlyHigh);
  }

  const result: Array<{ provider: string; throughput: number; percentage: number }> = [];

  for (const [provider, value] of providerMetrics) {
    result.push({
      provider,
      throughput: value,
      percentage: total > 0 ? Math.round((value / total) * 100) : 0,
    });
  }

  return result.sort((a, b) => b.throughput - a.throughput);
}

/**
 * Aggregate performance metrics by model.
 */
function aggregateByModel(metrics: CallsiteCost[]): Array<{ model: string; throughput: number }> {
  const byModel = new Map<string, number>();

  for (const metric of metrics) {
    byModel.set(metric.model, (byModel.get(metric.model) || 0) + metric.estimatedMonthlyHigh);
  }

  return Array.from(byModel.entries())
    .map(([model, value]) => ({ model, throughput: value }))
    .sort((a, b) => b.throughput - a.throughput);
}
