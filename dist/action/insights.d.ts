import type { Insight, InsightTemplate, Callsite, EnrichedCallsite, JoinedOutput, PerformanceEnvelope } from './types.js';
export declare function evaluate(data: JoinedOutput | {
    callsites: Callsite[] | EnrichedCallsite[];
}, templates: InsightTemplate[], envelopes?: Record<string, PerformanceEnvelope>): Insight[];
