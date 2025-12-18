import type { PerformanceEnvelope } from './types.js';
export declare const ENVELOPES: Record<string, PerformanceEnvelope>;
/**
 * Get performance envelope for a model.
 *
 * @param model - Model name (e.g., "gpt-4o", "llama-3-70b")
 * @param runtime - Optional runtime (e.g., "vllm", "sglang")
 * @returns Performance envelope or null if not found
 */
export declare function getEnvelope(model: string, runtime?: string): PerformanceEnvelope | null;
/**
 * Calculate throughput percentage against reference envelope.
 *
 * @param model - Model name
 * @param actualTps - Actual tokens per second observed
 * @param runtime - Optional runtime
 * @returns Percentage (0-100+) or null if no envelope found
 */
export declare function getThroughputPercent(model: string, actualTps: number, runtime?: string): number | null;
/**
 * Check if TTFT is within expected range.
 *
 * @param model - Model name
 * @param actualTtft - Actual time to first token in ms
 * @param runtime - Optional runtime
 * @returns 'fast' | 'normal' | 'slow' | null
 */
export declare function getTtftStatus(model: string, actualTtft: number, runtime?: string): 'fast' | 'normal' | 'slow' | null;
/**
 * Get all available model names in envelopes.
 */
export declare function getAvailableModels(): string[];
