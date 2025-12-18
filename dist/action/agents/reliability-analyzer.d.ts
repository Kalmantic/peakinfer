/**
 * Reliability Analyzer Agent
 * Analyzes error handling, resilience, and reliability patterns for LLM inference
 */
import { InferencePoint } from './callsite-finder.js';
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
export interface ReliabilityAnalyzerOutput {
    reliability_profiles: ReliabilityProfile[];
    summary: {
        total_inference_points: number;
        has_error_handling: number;
        has_retry: number;
        has_fallback: number;
        anti_patterns_found: number;
        overall_reliability: 'fragile' | 'moderate' | 'robust' | 'resilient';
    };
}
export interface ReliabilityAnalyzerInput {
    inference_points: InferencePoint[];
    code_contexts: Map<string, string>;
    file_path: string;
}
export declare function analyzeReliability(input: ReliabilityAnalyzerInput): Promise<ReliabilityAnalyzerOutput>;
export declare class ReliabilityAnalyzerAgent {
    name: string;
    description: string;
    execute(input: ReliabilityAnalyzerInput): Promise<ReliabilityAnalyzerOutput>;
}
//# sourceMappingURL=reliability-analyzer.d.ts.map