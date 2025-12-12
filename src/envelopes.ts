import type { PerformanceEnvelope } from './types.js';

// =============================================================================
// INFERENCE MAX REFERENCE ENVELOPES
// =============================================================================
//
// Performance benchmarks from InferenceMax testing.
// These represent achievable performance under optimal conditions.
// Key: model name or model:runtime combination
//
// TTFT = Time To First Token
// TPS = Tokens Per Second (output generation speed)
// =============================================================================

export const ENVELOPES: Record<string, PerformanceEnvelope> = {
  // OpenAI Models
  'gpt-4o': {
    ttft_p50_ms: 200,
    ttft_p95_ms: 500,
    tps_median: 80,
    tps_peak: 120,
  },
  'gpt-4o-mini': {
    ttft_p50_ms: 150,
    ttft_p95_ms: 350,
    tps_median: 100,
    tps_peak: 150,
  },
  'gpt-4-turbo': {
    ttft_p50_ms: 300,
    ttft_p95_ms: 800,
    tps_median: 60,
    tps_peak: 90,
  },
  'gpt-3.5-turbo': {
    ttft_p50_ms: 100,
    ttft_p95_ms: 250,
    tps_median: 120,
    tps_peak: 180,
  },

  // Anthropic Models
  'claude-3-opus': {
    ttft_p50_ms: 400,
    ttft_p95_ms: 1200,
    tps_median: 40,
    tps_peak: 60,
  },
  'claude-3-opus-20240229': {
    ttft_p50_ms: 400,
    ttft_p95_ms: 1200,
    tps_median: 40,
    tps_peak: 60,
  },
  'claude-3-sonnet': {
    ttft_p50_ms: 250,
    ttft_p95_ms: 600,
    tps_median: 70,
    tps_peak: 100,
  },
  'claude-3-sonnet-20240229': {
    ttft_p50_ms: 250,
    ttft_p95_ms: 600,
    tps_median: 70,
    tps_peak: 100,
  },
  'claude-3-haiku': {
    ttft_p50_ms: 150,
    ttft_p95_ms: 350,
    tps_median: 100,
    tps_peak: 150,
  },
  'claude-3-5-sonnet': {
    ttft_p50_ms: 200,
    ttft_p95_ms: 500,
    tps_median: 80,
    tps_peak: 120,
  },
  'claude-3-5-sonnet-20241022': {
    ttft_p50_ms: 200,
    ttft_p95_ms: 500,
    tps_median: 80,
    tps_peak: 120,
  },

  // Self-hosted: Llama 3 70B on different runtimes
  'llama-3-70b': {
    ttft_p50_ms: 200,
    ttft_p95_ms: 600,
    tps_median: 35,
    tps_peak: 60,
  },
  'llama-3-70b:vllm': {
    ttft_p50_ms: 150,
    ttft_p95_ms: 400,
    tps_median: 45,
    tps_peak: 90,
  },
  'llama-3-70b:sglang': {
    ttft_p50_ms: 120,
    ttft_p95_ms: 350,
    tps_median: 55,
    tps_peak: 100,
  },
  'llama-3-70b:tgi': {
    ttft_p50_ms: 180,
    ttft_p95_ms: 500,
    tps_median: 35,
    tps_peak: 70,
  },
  'meta-llama/Llama-3-70b-chat-hf': {
    ttft_p50_ms: 150,
    ttft_p95_ms: 400,
    tps_median: 45,
    tps_peak: 90,
  },

  // Self-hosted: Llama 3 8B
  'llama-3-8b': {
    ttft_p50_ms: 80,
    ttft_p95_ms: 200,
    tps_median: 80,
    tps_peak: 150,
  },
  'llama-3-8b:vllm': {
    ttft_p50_ms: 60,
    ttft_p95_ms: 150,
    tps_median: 100,
    tps_peak: 180,
  },

  // Mistral Models
  'mistral-large': {
    ttft_p50_ms: 200,
    ttft_p95_ms: 500,
    tps_median: 70,
    tps_peak: 110,
  },
  'mistral-medium': {
    ttft_p50_ms: 150,
    ttft_p95_ms: 350,
    tps_median: 90,
    tps_peak: 140,
  },

  // Together AI / Fireworks
  'mixtral-8x7b': {
    ttft_p50_ms: 100,
    ttft_p95_ms: 250,
    tps_median: 60,
    tps_peak: 100,
  },
  'mixtral-8x22b': {
    ttft_p50_ms: 150,
    ttft_p95_ms: 400,
    tps_median: 40,
    tps_peak: 70,
  },

  // Google
  'gemini-pro': {
    ttft_p50_ms: 250,
    ttft_p95_ms: 600,
    tps_median: 60,
    tps_peak: 100,
  },
  'gemini-1.5-pro': {
    ttft_p50_ms: 300,
    ttft_p95_ms: 800,
    tps_median: 50,
    tps_peak: 80,
  },
};

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Get performance envelope for a model.
 *
 * @param model - Model name (e.g., "gpt-4o", "llama-3-70b")
 * @param runtime - Optional runtime (e.g., "vllm", "sglang")
 * @returns Performance envelope or null if not found
 */
export function getEnvelope(model: string, runtime?: string): PerformanceEnvelope | null {
  // Try with runtime suffix first
  if (runtime) {
    const keyWithRuntime = `${model}:${runtime}`;
    if (ENVELOPES[keyWithRuntime]) {
      return ENVELOPES[keyWithRuntime];
    }
  }

  // Try exact match
  if (ENVELOPES[model]) {
    return ENVELOPES[model];
  }

  // Try case-insensitive match
  const lowerModel = model.toLowerCase();
  for (const [key, envelope] of Object.entries(ENVELOPES)) {
    if (key.toLowerCase() === lowerModel) {
      return envelope;
    }
  }

  // Try partial match (model name contains)
  for (const [key, envelope] of Object.entries(ENVELOPES)) {
    const lowerKey = key.toLowerCase();
    if (lowerKey.includes(lowerModel) || lowerModel.includes(lowerKey.split(':')[0])) {
      return envelope;
    }
  }

  return null;
}

/**
 * Calculate throughput percentage against reference envelope.
 *
 * @param model - Model name
 * @param actualTps - Actual tokens per second observed
 * @param runtime - Optional runtime
 * @returns Percentage (0-100+) or null if no envelope found
 */
export function getThroughputPercent(
  model: string,
  actualTps: number,
  runtime?: string
): number | null {
  const envelope = getEnvelope(model, runtime);
  if (!envelope) return null;
  return Math.round((actualTps / envelope.tps_median) * 100);
}

/**
 * Check if TTFT is within expected range.
 *
 * @param model - Model name
 * @param actualTtft - Actual time to first token in ms
 * @param runtime - Optional runtime
 * @returns 'fast' | 'normal' | 'slow' | null
 */
export function getTtftStatus(
  model: string,
  actualTtft: number,
  runtime?: string
): 'fast' | 'normal' | 'slow' | null {
  const envelope = getEnvelope(model, runtime);
  if (!envelope) return null;

  if (actualTtft <= envelope.ttft_p50_ms) return 'fast';
  if (actualTtft <= envelope.ttft_p95_ms) return 'normal';
  return 'slow';
}

/**
 * Get all available model names in envelopes.
 */
export function getAvailableModels(): string[] {
  return Object.keys(ENVELOPES);
}
