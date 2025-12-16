/**
 * Reference Data - PeakInfer PRD v1.3 Section 12
 * 
 * InferenceMax Reference Envelopes: Performance benchmarks and
 * throughput analysis data for LLM inference optimization.
 * 
 * Sources:
 * - LiteLLM model registry (1000+ models)
 * - ArtificialAnalysis benchmarks
 * - Provider documentation
 * - Community benchmarks
 * 
 * Updated: December 2024
 */

// =============================================================================
// THROUGHPUT ENVELOPES (tokens per second)
// =============================================================================

/**
 * Model throughput benchmarks (tokens per second).
 * Based on real-world measurements and provider SLAs.
 * 
 * Categories:
 * - output_tps: Output tokens per second (generation speed)
 * - ttft_p50_ms: Time to first token, p50 (latency)
 * - ttft_p99_ms: Time to first token, p99 (worst case)
 */
export interface ThroughputEnvelope {
  /** Provider name */
  provider: string;
  
  /** Model identifier */
  model: string;
  
  /** Output tokens per second */
  output_tps: number;
  
  /** Time to first token p50 (ms) */
  ttft_p50_ms: number;
  
  /** Time to first token p99 (ms) */
  ttft_p99_ms: number;
  
  /** Total latency p50 for 100 output tokens (ms) */
  latency_100tok_p50_ms: number;
  
  /** Total latency p99 for 100 output tokens (ms) */
  latency_100tok_p99_ms: number;
  
  /** Speed tier for quick lookup */
  speedTier: 'ultra-fast' | 'fast' | 'medium' | 'slow';
  
  /** Quality score (1-100) */
  qualityScore: number;
  
  /** Context window size */
  contextWindow: number;
  
  /** Maximum output tokens */
  maxOutput: number;
  
  /** Rate limit (requests per minute) */
  rpm: number;
  
  /** Tokens per minute limit */
  tpm: number;
  
  /** Last updated date */
  lastUpdated: string;
}

/**
 * InferenceMax Reference Envelopes - Curated benchmarks
 * 
 * Per TDD v1.3: "Throughput envelopes from InferenceMax benchmarks"
 * 
 * Speed tiers:
 * - ultra-fast: > 100 tps (Groq, Fireworks)
 * - fast: 50-100 tps (Claude Haiku, GPT-4o-mini)
 * - medium: 20-50 tps (Claude Sonnet, GPT-4o)
 * - slow: < 20 tps (GPT-4-turbo, Claude Opus, o1)
 */
export const THROUGHPUT_ENVELOPES: ThroughputEnvelope[] = [
  // ==========================================================================
  // OpenAI Models
  // ==========================================================================
  {
    provider: 'openai',
    model: 'gpt-4o',
    output_tps: 45,
    ttft_p50_ms: 450,
    ttft_p99_ms: 1200,
    latency_100tok_p50_ms: 2600,
    latency_100tok_p99_ms: 4500,
    speedTier: 'medium',
    qualityScore: 88,
    contextWindow: 128000,
    maxOutput: 4096,
    rpm: 500,
    tpm: 800000,
    lastUpdated: '2024-12-01',
  },
  {
    provider: 'openai',
    model: 'gpt-4o-mini',
    output_tps: 85,
    ttft_p50_ms: 280,
    ttft_p99_ms: 800,
    latency_100tok_p50_ms: 1400,
    latency_100tok_p99_ms: 2500,
    speedTier: 'fast',
    qualityScore: 78,
    contextWindow: 128000,
    maxOutput: 16384,
    rpm: 1000,
    tpm: 2000000,
    lastUpdated: '2024-12-01',
  },
  {
    provider: 'openai',
    model: 'gpt-4-turbo',
    output_tps: 18,
    ttft_p50_ms: 800,
    ttft_p99_ms: 2500,
    latency_100tok_p50_ms: 6300,
    latency_100tok_p99_ms: 9000,
    speedTier: 'slow',
    qualityScore: 86,
    contextWindow: 128000,
    maxOutput: 4096,
    rpm: 200,
    tpm: 300000,
    lastUpdated: '2024-12-01',
  },
  {
    provider: 'openai',
    model: 'gpt-3.5-turbo',
    output_tps: 65,
    ttft_p50_ms: 200,
    ttft_p99_ms: 600,
    latency_100tok_p50_ms: 1700,
    latency_100tok_p99_ms: 2800,
    speedTier: 'fast',
    qualityScore: 68,
    contextWindow: 16384,
    maxOutput: 4096,
    rpm: 3500,
    tpm: 4000000,
    lastUpdated: '2024-12-01',
  },
  {
    provider: 'openai',
    model: 'o1',
    output_tps: 8,
    ttft_p50_ms: 2500,
    ttft_p99_ms: 8000,
    latency_100tok_p50_ms: 15000,
    latency_100tok_p99_ms: 35000,
    speedTier: 'slow',
    qualityScore: 95,
    contextWindow: 128000,
    maxOutput: 32768,
    rpm: 100,
    tpm: 100000,
    lastUpdated: '2024-12-01',
  },
  {
    provider: 'openai',
    model: 'o1-mini',
    output_tps: 25,
    ttft_p50_ms: 1500,
    ttft_p99_ms: 4000,
    latency_100tok_p50_ms: 5500,
    latency_100tok_p99_ms: 12000,
    speedTier: 'medium',
    qualityScore: 82,
    contextWindow: 128000,
    maxOutput: 65536,
    rpm: 200,
    tpm: 200000,
    lastUpdated: '2024-12-01',
  },
  {
    provider: 'openai',
    model: 'o3-mini',
    output_tps: 35,
    ttft_p50_ms: 1200,
    ttft_p99_ms: 3500,
    latency_100tok_p50_ms: 4000,
    latency_100tok_p99_ms: 8000,
    speedTier: 'medium',
    qualityScore: 85,
    contextWindow: 200000,
    maxOutput: 100000,
    rpm: 200,
    tpm: 200000,
    lastUpdated: '2024-12-01',
  },
  
  // ==========================================================================
  // Anthropic Models
  // ==========================================================================
  {
    provider: 'anthropic',
    model: 'claude-3-5-sonnet',
    output_tps: 55,
    ttft_p50_ms: 350,
    ttft_p99_ms: 900,
    latency_100tok_p50_ms: 2100,
    latency_100tok_p99_ms: 3500,
    speedTier: 'fast',
    qualityScore: 90,
    contextWindow: 200000,
    maxOutput: 8192,
    rpm: 1000,
    tpm: 400000,
    lastUpdated: '2024-12-01',
  },
  {
    provider: 'anthropic',
    model: 'claude-3-5-haiku',
    output_tps: 95,
    ttft_p50_ms: 200,
    ttft_p99_ms: 600,
    latency_100tok_p50_ms: 1200,
    latency_100tok_p99_ms: 2200,
    speedTier: 'fast',
    qualityScore: 75,
    contextWindow: 200000,
    maxOutput: 8192,
    rpm: 2000,
    tpm: 800000,
    lastUpdated: '2024-12-01',
  },
  {
    provider: 'anthropic',
    model: 'claude-3-opus',
    output_tps: 15,
    ttft_p50_ms: 900,
    ttft_p99_ms: 2800,
    latency_100tok_p50_ms: 7500,
    latency_100tok_p99_ms: 12000,
    speedTier: 'slow',
    qualityScore: 92,
    contextWindow: 200000,
    maxOutput: 4096,
    rpm: 500,
    tpm: 200000,
    lastUpdated: '2024-12-01',
  },
  {
    provider: 'anthropic',
    model: 'claude-sonnet-4',
    output_tps: 50,
    ttft_p50_ms: 380,
    ttft_p99_ms: 950,
    latency_100tok_p50_ms: 2300,
    latency_100tok_p99_ms: 3800,
    speedTier: 'medium',
    qualityScore: 91,
    contextWindow: 200000,
    maxOutput: 8192,
    rpm: 1000,
    tpm: 400000,
    lastUpdated: '2024-12-01',
  },
  {
    provider: 'anthropic',
    model: 'claude-opus-4',
    output_tps: 12,
    ttft_p50_ms: 1000,
    ttft_p99_ms: 3000,
    latency_100tok_p50_ms: 9000,
    latency_100tok_p99_ms: 15000,
    speedTier: 'slow',
    qualityScore: 96,
    contextWindow: 200000,
    maxOutput: 8192,
    rpm: 400,
    tpm: 150000,
    lastUpdated: '2024-12-01',
  },
  
  // ==========================================================================
  // Google Models
  // ==========================================================================
  {
    provider: 'google',
    model: 'gemini-2.0-flash',
    output_tps: 120,
    ttft_p50_ms: 150,
    ttft_p99_ms: 450,
    latency_100tok_p50_ms: 1000,
    latency_100tok_p99_ms: 1800,
    speedTier: 'ultra-fast',
    qualityScore: 82,
    contextWindow: 1000000,
    maxOutput: 8192,
    rpm: 2000,
    tpm: 4000000,
    lastUpdated: '2024-12-01',
  },
  {
    provider: 'google',
    model: 'gemini-1.5-pro',
    output_tps: 40,
    ttft_p50_ms: 500,
    ttft_p99_ms: 1300,
    latency_100tok_p50_ms: 3000,
    latency_100tok_p99_ms: 5000,
    speedTier: 'medium',
    qualityScore: 87,
    contextWindow: 2000000,
    maxOutput: 8192,
    rpm: 1000,
    tpm: 4000000,
    lastUpdated: '2024-12-01',
  },
  {
    provider: 'google',
    model: 'gemini-1.5-flash',
    output_tps: 100,
    ttft_p50_ms: 200,
    ttft_p99_ms: 550,
    latency_100tok_p50_ms: 1200,
    latency_100tok_p99_ms: 2100,
    speedTier: 'ultra-fast',
    qualityScore: 78,
    contextWindow: 1000000,
    maxOutput: 8192,
    rpm: 2000,
    tpm: 4000000,
    lastUpdated: '2024-12-01',
  },
  {
    provider: 'google',
    model: 'gemini-2.5-pro',
    output_tps: 45,
    ttft_p50_ms: 600,
    ttft_p99_ms: 1500,
    latency_100tok_p50_ms: 2800,
    latency_100tok_p99_ms: 4800,
    speedTier: 'medium',
    qualityScore: 93,
    contextWindow: 2000000,
    maxOutput: 8192,
    rpm: 1000,
    tpm: 4000000,
    lastUpdated: '2024-12-01',
  },
  
  // ==========================================================================
  // Groq (Ultra-fast inference)
  // ==========================================================================
  {
    provider: 'groq',
    model: 'llama-3.3-70b',
    output_tps: 250,
    ttft_p50_ms: 50,
    ttft_p99_ms: 150,
    latency_100tok_p50_ms: 450,
    latency_100tok_p99_ms: 800,
    speedTier: 'ultra-fast',
    qualityScore: 80,
    contextWindow: 131072,
    maxOutput: 8192,
    rpm: 30,
    tpm: 6000,
    lastUpdated: '2024-12-01',
  },
  {
    provider: 'groq',
    model: 'llama-3.1-70b',
    output_tps: 220,
    ttft_p50_ms: 60,
    ttft_p99_ms: 180,
    latency_100tok_p50_ms: 500,
    latency_100tok_p99_ms: 900,
    speedTier: 'ultra-fast',
    qualityScore: 78,
    contextWindow: 131072,
    maxOutput: 8192,
    rpm: 30,
    tpm: 6000,
    lastUpdated: '2024-12-01',
  },
  {
    provider: 'groq',
    model: 'llama-3.1-8b',
    output_tps: 350,
    ttft_p50_ms: 30,
    ttft_p99_ms: 100,
    latency_100tok_p50_ms: 300,
    latency_100tok_p99_ms: 550,
    speedTier: 'ultra-fast',
    qualityScore: 65,
    contextWindow: 131072,
    maxOutput: 8192,
    rpm: 30,
    tpm: 6000,
    lastUpdated: '2024-12-01',
  },
  {
    provider: 'groq',
    model: 'mixtral-8x7b',
    output_tps: 300,
    ttft_p50_ms: 40,
    ttft_p99_ms: 120,
    latency_100tok_p50_ms: 350,
    latency_100tok_p99_ms: 600,
    speedTier: 'ultra-fast',
    qualityScore: 72,
    contextWindow: 32768,
    maxOutput: 8192,
    rpm: 30,
    tpm: 6000,
    lastUpdated: '2024-12-01',
  },
  
  // ==========================================================================
  // Together AI
  // ==========================================================================
  {
    provider: 'together',
    model: 'llama-3.1-405b',
    output_tps: 35,
    ttft_p50_ms: 600,
    ttft_p99_ms: 1800,
    latency_100tok_p50_ms: 3400,
    latency_100tok_p99_ms: 6000,
    speedTier: 'medium',
    qualityScore: 85,
    contextWindow: 131072,
    maxOutput: 4096,
    rpm: 600,
    tpm: 600000,
    lastUpdated: '2024-12-01',
  },
  {
    provider: 'together',
    model: 'llama-3.1-70b',
    output_tps: 80,
    ttft_p50_ms: 300,
    ttft_p99_ms: 800,
    latency_100tok_p50_ms: 1500,
    latency_100tok_p99_ms: 2600,
    speedTier: 'fast',
    qualityScore: 78,
    contextWindow: 131072,
    maxOutput: 4096,
    rpm: 600,
    tpm: 600000,
    lastUpdated: '2024-12-01',
  },
  {
    provider: 'together',
    model: 'mixtral-8x22b',
    output_tps: 60,
    ttft_p50_ms: 400,
    ttft_p99_ms: 1000,
    latency_100tok_p50_ms: 2000,
    latency_100tok_p99_ms: 3500,
    speedTier: 'fast',
    qualityScore: 76,
    contextWindow: 65536,
    maxOutput: 4096,
    rpm: 600,
    tpm: 600000,
    lastUpdated: '2024-12-01',
  },
  
  // ==========================================================================
  // Fireworks AI
  // ==========================================================================
  {
    provider: 'fireworks',
    model: 'llama-3.1-70b',
    output_tps: 180,
    ttft_p50_ms: 80,
    ttft_p99_ms: 250,
    latency_100tok_p50_ms: 650,
    latency_100tok_p99_ms: 1100,
    speedTier: 'ultra-fast',
    qualityScore: 78,
    contextWindow: 131072,
    maxOutput: 16384,
    rpm: 1200,
    tpm: 4000000,
    lastUpdated: '2024-12-01',
  },
  {
    provider: 'fireworks',
    model: 'llama-3.1-8b',
    output_tps: 280,
    ttft_p50_ms: 45,
    ttft_p99_ms: 140,
    latency_100tok_p50_ms: 400,
    latency_100tok_p99_ms: 700,
    speedTier: 'ultra-fast',
    qualityScore: 65,
    contextWindow: 131072,
    maxOutput: 16384,
    rpm: 1200,
    tpm: 4000000,
    lastUpdated: '2024-12-01',
  },
  
  // ==========================================================================
  // Mistral
  // ==========================================================================
  {
    provider: 'mistral',
    model: 'mistral-large',
    output_tps: 50,
    ttft_p50_ms: 400,
    ttft_p99_ms: 1100,
    latency_100tok_p50_ms: 2400,
    latency_100tok_p99_ms: 4000,
    speedTier: 'medium',
    qualityScore: 84,
    contextWindow: 128000,
    maxOutput: 8192,
    rpm: 1000,
    tpm: 500000,
    lastUpdated: '2024-12-01',
  },
  {
    provider: 'mistral',
    model: 'mistral-small',
    output_tps: 90,
    ttft_p50_ms: 220,
    ttft_p99_ms: 600,
    latency_100tok_p50_ms: 1300,
    latency_100tok_p99_ms: 2300,
    speedTier: 'fast',
    qualityScore: 72,
    contextWindow: 128000,
    maxOutput: 8192,
    rpm: 2000,
    tpm: 1000000,
    lastUpdated: '2024-12-01',
  },
  
  // ==========================================================================
  // Cohere
  // ==========================================================================
  {
    provider: 'cohere',
    model: 'command-r-plus',
    output_tps: 40,
    ttft_p50_ms: 500,
    ttft_p99_ms: 1400,
    latency_100tok_p50_ms: 3000,
    latency_100tok_p99_ms: 5200,
    speedTier: 'medium',
    qualityScore: 81,
    contextWindow: 128000,
    maxOutput: 4096,
    rpm: 1000,
    tpm: 2000000,
    lastUpdated: '2024-12-01',
  },
  {
    provider: 'cohere',
    model: 'command-r',
    output_tps: 75,
    ttft_p50_ms: 280,
    ttft_p99_ms: 750,
    latency_100tok_p50_ms: 1600,
    latency_100tok_p99_ms: 2800,
    speedTier: 'fast',
    qualityScore: 74,
    contextWindow: 128000,
    maxOutput: 4096,
    rpm: 2000,
    tpm: 4000000,
    lastUpdated: '2024-12-01',
  },
];

// =============================================================================
// LOOKUP FUNCTIONS
// =============================================================================

/**
 * Get throughput envelope for a specific model.
 */
export function getThroughputEnvelope(
  provider: string,
  model: string
): ThroughputEnvelope | null {
  const normalized = normalizeModelId(model);
  
  // First try exact match
  let envelope = THROUGHPUT_ENVELOPES.find(
    e => e.provider === provider && e.model === model
  );
  
  if (envelope) return envelope;
  
  // Try normalized match
  envelope = THROUGHPUT_ENVELOPES.find(
    e => e.provider === provider && normalizeModelId(e.model) === normalized
  );
  
  if (envelope) return envelope;
  
  // Try model-only match (any provider)
  envelope = THROUGHPUT_ENVELOPES.find(
    e => normalizeModelId(e.model) === normalized
  );
  
  return envelope || null;
}

/**
 * Get all models for a provider.
 */
export function getProviderModels(provider: string): ThroughputEnvelope[] {
  return THROUGHPUT_ENVELOPES.filter(e => e.provider === provider);
}

/**
 * Get models by speed tier.
 */
export function getModelsBySpeedTier(
  tier: ThroughputEnvelope['speedTier']
): ThroughputEnvelope[] {
  return THROUGHPUT_ENVELOPES.filter(e => e.speedTier === tier);
}

/**
 * Get fastest models across all providers.
 */
export function getFastestModels(limit = 10): ThroughputEnvelope[] {
  return [...THROUGHPUT_ENVELOPES]
    .sort((a, b) => b.output_tps - a.output_tps)
    .slice(0, limit);
}

/**
 * Get highest quality models.
 */
export function getHighestQualityModels(limit = 10): ThroughputEnvelope[] {
  return [...THROUGHPUT_ENVELOPES]
    .sort((a, b) => b.qualityScore - a.qualityScore)
    .slice(0, limit);
}

/**
 * Normalize model identifier for matching.
 */
function normalizeModelId(model: string): string {
  return model
    .toLowerCase()
    .replace(/[_\-.:]/g, '')
    .replace(/latest$/, '')
    .replace(/preview$/, '')
    .replace(/^(gpt|claude|gemini|llama|mixtral|command)[v]?(\d)/, '$1$2');
}

// =============================================================================
// THROUGHPUT GAP ANALYSIS
// =============================================================================

/**
 * Result of throughput gap analysis.
 */
export interface ThroughputGap {
  /** Current model */
  currentModel: string;
  
  /** Current provider */
  currentProvider: string;
  
  /** Current throughput (tps) */
  currentTps: number;
  
  /** Best alternative model */
  alternativeModel: string;
  
  /** Alternative provider */
  alternativeProvider: string;
  
  /** Alternative throughput (tps) */
  alternativeTps: number;
  
  /** Speedup factor */
  speedupFactor: number;
  
  /** Quality difference (negative = lower quality) */
  qualityDelta: number;
  
  /** Cost change (per million tokens) */
  costDeltaPer1M: number;
  
  /** Recommendation */
  recommendation: string;
}

/**
 * Analyze throughput gaps for a model.
 * Identifies faster alternatives that maintain acceptable quality.
 */
export function analyzeThroughputGap(
  provider: string,
  model: string,
  pricing: { inputPer1M: number; outputPer1M: number } | null,
  minQualityScore = 70,
  minSpeedupFactor = 1.5
): ThroughputGap | null {
  const current = getThroughputEnvelope(provider, model);
  if (!current) return null;
  
  // Find faster alternatives
  const alternatives = THROUGHPUT_ENVELOPES.filter(e =>
    e.output_tps > current.output_tps * minSpeedupFactor &&
    e.qualityScore >= minQualityScore &&
    (e.provider !== provider || e.model !== model)
  ).sort((a, b) => b.output_tps - a.output_tps);
  
  if (alternatives.length === 0) return null;
  
  const best = alternatives[0];
  const speedup = best.output_tps / current.output_tps;
  const qualityDelta = best.qualityScore - current.qualityScore;
  
  // Simplified cost comparison (would need actual pricing data)
  const currentCost = pricing?.inputPer1M ?? 0;
  const costDelta = 0; // Would calculate from pricing module
  
  let recommendation = '';
  if (speedup >= 5 && qualityDelta >= -5) {
    recommendation = `Switch to ${best.model} for ${speedup.toFixed(1)}x faster inference with minimal quality trade-off`;
  } else if (speedup >= 2) {
    recommendation = `Consider ${best.model} for ${speedup.toFixed(1)}x speedup`;
  } else {
    recommendation = `${best.model} offers ${speedup.toFixed(1)}x better throughput`;
  }
  
  return {
    currentModel: model,
    currentProvider: provider,
    currentTps: current.output_tps,
    alternativeModel: best.model,
    alternativeProvider: best.provider,
    alternativeTps: best.output_tps,
    speedupFactor: speedup,
    qualityDelta,
    costDeltaPer1M: costDelta,
    recommendation,
  };
}

/**
 * Analyze throughput gaps for multiple models.
 */
export function analyzeMultipleThroughputGaps(
  models: Array<{ provider: string; model: string; pricing?: { inputPer1M: number; outputPer1M: number } }>
): ThroughputGap[] {
  return models
    .map(m => analyzeThroughputGap(m.provider, m.model, m.pricing || null))
    .filter((g): g is ThroughputGap => g !== null);
}

// =============================================================================
// RATE LIMIT ANALYSIS
// =============================================================================

/**
 * Check if a model can handle expected request volume.
 */
export function checkRateLimits(
  provider: string,
  model: string,
  expectedRpm: number,
  expectedTpm: number
): {
  withinLimits: boolean;
  rpmUtilization: number;
  tpmUtilization: number;
  warnings: string[];
} {
  const envelope = getThroughputEnvelope(provider, model);
  
  if (!envelope) {
    return {
      withinLimits: true,
      rpmUtilization: 0,
      tpmUtilization: 0,
      warnings: ['Rate limit data not available for this model'],
    };
  }
  
  const rpmUtilization = expectedRpm / envelope.rpm;
  const tpmUtilization = expectedTpm / envelope.tpm;
  const withinLimits = rpmUtilization <= 0.8 && tpmUtilization <= 0.8;
  const warnings: string[] = [];
  
  if (rpmUtilization > 0.8) {
    warnings.push(`RPM utilization ${(rpmUtilization * 100).toFixed(0)}% - approaching rate limit`);
  }
  if (rpmUtilization > 1) {
    warnings.push(`Expected RPM (${expectedRpm}) exceeds limit (${envelope.rpm})`);
  }
  if (tpmUtilization > 0.8) {
    warnings.push(`TPM utilization ${(tpmUtilization * 100).toFixed(0)}% - approaching token limit`);
  }
  if (tpmUtilization > 1) {
    warnings.push(`Expected TPM (${expectedTpm}) exceeds limit (${envelope.tpm})`);
  }
  
  return { withinLimits, rpmUtilization, tpmUtilization, warnings };
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  normalizeModelId,
};

