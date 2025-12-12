#!/usr/bin/env node
import { Command } from 'commander';
import { existsSync } from 'fs';
import { exec } from 'child_process';
import { Agent } from './agent.js';
import { createRenderer } from './renderer.js';

// =============================================================================
// CONSTANTS
// =============================================================================

const VERSION = '1.0.0';
const DESCRIPTION = 'LLM inference performance analysis - reveal the truth about your AI calls';

// =============================================================================
// MAIN
// =============================================================================

const program = new Command()
  .name('peakinfer')
  .description(DESCRIPTION)
  .version(VERSION);

// Default command: analyze
program
  .argument('[path]', 'path to repository or events file', '.')
  .option('-e, --events <file>', 'runtime events file (JSONL/CSV)')
  .option('--html', 'generate HTML report')
  .option('--open', 'open HTML report in browser')
  .option('--offline', 'use bundled templates only')
  .option('-v, --verbose', 'show detailed progress')
  .action(async (path: string, options: {
    events?: string;
    html?: boolean;
    open?: boolean;
    offline?: boolean;
    verbose?: boolean;
  }) => {
    try {
      // Validate path exists
      if (!existsSync(path)) {
        console.error(`Error: Path not found: ${path}`);
        process.exit(1);
      }

      // Validate events file if provided
      if (options.events && !existsSync(options.events)) {
        console.error(`Error: Events file not found: ${options.events}`);
        process.exit(1);
      }

      const renderer = createRenderer({ verbose: options.verbose });
      renderer.renderHeader();

      const agent = new Agent({
        onPlanReady: (plan) => renderer.renderPlan(plan),
        onTaskStart: (task) => renderer.renderTaskStart(task),
        onTaskComplete: (task, result) => renderer.renderTaskComplete(task, result),
        onComplete: (results) => {
          renderer.renderResults(results);

          // Open HTML report if requested
          if (options.open && results.htmlPath) {
            openInBrowser(results.htmlPath);
          }
        },
        onError: (error) => renderer.renderError(error),
      });

      await agent.run({
        path,
        events: options.events,
        html: options.html,
        open: options.open,
        offline: options.offline,
        verbose: options.verbose,
      });
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Error: ${error.message}`);
        if (options.verbose && error.stack) {
          console.error(error.stack);
        }
      } else {
        console.error('An unexpected error occurred');
      }
      process.exit(1);
    }
  });

// Tradeoff command: compare configurations
program
  .command('tradeoff')
  .description('Compare inference configurations (cost vs latency vs throughput)')
  .argument('<baseline>', 'baseline events file')
  .argument('<variant>', 'variant events file')
  .option('--html', 'generate HTML comparison report')
  .action(async (baseline: string, variant: string, options: { html?: boolean }) => {
    // Validate files exist
    if (!existsSync(baseline)) {
      console.error(`Error: Baseline file not found: ${baseline}`);
      process.exit(1);
    }
    if (!existsSync(variant)) {
      console.error(`Error: Variant file not found: ${variant}`);
      process.exit(1);
    }

    console.log('PeakInfer v1.0');
    console.log('');
    console.log('Tradeoff Analysis');
    console.log('');

    // TODO: Implement tradeoff comparison
    // This will be a v1.1 feature
    console.log('  Comparing configurations...');
    console.log(`    Baseline: ${baseline}`);
    console.log(`    Variant:  ${variant}`);
    console.log('');
    console.log('  [Coming in v1.1]');
    console.log('');
  });

// Parse and run
program.parse();

// =============================================================================
// HELPERS
// =============================================================================

function openInBrowser(filePath: string): void {
  const platform = process.platform;
  let command: string;

  if (platform === 'darwin') {
    command = `open "${filePath}"`;
  } else if (platform === 'win32') {
    command = `start "" "${filePath}"`;
  } else {
    command = `xdg-open "${filePath}"`;
  }

  exec(command, (error) => {
    if (error) {
      console.error(`Could not open browser: ${error.message}`);
    }
  });
}
