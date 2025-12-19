/**
 * Static Analysis Orchestrator
 * Runs 6 specialized agents in parallel for comprehensive static code analysis
 */
import { ImportAnalyzerOutput } from './import-analyzer.js';
import { CallSiteFinderOutput } from './callsite-finder.js';
import { CostAnalyzerOutput, CostProfile } from './cost-analyzer.js';
import { LatencyAnalyzerOutput, LatencyProfile } from './latency-analyzer.js';
import { ThroughputAnalyzerOutput, ThroughputProfile } from './throughput-analyzer.js';
import { ReliabilityAnalyzerOutput, ReliabilityProfile } from './reliability-analyzer.js';
export interface StaticAnalysisInput {
    files: Array<{
        path: string;
        content: string;
        language: string;
    }>;
}
export interface PerformanceProfile {
    inference_point_id: string;
    line: number;
    file: string;
    provider: string;
    model: string | null;
    cost: CostProfile | null;
    latency: LatencyProfile | null;
    throughput: ThroughputProfile | null;
    reliability: ReliabilityProfile | null;
}
export interface StaticAnalysisOutput {
    imports: ImportAnalyzerOutput[];
    callsites: CallSiteFinderOutput[];
    performance_profiles: PerformanceProfile[];
    cost_analysis: CostAnalyzerOutput[];
    latency_analysis: LatencyAnalyzerOutput[];
    throughput_analysis: ThroughputAnalyzerOutput[];
    reliability_analysis: ReliabilityAnalyzerOutput[];
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
}
export declare class StaticAnalysisOrchestrator {
    private importAnalyzer;
    private callsiteFinder;
    private costAnalyzer;
    private latencyAnalyzer;
    private throughputAnalyzer;
    private reliabilityAnalyzer;
    private useUnifiedAnalysis;
    analyze(input: StaticAnalysisInput): Promise<StaticAnalysisOutput>;
}
export declare function runStaticAnalysis(input: StaticAnalysisInput): Promise<StaticAnalysisOutput>;
//# sourceMappingURL=static-orchestrator.d.ts.map