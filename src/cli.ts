#!/usr/bin/env node
import 'dotenv/config';
import { Command } from 'commander';
import { existsSync } from 'fs';
import { exec } from 'child_process';
import { Agent } from './agent.js';
import { createRenderer } from './renderer.js';
import { VERSION } from './version.js';

// =============================================================================
// CONSTANTS
// =============================================================================

const DESCRIPTION = 'llm inference performance optimization';

// =============================================================================
// MAIN
// =============================================================================

const program = new Command()
  .name('peakinfer')
  .description(DESCRIPTION)
  .version(VERSION);

// Analyze command: peakinfer analyze <path>
program
  .command('analyze')
  .description('analyze codebase or runtime events')
  .argument('[path]', 'path to repository or events file', '.')
  .option('--events <file>', 'add runtime telemetry to static analysis')
  .option('--html', 'generate html report')
  .option('--pdf', 'generate pdf report')
  .option('--open', 'open report in browser/viewer')
  .option('--output <format>', 'output format: text (default) or json')
  .option('--cached', 'view previous analysis (offline, no API key needed)')
  .option('--verbose', 'show detailed task progress')
  .action(async (path: string, options: {
    events?: string;
    html?: boolean;
    pdf?: boolean;
    open?: boolean;
    output?: string;
    cached?: boolean;
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
        onResumed: (runId) => renderer.renderResumed(runId),
        onPlanReady: (plan) => renderer.renderPlan(plan),
        onTaskStart: (task) => renderer.renderTaskStart(task),
        onTaskComplete: (task, result) => renderer.renderTaskComplete(task, result),
        onProgress: (data) => renderer.renderProgress(data),
        onPartial: (warnings) => renderer.renderPartial(warnings),
        onComplete: (results) => {
          renderer.renderResults(results);

          // Open report if requested (prefer PDF if generated, else HTML)
          if (options.open) {
            if (results.pdfPath) {
              openInBrowser(results.pdfPath);
            } else if (results.htmlPath) {
              openInBrowser(results.htmlPath);
            }
          }
        },
        onError: (error) => renderer.renderError(error),
      });

      await agent.run({
        path,
        events: options.events,
        html: options.html || options.pdf || options.open, // Generate HTML if PDF or open requested
        pdf: options.pdf,
        open: options.open,
        offline: false,
        noCache: !options.cached, // --cached means use cache
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

// Custom help text (PRD-aligned, Julie Zhou style)
program.addHelpText('after', `
analyze modes:
  peakinfer analyze .                  # static: scan codebase for LLM calls
  peakinfer analyze events.jsonl       # runtime: analyze inference telemetry
  peakinfer analyze . --events prod.jsonl  # combined: static + runtime

quick start:
  peakinfer analyze .
`);

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
