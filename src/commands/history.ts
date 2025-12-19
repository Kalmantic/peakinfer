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
import { listRuns, loadRun, pruneHistory, getHistoryDir } from '../history.js';
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

  // Show history directory
  historyCmd
    .command('path')
    .description('show history storage location')
    .action(() => {
      console.log(`History stored at: ${getHistoryDir()}`);
    });
}
