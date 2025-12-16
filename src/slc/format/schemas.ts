/**
 * Format Normalization Schemas - PeakInfer TDD v1.3
 * 
 * Defines the canonical types for format detection and field mapping
 * in the runtime events normalization pipeline.
 */

import type { InferenceEvent } from '../../types/events.js';

// =============================================================================
// FORMAT TYPES
// =============================================================================

/**
 * Supported format types for runtime events
 */
export type FormatType =
  | 'jsonl'           // Direct parse - newline-delimited JSON
  | 'json_array'      // Direct parse - JSON array of objects
  | 'csv'             // Direct parse - comma-separated
  | 'tsv'             // Direct parse - tab-separated
  | 'otel'            // Agent normalized - OpenTelemetry OTLP
  | 'jaeger'          // Agent normalized - Jaeger traces
  | 'zipkin'          // Agent normalized - Zipkin traces
  | 'langsmith'       // Agent normalized - LangChain LangSmith
  | 'helicone'        // Agent normalized - Helicone proxy logs
  | 'wandb'           // Agent normalized - Weights & Biases
  | 'litellm'         // Agent normalized - LiteLLM proxy logs
  | 'portkey'         // Agent normalized - Portkey gateway
  | 'custom'          // Agent normalized - unknown structured format
  | 'unknown';        // Requires user hints

/**
 * Formats that can be parsed directly without agent assistance
 */
export const DIRECT_PARSE_FORMATS: FormatType[] = ['jsonl', 'json_array', 'csv', 'tsv'];

/**
 * Formats that require agent-based normalization
 */
export const AGENT_NORMALIZED_FORMATS: FormatType[] = [
  'otel', 'jaeger', 'zipkin', 'langsmith', 'helicone', 'wandb', 'litellm', 'portkey', 'custom'
];

// =============================================================================
// FORMAT DETECTION
// =============================================================================

/**
 * Result of format detection
 */
export interface FormatDetection {
  /** Detected format type */
  detected: FormatType;
  
  /** Confidence score 0-1 */
  confidence: number;
  
  /** Evidence for why this format was detected */
  evidence: string[];
  
  /** True if agent normalization is needed */
  requiresAgent: boolean;
  
  /** How many lines were sampled for detection */
  sampleLines: number;
  
  /** Original file extension (if available) */
  extension?: string;
}

// =============================================================================
// FIELD MAPPING
// =============================================================================

/**
 * How a field is extracted from the source format
 */
export type ExtractionType = 'jsonpath' | 'column' | 'regex' | 'computed' | 'literal';

/**
 * Mapping from source format to InferenceEvent field
 */
export interface FieldMapping {
  /** Target field in InferenceEvent schema */
  targetField: keyof InferenceEvent;
  
  /** Source expression (JSONPath, column name, regex, or computed expression) */
  sourceExpression: string;
  
  /** How to extract the value */
  extractionType: ExtractionType;
  
  /** Confidence in this mapping 0-1 */
  confidence: number;
  
  /** Why this mapping was chosen */
  evidence?: string;
  
  /** Default value if source is missing */
  defaultValue?: unknown;
  
  /** Transform function name (if computed) */
  transform?: string;
}

/**
 * Standard field aliases for direct parse formats
 * Maps common field names to canonical InferenceEvent fields
 */
export const FIELD_ALIASES: Record<keyof InferenceEvent, string[]> = {
  id: ['id', 'event_id', 'request_id', 'trace_id', 'uuid'],
  ts: ['ts', 'timestamp', 'time', 'created_at', '@timestamp', 'datetime', 'date'],
  provider: ['provider', 'llm_provider', 'vendor', 'service'],
  model: ['model', 'model_id', 'model_name', 'llm_model'],
  input_tokens: ['input_tokens', 'tokens_in', 'prompt_tokens', 'input_token_count'],
  output_tokens: ['output_tokens', 'tokens_out', 'completion_tokens', 'output_token_count'],
  latency_ms: ['latency_ms', 'latency', 'duration_ms', 'response_time_ms', 'duration', 'elapsed_ms'],
  intent: ['intent', 'task', 'operation', 'action', 'purpose'],
  region: ['region', 'location', 'datacenter', 'az', 'zone'],
  tenant: ['tenant', 'tenant_id', 'customer_id', 'org_id', 'workspace'],
  cost_usd: ['cost_usd', 'cost', 'price_usd', 'total_cost', 'amount'],
  endpoint: ['endpoint', 'url', 'api_endpoint', 'base_url'],
  quality_score: ['quality_score', 'score', 'quality', 'rating'],
  context_length: ['context_length', 'context_tokens', 'context_size'],
  callsite_id: ['callsite_id', 'callsite', 'source_location', 'call_id'],
  metadata: ['metadata', 'meta', 'extra', 'tags', 'attributes'],
};

// =============================================================================
// NORMALIZATION RESULT
// =============================================================================

/**
 * Complete result of the normalization process
 */
export interface NormalizationResult {
  /** Format detection result */
  format: FormatDetection;
  
  /** Field mappings to apply */
  mappings: FieldMapping[];
  
  /** Overall confidence in the normalization */
  overallConfidence: number;
  
  /** Warnings about the normalization */
  warnings: string[];
  
  /** Codebase context (present in combined mode) */
  codebaseContext?: {
    /** Logging patterns found in codebase */
    loggingPatterns: string[];
    /** Variable names used in logging */
    variableNames: string[];
    /** Confidence from codebase analysis */
    confidence: number;
  };
}

// =============================================================================
// PARSER RESULT
// =============================================================================

/**
 * Result from parsing a runtime events file
 */
export interface ParseResult {
  /** Parsed inference events */
  events: InferenceEvent[];
  
  /** Format detection used */
  format: FormatDetection;
  
  /** Field mappings used (for agent-normalized formats) */
  mappings?: FieldMapping[];
  
  /** Parsing statistics */
  stats: {
    /** Total lines/records in file */
    totalRecords: number;
    /** Successfully parsed records */
    parsedRecords: number;
    /** Records that failed to parse */
    failedRecords: number;
    /** Parse errors encountered */
    errors: string[];
  };
  
  /** Overall confidence */
  confidence: number;
}

// =============================================================================
// FORMAT SIGNATURES
// =============================================================================

/**
 * Detection signatures for known formats
 */
export interface FormatSignature {
  /** Format type */
  format: FormatType;
  
  /** Required keys that must be present */
  requiredKeys?: string[];
  
  /** Optional keys that increase confidence */
  optionalKeys?: string[];
  
  /** Pattern to match in content */
  contentPattern?: RegExp;
  
  /** File extension hints */
  extensions?: string[];
  
  /** Confidence weight */
  weight: number;
}

/**
 * Known format signatures for detection
 */
export const FORMAT_SIGNATURES: FormatSignature[] = [
  // OpenTelemetry OTLP
  {
    format: 'otel',
    requiredKeys: ['resourceSpans'],
    optionalKeys: ['scopeSpans', 'instrumentationLibrarySpans'],
    extensions: ['.json', '.otlp'],
    weight: 1.0,
  },
  {
    format: 'otel',
    requiredKeys: ['scopeSpans'],
    extensions: ['.json', '.otlp'],
    weight: 0.9,
  },
  
  // Jaeger
  {
    format: 'jaeger',
    requiredKeys: ['data'],
    optionalKeys: ['traceID', 'spans', 'processes'],
    contentPattern: /traceID.*spans/i,
    extensions: ['.json'],
    weight: 0.95,
  },
  
  // Zipkin
  {
    format: 'zipkin',
    requiredKeys: ['traceId', 'id'],
    optionalKeys: ['kind', 'name', 'timestamp', 'duration', 'tags'],
    extensions: ['.json'],
    weight: 0.9,
  },
  
  // LangSmith
  {
    format: 'langsmith',
    requiredKeys: ['run_type'],
    optionalKeys: ['dotted_order', 'parent_run_id', 'child_run_ids', 'inputs', 'outputs'],
    extensions: ['.json', '.jsonl'],
    weight: 0.95,
  },
  
  // Helicone
  {
    format: 'helicone',
    requiredKeys: ['request', 'response'],
    optionalKeys: ['properties', 'request_id', 'user_id'],
    extensions: ['.json', '.jsonl'],
    weight: 0.9,
  },
  
  // Weights & Biases
  {
    format: 'wandb',
    requiredKeys: ['_wandb'],
    optionalKeys: ['_runtime', '_step', '_timestamp'],
    extensions: ['.json', '.jsonl'],
    weight: 0.95,
  },
  
  // LiteLLM
  {
    format: 'litellm',
    requiredKeys: ['model', 'messages'],
    optionalKeys: ['api_key', 'api_base', 'litellm_params'],
    extensions: ['.json', '.jsonl'],
    weight: 0.85,
  },
  
  // Portkey
  {
    format: 'portkey',
    requiredKeys: ['request'],
    optionalKeys: ['config', 'provider', 'virtual_key'],
    contentPattern: /portkey|gateway/i,
    extensions: ['.json', '.jsonl'],
    weight: 0.85,
  },
];

// =============================================================================
// CONFIDENCE THRESHOLDS
// =============================================================================

/**
 * Confidence thresholds for different operations
 */
export const CONFIDENCE_THRESHOLDS = {
  /** Minimum confidence for automatic parsing */
  AUTO_PARSE: 0.8,
  
  /** Minimum confidence to proceed without warning */
  NO_WARNING: 0.9,
  
  /** Minimum confidence before requiring --lenient */
  LENIENT_REQUIRED: 0.6,
  
  /** Below this, we fail */
  MINIMUM: 0.4,
};

// =============================================================================
// REQUIRED FIELDS
// =============================================================================

/**
 * Fields that must be present for a valid InferenceEvent
 */
export const REQUIRED_FIELDS: (keyof InferenceEvent)[] = [
  'id',
  'ts',
  'provider',
  'model',
];

/**
 * Fields that are optional but highly desired
 */
export const DESIRED_FIELDS: (keyof InferenceEvent)[] = [
  'input_tokens',
  'output_tokens',
  'latency_ms',
];

/**
 * All fields that can be mapped
 */
export const ALL_MAPPABLE_FIELDS: (keyof InferenceEvent)[] = [
  'id', 'ts', 'intent', 'provider', 'model',
  'input_tokens', 'output_tokens', 'latency_ms', 'cost_usd',
  'endpoint', 'region', 'tenant', 'quality_score', 'context_length',
];
