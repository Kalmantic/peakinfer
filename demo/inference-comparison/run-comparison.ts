#!/usr/bin/env npx tsx
/**
 * PeakInfer Inference Cost Comparison Demo
 *
 * Compares the same application running across:
 * 1. OpenAI / Anthropic (Hosted APIs)
 * 2. Fireworks AI with Llama / DeepSeek (Alternative APIs)
 * 3. Modal bare metal with Llama / DeepSeek (Self-Hosted GPUs)
 *
 * Output: Cost / Latency / Throughput comparison
 */

import {
  generateComparison,
  SAMPLE_WORKLOADS,
  Workload,
  FullEstimate,
  ComparisonReport,
} from './cost-model.js';

// ============================================================================
// FORMATTING HELPERS
// ============================================================================

function formatCurrency(value: number): string {
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  if (value >= 1) return `$${value.toFixed(2)}`;
  return `$${value.toFixed(4)}`;
}

function formatLatency(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms.toFixed(0)}ms`;
}

function formatThroughput(tps: number): string {
  return `${tps.toFixed(0)} tok/s`;
}

function getProviderEmoji(provider: string): string {
  const emojis: Record<string, string> = {
    openai: '🟢',
    anthropic: '🟣',
    fireworks: '🔥',
    together: '🤝',
    groq: '⚡',
    modal: '🖥️',
  };
  return emojis[provider] || '📦';
}

function getLayerEmoji(layer: string): string {
  if (layer === 'application') return '📱';
  if (layer === 'serving') return '🚀';
  return '🏗️';
}

// ============================================================================
// REPORT RENDERING
// ============================================================================

function printHeader() {
  console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║    🏔️  PeakInfer - Full-Stack Inference Cost Comparison                      ║
║                                                                              ║
║    Comparing: OpenAI → Anthropic → Fireworks AI → Modal (Self-Hosted)        ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
`);
}

function printWorkload(workload: Workload) {
  console.log(`
┌──────────────────────────────────────────────────────────────────────────────┐
│  📋 WORKLOAD: ${workload.name.padEnd(58)}│
├──────────────────────────────────────────────────────────────────────────────┤
│  ${workload.description.padEnd(74)}│
│                                                                              │
│  📊 Volume:     ${workload.requestsPerDay.toLocaleString().padEnd(10)} requests/day                                   │
│  📝 Tokens:     ${workload.avgInputTokens} input → ${workload.avgOutputTokens} output (avg)                              │
│  ⚡ Peak Load:  ${workload.peakRequestsPerMinute} req/min                                                 │
│  🎯 Quality:    ${workload.qualityRequirement.padEnd(10)} | Latency: ${workload.latencyRequirement.padEnd(12)}               │
└──────────────────────────────────────────────────────────────────────────────┘
`);
}

function printComparisonTable(report: ComparisonReport) {
  console.log(`
┌──────────────────────────────────────────────────────────────────────────────┐
│  📊 COST / LATENCY / THROUGHPUT COMPARISON                                   │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Provider/Model              │ Monthly Cost │  Latency  │ Throughput │ Score│
│  ─────────────────────────────┼──────────────┼───────────┼────────────┼──────│`);

  // Group estimates by scenario
  const hostedAPIs = report.estimates.filter(e => e.scenario === 'Hosted API' && ['openai', 'anthropic'].includes(e.provider));
  const alternativeAPIs = report.estimates.filter(e => e.scenario === 'Hosted API' && !['openai', 'anthropic'].includes(e.provider));
  const selfHosted = report.estimates.filter(e => e.scenario === 'Self-Hosted GPU');

  // Print Hosted APIs (OpenAI, Anthropic)
  console.log(`│                                                                              │
│  ── HOSTED APIs (Application Layer) ──────────────────────────────────────── │`);
  for (const est of hostedAPIs) {
    printEstimateRow(est);
  }

  // Print Alternative APIs (Fireworks, Together, Groq)
  console.log(`│                                                                              │
│  ── ALTERNATIVE APIs (Llama, DeepSeek) ───────────────────────────────────── │`);
  for (const est of alternativeAPIs) {
    printEstimateRow(est);
  }

  // Print Self-Hosted (Modal)
  console.log(`│                                                                              │
│  ── SELF-HOSTED GPU (Modal - Infrastructure Layer) ───────────────────────── │`);
  for (const est of selfHosted) {
    printEstimateRow(est);
  }

  console.log(`│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘`);
}

function printEstimateRow(est: FullEstimate) {
  const emoji = getProviderEmoji(est.provider);
  const modelName = `${est.provider}/${est.model}`.substring(0, 28).padEnd(28);
  const cost = formatCurrency(est.cost.monthly).padStart(10);
  const latency = formatLatency(est.latency.totalForAvgRequest).padStart(8);
  const throughput = formatThroughput(est.throughput.tokensPerSecond).padStart(9);
  const score = est.score.overall.toFixed(0).padStart(4);
  const feasible = est.feasible ? '' : ' ⚠️';

  console.log(`│  ${emoji} ${modelName}│ ${cost}   │ ${latency}  │ ${throughput}  │ ${score} │${feasible}`);
}

function printRankings(report: ComparisonReport) {
  const topCost = report.rankings.byCost.slice(0, 3);
  const topLatency = report.rankings.byLatency.slice(0, 3);
  const topThroughput = report.rankings.byThroughput.slice(0, 3);

  console.log(`
┌──────────────────────────────────────────────────────────────────────────────┐
│  🏆 RANKINGS BY DIMENSION                                                    │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  💰 LOWEST COST:                                                             │`);
  topCost.forEach((e, i) => {
    console.log(`│     ${i + 1}. ${getProviderEmoji(e.provider)} ${e.provider}/${e.model.substring(0, 25).padEnd(25)} ${formatCurrency(e.cost.monthly).padStart(10)}/mo │`);
  });

  console.log(`│                                                                              │
│  ⚡ LOWEST LATENCY:                                                          │`);
  topLatency.forEach((e, i) => {
    console.log(`│     ${i + 1}. ${getProviderEmoji(e.provider)} ${e.provider}/${e.model.substring(0, 25).padEnd(25)} ${formatLatency(e.latency.totalForAvgRequest).padStart(10)}    │`);
  });

  console.log(`│                                                                              │
│  🚀 HIGHEST THROUGHPUT:                                                      │`);
  topThroughput.forEach((e, i) => {
    console.log(`│     ${i + 1}. ${getProviderEmoji(e.provider)} ${e.provider}/${e.model.substring(0, 25).padEnd(25)} ${formatThroughput(e.throughput.tokensPerSecond).padStart(10)}   │`);
  });

  console.log(`│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘`);
}

function printRecommendation(report: ComparisonReport) {
  const best = report.recommendation.best;
  const savings = report.recommendation.savings;

  console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║  🎯 PEAKINFER RECOMMENDATION                                                 ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  BEST OPTION: ${getProviderEmoji(best.provider)} ${best.provider}/${best.model}
║                                                                              ║
║  📊 Metrics:                                                                 ║
║     • Monthly Cost:    ${formatCurrency(best.cost.monthly).padEnd(15)}                                     ║
║     • Latency (TTFT):  ${formatLatency(best.latency.ttft).padEnd(15)}                                     ║
║     • Latency (Total): ${formatLatency(best.latency.totalForAvgRequest).padEnd(15)}                                     ║
║     • Throughput:      ${formatThroughput(best.throughput.tokensPerSecond).padEnd(15)}                                     ║
║                                                                              ║
║  💰 Savings vs Current Solutions:                                            ║
║     • vs OpenAI GPT-4o:       ${formatCurrency(savings.vsOpenAI.monthly).padEnd(10)} (${savings.vsOpenAI.percent.toFixed(0)}% savings)                  ║
║     • vs Anthropic Claude:   ${formatCurrency(savings.vsAnthropic.monthly).padEnd(10)} (${savings.vsAnthropic.percent.toFixed(0)}% savings)                  ║
║                                                                              ║`);

  if (report.recommendation.tradeoffs.length > 0) {
    console.log(`║  ⚠️  Tradeoffs to Consider:                                                  ║`);
    for (const tradeoff of report.recommendation.tradeoffs) {
      console.log(`║     • ${tradeoff.substring(0, 68).padEnd(68)} ║`);
    }
    console.log(`║                                                                              ║`);
  }

  console.log(`╚══════════════════════════════════════════════════════════════════════════════╝`);
}

function printMigrationPath(report: ComparisonReport) {
  const openai = report.estimates.find(e => e.provider === 'openai' && e.model === 'gpt-4o');
  const anthropic = report.estimates.find(e => e.provider === 'anthropic' && e.model === 'claude-3-5-sonnet');
  const fireworks = report.estimates.find(e => e.provider === 'fireworks' && e.model.includes('llama'));
  const modal = report.estimates.find(e => e.provider === 'modal' && e.model.includes('llama-3.1-70b') && !e.model.includes('2x'));

  if (!openai || !anthropic || !fireworks || !modal) return;

  console.log(`
┌──────────────────────────────────────────────────────────────────────────────┐
│  🔄 MIGRATION PATH: Application → Alternative API → Self-Hosted              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  STEP 1: Current State (Hosted APIs)                                         │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  🟢 OpenAI GPT-4o         ${formatCurrency(openai.cost.monthly).padStart(10)}/mo   ${formatLatency(openai.latency.totalForAvgRequest).padStart(8)}   ${formatThroughput(openai.throughput.tokensPerSecond).padStart(10)} │ │
│  │  🟣 Anthropic Claude      ${formatCurrency(anthropic.cost.monthly).padStart(10)}/mo   ${formatLatency(anthropic.latency.totalForAvgRequest).padStart(8)}   ${formatThroughput(anthropic.throughput.tokensPerSecond).padStart(10)} │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                              ↓                                               │
│  STEP 2: Migrate to Alternative API (Low Effort)                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  🔥 Fireworks Llama-70B   ${formatCurrency(fireworks.cost.monthly).padStart(10)}/mo   ${formatLatency(fireworks.latency.totalForAvgRequest).padStart(8)}   ${formatThroughput(fireworks.throughput.tokensPerSecond).padStart(10)} │ │
│  │     Savings: ${((1 - fireworks.cost.monthly / openai.cost.monthly) * 100).toFixed(0)}% vs OpenAI                                              │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                              ↓                                               │
│  STEP 3: Self-Host on GPU (Maximum Savings)                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  🖥️ Modal H100 + vLLM     ${formatCurrency(modal.cost.monthly).padStart(10)}/mo   ${formatLatency(modal.latency.totalForAvgRequest).padStart(8)}   ${formatThroughput(modal.throughput.tokensPerSecond).padStart(10)} │ │
│  │     Savings: ${((1 - modal.cost.monthly / openai.cost.monthly) * 100).toFixed(0)}% vs OpenAI                                              │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  📈 Total Potential Savings: ${formatCurrency(openai.cost.monthly - modal.cost.monthly).padStart(10)}/mo (${((1 - modal.cost.monthly / openai.cost.monthly) * 100).toFixed(0)}%)                            │
└──────────────────────────────────────────────────────────────────────────────┘
`);
}

function printSummaryTable(report: ComparisonReport) {
  const workload = report.workload;

  // Get key scenarios with safe lookups
  const openai = report.estimates.find(e => e.provider === 'openai' && e.model === 'gpt-4o');
  const anthropic = report.estimates.find(e => e.provider === 'anthropic' && e.model === 'claude-3-5-sonnet');
  const fireworksLlama = report.estimates.find(e => e.provider === 'fireworks' && e.model.includes('llama'));
  const fireworksDeepseek = report.estimates.find(e => e.provider === 'fireworks' && e.model.toLowerCase().includes('deepseek'));
  const modalLlama = report.estimates.find(e => e.provider === 'modal' && e.model.toLowerCase().includes('llama') && !e.model.includes('2x') && !e.model.includes('4bit') && !e.model.includes('8b'));
  const modalDeepseek = report.estimates.find(e => e.provider === 'modal' && e.model.toLowerCase().includes('deepseek') && e.model.includes('H100'));

  // Skip if we don't have all the required data
  if (!openai || !anthropic || !fireworksLlama || !fireworksDeepseek || !modalLlama || !modalDeepseek) {
    console.log(`  (Skipping summary table - some providers not found)`);
    return;
  }

  console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║  📊 EXECUTIVE SUMMARY: ${workload.name.padEnd(52)}║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  Scenario                    │  Monthly Cost  │   Latency    │  Throughput   ║
║  ────────────────────────────┼────────────────┼──────────────┼───────────────║
║  🟢 OpenAI GPT-4o            │  ${formatCurrency(openai.cost.monthly).padStart(12)}  │  ${formatLatency(openai.latency.totalForAvgRequest).padStart(10)}  │  ${formatThroughput(openai.throughput.tokensPerSecond).padStart(11)}  ║
║  🟣 Anthropic Claude         │  ${formatCurrency(anthropic.cost.monthly).padStart(12)}  │  ${formatLatency(anthropic.latency.totalForAvgRequest).padStart(10)}  │  ${formatThroughput(anthropic.throughput.tokensPerSecond).padStart(11)}  ║
║  ────────────────────────────┼────────────────┼──────────────┼───────────────║
║  🔥 Fireworks + Llama-70B    │  ${formatCurrency(fireworksLlama.cost.monthly).padStart(12)}  │  ${formatLatency(fireworksLlama.latency.totalForAvgRequest).padStart(10)}  │  ${formatThroughput(fireworksLlama.throughput.tokensPerSecond).padStart(11)}  ║
║  🔥 Fireworks + DeepSeek     │  ${formatCurrency(fireworksDeepseek.cost.monthly).padStart(12)}  │  ${formatLatency(fireworksDeepseek.latency.totalForAvgRequest).padStart(10)}  │  ${formatThroughput(fireworksDeepseek.throughput.tokensPerSecond).padStart(11)}  ║
║  ────────────────────────────┼────────────────┼──────────────┼───────────────║
║  🖥️ Modal H100 + Llama-70B   │  ${formatCurrency(modalLlama.cost.monthly).padStart(12)}  │  ${formatLatency(modalLlama.latency.totalForAvgRequest).padStart(10)}  │  ${formatThroughput(modalLlama.throughput.tokensPerSecond).padStart(11)}  ║
║  🖥️ Modal H100 + DeepSeek    │  ${formatCurrency(modalDeepseek.cost.monthly).padStart(12)}  │  ${formatLatency(modalDeepseek.latency.totalForAvgRequest).padStart(10)}  │  ${formatThroughput(modalDeepseek.throughput.tokensPerSecond).padStart(11)}  ║
╚══════════════════════════════════════════════════════════════════════════════╝
`);
}

// ============================================================================
// MAIN
// ============================================================================

function runDemo() {
  printHeader();

  // Run comparison for each sample workload
  for (const workload of SAMPLE_WORKLOADS) {
    printWorkload(workload);

    const report = generateComparison(workload);

    printSummaryTable(report);
    printMigrationPath(report);
    printRankings(report);
    printRecommendation(report);

    console.log('\n' + '═'.repeat(80) + '\n');
  }

  // Final summary
  console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║  🏔️  PeakInfer Full-Stack Inference Optimization                             ║
║                                                                              ║
║  Key Insights:                                                               ║
║                                                                              ║
║  1. 💰 COST: Self-hosted on Modal can save 70-90% vs OpenAI/Anthropic        ║
║              Alternative APIs (Fireworks) save 50-70% with no DevOps         ║
║                                                                              ║
║  2. ⚡ LATENCY: Groq LPU offers lowest latency (3ms/token)                   ║
║                 Self-hosted vLLM competitive at 8-10ms/token                 ║
║                                                                              ║
║  3. 🚀 THROUGHPUT: Self-hosted scales with GPU count                         ║
║                    Hosted APIs limited by rate limits                        ║
║                                                                              ║
║  Recommendation: Start with Fireworks AI for quick wins, then migrate to    ║
║  self-hosted on Modal for maximum savings at scale.                          ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
`);
}

// Run if executed directly
runDemo();
