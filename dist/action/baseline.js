/**
 * Baseline Comparison (v1.6)
 *
 * Fetches historical baseline and compares current results.
 */
// =============================================================================
// MAIN
// =============================================================================
/**
 * Get baseline from repository (looks for .peakinfer/baseline.json on base branch)
 */
export async function getBaseline(octokit, context) {
    const pr = context.payload.pull_request;
    if (!pr) {
        return null;
    }
    try {
        const { data } = await octokit.rest.repos.getContent({
            owner: context.repo.owner,
            repo: context.repo.repo,
            path: '.peakinfer/baseline.json',
            ref: pr.base.ref,
        });
        if (data.content && data.encoding === 'base64') {
            const content = Buffer.from(data.content, 'base64').toString('utf-8');
            const parsed = JSON.parse(content);
            return {
                inferencePoints: parsed.summary?.totalCallsites || parsed.inferencePoints,
                p95Latency: parsed.runtime?.global?.p95 || parsed.p95Latency,
                estimatedMonthlyCost: parsed.estimatedMonthlyCost,
                timestamp: parsed.timestamp || parsed.generatedAt,
            };
        }
        return null;
    }
    catch {
        // Baseline file doesn't exist or can't be read
        return null;
    }
}
/**
 * Compare current results with baseline
 */
export function compareToBaseline(results, baseline) {
    if (!baseline || typeof baseline !== 'object') {
        return null;
    }
    const base = baseline;
    const comparison = {
        inferencePointsDelta: 0,
    };
    // Inference points delta
    const currentPoints = results.inferenceMap?.summary?.totalCallsites || 0;
    if (base.inferencePoints !== undefined) {
        comparison.inferencePointsDelta = currentPoints - base.inferencePoints;
    }
    // Latency delta (with zero-division protection)
    const currentLatency = results.runtime?.global?.p95;
    if (base.p95Latency !== undefined && base.p95Latency > 0 && currentLatency !== undefined) {
        const latencyDelta = currentLatency - base.p95Latency;
        comparison.latencyDeltaPercent = Math.round((latencyDelta / base.p95Latency) * 100);
    }
    // Cost delta (with zero-division protection)
    // Note: cost calculation requires current cost from analysis results
    // For now, we compare inference point counts as a proxy since cost scales with calls
    return comparison;
}
//# sourceMappingURL=baseline.js.map