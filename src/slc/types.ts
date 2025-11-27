/**
 * PeakInfer SLC v1 — Core Type Definitions
 *
 * Design Philosophy:
 * - Minimal types that map directly to PRD v0.95 requirements
 * - Claude-first architecture (Tech Design v1.1)
 * - All types support the 5 UX states (Design Doc)
 */

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
