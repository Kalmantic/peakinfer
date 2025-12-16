/**
 * Sub-Agent Types - PeakInfer TDD v1.3 Section 9.3
 * 
 * Type definitions for the format normalization sub-agent architecture.
 * 
 * Context Engineering Principle (TDD):
 * Each sub-agent receives only the context it needs.
 * This prevents context pollution and improves accuracy.
 */

import type { FormatType, FieldMapping, FormatDetection } from '../schemas.js';

// =============================================================================
// SUB-AGENT CONFIGURATION
// =============================================================================

export interface SubAgentConfig {
  /** Sub-agent name for logging/debugging */
  name: string;
  
  /** Purpose description */
  purpose: string;
  
  /** Maximum tokens for response */
  maxTokens: number;
  
  /** Temperature (0 for deterministic) */
  temperature: number;
  
  /** Whether this sub-agent requires API access */
  requiresApi: boolean;
}

// =============================================================================
// FORMAT DETECTOR SUB-AGENT
// =============================================================================

/**
 * Input to the FormatDetector sub-agent.
 * MINIMAL CONTEXT: Only sample lines and extension.
 */
export interface FormatDetectorInput {
  /** Sample lines from the file (first N lines) */
  sampleLines: string[];
  
  /** File extension hint */
  extension: string;
  
  /** File size in bytes */
  fileSize: number;
}

/**
 * Output from the FormatDetector sub-agent.
 */
export interface FormatDetectorOutput {
  /** Detected format type */
  formatType: FormatType;
  
  /** Detection confidence (0-1) */
  confidence: number;
  
  /** Evidence supporting detection */
  evidence: string[];
  
  /** Whether agent field mapping is needed */
  requiresFieldMapping: boolean;
  
  /** Structural hints for the field mapper */
  structuralHints?: {
    isArray: boolean;
    rootPath?: string;
    recordPath?: string;
  };
}

// =============================================================================
// FIELD MAPPER SUB-AGENT
// =============================================================================

/**
 * Input to the FieldMapper sub-agent.
 * FOCUSED CONTEXT: Format type, schema, and optional codebase patterns.
 */
export interface FieldMapperInput {
  /** Detected format type from FormatDetector */
  formatType: FormatType;
  
  /** Sample records (parsed structure, not raw lines) */
  sampleRecords: Record<string, unknown>[];
  
  /** Target InferenceEvent schema fields */
  targetSchema: {
    required: string[];
    optional: string[];
  };
  
  /** Structural hints from format detector */
  structuralHints?: FormatDetectorOutput['structuralHints'];
  
  /** Codebase logging patterns (only in combined mode) */
  codebaseContext?: {
    loggingPatterns: string[];
    variableNames: string[];
    loggerCalls: Array<{
      file: string;
      line: number;
      fields: string[];
    }>;
  };
}

/**
 * Output from the FieldMapper sub-agent.
 */
export interface FieldMapperOutput {
  /** Field mappings */
  mappings: FieldMapping[];
  
  /** Overall mapping confidence */
  overallConfidence: number;
  
  /** Fields that couldn't be mapped */
  unmappedFields: string[];
  
  /** Warnings about mapping */
  warnings: string[];
  
  /** Whether codebase context was used */
  usedCodebaseContext: boolean;
}

// =============================================================================
// MAPPING VALIDATOR SUB-AGENT
// =============================================================================

/**
 * Input to the MappingValidator sub-agent.
 * MINIMAL CONTEXT: Mappings and sample extracted values.
 */
export interface MappingValidatorInput {
  /** Proposed field mappings */
  mappings: FieldMapping[];
  
  /** Sample of extracted values for each field */
  extractedSamples: Record<string, unknown[]>;
  
  /** Expected value constraints */
  constraints: {
    id: { type: 'string' };
    ts: { type: 'iso8601' | 'unix_ms' | 'unix_s' };
    provider: { type: 'string'; validValues?: string[] };
    model: { type: 'string' };
    input_tokens: { type: 'number'; min: 0 };
    output_tokens: { type: 'number'; min: 0 };
    latency_ms: { type: 'number'; min: 0 };
  };
}

/**
 * Output from the MappingValidator sub-agent.
 */
export interface MappingValidatorOutput {
  /** Whether all mappings are valid */
  isValid: boolean;
  
  /** Validation results per field */
  fieldResults: Array<{
    field: string;
    isValid: boolean;
    confidence: number;
    issue?: string;
    suggestion?: string;
  }>;
  
  /** Confidence adjustment (can increase or decrease) */
  confidenceAdjustment: number;
  
  /** Suggestions for improving mappings */
  suggestions: string[];
}

// =============================================================================
// COMBINED NORMALIZATION RESULT
// =============================================================================

/**
 * Complete normalization result from the sub-agent pipeline.
 */
export interface SubAgentNormalizationResult {
  /** Format detection result */
  format: FormatDetection;
  
  /** Field mappings */
  mappings: FieldMapping[];
  
  /** Overall confidence after validation */
  overallConfidence: number;
  
  /** Validation result */
  validation: MappingValidatorOutput;
  
  /** Warnings from all sub-agents */
  warnings: string[];
  
  /** Whether codebase context was used */
  usedCodebaseContext: boolean;
  
  /** Sub-agent execution metadata */
  metadata: {
    formatDetectorDurationMs: number;
    fieldMapperDurationMs: number;
    validatorDurationMs: number;
    totalCostUsd: number;
  };
}

// =============================================================================
// SUB-AGENT CONFIGS (TDD Section 9.3)
// =============================================================================

export const FORMAT_DETECTOR_CONFIG: SubAgentConfig = {
  name: 'format-detector',
  purpose: 'Identify log/events file format from sample lines',
  maxTokens: 1000,
  temperature: 0,
  requiresApi: true,
};

export const FIELD_MAPPER_CONFIG: SubAgentConfig = {
  name: 'field-mapper',
  purpose: 'Map source fields to InferenceEvent schema',
  maxTokens: 2000,
  temperature: 0,
  requiresApi: true,
};

export const MAPPING_VALIDATOR_CONFIG: SubAgentConfig = {
  name: 'mapping-validator',
  purpose: 'Validate extracted values match expected constraints',
  maxTokens: 500,
  temperature: 0,
  requiresApi: false, // Can be done deterministically
};

