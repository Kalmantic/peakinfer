/**
 * Format Normalizer - Agent-based runtime event format detection and normalization.
 *
 * This module implements PRD §6.4: Enable PeakInfer to ingest runtime data from any
 * observability system, logging framework, or custom format without requiring users
 * to transform their data first.
 *
 * Design Principles (Julie Zhou aligned):
 * - Behavior First: Detect formats automatically, fallback gracefully
 * - Clarity Over Cleverness: Clear confidence scores, no silent assumptions
 * - State Completeness: Handle all format states (known, agent-required, unknown)
 */
import type { FormatType, FieldMapping, FormatDetectionResult, NormalizationResult, NormalizationOptions, InferenceEvent } from './types.js';
/**
 * Detect the format type of a runtime events file.
 *
 * Detection strategy:
 * 1. Try file extension heuristics
 * 2. Sample content and check against known signatures
 * 3. Fall back to agent-based detection for unknown formats
 */
export declare function detectFormat(content: string, filename?: string): FormatDetectionResult;
/**
 * Use LLM agent to normalize an unknown format.
 */
export declare function normalizeWithAgent(content: string, detection: FormatDetectionResult, options?: NormalizationOptions): Promise<NormalizationResult>;
/**
 * Extract InferenceEvents from normalized data using field mappings.
 */
export declare function extractEvents(content: string, normalization: NormalizationResult): {
    events: InferenceEvent[];
    errors: string[];
};
/**
 * Main entry point: Detect format and normalize runtime events.
 *
 * This function implements the complete normalization pipeline:
 * 1. Detect format type from content
 * 2. For direct-parse formats (JSONL, JSON array), parse directly
 * 3. Apply predefined mappings for known complex formats
 * 4. Use agent for unknown formats (if API key available)
 */
export declare function normalizeRuntimeEvents(content: string, options?: NormalizationOptions): Promise<{
    events: InferenceEvent[];
    normalization: NormalizationResult;
    errors: string[];
}>;
/**
 * Get predefined mappings for a known format type.
 */
export declare function getPredefinedMappings(formatType: FormatType): FieldMapping[] | undefined;
/**
 * Check if a format type requires agent normalization.
 */
export declare function requiresAgentNormalization(formatType: FormatType): boolean;
