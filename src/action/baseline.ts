/**
 * Baseline Comparison (v1.6)
 *
 * Fetches historical baseline and compares current results.
 */

// =============================================================================
// TYPES
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Octokit = any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    summary: { totalCallsites: number };
  };
  runtime?: { global?: { p95: number } };
}

interface ComparisonResult {
  inferencePointsDelta: number;
  latencyDeltaPercent?: number;
  costDeltaPercent?: number;
}

// =============================================================================
// MAIN
// =============================================================================

/**
 * Get baseline from repository (looks for .peakinfer/baseline.json on base branch)
 */
export async function getBaseline(
  octokit: Octokit,
  context: Context
): Promise<BaselineData | null> {
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
  } catch {
    // Baseline file doesn't exist or can't be read
    return null;
  }
}

/**
 * Compare current results with baseline
 */
export function compareToBaseline(
  results: AnalysisResults,
  baseline: unknown
): ComparisonResult | null {
  if (!baseline || typeof baseline !== 'object') {
    return null;
  }

  const base = baseline as BaselineData;
  const comparison: ComparisonResult = {
    inferencePointsDelta: 0,
  };

  // Inference points delta
  const currentPoints = results.inferenceMap?.summary?.totalCallsites || 0;
  if (base.inferencePoints !== undefined) {
    comparison.inferencePointsDelta = currentPoints - base.inferencePoints;
  }

  // Latency delta
  const currentLatency = results.runtime?.global?.p95;
  if (base.p95Latency !== undefined && currentLatency !== undefined) {
    const latencyDelta = currentLatency - base.p95Latency;
    comparison.latencyDeltaPercent = (latencyDelta / base.p95Latency) * 100;
  }

  return comparison;
}
