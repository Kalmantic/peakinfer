import type { ScanResult, Callsite } from './types.js';
export interface LLMImpactEstimate {
    layer: 'application' | 'api' | 'gateway' | 'runtime' | 'model' | 'hardware';
    impactType: 'cost' | 'latency' | 'throughput';
    estimatedImpactPercent: number;
    effort: 'low' | 'medium' | 'high';
}
export interface LLMInsight {
    severity: 'critical' | 'warning' | 'info';
    category: 'cost' | 'latency' | 'reliability' | 'waste' | 'security' | 'best-practice' | 'throughput';
    headline: string;
    evidence: string;
    location: string;
    recommendation?: string;
    impact?: LLMImpactEstimate;
}
interface AnalyzeOptions {
    useLLM?: boolean;
    useAgent?: boolean;
    verbose?: boolean;
    promptId?: string;
    onProgress?: (data: {
        percent: number;
        currentFile?: string;
    }) => void;
}
/**
 * Result of analyzing scan results
 */
export interface AnalyzeResult {
    callsites: Callsite[];
    insights: LLMInsight[];
}
/**
 * Analyze scan results to extract semantic information from callsites.
 * Uses LLM for semantic analysis when ANTHROPIC_API_KEY is available,
 * falls back to regex patterns otherwise.
 *
 * Returns both callsites AND LLM-generated semantic insights (phase 1).
 * Template-based insights are generated separately (phase 2).
 */
export declare function analyze(scanResult: ScanResult, options?: AnalyzeOptions): Promise<AnalyzeResult>;
/**
 * Re-analyze a single file (for incremental updates)
 */
export declare function analyzeFile(filePath: string, content: string, lines: number[], options?: AnalyzeOptions): Promise<AnalyzeResult>;
export {};
