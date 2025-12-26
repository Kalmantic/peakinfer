/**
 * CorrelationAnalyzerAgent - LLM-based correlation of static code and runtime telemetry
 *
 * From Autonomous Agent Architecture Patterns v0.2:
 * - Subagent with fresh context window
 * - XML-structured prompt from prompts/correlation-analyzer.yaml
 * - Detects drift between code intent and runtime reality
 * - Returns drift signals and alignment score
 *
 * Uses Claude Agent SDK (per TDD v1.9.3)
 */
import type { Callsite, InferenceEvent, RuntimeSummary, Insight, DriftSignal } from '../types.js';
import type { BaseAgent } from './index.js';
export interface CorrelationAnalyzerInput {
    callsites: Callsite[];
    events: InferenceEvent[];
    runtimeSummary: RuntimeSummary;
}
export interface CorrelationAnalyzerOutput {
    insights: Insight[];
    driftSignals: DriftSignal[];
    correlationSummary: {
        totalCodeCallsites: number;
        totalRuntimeModels: number;
        matched: number;
        codeOnly: number;
        runtimeOnly: number;
        mismatched: number;
    };
    alignmentScore: number;
    overallAssessment: string;
}
export declare const CorrelationAnalyzerAgent: BaseAgent<CorrelationAnalyzerInput, CorrelationAnalyzerOutput>;
//# sourceMappingURL=correlation-analyzer.d.ts.map