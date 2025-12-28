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
    // v1.9.5: Cost optimization stats
    skippedLargeFiles: z.number().optional(),
    skippedByPattern: z.number().optional(),
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
  layer: z.enum(['application', 'api', 'gateway', 'runtime', 'model', 'hardware']).optional(), // v1.8: 6-layer architecture
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

// =============================================================================
// COMMUNITY OPTIMIZATION TEMPLATES (v1.8 - Inference Squeeze Guide)
// =============================================================================

/**
 * Optimization template category - matches Inference Squeeze Guide structure
 */
export const OptimizationCategory = z.enum([
  'runtime_optimization',     // PyTorch to ONNX, vLLM, TensorRT
  'batching_optimization',    // Continuous batching, batch sizing
  'memory_optimization',      // Quantization, KV cache
  'application_optimization', // Model routing, context management
  'cost_optimization',        // Budget controls, cost allocation
  'monitoring',               // APM, quality monitoring, A/B testing
  'scaling',                  // Auto-scaling, multi-GPU
]);

/**
 * Risk level for optimization implementation
 */
export const OptimizationRiskLevel = z.enum(['low', 'medium', 'high']);

/**
 * Implementation step with validation and rollback
 */
export const ImplementationStep = z.object({
  step_id: z.string(),
  name: z.string(),
  executable: z.boolean().optional(),
  commands: z.array(z.string()).optional(),
  validation: z.object({
    command: z.string().optional(),
    success_criteria: z.string().optional(),
    rollback_command: z.string().optional(),
  }).optional(),
});

/**
 * Monitoring metric configuration
 */
export const MonitoringMetric = z.object({
  metric: z.string(),
  target: z.string(),
  alert_threshold: z.string(),
});

/**
 * Rollback trigger configuration
 */
export const RollbackTrigger = z.object({
  condition: z.string(),
  action: z.string(),
});

/**
 * Community Optimization Template - runbook-style templates from Inference Squeeze Guide
 * These templates provide step-by-step implementation guides with ROI estimates
 */
export const OptimizationTemplate = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: OptimizationCategory,
  confidence: z.number().min(0).max(1),
  success_count: z.number().optional(),
  verified_environments: z.number().optional(),
  contributors: z.array(z.string()).optional(),
  last_updated: z.string().optional(),

  // Environment matching criteria
  environment_match: z.record(z.union([z.string(), z.boolean(), z.array(z.string())])).optional(),

  // Optimization details
  optimization: z.object({
    technique: z.string(),
    expected_cost_reduction: z.string().optional(),
    expected_latency_improvement: z.string().optional(),
    expected_throughput_improvement: z.string().optional(),
    expected_memory_reduction: z.string().optional(),
    expected_quality_retention: z.string().optional(),
    effort_estimate: z.string(),
    risk_level: OptimizationRiskLevel,
  }),

  // Economics and ROI
  economics: z.object({
    baseline_calculation: z.record(z.union([z.string(), z.number()])).optional(),
    projected_improvement: z.record(z.union([z.string(), z.number()])).optional(),
    projected_savings: z.record(z.union([z.string(), z.number()])).optional(),
    implementation_cost: z.object({
      engineering_hours: z.number().optional(),
      hourly_rate: z.number().optional(),
      compute_hours: z.number().optional(),
      total_cost: z.number(),
    }).optional(),
    roi_calculation: z.record(z.string()).optional(),
  }).optional(),

  // Implementation steps
  implementation: z.object({
    prerequisites: z.array(z.object({
      requirement: z.string(),
      validation_command: z.string().optional(),
    })).optional(),
    automated_steps: z.array(ImplementationStep).optional(),
  }).optional(),

  // Monitoring configuration
  monitoring: z.object({
    key_metrics: z.array(MonitoringMetric).optional(),
    rollback_triggers: z.array(RollbackTrigger).optional(),
  }).optional(),

  // Historical results
  results: z.object({
    recent_implementations: z.array(z.record(z.union([z.string(), z.number()]))).optional(),
  }).optional(),
});

// Stack layers for impact analysis (TDD v1.7 - 6-layer architecture)
export const StackLayer = z.enum([
  'application',    // Code patterns: streaming-drift, overpowered-model, cost-concentration
  'api',            // API layer: retry-explosion, untested-fallback, rate limiting
  'gateway',        // Gateway/proxy layer: caching, load balancing, routing
  'runtime',        // Inference engines: vLLM, sglang, TGI optimizations
  'model',          // Model selection: GPT-4 vs GPT-3.5, context-accumulation, token-underutilization
  'hardware',       // Hardware layer: GPU optimization, memory management
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
  // CodeRabbit-style fix fields (v1.6 - LLM-generated)
  originalCode: z.string().optional(), // Exact code line(s) that need to change
  suggestedFix: z.string().optional(), // Complete replacement code
  aiAgentPrompt: z.string().optional(), // Instructions for AI agents like Copilot
  fullLineFix: z.string().optional(), // Full line replacement for suggestion syntax
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
  'load_templates', 'generate_insights', 'render', 'generate_html', 'generate_pdf', 'save_artifacts',
  'save_history',     // v1.5: Save run to history for comparison/prediction
  'compare',          // v1.5: Compare with previous run
  'predict',          // v1.5: Generate deploy-time predictions
  'counterfactuals',  // v1.5: Generate what-if optimization scenarios
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
export type OptimizationTemplate = z.infer<typeof OptimizationTemplate>;
export type OptimizationCategory = z.infer<typeof OptimizationCategory>;
export type OptimizationRiskLevel = z.infer<typeof OptimizationRiskLevel>;
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

// =============================================================================
// HISTORY STORAGE (v1.5)
// =============================================================================

/**
 * Analysis type for categorizing runs.
 */
export const AnalysisType = z.enum(['static', 'runtime', 'combined']);

/**
 * History manifest for tracking analysis runs over time.
 * Distinct from runid.ts RunManifest which focuses on caching/resumability.
 * This schema enables historical comparison and deploy-time prediction features.
 */
export const HistoryManifest = z.object({
  runId: z.string(),                              // Unique run identifier
  timestamp: z.string().datetime(),               // ISO timestamp when analysis completed
  path: z.string(),                               // Analyzed path (absolute, for matching)
  pathHash: z.string(),                           // Hash of normalized path for efficient lookup
  analysisType: AnalysisType,                     // Type of analysis performed
  version: z.string(),                            // PeakInfer version that produced this run

  // Summary metrics for quick comparison
  inferencePointCount: z.number(),                // Number of inference points detected
  eventCount: z.number().optional(),              // Number of runtime events (if runtime/combined)
  driftCount: z.number().optional(),              // Number of drift signals (if combined)
  insightCount: z.number().optional(),            // Number of insights generated

  // Performance context
  durationMs: z.number().optional(),              // Analysis duration in milliseconds

  // Artifact paths relative to history directory
  artifacts: z.object({
    inferenceMap: z.string().optional(),          // inference-map.json
    analysis: z.string().optional(),              // analysis.json (full results)
    html: z.string().optional(),                  // report.html
    pdf: z.string().optional(),                   // report.pdf
  }).optional(),
});

/**
 * Index of all historical runs for a project path.
 * Stored at .peakinfer/history/index.json
 */
export const HistoryIndex = z.object({
  version: z.string(),                            // History format version
  lastUpdated: z.string().datetime(),             // Last index update
  runs: z.array(z.object({
    runId: z.string(),
    timestamp: z.string().datetime(),
    pathHash: z.string(),
    analysisType: AnalysisType,
    inferencePointCount: z.number(),
  })),
});

// Type exports for history
export type AnalysisType = z.infer<typeof AnalysisType>;
export type HistoryManifest = z.infer<typeof HistoryManifest>;
export type HistoryIndex = z.infer<typeof HistoryIndex>;

// =============================================================================
// HISTORICAL COMPARISON (v1.5)
// =============================================================================

/**
 * Change type for tracking what changed between runs.
 */
export const ChangeType = z.enum(['added', 'removed', 'modified']);

/**
 * A single field change within an inference point.
 */
export const FieldChange = z.object({
  field: z.string(),                            // Field name that changed
  before: z.unknown(),                          // Previous value
  after: z.unknown(),                           // New value
});

/**
 * An inference point that changed between runs.
 */
export const ChangedInferencePoint = z.object({
  point: Callsite,                              // The inference point
  changes: z.array(FieldChange),                // List of field changes
});

/**
 * Result of comparing two analysis runs.
 * Enables "what changed" insights for pre-deploy validation.
 */
export const ComparisonResult = z.object({
  baseRunId: z.string(),                        // The baseline run ID
  baseTimestamp: z.string().datetime(),         // When baseline was created
  currentRunId: z.string(),                     // The current run ID
  currentTimestamp: z.string().datetime(),      // When current was created

  // Inference point changes
  added: z.array(Callsite),                     // New inference points
  removed: z.array(Callsite),                   // Removed inference points
  changed: z.array(ChangedInferencePoint),      // Modified inference points

  // Summary metrics
  metrics: z.object({
    totalBefore: z.number(),                    // Inference points in baseline
    totalAfter: z.number(),                     // Inference points in current
    addedCount: z.number(),                     // Count of added points
    removedCount: z.number(),                   // Count of removed points
    changedCount: z.number(),                   // Count of modified points
    netChange: z.number(),                      // Net change (added - removed)
  }),

  // Insight deltas
  insightDeltas: z.object({
    newCritical: z.number(),                    // New critical insights
    resolvedCritical: z.number(),               // Resolved critical insights
    newWarnings: z.number(),                    // New warnings
    resolvedWarnings: z.number(),               // Resolved warnings
  }).optional(),
});

// Type exports for comparison
export type ChangeType = z.infer<typeof ChangeType>;
export type FieldChange = z.infer<typeof FieldChange>;
export type ChangedInferencePoint = z.infer<typeof ChangedInferencePoint>;
export type ComparisonResult = z.infer<typeof ComparisonResult>;

// =============================================================================
// DEPLOY-TIME PREDICTION (v1.5)
// =============================================================================

/**
 * Risk level for predictions.
 */
export const RiskLevel = z.enum(['high', 'medium', 'low', 'neutral']);

/**
 * Impact direction for a prediction factor.
 */
export const ImpactDirection = z.enum(['positive', 'negative', 'neutral']);

/**
 * A factor contributing to a latency prediction.
 */
export const PredictionFactor = z.object({
  name: z.string(),                             // Factor name (e.g., "model complexity")
  impact: ImpactDirection,                       // How it affects latency
  description: z.string(),                      // Human-readable explanation
  weight: z.number().min(0).max(1).optional(),  // Relative importance (0-1)
});

/**
 * Latency percentile values.
 */
export const LatencyPercentiles = z.object({
  p50: z.number(),                              // Median latency (ms)
  p95: z.number(),                              // 95th percentile (ms)
  p99: z.number(),                              // 99th percentile (ms)
});

/**
 * Prediction for a single inference point.
 * Surfaces potential performance risks before deployment.
 */
export const InferencePointPrediction = z.object({
  inferencePointId: z.string(),                 // ID of the inference point
  location: z.string(),                         // file:line location
  provider: z.string().optional(),              // Provider (e.g., openai)
  model: z.string().optional(),                 // Model name

  // Current performance (from historical data if available)
  currentLatency: LatencyPercentiles.optional(),

  // Predicted performance
  predictedLatency: LatencyPercentiles,

  // Risk assessment
  risk: RiskLevel,                              // Overall risk level
  riskScore: z.number().min(0).max(100),        // Numeric risk score (0-100)

  // Factors contributing to prediction
  factors: z.array(PredictionFactor),

  // Confidence in prediction
  confidence: z.enum(['high', 'medium', 'low']),
  confidenceReason: z.string().optional(),      // Why confidence is high/low
});

/**
 * Summary of all predictions.
 */
export const PredictionSummary = z.object({
  totalPoints: z.number(),                      // Total inference points analyzed
  highRiskCount: z.number(),                    // High risk predictions
  mediumRiskCount: z.number(),                  // Medium risk predictions
  lowRiskCount: z.number(),                     // Low risk predictions
  averageP95: z.number(),                       // Average predicted p95 latency
  worstP95: z.number(),                         // Worst predicted p95 latency
  budgetExceeded: z.boolean().optional(),       // True if exceeds target latency
});

/**
 * Full prediction result for deploy-time analysis.
 */
export const PredictionResult = z.object({
  predictions: z.array(InferencePointPrediction),
  summary: PredictionSummary,
  targetP95: z.number().optional(),             // User-specified target p95 (ms)
  generatedAt: z.string().datetime(),           // When predictions were generated
  basedOnRuns: z.number(),                      // Number of historical runs used
});

// Type exports for prediction
export type RiskLevel = z.infer<typeof RiskLevel>;
export type ImpactDirection = z.infer<typeof ImpactDirection>;
export type PredictionFactor = z.infer<typeof PredictionFactor>;
export type LatencyPercentiles = z.infer<typeof LatencyPercentiles>;
export type InferencePointPrediction = z.infer<typeof InferencePointPrediction>;
export type PredictionSummary = z.infer<typeof PredictionSummary>;
export type PredictionResult = z.infer<typeof PredictionResult>;

// =============================================================================
// COUNTERFACTUAL INSIGHTS (v1.5)
// =============================================================================

/**
 * Type of counterfactual optimization scenario.
 */
export const CounterfactualType = z.enum([
  'model_swap',        // Swap to a different model (e.g., cheaper or faster)
  'batch_optimization', // Add batching to reduce per-request overhead
  'cache_addition',    // Add caching to bypass LLM for repeated queries
  'provider_change',   // Change provider (e.g., cloud → self-hosted)
  'streaming_enable',  // Enable streaming for better perceived latency
]);

/**
 * Current and proposed state for a counterfactual.
 */
export const CounterfactualState = z.object({
  model: z.string().optional(),           // Model name
  provider: z.string().optional(),        // Provider name
  pattern: z.string().optional(),         // Pattern (streaming, batching, etc.)
  estimatedLatency: z.number(),           // p95 latency estimate (ms)
  estimatedCost: z.number(),              // Cost per 1K calls ($)
});

/**
 * Impact assessment for a counterfactual.
 */
export const CounterfactualImpact = z.object({
  latencyDelta: z.number(),              // Change in p95 latency (ms, negative = improvement)
  latencyDeltaPercent: z.number(),       // Percentage change in latency
  costDelta: z.number(),                 // Change in cost per 1K calls ($, negative = savings)
  costDeltaPercent: z.number(),          // Percentage change in cost
  tradeoffs: z.array(z.string()),        // Tradeoffs to consider
});

/**
 * A single counterfactual "what if" scenario.
 * Shows the road not taken and its potential impact.
 */
export const Counterfactual = z.object({
  id: z.string(),                        // Unique identifier
  type: CounterfactualType,              // Type of optimization
  headline: z.string(),                  // Short description (e.g., "Switch to GPT-4o-mini")
  description: z.string(),               // Detailed explanation

  currentState: CounterfactualState,     // Current configuration
  proposedState: CounterfactualState,    // Proposed configuration

  impact: CounterfactualImpact,          // Estimated impact

  confidence: z.enum(['high', 'medium', 'low']),
  confidenceReason: z.string().optional(),

  affectedPoints: z.array(z.string()),   // Inference point IDs affected
  effort: z.enum(['low', 'medium', 'high']), // Implementation effort
});

/**
 * Summary of counterfactual opportunities.
 */
export const CounterfactualSummary = z.object({
  totalOpportunities: z.number(),        // Total counterfactuals identified
  maxLatencySavingsMs: z.number(),       // Max latency reduction achievable (ms)
  maxLatencySavingsPercent: z.number(),  // Max latency reduction percentage
  maxCostSavings: z.number(),            // Max cost savings achievable ($)
  maxCostSavingsPercent: z.number(),     // Max cost savings percentage
  byType: z.record(z.number()),          // Count by counterfactual type
});

/**
 * Full counterfactual analysis result.
 */
export const CounterfactualResult = z.object({
  counterfactuals: z.array(Counterfactual),
  summary: CounterfactualSummary,
  generatedAt: z.string().datetime(),    // When analysis was performed
});

// Type exports for counterfactuals
export type CounterfactualType = z.infer<typeof CounterfactualType>;
export type CounterfactualState = z.infer<typeof CounterfactualState>;
export type CounterfactualImpact = z.infer<typeof CounterfactualImpact>;
export type Counterfactual = z.infer<typeof Counterfactual>;
export type CounterfactualSummary = z.infer<typeof CounterfactualSummary>;
export type CounterfactualResult = z.infer<typeof CounterfactualResult>;
