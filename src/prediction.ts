/**
 * Deploy-Time Prediction Module (v1.5)
 *
 * Generates latency predictions for inference points based on:
 * - Model characteristics (from pricing/envelopes data)
 * - Historical runtime data (if available)
 * - Pattern detection (streaming, batching, caching)
 *
 * Surfaces potential performance risks before deployment
 * to enable informed deployment decisions.
 */

import type {
  Callsite,
  InferenceMap,
  RuntimeSummary,
  PredictionResult,
  InferencePointPrediction,
  PredictionSummary,
  PredictionFactor,
  RiskLevel,
  LatencyPercentiles,
} from './types.js';
import { listRuns, loadRun } from './history.js';

// =============================================================================
// CONSTANTS
// =============================================================================

// Model latency estimates (ms) - heuristic defaults
const MODEL_LATENCY_ESTIMATES: Record<string, LatencyPercentiles> = {
  // OpenAI models
  'gpt-4': { p50: 2000, p95: 5000, p99: 8000 },
  'gpt-4-turbo': { p50: 1500, p95: 4000, p99: 6000 },
  'gpt-4o': { p50: 1000, p95: 2500, p99: 4000 },
  'gpt-4o-mini': { p50: 500, p95: 1500, p99: 2500 },
  'gpt-3.5-turbo': { p50: 500, p95: 1500, p99: 2500 },
  'o1-preview': { p50: 5000, p95: 15000, p99: 30000 },
  'o1-mini': { p50: 2000, p95: 6000, p99: 10000 },

  // Anthropic models
  'claude-3-opus': { p50: 3000, p95: 8000, p99: 15000 },
  'claude-3-sonnet': { p50: 1500, p95: 4000, p99: 7000 },
  'claude-3-haiku': { p50: 500, p95: 1500, p99: 2500 },
  'claude-3.5-sonnet': { p50: 1200, p95: 3500, p99: 6000 },

  // Google models
  'gemini-pro': { p50: 1000, p95: 3000, p99: 5000 },
  'gemini-1.5-pro': { p50: 1500, p95: 4000, p99: 7000 },
  'gemini-1.5-flash': { p50: 300, p95: 800, p99: 1500 },

  // Default for unknown models
  'unknown': { p50: 1000, p95: 3000, p99: 5000 },
};

// Risk thresholds (p95 latency in ms)
const RISK_THRESHOLDS = {
  high: 5000,    // > 5s p95 = high risk
  medium: 2000,  // > 2s p95 = medium risk
  low: 500,      // > 500ms p95 = low risk
};

// =============================================================================
// TYPES
// =============================================================================

export interface PredictOptions {
  targetP95?: number;         // User-specified target p95 latency (ms)
  includeHistorical?: boolean; // Include historical data if available
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Get model latency estimate from known models or default.
 */
function getModelLatencyEstimate(model: string | null): LatencyPercentiles {
  if (!model) return MODEL_LATENCY_ESTIMATES['unknown'];

  // Try exact match first
  const normalized = model.toLowerCase();
  for (const [key, estimate] of Object.entries(MODEL_LATENCY_ESTIMATES)) {
    if (normalized.includes(key.toLowerCase())) {
      return estimate;
    }
  }

  return MODEL_LATENCY_ESTIMATES['unknown'];
}

/**
 * Calculate risk level based on p95 latency.
 */
function calculateRiskLevel(p95: number): RiskLevel {
  if (p95 > RISK_THRESHOLDS.high) return 'high';
  if (p95 > RISK_THRESHOLDS.medium) return 'medium';
  if (p95 > RISK_THRESHOLDS.low) return 'low';
  return 'neutral';
}

/**
 * Calculate risk score (0-100) based on p95 latency.
 */
function calculateRiskScore(p95: number): number {
  // Scale: 0ms = 0, 10000ms = 100
  return Math.min(100, Math.round((p95 / 10000) * 100));
}

/**
 * Generate prediction factors based on inference point patterns.
 */
function generateFactors(callsite: Callsite): PredictionFactor[] {
  const factors: PredictionFactor[] = [];

  // Model complexity factor
  if (callsite.model) {
    const isComplex = callsite.model.toLowerCase().includes('opus') ||
                      callsite.model.toLowerCase().includes('gpt-4') ||
                      callsite.model.toLowerCase().includes('o1');
    factors.push({
      name: 'Model complexity',
      impact: isComplex ? 'negative' : 'positive',
      description: isComplex
        ? `${callsite.model} is a high-capability model with longer inference times`
        : `${callsite.model} is optimized for speed`,
      weight: 0.4,
    });
  }

  // Streaming factor
  if (callsite.patterns?.streaming) {
    factors.push({
      name: 'Streaming enabled',
      impact: 'positive',
      description: 'Streaming reduces perceived latency with incremental responses',
      weight: 0.2,
    });
  } else {
    factors.push({
      name: 'No streaming',
      impact: 'negative',
      description: 'Synchronous requests block until complete response',
      weight: 0.1,
    });
  }

  // Batching factor
  if (callsite.patterns?.batching) {
    factors.push({
      name: 'Batching enabled',
      impact: 'positive',
      description: 'Batching improves throughput and reduces per-request overhead',
      weight: 0.2,
    });
  }

  // Caching factor
  if (callsite.patterns?.caching) {
    factors.push({
      name: 'Caching enabled',
      impact: 'positive',
      description: 'Cache hits bypass LLM entirely for near-zero latency',
      weight: 0.3,
    });
  }

  // Retry factor
  if (callsite.patterns?.retries) {
    factors.push({
      name: 'Retry logic',
      impact: 'neutral',
      description: 'Retries improve reliability but may increase tail latency',
      weight: 0.1,
    });
  }

  // Provider factor
  if (callsite.provider) {
    const provider = callsite.provider.toLowerCase();
    if (provider === 'openai' || provider === 'anthropic') {
      factors.push({
        name: 'Cloud provider',
        impact: 'neutral',
        description: `${callsite.provider} hosted service with variable latency`,
        weight: 0.1,
      });
    } else if (['vllm', 'sglang', 'tgi', 'ollama'].includes(provider)) {
      factors.push({
        name: 'Self-hosted runtime',
        impact: 'positive',
        description: 'Self-hosted inference offers consistent, controllable latency',
        weight: 0.2,
      });
    }
  }

  return factors;
}

/**
 * Adjust latency estimate based on patterns.
 */
function adjustLatencyForPatterns(
  base: LatencyPercentiles,
  patterns: Callsite['patterns']
): LatencyPercentiles {
  let multiplier = 1.0;

  // Streaming doesn't change total latency but improves UX
  // We still report actual latency

  // Batching can reduce per-request latency
  if (patterns?.batching) {
    multiplier *= 0.8;
  }

  // Caching dramatically reduces effective latency (assuming 50% hit rate)
  if (patterns?.caching) {
    multiplier *= 0.6;
  }

  return {
    p50: Math.round(base.p50 * multiplier),
    p95: Math.round(base.p95 * multiplier),
    p99: Math.round(base.p99 * multiplier),
  };
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Generate predictions for inference points.
 */
export function generatePredictions(
  inferenceMap: InferenceMap,
  historicalRuns: number = 0,
  options: PredictOptions = {}
): PredictionResult {
  const predictions: InferencePointPrediction[] = [];

  for (const callsite of inferenceMap.callsites) {
    // Get base latency estimate from model
    const baseLatency = getModelLatencyEstimate(callsite.model);

    // Adjust for patterns
    const predictedLatency = adjustLatencyForPatterns(baseLatency, callsite.patterns);

    // Generate factors
    const factors = generateFactors(callsite);

    // Calculate risk
    const risk = calculateRiskLevel(predictedLatency.p95);
    const riskScore = calculateRiskScore(predictedLatency.p95);

    // Determine confidence
    const hasModel = !!callsite.model;
    const hasPatterns = Object.values(callsite.patterns || {}).some(v => v);
    const confidence = hasModel && hasPatterns ? 'high' :
                       hasModel || hasPatterns ? 'medium' : 'low';

    predictions.push({
      inferencePointId: callsite.id,
      location: `${callsite.file}:${callsite.line}`,
      provider: callsite.provider || undefined,
      model: callsite.model || undefined,
      predictedLatency,
      risk,
      riskScore,
      factors,
      confidence,
      confidenceReason: confidence === 'low'
        ? 'Limited information available for accurate prediction'
        : confidence === 'medium'
        ? 'Based on model characteristics'
        : 'Based on model and pattern analysis',
    });
  }

  // Calculate summary
  const summary = calculateSummary(predictions, options.targetP95);

  return {
    predictions,
    summary,
    targetP95: options.targetP95,
    generatedAt: new Date().toISOString(),
    basedOnRuns: historicalRuns,
  };
}

/**
 * Calculate prediction summary.
 */
function calculateSummary(
  predictions: InferencePointPrediction[],
  targetP95?: number
): PredictionSummary {
  if (predictions.length === 0) {
    return {
      totalPoints: 0,
      highRiskCount: 0,
      mediumRiskCount: 0,
      lowRiskCount: 0,
      averageP95: 0,
      worstP95: 0,
    };
  }

  const p95Values = predictions.map(p => p.predictedLatency.p95);
  const averageP95 = Math.round(p95Values.reduce((a, b) => a + b, 0) / p95Values.length);
  const worstP95 = Math.max(...p95Values);

  return {
    totalPoints: predictions.length,
    highRiskCount: predictions.filter(p => p.risk === 'high').length,
    mediumRiskCount: predictions.filter(p => p.risk === 'medium').length,
    lowRiskCount: predictions.filter(p => p.risk === 'low').length,
    averageP95,
    worstP95,
    budgetExceeded: targetP95 ? worstP95 > targetP95 : undefined,
  };
}

/**
 * Generate predictions with historical context.
 */
export async function generatePredictionsWithHistory(
  inferenceMap: InferenceMap,
  path: string,
  options: PredictOptions = {}
): Promise<PredictionResult> {
  // Get historical runs for context
  const runs = listRuns(path);
  const historicalCount = runs.length;

  // Generate predictions
  const result = generatePredictions(inferenceMap, historicalCount, options);

  // If we have historical data with runtime info, we could enhance predictions
  // For now, we use heuristic-based predictions
  // Future: Use actual runtime data from historical runs

  return result;
}

/**
 * Format a prediction summary for display.
 */
export function formatPredictionSummary(result: PredictionResult): string {
  const { summary, targetP95 } = result;
  const lines: string[] = [];

  lines.push(`Deploy-time prediction for ${summary.totalPoints} inference points`);
  lines.push('');

  // Risk breakdown
  if (summary.highRiskCount > 0) {
    lines.push(`  [!] ${summary.highRiskCount} high-risk (p95 > ${RISK_THRESHOLDS.high}ms)`);
  }
  if (summary.mediumRiskCount > 0) {
    lines.push(`  [*] ${summary.mediumRiskCount} medium-risk (p95 > ${RISK_THRESHOLDS.medium}ms)`);
  }
  if (summary.lowRiskCount > 0) {
    lines.push(`  [-] ${summary.lowRiskCount} low-risk`);
  }

  lines.push('');
  lines.push(`  Average p95: ${summary.averageP95}ms`);
  lines.push(`  Worst p95: ${summary.worstP95}ms`);

  // Budget check
  if (targetP95) {
    if (summary.budgetExceeded) {
      lines.push(`  [!] Budget exceeded: worst p95 ${summary.worstP95}ms > target ${targetP95}ms`);
    } else {
      lines.push(`  [✓] Within budget: worst p95 ${summary.worstP95}ms <= target ${targetP95}ms`);
    }
  }

  return lines.join('\n');
}

/**
 * Check if predictions have any high-risk items.
 */
export function hasHighRiskPredictions(result: PredictionResult): boolean {
  return result.summary.highRiskCount > 0;
}
