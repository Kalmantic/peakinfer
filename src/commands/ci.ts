/**
 * CI Command (v1.6)
 *
 * CLI command for CI/CD integration:
 * - Runs analysis with baseline comparison
 * - Returns exit codes for CI gates
 * - Outputs machine-readable JSON
 *
 * Exit codes:
 * - 0: Pass (no regressions)
 * - 1: Warning (minor regressions)
 * - 2: Fail (major regressions)
 */

import { Command } from 'commander';
import { existsSync, readFileSync } from 'fs';
import { Agent } from '../agent.js';

// =============================================================================
// TYPES
// =============================================================================

interface CIOptions {
  baseline?: string;
  targetP95?: number;
  failOnRegression?: boolean;
  output?: string;
  verbose?: boolean;
}

interface CIResult {
  status: 'pass' | 'warning' | 'fail';
  exitCode: number;
  summary: {
    inferencePoints: number;
    estimatedMonthlyCost?: number;
    p95Latency?: number;
    driftCount?: number;
    insightCount?: number;
  };
  baseline?: {
    inferencePoints: number;
    estimatedMonthlyCost?: number;
    p95Latency?: number;
  };
  delta?: {
    inferencePointsDelta: number;
    costDeltaPercent?: number;
    latencyDeltaPercent?: number;
  };
  regressions: string[];
  improvements: string[];
}

interface BaselineData {
  inferencePoints: number;
  estimatedMonthlyCost?: number;
  p95Latency?: number;
  version?: string;
  timestamp?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Load baseline from file
 */
function loadBaseline(path: string): BaselineData | null {
  if (!existsSync(path)) {
    return null;
  }

  try {
    const content = readFileSync(path, 'utf-8');
    const data = JSON.parse(content);

    return {
      inferencePoints: data.summary?.totalCallsites || data.inferencePoints || 0,
      estimatedMonthlyCost: data.estimatedMonthlyCost,
      p95Latency: data.p95Latency || data.global?.p95,
      version: data.version,
      timestamp: data.generatedAt || data.timestamp,
    };
  } catch {
    return null;
  }
}

/**
 * Determine CI status based on analysis results and baseline
 */
function determineCIStatus(
  result: CIResult['summary'],
  baseline: BaselineData | null,
  options: CIOptions
): CIResult {
  const regressions: string[] = [];
  const improvements: string[] = [];
  let status: 'pass' | 'warning' | 'fail' = 'pass';

  const ciResult: CIResult = {
    status: 'pass',
    exitCode: 0,
    summary: result,
    regressions,
    improvements,
  };

  // Check target p95 if specified
  if (options.targetP95 && result.p95Latency) {
    if (result.p95Latency > options.targetP95) {
      regressions.push(`p95 latency ${result.p95Latency}ms exceeds target ${options.targetP95}ms`);
      status = 'fail';
    }
  }

  // Compare with baseline if available
  if (baseline) {
    ciResult.baseline = {
      inferencePoints: baseline.inferencePoints,
      estimatedMonthlyCost: baseline.estimatedMonthlyCost,
      p95Latency: baseline.p95Latency,
    };

    const inferencePointsDelta = result.inferencePoints - baseline.inferencePoints;

    ciResult.delta = {
      inferencePointsDelta,
    };

    // Check inference point changes
    if (inferencePointsDelta > 0) {
      improvements.push(`${inferencePointsDelta} new inference point${inferencePointsDelta !== 1 ? 's' : ''} detected`);
    } else if (inferencePointsDelta < 0) {
      improvements.push(`${Math.abs(inferencePointsDelta)} inference point${Math.abs(inferencePointsDelta) !== 1 ? 's' : ''} removed`);
    }

    // Check cost regression
    if (baseline.estimatedMonthlyCost && result.estimatedMonthlyCost) {
      const costDelta = result.estimatedMonthlyCost - baseline.estimatedMonthlyCost;
      const costDeltaPercent = (costDelta / baseline.estimatedMonthlyCost) * 100;
      ciResult.delta.costDeltaPercent = costDeltaPercent;

      if (costDeltaPercent > 100) {
        regressions.push(`Cost increased by ${costDeltaPercent.toFixed(0)}% (>${100}% threshold)`);
        status = 'fail';
      } else if (costDeltaPercent > 50) {
        regressions.push(`Cost increased by ${costDeltaPercent.toFixed(0)}% (warning threshold)`);
        if (status === 'pass') status = 'warning';
      } else if (costDeltaPercent < -10) {
        improvements.push(`Cost decreased by ${Math.abs(costDeltaPercent).toFixed(0)}%`);
      }
    }

    // Check latency regression
    if (baseline.p95Latency && result.p95Latency) {
      const latencyDelta = result.p95Latency - baseline.p95Latency;
      const latencyDeltaPercent = (latencyDelta / baseline.p95Latency) * 100;
      ciResult.delta.latencyDeltaPercent = latencyDeltaPercent;

      if (latencyDeltaPercent > 50) {
        regressions.push(`p95 latency increased by ${latencyDeltaPercent.toFixed(0)}% (>${50}% threshold)`);
        status = 'fail';
      } else if (latencyDeltaPercent > 25) {
        regressions.push(`p95 latency increased by ${latencyDeltaPercent.toFixed(0)}% (warning threshold)`);
        if (status === 'pass') status = 'warning';
      } else if (latencyDeltaPercent < -10) {
        improvements.push(`p95 latency improved by ${Math.abs(latencyDeltaPercent).toFixed(0)}%`);
      }
    }
  }

  // Set final status and exit code
  ciResult.status = status;
  ciResult.exitCode = status === 'fail' ? 2 : status === 'warning' ? 1 : 0;

  // Override exit code if --fail-on-regression is set
  if (options.failOnRegression && regressions.length > 0) {
    ciResult.exitCode = 2;
    ciResult.status = 'fail';
  }

  return ciResult;
}

/**
 * Format CI result for console output
 */
function formatCIResult(result: CIResult): string {
  const lines: string[] = [];
  const statusIndicator = result.status === 'pass' ? '[PASS]' : result.status === 'warning' ? '[WARN]' : '[FAIL]';

  lines.push(`\n${statusIndicator} PeakInfer CI Check: ${result.status.toUpperCase()}`);
  lines.push('═'.repeat(50));

  lines.push('\nSummary:');
  lines.push(`  Inference Points: ${result.summary.inferencePoints}`);
  if (result.summary.estimatedMonthlyCost) {
    lines.push(`  Est. Monthly Cost: $${result.summary.estimatedMonthlyCost.toLocaleString()}`);
  }
  if (result.summary.p95Latency) {
    lines.push(`  p95 Latency: ${result.summary.p95Latency}ms`);
  }
  if (result.summary.driftCount) {
    lines.push(`  Drift Signals: ${result.summary.driftCount}`);
  }
  if (result.summary.insightCount) {
    lines.push(`  Insights: ${result.summary.insightCount}`);
  }

  if (result.delta) {
    lines.push('\nChanges vs Baseline:');
    lines.push(`  Inference Points: ${result.delta.inferencePointsDelta >= 0 ? '+' : ''}${result.delta.inferencePointsDelta}`);
    if (result.delta.costDeltaPercent !== undefined) {
      lines.push(`  Cost: ${result.delta.costDeltaPercent >= 0 ? '+' : ''}${result.delta.costDeltaPercent.toFixed(1)}%`);
    }
    if (result.delta.latencyDeltaPercent !== undefined) {
      lines.push(`  p95 Latency: ${result.delta.latencyDeltaPercent >= 0 ? '+' : ''}${result.delta.latencyDeltaPercent.toFixed(1)}%`);
    }
  }

  if (result.regressions.length > 0) {
    lines.push('\nRegressions:');
    for (const r of result.regressions) {
      lines.push(`  - ${r}`);
    }
  }

  if (result.improvements.length > 0) {
    lines.push('\nImprovements:');
    for (const i of result.improvements) {
      lines.push(`  + ${i}`);
    }
  }

  lines.push(`\nExit code: ${result.exitCode}`);
  lines.push('');

  return lines.join('\n');
}

// =============================================================================
// COMMAND
// =============================================================================

/**
 * Register CI command
 */
export function registerCICommand(program: Command): void {
  program
    .command('ci')
    .description('run analysis in CI mode with exit codes')
    .argument('<path>', 'path to analyze')
    .option('--baseline <file>', 'baseline file for comparison (inference-map.json)')
    .option('--target-p95 <ms>', 'target p95 latency in milliseconds', parseInt)
    .option('--fail-on-regression', 'exit with code 2 on any regression')
    .option('--output <format>', 'output format: text (default) or json', 'text')
    .option('--verbose', 'show detailed output')
    .action(async (path: string, options: CIOptions) => {
      try {
        // Validate path
        if (!existsSync(path)) {
          console.error(`Error: Path not found: ${path}`);
          process.exit(2);
        }

        // Load baseline if provided
        let baseline: BaselineData | null = null;
        if (options.baseline) {
          baseline = loadBaseline(options.baseline);
          if (!baseline) {
            console.error(`Warning: Could not load baseline from ${options.baseline}`);
          }
        }

        // Define analysis result type
        interface AnalysisResult {
          inferenceMap?: { callsites: unknown[]; summary: { totalCallsites: number } };
          insights?: unknown[];
          joined?: { drift?: unknown[] };
          runtime?: { global?: { p95: number } };
        }

        // Run analysis
        const analysisResult = await new Promise<AnalysisResult | null>((resolve) => {
          const agent = new Agent({
            onComplete: (results: AnalysisResult) => {
              resolve(results);
            },
            onError: (error: Error) => {
              console.error(`Analysis error: ${error.message}`);
              resolve(null);
            },
          });

          agent.run({
            path,
            offline: false,
            noCache: true,
            verbose: options.verbose,
            noHistory: true, // Don't save CI runs to history
          });
        });

        if (!analysisResult) {
          console.error('Analysis failed to produce results');
          process.exit(2);
        }

        // Build summary
        const summary: CIResult['summary'] = {
          inferencePoints: analysisResult.inferenceMap?.summary?.totalCallsites || 0,
          driftCount: analysisResult.joined?.drift?.length,
          insightCount: analysisResult.insights?.length,
          p95Latency: analysisResult.runtime?.global?.p95,
        };

        // Determine CI status
        const ciResult = determineCIStatus(summary, baseline, options);

        // Output result
        if (options.output === 'json') {
          console.log(JSON.stringify(ciResult, null, 2));
        } else {
          console.log(formatCIResult(ciResult));
        }

        process.exit(ciResult.exitCode);
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : 'CI check failed');
        process.exit(2);
      }
    });
}
