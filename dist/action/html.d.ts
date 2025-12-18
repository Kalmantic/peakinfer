import type { InferenceMap, Insight, JoinedOutput, RuntimeSummary } from './types.js';
import { type ImpactSummary } from './impact.js';
export interface HTMLData {
    inferenceMap: InferenceMap;
    insights: Insight[];
    joined?: JoinedOutput;
    runtime?: RuntimeSummary;
    impactSummary?: ImpactSummary;
}
export declare function generateHTML(data: HTMLData): string;
