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
import type { InferenceMap, PredictionResult } from './types.js';
export interface PredictOptions {
    targetP95?: number;
    includeHistorical?: boolean;
}
/**
 * Generate predictions for inference points.
 */
export declare function generatePredictions(inferenceMap: InferenceMap, historicalRuns?: number, options?: PredictOptions): PredictionResult;
/**
 * Generate predictions with historical context.
 */
export declare function generatePredictionsWithHistory(inferenceMap: InferenceMap, path: string, options?: PredictOptions): Promise<PredictionResult>;
/**
 * Format a prediction summary for display.
 */
export declare function formatPredictionSummary(result: PredictionResult): string;
/**
 * Check if predictions have any high-risk items.
 */
export declare function hasHighRiskPredictions(result: PredictionResult): boolean;
