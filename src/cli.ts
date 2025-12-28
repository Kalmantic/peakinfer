#!/usr/bin/env node
import 'dotenv/config';
import { Command } from 'commander';
import { existsSync, writeFileSync } from 'fs';
import { exec } from 'child_process';
import * as readline from 'readline';
import { Agent } from './agent.js';
import { createRenderer, renderCostEstimate, renderMaxCostExceeded } from './renderer.js';
import { estimateAnalysisCost, exceedsMaxCost } from './cost-estimator.js';
import { VERSION } from './version.js';

// v1.6 Command imports
import { registerTemplateCommands } from './commands/template.js';
import { registerConfigCommands } from './commands/config.js';
import { registerHistoryCommands } from './commands/history.js';
import { registerCICommand } from './commands/ci.js';
import { registerExportCommand } from './commands/export.js';
import { registerWhatIfCommand } from './commands/whatif.js';

// v2.0 Demo command (works offline, no API key needed)
import { registerDemoCommand } from './commands/demo.js';

// v1.9.3 Validate-map command (InferenceMap schema validation)
import { registerValidateMapCommand } from './commands/validate-map.js';

// v1.8 Analytics (respects DO_NOT_TRACK)
import { initAnalytics, track, flush } from './analytics.js';

// Initialize analytics at startup
initAnalytics();

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
  .option('--events-url <url>', 'URL to fetch runtime events')
  .option('--html', 'generate html report')
  .option('--pdf', 'generate pdf report')
  .option('--open', 'open report in browser/viewer')
  .option('--output <format>', 'output format: text (default), json, or inference-map')
  .option('--out <file>', 'write output to file')
  .option('--cached', 'view previous analysis (offline, no API key needed)')
  .option('--verbose', 'show detailed task progress')
  // Format detection options (PRD §6.4)
  .option('--format <type>', 'specify runtime format: jsonl, json, csv, otel, jaeger, zipkin, langsmith, litellm')
  .option('--map <mappings...>', 'field mappings: --map latency_ms=duration model=model_name')
  .option('--events-map <mappings...>', 'alias for --map (field mappings for non-standard event formats)')
  .option('--lenient', 'accept low-confidence field mappings')
  .option('--strict', 'fail on missing required fields or unknown formats')
  .option('--redact', 'redact code snippets from artifacts')
  // Fix suggestions (v1.8)
  .option('--fixes', 'show code fix suggestions for issues')
  // Runtime connectors (v1.9.5)
  .option('--runtime <source>', 'runtime data source: helicone, langsmith')
  .option('--runtime-key <key>', 'API key for runtime source (or use env var)')
  .option('--runtime-days <days>', 'days of runtime data to fetch', '7')
  // Benchmark comparison (v1.9.5)
  .option('--benchmark', 'compare to InferenceMAX benchmarks')
  // Cost estimation options (v1.9.3)
  .option('--estimate', 'show cost estimate before analysis')
  .option('--yes', 'auto-proceed without confirmation (use with --estimate)')
  .option('--max-cost <dollars>', 'skip analysis if estimated cost exceeds threshold')
  // History options (v1.5)
  .option('--no-history', 'skip saving run to history (disables comparison/prediction)')
  .option('--compare [runId]', 'compare with previous run (default: latest)')
  .option('--predict', 'generate deploy-time latency predictions')
  .option('--target-p95 <ms>', 'target p95 latency for budget calculation (use with --predict)')
  .action(async (path: string, options: {
    events?: string;
    eventsUrl?: string; // --events-url
    html?: boolean;
    pdf?: boolean;
    open?: boolean;
    output?: string;
    out?: string; // --out
    cached?: boolean;
    verbose?: boolean;
    // Format detection options
    format?: string;
    map?: string[];
    eventsMap?: string[]; // --events-map alias for --map
    lenient?: boolean;
    strict?: boolean;
    redact?: boolean;
    // Fix suggestions (v1.8)
    fixes?: boolean;
    // Runtime connectors (v1.9.5)
    runtime?: string;
    runtimeKey?: string;
    runtimeDays?: string;
    // Benchmark comparison (v1.9.5)
    benchmark?: boolean;
    // Cost estimation options (v1.9.3)
    estimate?: boolean;
    yes?: boolean;
    maxCost?: string;
    // History options (v1.5)
    history?: boolean; // Commander negates --no-history to history: false
    compare?: string | boolean; // --compare or --compare <runId>
    predict?: boolean; // --predict flag
    targetP95?: string; // --target-p95 <ms>
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

      // Cost estimation (v1.9.3) - PRD Section 2.3
      // Handle --estimate and --max-cost before running analysis
      const maxCost = options.maxCost ? parseFloat(options.maxCost) : undefined;

      if (options.estimate || maxCost !== undefined) {
        try {
          const estimate = await estimateAnalysisCost(path);

          // Check --max-cost threshold first
          if (maxCost !== undefined && exceedsMaxCost(estimate, maxCost)) {
            renderMaxCostExceeded(estimate, maxCost);
            process.exit(0); // Exit gracefully, not an error
          }

          // Show estimate if --estimate flag is used
          if (options.estimate) {
            renderCostEstimate(estimate);

            // If --yes flag, auto-proceed
            if (!options.yes) {
              // Prompt user for confirmation
              const proceed = await promptUserConfirmation('Proceed? [y/N] ');
              if (!proceed) {
                console.log('Analysis cancelled.');
                process.exit(0);
              }
            }
          }
        } catch (error) {
          // If estimation fails, warn but continue (don't block analysis)
          if (options.verbose) {
            console.warn(`Warning: Cost estimation failed: ${error instanceof Error ? error.message : 'unknown error'}`);
          }
        }
      }

      const renderer = createRenderer({ verbose: options.verbose, showFixes: options.fixes });
      renderer.renderHeader();

      // Track analysis start (v1.8)
      track('analysis_started', {
        has_events: !!options.events,
        has_runtime: !!options.runtime,
        runtime_source: options.runtime,
        has_benchmark: !!options.benchmark,
        html: options.html,
        pdf: options.pdf,
        predict: options.predict,
        compare: options.compare !== undefined,
      });

      const agent = new Agent({
        onResumed: (runId) => renderer.renderResumed(runId),
        onPlanReady: (plan) => renderer.renderPlan(plan),
        onTaskStart: (task) => renderer.renderTaskStart(task),
        onTaskComplete: (task, result) => renderer.renderTaskComplete(task, result),
        onProgress: (data) => renderer.renderProgress(data),
        onPartial: (warnings) => renderer.renderPartial(warnings),
        onComplete: (results) => {
          // Handle --output inference-map: output only InferenceMap JSON
          if (options.output === 'inference-map') {
            if (!results.inferenceMap) {
              console.error('No InferenceMap data available');
              process.exit(1);
            }
            const output = JSON.stringify(results.inferenceMap, null, 2);
            if (options.out) {
              writeFileSync(options.out, output);
              console.error(`InferenceMap written to ${options.out}`);
            } else {
              console.log(output);
            }
          } else if (options.output === 'json') {
            // Handle --output json: output full results as JSON
            const output = JSON.stringify({
              inferenceMap: results.inferenceMap,
              insights: results.insights,
              runtime: results.runtimeSummary,
              joined: results.joined,
            }, null, 2);
            if (options.out) {
              writeFileSync(options.out, output);
              console.error(`Results written to ${options.out}`);
            } else {
              console.log(output);
            }
          } else {
            // Default: render text output
            renderer.renderResults(results);
          }

          // Benchmark comparison (v1.9.5)
          if (options.benchmark && results.inferenceMap?.inference_points) {
            import('./benchmarks/index.js').then(({ compareToBenchmark, formatBenchmarkComparison }) => {
              console.log('\n' + '─'.repeat(60));
              console.log('\nBENCHMARK COMPARISON (InferenceMAX)');
              console.log('');

              let hasComparisons = false;
              for (const point of results.inferenceMap.inference_points) {
                if (point.model && point.latency_profile?.p95_ms) {
                  const comparison = compareToBenchmark(
                    point.id,
                    point.model,
                    {
                      p95_latency_ms: point.latency_profile.p95_ms,
                      ttft_ms: point.latency_profile.ttft_ms,
                    }
                  );
                  if (comparison) {
                    hasComparisons = true;
                    console.log(`[${point.file}:${point.line}]`);
                    console.log(formatBenchmarkComparison(comparison));
                    console.log('');
                  }
                }
              }

              if (!hasComparisons) {
                console.log('No benchmark data available for the detected models.');
                console.log('Tip: Benchmarks are available for GPT-4o, Claude 3.5, Gemini, Llama, Mistral, etc.');
              }
            }).catch(() => {
              console.error('Warning: Could not load benchmark data');
            });
          }

          // Track analysis completion (v1.8)
          track('analysis_completed', {
            inference_points: results.inferenceMap?.summary?.totalCallsites || 0,
            insights_count: results.insights?.length || 0,
            has_runtime: !!results.events,
            providers: results.inferenceMap?.summary?.providers || [],
          });

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

      // Parse field mappings from --map or --events-map option
      // (--events-map is an alias for --map, consistent with GitHub Action input naming)
      const fieldHints: Record<string, string> = {};
      // Merge if both are provided (--map takes precedence for conflicts)
      if (options.eventsMap) {
        for (const mapping of options.eventsMap) {
          const [target, source] = mapping.split('=');
          if (target && source) {
            fieldHints[target.trim()] = source.trim();
          }
        }
      }
      if (options.map) {
        for (const mapping of options.map) {
          const [target, source] = mapping.split('=');
          if (target && source) {
            fieldHints[target.trim()] = source.trim();
          }
        }
      }

      // Runtime connector integration (v1.9.5)
      // If --runtime is provided, fetch events from the API
      let runtimeEventsFile = options.events;
      let runtimeResult: { events: unknown[]; summary: unknown } | undefined;

      if (options.runtime) {
        const { fetchRuntimeData, getApiKeyFromEnv, isValidSource } = await import('./connectors/index.js');

        if (!isValidSource(options.runtime)) {
          console.error(`Error: Unknown runtime source: ${options.runtime}. Supported: helicone, langsmith`);
          process.exit(1);
        }

        const apiKey = options.runtimeKey || getApiKeyFromEnv(options.runtime);
        if (!apiKey) {
          const envVarName = options.runtime === 'helicone' ? 'HELICONE_API_KEY' : 'LANGSMITH_API_KEY';
          console.error(`Error: API key required for --runtime ${options.runtime}`);
          console.error(`Provide via --runtime-key or set ${envVarName} environment variable`);
          process.exit(1);
        }

        try {
          const days = parseInt(options.runtimeDays || '7', 10);
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - days);

          if (options.verbose) {
            console.log(`Fetching runtime data from ${options.runtime} (last ${days} days)...`);
          }

          runtimeResult = await fetchRuntimeData({
            source: options.runtime,
            apiKey,
            startDate: startDate.toISOString(),
            limit: 1000,
          });

          if (options.verbose) {
            console.log(`Fetched ${runtimeResult.events.length} events from ${options.runtime}`);
          }

          // Write events to a temp file for the agent
          const { tmpdir } = await import('os');
          const { join } = await import('path');
          const tempFile = join(tmpdir(), `peakinfer-runtime-${Date.now()}.jsonl`);
          const eventsJsonl = (runtimeResult.events as unknown[]).map(e => JSON.stringify(e)).join('\n');
          writeFileSync(tempFile, eventsJsonl);
          runtimeEventsFile = tempFile;
        } catch (error) {
          console.error(`Error fetching from ${options.runtime}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          process.exit(1);
        }
      }

      await agent.run({
        path,
        events: runtimeEventsFile,
        eventsUrl: options.eventsUrl, // --events-url
        html: options.html || options.pdf || options.open, // Generate HTML if PDF or open requested
        pdf: options.pdf,
        open: options.open,
        out: options.out, // --out
        offline: false,
        noCache: !options.cached, // --cached means use cache
        verbose: options.verbose,
        // Format detection options
        formatHint: options.format,
        fieldHints: Object.keys(fieldHints).length > 0 ? fieldHints : undefined,
        lenient: options.lenient,
        strict: options.strict,
        redact: options.redact,
        // History options (v1.5)
        noHistory: options.history === false, // --no-history sets history to false
        compare: options.compare !== undefined, // --compare flag was used
        compareRunId: typeof options.compare === 'string' ? options.compare : undefined, // specific run ID
        predict: options.predict, // --predict flag
        targetP95: options.targetP95 ? parseInt(options.targetP95, 10) : undefined, // --target-p95 <ms>
      });

      // Flush analytics before exit (v1.8)
      await flush();
    } catch (error) {
      // Track error and flush analytics (v1.8)
      track('analysis_error', {
        error_type: error instanceof Error ? error.constructor.name : 'unknown',
      });
      await flush();

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

// =============================================================================
// REGISTER v1.6 COMMANDS
// =============================================================================

registerTemplateCommands(program);
registerConfigCommands(program);
registerHistoryCommands(program);
registerCICommand(program);
registerExportCommand(program);
registerWhatIfCommand(program);

// =============================================================================
// REGISTER v2.0 COMMANDS
// =============================================================================

registerDemoCommand(program);

// =============================================================================
// REGISTER v1.9.3 COMMANDS
// =============================================================================

registerValidateMapCommand(program);

// Custom help text (PRD-aligned, Julie Zhou style)
program.addHelpText('after', `
quick start:
  peakinfer demo                       # see it in action (no API key needed)
  peakinfer analyze .                  # analyze your codebase

analyze modes:
  peakinfer analyze .                  # static: scan codebase for LLM calls
  peakinfer analyze events.jsonl       # runtime: analyze inference telemetry
  peakinfer analyze . --events prod.jsonl  # combined: static + runtime
  peakinfer analyze . --events-url https://api.example.com/events  # fetch events from URL
  peakinfer analyze . --out results.json   # write output to file
  peakinfer analyze . --output inference-map  # output only InferenceMap v0.1 JSON

runtime connectors (v1.9.5):
  peakinfer analyze . --runtime helicone              # fetch from Helicone
  peakinfer analyze . --runtime langsmith             # fetch from LangSmith
  peakinfer analyze . --runtime helicone --runtime-days 30  # last 30 days

benchmarks (v1.9.5):
  peakinfer analyze . --benchmark      # compare to InferenceMAX benchmarks

cost estimation:
  peakinfer analyze . --estimate       # show cost estimate before analysis
  peakinfer analyze . --estimate --yes # estimate + auto-proceed (for CI)
  peakinfer analyze . --max-cost 10    # skip if estimated cost > $10

more commands:
  peakinfer template list              # browse optimization templates
  peakinfer config show                # view configuration
  peakinfer history                    # view analysis history
  peakinfer history compare <id1> [id2] # compare two analysis runs
  peakinfer export                     # export results (json, prometheus)
  peakinfer whatif --model gpt-4o-mini # counterfactual analysis
  peakinfer ci ./src --baseline base.json  # CI/CD integration
  peakinfer validate-map ./map.json    # validate InferenceMap schema
`);

// Parse and run
program.parse();

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Prompt user for Y/N confirmation.
 * Returns true if user enters 'y' or 'Y', false otherwise.
 */
function promptUserConfirmation(prompt: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y');
    });
  });
}

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
