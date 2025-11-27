/**
 * PeakInfer Recommendation Engine
 *
 * Analyzes detected LLM callsites and recommends optimizations
 * based on real benchmark data across deployment tiers:
 *
 * TIER 1: Closed APIs (OpenAI, Anthropic)
 * TIER 2: OS Hosted (Groq, Fireworks)
 * TIER 3: Bare Metal (Modal, RunPod + vLLM/TensorRT)
 * TIER 4: Hardware Accelerators (Cerebras, Groq LPU)
 */

import type { ClassifiedCallsite, PricingSummary, ModelPricing, InferencePatterns, DetectedRisk, RiskAssessment, RiskSeverity } from './types.js';

// =============================================================================
// BENCHMARK DATA (from live comparison runs)
// =============================================================================

interface ProviderBenchmark {
  tier: 1 | 2 | 3 | 4;
  tierName: string;
  provider: string;
  model: string;
  displayName: string;
  hardware?: string;
  servingStack?: string;
  inputPer1M: number;
  outputPer1M: number;
  avgLatencyMs: number;
  tokensPerSecond: number;
}

/** Real benchmark data from our comparison runs */
const PROVIDER_BENCHMARKS: ProviderBenchmark[] = [
  // TIER 1: Closed/Hosted APIs
  {
    tier: 1,
    tierName: 'Closed API',
    provider: 'openai',
    model: 'gpt-4o',
    displayName: 'OpenAI GPT-4o',
    inputPer1M: 2.50,
    outputPer1M: 10.00,
    avgLatencyMs: 5500,
    tokensPerSecond: 70,
  },
  {
    tier: 1,
    tierName: 'Closed API',
    provider: 'openai',
    model: 'gpt-4o-mini',
    displayName: 'OpenAI GPT-4o-mini',
    inputPer1M: 0.15,
    outputPer1M: 0.60,
    avgLatencyMs: 6800,
    tokensPerSecond: 45,
  },
  {
    tier: 1,
    tierName: 'Closed API',
    provider: 'anthropic',
    model: 'claude-3-5-sonnet',
    displayName: 'Anthropic Claude Sonnet',
    inputPer1M: 3.00,
    outputPer1M: 15.00,
    avgLatencyMs: 7000,
    tokensPerSecond: 30,
  },
  {
    tier: 1,
    tierName: 'Closed API',
    provider: 'anthropic',
    model: 'claude-3-haiku',
    displayName: 'Anthropic Claude Haiku',
    inputPer1M: 0.25,
    outputPer1M: 1.25,
    avgLatencyMs: 2000,
    tokensPerSecond: 100,
  },

  // TIER 2: Open Source Hosted
  {
    tier: 2,
    tierName: 'OS Hosted',
    provider: 'groq',
    model: 'llama-3.3-70b',
    displayName: 'Groq Llama-70B',
    hardware: 'Groq LPU',
    servingStack: 'Groq Runtime',
    inputPer1M: 0.59,
    outputPer1M: 0.79,
    avgLatencyMs: 1500,
    tokensPerSecond: 200,
  },
  {
    tier: 2,
    tierName: 'OS Hosted',
    provider: 'groq',
    model: 'llama-3.1-8b',
    displayName: 'Groq Llama-8B',
    hardware: 'Groq LPU',
    servingStack: 'Groq Runtime',
    inputPer1M: 0.05,
    outputPer1M: 0.08,
    avgLatencyMs: 900,
    tokensPerSecond: 400,
  },
  {
    tier: 2,
    tierName: 'OS Hosted',
    provider: 'fireworks',
    model: 'llama-3.1-70b',
    displayName: 'Fireworks Llama-70B',
    hardware: 'NVIDIA H100',
    servingStack: 'vLLM',
    inputPer1M: 0.90,
    outputPer1M: 0.90,
    avgLatencyMs: 2000,
    tokensPerSecond: 150,
  },

  // TIER 3: Bare Metal Self-Hosted
  // Note: Self-hosted has GPU hourly costs, not per-token. These are ESTIMATED
  // equivalent per-token costs based on typical utilization (~50% GPU utilization)
  // H100: ~$3.50/hr, 125 tok/s = ~450K tok/hr => ~$0.78/1M at 100% util, ~$1.50/1M at 50%
  // A10G: ~$1.10/hr, 250 tok/s = ~900K tok/hr => ~$0.12/1M at 100% util, ~$0.25/1M at 50%
  {
    tier: 3,
    tierName: 'Self-Hosted',
    provider: 'modal',
    model: 'llama-3.1-70b-vllm',
    displayName: 'Modal H100 + vLLM',
    hardware: 'NVIDIA H100',
    servingStack: 'vLLM',
    inputPer1M: 0.70,   // Estimated at ~50% GPU utilization
    outputPer1M: 0.90,  // Output slightly more expensive
    avgLatencyMs: 1700,
    tokensPerSecond: 125,
  },
  {
    tier: 3,
    tierName: 'Self-Hosted',
    provider: 'modal',
    model: 'llama-3.1-8b-vllm',
    displayName: 'Modal A10G + vLLM',
    hardware: 'NVIDIA A10G',
    servingStack: 'vLLM',
    inputPer1M: 0.12,   // Estimated at ~50% GPU utilization
    outputPer1M: 0.18,  // Output slightly more expensive
    avgLatencyMs: 900,
    tokensPerSecond: 250,
  },

  // TIER 4: Hardware Accelerators
  {
    tier: 4,
    tierName: 'Hardware Accel',
    provider: 'cerebras',
    model: 'llama-3.3-70b',
    displayName: 'Cerebras WSE-3 Llama-70B',
    hardware: 'Cerebras WSE-3',
    servingStack: 'Cerebras Inference',
    inputPer1M: 0.60,
    outputPer1M: 0.60,
    avgLatencyMs: 900,
    tokensPerSecond: 400,
  },
  {
    tier: 4,
    tierName: 'Hardware Accel',
    provider: 'cerebras',
    model: 'llama-3.1-8b',
    displayName: 'Cerebras WSE-3 Llama-8B',
    hardware: 'Cerebras WSE-3',
    servingStack: 'Cerebras Inference',
    inputPer1M: 0.10,
    outputPer1M: 0.10,
    avgLatencyMs: 600,
    tokensPerSecond: 450,
  },
];

// =============================================================================
// RECOMMENDATION TYPES
// =============================================================================

export interface Recommendation {
  callsiteId: string;
  file: string;
  line: number;
  currentProvider: string;
  currentModel: string | null;
  currentTier: number;
  currentMonthlyCost: number;

  recommendedProvider: string;
  recommendedModel: string;
  recommendedTier: number;
  recommendedMonthlyCost: number;
  recommendedHardware?: string;
  recommendedStack?: string;

  monthlySavings: number;
  savingsPercent: number;
  latencyChange: string;  // "faster", "similar", "slower"

  reasoning: string;
  migrationComplexity: 'low' | 'medium' | 'high';
  codeChange: string;  // Example code change
}

export interface RecommendationSummary {
  totalCallsites: number;
  callsitesWithRecommendations: number;
  totalCurrentMonthlyCost: number;
  totalRecommendedMonthlyCost: number;
  totalMonthlySavings: number;
  savingsPercent: number;

  byTier: {
    tier: number;
    name: string;
    count: number;
    currentCost: number;
    recommendedCost: number;
    savings: number;
  }[];

  recommendations: Recommendation[];
  migrationPath: MigrationStep[];
}

export interface MigrationStep {
  step: number;
  description: string;
  affectedFiles: string[];
  callsiteCount: number;
  savings: number;
  complexity: 'low' | 'medium' | 'high';
}

// =============================================================================
// WORKLOAD ESTIMATION
// =============================================================================

interface EstimatedWorkload {
  requestsPerDay: number;
  avgInputTokens: number;
  avgOutputTokens: number;
}

/**
 * Estimate workload from detected callsite patterns.
 * Uses heuristics based on code context.
 */
function estimateWorkload(callsite: ClassifiedCallsite): EstimatedWorkload {
  // Default medium workload
  let requestsPerDay = 1000;
  let avgInputTokens = 500;
  let avgOutputTokens = 200;

  // Adjust based on task kind
  switch (callsite.taskKind) {
    case 'embedding':
      requestsPerDay = 5000;
      avgInputTokens = 300;
      avgOutputTokens = 0;  // Embeddings don't have output tokens
      break;
    case 'chat':
      requestsPerDay = 2000;
      avgInputTokens = 500;
      avgOutputTokens = 300;
      break;
    case 'completion':
      requestsPerDay = 1000;
      avgInputTokens = 200;
      avgOutputTokens = 500;
      break;
    case 'image':
      requestsPerDay = 100;
      avgInputTokens = 100;
      avgOutputTokens = 0;
      break;
  }

  // Adjust based on framework (orchestration frameworks tend to have more calls)
  if (callsite.framework === 'langchain' || callsite.framework === 'llamaindex') {
    requestsPerDay *= 1.5;
    avgInputTokens *= 1.2;  // RAG adds context
  }

  return { requestsPerDay, avgInputTokens, avgOutputTokens };
}

// =============================================================================
// COST CALCULATION
// =============================================================================

/**
 * Calculate monthly cost for a provider/model combination.
 */
function calculateMonthlyCost(
  benchmark: ProviderBenchmark,
  workload: EstimatedWorkload
): number {
  const inputTokensPerMonth = workload.requestsPerDay * 30 * workload.avgInputTokens;
  const outputTokensPerMonth = workload.requestsPerDay * 30 * workload.avgOutputTokens;

  return (
    (inputTokensPerMonth / 1_000_000) * benchmark.inputPer1M +
    (outputTokensPerMonth / 1_000_000) * benchmark.outputPer1M
  );
}

// =============================================================================
// RECOMMENDATION ENGINE
// =============================================================================

/**
 * Find the best benchmark for a detected provider/model.
 */
function findCurrentBenchmark(provider: string, model: string | null): ProviderBenchmark | null {
  // Normalize provider name
  const normalizedProvider = provider.toLowerCase();

  // Try exact match first
  let benchmark = PROVIDER_BENCHMARKS.find(
    b => b.provider === normalizedProvider && (model ? b.model.includes(model) : true)
  );

  if (benchmark) return benchmark;

  // Try provider-only match
  benchmark = PROVIDER_BENCHMARKS.find(b => b.provider === normalizedProvider);
  if (benchmark) return benchmark;

  // Default to OpenAI GPT-4o as baseline for unknown providers
  return PROVIDER_BENCHMARKS.find(b => b.provider === 'openai' && b.model === 'gpt-4o') || null;
}

/**
 * Find the best alternative for a given use case.
 */
function findBestAlternative(
  currentBenchmark: ProviderBenchmark,
  workload: EstimatedWorkload,
  prioritize: 'cost' | 'latency' | 'balanced' = 'cost'
): ProviderBenchmark {
  const currentCost = calculateMonthlyCost(currentBenchmark, workload);

  // Filter to cheaper alternatives
  const alternatives = PROVIDER_BENCHMARKS.filter(b => {
    const altCost = calculateMonthlyCost(b, workload);
    return altCost < currentCost * 0.9;  // At least 10% savings
  });

  if (alternatives.length === 0) {
    return currentBenchmark;  // No better option
  }

  // Sort based on priority
  switch (prioritize) {
    case 'cost':
      alternatives.sort((a, b) => calculateMonthlyCost(a, workload) - calculateMonthlyCost(b, workload));
      break;
    case 'latency':
      alternatives.sort((a, b) => a.avgLatencyMs - b.avgLatencyMs);
      break;
    case 'balanced':
      alternatives.sort((a, b) => {
        const costScore = calculateMonthlyCost(a, workload) / calculateMonthlyCost(b, workload);
        const latencyScore = a.avgLatencyMs / b.avgLatencyMs;
        return (costScore * 0.6 + latencyScore * 0.4) - 1;
      });
      break;
  }

  return alternatives[0];
}

/**
 * Generate code change example for migration.
 */
function generateCodeChange(
  currentProvider: string,
  recommendedProvider: string,
  recommendedModel: string
): string {
  const examples: Record<string, string> = {
    'openai→groq': `# Before (OpenAI)
from openai import OpenAI
client = OpenAI()
response = client.chat.completions.create(model="gpt-4o", ...)

# After (Groq - same API!)
from openai import OpenAI
client = OpenAI(
    api_key=os.environ["GROQ_API_KEY"],
    base_url="https://api.groq.com/openai/v1"
)
response = client.chat.completions.create(model="${recommendedModel}", ...)`,

    'openai→cerebras': `# Before (OpenAI)
from openai import OpenAI
client = OpenAI()

# After (Cerebras - OpenAI compatible!)
from openai import OpenAI
client = OpenAI(
    api_key=os.environ["CEREBRAS_API_KEY"],
    base_url="https://api.cerebras.ai/v1"
)
response = client.chat.completions.create(model="${recommendedModel}", ...)`,

    'anthropic→groq': `# Before (Anthropic)
from anthropic import Anthropic
client = Anthropic()
response = client.messages.create(model="claude-3-5-sonnet", ...)

# After (Groq with Llama)
from openai import OpenAI
client = OpenAI(
    api_key=os.environ["GROQ_API_KEY"],
    base_url="https://api.groq.com/openai/v1"
)
response = client.chat.completions.create(model="${recommendedModel}", ...)`,
  };

  const key = `${currentProvider}→${recommendedProvider}`;
  return examples[key] || `# Migrate from ${currentProvider} to ${recommendedProvider}\n# Model: ${recommendedModel}`;
}

/**
 * Generate recommendations for all detected callsites.
 */
export function generateRecommendations(
  callsites: ClassifiedCallsite[],
  prioritize: 'cost' | 'latency' | 'balanced' = 'cost'
): RecommendationSummary {
  const recommendations: Recommendation[] = [];

  for (const callsite of callsites) {
    if (!callsite.provider) continue;

    const workload = estimateWorkload(callsite);
    const currentBenchmark = findCurrentBenchmark(callsite.provider, callsite.model);

    if (!currentBenchmark) continue;

    const currentCost = calculateMonthlyCost(currentBenchmark, workload);
    const bestAlternative = findBestAlternative(currentBenchmark, workload, prioritize);
    const recommendedCost = calculateMonthlyCost(bestAlternative, workload);

    // Only recommend if there are actual savings
    if (recommendedCost >= currentCost * 0.9) continue;

    const savings = currentCost - recommendedCost;
    const savingsPercent = (savings / currentCost) * 100;

    // Determine latency change
    let latencyChange: 'faster' | 'similar' | 'slower';
    const latencyRatio = bestAlternative.avgLatencyMs / currentBenchmark.avgLatencyMs;
    if (latencyRatio < 0.8) latencyChange = 'faster';
    else if (latencyRatio > 1.2) latencyChange = 'slower';
    else latencyChange = 'similar';

    // Determine migration complexity
    let migrationComplexity: 'low' | 'medium' | 'high';
    if (bestAlternative.tier === currentBenchmark.tier) {
      migrationComplexity = 'low';
    } else if (bestAlternative.tier === 3) {
      migrationComplexity = 'high';  // Self-hosted requires infrastructure
    } else {
      migrationComplexity = 'medium';
    }

    recommendations.push({
      callsiteId: callsite.id,
      file: callsite.file,
      line: callsite.line,
      currentProvider: currentBenchmark.provider,
      currentModel: callsite.model,
      currentTier: currentBenchmark.tier,
      currentMonthlyCost: currentCost,

      recommendedProvider: bestAlternative.provider,
      recommendedModel: bestAlternative.model,
      recommendedTier: bestAlternative.tier,
      recommendedMonthlyCost: recommendedCost,
      recommendedHardware: bestAlternative.hardware,
      recommendedStack: bestAlternative.servingStack,

      monthlySavings: savings,
      savingsPercent,
      latencyChange,

      reasoning: `Migrate from ${currentBenchmark.displayName} (Tier ${currentBenchmark.tier}) to ${bestAlternative.displayName} (Tier ${bestAlternative.tier}). ` +
        `${savingsPercent.toFixed(0)}% cost reduction with ${latencyChange} latency.`,
      migrationComplexity,
      codeChange: generateCodeChange(currentBenchmark.provider, bestAlternative.provider, bestAlternative.model),
    });
  }

  // Calculate totals
  const totalCurrentCost = recommendations.reduce((sum, r) => sum + r.currentMonthlyCost, 0);
  const totalRecommendedCost = recommendations.reduce((sum, r) => sum + r.recommendedMonthlyCost, 0);
  const totalSavings = totalCurrentCost - totalRecommendedCost;

  // Group by tier
  const byTier = [1, 2, 3, 4].map(tier => {
    const tierRecs = recommendations.filter(r => r.currentTier === tier);
    return {
      tier,
      name: tierRecs[0]?.currentProvider ? getTierName(tier) : getTierName(tier),
      count: tierRecs.length,
      currentCost: tierRecs.reduce((sum, r) => sum + r.currentMonthlyCost, 0),
      recommendedCost: tierRecs.reduce((sum, r) => sum + r.recommendedMonthlyCost, 0),
      savings: tierRecs.reduce((sum, r) => sum + r.monthlySavings, 0),
    };
  }).filter(t => t.count > 0);

  // Generate migration path
  const migrationPath = generateMigrationPath(recommendations);

  return {
    totalCallsites: callsites.length,
    callsitesWithRecommendations: recommendations.length,
    totalCurrentMonthlyCost: totalCurrentCost,
    totalRecommendedMonthlyCost: totalRecommendedCost,
    totalMonthlySavings: totalSavings,
    savingsPercent: totalCurrentCost > 0 ? (totalSavings / totalCurrentCost) * 100 : 0,
    byTier,
    recommendations,
    migrationPath,
  };
}

function getTierName(tier: number): string {
  const names: Record<number, string> = {
    1: 'Closed APIs',
    2: 'OS Hosted',
    3: 'Self-Hosted',
    4: 'Hardware Accel',
  };
  return names[tier] || 'Unknown';
}

/**
 * Generate a step-by-step migration path.
 */
function generateMigrationPath(recommendations: Recommendation[]): MigrationStep[] {
  const steps: MigrationStep[] = [];

  // Group by complexity
  const byComplexity = {
    low: recommendations.filter(r => r.migrationComplexity === 'low'),
    medium: recommendations.filter(r => r.migrationComplexity === 'medium'),
    high: recommendations.filter(r => r.migrationComplexity === 'high'),
  };

  let stepNum = 1;

  // Step 1: Low complexity (same tier migrations)
  if (byComplexity.low.length > 0) {
    const files = [...new Set(byComplexity.low.map(r => r.file))];
    steps.push({
      step: stepNum++,
      description: 'Quick wins: Switch to cheaper providers (API key change only)',
      affectedFiles: files,
      callsiteCount: byComplexity.low.length,
      savings: byComplexity.low.reduce((sum, r) => sum + r.monthlySavings, 0),
      complexity: 'low',
    });
  }

  // Step 2: Medium complexity (tier migrations)
  if (byComplexity.medium.length > 0) {
    const files = [...new Set(byComplexity.medium.map(r => r.file))];
    steps.push({
      step: stepNum++,
      description: 'Migrate to open source hosted (Groq LPU, Cerebras WSE)',
      affectedFiles: files,
      callsiteCount: byComplexity.medium.length,
      savings: byComplexity.medium.reduce((sum, r) => sum + r.monthlySavings, 0),
      complexity: 'medium',
    });
  }

  // Step 3: High complexity (self-hosted)
  if (byComplexity.high.length > 0) {
    const files = [...new Set(byComplexity.high.map(r => r.file))];
    steps.push({
      step: stepNum++,
      description: 'Deploy self-hosted inference (vLLM on Modal/RunPod) — requires infra setup, GPU reservations',
      affectedFiles: files,
      callsiteCount: byComplexity.high.length,
      savings: byComplexity.high.reduce((sum, r) => sum + r.monthlySavings, 0),
      complexity: 'high',
    });
  }

  return steps;
}

// =============================================================================
// RISK DETECTION (PRD v0.95 Section 15)
// =============================================================================

/**
 * Detect risks based on inference patterns and callsites.
 */
export function detectRisks(
  patterns: InferencePatterns,
  callsites: ClassifiedCallsite[]
): RiskAssessment {
  const risks: DetectedRisk[] = [];
  let riskId = 1;

  // Get unique files with LLM calls
  const filesWithLLM = [...new Set(callsites.map(c => c.file))];

  // Risk 1: No retry logic detected
  if (!patterns.retry.detected && callsites.length > 0) {
    risks.push({
      id: `risk-${riskId++}`,
      severity: 'high',
      category: 'reliability',
      title: 'No retry logic detected',
      description: 'LLM API calls can fail due to rate limits, network issues, or service outages. Without retry logic, your application may fail unexpectedly.',
      affectedFiles: filesWithLLM,
      recommendation: 'Add exponential backoff retry logic using tenacity, backoff, or built-in SDK retry options.',
      effort: 'low',
    });
  }

  // Risk 2: No fallback mechanism
  if (!patterns.fallback.detected && callsites.length > 0) {
    risks.push({
      id: `risk-${riskId++}`,
      severity: 'high',
      category: 'reliability',
      title: 'No fallback mechanism detected',
      description: 'If your primary LLM provider goes down, your entire application fails. No fallback provider or model detected.',
      affectedFiles: filesWithLLM,
      recommendation: 'Implement provider fallback (e.g., OpenAI → Anthropic → local model) or use a gateway like LiteLLM.',
      effort: 'medium',
    });
  }

  // Risk 3: No caching detected
  if (!patterns.caching.detected && callsites.length > 0) {
    risks.push({
      id: `risk-${riskId++}`,
      severity: 'medium',
      category: 'cost',
      title: 'No caching detected',
      description: 'Repeated identical prompts result in unnecessary API costs and increased latency. No caching layer detected.',
      affectedFiles: filesWithLLM,
      recommendation: 'Implement semantic caching (GPTCache, Redis) or use provider prompt caching (Anthropic, OpenAI).',
      effort: 'medium',
    });
  }

  // Risk 4: No guardrails detected
  if (!patterns.guardrails.detected && callsites.length > 0) {
    risks.push({
      id: `risk-${riskId++}`,
      severity: 'medium',
      category: 'security',
      title: 'No guardrails or input validation detected',
      description: 'Without input/output validation, your application is vulnerable to prompt injection, PII leakage, and harmful content.',
      affectedFiles: filesWithLLM,
      recommendation: 'Add guardrails using NeMo Guardrails, Guardrails AI, or custom validation logic.',
      effort: 'medium',
    });
  }

  // Risk 5: Single provider dependency (vendor lock-in)
  const providers = [...new Set(callsites.map(c => c.provider).filter(Boolean))];
  if (providers.length === 1 && callsites.length > 2) {
    risks.push({
      id: `risk-${riskId++}`,
      severity: 'medium',
      category: 'vendor_lock_in',
      title: 'Single provider dependency',
      description: `All ${callsites.length} LLM callsites use ${providers[0]}. This creates vendor lock-in risk and limits optimization options.`,
      affectedFiles: filesWithLLM,
      recommendation: 'Abstract LLM calls behind a unified interface or use a gateway (LiteLLM, Portkey) for provider flexibility.',
      effort: 'medium',
    });
  }

  // Risk 6: No routing/model selection
  if (!patterns.routing.detected && callsites.length > 3) {
    risks.push({
      id: `risk-${riskId++}`,
      severity: 'low',
      category: 'cost',
      title: 'No intelligent routing detected',
      description: 'Using the same model for all requests misses optimization opportunities. Simple queries could use cheaper models.',
      affectedFiles: filesWithLLM,
      recommendation: 'Implement task-based routing: use smaller models for simple tasks, larger models for complex reasoning.',
      effort: 'high',
    });
  }

  // Risk 7: No batching for high-volume scenarios
  if (!patterns.batching.detected && callsites.length > 5) {
    risks.push({
      id: `risk-${riskId++}`,
      severity: 'low',
      category: 'performance',
      title: 'No batching detected',
      description: 'Multiple sequential LLM calls could benefit from batching to improve throughput and reduce latency.',
      affectedFiles: filesWithLLM,
      recommendation: 'Consider batching requests using asyncio.gather, concurrent.futures, or provider batch APIs.',
      effort: 'low',
    });
  }

  // Calculate overall score (0-100, higher is better)
  const severityScores: Record<RiskSeverity, number> = {
    critical: 25,
    high: 15,
    medium: 8,
    low: 3,
    info: 0,
  };

  const totalPenalty = risks.reduce((sum, r) => sum + severityScores[r.severity], 0);
  const overallScore = Math.max(0, 100 - totalPenalty);

  // Summary counts
  const summary = {
    critical: risks.filter(r => r.severity === 'critical').length,
    high: risks.filter(r => r.severity === 'high').length,
    medium: risks.filter(r => r.severity === 'medium').length,
    low: risks.filter(r => r.severity === 'low').length,
  };

  return {
    overallScore,
    risks,
    summary,
  };
}

// =============================================================================
// PATTERN & RISK REPORT GENERATION
// =============================================================================

/**
 * Generate patterns detected report.
 */
export function generatePatternsReport(patterns: InferencePatterns): string {
  const lines: string[] = [];

  lines.push(`
  PATTERNS DETECTED
  ─────────────────────────────────────────────────────────────────`);

  const patternList: Array<{
    name: string;
    key: keyof InferencePatterns;
  }> = [
    { name: 'Retry logic', key: 'retry' },
    { name: 'Batching', key: 'batching' },
    { name: 'Streaming', key: 'streaming' },
    { name: 'Caching', key: 'caching' },
    { name: 'Routing / model selection', key: 'routing' },
    { name: 'Fallback chain', key: 'fallback' },
    { name: 'Guardrails / safety', key: 'guardrails' },
  ];

  for (const p of patternList) {
    const pattern = patterns[p.key];
    const status = pattern.detected ? '[x]' : '[ ]';
    const location = pattern.detected && pattern.instances.length > 0
      ? `${pattern.instances[0].file}:${pattern.instances[0].line}`
      : 'not detected';
    const typeInfo = pattern.detected && pattern.type ? ` (${pattern.type})` : '';

    lines.push(`  ${status} ${p.name.padEnd(26)} ${location}${typeInfo}`);
  }

  return lines.join('\n');
}

/**
 * Generate risk assessment report.
 */
export function generateRiskReport(assessment: RiskAssessment): string {
  const lines: string[] = [];

  lines.push(`
  RISK ASSESSMENT
  ─────────────────────────────────────────────────────────────────
  Health Score: ${assessment.overallScore}/100
  ${assessment.summary.critical} critical, ${assessment.summary.high} high, ${assessment.summary.medium} medium, ${assessment.summary.low} low
`);

  if (assessment.risks.length === 0) {
    lines.push(`  No significant risks detected.`);
  } else {
    for (const risk of assessment.risks) {
      lines.push(`  [${risk.severity.toUpperCase()}] ${risk.title}`);
      lines.push(`    ${risk.description}`);
      lines.push(`    → ${risk.recommendation}`);
      lines.push(`    effort: ${risk.effort}, files: ${risk.affectedFiles.length}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

// =============================================================================
// RECOMMENDATION REPORT GENERATION
// =============================================================================

/**
 * Generate a human-readable report from recommendations.
 */
export function generateReport(summary: RecommendationSummary): string {
  const lines: string[] = [];

  lines.push(`
  COST OPTIMIZATION SUMMARY
  ═══════════════════════════════════════════════════════════════

  Total LLM Callsites:        ${summary.totalCallsites.toString().padStart(5)}
  Callsites to Optimize:      ${summary.callsitesWithRecommendations.toString().padStart(5)}

  Current Monthly Cost:       $${summary.totalCurrentMonthlyCost.toFixed(0).padStart(6)}
  Recommended Monthly Cost:   $${summary.totalRecommendedMonthlyCost.toFixed(0).padStart(6)}
  ─────────────────────────────────────────
  Potential Savings:          $${summary.totalMonthlySavings.toFixed(0).padStart(6)}/mo (${summary.savingsPercent.toFixed(0)}%)`);

  // Migration Path
  if (summary.migrationPath.length > 0) {
    lines.push(`

  MIGRATION PATH
  ─────────────────────────────────────────────────────────────────`);

    for (const step of summary.migrationPath) {
      lines.push(`  ${step.step}. [${step.complexity}] ${step.description}`);
      lines.push(`     files: ${step.affectedFiles.length}, callsites: ${step.callsiteCount}, saves: $${step.savings.toFixed(0)}/mo`);
    }
  }

  // Top Recommendations
  if (summary.recommendations.length > 0) {
    lines.push(`

  TOP RECOMMENDATIONS
  ─────────────────────────────────────────────────────────────────`);

    for (const rec of summary.recommendations.slice(0, 5)) {
      lines.push(`  ${rec.file}:${rec.line}`);
      lines.push(`    ${rec.currentProvider} → ${rec.recommendedProvider} (${rec.recommendedModel})`);
      lines.push(`    saves $${rec.monthlySavings.toFixed(0)}/mo (${rec.savingsPercent.toFixed(0)}%), latency: ${rec.latencyChange}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}
