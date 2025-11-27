#!/usr/bin/env npx tsx
/**
 * PeakInfer Hardware + Software Stack Inference Comparison
 *
 * Compares inference across different HARDWARE + SOFTWARE combinations:
 *
 * ┌────────────────────────────────────────────────────────────────────┐
 * │  HARDWARE LAYER (Chip)         │  SOFTWARE LAYER (Serving Stack)  │
 * ├────────────────────────────────┼───────────────────────────────────┤
 * │  CEREBRAS WSE-3               │  Cerebras Inference               │
 * │  GROQ LPU                     │  Groq Runtime (Native)            │
 * │  NVIDIA H100                  │  vLLM / TensorRT-LLM / SGLang     │
 * │  NVIDIA A100                  │  vLLM / TensorRT-LLM              │
 * │  SAMBANOVA RDU                │  SambaFlow                        │
 * │  AMD MI300X                   │  vLLM + ROCm                       │
 * └────────────────────────────────┴───────────────────────────────────┘
 *
 * The key insight: Same model, same hardware can have VERY different
 * performance depending on the serving software stack!
 *
 * Metrics: Cost / Latency / Throughput
 */

import OpenAI from 'openai';

// ============================================================================
// HARDWARE + SOFTWARE STACK PLATFORMS
// ============================================================================

interface HardwarePlatform {
  name: string;
  hardware: string;
  servingStack: string;  // vLLM, TensorRT-LLM, SGLang, native
  description: string;
  apiBase?: string;
  models: {
    model: string;
    displayName: string;
    inputPer1M: number;
    outputPer1M: number;
  }[];
}

const HARDWARE_PLATFORMS: HardwarePlatform[] = [
  // ============ CEREBRAS (WSE-3 + Cerebras Inference) ============
  {
    name: 'cerebras',
    hardware: 'Cerebras WSE-3',
    servingStack: 'Cerebras Inference',
    description: 'Wafer-Scale Engine - entire model on one chip, no memory bottleneck',
    apiBase: 'https://api.cerebras.ai/v1',
    models: [
      { model: 'llama-3.3-70b', displayName: 'Llama 3.3 70B', inputPer1M: 0.60, outputPer1M: 0.60 },
      { model: 'llama3.1-8b', displayName: 'Llama 3.1 8B', inputPer1M: 0.10, outputPer1M: 0.10 },
    ],
  },

  // ============ GROQ (LPU + Groq Runtime) ============
  {
    name: 'groq',
    hardware: 'Groq LPU',
    servingStack: 'Groq Runtime (Native)',
    description: 'Language Processing Unit - deterministic latency, custom ASIC',
    apiBase: 'https://api.groq.com/openai/v1',
    models: [
      { model: 'llama-3.3-70b-versatile', displayName: 'Llama 3.3 70B', inputPer1M: 0.59, outputPer1M: 0.79 },
      { model: 'llama-3.1-8b-instant', displayName: 'Llama 3.1 8B', inputPer1M: 0.05, outputPer1M: 0.08 },
    ],
  },

  // ============ NVIDIA H100 + vLLM (via Fireworks) ============
  {
    name: 'nvidia-vllm-fireworks',
    hardware: 'NVIDIA H100',
    servingStack: 'vLLM',
    description: 'H100 GPUs with vLLM continuous batching via Fireworks AI',
    apiBase: 'https://api.fireworks.ai/inference/v1',
    models: [
      { model: 'accounts/fireworks/models/llama-v3p1-70b-instruct', displayName: 'Llama 3.1 70B', inputPer1M: 0.90, outputPer1M: 0.90 },
      { model: 'accounts/fireworks/models/llama-v3p1-8b-instruct', displayName: 'Llama 3.1 8B', inputPer1M: 0.20, outputPer1M: 0.20 },
      { model: 'accounts/fireworks/models/deepseek-v2p5', displayName: 'DeepSeek V2.5', inputPer1M: 0.90, outputPer1M: 0.90 },
    ],
  },

  // ============ SAMBANOVA (RDU + SambaFlow) ============
  {
    name: 'sambanova',
    hardware: 'SambaNova RDU',
    servingStack: 'SambaFlow',
    description: 'Reconfigurable Dataflow Unit with SambaFlow runtime',
    apiBase: 'https://api.sambanova.ai/v1',
    models: [
      { model: 'Meta-Llama-3.1-70B-Instruct', displayName: 'Llama 3.1 70B', inputPer1M: 0.60, outputPer1M: 0.60 },
      { model: 'Meta-Llama-3.1-8B-Instruct', displayName: 'Llama 3.1 8B', inputPer1M: 0.10, outputPer1M: 0.10 },
    ],
  },

  // ============ AMD MI300X + vLLM (via provider) ============
  // Note: AMD availability is limited, placeholder for when available
];

// ============================================================================
// TEST PROMPTS
// ============================================================================

const TEST_PROMPTS = [
  {
    name: 'Quick Response',
    system: 'Be concise.',
    user: 'What is 2+2?',
    expectedTokens: 10,
  },
  {
    name: 'Code Generation',
    system: 'Write clean code.',
    user: 'Write a Python quicksort function.',
    expectedTokens: 150,
  },
  {
    name: 'Analysis',
    system: 'Analyze thoroughly.',
    user: 'Compare REST vs GraphQL APIs in 5 bullet points.',
    expectedTokens: 250,
  },
];

// ============================================================================
// BENCHMARK TYPES
// ============================================================================

interface BenchmarkResult {
  platform: string;
  hardware: string;
  servingStack: string;
  model: string;
  displayName: string;
  promptName: string;
  inputTokens: number;
  outputTokens: number;
  ttft: number;
  totalTime: number;
  tokensPerSecond: number;
  cost: number;
  success: boolean;
  error?: string;
}

interface AggregatedResult {
  platform: string;
  hardware: string;
  servingStack: string;
  model: string;
  displayName: string;
  requests: number;
  avgInputTokens: number;
  avgOutputTokens: number;
  avgTTFT: number;
  avgTotalTime: number;
  avgTokensPerSecond: number;
  totalCost: number;
  projectedMonthlyCost: number;  // 10K req/day * 30 days
}

// ============================================================================
// API KEYS CHECK
// ============================================================================

function getApiKey(platform: string): string | undefined {
  switch (platform) {
    case 'cerebras':
      return process.env.CEREBRAS_API_KEY;
    case 'groq':
      return process.env.GROQ_API_KEY;
    case 'nvidia-fireworks':
      return process.env.FIREWORKS_API_KEY;
    case 'nvidia-vllm-fireworks':
      return process.env.FIREWORKS_API_KEY;
    case 'sambanova':
      return process.env.SAMBANOVA_API_KEY;
    default:
      return undefined;
  }
}

// ============================================================================
// BENCHMARK FUNCTION
// ============================================================================

async function benchmarkPlatform(
  platform: HardwarePlatform,
  modelConfig: typeof platform.models[0],
  prompt: typeof TEST_PROMPTS[0]
): Promise<BenchmarkResult> {
  const apiKey = getApiKey(platform.name);

  if (!apiKey) {
    return {
      platform: platform.name,
      hardware: platform.hardware,
      servingStack: platform.servingStack,
      model: modelConfig.model,
      displayName: modelConfig.displayName,
      promptName: prompt.name,
      inputTokens: 0,
      outputTokens: 0,
      ttft: 0,
      totalTime: 0,
      tokensPerSecond: 0,
      cost: 0,
      success: false,
      error: `${platform.name.toUpperCase().replace(/-/g, '_')}_API_KEY not set`,
    };
  }

  const client = new OpenAI({
    apiKey,
    baseURL: platform.apiBase,
  });

  const startTime = performance.now();
  let ttft = 0;
  let outputContent = '';

  try {
    const stream = await client.chat.completions.create({
      model: modelConfig.model,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      stream: true,
      max_tokens: 500,
    });

    let firstTokenTime: number | null = null;

    for await (const chunk of stream) {
      if (!firstTokenTime && chunk.choices[0]?.delta?.content) {
        firstTokenTime = performance.now();
        ttft = firstTokenTime - startTime;
      }
      outputContent += chunk.choices[0]?.delta?.content || '';
    }

    const totalTime = performance.now() - startTime;

    // Estimate tokens
    const inputTokens = Math.ceil((prompt.system.length + prompt.user.length) / 4);
    const outputTokens = Math.ceil(outputContent.length / 4);

    const tokensPerSecond = outputTokens > 0 ? outputTokens / (totalTime / 1000) : 0;

    const cost =
      (inputTokens / 1_000_000) * modelConfig.inputPer1M +
      (outputTokens / 1_000_000) * modelConfig.outputPer1M;

    return {
      platform: platform.name,
      hardware: platform.hardware,
      servingStack: platform.servingStack,
      model: modelConfig.model,
      displayName: modelConfig.displayName,
      promptName: prompt.name,
      inputTokens,
      outputTokens,
      ttft,
      totalTime,
      tokensPerSecond,
      cost,
      success: true,
    };
  } catch (error) {
    return {
      platform: platform.name,
      hardware: platform.hardware,
      servingStack: platform.servingStack,
      model: modelConfig.model,
      displayName: modelConfig.displayName,
      promptName: prompt.name,
      inputTokens: 0,
      outputTokens: 0,
      ttft: 0,
      totalTime: performance.now() - startTime,
      tokensPerSecond: 0,
      cost: 0,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// AGGREGATION
// ============================================================================

function aggregateResults(results: BenchmarkResult[]): AggregatedResult[] {
  const grouped = new Map<string, BenchmarkResult[]>();

  for (const result of results) {
    const key = `${result.platform}/${result.displayName}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(result);
  }

  const aggregates: AggregatedResult[] = [];

  for (const [, group] of grouped) {
    const successful = group.filter(r => r.success);
    if (successful.length === 0) continue;

    const first = successful[0];
    const avgInputTokens = successful.reduce((sum, r) => sum + r.inputTokens, 0) / successful.length;
    const avgOutputTokens = successful.reduce((sum, r) => sum + r.outputTokens, 0) / successful.length;
    const avgTTFT = successful.reduce((sum, r) => sum + r.ttft, 0) / successful.length;
    const avgTotalTime = successful.reduce((sum, r) => sum + r.totalTime, 0) / successful.length;
    const avgTokensPerSecond = successful.reduce((sum, r) => sum + r.tokensPerSecond, 0) / successful.length;
    const totalCost = successful.reduce((sum, r) => sum + r.cost, 0);
    const costPerRequest = totalCost / successful.length;
    const projectedMonthlyCost = costPerRequest * 10000 * 30;  // 10K/day * 30 days

    aggregates.push({
      platform: first.platform,
      hardware: first.hardware,
      servingStack: first.servingStack,
      model: first.model,
      displayName: first.displayName,
      requests: successful.length,
      avgInputTokens,
      avgOutputTokens,
      avgTTFT,
      avgTotalTime,
      avgTokensPerSecond,
      totalCost,
      projectedMonthlyCost,
    });
  }

  return aggregates;
}

// ============================================================================
// REPORTING
// ============================================================================

function printHardwareComparison(aggregates: AggregatedResult[]) {
  // Group by model size for fair comparison
  const llama70b = aggregates.filter(a => a.displayName.includes('70B'));
  const llama8b = aggregates.filter(a => a.displayName.includes('8B'));
  const deepseek = aggregates.filter(a => a.displayName.includes('DeepSeek'));

  console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║  🔬 HARDWARE + SOFTWARE STACK COMPARISON                                     ║
║     Same Model → Different Hardware → Different Serving Stack                ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  📊 Llama 3.1 70B - Hardware + Stack Comparison                              ║
║  ────────────────────────────────────────────────────────────────────────────║
║   Hardware + Stack                  │ TTFT   │ Total  │ Tok/s │ $/mo (10K/d)║
║  ───────────────────────────────────┼────────┼────────┼───────┼─────────────║`);

  for (const result of llama70b.sort((a, b) => a.avgTotalTime - b.avgTotalTime)) {
    const hwStack = `${result.hardware} + ${result.servingStack}`.substring(0, 33).padEnd(33);
    const ttft = `${result.avgTTFT.toFixed(0)}ms`.padStart(5);
    const total = `${result.avgTotalTime.toFixed(0)}ms`.padStart(6);
    const tps = `${result.avgTokensPerSecond.toFixed(0)}`.padStart(5);
    const cost = `$${result.projectedMonthlyCost.toFixed(0)}`.padStart(6);

    console.log(`║  ${hwStack} │ ${ttft} │ ${total} │ ${tps} │ ${cost}       ║`);
  }

  console.log(`║                                                                              ║
║  📊 Llama 3.1 8B - Hardware + Stack Comparison                               ║
║  ────────────────────────────────────────────────────────────────────────────║
║   Hardware + Stack                  │ TTFT   │ Total  │ Tok/s │ $/mo (10K/d)║
║  ───────────────────────────────────┼────────┼────────┼───────┼─────────────║`);

  for (const result of llama8b.sort((a, b) => a.avgTotalTime - b.avgTotalTime)) {
    const hwStack = `${result.hardware} + ${result.servingStack}`.substring(0, 33).padEnd(33);
    const ttft = `${result.avgTTFT.toFixed(0)}ms`.padStart(5);
    const total = `${result.avgTotalTime.toFixed(0)}ms`.padStart(6);
    const tps = `${result.avgTokensPerSecond.toFixed(0)}`.padStart(5);
    const cost = `$${result.projectedMonthlyCost.toFixed(0)}`.padStart(6);

    console.log(`║  ${hwStack} │ ${ttft} │ ${total} │ ${tps} │ ${cost}       ║`);
  }

  if (deepseek.length > 0) {
    console.log(`║                                                                              ║
║  📊 DeepSeek V2.5 - Hardware + Stack Comparison                              ║
║  ────────────────────────────────────────────────────────────────────────────║
║   Hardware + Stack                  │ TTFT   │ Total  │ Tok/s │ $/mo (10K/d)║
║  ───────────────────────────────────┼────────┼────────┼───────┼─────────────║`);

    for (const result of deepseek.sort((a, b) => a.avgTotalTime - b.avgTotalTime)) {
      const hwStack = `${result.hardware} + ${result.servingStack}`.substring(0, 33).padEnd(33);
      const ttft = `${result.avgTTFT.toFixed(0)}ms`.padStart(5);
      const total = `${result.avgTotalTime.toFixed(0)}ms`.padStart(6);
      const tps = `${result.avgTokensPerSecond.toFixed(0)}`.padStart(5);
      const cost = `$${result.projectedMonthlyCost.toFixed(0)}`.padStart(6);

      console.log(`║  ${hwStack} │ ${ttft} │ ${total} │ ${tps} │ ${cost}       ║`);
    }
  }

  console.log(`║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝`);

  // Winner summary
  const fastestLatency = [...aggregates].sort((a, b) => a.avgTotalTime - b.avgTotalTime)[0];
  const fastestTTFT = [...aggregates].sort((a, b) => a.avgTTFT - b.avgTTFT)[0];
  const highestThroughput = [...aggregates].sort((a, b) => b.avgTokensPerSecond - a.avgTokensPerSecond)[0];
  const lowestCost = [...aggregates].sort((a, b) => a.projectedMonthlyCost - b.projectedMonthlyCost)[0];

  console.log(`
┌──────────────────────────────────────────────────────────────────────────────┐
│  🏆 WINNERS BY CATEGORY                                                      │
├──────────────────────────────────────────────────────────────────────────────┤
│  ⚡ Fastest TTFT:                                                            │
│     ${fastestTTFT?.hardware} + ${fastestTTFT?.servingStack.padEnd(20)} ${fastestTTFT?.avgTTFT.toFixed(0)}ms                 │
│                                                                              │
│  🚀 Lowest Total Latency:                                                    │
│     ${fastestLatency?.hardware} + ${fastestLatency?.servingStack.padEnd(20)} ${fastestLatency?.avgTotalTime.toFixed(0)}ms                │
│                                                                              │
│  📈 Highest Throughput:                                                      │
│     ${highestThroughput?.hardware} + ${highestThroughput?.servingStack.padEnd(20)} ${highestThroughput?.avgTokensPerSecond.toFixed(0)} tok/s          │
│                                                                              │
│  💰 Lowest Cost:                                                             │
│     ${lowestCost?.hardware} + ${lowestCost?.servingStack.padEnd(20)} $${lowestCost?.projectedMonthlyCost.toFixed(0)}/mo             │
└──────────────────────────────────────────────────────────────────────────────┘
`);
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║    🔬 PeakInfer Hardware Inference Comparison                                ║
║                                                                              ║
║    Comparing inference across different AI accelerators:                     ║
║                                                                              ║
║    🧠 CEREBRAS WSE-3  - Wafer-scale chip, no memory bottleneck               ║
║    ⚡ GROQ LPU        - Custom ASIC, deterministic low-latency               ║
║    🎮 NVIDIA H100/A100 - GPU, via Fireworks                                  ║
║    🔄 SAMBANOVA RDU   - Reconfigurable dataflow architecture                 ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
`);

  // Check available platforms
  const availablePlatforms: string[] = [];
  for (const platform of HARDWARE_PLATFORMS) {
    const key = getApiKey(platform.name);
    if (key) {
      availablePlatforms.push(`${platform.name} (${platform.hardware})`);
    }
  }

  console.log(`  Available platforms: ${availablePlatforms.length > 0 ? availablePlatforms.join(', ') : 'NONE'}`);

  if (availablePlatforms.length === 0) {
    console.log(`
  ⚠️  No API keys configured. Set at least one of:
     - CEREBRAS_API_KEY
     - GROQ_API_KEY
     - FIREWORKS_API_KEY
     - SAMBANOVA_API_KEY
`);
    return;
  }

  const results: BenchmarkResult[] = [];

  // Run benchmarks
  for (const platform of HARDWARE_PLATFORMS) {
    const apiKey = getApiKey(platform.name);
    if (!apiKey) continue;

    console.log(`\n  🔬 Testing ${platform.hardware}...`);

    for (const modelConfig of platform.models) {
      console.log(`     Model: ${modelConfig.displayName}`);

      for (const prompt of TEST_PROMPTS) {
        process.stdout.write(`       - ${prompt.name}... `);

        const result = await benchmarkPlatform(platform, modelConfig, prompt);
        results.push(result);

        if (result.success) {
          console.log(`✅ TTFT: ${result.ttft.toFixed(0)}ms, Total: ${result.totalTime.toFixed(0)}ms, ${result.tokensPerSecond.toFixed(0)} tok/s`);
        } else {
          console.log(`❌ ${result.error?.substring(0, 50)}`);
        }

        // Delay between requests
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
  }

  // Aggregate and print results
  const aggregates = aggregateResults(results);

  if (aggregates.length > 0) {
    printHardwareComparison(aggregates);

    // Save results
    const fs = await import('fs');
    fs.writeFileSync(
      'hardware-benchmark-results.json',
      JSON.stringify({ timestamp: new Date().toISOString(), results, aggregates }, null, 2)
    );
    console.log(`  📁 Results saved to: hardware-benchmark-results.json`);
  } else {
    console.log('\n  ⚠️  No successful benchmarks. Check your API keys.');
  }
}

main().catch(console.error);
