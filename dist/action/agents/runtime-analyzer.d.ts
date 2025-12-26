/**
 * RuntimeAnalyzerAgent - LLM-based semantic analysis of runtime telemetry
 *
 * From Autonomous Agent Architecture Patterns v0.2:
 * - Subagent with fresh context window
 * - XML-structured prompt from prompts/runtime-analyzer.yaml
 * - Returns condensed summary (insights, not raw data)
 * - Uses dynamic pricing from LiteLLM API
 *
 * Uses Claude Agent SDK (per TDD v1.9.3)
 */
import { type PricingContext } from '../costs.js';
import type { RuntimeSummary, InferenceEvent, Insight } from '../types.js';
import type { BaseAgent } from './index.js';
export interface RuntimeAnalyzerInput {
    events: InferenceEvent[];
    runtimeSummary: RuntimeSummary;
    pricingContext?: PricingContext;
}
export interface RuntimeAnalyzerOutput {
    insights: Insight[];
    detectedPatterns: {
        applicationType: 'rag' | 'agent' | 'batch' | 'chat' | 'pipeline' | 'unknown';
        multiModelPipeline: boolean;
        streamingDetected: boolean;
        batchingDetected: boolean;
        cachingDetected: boolean;
    };
    summary: {
        totalCalls: number;
        totalTokens: number;
        dominantProvider: string;
        dominantModel: string;
        estimatedDailyCostUSD: number;
    };
}
export declare const RuntimeAnalyzerAgent: BaseAgent<RuntimeAnalyzerInput, RuntimeAnalyzerOutput>;
//# sourceMappingURL=runtime-analyzer.d.ts.map