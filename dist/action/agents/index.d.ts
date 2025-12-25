/**
 * Specialized Agents for PeakInfer
 *
 * Architecture v2.0 (Prompt-Based Analysis):
 * - StaticAnalysisOrchestrator: Prompt-based unified analysis (synced from peakinfer-site)
 * - RuntimeAnalyzerAgent: LLM-based runtime telemetry analysis
 * - CorrelationAnalyzerAgent: LLM-based code-runtime drift detection
 *
 * Legacy agents (still available for compatibility):
 * - DiscoveryAgent: Scan and discover inference points
 * - AnalyzerAgent: Semantic classification with tool-limited analysis
 * - JoinerAgent: Correlate static + runtime truth
 * - InsightAgent: Generate findings from templates
 */
import { type ToolRegistry } from '../tools/index.js';
import type { ScanResult, Callsite, InferenceEvent, JoinedOutput, Insight, InsightTemplate } from '../types.js';
export { RuntimeAnalyzerAgent, type RuntimeAnalyzerInput, type RuntimeAnalyzerOutput } from './runtime-analyzer.js';
export { CorrelationAnalyzerAgent, type CorrelationAnalyzerInput, type CorrelationAnalyzerOutput } from './correlation-analyzer.js';
export { StaticAnalysisOrchestrator, runStaticAnalysis, type StaticAnalysisInput, type StaticAnalysisOutput, type PerformanceProfile, type AnalysisProgressCallback } from '../orchestrator.js';
export type { InferencePoint, CostProfile, LatencyProfile, ThroughputProfile, ReliabilityProfile, Insight, Issue, } from '../analysis-types.js';
export interface AgentInput {
    description: string;
    context?: Record<string, unknown>;
}
export interface AgentOutput<T> {
    result: T;
    toolsUsed: string[];
    contextPointer?: string;
}
export interface BaseAgent<TInput, TOutput> {
    name: string;
    description: string;
    tools: ToolRegistry;
    execute: (input: TInput) => Promise<AgentOutput<TOutput>>;
}
export interface ContextPointer {
    id: string;
    filepath: string;
    agentName: string;
    description: string;
    sizeBytes: number;
    createdAt: string;
}
export interface DiscoveryInput {
    root: string;
}
export interface DiscoveryOutput {
    scanResult: ScanResult;
    candidateFiles: string[];
}
export declare const DiscoveryAgent: BaseAgent<DiscoveryInput, DiscoveryOutput>;
export interface AnalyzerInput {
    scanResult: ScanResult;
    onProgress?: (data: {
        percent: number;
        currentFile?: string;
    }) => void;
}
export interface AnalyzerOutput {
    callsites: Callsite[];
    llmInsights: unknown[];
}
export declare const AnalyzerAgent: BaseAgent<AnalyzerInput, AnalyzerOutput>;
export interface JoinerInput {
    callsites: Callsite[];
    events: InferenceEvent[];
}
export interface JoinerOutput {
    joined: JoinedOutput;
}
export declare const JoinerAgent: BaseAgent<JoinerInput, JoinerOutput>;
export interface InsightInput {
    data: JoinedOutput | {
        callsites: Callsite[];
    };
    templates: InsightTemplate[];
}
export interface InsightOutput {
    insights: Insight[];
}
export declare const InsightAgent: BaseAgent<InsightInput, InsightOutput>;
export declare const AGENTS: {
    readonly discovery: BaseAgent<DiscoveryInput, DiscoveryOutput>;
    readonly analyzer: BaseAgent<AnalyzerInput, AnalyzerOutput>;
    readonly joiner: BaseAgent<JoinerInput, JoinerOutput>;
    readonly insight: BaseAgent<InsightInput, InsightOutput>;
    readonly runtimeAnalyzer: BaseAgent<import("./runtime-analyzer.js").RuntimeAnalyzerInput, import("./runtime-analyzer.js").RuntimeAnalyzerOutput>;
    readonly correlationAnalyzer: BaseAgent<import("./correlation-analyzer.js").CorrelationAnalyzerInput, import("./correlation-analyzer.js").CorrelationAnalyzerOutput>;
};
export type AgentName = keyof typeof AGENTS;
//# sourceMappingURL=index.d.ts.map