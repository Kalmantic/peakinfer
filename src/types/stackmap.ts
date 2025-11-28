/**
 * StackMap Type Definitions
 * Based on PRD v0.95 and Technical Design Document v1.1
 * 
 * StackMap is the canonical product object - the complete inference topology
 * reconstructed from code analysis.
 */

/**
 * Complete StackMap - The canonical output of PeakInfer analysis
 */
export interface StackMap {
  /** All detected inference callsites */
  callsites: Callsite[];
  
  /** Models used across the codebase */
  models: ModelInfo[];
  
  /** Vendors/Providers detected */
  vendors: VendorInfo[];
  
  /** Serving runtimes detected or inferred */
  runtimes: RuntimeInfo[];
  
  /** Hardware detected or inferred */
  hardware: HardwareInfo[];
  
  /** Orchestration frameworks detected */
  frameworks: FrameworkInfo[];
  
  /** Patterns detected across the codebase */
  patterns: PatternDetection;
  
  /** Analysis metadata */
  metadata: StackMapMetadata;
}

/**
 * Individual inference callsite
 */
export interface Callsite {
  /** Unique identifier */
  id: string;
  
  /** File path */
  file: string;
  
  /** Starting line number */
  line: number;
  
  /** Ending line number */
  lineEnd: number;
  
  /** Code snippet */
  code: string;
  
  /** Detected provider (openai, anthropic, etc.) */
  provider: string | null;
  
  /** Detected model name */
  model: string | null;
  
  /** Orchestration framework if any */
  framework: string | null;
  
  /** Serving runtime if detected */
  runtime: string | null;
  
  /** Task type (chat, completion, embedding, etc.) */
  taskKind: string;
  
  /** Whether streaming is enabled */
  isStreaming: boolean | null;
  
  /** Patterns detected at this callsite */
  patterns: string[];
  
  /** Detection confidence (0-1) */
  confidence: number;
  
  /** Language of the source file */
  language: string;
  
  /** Function name containing this callsite */
  functionName?: string;
  
  /** Estimated tokens per call */
  estimatedTokens?: TokenEstimate;
  
  /** Reasoning for classification */
  reasoning?: {
    whyProvider?: string;
    whyModel?: string;
  };
}

/**
 * Token usage estimate
 */
export interface TokenEstimate {
  inputScale: 'tiny' | 'small' | 'medium' | 'large' | 'xlarge';
  outputScale: 'tiny' | 'small' | 'medium' | 'large' | 'xlarge';
  frequencyKind: 'rare' | 'occasional' | 'frequent' | 'very_frequent' | 'continuous';
  estimatedInputTokens?: number;
  estimatedOutputTokens?: number;
}

/**
 * Model information aggregated across callsites
 */
export interface ModelInfo {
  /** Model name */
  name: string;
  
  /** Provider */
  provider: string;
  
  /** Number of callsites using this model */
  callCount: number;
  
  /** Files using this model */
  files: string[];
  
  /** Estimated tokens per month */
  estimatedTokensPerMonth: number;
  
  /** Task types this model is used for */
  taskKinds: string[];
}

/**
 * Vendor/Provider information
 */
export interface VendorInfo {
  /** Vendor name */
  name: string;
  
  /** SDK type (direct, langchain, etc.) */
  sdkType: string;
  
  /** Number of callsites */
  callCount: number;
  
  /** Models used from this vendor */
  models: string[];
  
  /** Files using this vendor */
  files: string[];
}

/**
 * Serving runtime information
 */
export interface RuntimeInfo {
  /** Runtime name (vLLM, TGI, etc.) */
  name: string;
  
  /** Version if detected */
  version?: string;
  
  /** Vendor this runtime serves */
  vendor?: string;
  
  /** Whether inferred or explicitly detected */
  inferred: boolean;
  
  /** Configuration if detected */
  config?: Record<string, any>;
}

/**
 * Hardware information
 */
export interface HardwareInfo {
  /** Hardware type (H100, A100, etc.) */
  type: string;
  
  /** Provider using this hardware */
  provider: string;
  
  /** Whether inferred or explicitly detected */
  inferred: boolean;
  
  /** Detection source */
  source: string;
}

/**
 * Orchestration framework information
 */
export interface FrameworkInfo {
  /** Framework name (LangChain, LlamaIndex, etc.) */
  name: string;
  
  /** Version if detected */
  version?: string;
  
  /** Number of callsites using this framework */
  callCount: number;
  
  /** Files using this framework */
  files: string[];
}

/**
 * Pattern detection across codebase
 */
export interface PatternDetection {
  /** Retry logic detected */
  hasRetry: boolean;
  retryLocations?: string[];
  
  /** Batching detected */
  hasBatching: boolean;
  batchingLocations?: string[];
  
  /** Streaming detected */
  hasStreaming: boolean;
  streamingLocations?: string[];
  
  /** Caching detected */
  hasCaching: boolean;
  cachingLocations?: string[];
  cacheType?: 'semantic' | 'exact' | 'distributed' | 'prompt';
  
  /** Router/model switching detected */
  hasRouting: boolean;
  routingLocations?: string[];
  routingType?: 'static' | 'cost-based' | 'latency-based' | 'quality-based';
  
  /** Fallback chain detected */
  hasFallback: boolean;
  fallbackLocations?: string[];
}

/**
 * StackMap metadata
 */
export interface StackMapMetadata {
  /** Analysis timestamp */
  analyzedAt: string;
  
  /** PeakInfer version */
  version: string;
  
  /** Total files scanned */
  filesScanned: number;
  
  /** Total lines of code */
  linesOfCode: number;
  
  /** Languages detected */
  languages: string[];
  
  /** Analysis duration in ms */
  durationMs: number;
  
  /** Files that were skipped */
  skippedFiles?: { file: string; reason: string }[];
  
  /** Confidence scores by category */
  confidenceScores?: {
    overall: number;
    callsiteDetection: number;
    modelClassification: number;
    patternDetection: number;
  };
}

/**
 * Pricing calculation result
 */
export interface PricingResult {
  /** Estimated monthly cost (low estimate) */
  estimatedMonthlyCost: number;
  
  /** Estimated monthly cost (high estimate) */
  estimatedMonthlyCostHigh: number;
  
  /** Cost breakdown by vendor */
  byVendor: {
    name: string;
    cost: number;
    percentage: number;
  }[];
  
  /** Cost breakdown by model */
  byModel: {
    name: string;
    provider: string;
    cost: number;
    percentage: number;
  }[];
  
  /** Pricing deltas (changes since last sync) */
  deltas?: {
    vendor: string;
    model: string;
    change: number;
    date: string;
  }[];
  
  /** Alternative pricing options */
  alternatives?: {
    model: string;
    currentProvider: string;
    provider: string;
    cost: string;
    savings: string;
  }[];
  
  /** Pricing data timestamp */
  pricingDataDate: string;
}

/**
 * Optimization suggestion from template matching
 */
export interface Suggestion {
  /** Unique identifier */
  id: string;
  
  /** Location (file:line) */
  location: string;
  
  /** Issue description */
  issue: string;
  
  /** Recommendation */
  recommendation: string;
  
  /** Matched template ID */
  templateId?: string;
  
  /** Template name */
  templateName?: string;
  
  /** Priority level */
  priority: 'critical' | 'high' | 'medium' | 'low';
  
  /** Estimated monthly savings */
  estimatedMonthlySavings?: number;
  
  /** Implementation complexity */
  complexity: 'low' | 'medium' | 'high';
  
  /** Confidence score */
  confidence: number;
  
  /** Implementation steps from template */
  implementationSteps?: string[];
  
  /** Expected cost reduction */
  expectedCostReduction?: string;
  
  /** Effort estimate */
  effortEstimate?: string;
}

/**
 * Complete analysis result
 */
export interface AnalysisResult {
  /** StackMap - the core output */
  stackmap: StackMap;
  
  /** Pricing calculations */
  pricing: PricingResult | null;
  
  /** Template-based suggestions */
  suggestions: Suggestion[];
  
  /** Analysis metadata */
  metadata: {
    analyzedAt: string;
    codebasePath: string;
    filesScanned: number;
    linesOfCode: number;
    languages: string[];
    filesWithCalls: number;
    templatesMatched: number;
  };
}

/**
 * CLI State enum for rendering
 */
export type CLIState = 'empty' | 'loading' | 'success' | 'error' | 'partial';

/**
 * Progress callback for analysis
 */
export interface AnalysisProgress {
  currentFile: string;
  filesProcessed: number;
  totalFiles: number;
  percentage: number;
  phase: 'scanning' | 'detecting' | 'classifying' | 'estimating';
}

/**
 * Analysis options
 */
export interface AnalysisOptions {
  /** Include token usage estimates (slower) */
  estimateUsage?: boolean;
  
  /** Progress callback */
  onProgress?: (progress: AnalysisProgress) => void;
  
  /** Maximum files to scan */
  maxFiles?: number;
  
  /** Ignore patterns */
  ignorePatterns?: string[];
  
  /** Minimum confidence threshold */
  minConfidence?: number;
}

/**
 * Claude Detection Schemas (per Technical Design Doc v1.1)
 */

/** P1: Detect Callsites Response */
export interface P1DetectResponse {
  task: 'detect_callsites';
  version: string;
  analysis_id: string;
  language: string;
  file_path: string;
  callsites: {
    id: string;
    start_line: number;
    end_line: number;
    invocation_code: string;
    coarse_call_kind: string;
    coarse_task_kind: string;
    confidence: number;
  }[];
}

/** P2: Classify Callsite Response */
export interface P2ClassifyResponse {
  task: 'classify_callsite';
  version: string;
  callsite_id: string;
  provider: string | null;
  model: string | null;
  framework: string | null;
  runtime_or_gateway: string | null;
  task_kind: string;
  is_streaming: boolean | null;
  confidence: number;
  reasoning: {
    why_provider: string;
    why_model: string;
  };
}

/** P3: Estimate Usage Response */
export interface P3EstimateResponse {
  task: 'estimate_usage';
  version: string;
  callsite_id: string;
  frequency_kind: 'rare' | 'occasional' | 'frequent' | 'very_frequent' | 'continuous';
  input_token_scale: 'tiny' | 'small' | 'medium' | 'large' | 'xlarge';
  output_token_scale: 'tiny' | 'small' | 'medium' | 'large' | 'xlarge';
  confidence: number;
}

