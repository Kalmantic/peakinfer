/**
 * PeakInfer v1.3 — Core Type Definitions
 *
 * Design Philosophy:
 * - Types aligned with PRD/TDD/DD v1.3
 * - AI-first architecture with agent-based analysis
 * - Flexible runtime format support
 * - All types support the 5 UX states (Design Doc)
 */

// Re-export format normalization types (v1.3)
export type {
  FormatType,
  FormatDetection,
  FieldMapping,
  ParseResult,
  NormalizationResult,
} from './format/schemas.js';

// =============================================================================
// PROVIDER TYPE (TDD v1.3 Section 7.1)
// =============================================================================

/**
 * Known LLM providers per TDD v1.3
 */
export type Provider =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'cohere'
  | 'mistral'
  | 'bedrock'
  | 'azure_openai'
  | 'together'
  | 'fireworks'
  | 'groq'
  | 'replicate'
  | 'perplexity'
  | 'deepseek'
  | 'unknown';

// =============================================================================
// SCANNER TYPES
// =============================================================================

/** Supported languages for analysis */
export type Language = 'python' | 'typescript' | 'javascript' | 'go' | 'java' | 'unknown';

/** A file discovered during scanning */
export interface ScannedFile {
  path: string;         // Relative to root
  language: Language;
  lines: number;
}

/** Result of the scanning phase */
export interface ScanResult {
  root: string;
  files: ScannedFile[];
  totalFiles: number;
  totalLines: number;
  languages: Partial<Record<Language, number>>;
  durationMs: number;
}

// =============================================================================
// CLAUDE DETECTOR TYPES (P1/P2/P3 Prompts per Tech Design v1.1)
// =============================================================================

/** P1: Raw callsite detected by Claude (high recall) */
export interface RawCallsite {
  id: string;
  file: string;
  startLine: number;
  endLine: number;
  code: string;
  coarseKind: string;     // e.g., "chat", "embedding", "completion"
  confidence: number;
}

/** P2: Classified callsite with full details */
export interface ClassifiedCallsite {
  id: string;
  file: string;
  line: number;
  provider: string | null;
  model: string | null;
  framework: string | null;
  runtime: string | null;
  taskKind: string;
  isStreaming: boolean | null;
  confidence: number;
  reasoning: {
    whyProvider: string;
    whyModel: string;
  };
  optimizationSuggestion?: string;
}

/** P3: Usage estimate (optional) */
export interface UsageEstimate {
  callsiteId: string;
  frequencyKind: 'rare' | 'occasional' | 'frequent' | 'very_frequent';
  inputTokenScale: 'tiny' | 'small' | 'medium' | 'large' | 'huge';
  outputTokenScale: 'tiny' | 'small' | 'medium' | 'large' | 'huge';
  confidence: number;
}

// =============================================================================
// STACKMAP TYPES (PRD v0.95 canonical structure)
// =============================================================================

/** A callsite in the StackMap */
export interface StackMapCallsite {
  line: number;
  pattern: string;        // e.g., "openai.chat.completions.create()"
  provider: string;
  model: string | null;
}

/** A node in the StackMap tree */
export interface StackMapNode {
  name: string;
  path: string;
  type: 'directory' | 'file';
  children?: StackMapNode[];
  callsites?: StackMapCallsite[];
}

/** The complete StackMap */
export interface StackMap {
  root: string;
  tree: StackMapNode[];
  summary: {
    totalCallsites: number;
    providers: string[];
    models: string[];
  };
}

// =============================================================================
// PRICING TYPES
// =============================================================================

/** Pricing for a model */
export interface ModelPricing {
  provider: string;
  model: string;
  inputPer1M: number;     // $ per 1M input tokens
  outputPer1M: number;    // $ per 1M output tokens
}

/** Cost estimate for a callsite */
export interface CallsiteCost {
  file: string;
  line: number;
  model: string;
  estimatedMonthlyLow: number;
  estimatedMonthlyHigh: number;
  suggestion?: string;  // Optimization suggestion for this hotspot
}

/** Pricing summary */
export interface PricingSummary {
  estimatedRange: { low: number; high: number };
  mostExpensiveModel: string | null;
  byProvider: Array<{ provider: string; cost: number; percentage: number }>;
  byModel: Array<{ model: string; cost: number }>;
  hotspots: CallsiteCost[];
}

// =============================================================================
// ANALYSIS STATE (Design Doc — 5 states)
// =============================================================================

export type AnalysisState = 'zero' | 'loading' | 'partial' | 'error' | 'success';

/** Error details */
export interface AnalysisError {
  code: 'NO_FILES' | 'PERMISSION_DENIED' | 'INVALID_PATH' | 'API_KEY_MISSING' | 'API_ERROR';
  message: string;
  suggestion: string;
}

/** Complete analysis result */
export interface AnalysisResult {
  state: AnalysisState;
  scan?: ScanResult;
  callsites?: ClassifiedCallsite[];
  stackMap?: StackMap;
  pricing?: PricingSummary;
  error?: AnalysisError;
  warnings?: string[];
}

// =============================================================================
// CODE CHUNK (for Claude analysis)
// =============================================================================

/** A chunk of code sent to Claude for analysis */
export interface CodeChunk {
  file: string;
  language: Language;
  content: string;
  startLine: number;
  endLine: number;
}

// =============================================================================
// TECH STACK TYPES (Application → Serving → Infrastructure → Hardware)
// =============================================================================

/** Application layer components */
export interface AppLayer {
  frameworks: string[];       // LangChain, LlamaIndex, Haystack, DSPy, etc.
  sdks: string[];             // openai, anthropic, google-generativeai, etc.
  patterns: string[];         // RAG, agents, chains, prompt templates, etc.
}

/** Serving layer components */
export interface ServingLayer {
  runtimes: string[];         // vLLM, TGI, TensorRT-LLM, SGLang, Ollama, etc.
  gateways: string[];         // LiteLLM, Portkey, OpenRouter, etc.
  platforms: string[];        // Together, Fireworks, Groq, Replicate, etc.
}

/** Infrastructure layer components */
export interface InfraLayer {
  cloud: string[];            // AWS Bedrock, GCP Vertex, Azure OpenAI, etc.
  compute: string[];          // EC2, GCE, Lambda, Cloud Run, etc.
  orchestration: string[];    // Kubernetes, Docker, Ray, Modal, etc.
}

/** Hardware layer components */
export interface HardwareLayer {
  gpus: string[];             // A100, H100, A10G, T4, L4, etc.
  accelerators: string[];     // TPU, Inferentia, Trainium, etc.
  estimated: boolean;         // True if inferred from runtime/platform
}

/** Complete inference tech stack */
export interface TechStack {
  application: AppLayer;
  serving: ServingLayer;
  infrastructure: InfraLayer;
  hardware: HardwareLayer;
}

// =============================================================================
// INFERENCE PATTERNS (PRD v0.95 Section 9 - Patterns Detected)
// =============================================================================

/** A detected pattern instance */
export interface PatternInstance {
  file: string;
  line: number;
  code?: string;
}

/** Inference patterns detected in the codebase */
export interface InferencePatterns {
  /** Retry/backoff patterns */
  retry: {
    detected: boolean;
    instances: PatternInstance[];
    type?: 'exponential_backoff' | 'fixed_delay' | 'circuit_breaker' | 'tenacity' | 'other';
  };

  /** Batching patterns */
  batching: {
    detected: boolean;
    instances: PatternInstance[];
    type?: 'client_side' | 'server_side' | 'continuous' | 'offline_batch_api' | 'other';
  };

  /** Streaming patterns */
  streaming: {
    detected: boolean;
    instances: PatternInstance[];
    type?: 'sse' | 'websocket' | 'chunked' | 'other';
  };

  /** Caching patterns */
  caching: {
    detected: boolean;
    instances: PatternInstance[];
    type?: 'exact_match' | 'semantic' | 'kv_cache' | 'prompt_caching' | 'disk' | 'other';
  };

  /** Routing/model selection patterns */
  routing: {
    detected: boolean;
    instances: PatternInstance[];
    type?: 'static' | 'cost_based' | 'latency_based' | 'quality_based' | 'cascade' | 'ab_test' | 'other';
  };

  /** Fallback chain patterns */
  fallback: {
    detected: boolean;
    instances: PatternInstance[];
    type?: 'provider_fallback' | 'model_fallback' | 'graceful_degradation' | 'other';
  };

  /** Guardrails/safety patterns */
  guardrails: {
    detected: boolean;
    instances: PatternInstance[];
    type?: 'input_validation' | 'output_validation' | 'pii_detection' | 'content_moderation' | 'nemo' | 'guardrails_ai' | 'other';
  };
}

// =============================================================================
// RISK DETECTION (PRD v0.95 Section 15 - Risks & Mitigations)
// =============================================================================

/** Risk severity levels */
export type RiskSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/** A detected risk in the codebase */
export interface DetectedRisk {
  id: string;
  severity: RiskSeverity;
  category: 'reliability' | 'cost' | 'security' | 'vendor_lock_in' | 'performance' | 'compliance';
  title: string;
  description: string;
  affectedFiles: string[];
  recommendation: string;
  effort: 'low' | 'medium' | 'high';
}

/** Risk assessment summary */
export interface RiskAssessment {
  overallScore: number;  // 0-100, higher is better (fewer risks)
  risks: DetectedRisk[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

// =============================================================================
// CANONICAL CALLSITE (TDD v1.3 Section 7.1)
// =============================================================================

/**
 * Canonical Static Callsite - the ground truth from code analysis.
 * This is the TDD v1.3 compliant interface.
 */
export interface Callsite {
  /** Stable hash of file+line+signature */
  id: string;
  
  /** Relative path to file */
  file: string;
  
  /** Line number of the callsite */
  line: number;
  
  /** Source language */
  language: Language;
  
  /** Detected provider (may be null if indeterminate) */
  provider: Provider | null;
  
  /** Detected model (may be null if runtime-configured) */
  model: string | null;
  
  /** Framework if using one (langchain, llamaindex, etc.) */
  framework: string | null;
  
  /** Runtime if self-hosted (vllm, sglang, ollama, etc.) */
  runtime: string | null;
  
  /** Detected patterns at this callsite */
  patterns: {
    streaming?: boolean;
    batching?: boolean;
    retries?: boolean;
    caching?: boolean;
    routing?: boolean;
    fallback?: boolean;
  };
  
  /** Confidence in this detection (0-1) */
  confidence: number;
  
  /** Evidence for classification decisions */
  evidence: {
    whyProvider?: string;
    whyModel?: string;
    snippetsRedacted?: boolean;
  };
}

// =============================================================================
// JOINED OUTPUT & DRIFT DETECTION (TDD v1.3 Section 7.4 & 10)
// =============================================================================

/**
 * Runtime usage statistics for a callsite.
 * Computed from correlated runtime events.
 */
export interface UsageStats {
  /** Number of calls observed */
  calls: number;
  
  /** Total input tokens */
  tokens_in: number;
  
  /** Total output tokens */
  tokens_out: number;
  
  /** Total cost in USD */
  cost_usd: number;
  
  /** Latency percentiles in ms */
  latency: {
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  };
  
  /** Time range of observations */
  timeRange: {
    start: string;
    end: string;
  };
}

/**
 * Types of drift that can be detected between code and runtime.
 */
export type DriftType = 
  | 'code_only'       // In code but never observed at runtime
  | 'runtime_only'    // Observed at runtime but not found in code
  | 'model_mismatch'  // Code says one model, runtime shows another
  | 'provider_mismatch' // Code says one provider, runtime shows another
  | 'pattern_mismatch'; // Pattern in code doesn't match runtime behavior

/**
 * A detected drift signal between static code and runtime behavior.
 * TDD v1.3 Section 10.2
 */
export interface DriftSignal {
  /** Type of drift detected */
  type: DriftType;
  
  /** Severity of the drift */
  severity: 'info' | 'warning' | 'error';
  
  /** Human-readable description */
  description: string;
  
  /** Related callsite ID (if applicable) */
  callsiteId?: string;
  
  /** File where drift was detected */
  file?: string;
  
  /** Line number (if applicable) */
  line?: number;
  
  /** Value in code (if mismatch) */
  codeValue?: string;
  
  /** Value observed at runtime (if mismatch) */
  runtimeValue?: string;
  
  /** Number of runtime observations */
  observationCount?: number;
  
  /** Evidence supporting this drift signal */
  evidence: string[];
}

/**
 * Complete joined analysis result - static code + runtime events.
 * TDD v1.3 Section 7.4
 */
export interface JoinedInference {
  /** Callsites enriched with runtime usage stats */
  callsites: Array<Callsite & { usage?: UsageStats }>;
  
  /** Runtime events with no matching callsite in code */
  runtimeOnly: Array<{
    provider: string;
    model: string;
    callCount: number;
    totalCost: number;
    avgLatency: number;
    firstSeen: string;
    lastSeen: string;
  }>;
  
  /** Callsites in code that were never observed at runtime */
  codeOnly: Callsite[];
  
  /** Detected drift signals */
  drift: DriftSignal[];
  
  /** Join statistics */
  joinStats: {
    /** Total callsites from static analysis */
    totalCallsites: number;
    /** Callsites matched to runtime events */
    matchedCallsites: number;
    /** Total runtime event records */
    totalEvents: number;
    /** Events matched to callsites */
    matchedEvents: number;
    /** Join confidence score (0-1) */
    confidence: number;
  };
}

// =============================================================================
// COMBINED ANALYSIS RESULT (TDD v1.3)
// =============================================================================

/**
 * Complete result from combined static + runtime analysis.
 */
export interface CombinedAnalysisResult {
  /** Analysis state */
  state: AnalysisState;
  
  /** Scan results */
  scan?: ScanResult;
  
  /** Static analysis callsites (before join) */
  staticCallsites?: Callsite[];
  
  /** Runtime event summary */
  runtimeSummary?: {
    totalEvents: number;
    timeRange: { start: string; end: string };
    providers: string[];
    models: string[];
    format: string;
    formatConfidence: number;
  };
  
  /** Joined analysis with drift detection */
  joined?: JoinedInference;
  
  /** StackMap (includes both static and runtime info) */
  stackMap?: StackMap;
  
  /** Pricing analysis */
  pricing?: PricingSummary;
  
  /** Tech stack detection */
  techStack?: TechStack;
  
  /** Detected patterns */
  patterns?: InferencePatterns;
  
  /** Errors if any */
  error?: AnalysisError;
  
  /** Warnings */
  warnings?: string[];
}
