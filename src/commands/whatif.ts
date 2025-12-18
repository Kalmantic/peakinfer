/**
 * What-If Command (v1.6 - GAP 5)
 *
 * CLI command for counterfactual analysis:
 * - Model swap: What if we used a different model?
 * - Streaming: What if we enabled/disabled streaming?
 * - Batching: What if we batched requests?
 * - Provider: What if we used a different provider?
 *
 * Leverages existing src/counterfactuals.ts module.
 */

import { Command } from 'commander';
import { existsSync, readFileSync } from 'fs';
import { listRuns, loadRun } from '../history.js';
import {
  generateCounterfactuals,
  rankCounterfactuals,
  formatCounterfactualSummary,
} from '../counterfactuals.js';
import type {
  InferenceMap,
  Counterfactual,
  CounterfactualResult,
} from '../types.js';

// =============================================================================
// TYPES
// =============================================================================

interface WhatIfOptions {
  model?: string;
  provider?: string;
  streaming?: string;
  batchSize?: string;
  run?: string;
  priority?: 'latency' | 'cost' | 'balanced';
  output?: string;
  limit?: number;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Load inference map from history or file
 */
function loadInferenceMap(runId?: string): InferenceMap | null {
  if (runId) {
    // Check if it's a file path
    if (existsSync(runId) && runId.endsWith('.json')) {
      try {
        const content = readFileSync(runId, 'utf-8');
        return JSON.parse(content);
      } catch {
        return null;
      }
    }

    // Load from history
    const run = loadRun(runId);
    return run?.data?.inferenceMap || null;
  }

  // Load latest run
  const runs = listRuns();
  if (runs.length === 0) {
    return null;
  }

  const latestRun = loadRun(runs[0].runId);
  return latestRun?.data?.inferenceMap || null;
}

/**
 * Filter counterfactuals by type/criteria
 */
function filterCounterfactuals(
  result: CounterfactualResult,
  options: WhatIfOptions
): Counterfactual[] {
  let filtered = result.counterfactuals;

  // Filter by type based on options
  if (options.model) {
    filtered = filtered.filter(c =>
      c.type === 'model_swap' &&
      c.proposedState.model?.toLowerCase().includes(options.model!.toLowerCase())
    );
  }

  if (options.provider) {
    filtered = filtered.filter(c =>
      c.proposedState.provider?.toLowerCase().includes(options.provider!.toLowerCase())
    );
  }

  if (options.streaming !== undefined) {
    filtered = filtered.filter(c => c.type === 'streaming_enable');
  }

  if (options.batchSize) {
    filtered = filtered.filter(c => c.type === 'batch_optimization');
  }

  return filtered;
}

/**
 * Format counterfactual for display
 */
function formatCounterfactual(cf: Counterfactual, index: number): string {
  const lines: string[] = [];

  // Header with number and headline
  lines.push(`\n${index + 1}. ${cf.headline}`);
  lines.push('─'.repeat(50));

  // Type badge
  const typeBadges: Record<string, string> = {
    model_swap: 'Model Swap',
    batch_optimization: 'Batching',
    cache_addition: 'Caching',
    streaming_enable: 'Streaming',
    provider_change: 'Provider',
  };
  lines.push(`   Type: ${typeBadges[cf.type] || cf.type}`);

  // Current vs Proposed
  lines.push('');
  lines.push('   Current → Proposed:');
  if (cf.currentState.model) {
    lines.push(`     Model:    ${cf.currentState.model} → ${cf.proposedState.model || 'same'}`);
  }
  if (cf.currentState.provider || cf.proposedState.provider) {
    lines.push(`     Provider: ${cf.currentState.provider || '-'} → ${cf.proposedState.provider || 'same'}`);
  }
  if (cf.currentState.pattern || cf.proposedState.pattern) {
    lines.push(`     Pattern:  ${cf.currentState.pattern || '-'} → ${cf.proposedState.pattern || 'same'}`);
  }

  // Impact
  lines.push('');
  lines.push('   Impact:');
  if (cf.impact.latencyDeltaPercent !== 0) {
    const sign = cf.impact.latencyDeltaPercent < 0 ? '' : '+';
    lines.push(`     Latency: ${sign}${cf.impact.latencyDeltaPercent}% (${sign}${cf.impact.latencyDelta}ms)`);
  }
  if (cf.impact.costDeltaPercent !== 0) {
    const sign = cf.impact.costDeltaPercent < 0 ? '' : '+';
    lines.push(`     Cost:    ${sign}${cf.impact.costDeltaPercent}%`);
  }

  // Effort and confidence
  lines.push(`     Effort: ${cf.effort}   Confidence: ${cf.confidence}`);

  // Tradeoffs
  if (cf.impact.tradeoffs.length > 0) {
    lines.push('');
    lines.push('   Tradeoffs:');
    for (const tradeoff of cf.impact.tradeoffs.slice(0, 3)) {
      lines.push(`     • ${tradeoff}`);
    }
  }

  // Affected points
  if (cf.affectedPoints.length > 0) {
    lines.push(`\n   Affects ${cf.affectedPoints.length} inference point${cf.affectedPoints.length !== 1 ? 's' : ''}`);
  }

  return lines.join('\n');
}

/**
 * Display counterfactual results
 */
function displayResults(counterfactuals: Counterfactual[], summary: CounterfactualResult['summary']): void {
  if (counterfactuals.length === 0) {
    console.log('\nNo optimization opportunities found matching your criteria.');
    return;
  }

  console.log('\nWhat-If Analysis Results');
  console.log('═'.repeat(50));
  console.log(formatCounterfactualSummary({ counterfactuals, summary, generatedAt: new Date().toISOString() }));

  for (let i = 0; i < counterfactuals.length; i++) {
    console.log(formatCounterfactual(counterfactuals[i], i));
  }

  console.log('');
}

// =============================================================================
// COMMAND
// =============================================================================

/**
 * Register what-if command
 */
export function registerWhatIfCommand(program: Command): void {
  program
    .command('whatif')
    .description('run counterfactual analysis ("what if" scenarios)')
    .option('--model <model>', 'what if we used this model?')
    .option('--provider <provider>', 'what if we used this provider?')
    .option('--streaming <bool>', 'what if streaming was enabled/disabled?')
    .option('--batch-size <n>', 'what if we batched requests?')
    .option('--run <runId>', 'run ID or inference-map.json path (default: latest)')
    .option('--priority <type>', 'ranking priority: latency, cost, balanced (default)', 'balanced')
    .option('--output <format>', 'output format: text (default) or json', 'text')
    .option('--limit <n>', 'limit number of results', parseInt)
    .action(async (options: WhatIfOptions) => {
      try {
        // Load inference map
        const inferenceMap = loadInferenceMap(options.run);

        if (!inferenceMap) {
          console.error('No analysis data found.');
          console.log('\nRun "peakinfer analyze ." first, or specify:');
          console.log('  --run <runId>  Run ID from history');
          console.log('  --run <file>   Path to inference-map.json');
          process.exit(1);
        }

        if (inferenceMap.callsites.length === 0) {
          console.error('No inference points found in analysis.');
          process.exit(1);
        }

        // Generate counterfactuals
        const result = generateCounterfactuals(inferenceMap);

        // Filter based on options
        let counterfactuals = filterCounterfactuals(result, options);

        // Rank by priority
        if (options.priority && ['latency', 'cost', 'balanced'].includes(options.priority)) {
          counterfactuals = rankCounterfactuals(
            { ...result, counterfactuals },
            options.priority as 'latency' | 'cost' | 'balanced'
          );
        }

        // Apply limit
        if (options.limit && options.limit > 0) {
          counterfactuals = counterfactuals.slice(0, options.limit);
        }

        // Output
        if (options.output === 'json') {
          console.log(JSON.stringify({
            counterfactuals,
            summary: result.summary,
            generatedAt: new Date().toISOString(),
          }, null, 2));
        } else {
          displayResults(counterfactuals, result.summary);

          // Show hints for more specific queries
          if (!options.model && !options.provider && !options.streaming && !options.batchSize) {
            console.log('Tip: Use --model, --provider, --streaming, or --batch-size to filter results.');
            console.log('Example: peakinfer whatif --model gpt-4o-mini --priority cost');
          }
        }
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : 'What-if analysis failed');
        process.exit(1);
      }
    });
}
