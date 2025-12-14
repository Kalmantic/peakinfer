import { z } from 'zod';

// =============================================================================
// ENUMS
// =============================================================================

export const Provider = z.enum([
  'openai', 'anthropic', 'google', 'cohere', 'mistral',
  'bedrock', 'azure_openai', 'together', 'fireworks',
  'groq', 'replicate', 'perplexity',
  'vllm', 'sglang', 'tgi', 'ollama', 'llamacpp',
  'unknown'
]);

export const Severity = z.enum(['critical', 'warning', 'info']);

export const Category = z.enum([
  'cost', 'latency', 'drift', 'reliability', 'waste', 'throughput', 'security', 'best-practice'
]);

// =============================================================================
// STATIC ANALYSIS
// =============================================================================

export const Patterns = z.object({
  streaming: z.boolean().optional(),
  batching: z.boolean().optional(),
  retries: z.boolean().optional(),
  caching: z.boolean().optional(),
  fallback: z.boolean().optional(),
});

export const Callsite = z.object({
  id: z.string(),
  file: z.string(),
  line: z.number(),
  provider: Provider.nullable(),
  model: z.string().nullable(),
  framework: z.string().nullable(),
  runtime: z.string().nullable(),
  patterns: Patterns,
  confidence: z.number().min(0).max(1),
});

export const ScanCandidate = z.object({
  file: z.string(),
  line: z.number(),
  snippet: z.string(),
});

export const ScannedFile = z.object({
  path: z.string(),
  language: z.string(),
  loc: z.number(),
});

export const ScanResult = z.object({
  root: z.string(),
  files: z.array(ScannedFile),
  candidates: z.array(ScanCandidate),
  summary: z.object({
    totalFiles: z.number(),
    totalLoc: z.number(),
    languages: z.array(z.string()),
    totalCandidates: z.number(),
  }),
});

export const InferenceMap = z.object({
  version: z.string(),
  root: z.string(),
  generatedAt: z.string(),
  // Report metadata
  metadata: z.object({
    absolutePath: z.string(), // Full absolute path analyzed
    promptId: z.string().optional(), // Which analysis prompt was used
    promptVersion: z.string().optional(), // Analysis prompt version
    templatesVersion: z.string().optional(), // peakinfer-templates version
    llmProvider: z.string().optional(), // LLM provider used (anthropic, none)
    llmModel: z.string().optional(), // LLM model used for analysis
  }).optional(),
  summary: z.object({
    totalCallsites: z.number(),
    providers: z.array(z.string()),
    models: z.array(z.string()),
    patterns: z.record(z.number()),
  }),
  callsites: z.array(Callsite),
});

// =============================================================================
// RUNTIME ANALYSIS
// =============================================================================

export const InferenceEvent = z.object({
  id: z.string(),
  ts: z.string(),
  provider: Provider,
  model: z.string(),
  input_tokens: z.number(),
  output_tokens: z.number(),
  latency_ms: z.number(),
  intent: z.string().optional(),
  callsite_id: z.string().optional(),
  // Runtime pattern fields for drift detection
  streaming: z.boolean().optional(),        // Was this a streaming request?
  ttft_ms: z.number().optional(),           // Time to first token (streaming only)
  batch_size: z.number().optional(),        // If part of a batch, how many requests?
  batch_id: z.string().optional(),          // Group ID for batched requests
  cached: z.boolean().optional(),           // Was response served from cache?
  retry_count: z.number().optional(),       // Number of retries before success
  fallback_used: z.boolean().optional(),    // Was a fallback provider/model used?
  original_model: z.string().optional(),    // If fallback, what was the original model?
});

export const ProviderStats = z.object({
  calls: z.number(),
  tokens_in: z.number(),
  tokens_out: z.number(),
  latency_p50: z.number(),
  latency_p95: z.number(),
  latency_p99: z.number(),
});

export const RuntimeSummary = z.object({
  totalEvents: z.number(),
  byProvider: z.record(ProviderStats),
  byModel: z.record(ProviderStats),
  global: z.object({
    p50: z.number(),
    p95: z.number(),
    p99: z.number(),
  }),
});

// =============================================================================
// JOINED OUTPUT
// =============================================================================

export const UsageStats = z.object({
  calls: z.number(),
  tokens_in: z.number(),
  tokens_out: z.number(),
  latency_p50: z.number(),
  latency_p95: z.number(),
  latency_p99: z.number(),
});

export const DriftSignal = z.object({
  type: z.enum(['codeOnly', 'runtimeOnly', 'mismatch', 'patternDrift']),
  provider: z.string().optional(),
  model: z.string().optional(),
  callsiteId: z.string().optional(),
  message: z.string(),
});

export const EnrichedCallsite = Callsite.extend({
  usage: UsageStats.optional(),
});

export const JoinedOutput = z.object({
  callsites: z.array(EnrichedCallsite),
  codeOnly: z.array(Callsite),
  runtimeOnly: z.array(InferenceEvent),
  drift: z.array(DriftSignal),
});

// =============================================================================
// TEMPLATES & INSIGHTS
// =============================================================================

export const TemplateCondition = z.object({
  field: z.string(),
  op: z.enum(['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'exists', 'in', 'ratio_gt', 'ratio_lt', 'has_pattern']),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]).optional(),
  compare_to: z.string().optional(),
  pattern: z.string().optional(),
  count_gt: z.number().optional(),
});

export const InsightTemplate = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  category: Category,
  severity: Severity,
  match: z.object({
    scope: z.enum(['callsite', 'joined', 'global', 'envelope']),
    conditions: z.array(TemplateCondition),
  }),
  output: z.object({
    headline: z.string(),
    evidence: z.string(),
  }),
  defaults: z.record(z.number()).optional(),
});

// Stack layers for impact analysis
export const StackLayer = z.enum([
  'application',    // Code patterns: caching, batching, streaming, error handling
  'model',          // Model selection: GPT-4 vs GPT-3.5, Claude Opus vs Haiku
  'runtime',        // Inference engines: vLLM, sglang, TGI optimizations
  'infrastructure', // Hosting: serverless vs dedicated, provider selection
]);

// Impact metrics
export const ImpactType = z.enum(['cost', 'latency', 'throughput']);

// Effort level for implementing the change
export const EffortLevel = z.enum(['low', 'medium', 'high']);

// Impact estimation for each insight
export const ImpactEstimate = z.object({
  layer: StackLayer,
  impactType: ImpactType,
  estimatedImpactPercent: z.number().min(0).max(100), // 0-100% improvement
  effort: EffortLevel,
  annualSavingsUSD: z.number().optional(), // Estimated annual savings in USD
  latencyReductionMs: z.number().optional(), // Estimated latency improvement
  throughputGainPercent: z.number().optional(), // Estimated throughput improvement
  confidence: z.number().min(0).max(1).optional(), // Confidence in estimate (0-1)
  assumptions: z.string().optional(), // Key assumptions for this estimate
});

export const Insight = z.object({
  id: z.string().optional(), // Unique insight ID
  severity: Severity,
  category: Category,
  templateId: z.string().optional(), // Optional for LLM-generated insights
  headline: z.string(),
  evidence: z.string(),
  location: z.string().optional(),
  recommendation: z.string().optional(), // Actionable suggestion
  source: z.enum(['template', 'llm']).optional(), // 'template' = pattern-based, 'llm' = semantic analysis
  // Impact estimation fields
  impact: ImpactEstimate.optional(), // Estimated impact of implementing this recommendation
});

// =============================================================================
// INFERENCE MAX ENVELOPES
// =============================================================================

export const PerformanceEnvelope = z.object({
  ttft_p50_ms: z.number(),
  ttft_p95_ms: z.number(),
  tps_median: z.number(),
  tps_peak: z.number(),
});

// =============================================================================
// AGENT PLANNING
// =============================================================================

export const TaskType = z.enum([
  'scan', 'analyze', 'parse_events', 'join',
  'load_templates', 'generate_insights', 'render', 'generate_html', 'generate_pdf', 'save_artifacts'
]);

export const PlannedTask = z.object({
  id: z.number(),
  type: TaskType,
  description: z.string(),
  depends_on: z.array(z.number()).optional(),
});

export const ExecutionPlan = z.object({
  mode: z.enum(['static', 'runtime', 'combined']),
  tasks: z.array(PlannedTask),
});

export const TaskResult = z.object({
  taskId: z.number(),
  status: z.enum(['success', 'failed', 'skipped']),
  error: z.string().optional(),
  durationMs: z.number(),
});

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type Provider = z.infer<typeof Provider>;
export type Severity = z.infer<typeof Severity>;
export type Category = z.infer<typeof Category>;
export type Patterns = z.infer<typeof Patterns>;
export type CallsitePatterns = Patterns; // Alias for analyzer
export type Callsite = z.infer<typeof Callsite>;
export type ScanCandidate = z.infer<typeof ScanCandidate>;
export type ScannedFile = z.infer<typeof ScannedFile>;
export type ScanResult = z.infer<typeof ScanResult>;
export type InferenceMap = z.infer<typeof InferenceMap>;
export type InferenceEvent = z.infer<typeof InferenceEvent>;
export type ProviderStats = z.infer<typeof ProviderStats>;
export type RuntimeSummary = z.infer<typeof RuntimeSummary>;
export type UsageStats = z.infer<typeof UsageStats>;
export type DriftSignal = z.infer<typeof DriftSignal>;
export type EnrichedCallsite = z.infer<typeof EnrichedCallsite>;
export type JoinedOutput = z.infer<typeof JoinedOutput>;
export type TemplateCondition = z.infer<typeof TemplateCondition>;
export type InsightTemplate = z.infer<typeof InsightTemplate>;
export type StackLayer = z.infer<typeof StackLayer>;
export type ImpactType = z.infer<typeof ImpactType>;
export type EffortLevel = z.infer<typeof EffortLevel>;
export type ImpactEstimate = z.infer<typeof ImpactEstimate>;
export type Insight = z.infer<typeof Insight>;
export type PerformanceEnvelope = z.infer<typeof PerformanceEnvelope>;
export type TaskType = z.infer<typeof TaskType>;
export type PlannedTask = z.infer<typeof PlannedTask>;
export type ExecutionPlan = z.infer<typeof ExecutionPlan>;
export type TaskResult = z.infer<typeof TaskResult>;

// =============================================================================
// FORMAT DETECTION & NORMALIZATION (PRD §6.4)
// =============================================================================

/**
 * Supported format types for runtime event files.
 * Direct-parse formats are handled without LLM, agent-normalized formats require semantic analysis.
 */
export const FormatType = z.enum([
  // Direct-parse formats (no LLM needed)
  'jsonl',           // Newline-delimited JSON with InferenceEvent schema
  'json_array',      // JSON array of InferenceEvent objects
  'csv',             // CSV with standard column names
  'tsv',             // TSV with standard column names

  // Agent-normalized formats (require semantic analysis)
  'otel',            // OpenTelemetry OTLP traces/spans
  'jaeger',          // Jaeger distributed tracing format
  'zipkin',          // Zipkin tracing format
  'langsmith',       // LangSmith trace exports
  'helicone',        // Helicone proxy logs
  'wandb',           // Weights & Biases inference logs
  'litellm',         // LiteLLM proxy event logs
  'portkey',         // Portkey gateway logs

  // Inferred formats (heuristic detection)
  'custom_json',     // Unknown JSON structure requiring field mapping
  'custom_text',     // Structured text logs
  'unknown',         // Could not determine format
]);

/**
 * Extraction strategy for a field mapping.
 */
export const ExtractionType = z.enum([
  'direct',          // Direct field access (e.g., obj.field)
  'jsonpath',        // JSONPath expression
  'column',          // CSV/TSV column name
  'regex',           // Regular expression extraction
  'computed',        // Computed from other fields (e.g., latency = end - start)
  'constant',        // Fixed value for all events
]);

/**
 * Transformation to apply after extraction.
 */
export const TransformType = z.enum([
  'none',            // No transformation
  'unix_ms_to_iso',  // Unix milliseconds to ISO timestamp
  'unix_s_to_iso',   // Unix seconds to ISO timestamp
  'unix_nano_to_iso', // Unix nanoseconds to ISO timestamp
  'duration_to_ms',  // Duration string (e.g., "1.5s") to milliseconds
  'parse_int',       // String to integer
  'parse_float',     // String to float
  'lowercase',       // Lowercase string
  'provider_normalize', // Normalize provider names (e.g., "OpenAI" -> "openai")
]);

/**
 * Field mapping from source format to InferenceEvent schema.
 */
export const FieldMapping = z.object({
  target: z.string(),                    // InferenceEvent field name
  source_path: z.string(),               // JSONPath, column name, regex, or expression
  extraction_type: ExtractionType,
  transform: TransformType.optional().default('none'),
  confidence: z.number().min(0).max(1),  // Confidence in this mapping (0-1)
  evidence: z.string().optional(),       // Why this mapping was chosen
});

/**
 * Result of format detection.
 */
export const FormatDetectionResult = z.object({
  format_type: FormatType,
  confidence: z.number().min(0).max(1),  // Overall detection confidence
  evidence: z.string(),                  // Explanation of detection
  sample_size: z.number(),               // Number of lines/records sampled
  requires_agent: z.boolean(),           // Whether agent normalization is needed
});

/**
 * Complete normalization result with field mappings.
 */
export const NormalizationResult = z.object({
  detection: FormatDetectionResult,
  mappings: z.array(FieldMapping),
  unmapped_fields: z.array(z.string()),  // Source fields not mapped
  warnings: z.array(z.string()),         // Issues encountered during normalization
  audit: z.object({
    normalized_at: z.string(),           // ISO timestamp
    agent_used: z.boolean(),
    codebase_context_used: z.boolean(),
    llm_model: z.string().optional(),
  }),
});

/**
 * Options for format normalization.
 */
export const NormalizationOptions = z.object({
  format_hint: FormatType.optional(),           // User-provided format hint
  field_hints: z.record(z.string()).optional(), // User-provided field mappings
  lenient: z.boolean().optional(),              // Accept low-confidence mappings
  strict: z.boolean().optional(),               // Fail on missing required fields
  codebase_context: z.any().optional(),         // ScanResult for codebase-aware normalization
});

// Type exports for format detection
export type FormatType = z.infer<typeof FormatType>;
export type ExtractionType = z.infer<typeof ExtractionType>;
export type TransformType = z.infer<typeof TransformType>;
export type FieldMapping = z.infer<typeof FieldMapping>;
export type FormatDetectionResult = z.infer<typeof FormatDetectionResult>;
export type NormalizationResult = z.infer<typeof NormalizationResult>;
export type NormalizationOptions = z.infer<typeof NormalizationOptions>;
