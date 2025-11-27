#!/usr/bin/env npx tsx
/**
 * PeakInfer Live Inference Benchmark
 *
 * Runs the SAME prompts across multiple providers and collects REAL metrics:
 * - Cost (actual $ based on tokens used)
 * - Latency (TTFT + total time)
 * - Throughput (tokens/second)
 *
 * Providers tested:
 * 1. OpenAI (GPT-4o, GPT-4o-mini)
 * 2. Anthropic (Claude-3.5-sonnet, Claude-3-haiku)
 * 3. Fireworks AI (Llama-3.1-70B, DeepSeek-v2.5)
 * 4. Groq (Llama-3.1-70B - for latency comparison)
 *
 * Usage: npx tsx live-benchmark.ts [--prompts 10] [--provider all|openai|anthropic|fireworks|groq]
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

// ============================================================================
// CONFIGURATION
// ============================================================================

interface ProviderConfig {
  name: string;
  model: string;
  inputPer1M: number;
  outputPer1M: number;
}

const PROVIDERS: Record<string, ProviderConfig[]> = {
  openai: [
    { name: 'openai', model: 'gpt-4o', inputPer1M: 2.50, outputPer1M: 10.00 },
    { name: 'openai', model: 'gpt-4o-mini', inputPer1M: 0.15, outputPer1M: 0.60 },
  ],
  anthropic: [
    { name: 'anthropic', model: 'claude-sonnet-4-20250514', inputPer1M: 3.00, outputPer1M: 15.00 },
    { name: 'anthropic', model: 'claude-3-haiku-20240307', inputPer1M: 0.25, outputPer1M: 1.25 },
  ],
  fireworks: [
    { name: 'fireworks', model: 'accounts/fireworks/models/llama-v3p1-70b-instruct', inputPer1M: 0.90, outputPer1M: 0.90 },
    { name: 'fireworks', model: 'accounts/fireworks/models/deepseek-v2p5', inputPer1M: 0.90, outputPer1M: 0.90 },
  ],
  groq: [
    { name: 'groq', model: 'llama-3.1-70b-versatile', inputPer1M: 0.59, outputPer1M: 0.79 },
    { name: 'groq', model: 'llama-3.1-8b-instant', inputPer1M: 0.05, outputPer1M: 0.08 },
  ],
};

// Test prompts of varying complexity
const TEST_PROMPTS = [
  {
    name: 'Simple Q&A',
    system: 'You are a helpful assistant. Be concise.',
    user: 'What is the capital of France?',
    expectedOutputTokens: 20,
  },
  {
    name: 'Code Generation',
    system: 'You are an expert programmer. Write clean, efficient code.',
    user: 'Write a Python function that finds the nth Fibonacci number using dynamic programming. Include comments.',
    expectedOutputTokens: 200,
  },
  {
    name: 'Summarization',
    system: 'You are a summarization expert. Provide concise summaries.',
    user: `Summarize the following text in 3 bullet points:

Machine learning is a subset of artificial intelligence that enables systems to learn and improve from experience without being explicitly programmed. It focuses on developing algorithms that can access data and use it to learn for themselves. The process begins with observations or data, such as examples, direct experience, or instruction, in order to look for patterns in data and make better decisions in the future. The primary aim is to allow computers to learn automatically without human intervention and adjust actions accordingly.

Machine learning algorithms are often categorized as supervised or unsupervised. Supervised learning algorithms can apply what has been learned in the past to new data using labeled examples to predict future events. Unsupervised learning algorithms are used when the information used to train is neither classified nor labeled.`,
    expectedOutputTokens: 150,
  },
  {
    name: 'Analysis',
    system: 'You are a business analyst. Provide structured analysis.',
    user: 'Analyze the pros and cons of using serverless computing vs traditional server hosting for a high-traffic web application. Format as a table.',
    expectedOutputTokens: 400,
  },
  {
    name: 'Creative Writing',
    system: 'You are a creative writer.',
    user: 'Write a short poem (4-6 lines) about the beauty of sunrise.',
    expectedOutputTokens: 100,
  },
];

// ============================================================================
// BENCHMARK RESULT TYPES
// ============================================================================

interface BenchmarkResult {
  provider: string;
  model: string;
  promptName: string;

  // Tokens
  inputTokens: number;
  outputTokens: number;

  // Latency (ms)
  ttft: number;           // Time to first token
  totalTime: number;      // Total request time
  tpot: number;           // Time per output token

  // Throughput
  tokensPerSecond: number;

  // Cost
  cost: number;           // $ for this request

  // Status
  success: boolean;
  error?: string;
}

interface AggregateResult {
  provider: string;
  model: string;
  totalRequests: number;
  successfulRequests: number;

  // Averages
  avgInputTokens: number;
  avgOutputTokens: number;
  avgTTFT: number;
  avgTotalTime: number;
  avgTPOT: number;
  avgTokensPerSecond: number;

  // Cost
  totalCost: number;
  costPer1KRequests: number;
  projectedMonthlyCost: number;  // For 10K requests/day

  // Percentiles
  p50Latency: number;
  p99Latency: number;
}

// ============================================================================
// API CLIENTS
// ============================================================================

let openaiClient: OpenAI | null = null;
let anthropicClient: Anthropic | null = null;
let fireworksClient: OpenAI | null = null;
let groqClient: OpenAI | null = null;

function initClients() {
  if (process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  if (process.env.ANTHROPIC_API_KEY) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  if (process.env.FIREWORKS_API_KEY) {
    fireworksClient = new OpenAI({
      apiKey: process.env.FIREWORKS_API_KEY,
      baseURL: 'https://api.fireworks.ai/inference/v1',
    });
  }

  if (process.env.GROQ_API_KEY) {
    groqClient = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }
}

// ============================================================================
// BENCHMARK FUNCTIONS
// ============================================================================

async function benchmarkOpenAI(
  config: ProviderConfig,
  prompt: typeof TEST_PROMPTS[0]
): Promise<BenchmarkResult> {
  if (!openaiClient) {
    return {
      provider: config.name,
      model: config.model,
      promptName: prompt.name,
      inputTokens: 0,
      outputTokens: 0,
      ttft: 0,
      totalTime: 0,
      tpot: 0,
      tokensPerSecond: 0,
      cost: 0,
      success: false,
      error: 'OPENAI_API_KEY not set',
    };
  }

  const startTime = performance.now();
  let ttft = 0;
  let outputTokens = 0;

  try {
    const stream = await openaiClient.chat.completions.create({
      model: config.model,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      stream: true,
      stream_options: { include_usage: true },
    });

    let firstTokenTime: number | null = null;
    let inputTokens = 0;

    for await (const chunk of stream) {
      if (!firstTokenTime && chunk.choices[0]?.delta?.content) {
        firstTokenTime = performance.now();
        ttft = firstTokenTime - startTime;
      }

      if (chunk.usage) {
        inputTokens = chunk.usage.prompt_tokens;
        outputTokens = chunk.usage.completion_tokens;
      }
    }

    const totalTime = performance.now() - startTime;
    const tpot = outputTokens > 0 ? (totalTime - ttft) / outputTokens : 0;
    const tokensPerSecond = outputTokens > 0 ? (outputTokens / (totalTime / 1000)) : 0;

    const cost =
      (inputTokens / 1_000_000) * config.inputPer1M +
      (outputTokens / 1_000_000) * config.outputPer1M;

    return {
      provider: config.name,
      model: config.model,
      promptName: prompt.name,
      inputTokens,
      outputTokens,
      ttft,
      totalTime,
      tpot,
      tokensPerSecond,
      cost,
      success: true,
    };
  } catch (error) {
    return {
      provider: config.name,
      model: config.model,
      promptName: prompt.name,
      inputTokens: 0,
      outputTokens: 0,
      ttft: 0,
      totalTime: performance.now() - startTime,
      tpot: 0,
      tokensPerSecond: 0,
      cost: 0,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function benchmarkAnthropic(
  config: ProviderConfig,
  prompt: typeof TEST_PROMPTS[0]
): Promise<BenchmarkResult> {
  if (!anthropicClient) {
    return {
      provider: config.name,
      model: config.model,
      promptName: prompt.name,
      inputTokens: 0,
      outputTokens: 0,
      ttft: 0,
      totalTime: 0,
      tpot: 0,
      tokensPerSecond: 0,
      cost: 0,
      success: false,
      error: 'ANTHROPIC_API_KEY not set',
    };
  }

  const startTime = performance.now();
  let ttft = 0;

  try {
    const stream = anthropicClient.messages.stream({
      model: config.model,
      max_tokens: 1024,
      system: prompt.system,
      messages: [{ role: 'user', content: prompt.user }],
    });

    let firstTokenTime: number | null = null;

    stream.on('text', () => {
      if (!firstTokenTime) {
        firstTokenTime = performance.now();
        ttft = firstTokenTime - startTime;
      }
    });

    const finalMessage = await stream.finalMessage();
    const totalTime = performance.now() - startTime;

    const inputTokens = finalMessage.usage.input_tokens;
    const outputTokens = finalMessage.usage.output_tokens;

    const tpot = outputTokens > 0 ? (totalTime - ttft) / outputTokens : 0;
    const tokensPerSecond = outputTokens > 0 ? (outputTokens / (totalTime / 1000)) : 0;

    const cost =
      (inputTokens / 1_000_000) * config.inputPer1M +
      (outputTokens / 1_000_000) * config.outputPer1M;

    return {
      provider: config.name,
      model: config.model,
      promptName: prompt.name,
      inputTokens,
      outputTokens,
      ttft,
      totalTime,
      tpot,
      tokensPerSecond,
      cost,
      success: true,
    };
  } catch (error) {
    return {
      provider: config.name,
      model: config.model,
      promptName: prompt.name,
      inputTokens: 0,
      outputTokens: 0,
      ttft: 0,
      totalTime: performance.now() - startTime,
      tpot: 0,
      tokensPerSecond: 0,
      cost: 0,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function benchmarkFireworks(
  config: ProviderConfig,
  prompt: typeof TEST_PROMPTS[0]
): Promise<BenchmarkResult> {
  if (!fireworksClient) {
    return {
      provider: config.name,
      model: config.model,
      promptName: prompt.name,
      inputTokens: 0,
      outputTokens: 0,
      ttft: 0,
      totalTime: 0,
      tpot: 0,
      tokensPerSecond: 0,
      cost: 0,
      success: false,
      error: 'FIREWORKS_API_KEY not set',
    };
  }

  const startTime = performance.now();
  let ttft = 0;
  let outputTokens = 0;

  try {
    const stream = await fireworksClient.chat.completions.create({
      model: config.model,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      stream: true,
    });

    let firstTokenTime: number | null = null;
    let content = '';

    for await (const chunk of stream) {
      if (!firstTokenTime && chunk.choices[0]?.delta?.content) {
        firstTokenTime = performance.now();
        ttft = firstTokenTime - startTime;
      }
      content += chunk.choices[0]?.delta?.content || '';
    }

    const totalTime = performance.now() - startTime;

    // Estimate tokens (Fireworks doesn't always return usage in stream)
    const inputTokens = Math.ceil((prompt.system.length + prompt.user.length) / 4);
    outputTokens = Math.ceil(content.length / 4);

    const tpot = outputTokens > 0 ? (totalTime - ttft) / outputTokens : 0;
    const tokensPerSecond = outputTokens > 0 ? (outputTokens / (totalTime / 1000)) : 0;

    const cost =
      (inputTokens / 1_000_000) * config.inputPer1M +
      (outputTokens / 1_000_000) * config.outputPer1M;

    return {
      provider: config.name,
      model: config.model.split('/').pop() || config.model,
      promptName: prompt.name,
      inputTokens,
      outputTokens,
      ttft,
      totalTime,
      tpot,
      tokensPerSecond,
      cost,
      success: true,
    };
  } catch (error) {
    return {
      provider: config.name,
      model: config.model.split('/').pop() || config.model,
      promptName: prompt.name,
      inputTokens: 0,
      outputTokens: 0,
      ttft: 0,
      totalTime: performance.now() - startTime,
      tpot: 0,
      tokensPerSecond: 0,
      cost: 0,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function benchmarkGroq(
  config: ProviderConfig,
  prompt: typeof TEST_PROMPTS[0]
): Promise<BenchmarkResult> {
  if (!groqClient) {
    return {
      provider: config.name,
      model: config.model,
      promptName: prompt.name,
      inputTokens: 0,
      outputTokens: 0,
      ttft: 0,
      totalTime: 0,
      tpot: 0,
      tokensPerSecond: 0,
      cost: 0,
      success: false,
      error: 'GROQ_API_KEY not set',
    };
  }

  const startTime = performance.now();
  let ttft = 0;
  let outputTokens = 0;
  let inputTokens = 0;

  try {
    const stream = await groqClient.chat.completions.create({
      model: config.model,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      stream: true,
    });

    let firstTokenTime: number | null = null;

    for await (const chunk of stream) {
      if (!firstTokenTime && chunk.choices[0]?.delta?.content) {
        firstTokenTime = performance.now();
        ttft = firstTokenTime - startTime;
      }

      if (chunk.x_groq?.usage) {
        inputTokens = chunk.x_groq.usage.prompt_tokens;
        outputTokens = chunk.x_groq.usage.completion_tokens;
      }
    }

    const totalTime = performance.now() - startTime;

    // Estimate if not available
    if (inputTokens === 0) {
      inputTokens = Math.ceil((prompt.system.length + prompt.user.length) / 4);
    }

    const tpot = outputTokens > 0 ? (totalTime - ttft) / outputTokens : 0;
    const tokensPerSecond = outputTokens > 0 ? (outputTokens / (totalTime / 1000)) : 0;

    const cost =
      (inputTokens / 1_000_000) * config.inputPer1M +
      (outputTokens / 1_000_000) * config.outputPer1M;

    return {
      provider: config.name,
      model: config.model,
      promptName: prompt.name,
      inputTokens,
      outputTokens,
      ttft,
      totalTime,
      tpot,
      tokensPerSecond,
      cost,
      success: true,
    };
  } catch (error) {
    return {
      provider: config.name,
      model: config.model,
      promptName: prompt.name,
      inputTokens: 0,
      outputTokens: 0,
      ttft: 0,
      totalTime: performance.now() - startTime,
      tpot: 0,
      tokensPerSecond: 0,
      cost: 0,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function runBenchmark(
  config: ProviderConfig,
  prompt: typeof TEST_PROMPTS[0]
): Promise<BenchmarkResult> {
  switch (config.name) {
    case 'openai':
      return benchmarkOpenAI(config, prompt);
    case 'anthropic':
      return benchmarkAnthropic(config, prompt);
    case 'fireworks':
      return benchmarkFireworks(config, prompt);
    case 'groq':
      return benchmarkGroq(config, prompt);
    default:
      throw new Error(`Unknown provider: ${config.name}`);
  }
}

// ============================================================================
// AGGREGATION
// ============================================================================

function aggregateResults(results: BenchmarkResult[]): AggregateResult[] {
  const grouped = new Map<string, BenchmarkResult[]>();

  for (const result of results) {
    const key = `${result.provider}/${result.model}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(result);
  }

  const aggregates: AggregateResult[] = [];

  for (const [key, group] of grouped) {
    const successful = group.filter(r => r.success);
    if (successful.length === 0) continue;

    const [provider, model] = key.split('/');

    const avgInputTokens = successful.reduce((sum, r) => sum + r.inputTokens, 0) / successful.length;
    const avgOutputTokens = successful.reduce((sum, r) => sum + r.outputTokens, 0) / successful.length;
    const avgTTFT = successful.reduce((sum, r) => sum + r.ttft, 0) / successful.length;
    const avgTotalTime = successful.reduce((sum, r) => sum + r.totalTime, 0) / successful.length;
    const avgTPOT = successful.reduce((sum, r) => sum + r.tpot, 0) / successful.length;
    const avgTokensPerSecond = successful.reduce((sum, r) => sum + r.tokensPerSecond, 0) / successful.length;

    const totalCost = successful.reduce((sum, r) => sum + r.cost, 0);
    const costPer1KRequests = (totalCost / successful.length) * 1000;
    const projectedMonthlyCost = costPer1KRequests * 10 * 30;  // 10K req/day * 30 days

    // Percentiles
    const sortedLatencies = successful.map(r => r.totalTime).sort((a, b) => a - b);
    const p50Index = Math.floor(sortedLatencies.length * 0.5);
    const p99Index = Math.floor(sortedLatencies.length * 0.99);

    aggregates.push({
      provider,
      model,
      totalRequests: group.length,
      successfulRequests: successful.length,
      avgInputTokens,
      avgOutputTokens,
      avgTTFT,
      avgTotalTime,
      avgTPOT,
      avgTokensPerSecond,
      totalCost,
      costPer1KRequests,
      projectedMonthlyCost,
      p50Latency: sortedLatencies[p50Index] || 0,
      p99Latency: sortedLatencies[p99Index] || 0,
    });
  }

  return aggregates.sort((a, b) => a.projectedMonthlyCost - b.projectedMonthlyCost);
}

// ============================================================================
// REPORTING
// ============================================================================

function printResults(aggregates: AggregateResult[]) {
  console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║  📊 LIVE BENCHMARK RESULTS - Cost / Latency / Throughput                     ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║   Provider/Model              │ Monthly Cost │ TTFT     │ Total    │ Tok/s   ║
║  ─────────────────────────────┼──────────────┼──────────┼──────────┼─────────║`);

  for (const agg of aggregates) {
    const name = `${agg.provider}/${agg.model}`.substring(0, 28).padEnd(28);
    const cost = `$${agg.projectedMonthlyCost.toFixed(0)}`.padStart(10);
    const ttft = `${agg.avgTTFT.toFixed(0)}ms`.padStart(7);
    const total = `${agg.avgTotalTime.toFixed(0)}ms`.padStart(7);
    const tps = `${agg.avgTokensPerSecond.toFixed(0)}`.padStart(6);

    console.log(`║  ${name} │ ${cost}   │ ${ttft}  │ ${total}  │ ${tps}   ║`);
  }

  console.log(`║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝`);

  // Best in each category
  const byCost = [...aggregates].sort((a, b) => a.projectedMonthlyCost - b.projectedMonthlyCost);
  const byLatency = [...aggregates].sort((a, b) => a.avgTotalTime - b.avgTotalTime);
  const byThroughput = [...aggregates].sort((a, b) => b.avgTokensPerSecond - a.avgTokensPerSecond);

  console.log(`
┌──────────────────────────────────────────────────────────────────────────────┐
│  🏆 WINNERS BY CATEGORY                                                      │
├──────────────────────────────────────────────────────────────────────────────┤
│  💰 Lowest Cost:       ${byCost[0].provider}/${byCost[0].model.substring(0, 20).padEnd(20)} $${byCost[0].projectedMonthlyCost.toFixed(0)}/mo      │
│  ⚡ Lowest Latency:    ${byLatency[0].provider}/${byLatency[0].model.substring(0, 20).padEnd(20)} ${byLatency[0].avgTotalTime.toFixed(0)}ms         │
│  🚀 Highest Throughput: ${byThroughput[0].provider}/${byThroughput[0].model.substring(0, 20).padEnd(20)} ${byThroughput[0].avgTokensPerSecond.toFixed(0)} tok/s    │
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
║    🏔️  PeakInfer Live Inference Benchmark                                    ║
║                                                                              ║
║    Running real requests across:                                             ║
║    - OpenAI (GPT-4o, GPT-4o-mini)                                            ║
║    - Anthropic (Claude-3.5-sonnet, Claude-3-haiku)                           ║
║    - Fireworks AI (Llama-3.1-70B, DeepSeek-v2.5)                              ║
║    - Groq (Llama-3.1-70B, Llama-3.1-8B)                                       ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
`);

  initClients();

  // Check which providers are available
  const availableProviders: string[] = [];
  if (openaiClient) availableProviders.push('openai');
  if (anthropicClient) availableProviders.push('anthropic');
  if (fireworksClient) availableProviders.push('fireworks');
  if (groqClient) availableProviders.push('groq');

  console.log(`  Available providers: ${availableProviders.join(', ') || 'NONE'}`);

  if (availableProviders.length === 0) {
    console.log(`
  ⚠️  No API keys configured. Set at least one of:
     - OPENAI_API_KEY
     - ANTHROPIC_API_KEY
     - FIREWORKS_API_KEY
     - GROQ_API_KEY
`);
    return;
  }

  const results: BenchmarkResult[] = [];

  // Run benchmarks
  for (const providerName of availableProviders) {
    const configs = PROVIDERS[providerName];
    if (!configs) continue;

    for (const config of configs) {
      console.log(`\n  Testing ${config.name}/${config.model}...`);

      for (const prompt of TEST_PROMPTS) {
        process.stdout.write(`    - ${prompt.name}... `);

        const result = await runBenchmark(config, prompt);
        results.push(result);

        if (result.success) {
          console.log(`✅ ${result.totalTime.toFixed(0)}ms, ${result.outputTokens} tokens`);
        } else {
          console.log(`❌ ${result.error}`);
        }

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }

  // Aggregate and print results
  const aggregates = aggregateResults(results);
  printResults(aggregates);

  // Export results
  const output = {
    timestamp: new Date().toISOString(),
    prompts: TEST_PROMPTS.map(p => p.name),
    results,
    aggregates,
  };

  const fs = await import('fs');
  fs.writeFileSync(
    'benchmark-results.json',
    JSON.stringify(output, null, 2)
  );
  console.log(`\n  📁 Detailed results saved to: benchmark-results.json`);
}

main().catch(console.error);
