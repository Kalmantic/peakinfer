/**
 * Agent-based Semantic Analyzer for PeakInfer
 *
 * Uses Claude's tool use capability for multi-step code analysis:
 * 1. Read source files
 * 2. Extract patterns and variable assignments
 * 3. Trace variable definitions to resolve model names
 * 4. Identify actual LLM callsites (not client initialization)
 */
import 'dotenv/config';
import type { ScanResult, Callsite, Patterns } from './types.js';
interface AgentCallsite {
    file: string;
    line: number;
    provider: string | null;
    model: string | null;
    framework: string | null;
    patterns: Partial<Patterns>;
    confidence: number;
    reasoning: string;
}
interface AgentInsight {
    severity: 'critical' | 'warning' | 'info';
    category: string;
    headline: string;
    evidence: string;
    location: string;
    recommendation?: string;
}
interface AgentAnalysisResult {
    callsites: AgentCallsite[];
    insights: AgentInsight[];
}
export declare function analyzeWithAgent(scanResult: ScanResult, options?: {
    verbose?: boolean;
    maxIterations?: number;
}): Promise<AgentAnalysisResult>;
/**
 * Convert agent results to standard Callsite format
 */
export declare function convertAgentCallsites(agentCallsites: AgentCallsite[]): Callsite[];
export {};
