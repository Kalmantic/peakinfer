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

import type { ClassifiedCallsite, PricingSummary, ModelPricing } from './types.js';

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
  {
    tier: 3,
    tierName: 'Self-Hosted',
    provider: 'modal',
    model: 'llama-3.1-70b-vllm',
    displayName: 'Modal H100 + vLLM',
    hardware: 'NVIDIA H100',
    servingStack: 'vLLM',
    inputPer1M: 0,  // GPU hour based
    outputPer1M: 0,
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
    inputPer1M: 0,
    outputPer1M: 0,
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
      description: 'Deploy self-hosted inference (vLLM on Modal/RunPod)',
      affectedFiles: files,
      callsiteCount: byComplexity.high.length,
      savings: byComplexity.high.reduce((sum, r) => sum + r.monthlySavings, 0),
      complexity: 'high',
    });
  }

  return steps;
}

// =============================================================================
// REPORT GENERATION
// =============================================================================

/**
 * Generate a human-readable report from recommendations.
 */
export function generateReport(summary: RecommendationSummary): string {
  const lines: string[] = [];

  lines.push(`
╔══════════════════════════════════════════════════════════════════════════════════════════╗
║                                                                                          ║
║   🏔️  PeakInfer CODEBASE ANALYSIS & RECOMMENDATIONS                                      ║
║                                                                                          ║
╠══════════════════════════════════════════════════════════════════════════════════════════╣
║                                                                                          ║
║   📊 SUMMARY                                                                             ║
║   ──────────────────────────────────────────────────────────────────────────────────     ║
║   Total LLM Callsites Found:     ${summary.totalCallsites.toString().padStart(5)}                                             ║
║   Callsites with Optimization:   ${summary.callsitesWithRecommendations.toString().padStart(5)}                                             ║
║                                                                                          ║
║   Current Monthly Cost:          $${summary.totalCurrentMonthlyCost.toFixed(0).padStart(6)}                                           ║
║   Recommended Monthly Cost:      $${summary.totalRecommendedMonthlyCost.toFixed(0).padStart(6)}                                           ║
║   ─────────────────────────────────────────                                              ║
║   💰 POTENTIAL SAVINGS:          $${summary.totalMonthlySavings.toFixed(0).padStart(6)}/mo (${summary.savingsPercent.toFixed(0)}%)                              ║
║                                                                                          ║
╚══════════════════════════════════════════════════════════════════════════════════════════╝`);

  // Migration Path
  if (summary.migrationPath.length > 0) {
    lines.push(`
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│  🗺️  RECOMMENDED MIGRATION PATH                                                          │
├──────────────────────────────────────────────────────────────────────────────────────────┤`);

    for (const step of summary.migrationPath) {
      const complexityIcon = step.complexity === 'low' ? '🟢' : step.complexity === 'medium' ? '🟡' : '🔴';
      lines.push(`│  ${step.step}. ${complexityIcon} ${step.description.padEnd(60)} │
│     Files: ${step.affectedFiles.length}, Callsites: ${step.callsiteCount}, Savings: $${step.savings.toFixed(0)}/mo                              │`);
    }

    lines.push(`└──────────────────────────────────────────────────────────────────────────────────────────┘`);
  }

  // Top Recommendations
  if (summary.recommendations.length > 0) {
    lines.push(`
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│  🎯 TOP RECOMMENDATIONS                                                                  │
├──────────────────────────────────────────────────────────────────────────────────────────┤`);

    for (const rec of summary.recommendations.slice(0, 5)) {
      lines.push(`│  ${rec.file}:${rec.line}                                                               │
│    ${rec.currentProvider} → ${rec.recommendedProvider} (${rec.recommendedModel})                     │
│    Savings: $${rec.monthlySavings.toFixed(0)}/mo (${rec.savingsPercent.toFixed(0)}%), Latency: ${rec.latencyChange}                              │
│                                                                                          │`);
    }

    lines.push(`└──────────────────────────────────────────────────────────────────────────────────────────┘`);
  }

  return lines.join('\n');
}
