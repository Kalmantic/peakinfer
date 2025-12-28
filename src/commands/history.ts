/**
 * History Commands (v1.6)
 *
 * CLI commands for viewing and managing analysis history:
 * - list: List past analysis runs
 * - show: Show details of a specific run
 * - export: Export history to JSON
 * - prune: Remove old runs
 */

import { Command } from 'commander';
import { writeFileSync } from 'fs';
import { listRuns, loadRun, pruneHistory, getHistoryDir, deleteRun, clearAllHistory } from '../history.js';
import { compareSnapshots, formatComparisonSummary, hasSignificantChanges, type AnalysisSnapshot } from '../comparison.js';
import type { HistoryManifest } from '../types.js';

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Format timestamp for display
 */
function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString();
}

/**
 * Format relative time
 */
function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

/**
 * Format analysis type with indicator
 */
function formatAnalysisType(type: string): string {
  return type;
}

/**
 * Display history list
 */
function displayHistoryList(runs: HistoryManifest[]): void {
  if (runs.length === 0) {
    console.log('\nNo analysis history found.');
    console.log('Run "peakinfer analyze ." to create your first analysis.\n');
    return;
  }

  console.log(`\n${runs.length} analysis run${runs.length !== 1 ? 's' : ''} in history:\n`);

  // Table header
  console.log('  Run ID              Type      Points  When          Duration');
  console.log('  ─'.repeat(35));

  for (const run of runs) {
    const type = formatAnalysisType(run.analysisType).padEnd(10);
    const points = String(run.inferencePointCount).padStart(6);
    const when = formatRelativeTime(run.timestamp).padEnd(12);
    const duration = run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : '-';

    console.log(`  ${run.runId.slice(0, 18).padEnd(20)} ${type} ${points}  ${when}  ${duration}`);
  }

  console.log('');
  console.log('Use "peakinfer history show <runId>" for details.');
  console.log('');
}

/**
 * Display run details
 */
function displayRunDetails(runId: string, manifest: HistoryManifest): void {
  console.log(`\nAnalysis Run: ${runId}`);
  console.log('═'.repeat(60));

  console.log(`  Timestamp:    ${formatTimestamp(manifest.timestamp)}`);
  console.log(`  Path:         ${manifest.path}`);
  console.log(`  Type:         ${formatAnalysisType(manifest.analysisType)}`);
  console.log(`  Version:      ${manifest.version}`);
  console.log('');

  console.log('Metrics:');
  console.log(`  Inference Points: ${manifest.inferencePointCount}`);
  if (manifest.eventCount !== undefined) {
    console.log(`  Runtime Events:   ${manifest.eventCount}`);
  }
  if (manifest.driftCount !== undefined) {
    console.log(`  Drift Signals:    ${manifest.driftCount}`);
  }
  if (manifest.insightCount !== undefined) {
    console.log(`  Insights:         ${manifest.insightCount}`);
  }
  if (manifest.durationMs !== undefined) {
    console.log(`  Duration:         ${(manifest.durationMs / 1000).toFixed(2)}s`);
  }

  if (manifest.artifacts) {
    console.log('');
    console.log('Artifacts:');
    if (manifest.artifacts.inferenceMap) {
      console.log(`  Inference Map: ${manifest.artifacts.inferenceMap}`);
    }
    if (manifest.artifacts.html) {
      console.log(`  HTML Report:   ${manifest.artifacts.html}`);
    }
    if (manifest.artifacts.pdf) {
      console.log(`  PDF Report:    ${manifest.artifacts.pdf}`);
    }
  }

  console.log('');
}

// =============================================================================
// COMMANDS
// =============================================================================

/**
 * Register history commands
 */
export function registerHistoryCommands(program: Command): void {
  const historyCmd = program
    .command('history')
    .description('view and manage analysis history');

  // List runs (default action)
  historyCmd
    .command('list', { isDefault: true })
    .description('list past analysis runs')
    .option('--path <path>', 'filter by analyzed path')
    .option('--limit <n>', 'limit number of results', parseInt)
    .action((options: { path?: string; limit?: number }) => {
      try {
        let runs = listRuns(options.path);

        if (options.limit && options.limit > 0) {
          runs = runs.slice(0, options.limit);
        }

        displayHistoryList(runs);
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : 'Failed to load history');
        process.exit(1);
      }
    });

  // Show run details
  historyCmd
    .command('show')
    .description('show details of a specific run')
    .argument('<runId>', 'run ID to show')
    .action((runId: string) => {
      try {
        const run = loadRun(runId);

        if (!run) {
          console.error(`Run not found: ${runId}`);
          process.exit(1);
        }

        displayRunDetails(runId, run.manifest);

        // Show summary of data if available
        if (run.data.inferenceMap) {
          console.log('Inference Map Summary:');
          console.log(`  Total Points:  ${run.data.inferenceMap.callsites.length}`);
          console.log(`  Providers:     ${run.data.inferenceMap.summary.providers.join(', ') || 'none detected'}`);
          console.log(`  Models:        ${run.data.inferenceMap.summary.models.join(', ') || 'none detected'}`);
          console.log('');
        }
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : 'Failed to load run');
        process.exit(1);
      }
    });

  // Compare two runs
  historyCmd
    .command('compare')
    .description('compare two analysis runs')
    .argument('<runId1>', 'first run ID (baseline)')
    .argument('[runId2]', 'second run ID (defaults to latest)')
    .option('--json', 'output as JSON')
    .action((runId1: string, runId2: string | undefined, options: { json?: boolean }) => {
      try {
        // Load first run (baseline)
        const run1 = loadRun(runId1);
        if (!run1) {
          console.error(`Run not found: ${runId1}`);
          process.exit(1);
        }

        // Load second run (or latest if not specified)
        let run2;
        if (runId2) {
          run2 = loadRun(runId2);
          if (!run2) {
            console.error(`Run not found: ${runId2}`);
            process.exit(1);
          }
        } else {
          // Get the most recent run (excluding run1)
          const runs = listRuns();
          const latestRun = runs.find(r => r.runId !== runId1);
          if (!latestRun) {
            console.error('No other run found to compare with.');
            process.exit(1);
          }
          run2 = loadRun(latestRun.runId);
          if (!run2) {
            console.error('Failed to load latest run.');
            process.exit(1);
          }
        }

        // Build snapshots
        const baseline: AnalysisSnapshot = {
          runId: run1.manifest.runId,
          timestamp: run1.manifest.timestamp,
          callsites: run1.data.inferenceMap?.callsites || [],
          insights: run1.data.insights,
        };

        const current: AnalysisSnapshot = {
          runId: run2.manifest.runId,
          timestamp: run2.manifest.timestamp,
          callsites: run2.data.inferenceMap?.callsites || [],
          insights: run2.data.insights,
        };

        // Compare
        const comparison = compareSnapshots(baseline, current);

        if (options.json) {
          console.log(JSON.stringify(comparison, null, 2));
        } else {
          console.log('');
          console.log(`Baseline: ${run1.manifest.runId} (${formatTimestamp(run1.manifest.timestamp)})`);
          console.log(`Current:  ${run2.manifest.runId} (${formatTimestamp(run2.manifest.timestamp)})`);
          console.log('');
          console.log(formatComparisonSummary(comparison));

          // Show details for added/removed/changed
          if (comparison.added.length > 0 && comparison.added.length <= 5) {
            console.log('');
            console.log('Added inference points:');
            for (const cs of comparison.added) {
              console.log(`  + ${cs.file}:${cs.line} (${cs.provider || 'unknown'})`);
            }
          }

          if (comparison.removed.length > 0 && comparison.removed.length <= 5) {
            console.log('');
            console.log('Removed inference points:');
            for (const cs of comparison.removed) {
              console.log(`  - ${cs.file}:${cs.line} (${cs.provider || 'unknown'})`);
            }
          }

          if (comparison.changed.length > 0 && comparison.changed.length <= 5) {
            console.log('');
            console.log('Changed inference points:');
            for (const change of comparison.changed) {
              const fields = change.changes.map(c => c.field).join(', ');
              console.log(`  ~ ${change.point.file}:${change.point.line} (${fields})`);
            }
          }

          console.log('');
          if (hasSignificantChanges(comparison)) {
            console.log('Result: Changes detected - review recommended before deploy.');
          } else {
            console.log('Result: No significant changes.');
          }
          console.log('');
        }
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : 'Failed to compare runs');
        process.exit(1);
      }
    });

  // Export history
  historyCmd
    .command('export')
    .description('export history to JSON file')
    .option('--output <file>', 'output file path', 'peakinfer-history.json')
    .option('--path <path>', 'filter by analyzed path')
    .action((options: { output: string; path?: string }) => {
      try {
        const runs = listRuns(options.path);

        if (runs.length === 0) {
          console.log('No history to export.');
          process.exit(0);
        }

        // Load full data for each run
        const exportData = runs.map(manifest => {
          const run = loadRun(manifest.runId);
          return {
            manifest,
            data: run?.data || null,
          };
        });

        const output = {
          exportedAt: new Date().toISOString(),
          runCount: runs.length,
          runs: exportData,
        };

        writeFileSync(options.output, JSON.stringify(output, null, 2));
        console.log(`Exported ${runs.length} run${runs.length !== 1 ? 's' : ''} to ${options.output}`);
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : 'Failed to export history');
        process.exit(1);
      }
    });

  // Prune old runs
  historyCmd
    .command('prune')
    .description('remove old runs (keeps most recent per path)')
    .option('--keep <n>', 'number of runs to keep per path', parseInt, 10)
    .option('--dry-run', 'show what would be deleted without deleting')
    .action((options: { keep: number; dryRun?: boolean }) => {
      try {
        if (options.dryRun) {
          // Count what would be deleted
          const runs = listRuns();
          const byPath = new Map<string, number>();
          for (const run of runs) {
            byPath.set(run.pathHash, (byPath.get(run.pathHash) || 0) + 1);
          }

          let totalToDelete = 0;
          for (const [, count] of byPath) {
            if (count > options.keep) {
              totalToDelete += count - options.keep;
            }
          }

          console.log(`Would delete ${totalToDelete} run${totalToDelete !== 1 ? 's' : ''} (keeping ${options.keep} per path)`);
        } else {
          const deleted = pruneHistory(options.keep);
          console.log(`Pruned ${deleted} run${deleted !== 1 ? 's' : ''} from history.`);
        }
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : 'Failed to prune history');
        process.exit(1);
      }
    });

  // Delete specific run
  historyCmd
    .command('delete')
    .description('delete a specific run by ID')
    .argument('<runId>', 'run ID to delete')
    .action((runId: string) => {
      try {
        const deleted = deleteRun(runId);
        if (deleted) {
          console.log(`Deleted run: ${runId}`);
        } else {
          console.error(`Run not found: ${runId}`);
          process.exit(1);
        }
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : 'Failed to delete run');
        process.exit(1);
      }
    });

  // Clear all history
  historyCmd
    .command('clear')
    .description('delete all history')
    .option('--confirm', 'confirm deletion without prompt')
    .action((options: { confirm?: boolean }) => {
      try {
        const runs = listRuns();
        if (runs.length === 0) {
          console.log('No history to clear.');
          return;
        }

        if (!options.confirm) {
          console.log(`This will delete ${runs.length} run${runs.length !== 1 ? 's' : ''}.`);
          console.log('Use --confirm to proceed.');
          return;
        }

        const deleted = clearAllHistory();
        console.log(`Cleared ${deleted} run${deleted !== 1 ? 's' : ''} from history.`);
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : 'Failed to clear history');
        process.exit(1);
      }
    });

  // Show history directory
  historyCmd
    .command('path')
    .description('show history storage location')
    .action(() => {
      console.log(`History stored at: ${getHistoryDir()}`);
    });
}
