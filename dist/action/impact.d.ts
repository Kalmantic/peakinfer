import type { Insight, ImpactEstimate, StackLayer, EffortLevel } from './types.js';
/**
 * Estimate impact for a single insight
 */
export declare function estimateImpact(insight: Insight): ImpactEstimate | null;
/**
 * Add impact estimates to all insights
 */
export declare function enrichInsightsWithImpact(insights: Insight[]): Insight[];
/**
 * Stack ranking summary
 */
export interface StackRanking {
    layer: StackLayer;
    totalImpactPercent: number;
    insightCount: number;
    avgEffort: EffortLevel;
    topInsights: Insight[];
}
export interface ImpactSummary {
    totalPotentialImpact: {
        costReductionPercent: number;
        latencyReductionPercent: number;
        throughputGainPercent: number;
    };
    stackRanking: StackRanking[];
    quickWins: Insight[];
    strategicChanges: Insight[];
    prioritizedList: Insight[];
}
/**
 * Generate comprehensive impact summary with stack ranking
 */
export declare function generateImpactSummary(insights: Insight[]): ImpactSummary;
/**
 * Format impact summary as text for CLI output
 * Julie Zhou design: "Headroom" terminology, intuitive metrics
 *
 * Key principle: Output should be understandable without narration
 */
export declare function formatImpactSummary(summary: ImpactSummary): string;
