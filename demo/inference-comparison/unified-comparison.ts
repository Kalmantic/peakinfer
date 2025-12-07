#!/usr/bin/env npx tsx
/**
 * PeakInfer Unified Inference Comparison
 *
 * Compares the SAME workload across ALL deployment tiers:
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │  TIER 1: CLOSED/HOSTED APIs                                                 │
 * │  └─ OpenAI (GPT-4o), Anthropic (Claude)                                     │
 * │     Premium quality, highest cost, managed infrastructure                   │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │  TIER 2: OPEN SOURCE HOSTED INFERENCE                                       │
 * │  └─ Fireworks AI, Groq, Baseten (Llama, DeepSeek, Mistral)                  │
 * │     Open models, optimized serving, pay-per-token                           │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │  TIER 3: BARE METAL SELF-HOSTED                                             │
 * │  └─ Modal, RunPod, Lambda Labs (vLLM, TensorRT-LLM, SGLang)                 │
 * │     Full control, GPU rental, manage your own serving stack                 │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │  TIER 4: HARDWARE ACCELERATORS                                              │
 * │  └─ Cerebras WSE-3, Groq LPU, NVIDIA H100/A100                              │
 * │     Specialized silicon, different performance characteristics              │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * Metrics: Cost / Latency / Throughput for SAME workload
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

// ============================================================================
// WORKLOAD DEFINITION
// ============================================================================

interface Workload {
  name: string;
  description: string;
  requestsPerDay: number;
  avgInputTokens: number;
  avgOutputTokens: number;
  qualityRequirement: 'frontier' | 'high' | 'medium';
  latencyRequirement: 'realtime' | 'interactive' | 'batch';
}

const ALL_WORKLOADS: Workload[] = [
  {
    name: 'Customer Support Chatbot',
    description: 'High-volume customer service with quick responses',
    requestsPerDay: 50000,
    avgInputTokens: 500,
    avgOutputTokens: 200,
    qualityRequirement: 'medium',
    latencyRequirement: 'realtime',
  },
  {
    name: 'Code Assistant',
    description: 'Developer tool for code completion and generation',
    requestsPerDay: 10000,
    avgInputTokens: 1500,
    avgOutputTokens: 800,
    qualityRequirement: 'high',
    latencyRequirement: 'interactive',
  },
  {
    name: 'Document Processing',
    description: 'Batch summarization and data extraction',
    requestsPerDay: 5000,
    avgInputTokens: 4000,
    avgOutputTokens: 500,
    qualityRequirement: 'high',
    latencyRequirement: 'batch',
  },
];

// Default workload for benchmarking (we'll calculate costs for all)
const WORKLOAD: Workload = ALL_WORKLOADS[0];

// ============================================================================
// PROVIDER CONFIGURATIONS BY TIER
// ============================================================================

interface ProviderConfig {
  tier: 1 | 2 | 3 | 4;
  tierName: string;
  provider: string;
  model: string;
  displayName: string;
  hardware?: string;
  servingStack?: string;
  inputPer1M: number;
  outputPer1M: number;
  hourlyRate?: number;  // For self-hosted
  apiBase?: string;
  apiKeyEnv: string;
  clientType: 'openai' | 'anthropic';
}

const ALL_PROVIDERS: ProviderConfig[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // TIER 1: CLOSED/HOSTED APIs (Premium)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    tier: 1,
    tierName: 'Closed/Hosted API',
    provider: 'openai',
    model: 'gpt-4o',
    displayName: 'OpenAI GPT-4o',
    inputPer1M: 2.50,
    outputPer1M: 10.00,
    apiKeyEnv: 'OPENAI_API_KEY',
    clientType: 'openai',
  },
  {
    tier: 1,
    tierName: 'Closed/Hosted API',
    provider: 'openai',
    model: 'gpt-4o-mini',
    displayName: 'OpenAI GPT-4o-mini',
    inputPer1M: 0.15,
    outputPer1M: 0.60,
    apiKeyEnv: 'OPENAI_API_KEY',
    clientType: 'openai',
  },
  {
    tier: 1,
    tierName: 'Closed/Hosted API',
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    displayName: 'Anthropic Claude Sonnet',
    inputPer1M: 3.00,
    outputPer1M: 15.00,
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    clientType: 'anthropic',
  },
  {
    tier: 1,
    tierName: 'Closed/Hosted API',
    provider: 'anthropic',
    model: 'claude-3-haiku-20240307',
    displayName: 'Anthropic Claude Haiku',
    inputPer1M: 0.25,
    outputPer1M: 1.25,
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    clientType: 'anthropic',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TIER 2: OPEN SOURCE HOSTED INFERENCE
  // ═══════════════════════════════════════════════════════════════════════════
  {
    tier: 2,
    tierName: 'OS Hosted Inference',
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    displayName: 'Groq Llama-70B',
    hardware: 'Groq LPU',
    servingStack: 'Groq Runtime',
    inputPer1M: 0.59,
    outputPer1M: 0.79,
    apiBase: 'https://api.groq.com/openai/v1',
    apiKeyEnv: 'GROQ_API_KEY',
    clientType: 'openai',
  },
  {
    tier: 2,
    tierName: 'OS Hosted Inference',
    provider: 'groq',
    model: 'llama-3.1-8b-instant',
    displayName: 'Groq Llama-8B',
    hardware: 'Groq LPU',
    servingStack: 'Groq Runtime',
    inputPer1M: 0.05,
    outputPer1M: 0.08,
    apiBase: 'https://api.groq.com/openai/v1',
    apiKeyEnv: 'GROQ_API_KEY',
    clientType: 'openai',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TIER 3: BARE METAL SELF-HOSTED (Theoretical - for cost modeling)
  // These use the same APIs but we model the self-hosted cost differently
  // ═══════════════════════════════════════════════════════════════════════════
  // Note: We'll add theoretical estimates for self-hosted since we can't
  // actually deploy to Modal/RunPod in this demo

  // ═══════════════════════════════════════════════════════════════════════════
  // TIER 4: HARDWARE ACCELERATORS (via their cloud APIs)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    tier: 4,
    tierName: 'Hardware Accelerator',
    provider: 'cerebras',
    model: 'llama-3.3-70b',
    displayName: 'Cerebras WSE-3 Llama-70B',
    hardware: 'Cerebras WSE-3',
    servingStack: 'Cerebras Inference',
    inputPer1M: 0.60,
    outputPer1M: 0.60,
    apiBase: 'https://api.cerebras.ai/v1',
    apiKeyEnv: 'CEREBRAS_API_KEY',
    clientType: 'openai',
  },
  {
    tier: 4,
    tierName: 'Hardware Accelerator',
    provider: 'cerebras',
    model: 'llama3.1-8b',
    displayName: 'Cerebras WSE-3 Llama-8B',
    hardware: 'Cerebras WSE-3',
    servingStack: 'Cerebras Inference',
    inputPer1M: 0.10,
    outputPer1M: 0.10,
    apiBase: 'https://api.cerebras.ai/v1',
    apiKeyEnv: 'CEREBRAS_API_KEY',
    clientType: 'openai',
  },
];

// Self-hosted theoretical configs (for cost comparison)
interface SelfHostedConfig {
  tier: 3;
  tierName: string;
  provider: string;
  model: string;
  displayName: string;
  hardware: string;
  servingStack: string;
  hourlyRate: number;
  gpuCount: number;
  tokensPerSecond: number;  // Estimated throughput
}

const SELF_HOSTED_CONFIGS: SelfHostedConfig[] = [
  {
    tier: 3,
    tierName: 'Bare Metal Self-Hosted',
    provider: 'modal',
    model: 'llama-3.1-70b',
    displayName: 'Modal H100 + vLLM Llama-70B',
    hardware: 'NVIDIA H100',
    servingStack: 'vLLM',
    hourlyRate: 3.95,
    gpuCount: 1,
    tokensPerSecond: 125,
  },
  {
    tier: 3,
    tierName: 'Bare Metal Self-Hosted',
    provider: 'modal',
    model: 'llama-3.1-8b',
    displayName: 'Modal A10G + vLLM Llama-8B',
    hardware: 'NVIDIA A10G',
    servingStack: 'vLLM',
    hourlyRate: 0.53,
    gpuCount: 1,
    tokensPerSecond: 250,
  },
  {
    tier: 3,
    tierName: 'Bare Metal Self-Hosted',
    provider: 'runpod',
    model: 'llama-3.1-70b',
    displayName: 'RunPod H100 + TensorRT Llama-70B',
    hardware: 'NVIDIA H100',
    servingStack: 'TensorRT-LLM',
    hourlyRate: 3.49,
    gpuCount: 1,
    tokensPerSecond: 150,
  },
  {
    tier: 3,
    tierName: 'Bare Metal Self-Hosted',
    provider: 'lambda',
    model: 'llama-3.1-70b',
    displayName: 'Lambda H100 + SGLang Llama-70B',
    hardware: 'NVIDIA H100',
    servingStack: 'SGLang',
    hourlyRate: 2.49,
    gpuCount: 1,
    tokensPerSecond: 140,
  },
];

// ============================================================================
// TEST PROMPTS (Same across all providers)
// ============================================================================

const TEST_PROMPTS = [
  {
    name: 'Quick Q&A',
    system: 'You are a helpful customer support agent. Be concise and friendly.',
    user: 'What are your business hours?',
    expectedTokens: 30,
  },
  {
    name: 'Product Info',
    system: 'You are a helpful customer support agent. Provide accurate product information.',
    user: 'Can you tell me about the return policy for electronics? I bought a laptop last week.',
    expectedTokens: 100,
  },
  {
    name: 'Troubleshooting',
    system: 'You are a technical support agent. Help users solve their problems step by step.',
    user: 'My order shows as delivered but I never received it. What should I do?',
    expectedTokens: 150,
  },
];

// ============================================================================
// BENCHMARK RESULT TYPES
// ============================================================================

interface BenchmarkResult {
  tier: number;
  tierName: string;
  provider: string;
  model: string;
  displayName: string;
  hardware?: string;
  servingStack?: string;

  // Metrics
  inputTokens: number;
  outputTokens: number;
  ttft: number;
  totalTime: number;
  tokensPerSecond: number;
  costPerRequest: number;

  // Projections for workload
  monthlyCost: number;

  success: boolean;
  error?: string;
}

// ============================================================================
// API CLIENTS
// ============================================================================

function createClient(config: ProviderConfig): OpenAI | Anthropic | null {
  const apiKey = process.env[config.apiKeyEnv];
  if (!apiKey) return null;

  if (config.clientType === 'anthropic') {
    return new Anthropic({ apiKey });
  }

  return new OpenAI({
    apiKey,
    baseURL: config.apiBase,
  });
}

// ============================================================================
// BENCHMARK FUNCTIONS
// ============================================================================

async function benchmarkProvider(
  config: ProviderConfig,
  prompt: typeof TEST_PROMPTS[0]
): Promise<BenchmarkResult> {
  const client = createClient(config);

  if (!client) {
    return {
      tier: config.tier,
      tierName: config.tierName,
      provider: config.provider,
      model: config.model,
      displayName: config.displayName,
      hardware: config.hardware,
      servingStack: config.servingStack,
      inputTokens: 0,
      outputTokens: 0,
      ttft: 0,
      totalTime: 0,
      tokensPerSecond: 0,
      costPerRequest: 0,
      monthlyCost: 0,
      success: false,
      error: `${config.apiKeyEnv} not set`,
    };
  }

  const startTime = performance.now();
  let ttft = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let content = '';

  try {
    if (config.clientType === 'anthropic') {
      const anthropic = client as Anthropic;
      const stream = anthropic.messages.stream({
        model: config.model,
        max_tokens: 500,
        system: prompt.system,
        messages: [{ role: 'user', content: prompt.user }],
      });

      let firstToken = false;
      stream.on('text', () => {
        if (!firstToken) {
          ttft = performance.now() - startTime;
          firstToken = true;
        }
      });

      const finalMessage = await stream.finalMessage();
      inputTokens = finalMessage.usage.input_tokens;
      outputTokens = finalMessage.usage.output_tokens;
    } else {
      const openai = client as OpenAI;
      const stream = await openai.chat.completions.create({
        model: config.model,
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ],
        stream: true,
        max_tokens: 500,
      });

      let firstToken = false;
      for await (const chunk of stream) {
        if (!firstToken && chunk.choices[0]?.delta?.content) {
          ttft = performance.now() - startTime;
          firstToken = true;
        }
        content += chunk.choices[0]?.delta?.content || '';

        // Try to get usage from stream (OpenAI)
        if ((chunk as any).usage) {
          inputTokens = (chunk as any).usage.prompt_tokens || 0;
          outputTokens = (chunk as any).usage.completion_tokens || 0;
        }
      }

      // Estimate tokens if not provided
      if (inputTokens === 0) {
        inputTokens = Math.ceil((prompt.system.length + prompt.user.length) / 4);
      }
      if (outputTokens === 0) {
        outputTokens = Math.ceil(content.length / 4);
      }
    }

    const totalTime = performance.now() - startTime;
    const tokensPerSecond = outputTokens > 0 ? outputTokens / (totalTime / 1000) : 0;

    const costPerRequest =
      (inputTokens / 1_000_000) * config.inputPer1M +
      (outputTokens / 1_000_000) * config.outputPer1M;

    const monthlyCost = costPerRequest * WORKLOAD.requestsPerDay * 30;

    return {
      tier: config.tier,
      tierName: config.tierName,
      provider: config.provider,
      model: config.model,
      displayName: config.displayName,
      hardware: config.hardware,
      servingStack: config.servingStack,
      inputTokens,
      outputTokens,
      ttft,
      totalTime,
      tokensPerSecond,
      costPerRequest,
      monthlyCost,
      success: true,
    };
  } catch (error) {
    return {
      tier: config.tier,
      tierName: config.tierName,
      provider: config.provider,
      model: config.model,
      displayName: config.displayName,
      hardware: config.hardware,
      servingStack: config.servingStack,
      inputTokens: 0,
      outputTokens: 0,
      ttft: 0,
      totalTime: 0,
      tokensPerSecond: 0,
      costPerRequest: 0,
      monthlyCost: 0,
      success: false,
      error: error instanceof Error ? error.message.substring(0, 50) : String(error),
    };
  }
}

// ============================================================================
// SELF-HOSTED COST CALCULATION (Theoretical)
// ============================================================================

function calculateSelfHostedCost(config: SelfHostedConfig): BenchmarkResult {
  // Calculate based on workload
  const totalOutputTokensPerDay = WORKLOAD.requestsPerDay * WORKLOAD.avgOutputTokens;
  const hoursNeededPerDay = totalOutputTokensPerDay / (config.tokensPerSecond * 3600);
  const dailyCost = hoursNeededPerDay * config.hourlyRate * config.gpuCount;
  const monthlyCost = dailyCost * 30;

  // Estimate latency based on throughput
  const estimatedLatency = (WORKLOAD.avgOutputTokens / config.tokensPerSecond) * 1000;
  const estimatedTTFT = 100; // Typical for vLLM/TensorRT

  return {
    tier: config.tier,
    tierName: config.tierName,
    provider: config.provider,
    model: config.model,
    displayName: config.displayName,
    hardware: config.hardware,
    servingStack: config.servingStack,
    inputTokens: WORKLOAD.avgInputTokens,
    outputTokens: WORKLOAD.avgOutputTokens,
    ttft: estimatedTTFT,
    totalTime: estimatedTTFT + estimatedLatency,
    tokensPerSecond: config.tokensPerSecond,
    costPerRequest: dailyCost / WORKLOAD.requestsPerDay,
    monthlyCost,
    success: true,
  };
}

// ============================================================================
// AGGREGATION
// ============================================================================

interface AggregatedResult {
  tier: number;
  tierName: string;
  provider: string;
  displayName: string;
  hardware?: string;
  servingStack?: string;

  avgTTFT: number;
  avgTotalTime: number;
  avgTokensPerSecond: number;
  monthlyCost: number;

  requests: number;
  success: boolean;
}

function aggregateResults(results: BenchmarkResult[]): AggregatedResult[] {
  const grouped = new Map<string, BenchmarkResult[]>();

  for (const result of results) {
    if (!grouped.has(result.displayName)) grouped.set(result.displayName, []);
    grouped.get(result.displayName)!.push(result);
  }

  const aggregates: AggregatedResult[] = [];

  for (const [displayName, group] of grouped) {
    const successful = group.filter(r => r.success);
    if (successful.length === 0) {
      // Include failed ones too for visibility
      const first = group[0];
      aggregates.push({
        tier: first.tier,
        tierName: first.tierName,
        provider: first.provider,
        displayName: first.displayName,
        hardware: first.hardware,
        servingStack: first.servingStack,
        avgTTFT: 0,
        avgTotalTime: 0,
        avgTokensPerSecond: 0,
        monthlyCost: 0,
        requests: 0,
        success: false,
      });
      continue;
    }

    const first = successful[0];
    aggregates.push({
      tier: first.tier,
      tierName: first.tierName,
      provider: first.provider,
      displayName,
      hardware: first.hardware,
      servingStack: first.servingStack,
      avgTTFT: successful.reduce((sum, r) => sum + r.ttft, 0) / successful.length,
      avgTotalTime: successful.reduce((sum, r) => sum + r.totalTime, 0) / successful.length,
      avgTokensPerSecond: successful.reduce((sum, r) => sum + r.tokensPerSecond, 0) / successful.length,
      monthlyCost: successful[0].monthlyCost,  // Same for all runs
      requests: successful.length,
      success: true,
    });
  }

  return aggregates.sort((a, b) => a.tier - b.tier || a.monthlyCost - b.monthlyCost);
}

// ============================================================================
// COST CALCULATION FOR ALL WORKLOADS
// ============================================================================

interface WorkloadCost {
  workload: Workload;
  provider: string;
  displayName: string;
  tier: number;
  hardware?: string;
  servingStack?: string;
  monthlyCost: number;
  costPerRequest: number;
}

function calculateAllWorkloadCosts(
  aggregates: AggregatedResult[],
  providers: ProviderConfig[],
  selfHosted: SelfHostedConfig[]
): Map<string, WorkloadCost[]> {
  const results = new Map<string, WorkloadCost[]>();

  for (const workload of ALL_WORKLOADS) {
    const costs: WorkloadCost[] = [];

    // API-based providers
    for (const agg of aggregates) {
      if (!agg.success) continue;

      const config = providers.find(p => p.displayName === agg.displayName);
      if (!config) continue;

      const inputTokensDaily = workload.requestsPerDay * workload.avgInputTokens;
      const outputTokensDaily = workload.requestsPerDay * workload.avgOutputTokens;
      const dailyCost =
        (inputTokensDaily / 1_000_000) * config.inputPer1M +
        (outputTokensDaily / 1_000_000) * config.outputPer1M;
      const monthlyCost = dailyCost * 30;

      costs.push({
        workload,
        provider: agg.provider,
        displayName: agg.displayName,
        tier: agg.tier,
        hardware: agg.hardware,
        servingStack: agg.servingStack,
        monthlyCost,
        costPerRequest: dailyCost / workload.requestsPerDay,
      });
    }

    // Self-hosted
    for (const config of selfHosted) {
      const totalOutputTokensPerDay = workload.requestsPerDay * workload.avgOutputTokens;
      const hoursNeededPerDay = totalOutputTokensPerDay / (config.tokensPerSecond * 3600);
      const dailyCost = Math.max(hoursNeededPerDay, 1) * config.hourlyRate * config.gpuCount; // Min 1 hour
      const monthlyCost = dailyCost * 30;

      costs.push({
        workload,
        provider: config.provider,
        displayName: config.displayName,
        tier: config.tier,
        hardware: config.hardware,
        servingStack: config.servingStack,
        monthlyCost,
        costPerRequest: dailyCost / workload.requestsPerDay,
      });
    }

    results.set(workload.name, costs.sort((a, b) => a.monthlyCost - b.monthlyCost));
  }

  return results;
}

// ============================================================================
// REPORTING
// ============================================================================

function printAllWorkloadsComparison(allCosts: Map<string, WorkloadCost[]>) {
  console.log(`
╔══════════════════════════════════════════════════════════════════════════════════════════════════════════╗
║                                                                                                          ║
║   🏔️  PeakInfer MULTI-WORKLOAD COMPARISON                                                                ║
║                                                                                                          ║
║   Comparing costs across ALL workloads and ALL deployment tiers                                          ║
║                                                                                                          ║
╠══════════════════════════════════════════════════════════════════════════════════════════════════════════╣`);

  for (const [workloadName, costs] of allCosts) {
    const workload = ALL_WORKLOADS.find(w => w.name === workloadName)!;
    const tokensPerMonth = workload.requestsPerDay * 30 * (workload.avgInputTokens + workload.avgOutputTokens);

    console.log(`║                                                                                                          ║
║  📋 ${workloadName.padEnd(30)} ${workload.requestsPerDay.toLocaleString().padStart(7)} req/day │ ${(tokensPerMonth/1_000_000).toFixed(0)}M tok/mo          ║
║  ──────────────────────────────────────────────────────────────────────────────────────────────────────── ║
║   Tier │ Provider                              │ Hardware        │ Stack         │ Monthly Cost           ║
║  ──────┼───────────────────────────────────────┼─────────────────┼───────────────┼────────────────────────║`);

    for (const cost of costs.slice(0, 10)) { // Top 10
      const tierIcon = cost.tier === 1 ? '📦' : cost.tier === 2 ? '🚀' : cost.tier === 3 ? '🔧' : '⚡';
      const tier = `${tierIcon} ${cost.tier}`.padEnd(4);
      const name = cost.displayName.substring(0, 35).padEnd(35);
      const hw = (cost.hardware || 'Managed').substring(0, 15).padEnd(15);
      const stack = (cost.servingStack || 'API').substring(0, 13).padEnd(13);
      const costStr = `$${cost.monthlyCost.toFixed(0)}`.padStart(8);

      console.log(`║  ${tier} │ ${name} │ ${hw} │ ${stack} │ ${costStr}               ║`);
    }
  }

  console.log(`║                                                                                                          ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════════════╝`);

  // Summary table
  console.log(`
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  📊 BEST OPTIONS BY WORKLOAD                                                                               │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│   Workload                    │ Best Tier 1 (Closed)    │ Best Tier 2 (OS Host)  │ Best Overall            │
│  ─────────────────────────────┼─────────────────────────┼────────────────────────┼─────────────────────────│`);

  for (const [workloadName, costs] of allCosts) {
    const tier1Best = costs.filter(c => c.tier === 1).sort((a, b) => a.monthlyCost - b.monthlyCost)[0];
    const tier2Best = costs.filter(c => c.tier === 2).sort((a, b) => a.monthlyCost - b.monthlyCost)[0];
    const overallBest = costs[0];

    const wName = workloadName.substring(0, 27).padEnd(27);
    const t1 = tier1Best ? `$${tier1Best.monthlyCost.toFixed(0)}`.padStart(6) : '    --';
    const t2 = tier2Best ? `$${tier2Best.monthlyCost.toFixed(0)}`.padStart(6) : '    --';
    const best = `$${overallBest.monthlyCost.toFixed(0)}`.padStart(6);

    console.log(`│  ${wName} │ ${t1} (${(tier1Best?.displayName || 'N/A').substring(0, 14).padEnd(14)}) │ ${t2} (${(tier2Best?.displayName || 'N/A').substring(0, 12).padEnd(12)}) │ ${best} (${overallBest.displayName.substring(0, 14).padEnd(14)}) │`);
  }

  console.log(`└────────────────────────────────────────────────────────────────────────────────────────────────────────────┘`);

  // Savings summary
  console.log(`
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  💰 POTENTIAL SAVINGS (vs OpenAI GPT-4o)                                                                   │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────┤`);

  for (const [workloadName, costs] of allCosts) {
    const gpt4o = costs.find(c => c.displayName.includes('GPT-4o') && !c.displayName.includes('mini'));
    const best = costs[0];

    if (gpt4o && best) {
      const savings = gpt4o.monthlyCost - best.monthlyCost;
      const pct = (savings / gpt4o.monthlyCost) * 100;
      const wName = workloadName.substring(0, 25).padEnd(25);
      console.log(`│  ${wName} │ $${gpt4o.monthlyCost.toFixed(0).padStart(5)}/mo → $${best.monthlyCost.toFixed(0).padStart(5)}/mo │ Save $${savings.toFixed(0).padStart(5)}/mo (${pct.toFixed(0)}%) │ ${best.displayName.substring(0, 20)} │`);
    }
  }

  console.log(`└────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
`);
}

function printUnifiedComparison(aggregates: AggregatedResult[]) {
  const workloadTokensPerMonth = WORKLOAD.requestsPerDay * 30 * (WORKLOAD.avgInputTokens + WORKLOAD.avgOutputTokens);

  console.log(`
╔══════════════════════════════════════════════════════════════════════════════════════════╗
║                                                                                          ║
║   🏔️  PeakInfer UNIFIED INFERENCE COMPARISON                                             ║
║                                                                                          ║
║   Workload: ${WORKLOAD.name.padEnd(50)}                     ║
║   ${WORKLOAD.requestsPerDay.toLocaleString()} requests/day × ${WORKLOAD.avgInputTokens} input + ${WORKLOAD.avgOutputTokens} output tokens                          ║
║   Monthly volume: ${(workloadTokensPerMonth / 1_000_000).toFixed(1)}M tokens                                                      ║
║                                                                                          ║
╠══════════════════════════════════════════════════════════════════════════════════════════╣`);

  // Group by tier
  const tiers = [1, 2, 3, 4];
  const tierLabels: Record<number, string> = {
    1: '📦 TIER 1: CLOSED/HOSTED APIs (OpenAI, Anthropic)',
    2: '🚀 TIER 2: OPEN SOURCE HOSTED (Groq LPU)',
    3: '🔧 TIER 3: BARE METAL SELF-HOSTED (Modal, RunPod + vLLM/TensorRT)',
    4: '⚡ TIER 4: HARDWARE ACCELERATORS (Cerebras WSE, Groq LPU)',
  };

  for (const tier of tiers) {
    const tierResults = aggregates.filter(a => a.tier === tier);
    if (tierResults.length === 0) continue;

    console.log(`║                                                                                          ║
║  ${tierLabels[tier].padEnd(86)} ║
║  ${'─'.repeat(86)} ║
║   Provider/Model                      │ Hardware      │ Stack      │ TTFT  │ Latency │ $/mo   ║
║  ─────────────────────────────────────┼───────────────┼────────────┼───────┼─────────┼────────║`);

    for (const result of tierResults) {
      const name = result.displayName.substring(0, 35).padEnd(35);
      const hw = (result.hardware || 'Managed').substring(0, 13).padEnd(13);
      const stack = (result.servingStack || 'API').substring(0, 10).padEnd(10);

      if (result.success) {
        const ttft = `${result.avgTTFT.toFixed(0)}ms`.padStart(5);
        const latency = `${result.avgTotalTime.toFixed(0)}ms`.padStart(7);
        const cost = `$${result.monthlyCost.toFixed(0)}`.padStart(6);
        console.log(`║  ${name} │ ${hw} │ ${stack} │ ${ttft} │ ${latency} │ ${cost} ║`);
      } else {
        console.log(`║  ${name} │ ${hw} │ ${stack} │   --  │      -- │     -- ║`);
      }
    }
  }

  console.log(`║                                                                                          ║
╚══════════════════════════════════════════════════════════════════════════════════════════╝`);

  // Find winners and calculate savings
  const successful = aggregates.filter(a => a.success);
  if (successful.length === 0) return;

  const byCost = [...successful].sort((a, b) => a.monthlyCost - b.monthlyCost);
  const byLatency = [...successful].sort((a, b) => a.avgTotalTime - b.avgTotalTime);
  const byThroughput = [...successful].sort((a, b) => b.avgTokensPerSecond - a.avgTokensPerSecond);

  // Find baselines
  const openaiBaseline = successful.find(a => a.provider === 'openai' && a.displayName.includes('GPT-4o') && !a.displayName.includes('mini'));
  const anthropicBaseline = successful.find(a => a.provider === 'anthropic' && a.displayName.includes('Sonnet'));
  const cheapest = byCost[0];

  console.log(`
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  🏆 WINNERS & SAVINGS ANALYSIS                                                         │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  💰 Lowest Cost:       ${cheapest.displayName.padEnd(35)} $${cheapest.monthlyCost.toFixed(0)}/mo      │
│  ⚡ Lowest Latency:    ${byLatency[0].displayName.padEnd(35)} ${byLatency[0].avgTotalTime.toFixed(0)}ms          │
│  🚀 Best Throughput:   ${byThroughput[0].displayName.padEnd(35)} ${byThroughput[0].avgTokensPerSecond.toFixed(0)} tok/s     │
├────────────────────────────────────────────────────────────────────────────────────────┤`);

  if (openaiBaseline) {
    const savingsVsOpenAI = openaiBaseline.monthlyCost - cheapest.monthlyCost;
    const savingsPctOpenAI = (savingsVsOpenAI / openaiBaseline.monthlyCost) * 100;
    console.log(`│  📊 vs OpenAI GPT-4o:  $${openaiBaseline.monthlyCost.toFixed(0)}/mo → $${cheapest.monthlyCost.toFixed(0)}/mo = $${savingsVsOpenAI.toFixed(0)}/mo saved (${savingsPctOpenAI.toFixed(0)}%)            │`);
  }

  if (anthropicBaseline) {
    const savingsVsAnthropic = anthropicBaseline.monthlyCost - cheapest.monthlyCost;
    const savingsPctAnthropic = (savingsVsAnthropic / anthropicBaseline.monthlyCost) * 100;
    console.log(`│  📊 vs Claude Sonnet:  $${anthropicBaseline.monthlyCost.toFixed(0)}/mo → $${cheapest.monthlyCost.toFixed(0)}/mo = $${savingsVsAnthropic.toFixed(0)}/mo saved (${savingsPctAnthropic.toFixed(0)}%)          │`);
  }

  console.log(`└────────────────────────────────────────────────────────────────────────────────────────┘`);

  // Migration path recommendation
  console.log(`
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  🗺️  RECOMMENDED MIGRATION PATH                                                        │
├────────────────────────────────────────────────────────────────────────────────────────┤`);

  const tier1Best = successful.filter(a => a.tier === 1).sort((a, b) => a.monthlyCost - b.monthlyCost)[0];
  const tier2Best = successful.filter(a => a.tier === 2).sort((a, b) => a.monthlyCost - b.monthlyCost)[0];
  const tier3Best = successful.filter(a => a.tier === 3).sort((a, b) => a.monthlyCost - b.monthlyCost)[0];
  const tier4Best = successful.filter(a => a.tier === 4).sort((a, b) => a.monthlyCost - b.monthlyCost)[0];

  let step = 1;
  if (tier1Best) {
    console.log(`│  ${step}. START:  ${tier1Best.displayName.padEnd(40)} $${tier1Best.monthlyCost.toFixed(0)}/mo     │`);
    step++;
  }
  if (tier2Best && tier2Best.monthlyCost < (tier1Best?.monthlyCost || Infinity)) {
    const savings = tier1Best ? ((tier1Best.monthlyCost - tier2Best.monthlyCost) / tier1Best.monthlyCost * 100).toFixed(0) : 0;
    console.log(`│  ${step}. MIGRATE: ${tier2Best.displayName.padEnd(40)} $${tier2Best.monthlyCost.toFixed(0)}/mo (${savings}% savings) │`);
    step++;
  }
  if (tier4Best && tier4Best.monthlyCost < (tier2Best?.monthlyCost || tier1Best?.monthlyCost || Infinity)) {
    const baseline = tier2Best?.monthlyCost || tier1Best?.monthlyCost || tier4Best.monthlyCost;
    const savings = ((baseline - tier4Best.monthlyCost) / baseline * 100).toFixed(0);
    console.log(`│  ${step}. OPTIMIZE: ${tier4Best.displayName.padEnd(40)} $${tier4Best.monthlyCost.toFixed(0)}/mo (${savings}% savings) │`);
    step++;
  }
  if (tier3Best) {
    const baseline = tier4Best?.monthlyCost || tier2Best?.monthlyCost || tier1Best?.monthlyCost || tier3Best.monthlyCost;
    const savings = ((baseline - tier3Best.monthlyCost) / baseline * 100).toFixed(0);
    console.log(`│  ${step}. SCALE:   ${tier3Best.displayName.padEnd(40)} $${tier3Best.monthlyCost.toFixed(0)}/mo (control) │`);
  }

  console.log(`└────────────────────────────────────────────────────────────────────────────────────────┘
`);
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════════════════════════════════╗
║                                                                                          ║
║   🏔️  PeakInfer Unified Inference Comparison                                             ║
║                                                                                          ║
║   Running SAME workload across ALL deployment tiers:                                     ║
║                                                                                          ║
║   TIER 1: Closed APIs      → OpenAI GPT-4o, Anthropic Claude                             ║
║   TIER 2: OS Hosted        → Groq (Llama on LPU hardware)                                ║
║   TIER 3: Bare Metal       → Modal, RunPod (vLLM, TensorRT-LLM)                          ║
║   TIER 4: Hardware Accel   → Cerebras WSE-3, Groq LPU                                    ║
║                                                                                          ║
╚══════════════════════════════════════════════════════════════════════════════════════════╝
`);

  // Check available providers
  const availableProviders: string[] = [];
  for (const config of ALL_PROVIDERS) {
    if (process.env[config.apiKeyEnv] && !availableProviders.includes(config.provider)) {
      availableProviders.push(config.provider);
    }
  }
  console.log(`  Available providers: ${availableProviders.join(', ') || 'NONE'}\n`);

  const results: BenchmarkResult[] = [];

  // Run benchmarks for API-based providers
  for (const config of ALL_PROVIDERS) {
    if (!process.env[config.apiKeyEnv]) {
      console.log(`  ⏭️  Skipping ${config.displayName} (${config.apiKeyEnv} not set)`);
      continue;
    }

    console.log(`  🔬 Testing ${config.displayName}...`);

    for (const prompt of TEST_PROMPTS) {
      process.stdout.write(`     - ${prompt.name}... `);

      const result = await benchmarkProvider(config, prompt);
      results.push(result);

      if (result.success) {
        console.log(`✅ ${result.totalTime.toFixed(0)}ms, ${result.tokensPerSecond.toFixed(0)} tok/s`);
      } else {
        console.log(`❌ ${result.error}`);
      }

      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  // Add self-hosted theoretical results
  console.log(`\n  📊 Adding Tier 3 theoretical estimates (self-hosted)...`);
  for (const config of SELF_HOSTED_CONFIGS) {
    const result = calculateSelfHostedCost(config);
    results.push(result);
    console.log(`     - ${config.displayName}: $${result.monthlyCost.toFixed(0)}/mo (estimated)`);
  }

  // Aggregate and print
  const aggregates = aggregateResults(results);
  printUnifiedComparison(aggregates);

  // Calculate and print ALL workloads comparison
  const allWorkloadCosts = calculateAllWorkloadCosts(aggregates, ALL_PROVIDERS, SELF_HOSTED_CONFIGS);
  printAllWorkloadsComparison(allWorkloadCosts);

  // Save results
  const fs = await import('fs');
  fs.writeFileSync(
    'unified-comparison-results.json',
    JSON.stringify({
      timestamp: new Date().toISOString(),
      workload: WORKLOAD,
      results,
      aggregates,
    }, null, 2)
  );
  console.log(`  📁 Results saved to: unified-comparison-results.json`);
}

main().catch(console.error);
