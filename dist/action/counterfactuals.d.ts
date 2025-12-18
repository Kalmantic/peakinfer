/**
 * Counterfactual Insights Module (v1.5)
 *
 * Generates "what if" optimization scenarios for inference points based on:
 * - Model alternatives (cheaper/faster models)
 * - Pattern opportunities (batching, caching, streaming)
 * - Provider alternatives (cloud vs self-hosted)
 *
 * Shows the road not taken and its potential impact,
 * enabling informed optimization decisions.
 */
import type { InferenceMap, Counterfactual, CounterfactualResult } from './types.js';
/**
 * Generate counterfactual insights for inference points.
 */
export declare function generateCounterfactuals(inferenceMap: InferenceMap): CounterfactualResult;
/**
 * Format counterfactual summary for display.
 */
export declare function formatCounterfactualSummary(result: CounterfactualResult): string;
/**
 * Check if there are significant counterfactual opportunities.
 */
export declare function hasSignificantOpportunities(result: CounterfactualResult): boolean;
/**
 * Rank counterfactuals by a specific priority.
 */
export declare function rankCounterfactuals(result: CounterfactualResult, priority: 'latency' | 'cost' | 'balanced'): Counterfactual[];
