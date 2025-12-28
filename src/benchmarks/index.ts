/**
 * InferenceMAX Benchmark Integration
 *
 * Provides benchmark comparison for LLM inference performance.
 * Data sourced from the InferenceMAX benchmark suite.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface BenchmarkMetrics {
  ttft_ms: number;
  p50_latency_ms: number;
  p95_latency_ms: number;
  p99_latency_ms: number;
  throughput_tps: number;
  cost_per_1k_input: number;
  cost_per_1k_output: number;
}

interface BenchmarkEntry {
  model: string;
  provider: string;
  framework: string;
  hardware: string;
  metrics: BenchmarkMetrics;
  optimal_config?: Record<string, unknown>;
  notes?: string;
}

interface BenchmarkData {
  version: string;
  last_updated: string;
  source: string;
  benchmarks: Record<string, BenchmarkEntry>;
  model_aliases: Record<string, string>;
}

export interface BenchmarkComparison {
  pointId: string;
  model: string;
  framework: string;
  hardware: string;
  your_metrics: {
    p95_latency_ms?: number;
    ttft_ms?: number;
    throughput_tps?: number;
  };
  benchmark_metrics: BenchmarkMetrics;
  gaps: {
    p95_latency?: { value: number; percent: number; description: string };
    ttft?: { value: number; percent: number; description: string };
    throughput?: { value: number; percent: number; description: string };
  };
  overall_gap: string;
  optimal_config?: Record<string, unknown>;
}

let benchmarkData: BenchmarkData | null = null;

/**
 * Load benchmark data from JSON file
 */
function loadBenchmarks(): BenchmarkData {
  if (benchmarkData) return benchmarkData;

  try {
    const dataPath = join(__dirname, '../../data/inferencemax.json');
    const content = readFileSync(dataPath, 'utf-8');
    benchmarkData = JSON.parse(content) as BenchmarkData;
    return benchmarkData;
  } catch (error) {
    throw new Error(`Failed to load benchmark data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Normalize model name for lookup
 */
function normalizeModel(model: string): string {
  return model
    .toLowerCase()
    .replace(/[_\s]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Get benchmark for a specific model
 */
export function getBenchmark(
  model: string,
  framework = 'api',
  hardware = 'api'
): BenchmarkEntry | null {
  const data = loadBenchmarks();
  const normalizedModel = normalizeModel(model);

  // Try exact key match first
  const exactKey = `${normalizedModel}:${framework}:${hardware}`;
  if (data.benchmarks[exactKey]) {
    return data.benchmarks[exactKey];
  }

  // Try alias lookup
  const alias = data.model_aliases[normalizedModel];
  if (alias && data.benchmarks[alias]) {
    return data.benchmarks[alias];
  }

  // Try model name with default framework:hardware
  const defaultKey = `${normalizedModel}:api:api`;
  if (data.benchmarks[defaultKey]) {
    return data.benchmarks[defaultKey];
  }

  // Try partial model name matches
  for (const key of Object.keys(data.benchmarks)) {
    const benchModel = normalizeModel(data.benchmarks[key].model);
    if (benchModel.includes(normalizedModel) || normalizedModel.includes(benchModel)) {
      return data.benchmarks[key];
    }
  }

  return null;
}

/**
 * Compare user metrics to benchmark
 */
export function compareToBenchmark(
  pointId: string,
  model: string,
  userMetrics: {
    p95_latency_ms?: number;
    ttft_ms?: number;
    throughput_tps?: number;
  },
  framework = 'api',
  hardware = 'api'
): BenchmarkComparison | null {
  const benchmark = getBenchmark(model, framework, hardware);
  if (!benchmark) return null;

  const gaps: BenchmarkComparison['gaps'] = {};

  // P95 Latency gap
  if (userMetrics.p95_latency_ms && benchmark.metrics.p95_latency_ms) {
    const diff = userMetrics.p95_latency_ms - benchmark.metrics.p95_latency_ms;
    const percent = Math.round((diff / benchmark.metrics.p95_latency_ms) * 100);
    gaps.p95_latency = {
      value: diff,
      percent,
      description: formatGapDescription(diff, percent, 'ms', 'slower', 'faster'),
    };
  }

  // TTFT gap
  if (userMetrics.ttft_ms && benchmark.metrics.ttft_ms) {
    const diff = userMetrics.ttft_ms - benchmark.metrics.ttft_ms;
    const percent = Math.round((diff / benchmark.metrics.ttft_ms) * 100);
    gaps.ttft = {
      value: diff,
      percent,
      description: formatGapDescription(diff, percent, 'ms', 'slower', 'faster'),
    };
  }

  // Throughput gap (inverse - higher is better)
  if (userMetrics.throughput_tps && benchmark.metrics.throughput_tps) {
    const diff = benchmark.metrics.throughput_tps - userMetrics.throughput_tps;
    const percent = Math.round((diff / benchmark.metrics.throughput_tps) * 100);
    gaps.throughput = {
      value: -diff, // Negative means user is faster
      percent: -percent,
      description: formatGapDescription(diff, percent, 'tps', 'below', 'above'),
    };
  }

  // Calculate overall gap description
  const overallGap = calculateOverallGap(gaps);

  return {
    pointId,
    model: benchmark.model,
    framework: benchmark.framework,
    hardware: benchmark.hardware,
    your_metrics: userMetrics,
    benchmark_metrics: benchmark.metrics,
    gaps,
    overall_gap: overallGap,
    optimal_config: benchmark.optimal_config,
  };
}

function formatGapDescription(
  diff: number,
  percent: number,
  unit: string,
  worseWord: string,
  betterWord: string
): string {
  if (diff === 0 || percent === 0) {
    return 'On par with benchmark';
  }

  const absPercent = Math.abs(percent);
  const absDiff = Math.abs(diff);
  const word = diff > 0 ? worseWord : betterWord;

  if (absPercent > 100) {
    const multiplier = (absPercent / 100 + 1).toFixed(1);
    return `${multiplier}x ${word}`;
  }

  return `${absPercent}% ${word} (${diff > 0 ? '+' : ''}${absDiff}${unit})`;
}

function calculateOverallGap(gaps: BenchmarkComparison['gaps']): string {
  const issues: string[] = [];

  if (gaps.p95_latency && gaps.p95_latency.percent > 50) {
    issues.push(`latency ${gaps.p95_latency.description}`);
  }

  if (gaps.ttft && gaps.ttft.percent > 50) {
    issues.push(`TTFT ${gaps.ttft.description}`);
  }

  if (gaps.throughput && gaps.throughput.percent < -30) {
    issues.push(`throughput ${gaps.throughput.description}`);
  }

  if (issues.length === 0) {
    if (Object.keys(gaps).length === 0) {
      return 'No metrics to compare';
    }
    return 'Performing within benchmark range';
  }

  return issues.join(', ');
}

/**
 * Get all available benchmarks
 */
export function listBenchmarks(): BenchmarkEntry[] {
  const data = loadBenchmarks();
  return Object.values(data.benchmarks);
}

/**
 * Get benchmark data version
 */
export function getBenchmarkVersion(): { version: string; lastUpdated: string } {
  const data = loadBenchmarks();
  return {
    version: data.version,
    lastUpdated: data.last_updated,
  };
}

/**
 * Check if benchmark data is available for a model
 */
export function hasBenchmark(model: string): boolean {
  return getBenchmark(model) !== null;
}

/**
 * Format benchmark comparison for display
 */
export function formatBenchmarkComparison(comparison: BenchmarkComparison): string {
  const lines: string[] = [];

  lines.push(`Model: ${comparison.model}`);
  lines.push(`Framework: ${comparison.framework} | Hardware: ${comparison.hardware}`);
  lines.push('');

  if (comparison.gaps.p95_latency) {
    lines.push(`P95 Latency: Your ${comparison.your_metrics.p95_latency_ms}ms | Benchmark ${comparison.benchmark_metrics.p95_latency_ms}ms | ${comparison.gaps.p95_latency.description}`);
  }

  if (comparison.gaps.ttft) {
    lines.push(`TTFT: Your ${comparison.your_metrics.ttft_ms}ms | Benchmark ${comparison.benchmark_metrics.ttft_ms}ms | ${comparison.gaps.ttft.description}`);
  }

  if (comparison.gaps.throughput) {
    lines.push(`Throughput: Your ${comparison.your_metrics.throughput_tps} tps | Benchmark ${comparison.benchmark_metrics.throughput_tps} tps | ${comparison.gaps.throughput.description}`);
  }

  lines.push('');
  lines.push(`Overall: ${comparison.overall_gap}`);

  if (comparison.optimal_config) {
    lines.push('');
    lines.push('Optimal Config:');
    for (const [key, value] of Object.entries(comparison.optimal_config)) {
      lines.push(`  ${key}: ${value}`);
    }
  }

  return lines.join('\n');
}
