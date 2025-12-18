/**
 * Cost Analyzer Agent
 * Analyzes cost profile for each LLM inference point
 */
import { InferencePoint } from './callsite-finder.js';
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
        input: {
            min: number;
            typical: number;
            max: number;
            basis: string;
        };
        output: {
            min: number;
            typical: number;
            max: number;
            basis: string;
        };
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
export interface CostAnalyzerOutput {
    cost_profiles: CostProfile[];
    summary: {
        total_inference_points: number;
        estimated_cost_per_1k_calls: number;
        highest_cost_point: string | null;
        optimization_potential_percent: number;
    };
}
export interface CostAnalyzerInput {
    inference_points: InferencePoint[];
    code_contexts: Map<string, string>;
    file_path: string;
}
export declare function analyzeCosts(input: CostAnalyzerInput): Promise<CostAnalyzerOutput>;
export declare class CostAnalyzerAgent {
    name: string;
    description: string;
    execute(input: CostAnalyzerInput): Promise<CostAnalyzerOutput>;
}
//# sourceMappingURL=cost-analyzer.d.ts.map