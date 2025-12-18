/**
 * Latency Analyzer Agent
 * Analyzes latency profile for each LLM inference point
 */
import { InferencePoint } from './callsite-finder.js';
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
        parallelizable_calls: {
            line: number;
            reason: string;
        }[];
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
export interface LatencyAnalyzerOutput {
    latency_profiles: LatencyProfile[];
    summary: {
        total_inference_points: number;
        blocking_calls: number;
        streaming_enabled: number;
        parallelizable: number;
        estimated_p95_ms: number;
    };
}
export interface LatencyAnalyzerInput {
    inference_points: InferencePoint[];
    code_contexts: Map<string, string>;
    file_path: string;
    is_async_file: boolean;
}
export declare function analyzeLatency(input: LatencyAnalyzerInput): Promise<LatencyAnalyzerOutput>;
export declare class LatencyAnalyzerAgent {
    name: string;
    description: string;
    execute(input: LatencyAnalyzerInput): Promise<LatencyAnalyzerOutput>;
}
//# sourceMappingURL=latency-analyzer.d.ts.map