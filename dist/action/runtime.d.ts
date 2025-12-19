import { InferenceEvent, RuntimeSummary, NormalizationOptions, NormalizationResult } from './types.js';
/**
 * Extended parse result with normalization metadata.
 */
export interface ParseResult {
    events: InferenceEvent[];
    normalization?: NormalizationResult;
    warnings: string[];
}
/**
 * Parse runtime events from a file.
 *
 * This function implements the format detection pipeline (PRD §6.4):
 * 1. Try direct parsing for known formats (JSONL, JSON, CSV)
 * 2. Fall back to agent-based normalization for unknown formats
 * 3. Apply streaming inference heuristics
 *
 * @param path - Path to the events file
 * @param options - Normalization options (format hints, mappings, etc.)
 */
export declare function parseEvents(path: string, options?: NormalizationOptions): Promise<InferenceEvent[]>;
/**
 * Parse runtime events with full normalization metadata.
 * Use this for detailed reporting on format detection and field mappings.
 */
export declare function parseEventsWithMetadata(path: string, options?: NormalizationOptions): Promise<ParseResult>;
export declare function percentile(values: number[], p: number): number;
export declare function aggregate(events: InferenceEvent[]): RuntimeSummary;
