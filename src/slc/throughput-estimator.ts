/**
 * Throughput Estimator
 *
 * Estimates tokens/second for model + GPU combinations.
 * Based on InferenceMAX benchmarks, vLLM benchmarks, and public data.
 *
 * This is estimation, not measurement. Values are labeled with confidence.
 */

import { getGPUPricing, GPU_PRICING, type GPUPricingEntry } from './gpu-pricing.js';

// =============================================================================
// TYPES
// =============================================================================

export interface ThroughputEstimate {
  model: string;
  modelSizeB: number;          // Billion parameters
  gpu: string;
  gpuCount: number;
  precision: 'fp32' | 'fp16' | 'fp8' | 'int8' | 'int4';

  // Performance metrics
  throughputTokPerSec: number;     // System throughput (all users)
  latencyTokPerSecUser: number;    // Per-user generation speed
  ttftMs: number;                  // Time to first token

  // Optimal configuration
  optimalBatchSize: number;

  // Metadata
  source: 'inferencemax' | 'vllm_benchmarks' | 'estimated';
  confidence: number;              // 0.0 - 1.0
  notes?: string;
}

export interface ModelProfile {
  name: string;
  sizeB: number;                   // Billion parameters
  architecture: 'dense' | 'moe';
  activeParamsB?: number;          // For MoE: active parameters per token
  contextLength: number;
  family: string;
}

// =============================================================================
// MODEL PROFILES
// =============================================================================

/**
 * Known model profiles for throughput estimation
 */
export const MODEL_PROFILES: Record<string, ModelProfile> = {
  // OpenAI (sizes are estimates based on public info)
  'gpt-4o': { name: 'GPT-4o', sizeB: 200, architecture: 'moe', activeParamsB: 50, contextLength: 128000, family: 'gpt' },
  'gpt-4o-mini': { name: 'GPT-4o Mini', sizeB: 8, architecture: 'dense', contextLength: 128000, family: 'gpt' },
  'gpt-4-turbo': { name: 'GPT-4 Turbo', sizeB: 200, architecture: 'moe', activeParamsB: 50, contextLength: 128000, family: 'gpt' },
  'gpt-3.5-turbo': { name: 'GPT-3.5 Turbo', sizeB: 20, architecture: 'dense', contextLength: 16000, family: 'gpt' },

  // Anthropic (sizes are estimates)
  'claude-3-opus': { name: 'Claude 3 Opus', sizeB: 175, architecture: 'dense', contextLength: 200000, family: 'claude' },
  'claude-3-5-sonnet': { name: 'Claude 3.5 Sonnet', sizeB: 70, architecture: 'dense', contextLength: 200000, family: 'claude' },
  'claude-3-5-haiku': { name: 'Claude 3.5 Haiku', sizeB: 20, architecture: 'dense', contextLength: 200000, family: 'claude' },
  'claude-sonnet-4': { name: 'Claude Sonnet 4', sizeB: 70, architecture: 'dense', contextLength: 200000, family: 'claude' },

  // Llama (known sizes)
  'llama-3-405b': { name: 'Llama 3 405B', sizeB: 405, architecture: 'dense', contextLength: 128000, family: 'llama' },
  'llama-3-70b': { name: 'Llama 3 70B', sizeB: 70, architecture: 'dense', contextLength: 128000, family: 'llama' },
  'llama-3-8b': { name: 'Llama 3 8B', sizeB: 8, architecture: 'dense', contextLength: 128000, family: 'llama' },
  'llama-3.1-405b': { name: 'Llama 3.1 405B', sizeB: 405, architecture: 'dense', contextLength: 128000, family: 'llama' },
  'llama-3.1-70b': { name: 'Llama 3.1 70B', sizeB: 70, architecture: 'dense', contextLength: 128000, family: 'llama' },
  'llama-3.1-8b': { name: 'Llama 3.1 8B', sizeB: 8, architecture: 'dense', contextLength: 128000, family: 'llama' },

  // Mistral
  'mistral-large': { name: 'Mistral Large', sizeB: 123, architecture: 'dense', contextLength: 128000, family: 'mistral' },
  'mistral-small': { name: 'Mistral Small', sizeB: 22, architecture: 'dense', contextLength: 32000, family: 'mistral' },
  'mixtral-8x22b': { name: 'Mixtral 8x22B', sizeB: 176, architecture: 'moe', activeParamsB: 44, contextLength: 64000, family: 'mistral' },
  'mixtral-8x7b': { name: 'Mixtral 8x7B', sizeB: 56, architecture: 'moe', activeParamsB: 14, contextLength: 32000, family: 'mistral' },
  'mistral-7b': { name: 'Mistral 7B', sizeB: 7, architecture: 'dense', contextLength: 32000, family: 'mistral' },

  // DeepSeek
  'deepseek-v3': { name: 'DeepSeek V3', sizeB: 671, architecture: 'moe', activeParamsB: 37, contextLength: 128000, family: 'deepseek' },
  'deepseek-r1': { name: 'DeepSeek R1', sizeB: 671, architecture: 'moe', activeParamsB: 37, contextLength: 128000, family: 'deepseek' },
  'deepseek-coder': { name: 'DeepSeek Coder', sizeB: 33, architecture: 'dense', contextLength: 16000, family: 'deepseek' },

  // Qwen
  'qwen-2.5-72b': { name: 'Qwen 2.5 72B', sizeB: 72, architecture: 'dense', contextLength: 128000, family: 'qwen' },
  'qwen-2.5-32b': { name: 'Qwen 2.5 32B', sizeB: 32, architecture: 'dense', contextLength: 128000, family: 'qwen' },
  'qwen-2.5-7b': { name: 'Qwen 2.5 7B', sizeB: 7, architecture: 'dense', contextLength: 128000, family: 'qwen' },

  // Google
  'gemini-1.5-pro': { name: 'Gemini 1.5 Pro', sizeB: 200, architecture: 'moe', activeParamsB: 50, contextLength: 2000000, family: 'gemini' },
  'gemini-1.5-flash': { name: 'Gemini 1.5 Flash', sizeB: 50, architecture: 'moe', activeParamsB: 15, contextLength: 1000000, family: 'gemini' },
  'gemma-2-27b': { name: 'Gemma 2 27B', sizeB: 27, architecture: 'dense', contextLength: 8000, family: 'gemma' },
  'gemma-2-9b': { name: 'Gemma 2 9B', sizeB: 9, architecture: 'dense', contextLength: 8000, family: 'gemma' },

  // Cohere
  'command-r-plus': { name: 'Command R+', sizeB: 104, architecture: 'dense', contextLength: 128000, family: 'cohere' },
  'command-r': { name: 'Command R', sizeB: 35, architecture: 'dense', contextLength: 128000, family: 'cohere' },
};

// =============================================================================
// BENCHMARK DATA (from InferenceMAX, vLLM, public sources)
// =============================================================================

/**
 * Known throughput benchmarks
 * Format: { [modelKey]: { [gpuKey]: { throughput, latency, source } } }
 */
export const BENCHMARK_DATA: Record<string, Record<string, { throughput: number; latency: number; batchSize: number; source: string }>> = {
  // Llama 3 family - InferenceMAX + vLLM benchmarks
  'llama-3-70b': {
    'H100-SXM': { throughput: 155, latency: 48, batchSize: 16, source: 'inferencemax' },
    'H200': { throughput: 190, latency: 55, batchSize: 24, source: 'inferencemax' },
    'A100-80GB': { throughput: 82, latency: 36, batchSize: 8, source: 'vllm_benchmarks' },
    'MI300X': { throughput: 145, latency: 42, batchSize: 16, source: 'inferencemax' },
    'A100-40GB': { throughput: 60, latency: 30, batchSize: 4, source: 'estimated' },
    'L40S': { throughput: 55, latency: 30, batchSize: 4, source: 'estimated' },
  },
  'llama-3-8b': {
    'H100-SXM': { throughput: 480, latency: 125, batchSize: 64, source: 'inferencemax' },
    'H200': { throughput: 550, latency: 140, batchSize: 80, source: 'inferencemax' },
    'A100-80GB': { throughput: 290, latency: 95, batchSize: 32, source: 'vllm_benchmarks' },
    'MI300X': { throughput: 420, latency: 110, batchSize: 56, source: 'inferencemax' },
    'A100-40GB': { throughput: 220, latency: 80, batchSize: 24, source: 'vllm_benchmarks' },
    'A10G': { throughput: 125, latency: 62, batchSize: 8, source: 'vllm_benchmarks' },
    'L4': { throughput: 85, latency: 48, batchSize: 4, source: 'vllm_benchmarks' },
    'T4': { throughput: 42, latency: 26, batchSize: 2, source: 'estimated' },
  },
  'llama-3.1-70b': {
    'H100-SXM': { throughput: 160, latency: 50, batchSize: 16, source: 'inferencemax' },
    'H200': { throughput: 195, latency: 58, batchSize: 24, source: 'inferencemax' },
    'A100-80GB': { throughput: 85, latency: 38, batchSize: 8, source: 'vllm_benchmarks' },
    'MI300X': { throughput: 150, latency: 45, batchSize: 16, source: 'inferencemax' },
  },
  'llama-3.1-8b': {
    'H100-SXM': { throughput: 490, latency: 128, batchSize: 64, source: 'inferencemax' },
    'A100-80GB': { throughput: 295, latency: 98, batchSize: 32, source: 'vllm_benchmarks' },
    'MI300X': { throughput: 430, latency: 115, batchSize: 56, source: 'inferencemax' },
  },
  'llama-3.1-405b': {
    'H100-SXM': { throughput: 38, latency: 16, batchSize: 4, source: 'inferencemax' }, // 8x H100
    'H200': { throughput: 48, latency: 20, batchSize: 6, source: 'inferencemax' }, // 8x H200
    'MI300X': { throughput: 42, latency: 18, batchSize: 4, source: 'inferencemax' }, // 8x MI300X
  },
  // Mistral family
  'mistral-7b': {
    'H100-SXM': { throughput: 520, latency: 135, batchSize: 64, source: 'inferencemax' },
    'H200': { throughput: 600, latency: 155, batchSize: 80, source: 'inferencemax' },
    'A100-80GB': { throughput: 310, latency: 105, batchSize: 32, source: 'vllm_benchmarks' },
    'MI300X': { throughput: 480, latency: 125, batchSize: 56, source: 'inferencemax' },
    'A10G': { throughput: 135, latency: 68, batchSize: 8, source: 'vllm_benchmarks' },
    'L4': { throughput: 95, latency: 52, batchSize: 4, source: 'vllm_benchmarks' },
    'T4': { throughput: 48, latency: 30, batchSize: 2, source: 'estimated' },
    'RTX-4090': { throughput: 160, latency: 85, batchSize: 8, source: 'vllm_benchmarks' },
  },
  'mixtral-8x7b': {
    'H100-SXM': { throughput: 190, latency: 58, batchSize: 16, source: 'inferencemax' },
    'H200': { throughput: 230, latency: 70, batchSize: 24, source: 'inferencemax' },
    'A100-80GB': { throughput: 105, latency: 42, batchSize: 8, source: 'vllm_benchmarks' },
    'MI300X': { throughput: 175, latency: 52, batchSize: 16, source: 'inferencemax' },
  },
  'mixtral-8x22b': {
    'H100-SXM': { throughput: 85, latency: 28, batchSize: 8, source: 'inferencemax' },
    'H200': { throughput: 105, latency: 35, batchSize: 12, source: 'inferencemax' },
    'MI300X': { throughput: 78, latency: 26, batchSize: 8, source: 'inferencemax' },
  },
  // Qwen family
  'qwen-2.5-72b': {
    'H100-SXM': { throughput: 148, latency: 44, batchSize: 16, source: 'inferencemax' },
    'H200': { throughput: 180, latency: 54, batchSize: 24, source: 'inferencemax' },
    'A100-80GB': { throughput: 78, latency: 34, batchSize: 8, source: 'vllm_benchmarks' },
    'MI300X': { throughput: 138, latency: 40, batchSize: 16, source: 'inferencemax' },
  },
  'qwen-2.5-32b': {
    'H100-SXM': { throughput: 280, latency: 75, batchSize: 32, source: 'inferencemax' },
    'A100-80GB': { throughput: 150, latency: 55, batchSize: 16, source: 'vllm_benchmarks' },
    'MI300X': { throughput: 260, latency: 70, batchSize: 28, source: 'inferencemax' },
  },
  'qwen-2.5-7b': {
    'H100-SXM': { throughput: 510, latency: 130, batchSize: 64, source: 'inferencemax' },
    'A100-80GB': { throughput: 305, latency: 100, batchSize: 32, source: 'vllm_benchmarks' },
    'MI300X': { throughput: 470, latency: 120, batchSize: 56, source: 'inferencemax' },
  },
  // DeepSeek - MoE models
  'deepseek-v3': {
    'H100-SXM': { throughput: 210, latency: 65, batchSize: 16, source: 'inferencemax' }, // MoE efficiency
    'H200': { throughput: 260, latency: 78, batchSize: 24, source: 'inferencemax' },
    'MI300X': { throughput: 195, latency: 60, batchSize: 16, source: 'inferencemax' },
  },
  'deepseek-r1': {
    'H100-SXM': { throughput: 205, latency: 62, batchSize: 16, source: 'inferencemax' },
    'H200': { throughput: 255, latency: 75, batchSize: 24, source: 'inferencemax' },
    'MI300X': { throughput: 190, latency: 58, batchSize: 16, source: 'inferencemax' },
  },
  // Gemma 2
  'gemma-2-27b': {
    'H100-SXM': { throughput: 320, latency: 85, batchSize: 32, source: 'inferencemax' },
    'A100-80GB': { throughput: 175, latency: 60, batchSize: 16, source: 'vllm_benchmarks' },
    'MI300X': { throughput: 295, latency: 78, batchSize: 28, source: 'inferencemax' },
  },
  'gemma-2-9b': {
    'H100-SXM': { throughput: 460, latency: 120, batchSize: 64, source: 'inferencemax' },
    'A100-80GB': { throughput: 275, latency: 90, batchSize: 32, source: 'vllm_benchmarks' },
    'MI300X': { throughput: 420, latency: 108, batchSize: 56, source: 'inferencemax' },
  },
};

// =============================================================================
// ESTIMATION ENGINE
// =============================================================================

/**
 * Get model profile by name (fuzzy matching)
 */
export function getModelProfile(modelName: string): ModelProfile | null {
  const normalized = modelName.toLowerCase().replace(/[^a-z0-9.-]/g, '');

  // Direct match
  for (const [key, profile] of Object.entries(MODEL_PROFILES)) {
    if (key === normalized || profile.name.toLowerCase().replace(/[^a-z0-9.-]/g, '') === normalized) {
      return profile;
    }
  }

  // Fuzzy match
  for (const [key, profile] of Object.entries(MODEL_PROFILES)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return profile;
    }
  }

  return null;
}

/**
 * Estimate model size from name (when not in profile database)
 */
function estimateModelSize(modelName: string): number {
  const patterns: Array<[RegExp, number]> = [
    [/405b/i, 405],
    [/175b/i, 175],
    [/130b/i, 130],
    [/70b/i, 70],
    [/65b/i, 65],
    [/34b/i, 34],
    [/32b/i, 32],
    [/27b/i, 27],
    [/20b/i, 20],
    [/13b/i, 13],
    [/8b/i, 8],
    [/7b/i, 7],
    [/3b/i, 3],
    [/1b/i, 1],
  ];

  for (const [pattern, size] of patterns) {
    if (pattern.test(modelName)) {
      return size;
    }
  }

  // Default to 7B for unknown models
  return 7;
}

/**
 * Estimate throughput based on model size and GPU
 * Uses empirical scaling laws
 */
function estimateThroughputFromSize(
  modelSizeB: number,
  gpu: GPUPricingEntry,
  precision: 'fp32' | 'fp16' | 'fp8' | 'int8' | 'int4' = 'fp16'
): { throughput: number; latency: number; batchSize: number } {
  // Base throughput for 7B model on A100 at FP16
  const baseThroughput7B_A100 = 300; // tok/s

  // Memory bandwidth scaling factor
  const bandwidthScale = gpu.specs.bandwidthGBps / 2039; // A100 baseline

  // Model size scaling (roughly inverse linear for memory-bound inference)
  const sizeScale = 7 / modelSizeB;

  // Precision scaling
  const precisionScale: Record<string, number> = {
    fp32: 0.5,
    fp16: 1.0,
    fp8: 1.5,
    int8: 1.8,
    int4: 2.5,
  };

  const throughput = Math.round(
    baseThroughput7B_A100 * bandwidthScale * sizeScale * precisionScale[precision]
  );

  // Estimate batch size based on GPU memory
  const memoryPerToken = (modelSizeB * 2) / 1000; // GB per 1K context at FP16
  const availableMemory = gpu.specs.memory * 0.8; // 80% usable
  const batchSize = Math.max(1, Math.floor(availableMemory / (memoryPerToken * 4))); // 4K context assumption

  // Per-user latency (throughput / batch)
  const latency = Math.round(throughput / Math.max(1, batchSize / 2));

  return { throughput: Math.max(5, throughput), latency: Math.max(5, latency), batchSize };
}

/**
 * Main function: Estimate throughput for model + GPU combination
 */
export function estimateThroughput(
  model: string,
  gpu: string,
  precision: 'fp32' | 'fp16' | 'fp8' | 'int8' | 'int4' = 'fp16'
): ThroughputEstimate | null {
  // Get GPU pricing info
  const gpuPricing = getGPUPricing(gpu);
  if (!gpuPricing) {
    return null;
  }

  // Get or estimate model profile
  const profile = getModelProfile(model);
  const modelSizeB = profile?.sizeB || estimateModelSize(model);
  const modelKey = profile ? Object.keys(MODEL_PROFILES).find(k => MODEL_PROFILES[k] === profile) || model : model;

  // Check benchmark data first (before memory check - benchmarks may assume multi-GPU)
  const benchmarkForModel = BENCHMARK_DATA[modelKey];
  const benchmarkForGPU = benchmarkForModel?.[gpuPricing.gpu];

  // Memory check - skip if we have actual benchmark data (benchmark implies it works)
  if (!benchmarkForGPU) {
    const memoryRequired = modelSizeB * (precision === 'fp16' ? 2 : precision === 'fp8' || precision === 'int8' ? 1 : 0.5);
    if (memoryRequired > gpuPricing.specs.memory * 0.9) {
      return null; // Model doesn't fit
    }
  }

  let throughput: number;
  let latency: number;
  let batchSize: number;
  let source: 'inferencemax' | 'vllm_benchmarks' | 'estimated';
  let confidence: number;

  if (benchmarkForGPU) {
    throughput = benchmarkForGPU.throughput;
    latency = benchmarkForGPU.latency;
    batchSize = benchmarkForGPU.batchSize;
    source = benchmarkForGPU.source as any;
    confidence = source === 'inferencemax' ? 0.95 : source === 'vllm_benchmarks' ? 0.85 : 0.6;
  } else {
    // Estimate from model size
    const estimate = estimateThroughputFromSize(modelSizeB, gpuPricing, precision);
    throughput = estimate.throughput;
    latency = estimate.latency;
    batchSize = estimate.batchSize;
    source = 'estimated';
    confidence = 0.4;
  }

  // Calculate TTFT (rough estimate: 10-50ms depending on model size)
  const ttftMs = Math.round(50 + (modelSizeB / 10) * 10);

  return {
    model: profile?.name || model,
    modelSizeB,
    gpu: gpuPricing.gpu,
    gpuCount: 1,
    precision,
    throughputTokPerSec: throughput,
    latencyTokPerSecUser: latency,
    ttftMs,
    optimalBatchSize: batchSize,
    source,
    confidence,
    notes: confidence < 0.7 ? 'Estimated based on model size and GPU specs. Actual performance may vary.' : undefined,
  };
}

/**
 * Get throughput estimates for a model across all suitable GPUs
 */
export function getThroughputAcrossGPUs(
  model: string,
  precision: 'fp32' | 'fp16' | 'fp8' | 'int8' | 'int4' = 'fp16'
): ThroughputEstimate[] {
  const estimates: ThroughputEstimate[] = [];

  for (const gpuKey of Object.keys(GPU_PRICING)) {
    const estimate = estimateThroughput(model, gpuKey, precision);
    if (estimate) {
      estimates.push(estimate);
    }
  }

  // Sort by throughput descending
  return estimates.sort((a, b) => b.throughputTokPerSec - a.throughputTokPerSec);
}

/**
 * Calculate tokens per dollar for self-hosted inference
 */
export function calculateTokensPerDollar(
  throughputTokPerSec: number,
  gpuHourlyRate: number
): number {
  const tokensPerHour = throughputTokPerSec * 3600;
  return tokensPerHour / gpuHourlyRate;
}
