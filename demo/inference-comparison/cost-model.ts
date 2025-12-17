/**
 * PeakInfer Inference Cost Comparison Model
 *
 * Compares across three key dimensions:
 * 1. COST - $ per 1M tokens, monthly spend
 * 2. LATENCY - Time to first token (TTFT), time per output token (TPOT)
 * 3. THROUGHPUT - Tokens/second, requests/minute capacity
 *
 * Deployment Scenarios:
 * - Hosted APIs (OpenAI, Anthropic)
 * - Alternative APIs (Fireworks AI - Llama, DeepSeek)
 * - Self-Hosted on GPU (Modal - Llama, DeepSeek)
 */

// ============================================================================
// COMPLETE MODEL PROFILES (Cost + Latency + Throughput)
// ============================================================================

export interface ModelProfile {
  provider: string;
  model: string;
  layer: 'application' | 'serving' | 'infrastructure';

  // COST
  inputPer1M: number;    // $ per 1M input tokens
  outputPer1M: number;   // $ per 1M output tokens

  // LATENCY (milliseconds)
  ttft: number;          // Time to first token (ms)
  tpot: number;          // Time per output token (ms) - inverse of speed

  // THROUGHPUT
  tokensPerSecond: number;  // Output tokens/second
  maxConcurrency: number;   // Max concurrent requests
  rateLimit: number;        // Requests per minute

  notes?: string;
}

// ============================================================================
// HOSTED API PROFILES
// ============================================================================

export const HOSTED_API_PROFILES: ModelProfile[] = [
  // OpenAI
  {
    provider: 'openai',
    model: 'gpt-4o',
    layer: 'application',
    inputPer1M: 2.50,
    outputPer1M: 10.00,
    ttft: 300,
    tpot: 20,
    tokensPerSecond: 50,
    maxConcurrency: 500,
    rateLimit: 10000,
  },
  {
    provider: 'openai',
    model: 'gpt-4o-mini',
    layer: 'application',
    inputPer1M: 0.15,
    outputPer1M: 0.60,
    ttft: 200,
    tpot: 15,
    tokensPerSecond: 67,
    maxConcurrency: 1000,
    rateLimit: 30000,
  },

  // Anthropic
  {
    provider: 'anthropic',
    model: 'claude-3-5-sonnet',
    layer: 'application',
    inputPer1M: 3.00,
    outputPer1M: 15.00,
    ttft: 400,
    tpot: 25,
    tokensPerSecond: 40,
    maxConcurrency: 400,
    rateLimit: 4000,
  },
  {
    provider: 'anthropic',
    model: 'claude-3-haiku',
    layer: 'application',
    inputPer1M: 0.25,
    outputPer1M: 1.25,
    ttft: 150,
    tpot: 10,
    tokensPerSecond: 100,
    maxConcurrency: 1000,
    rateLimit: 10000,
  },
];

// ============================================================================
// ALTERNATIVE API PROFILES (Fireworks, Groq)
// ============================================================================

export const ALTERNATIVE_API_PROFILES: ModelProfile[] = [
  // Fireworks AI
  {
    provider: 'fireworks',
    model: 'llama-3.1-70b-instruct',
    layer: 'application',
    inputPer1M: 0.90,
    outputPer1M: 0.90,
    ttft: 150,
    tpot: 12,
    tokensPerSecond: 83,
    maxConcurrency: 200,
    rateLimit: 6000,
    notes: 'Optimized serving',
  },
  {
    provider: 'fireworks',
    model: 'llama-3.1-8b-instruct',
    layer: 'application',
    inputPer1M: 0.20,
    outputPer1M: 0.20,
    ttft: 80,
    tpot: 5,
    tokensPerSecond: 200,
    maxConcurrency: 500,
    rateLimit: 12000,
  },
  {
    provider: 'fireworks',
    model: 'deepseek-v2.5',
    layer: 'application',
    inputPer1M: 0.90,
    outputPer1M: 0.90,
    ttft: 120,
    tpot: 10,
    tokensPerSecond: 100,
    maxConcurrency: 300,
    rateLimit: 6000,
    notes: 'MoE - very efficient',
  },

  // Groq (LPU - ultra-fast)
  {
    provider: 'groq',
    model: 'llama-3.1-70b',
    layer: 'application',
    inputPer1M: 0.59,
    outputPer1M: 0.79,
    ttft: 50,
    tpot: 3,
    tokensPerSecond: 330,
    maxConcurrency: 100,
    rateLimit: 6000,
    notes: 'Custom LPU - fastest inference',
  },
  {
    provider: 'groq',
    model: 'llama-3.1-8b',
    layer: 'application',
    inputPer1M: 0.05,
    outputPer1M: 0.08,
    ttft: 30,
    tpot: 1.5,
    tokensPerSecond: 670,
    maxConcurrency: 200,
    rateLimit: 14400,
    notes: 'Ultra-fast for small model',
  },
];

// ============================================================================
// SELF-HOSTED GPU PROFILES (Modal)
// ============================================================================

export interface GPUConfig {
  provider: string;
  gpuType: string;
  gpuCount: number;
  hourlyRate: number;
  vram: number;  // GB total
}

export interface SelfHostedProfile extends ModelProfile {
  gpu: GPUConfig;
  utilizationPercent: number;
  setupComplexity: 'low' | 'medium' | 'high';
}

export const SELF_HOSTED_PROFILES: SelfHostedProfile[] = [
  // Modal H100 - Llama 70B
  {
    provider: 'modal',
    model: 'llama-3.1-70b (vLLM)',
    layer: 'infrastructure',
    inputPer1M: 0,  // No per-token cost
    outputPer1M: 0,
    ttft: 100,
    tpot: 8,
    tokensPerSecond: 125,
    maxConcurrency: 32,
    rateLimit: 1920,  // Based on batching
    gpu: { provider: 'modal', gpuType: 'H100', gpuCount: 1, hourlyRate: 3.95, vram: 80 },
    utilizationPercent: 70,
    setupComplexity: 'medium',
    notes: 'vLLM with continuous batching',
  },
  // Modal H100 - Llama 70B (2x for higher throughput)
  {
    provider: 'modal',
    model: 'llama-3.1-70b (vLLM 2x)',
    layer: 'infrastructure',
    inputPer1M: 0,
    outputPer1M: 0,
    ttft: 80,
    tpot: 6,
    tokensPerSecond: 250,
    maxConcurrency: 64,
    rateLimit: 3840,
    gpu: { provider: 'modal', gpuType: 'H100', gpuCount: 2, hourlyRate: 7.90, vram: 160 },
    utilizationPercent: 75,
    setupComplexity: 'high',
    notes: 'Tensor parallel across 2 H100s',
  },
  // Modal A100 - Llama 70B (quantized)
  {
    provider: 'modal',
    model: 'llama-3.1-70b-4bit (vLLM)',
    layer: 'infrastructure',
    inputPer1M: 0,
    outputPer1M: 0,
    ttft: 120,
    tpot: 10,
    tokensPerSecond: 100,
    maxConcurrency: 24,
    rateLimit: 1440,
    gpu: { provider: 'modal', gpuType: 'A100-80GB', gpuCount: 1, hourlyRate: 2.78, vram: 80 },
    utilizationPercent: 65,
    setupComplexity: 'medium',
    notes: '4-bit quantized, AWQ',
  },
  // Modal A10G - Llama 8B
  {
    provider: 'modal',
    model: 'llama-3.1-8b (vLLM)',
    layer: 'infrastructure',
    inputPer1M: 0,
    outputPer1M: 0,
    ttft: 50,
    tpot: 4,
    tokensPerSecond: 250,
    maxConcurrency: 48,
    rateLimit: 2880,
    gpu: { provider: 'modal', gpuType: 'A10G', gpuCount: 1, hourlyRate: 0.53, vram: 24 },
    utilizationPercent: 80,
    setupComplexity: 'low',
    notes: 'Great price/performance for 8B',
  },
  // Modal H100 - DeepSeek V2.5
  {
    provider: 'modal',
    model: 'deepseek-v2.5 (vLLM)',
    layer: 'infrastructure',
    inputPer1M: 0,
    outputPer1M: 0,
    ttft: 80,
    tpot: 6,
    tokensPerSecond: 167,
    maxConcurrency: 40,
    rateLimit: 2400,
    gpu: { provider: 'modal', gpuType: 'H100', gpuCount: 1, hourlyRate: 3.95, vram: 80 },
    utilizationPercent: 75,
    setupComplexity: 'medium',
    notes: 'MoE model - efficient inference',
  },
  // Modal A100 - DeepSeek V2.5
  {
    provider: 'modal',
    model: 'deepseek-v2.5 (vLLM A100)',
    layer: 'infrastructure',
    inputPer1M: 0,
    outputPer1M: 0,
    ttft: 100,
    tpot: 8,
    tokensPerSecond: 125,
    maxConcurrency: 32,
    rateLimit: 1920,
    gpu: { provider: 'modal', gpuType: 'A100-80GB', gpuCount: 1, hourlyRate: 2.78, vram: 80 },
    utilizationPercent: 70,
    setupComplexity: 'medium',
    notes: 'Best value for DeepSeek',
  },
];

// ============================================================================
// WORKLOAD DEFINITION
// ============================================================================

export interface Workload {
  name: string;
  description: string;
  requestsPerDay: number;
  avgInputTokens: number;
  avgOutputTokens: number;
  peakRequestsPerMinute: number;
  hoursPerDay: number;  // Active hours
  qualityRequirement: 'frontier' | 'high' | 'medium';
  latencyRequirement: 'realtime' | 'interactive' | 'batch';
}

export const SAMPLE_WORKLOADS: Workload[] = [
  {
    name: 'Customer Support Chatbot',
    description: 'High-volume customer service with quick responses',
    requestsPerDay: 50000,
    avgInputTokens: 500,
    avgOutputTokens: 200,
    peakRequestsPerMinute: 200,
    hoursPerDay: 16,
    qualityRequirement: 'medium',
    latencyRequirement: 'realtime',
  },
  {
    name: 'Code Assistant',
    description: 'Developer tool for code completion',
    requestsPerDay: 10000,
    avgInputTokens: 1500,
    avgOutputTokens: 800,
    peakRequestsPerMinute: 50,
    hoursPerDay: 10,
    qualityRequirement: 'high',
    latencyRequirement: 'interactive',
  },
  {
    name: 'Document Processing',
    description: 'Batch summarization and extraction',
    requestsPerDay: 5000,
    avgInputTokens: 4000,
    avgOutputTokens: 500,
    peakRequestsPerMinute: 30,
    hoursPerDay: 8,
    qualityRequirement: 'high',
    latencyRequirement: 'batch',
  },
];

// ============================================================================
// COST/LATENCY/THROUGHPUT CALCULATION
// ============================================================================

export interface FullEstimate {
  scenario: string;
  provider: string;
  model: string;
  layer: string;

  // COST METRICS
  cost: {
    perRequest: number;
    per1KRequests: number;
    daily: number;
    monthly: number;
    breakdown: string;
  };

  // LATENCY METRICS
  latency: {
    ttft: number;            // Time to first token (ms)
    totalForAvgRequest: number;  // Total time for average request (ms)
    p50: number;             // Estimated P50
    p99: number;             // Estimated P99
  };

  // THROUGHPUT METRICS
  throughput: {
    tokensPerSecond: number;
    requestsPerMinute: number;
    meetsRequirement: boolean;
    utilizationAtPeak: number;  // % of capacity used at peak
  };

  // OVERALL SCORE
  score: {
    costScore: number;       // 0-100 (lower cost = higher score)
    latencyScore: number;    // 0-100 (lower latency = higher score)
    throughputScore: number; // 0-100 (higher throughput = higher score)
    overall: number;         // Weighted average
  };

  notes?: string;
  feasible: boolean;  // Can handle the workload?
}

export function calculateEstimate(
  workload: Workload,
  profile: ModelProfile | SelfHostedProfile
): FullEstimate {
  const isSelfHosted = 'gpu' in profile;

  // ---- COST CALCULATION ----
  let dailyCost: number;
  let breakdown: string;

  if (isSelfHosted) {
    const sh = profile as SelfHostedProfile;
    const gpuHoursNeeded = workload.hoursPerDay;
    dailyCost = sh.gpu.hourlyRate * sh.gpu.gpuCount * gpuHoursNeeded;
    breakdown = `${sh.gpu.gpuCount}x ${sh.gpu.gpuType} @ $${sh.gpu.hourlyRate}/hr × ${gpuHoursNeeded}hrs`;
  } else {
    const inputTokensDaily = workload.requestsPerDay * workload.avgInputTokens;
    const outputTokensDaily = workload.requestsPerDay * workload.avgOutputTokens;
    const inputCost = (inputTokensDaily / 1_000_000) * profile.inputPer1M;
    const outputCost = (outputTokensDaily / 1_000_000) * profile.outputPer1M;
    dailyCost = inputCost + outputCost;
    breakdown = `Input: $${inputCost.toFixed(2)} + Output: $${outputCost.toFixed(2)}`;
  }

  const perRequest = dailyCost / workload.requestsPerDay;

  // ---- LATENCY CALCULATION ----
  const avgOutputTime = workload.avgOutputTokens * profile.tpot;
  const totalForAvgRequest = profile.ttft + avgOutputTime;

  // ---- THROUGHPUT CALCULATION ----
  const requestsPerMinute = Math.min(
    profile.rateLimit,
    (profile.tokensPerSecond * 60) / workload.avgOutputTokens
  );
  const meetsRequirement = requestsPerMinute >= workload.peakRequestsPerMinute;
  const utilizationAtPeak = (workload.peakRequestsPerMinute / requestsPerMinute) * 100;

  // ---- SCORING ----
  // Cost score: normalize against $0.001 - $0.10 per request range
  const costScore = Math.max(0, Math.min(100, 100 - (perRequest * 1000)));

  // Latency score: normalize against 100ms - 10000ms range
  const latencyScore = Math.max(0, Math.min(100,
    100 - ((totalForAvgRequest - 100) / 99)
  ));

  // Throughput score: based on meeting requirements
  const throughputScore = meetsRequirement
    ? Math.min(100, 50 + (requestsPerMinute / workload.peakRequestsPerMinute) * 25)
    : (requestsPerMinute / workload.peakRequestsPerMinute) * 50;

  // Weighted overall
  const weights = {
    realtime: { cost: 0.2, latency: 0.5, throughput: 0.3 },
    interactive: { cost: 0.4, latency: 0.3, throughput: 0.3 },
    batch: { cost: 0.6, latency: 0.1, throughput: 0.3 },
  };
  const w = weights[workload.latencyRequirement];
  const overall = costScore * w.cost + latencyScore * w.latency + throughputScore * w.throughput;

  return {
    scenario: isSelfHosted ? 'Self-Hosted GPU' : 'Hosted API',
    provider: profile.provider,
    model: profile.model,
    layer: profile.layer,
    cost: {
      perRequest,
      per1KRequests: perRequest * 1000,
      daily: dailyCost,
      monthly: dailyCost * 30,
      breakdown,
    },
    latency: {
      ttft: profile.ttft,
      totalForAvgRequest,
      p50: totalForAvgRequest * 1.1,
      p99: totalForAvgRequest * 2.5,
    },
    throughput: {
      tokensPerSecond: profile.tokensPerSecond,
      requestsPerMinute,
      meetsRequirement,
      utilizationAtPeak: Math.min(100, utilizationAtPeak),
    },
    score: {
      costScore,
      latencyScore,
      throughputScore,
      overall,
    },
    notes: profile.notes,
    feasible: meetsRequirement,
  };
}

// ============================================================================
// COMPARISON REPORT GENERATOR
// ============================================================================

export interface ComparisonReport {
  workload: Workload;
  estimates: FullEstimate[];
  rankings: {
    byCost: FullEstimate[];
    byLatency: FullEstimate[];
    byThroughput: FullEstimate[];
    byOverall: FullEstimate[];
  };
  recommendation: {
    best: FullEstimate;
    savings: {
      vsOpenAI: { monthly: number; percent: number };
      vsAnthropic: { monthly: number; percent: number };
    };
    tradeoffs: string[];
  };
}

export function generateComparison(workload: Workload): ComparisonReport {
  const allProfiles = [
    ...HOSTED_API_PROFILES,
    ...ALTERNATIVE_API_PROFILES,
    ...SELF_HOSTED_PROFILES,
  ];

  const estimates = allProfiles.map(p => calculateEstimate(workload, p));

  // Filter to feasible options only
  const feasible = estimates.filter(e => e.feasible);

  // Rankings
  const byCost = [...feasible].sort((a, b) => a.cost.monthly - b.cost.monthly);
  const byLatency = [...feasible].sort((a, b) => a.latency.totalForAvgRequest - b.latency.totalForAvgRequest);
  const byThroughput = [...feasible].sort((a, b) => b.throughput.tokensPerSecond - a.throughput.tokensPerSecond);
  const byOverall = [...feasible].sort((a, b) => b.score.overall - a.score.overall);

  // Baselines
  const openaiBaseline = estimates.find(e => e.provider === 'openai' && e.model === 'gpt-4o');
  const anthropicBaseline = estimates.find(e => e.provider === 'anthropic' && e.model === 'claude-3-5-sonnet');
  const best = byOverall[0];

  // Tradeoffs
  const tradeoffs: string[] = [];
  if (best.scenario === 'Self-Hosted GPU') {
    tradeoffs.push('Requires DevOps expertise for deployment and maintenance');
    tradeoffs.push('You manage scaling, monitoring, and failover');
    tradeoffs.push('Lower per-token cost but fixed GPU cost regardless of usage');
  } else if (best.provider !== 'openai' && best.provider !== 'anthropic') {
    tradeoffs.push('May have slightly different model behavior vs GPT-4/Claude');
    tradeoffs.push('Evaluate quality on your specific use case');
  }

  return {
    workload,
    estimates,
    rankings: { byCost, byLatency, byThroughput, byOverall },
    recommendation: {
      best,
      savings: {
        vsOpenAI: openaiBaseline ? {
          monthly: openaiBaseline.cost.monthly - best.cost.monthly,
          percent: ((openaiBaseline.cost.monthly - best.cost.monthly) / openaiBaseline.cost.monthly) * 100,
        } : { monthly: 0, percent: 0 },
        vsAnthropic: anthropicBaseline ? {
          monthly: anthropicBaseline.cost.monthly - best.cost.monthly,
          percent: ((anthropicBaseline.cost.monthly - best.cost.monthly) / anthropicBaseline.cost.monthly) * 100,
        } : { monthly: 0, percent: 0 },
      },
      tradeoffs,
    },
  };
}

export { };
