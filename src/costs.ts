import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// =============================================================================
// TYPES
// =============================================================================

interface ModelCost {
  input: number;  // per 1M tokens
  output: number; // per 1M tokens
}

interface PricingCache {
  data: Record<string, ModelCost>;
  fetchedAt: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const LITELLM_PRICING_URL = 'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';
const CACHE_DIR = '.peakinfer/cache';
const CACHE_FILE = 'pricing.json';

// =============================================================================
// STATE
// =============================================================================

let pricingCache: PricingCache | null = null;

// =============================================================================
// HELPERS
// =============================================================================

function getCachePath(): string {
  return join(process.cwd(), CACHE_DIR, CACHE_FILE);
}

function loadCacheFromDisk(): PricingCache | null {
  const cachePath = getCachePath();
  if (!existsSync(cachePath)) {
    return null;
  }
  try {
    const raw = readFileSync(cachePath, 'utf-8');
    return JSON.parse(raw) as PricingCache;
  } catch {
    return null;
  }
}

function saveCacheToDisk(cache: PricingCache): void {
  const cachePath = getCachePath();
  const cacheDir = join(process.cwd(), CACHE_DIR);
  if (!existsSync(cacheDir)) {
    mkdirSync(cacheDir, { recursive: true });
  }
  writeFileSync(cachePath, JSON.stringify(cache, null, 2));
}

function normalizePricing(litellmData: Record<string, unknown>): Record<string, ModelCost> {
  const result: Record<string, ModelCost> = {};

  for (const [model, info] of Object.entries(litellmData)) {
    if (typeof info !== 'object' || info === null) continue;

    const data = info as Record<string, unknown>;
    const inputCost = data.input_cost_per_token;
    const outputCost = data.output_cost_per_token;

    if (typeof inputCost === 'number' && typeof outputCost === 'number') {
      // Convert per-token to per-1M-tokens
      result[model] = {
        input: inputCost * 1_000_000,
        output: outputCost * 1_000_000,
      };
    }
  }

  return result;
}

// =============================================================================
// PUBLIC API
// =============================================================================

export function isCacheValid(): boolean {
  if (!pricingCache) return false;
  return Date.now() - pricingCache.fetchedAt < CACHE_TTL_MS;
}

export async function loadPricing(): Promise<void> {
  // Check memory cache
  if (isCacheValid()) {
    return;
  }

  // Check disk cache
  const diskCache = loadCacheFromDisk();
  if (diskCache && Date.now() - diskCache.fetchedAt < CACHE_TTL_MS) {
    pricingCache = diskCache;
    return;
  }

  // Fetch from LiteLLM
  try {
    const response = await fetch(LITELLM_PRICING_URL);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const rawData = await response.json() as Record<string, unknown>;
    const normalized = normalizePricing(rawData);

    pricingCache = {
      data: normalized,
      fetchedAt: Date.now(),
    };

    saveCacheToDisk(pricingCache);
  } catch (error) {
    // Fall back to stale cache if available
    if (diskCache) {
      console.warn('[costs] Failed to fetch pricing, using stale cache');
      pricingCache = diskCache;
      return;
    }

    // No cache at all - use empty with warning
    console.warn('[costs] Failed to fetch pricing, no cache available');
    pricingCache = {
      data: {},
      fetchedAt: Date.now(),
    };
  }
}

export function getModelCost(model: string): ModelCost {
  if (!pricingCache) {
    return { input: 0, output: 0 };
  }

  // Try exact match
  if (pricingCache.data[model]) {
    return pricingCache.data[model];
  }

  // Try with provider prefix variations
  const variations = [
    model,
    `openai/${model}`,
    `anthropic/${model}`,
    `azure/${model}`,
    `together_ai/${model}`,
    `fireworks_ai/${model}`,
  ];

  for (const variant of variations) {
    if (pricingCache.data[variant]) {
      return pricingCache.data[variant];
    }
  }

  // Try partial match (model name contains)
  const lowerModel = model.toLowerCase();
  for (const [key, cost] of Object.entries(pricingCache.data)) {
    if (key.toLowerCase().includes(lowerModel)) {
      return cost;
    }
  }

  return { input: 0, output: 0 };
}

export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const cost = getModelCost(model);
  return (inputTokens * cost.input + outputTokens * cost.output) / 1_000_000;
}

// For testing
export function clearCache(): void {
  pricingCache = null;
}

export function setTestPricing(data: Record<string, { input: number; output: number }>): void {
  pricingCache = {
    data,
    fetchedAt: Date.now(),
  };
}

// =============================================================================
// PRICING CONTEXT FOR LLM
// =============================================================================

/**
 * Pricing tier classification based on cost per 1M tokens
 */
export type PricingTier = 'expensive' | 'moderate' | 'cheap' | 'unknown';

const EXPENSIVE_THRESHOLD = 10.0; // >$10/1M = expensive
const MODERATE_THRESHOLD = 1.0;   // $1-10/1M = moderate

/**
 * Classify a model into pricing tiers
 */
export function classifyModelCost(model: string): PricingTier {
  const cost = getModelCost(model);
  if (cost.input === 0 && cost.output === 0) {
    return 'unknown';
  }

  // Use average of input/output cost for classification
  const avgCost = (cost.input + cost.output) / 2;

  if (avgCost > EXPENSIVE_THRESHOLD) {
    return 'expensive';
  } else if (avgCost > MODERATE_THRESHOLD) {
    return 'moderate';
  } else {
    return 'cheap';
  }
}

/**
 * Get pricing context for LLM analysis
 * Returns a condensed pricing map for models used in the data
 */
export interface PricingContext {
  models: Record<string, {
    input: number;   // $/1M tokens
    output: number;  // $/1M tokens
    tier: PricingTier;
  }>;
  thresholds: {
    expensive: number;
    moderate: number;
  };
}

export function getPricingContext(models: string[]): PricingContext {
  const result: PricingContext = {
    models: {},
    thresholds: {
      expensive: EXPENSIVE_THRESHOLD,
      moderate: MODERATE_THRESHOLD,
    },
  };

  for (const model of models) {
    const cost = getModelCost(model);
    result.models[model] = {
      input: cost.input,
      output: cost.output,
      tier: classifyModelCost(model),
    };
  }

  return result;
}

/**
 * Calculate total cost for a set of events
 */
export function calculateTotalCost(events: Array<{
  model: string;
  input_tokens: number;
  output_tokens: number;
}>): number {
  return events.reduce((total, event) => {
    return total + calculateCost(event.model, event.input_tokens, event.output_tokens);
  }, 0);
}
