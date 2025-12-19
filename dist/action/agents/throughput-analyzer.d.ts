/**
 * Throughput Analyzer Agent
 * Analyzes throughput constraints and scaling potential for LLM inference
 */
import { InferencePoint } from './callsite-finder.js';
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
export interface ThroughputAnalyzerOutput {
    throughput_profiles: ThroughputProfile[];
    summary: {
        total_inference_points: number;
        has_rate_limiting: number;
        has_batching: number;
        scaling_bottlenecks: number;
        estimated_max_rps: number | null;
    };
}
export interface ThroughputAnalyzerInput {
    inference_points: InferencePoint[];
    code_contexts: Map<string, string>;
    file_imports: string;
    file_path: string;
}
export declare function analyzeThroughput(input: ThroughputAnalyzerInput): Promise<ThroughputAnalyzerOutput>;
export declare class ThroughputAnalyzerAgent {
    name: string;
    description: string;
    execute(input: ThroughputAnalyzerInput): Promise<ThroughputAnalyzerOutput>;
}
//# sourceMappingURL=throughput-analyzer.d.ts.map