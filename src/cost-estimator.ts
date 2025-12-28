/**
 * Cost Estimation Module for PeakInfer CLI
 *
 * Estimates LLM API costs before running analysis to prevent surprise bills
 * on large repositories. Uses LiteLLM pricing data with 24hr cache.
 *
 * PRD v1.9.3 Section 2.3: Cost Estimation (Pre-Analysis Transparency)
 */

import { scan } from './scanner.js';
import { loadPricing, getModelCost } from './costs.js';

// =============================================================================
// TYPES
// =============================================================================

export interface CostEstimate {
  model: string;
  filesToScan: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  pricing: {
    inputPerMillion: number;
    outputPerMillion: number;
    source: 'litellm' | 'fallback';
  };
  warnings: CostWarning[];
}

export interface CostWarning {
  level: 'yellow' | 'red' | 'critical';
  message: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

// Token estimation constants (based on empirical analysis of codebases)
const AVG_TOKENS_PER_FILE = 2000;  // Average input tokens per code file
const AVG_OUTPUT_RATIO = 0.35;     // Output tokens as ratio of input

// Warning thresholds (in USD)
const WARNING_THRESHOLD_YELLOW = 5;
const WARNING_THRESHOLD_RED = 20;
const WARNING_THRESHOLD_CRITICAL = 100;

// Default model if not specified (matches agent.ts default)
const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

// Fallback pricing if LiteLLM fetch fails (Claude Sonnet pricing)
const FALLBACK_PRICING = {
  input: 3.00,   // $3.00 per 1M input tokens
  output: 15.00, // $15.00 per 1M output tokens
};

// =============================================================================
// MAIN FUNCTION
// =============================================================================

/**
 * Estimate the cost of analyzing a codebase before running the analysis.
 *
 * @param path - Path to the codebase to analyze
 * @param options - Optional model override
 * @returns Cost estimate with warnings
 */
export async function estimateAnalysisCost(
  path: string,
  options: { model?: string } = {}
): Promise<CostEstimate> {
  const model = options.model || DEFAULT_MODEL;

  // Step 1: Scan codebase to count files
  const scanResult = await scan(path);
  const filesToScan = scanResult.summary.totalFiles;

  // Step 2: Estimate tokens
  const estimatedInputTokens = filesToScan * AVG_TOKENS_PER_FILE;
  const estimatedOutputTokens = Math.round(estimatedInputTokens * AVG_OUTPUT_RATIO);

  // Step 3: Load pricing data
  await loadPricing();
  const modelCost = getModelCost(model);

  // Determine if using LiteLLM or fallback
  const useFallback = modelCost.input === 0 && modelCost.output === 0;
  const pricing = useFallback
    ? { input: FALLBACK_PRICING.input, output: FALLBACK_PRICING.output }
    : { input: modelCost.input, output: modelCost.output };

  // Step 4: Calculate costs
  const inputCost = (estimatedInputTokens * pricing.input) / 1_000_000;
  const outputCost = (estimatedOutputTokens * pricing.output) / 1_000_000;
  const totalCost = inputCost + outputCost;

  // Step 5: Generate warnings based on cost
  const warnings: CostWarning[] = [];

  if (totalCost > WARNING_THRESHOLD_CRITICAL) {
    warnings.push({
      level: 'critical',
      message: 'Very high cost estimate. Strongly recommend limiting scope.',
    });
  } else if (totalCost > WARNING_THRESHOLD_RED) {
    warnings.push({
      level: 'red',
      message: 'High cost estimate. Consider analyzing a subdirectory.',
    });
  } else if (totalCost > WARNING_THRESHOLD_YELLOW) {
    warnings.push({
      level: 'yellow',
      message: 'Moderate cost. Consider analyzing a subdirectory for faster results.',
    });
  }

  return {
    model,
    filesToScan,
    estimatedInputTokens,
    estimatedOutputTokens,
    inputCost,
    outputCost,
    totalCost,
    pricing: {
      inputPerMillion: pricing.input,
      outputPerMillion: pricing.output,
      source: useFallback ? 'fallback' : 'litellm',
    },
    warnings,
  };
}

/**
 * Check if estimated cost exceeds a threshold.
 *
 * @param estimate - Cost estimate to check
 * @param maxCost - Maximum allowed cost in USD
 * @returns true if cost exceeds threshold
 */
export function exceedsMaxCost(estimate: CostEstimate, maxCost: number): boolean {
  return estimate.totalCost > maxCost;
}
