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
  // ==========================================================================
  // OpenAI Models
  // ==========================================================================
  'gpt-4o': {
    ttft_p50_ms: 200,
    ttft_p95_ms: 500,
    tps_median: 80,
    tps_peak: 120,
  },
  'gpt-4o-2024-11-20': {
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
  'gpt-4o-mini-2024-07-18': {
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
  'gpt-4-turbo-2024-04-09': {
    ttft_p50_ms: 300,
    ttft_p95_ms: 800,
    tps_median: 60,
    tps_peak: 90,
  },
  'gpt-4.1': {
    ttft_p50_ms: 180,
    ttft_p95_ms: 450,
    tps_median: 90,
    tps_peak: 130,
  },
  'gpt-4.1-2025-04-14': {
    ttft_p50_ms: 180,
    ttft_p95_ms: 450,
    tps_median: 90,
    tps_peak: 130,
  },
  'gpt-4.1-mini': {
    ttft_p50_ms: 120,
    ttft_p95_ms: 300,
    tps_median: 110,
    tps_peak: 160,
  },
  'gpt-4.1-nano': {
    ttft_p50_ms: 80,
    ttft_p95_ms: 200,
    tps_median: 140,
    tps_peak: 200,
  },
  'gpt-3.5-turbo': {
    ttft_p50_ms: 100,
    ttft_p95_ms: 250,
    tps_median: 120,
    tps_peak: 180,
  },
  'o1': {
    ttft_p50_ms: 2000,
    ttft_p95_ms: 8000,
    tps_median: 30,
    tps_peak: 50,
  },
  'o1-preview': {
    ttft_p50_ms: 2000,
    ttft_p95_ms: 8000,
    tps_median: 30,
    tps_peak: 50,
  },
  'o1-mini': {
    ttft_p50_ms: 800,
    ttft_p95_ms: 3000,
    tps_median: 50,
    tps_peak: 80,
  },
  'o3': {
    ttft_p50_ms: 1500,
    ttft_p95_ms: 6000,
    tps_median: 40,
    tps_peak: 60,
  },
  'o3-mini': {
    ttft_p50_ms: 600,
    ttft_p95_ms: 2000,
    tps_median: 60,
    tps_peak: 90,
  },

  // ==========================================================================
  // Anthropic Models
  // ==========================================================================
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
  'claude-3-haiku-20240307': {
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
  'claude-3-5-haiku': {
    ttft_p50_ms: 120,
    ttft_p95_ms: 300,
    tps_median: 110,
    tps_peak: 160,
  },
  'claude-3-5-haiku-20241022': {
    ttft_p50_ms: 120,
    ttft_p95_ms: 300,
    tps_median: 110,
    tps_peak: 160,
  },
  // Claude 4 models
  'claude-sonnet-4-20250514': {
    ttft_p50_ms: 180,
    ttft_p95_ms: 450,
    tps_median: 90,
    tps_peak: 130,
  },
  'claude-4-sonnet': {
    ttft_p50_ms: 180,
    ttft_p95_ms: 450,
    tps_median: 90,
    tps_peak: 130,
  },
  'claude-opus-4-20250514': {
    ttft_p50_ms: 350,
    ttft_p95_ms: 1000,
    tps_median: 50,
    tps_peak: 75,
  },
  'claude-4-opus': {
    ttft_p50_ms: 350,
    ttft_p95_ms: 1000,
    tps_median: 50,
    tps_peak: 75,
  },

  // ==========================================================================
  // Google Models
  // ==========================================================================
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
  'gemini-1.5-pro-latest': {
    ttft_p50_ms: 300,
    ttft_p95_ms: 800,
    tps_median: 50,
    tps_peak: 80,
  },
  'gemini-1.5-flash': {
    ttft_p50_ms: 150,
    ttft_p95_ms: 400,
    tps_median: 100,
    tps_peak: 150,
  },
  'gemini-1.5-flash-latest': {
    ttft_p50_ms: 150,
    ttft_p95_ms: 400,
    tps_median: 100,
    tps_peak: 150,
  },
  'gemini-2.0-flash': {
    ttft_p50_ms: 120,
    ttft_p95_ms: 300,
    tps_median: 120,
    tps_peak: 180,
  },
  'gemini-2.0-flash-exp': {
    ttft_p50_ms: 120,
    ttft_p95_ms: 300,
    tps_median: 120,
    tps_peak: 180,
  },
  'gemini-2.5-pro': {
    ttft_p50_ms: 250,
    ttft_p95_ms: 700,
    tps_median: 60,
    tps_peak: 90,
  },
  'gemini-2.5-flash': {
    ttft_p50_ms: 100,
    ttft_p95_ms: 250,
    tps_median: 130,
    tps_peak: 200,
  },

  // ==========================================================================
  // Mistral Models
  // ==========================================================================
  'mistral-large': {
    ttft_p50_ms: 200,
    ttft_p95_ms: 500,
    tps_median: 70,
    tps_peak: 110,
  },
  'mistral-large-latest': {
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
  'mistral-small': {
    ttft_p50_ms: 100,
    ttft_p95_ms: 250,
    tps_median: 110,
    tps_peak: 160,
  },
  'mistral-small-latest': {
    ttft_p50_ms: 100,
    ttft_p95_ms: 250,
    tps_median: 110,
    tps_peak: 160,
  },
  'codestral': {
    ttft_p50_ms: 120,
    ttft_p95_ms: 300,
    tps_median: 100,
    tps_peak: 150,
  },
  'codestral-latest': {
    ttft_p50_ms: 120,
    ttft_p95_ms: 300,
    tps_median: 100,
    tps_peak: 150,
  },

  // ==========================================================================
  // Together AI / Fireworks / Groq (Cloud-hosted open models)
  // ==========================================================================
  'mixtral-8x7b': {
    ttft_p50_ms: 100,
    ttft_p95_ms: 250,
    tps_median: 60,
    tps_peak: 100,
  },
  'mixtral-8x7b-instruct': {
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
  'mixtral-8x22b-instruct': {
    ttft_p50_ms: 150,
    ttft_p95_ms: 400,
    tps_median: 40,
    tps_peak: 70,
  },

  // ==========================================================================
  // Llama 3 Models (Meta)
  // ==========================================================================
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
  'meta-llama/Llama-3-8b-chat-hf': {
    ttft_p50_ms: 60,
    ttft_p95_ms: 150,
    tps_median: 100,
    tps_peak: 180,
  },

  // ==========================================================================
  // Llama 3.1 Models
  // ==========================================================================
  'llama-3.1-405b': {
    ttft_p50_ms: 400,
    ttft_p95_ms: 1200,
    tps_median: 20,
    tps_peak: 35,
  },
  'llama-3.1-405b:vllm': {
    ttft_p50_ms: 300,
    ttft_p95_ms: 900,
    tps_median: 25,
    tps_peak: 45,
  },
  'llama-3.1-405b:sglang': {
    ttft_p50_ms: 250,
    ttft_p95_ms: 800,
    tps_median: 30,
    tps_peak: 50,
  },
  'meta-llama/Llama-3.1-405B-Instruct': {
    ttft_p50_ms: 300,
    ttft_p95_ms: 900,
    tps_median: 25,
    tps_peak: 45,
  },
  'llama-3.1-70b': {
    ttft_p50_ms: 180,
    ttft_p95_ms: 500,
    tps_median: 40,
    tps_peak: 70,
  },
  'llama-3.1-70b:vllm': {
    ttft_p50_ms: 140,
    ttft_p95_ms: 380,
    tps_median: 50,
    tps_peak: 95,
  },
  'llama-3.1-70b:sglang': {
    ttft_p50_ms: 110,
    ttft_p95_ms: 320,
    tps_median: 60,
    tps_peak: 110,
  },
  'meta-llama/Llama-3.1-70B-Instruct': {
    ttft_p50_ms: 140,
    ttft_p95_ms: 380,
    tps_median: 50,
    tps_peak: 95,
  },
  'llama-3.1-8b': {
    ttft_p50_ms: 70,
    ttft_p95_ms: 180,
    tps_median: 90,
    tps_peak: 160,
  },
  'llama-3.1-8b:vllm': {
    ttft_p50_ms: 50,
    ttft_p95_ms: 130,
    tps_median: 110,
    tps_peak: 200,
  },
  'meta-llama/Llama-3.1-8B-Instruct': {
    ttft_p50_ms: 50,
    ttft_p95_ms: 130,
    tps_median: 110,
    tps_peak: 200,
  },

  // ==========================================================================
  // Llama 3.2 Models (Smaller/Edge)
  // ==========================================================================
  'llama-3.2-90b': {
    ttft_p50_ms: 250,
    ttft_p95_ms: 700,
    tps_median: 30,
    tps_peak: 55,
  },
  'llama-3.2-90b:vllm': {
    ttft_p50_ms: 200,
    ttft_p95_ms: 550,
    tps_median: 38,
    tps_peak: 70,
  },
  'meta-llama/Llama-3.2-90B-Vision-Instruct': {
    ttft_p50_ms: 200,
    ttft_p95_ms: 550,
    tps_median: 38,
    tps_peak: 70,
  },
  'llama-3.2-11b': {
    ttft_p50_ms: 80,
    ttft_p95_ms: 200,
    tps_median: 75,
    tps_peak: 140,
  },
  'llama-3.2-11b:vllm': {
    ttft_p50_ms: 60,
    ttft_p95_ms: 150,
    tps_median: 95,
    tps_peak: 170,
  },
  'meta-llama/Llama-3.2-11B-Vision-Instruct': {
    ttft_p50_ms: 60,
    ttft_p95_ms: 150,
    tps_median: 95,
    tps_peak: 170,
  },
  'llama-3.2-3b': {
    ttft_p50_ms: 40,
    ttft_p95_ms: 100,
    tps_median: 140,
    tps_peak: 250,
  },
  'llama-3.2-3b:vllm': {
    ttft_p50_ms: 30,
    ttft_p95_ms: 80,
    tps_median: 170,
    tps_peak: 300,
  },
  'llama-3.2-3b:ollama': {
    ttft_p50_ms: 50,
    ttft_p95_ms: 120,
    tps_median: 120,
    tps_peak: 200,
  },
  'meta-llama/Llama-3.2-3B-Instruct': {
    ttft_p50_ms: 30,
    ttft_p95_ms: 80,
    tps_median: 170,
    tps_peak: 300,
  },
  'llama-3.2-1b': {
    ttft_p50_ms: 25,
    ttft_p95_ms: 60,
    tps_median: 200,
    tps_peak: 350,
  },
  'llama-3.2-1b:ollama': {
    ttft_p50_ms: 30,
    ttft_p95_ms: 80,
    tps_median: 180,
    tps_peak: 300,
  },
  'meta-llama/Llama-3.2-1B-Instruct': {
    ttft_p50_ms: 25,
    ttft_p95_ms: 60,
    tps_median: 200,
    tps_peak: 350,
  },

  // ==========================================================================
  // Llama 3.3 Models
  // ==========================================================================
  'llama-3.3-70b': {
    ttft_p50_ms: 160,
    ttft_p95_ms: 450,
    tps_median: 45,
    tps_peak: 80,
  },
  'llama-3.3-70b:vllm': {
    ttft_p50_ms: 120,
    ttft_p95_ms: 350,
    tps_median: 55,
    tps_peak: 100,
  },
  'llama-3.3-70b:sglang': {
    ttft_p50_ms: 100,
    ttft_p95_ms: 300,
    tps_median: 65,
    tps_peak: 115,
  },
  'meta-llama/Llama-3.3-70B-Instruct': {
    ttft_p50_ms: 120,
    ttft_p95_ms: 350,
    tps_median: 55,
    tps_peak: 100,
  },

  // ==========================================================================
  // Qwen Models (Alibaba)
  // ==========================================================================
  'qwen-2.5-72b': {
    ttft_p50_ms: 200,
    ttft_p95_ms: 550,
    tps_median: 40,
    tps_peak: 70,
  },
  'qwen-2.5-72b:vllm': {
    ttft_p50_ms: 150,
    ttft_p95_ms: 420,
    tps_median: 50,
    tps_peak: 90,
  },
  'qwen-2.5-72b:sglang': {
    ttft_p50_ms: 130,
    ttft_p95_ms: 380,
    tps_median: 55,
    tps_peak: 100,
  },
  'Qwen/Qwen2.5-72B-Instruct': {
    ttft_p50_ms: 150,
    ttft_p95_ms: 420,
    tps_median: 50,
    tps_peak: 90,
  },
  'qwen-2.5-32b': {
    ttft_p50_ms: 120,
    ttft_p95_ms: 320,
    tps_median: 60,
    tps_peak: 100,
  },
  'qwen-2.5-32b:vllm': {
    ttft_p50_ms: 90,
    ttft_p95_ms: 250,
    tps_median: 75,
    tps_peak: 130,
  },
  'Qwen/Qwen2.5-32B-Instruct': {
    ttft_p50_ms: 90,
    ttft_p95_ms: 250,
    tps_median: 75,
    tps_peak: 130,
  },
  'qwen-2.5-14b': {
    ttft_p50_ms: 80,
    ttft_p95_ms: 220,
    tps_median: 80,
    tps_peak: 140,
  },
  'qwen-2.5-7b': {
    ttft_p50_ms: 50,
    ttft_p95_ms: 140,
    tps_median: 110,
    tps_peak: 190,
  },
  'qwen-2.5-3b': {
    ttft_p50_ms: 35,
    ttft_p95_ms: 90,
    tps_median: 150,
    tps_peak: 260,
  },
  'qwen-2.5-coder-32b': {
    ttft_p50_ms: 120,
    ttft_p95_ms: 320,
    tps_median: 60,
    tps_peak: 100,
  },
  'qwen-2.5-coder-7b': {
    ttft_p50_ms: 50,
    ttft_p95_ms: 140,
    tps_median: 110,
    tps_peak: 190,
  },

  // ==========================================================================
  // DeepSeek Models
  // ==========================================================================
  'deepseek-v3': {
    ttft_p50_ms: 300,
    ttft_p95_ms: 800,
    tps_median: 35,
    tps_peak: 60,
  },
  'deepseek-v3:vllm': {
    ttft_p50_ms: 220,
    ttft_p95_ms: 600,
    tps_median: 45,
    tps_peak: 80,
  },
  'deepseek-chat': {
    ttft_p50_ms: 300,
    ttft_p95_ms: 800,
    tps_median: 35,
    tps_peak: 60,
  },
  'deepseek-coder': {
    ttft_p50_ms: 200,
    ttft_p95_ms: 550,
    tps_median: 50,
    tps_peak: 85,
  },
  'deepseek-coder-v2': {
    ttft_p50_ms: 180,
    ttft_p95_ms: 500,
    tps_median: 55,
    tps_peak: 95,
  },
  'deepseek-r1': {
    ttft_p50_ms: 1500,
    ttft_p95_ms: 5000,
    tps_median: 25,
    tps_peak: 45,
  },
  'deepseek-r1-lite': {
    ttft_p50_ms: 800,
    ttft_p95_ms: 2500,
    tps_median: 40,
    tps_peak: 70,
  },

  // ==========================================================================
  // Cohere Models
  // ==========================================================================
  'command-r': {
    ttft_p50_ms: 200,
    ttft_p95_ms: 500,
    tps_median: 60,
    tps_peak: 100,
  },
  'command-r-plus': {
    ttft_p50_ms: 300,
    ttft_p95_ms: 800,
    tps_median: 45,
    tps_peak: 75,
  },
  'command-light': {
    ttft_p50_ms: 100,
    ttft_p95_ms: 250,
    tps_median: 100,
    tps_peak: 150,
  },

  // ==========================================================================
  // Local/Edge Models (Ollama, llama.cpp)
  // ==========================================================================
  'phi-3': {
    ttft_p50_ms: 50,
    ttft_p95_ms: 130,
    tps_median: 120,
    tps_peak: 200,
  },
  'phi-3:ollama': {
    ttft_p50_ms: 60,
    ttft_p95_ms: 150,
    tps_median: 100,
    tps_peak: 170,
  },
  'phi-3-mini': {
    ttft_p50_ms: 30,
    ttft_p95_ms: 80,
    tps_median: 160,
    tps_peak: 280,
  },
  'gemma-2-9b': {
    ttft_p50_ms: 70,
    ttft_p95_ms: 180,
    tps_median: 85,
    tps_peak: 150,
  },
  'gemma-2-9b:ollama': {
    ttft_p50_ms: 80,
    ttft_p95_ms: 200,
    tps_median: 75,
    tps_peak: 130,
  },
  'gemma-2-27b': {
    ttft_p50_ms: 150,
    ttft_p95_ms: 400,
    tps_median: 45,
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
