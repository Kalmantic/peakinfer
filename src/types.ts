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
