/**
 * =============================================================================
 * SYNC NOTE: This file is copied from peakinfer-site (SOURCE OF TRUTH)
 * Source: peakinfer-site/lib/agents/types.ts
 *
 * DO NOT MODIFY THIS FILE DIRECTLY IN THE CLI REPO.
 * All changes must be made in peakinfer-site first, then synced here.
 * =============================================================================
 */

/**
 * Shared Types for PeakInfer Agents
 * Mirrors CLI types for consistency
 */

// =============================================================================
// INFERENCE POINT TYPES
// =============================================================================

export interface InferencePoint {
  id: string;
  line: number;
  column: number;
  function_context: string;
  class_context: string | null;
  call_expression: string;
  call_type: 'direct' | 'wrapper' | 'framework' | 'http';
  provider: {
    value: string;
    source: 'hardcoded' | 'env' | 'config' | 'parameter' | 'dynamic' | 'unknown';
    confidence: number;
  };
  model: {
    value: string | null;
    source: 'hardcoded' | 'env' | 'config' | 'parameter' | 'dynamic' | 'unknown';
    confidence: number;
  };
  is_async: boolean;
  in_loop: boolean;
  loop_type: 'for' | 'while' | 'map' | 'recursive' | 'none';
  estimated_calls: 'single' | 'multiple' | 'unbounded';
  needs_tracing: boolean;
  confidence: number;
}

// =============================================================================
// IMPORT ANALYZER TYPES
// =============================================================================

export interface SDK {
  name: string;
  provider: string;
  import_line: number;
  alias: string | null;
  confidence: number;
}

export interface Framework {
  name: string;
  import_line: number;
  components: string[];
  confidence: number;
}

export interface CustomWrapper {
  name: string;
  import_path: string;
  likely_purpose: string;
  needs_tracing: boolean;
  confidence: number;
}

export interface Infrastructure {
  name: string;
  type: string;
  import_line: number;
}

export interface ImportAnalyzerOutput {
  sdks: SDK[];
  frameworks: Framework[];
  custom_wrappers: CustomWrapper[];
  infrastructure: Infrastructure[];
  summary: {
    has_llm_usage: boolean;
    primary_provider: string | null;
    framework: string | null;
    complexity: 'simple' | 'moderate' | 'complex';
  };
}

// =============================================================================
// CALLSITE FINDER TYPES
// =============================================================================

export interface WrapperDefinition {
  name: string;
  line: number;
  wraps_provider: string | null;
  wraps_model: string | null;
  is_llm_wrapper: boolean;
  confidence: number;
}

export interface CallSiteFinderOutput {
  inference_points: InferencePoint[];
  wrapper_definitions: WrapperDefinition[];
  summary: {
    total_inference_points: number;
    direct_calls: number;
    wrapped_calls: number;
    framework_calls: number;
    providers_detected: string[];
    models_detected: string[];
    has_dynamic_routing: boolean;
  };
}

// =============================================================================
// COST ANALYZER TYPES
// =============================================================================

export interface CostOptimization {
  type: 'model_downgrade' | 'reduce_tokens' | 'add_caching' | 'batch_requests' | 'limit_context';
  description: string;
  current_cost: string;
  optimized_cost: string;
  savings_percent: number;
  effort: 'low' | 'medium' | 'high';
  sample_change: string | null;
}

export interface CostProfile {
  inference_point_id: string;
  line: number;
  model_analysis: {
    model: string;
    tier: 'premium' | 'standard' | 'budget' | 'unknown';
    pricing: {
      input_per_1m: number;
      output_per_1m: number;
    };
    is_overqualified: boolean;
    reason: string | null;
  };
  token_estimates: {
    input: { min: number; typical: number; max: number; basis: string };
    output: { min: number; typical: number; max: number; basis: string };
    has_few_shot: boolean;
    few_shot_tokens: number;
    has_rag_context: boolean;
    rag_context_estimate: number;
  };
  call_frequency: {
    pattern: 'single' | 'per_request' | 'loop' | 'recursive' | 'batch';
    multiplier: number | null;
    loop_bound: 'bounded' | 'unbounded' | 'unknown';
    estimated_calls_per_invocation: number;
  };
  cost_estimate: {
    per_call_min: number;
    per_call_typical: number;
    per_call_max: number;
    currency: string;
  };
  cost_risk: {
    level: 'low' | 'medium' | 'high' | 'critical';
    factors: string[];
    unbounded_growth: boolean;
    context_accumulation: boolean;
  };
  optimizations: CostOptimization[];
  confidence: number;
}

// =============================================================================
// LATENCY ANALYZER TYPES
// =============================================================================

export interface LatencyOptimization {
  type: 'add_streaming' | 'parallelize' | 'add_async' | 'add_timeout' | 'reduce_chain';
  description: string;
  current_latency: string;
  optimized_latency: string;
  improvement_percent: number;
  effort: 'low' | 'medium' | 'high';
  sample_change: string | null;
}

export interface LatencyProfile {
  inference_point_id: string;
  line: number;
  blocking_analysis: {
    is_blocking: boolean;
    is_in_request_handler: boolean;
    blocks_event_loop: boolean;
    handler_type: 'http' | 'websocket' | 'grpc' | 'background' | 'cli' | 'unknown';
    user_facing: boolean;
  };
  streaming_analysis: {
    streaming_enabled: boolean;
    should_enable_streaming: boolean;
    reason: string;
    time_to_first_token_benefit: string | null;
  };
  async_analysis: {
    is_async: boolean;
    uses_await: boolean;
    could_be_async: boolean;
    async_benefit: string | null;
  };
  parallel_analysis: {
    has_parallel_potential: boolean;
    independent_calls: number;
    current_pattern: 'sequential' | 'parallel' | 'mixed';
    parallelizable_calls: { line: number; reason: string }[];
    parallel_speedup_estimate: string | null;
  };
  chain_analysis: {
    chain_depth: number;
    sequential_calls: number;
    total_latency_estimate: {
      min_ms: number;
      typical_ms: number;
      max_ms: number;
    };
    chain_pattern: 'single' | 'pipeline' | 'loop' | 'recursive' | 'agent';
  };
  timeout_analysis: {
    timeout_configured: boolean;
    timeout_value_ms: number | null;
    has_fallback_on_timeout: boolean;
    timeout_risk: 'none' | 'low' | 'medium' | 'high';
  };
  latency_risk: {
    level: 'low' | 'medium' | 'high' | 'critical';
    factors: string[];
    tail_latency_risk: boolean;
    unpredictable: boolean;
  };
  latency_estimate: {
    min_ms: number;
    typical_ms: number;
    p95_ms: number;
    max_ms: number;
    basis: string;
  };
  optimizations: LatencyOptimization[];
  confidence: number;
}

// =============================================================================
// THROUGHPUT ANALYZER TYPES
// =============================================================================

export interface ThroughputOptimization {
  type: 'add_rate_limiter' | 'add_batching' | 'add_queue' | 'fix_bottleneck' | 'increase_concurrency';
  description: string;
  current_throughput: string;
  optimized_throughput: string;
  improvement: string;
  effort: 'low' | 'medium' | 'high';
  sample_change: string | null;
}

export interface ScalingBottleneck {
  type: 'shared_state' | 'global_client' | 'file_lock' | 'db_connection' | 'memory';
  location: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export interface ThroughputProfile {
  inference_point_id: string;
  line: number;
  concurrency_analysis: {
    concurrency_limit: number | null;
    limit_source: 'semaphore' | 'pool' | 'rate_limiter' | 'none' | 'unknown';
    limit_location: string | null;
    is_global_limit: boolean;
    recommended_limit: number | null;
  };
  rate_limiting: {
    has_rate_limiter: boolean;
    rate_limit_type: 'token_bucket' | 'sliding_window' | 'fixed_window' | 'none';
    requests_per_minute: number | null;
    handles_429: boolean;
    backoff_strategy: 'none' | 'fixed' | 'exponential' | 'custom';
  };
  batching_analysis: {
    batching_enabled: boolean;
    batch_size: number | null;
    could_batch: boolean;
    batching_benefit: string | null;
    batch_api_available: boolean;
  };
  queue_analysis: {
    uses_queue: boolean;
    queue_type: 'celery' | 'rq' | 'bull' | 'sqs' | 'redis' | 'none';
    async_processing: boolean;
    worker_pattern: boolean;
  };
  scaling_analysis: {
    horizontally_scalable: boolean;
    bottlenecks: ScalingBottleneck[];
    stateless: boolean;
    client_reuse: boolean;
  };
  capacity_estimate: {
    max_concurrent_calls: number | null;
    estimated_rps: number | null;
    limiting_factor: string;
  };
  throughput_risk: {
    level: 'low' | 'medium' | 'high' | 'critical';
    factors: string[];
    will_hit_rate_limits: boolean;
    scaling_blocked: boolean;
  };
  optimizations: ThroughputOptimization[];
  confidence: number;
}

// =============================================================================
// RELIABILITY ANALYZER TYPES
// =============================================================================

export interface ReliabilityOptimization {
  type: 'add_retry' | 'add_fallback' | 'add_timeout' | 'add_circuit_breaker' | 'add_validation' | 'fix_antipattern';
  description: string;
  reliability_before: string;
  reliability_after: string;
  effort: 'low' | 'medium' | 'high';
  priority: 'low' | 'medium' | 'high' | 'critical';
  sample_change: string | null;
}

export interface AntiPattern {
  pattern: string;
  location: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

export interface ReliabilityProfile {
  inference_point_id: string;
  line: number;
  error_handling: {
    has_try_catch: boolean;
    caught_exceptions: string[];
    specific_llm_errors: boolean;
    error_logged: boolean;
    error_propagated: boolean;
    silent_failure: boolean;
    user_friendly_error: boolean;
  };
  retry_strategy: {
    has_retry: boolean;
    retry_library: 'tenacity' | 'backoff' | 'custom' | 'none';
    max_retries: number | null;
    backoff_type: 'none' | 'fixed' | 'exponential' | 'custom';
    initial_delay_ms: number | null;
    max_delay_ms: number | null;
    retry_on: string[];
    jitter: boolean;
    retry_budget_risk: 'none' | 'low' | 'medium' | 'high';
  };
  fallback_strategy: {
    has_fallback: boolean;
    fallback_type: 'model' | 'provider' | 'cached' | 'default' | 'none';
    fallback_model: string | null;
    fallback_provider: string | null;
    graceful_degradation: boolean;
    fallback_tested: 'unknown' | 'likely' | 'unlikely';
  };
  timeout_handling: {
    timeout_configured: boolean;
    timeout_ms: number | null;
    timeout_source: 'client' | 'wrapper' | 'none';
    on_timeout: 'retry' | 'fallback' | 'error' | 'none';
  };
  circuit_breaker: {
    has_circuit_breaker: boolean;
    library: string | null;
    failure_threshold: number | null;
    recovery_time_ms: number | null;
  };
  validation: {
    validates_response: boolean;
    validates_json: boolean;
    validates_schema: boolean;
    handles_empty_response: boolean;
    handles_truncated: boolean;
  };
  reliability_risk: {
    level: 'fragile' | 'moderate' | 'robust' | 'resilient';
    factors: string[];
    single_point_of_failure: boolean;
    cascade_risk: boolean;
    data_loss_risk: boolean;
  };
  anti_patterns: AntiPattern[];
  optimizations: ReliabilityOptimization[];
  confidence: number;
}

// =============================================================================
// ISSUE TYPE (for fixes)
// =============================================================================

export interface Issue {
  type: string;
  severity: 'critical' | 'warning' | 'info';
  headline: string;
  evidence: string;
  originalCode: string;
  suggestedFix: string | null;
  aiAgentPrompt: string;
}

// =============================================================================
// PERFORMANCE PROFILE (Combined)
// =============================================================================

export interface PerformanceProfile {
  inference_point_id: string;
  line: number;
  file: string;
  provider: string;
  model: string | null;
  originalCode?: string;
  issues?: Issue[];
  cost: CostProfile | null;
  latency: LatencyProfile | null;
  throughput: ThroughputProfile | null;
  reliability: ReliabilityProfile | null;
}

// =============================================================================
// INSIGHT TYPES
// =============================================================================

export interface Insight {
  id?: string;
  severity: 'critical' | 'warning' | 'info';
  category: 'cost' | 'latency' | 'drift' | 'reliability' | 'waste' | 'throughput' | 'security' | 'best-practice';
  templateId?: string;
  headline: string;
  evidence: string;
  location?: string;
  recommendation?: string;
  source?: 'template' | 'llm';
  impact?: {
    layer: 'application' | 'model' | 'runtime' | 'infrastructure';
    impactType: 'cost' | 'latency' | 'throughput';
    estimatedImpactPercent: number;
    effort: 'low' | 'medium' | 'high';
    annualSavingsUSD?: number;
    latencyReductionMs?: number;
    throughputGainPercent?: number;
    confidence?: number;
    assumptions?: string;
  };
}

// =============================================================================
// STATIC ANALYSIS OUTPUT
// =============================================================================

export interface StaticAnalysisOutput {
  imports: ImportAnalyzerOutput[];
  callsites: CallSiteFinderOutput[];
  performance_profiles: PerformanceProfile[];
  cost_analysis: Array<{
    cost_profiles: CostProfile[];
    summary: {
      total_inference_points: number;
      estimated_cost_per_1k_calls: number;
      highest_cost_point: string | null;
      optimization_potential_percent: number;
    };
  }>;
  latency_analysis: Array<{
    latency_profiles: LatencyProfile[];
    summary: {
      total_inference_points: number;
      blocking_calls: number;
      streaming_enabled: number;
      parallelizable: number;
      estimated_p95_ms: number;
    };
  }>;
  throughput_analysis: Array<{
    throughput_profiles: ThroughputProfile[];
    summary: {
      total_inference_points: number;
      has_rate_limiting: number;
      has_batching: number;
      scaling_bottlenecks: number;
      estimated_max_rps: number | null;
    };
  }>;
  reliability_analysis: Array<{
    reliability_profiles: ReliabilityProfile[];
    summary: {
      total_inference_points: number;
      has_error_handling: number;
      has_retry: number;
      has_fallback: number;
      anti_patterns_found: number;
      overall_reliability: 'fragile' | 'moderate' | 'robust' | 'resilient';
    };
  }>;
  summary: {
    total_files: number;
    total_inference_points: number;
    providers: string[];
    models: string[];
    estimated_cost_per_1k_calls: number;
    cost_risk_high: number;
    blocking_calls: number;
    streaming_enabled: number;
    estimated_p95_ms: number;
    has_rate_limiting: number;
    scaling_bottlenecks: number;
    has_error_handling: number;
    has_retry: number;
    has_fallback: number;
    anti_patterns_found: number;
    overall_reliability: string;
    total_optimizations: number;
    critical_optimizations: number;
  };
  all_optimizations: Array<{
    dimension: 'cost' | 'latency' | 'throughput' | 'reliability';
    inference_point_id: string;
    file: string;
    line: number;
    type: string;
    description: string;
    impact: string;
    effort: string;
    priority: string;
  }>;
  insights: Insight[];
}

// =============================================================================
// INPUT TYPES
// =============================================================================

export interface StaticAnalysisInput {
  files: Array<{
    path: string;
    content: string;
    language: string;
  }>;
}
