/**
 * Baseline Comparison (v1.6)
 *
 * Fetches historical baseline and compares current results.
 */
type Octokit = any;
type Context = any;
interface BaselineData {
    inferencePoints?: number;
    p95Latency?: number;
    estimatedMonthlyCost?: number;
    timestamp?: string;
}
interface AnalysisResults {
    inferenceMap?: {
        callsites: unknown[];
        summary: {
            totalCallsites: number;
        };
    };
    runtime?: {
        global?: {
            p95: number;
        };
    };
}
interface ComparisonResult {
    inferencePointsDelta: number;
    latencyDeltaPercent?: number;
    costDeltaPercent?: number;
}
/**
 * Get baseline from repository (looks for .peakinfer/baseline.json on base branch)
 */
export declare function getBaseline(octokit: Octokit, context: Context): Promise<BaselineData | null>;
/**
 * Compare current results with baseline
 */
export declare function compareToBaseline(results: AnalysisResults, baseline: unknown): ComparisonResult | null;
export {};
//# sourceMappingURL=baseline.d.ts.map