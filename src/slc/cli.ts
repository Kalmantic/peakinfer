#!/usr/bin/env node
/**
 * PeakInfer CLI — Main Entry Point
 *
 * Per PRD v0.95: `peakinfer analyze .`
 * Single command, magical detection, AI-first architecture.
 *
 * Design: SLC (Simple, Lovable, Complete)
 * First-use experience: Welcoming, clear, actionable.
 */

import * as path from 'path';
import * as fs from 'fs';
import { analyzeWithAgent } from './agent-analyzer.js';
import { runAgent, type AgentCallbacks, type Task } from './agent.js';
import { scan } from './scanner.js';
import {
  renderZeroState,
  renderLoadingState,
  renderErrorState,
  renderSuccessState,
  clearLoadingState,
} from './renderer.js';
import {
  renderPRDZeroState,
  renderPRDSuccessState,
  renderPRDErrorState,
  renderPRDPartialState,
  DEFAULT_SDK_CHECKS,
  type SDKCheckResult,
} from './prd-renderer.js';
import { generateHTMLReport } from './html-renderer.js';
import type { ScanResult, StackMap, PricingSummary, TechStack } from './types.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

/** Output file names */
const OUTPUT_STACKMAP = 'peakinfer-stackmap.json';
const OUTPUT_PRICING = 'peakinfer-pricing.json';
const OUTPUT_HTML = 'peakinfer-report.html';

// =============================================================================
// FIRST-USE EXPERIENCE
// =============================================================================

/**
 * Render welcome message for first-time setup.
 * Clean, minimal, actionable.
 */
function renderSetupGuide(): void {
  console.log(`
  peakinfer

  analyzes your codebase for LLM API calls,
  profiles performance, and suggests optimizations.

  setup:

  1. get your key
     https://console.anthropic.com/settings/keys

  2. set it
     export ANTHROPIC_API_KEY=sk-ant-api03-xxxxx

  3. run
     peakinfer analyze .

  tip: add export to ~/.zshrc or ~/.bashrc to persist

  help: https://github.com/kalmantic/peakinfer
`);
}

/**
 * Check if API key is configured, show setup guide if not.
 * Returns true if ready to proceed, false otherwise.
 */
function checkApiKey(): boolean {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    renderSetupGuide();
    return false;
  }

  // Basic validation: should start with sk-ant
  if (!apiKey.startsWith('sk-ant')) {
    console.log(`
  invalid api key format

  ANTHROPIC_API_KEY should start with "sk-ant-api03-"
  current: ${apiKey.substring(0, 10)}...

  get a valid key: https://console.anthropic.com/settings/keys
`);
    return false;
  }

  return true;
}

// =============================================================================
// MAIN ANALYZE FUNCTION
// =============================================================================

/** Options for analyze command */
interface AnalyzeOptions {
  html?: boolean;
  open?: boolean;
  output?: 'json' | 'text';  // Output format: json for machine-readable, text for human-readable
  cached?: boolean;  // View cached results without API call (offline mode)
  events?: string;   // Path to runtime telemetry file (JSONL/JSON/CSV)
  mode?: 'static' | 'runtime';  // Explicit analysis mode override
  verbose?: boolean;  // Show detailed task progress (agent architecture)
}

/**
 * Analyze with agent architecture (verbose mode).
 * Shows detailed task progress using callbacks.
 */
async function analyzeWithAgentArchitecture(root: string, options: AnalyzeOptions): Promise<void> {
  const callbacks: AgentCallbacks = {
    onStart: (queryId, targetPath) => {
      console.log(`\nStarting analysis [${queryId}]`);
      console.log(`Target: ${targetPath}\n`);
    },
    onPlanCreated: (plan) => {
      console.log('Execution Plan:');
      plan.tasks.forEach((t, i) => console.log(`  ${i + 1}. ${t.description}`));
      console.log('');
    },
    onTaskStart: (task) => {
      process.stdout.write(`  → ${task.description}...`);
    },
    onTaskProgress: (task, msg) => {
      if (process.stdout.isTTY) {
        process.stdout.write(`\r  → ${task.description}... ${msg.slice(0, 40)}`);
      }
    },
    onTaskComplete: (task) => {
      const duration = task.durationMs ? ` (${(task.durationMs / 1000).toFixed(1)}s)` : '';
      console.log(`\r  ✓ ${task.description}${duration}`);
    },
    onComplete: (queryId, success, durationMs) => {
      console.log(`\nAnalysis ${success ? 'completed' : 'failed'} in ${(durationMs / 1000).toFixed(1)}s`);
    },
    onError: (error, phase) => {
      console.error(`\n  ✗ Error in ${phase}: ${error.message}`);
    },
  };

  try {
    const result = await runAgent(root, callbacks);

    // Generate output files
    const outputFiles = writeOutputFiles(root, result.stackMap, result.pricing, options.html);

    if (options.html) {
      const htmlPath = writeHTMLReport(root, result.scan, result.stackMap, result.pricing, result.techStack);
      if (htmlPath) outputFiles.push(htmlPath);

      if (options.open) {
        const { exec } = await import('child_process');
        exec(`open "${htmlPath}"`, () => {});
      }
    }

    // Output results - verbose mode shows minimal summary
    if (options.output === 'json') {
      console.log(JSON.stringify({
        success: true,
        queryId: result.queryId,
        callsites: result.callsites.length,
        stackMap: result.stackMap,
        pricing: result.pricing,
        durationMs: result.durationMs,
      }, null, 2));
    } else {
      // Minimal summary for verbose mode (agent architecture)
      console.log(`\nScanned: ${result.scan.totalFiles} files (${result.scan.totalLines.toLocaleString()} LOC)`);
      console.log(`Found: ${result.callsites.length} LLM callsites`);
      if (result.callsites.length > 0) {
        console.log(`\nCallsites:`);
        result.callsites.slice(0, 10).forEach(cs => {
          console.log(`  ${cs.file}:${cs.line} → ${cs.provider || 'unknown'}/${cs.model || 'unknown'}`);
        });
        if (result.callsites.length > 10) {
          console.log(`  ... and ${result.callsites.length - 10} more`);
        }
      }
      console.log(`\nOutput saved to: peakinfer-stackmap.json, peakinfer-pricing.json`);
    }
  } catch (error) {
    renderErrorState({
      code: 'ANALYSIS_ERROR',
      message: error instanceof Error ? error.message : String(error),
      suggestion: 'Try running without --verbose flag',
    });
    process.exit(1);
  }
}

/**
 * Run the complete analysis pipeline using AI agents.
 */
async function analyze(targetPath: string, options: AnalyzeOptions = {}): Promise<void> {
  // Resolve to absolute path
  const root = path.resolve(targetPath);

  // Check path exists
  if (!fs.existsSync(root)) {
    renderErrorState({
      code: 'INVALID_PATH',
      message: `Path does not exist: ${root}`,
      suggestion: 'Check the path and try again',
    });
    process.exit(1);
  }

  // Handle cached mode (offline-friendly, no API key needed)
  if (options.cached) {
    const { readCacheSync, getCacheAge, formatCacheTimestamp } = await import('./cache.js');
    const cached = readCacheSync(root);

    if (!cached) {
      console.log(`
  No cached analysis found.

  Run a fresh analysis first:
    peakinfer analyze ${targetPath}

  Then view cached results anytime (no API key needed):
    peakinfer analyze ${targetPath} --cached
`);
      process.exit(0);
    }

    console.log(`
  Loading cached analysis...
  Cached: ${getCacheAge(cached)} (${formatCacheTimestamp(cached)})
`);

    // Render cached results
    if (options.output === 'json') {
      const jsonOutput = {
        success: true,
        state: 'cached',
        cached: {
          timestamp: cached.timestamp,
          age: getCacheAge(cached),
        },
        callsites: cached.callsites,
        stackMap: cached.stackMap,
        pricing: cached.pricing,
        techStack: cached.techStack,
        patterns: cached.patterns,
      };
      console.log(JSON.stringify(jsonOutput, null, 2));
    } else {
      // Render using PRD success state
      renderPRDSuccessState(
        {
          root: cached.targetPath,
          files: [],
          durationMs: 0,
          ...(cached.scan || { totalFiles: 0, totalLines: 0, languages: {} }),
        },
        cached.callsites as any,
        cached.stackMap,
        cached.pricing,
        cached.techStack,
        cached.patterns,
        []
      );
      console.log(`  (cached from ${formatCacheTimestamp(cached)})`);
    }
    return;
  }

  // Check API key for fresh analysis
  if (!checkApiKey()) {
    process.exit(1);
  }

  // Verbose mode: Use agent architecture with detailed task progress
  if (options.verbose) {
    await analyzeWithAgentArchitecture(root, options);
    return;
  }

  // Import progress utilities
  const { ProgressManager, createAnimatedMessage } = await import('./progress.js');

  // Initialize progress manager (outside try block so it can be accessed in catch)
  const progress = new ProgressManager({
    showTime: true,
    color: true,
  });

  try {

    // Phase 1: Quick file scan (no progress bar, just spinner)
    progress.start('Discovering files...');

    const scanResult = await scan(root);

    if (scanResult.totalFiles === 0) {
      progress.stop();
      renderErrorState({
        code: 'NO_FILES',
        message: 'No supported source files found',
        suggestion: 'Check directory contains .py, .ts, .js, .go, or .java files',
      });
      process.exit(1);
    }

    // Show scan complete
    progress.succeed(`Found ${scanResult.totalFiles} files to analyze`);

    // Phase 2: Connect to Claude Code SDK (PRD format)
    process.stdout.write('\nConnecting to Claude Code SDK...    ');

    // Scale maxTurns based on file count (more files = more exploration needed)
    // Increased base from 30 to 50 for thorough analysis
    const baseTurns = 50;
    const extraTurns = Math.ceil(scanResult.totalFiles / 20) * 5;
    const maxTurns = Math.min(baseTurns + extraTurns, 150); // Cap at 150 turns

    // Track current file being analyzed for tree-style display
    let lastFilePath = '';

    // Track if SDK connection checkmark was shown
    let sdkConnected = false;

    const result = await analyzeWithAgent(root, {
      maxTurns,
      onProgress: (msg) => {
        // Parse the progress message format: "Turn X/Y: ToolName → filename"
        const turnMatch = msg.match(/Turn (\d+)\/(\d+):/);
        const fileMatch = msg.match(/→\s*(.+)$/);

        if (turnMatch) {
          const currentTurn = parseInt(turnMatch[1], 10);
          const totalTurns = parseInt(turnMatch[2], 10);
          // Cap at 99% until we're truly done - agent may exceed maxTurns estimate
          const percent = Math.min(Math.floor((currentTurn / totalTurns) * 100), 99);

          // Build progress bar (PRD format: ████████░░)
          const barWidth = 10;
          const filled = Math.floor((percent / 100) * barWidth);
          const empty = barWidth - filled;
          const bar = '█'.repeat(filled) + '░'.repeat(empty);

          // Extract file/directory being analyzed
          let currentFile = '';
          if (fileMatch) {
            const filePath = fileMatch[1].trim();
            // Extract directory or file name for display - truncate long patterns
            const parts = filePath.split('/');
            if (parts.length > 2) {
              // Show parent directory + file: src/agents/analyzer.ts
              currentFile = parts.slice(-2).join('/');
            } else {
              currentFile = filePath;
            }
            // Truncate long filenames/patterns to 28 chars
            if (currentFile.length > 28) {
              currentFile = currentFile.substring(0, 25) + '...';
            }
            lastFilePath = currentFile;
          } else if (lastFilePath) {
            currentFile = lastFilePath;
          }

          // First turn shows the SDK connected checkmark
          if (!sdkConnected) {
            console.log('✓');
            sdkConnected = true;
          }

          // Only update display if running in TTY
          if (process.stdout.isTTY) {
            // Clear line and write PRD-style progress
            process.stdout.write('\r\x1b[K');
            process.stdout.write(`Analyzing codebase...               ${bar}  ${percent.toString().padStart(2)}%`);

            // Show current file on next line (tree-style)
            if (currentFile) {
              process.stdout.write(`\n  └─ ${currentFile.padEnd(30)} analyzing`);
              process.stdout.write('\x1b[F'); // Move cursor back up one line
            }
          } else {
            // Non-TTY: just print progress periodically
            if (currentTurn % 10 === 0 || currentTurn === 1) {
              console.log(`Analyzing... ${percent}% (${currentFile || 'scanning'})`);
            }
          }
        }
      },
    });

    // Clear the progress display and show completion
    if (process.stdout.isTTY) {
      process.stdout.write('\r\x1b[K'); // Clear current line
      process.stdout.write('\n');       // Move to next line
      process.stdout.write('\r\x1b[K'); // Clear that line too (the file line)
    }
    console.log(`Analyzing codebase...               ${'█'.repeat(10)}  100%  ✓`);

    const { callsites, stackMap, pricing, techStack, patterns, totalCostUsd, durationMs } = result;
    console.log(`Found ${callsites.length} LLM callsites`);
    console.log(''); // Blank line before next phase

    // Re-initialize progress manager for remaining phases
    progress.start('Processing results...');

    // Phase 3: Generating Reports
    let outputFiles: string[] = [];
    if (callsites.length > 0) {
      progress.startStep('generate-reports', 'Generating reports');

      // Write output files
      outputFiles = writeOutputFiles(root, stackMap, pricing, options.html);

      // Write HTML report if requested
      let htmlPath: string | null = null;
      if (options.html) {
        htmlPath = writeHTMLReport(root, scanResult, stackMap, pricing, techStack);
        if (htmlPath) {
          outputFiles.push(htmlPath);
        }
      }

      progress.completeStep('generate-reports', 'success', `Generated ${outputFiles.length} output files`);
    }

    // Complete the progress
    progress.succeed(`Analysis complete in ${(durationMs / 1000).toFixed(1)}s`);

    // Cache results for offline viewing
    try {
      const { writeCacheSync } = await import('./cache.js');
      writeCacheSync(root, {
        targetPath: root,
        callsites: callsites.map(cs => ({
          id: cs.id,
          file: cs.file,
          line: cs.line,
          provider: cs.provider || 'unknown',
          model: cs.model || 'unknown',
          taskKind: cs.taskKind,
          isStreaming: cs.isStreaming ?? undefined,
          confidence: cs.confidence,
        })),
        stackMap,
        pricing,
        techStack,
        patterns,
        scan: {
          totalFiles: scanResult.totalFiles,
          totalLines: scanResult.totalLines,
          languages: scanResult.languages,
        },
      });
    } catch {
      // Silently fail cache write (non-critical)
    }

    // JSON output mode - machine-readable format for testing and automation
    if (options.output === 'json') {
      const jsonOutput = {
        success: true,
        state: callsites.length === 0 ? 'empty' : 'success',
        scan: {
          totalFiles: scanResult.totalFiles,
          totalLines: scanResult.totalLines,
          languages: scanResult.languages,
        },
        callsites: callsites.map(cs => ({
          id: cs.id,
          file: cs.file,
          line: cs.line,
          provider: cs.provider,
          model: cs.model,
          taskKind: cs.taskKind,
          isStreaming: cs.isStreaming,
          confidence: cs.confidence,
        })),
        stackMap,
        pricing,
        techStack,
        patterns,
        outputFiles,
        metadata: {
          durationMs,
          totalCostUsd,
          version: '0.96',
        },
      };
      console.log(JSON.stringify(jsonOutput, null, 2));
      return;
    }

    // Render results with PRD-aligned output format
    if (callsites.length === 0) {
      // Build SDK check results from tech stack / detected patterns
      const sdkChecks: SDKCheckResult[] = [
        { name: 'OpenAI SDK', found: techStack?.application?.sdks?.some(s => s.toLowerCase().includes('openai')) || false },
        { name: 'Anthropic SDK', found: techStack?.application?.sdks?.some(s => s.toLowerCase().includes('anthropic')) || false },
        { name: 'LangChain', found: techStack?.application?.frameworks?.some(f => f.toLowerCase().includes('langchain')) || false },
        { name: 'LlamaIndex', found: techStack?.application?.frameworks?.some(f => f.toLowerCase().includes('llama')) || false },
        { name: 'vLLM', found: techStack?.serving?.runtimes?.some(r => r.toLowerCase().includes('vllm')) || false },
        { name: 'Direct HTTP to inference APIs', found: false },
      ];
      renderPRDZeroState(scanResult, sdkChecks);
    } else {
      // PRD-aligned success state with box tables
      renderPRDSuccessState(
        scanResult,
        callsites,
        stackMap,
        pricing,
        techStack,
        patterns,
        outputFiles
      );

      // Show analysis stats
      console.log(`Analysis completed: ${(durationMs / 1000).toFixed(1)}s, $${totalCostUsd.toFixed(4)} API cost`);
      console.log('');

      // Open HTML report in browser if requested
      if (options.html) {
        const htmlPath = path.join(root, OUTPUT_HTML);
        if (fs.existsSync(htmlPath) && options.open) {
          openInBrowser(htmlPath);
        }
      }
    }
  } catch (error) {
    // Stop any progress indicators
    if (typeof progress !== 'undefined') {
      progress.fail('Analysis failed');
    }

    // Debug: log the full error for troubleshooting
    if (process.env.DEBUG) {
      console.error('\n[DEBUG] Full error:', error);
      if (error instanceof Error && error.stack) {
        console.error('[DEBUG] Stack trace:', error.stack);
      }
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Determine error type for PRD-aligned output
    let errorType: 'api_connection' | 'api_key' | 'rate_limit' | 'other' = 'other';
    if (errorMessage.includes('authentication') || errorMessage.includes('ANTHROPIC_API_KEY')) {
      errorType = 'api_key';
    } else if (errorMessage.includes('rate_limit') || errorMessage.includes('429')) {
      errorType = 'rate_limit';
    } else if (errorMessage.includes('connection') || errorMessage.includes('network') || errorMessage.includes('ENOTFOUND')) {
      errorType = 'api_connection';
    }

    // JSON output mode - machine-readable error format
    if (options.output === 'json') {
      const jsonOutput = {
        success: false,
        state: 'error',
        error: {
          type: errorType,
          message: errorMessage,
        },
      };
      console.log(JSON.stringify(jsonOutput, null, 2));
      process.exit(1);
    }

    // Use PRD-aligned error state
    renderPRDErrorState({
      type: errorType,
      message: errorMessage,
    });
    process.exit(1);
  }
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Write output files (stackmap.json, pricing.json).
 * Returns paths of written files.
 */
function writeOutputFiles(
  root: string,
  stackMap: StackMap,
  pricing: PricingSummary,
  skipJson?: boolean
): string[] {
  const writtenFiles: string[] = [];

  // Skip JSON files if only HTML is needed (cleaner output)
  if (skipJson) {
    return writtenFiles;
  }

  try {
    // Write stackmap.json
    const stackMapPath = path.join(root, OUTPUT_STACKMAP);
    fs.writeFileSync(stackMapPath, JSON.stringify(stackMap, null, 2), 'utf-8');
    writtenFiles.push(stackMapPath);

    // Write pricing.json
    const pricingPath = path.join(root, OUTPUT_PRICING);
    fs.writeFileSync(pricingPath, JSON.stringify(pricing, null, 2), 'utf-8');
    writtenFiles.push(pricingPath);
  } catch {
    // Silently fail on write errors (non-critical)
  }

  return writtenFiles;
}

/**
 * Write HTML report.
 * Returns path if successful, null otherwise.
 */
function writeHTMLReport(
  root: string,
  scan: ScanResult,
  stackMap: StackMap,
  pricing: PricingSummary,
  techStack?: TechStack
): string | null {
  try {
    const htmlContent = generateHTMLReport(scan, stackMap, pricing, techStack);
    const htmlPath = path.join(root, OUTPUT_HTML);
    fs.writeFileSync(htmlPath, htmlContent, 'utf-8');
    return htmlPath;
  } catch {
    return null;
  }
}

/**
 * Open a file in the default browser.
 */
function openInBrowser(filePath: string): void {
  const { exec } = require('child_process');
  const platform = process.platform;

  let command: string;
  if (platform === 'darwin') {
    command = `open "${filePath}"`;
  } else if (platform === 'win32') {
    command = `start "" "${filePath}"`;
  } else {
    command = `xdg-open "${filePath}"`;
  }

  exec(command, (error: Error | null) => {
    if (error) {
      console.log(`  (could not open browser automatically)`);
    }
  });
}

// =============================================================================
// ANALYZE EVENTS - Runtime Telemetry Analysis
// =============================================================================

/**
 * Analyze runtime inference telemetry from JSONL/JSON/CSV files.
 *
 * Design: SLC + Julie Zhou principles
 * - Simple: Just pass a file, get recommendations
 * - Lovable: Smart defaults, clear output
 * - Complete: Full analysis with actionable insights
 */
async function analyzeEvents(eventsPath: string, options: AnalyzeOptions = {}): Promise<void> {
  const resolvedPath = path.resolve(eventsPath);

  // Check file exists
  if (!fs.existsSync(resolvedPath)) {
    renderErrorState({
      code: 'INVALID_PATH',
      message: `Events file not found: ${resolvedPath}`,
      suggestion: 'Check the file path and try again',
    });
    process.exit(1);
  }

  // Validate file extension
  const ext = path.extname(resolvedPath).toLowerCase();
  const supportedExtensions = ['.jsonl', '.json', '.csv', '.ndjson'];
  if (!supportedExtensions.includes(ext)) {
    renderErrorState({
      code: 'INVALID_FORMAT',
      message: `Unsupported file format: ${ext}`,
      suggestion: `Supported formats: ${supportedExtensions.join(', ')}`,
    });
    process.exit(1);
  }

  // Import progress utilities
  const { ProgressManager } = await import('./progress.js');
  const progress = new ProgressManager({ showTime: true, color: true });

  try {
    // Phase 1: Load events
    progress.start('Loading inference events...');

    // Import manual collector for file loading
    const { ManualCollector } = await import('../collectors/manual-collector.js');
    const collector = new ManualCollector({
      input: { files: [resolvedPath], format: ext.slice(1) as 'jsonl' | 'json' | 'csv' },
      trustBoundaries: { noNetworkEgress: true, leastPrivilege: true, auditableCode: true, noPIIExfiltration: true },
      outputFormat: 'events.jsonl',
      normalization: 'canonical_schema',
    });

    const events = await collector.collect();

    if (events.length === 0) {
      progress.fail('No events found');
      console.log(`
  No inference events found in ${path.basename(resolvedPath)}.

  Expected format (JSONL - one JSON object per line):
    {"id":"evt_001","ts":"2025-12-09T08:15:23Z","provider":"openai","model":"gpt-4o",...}
    {"id":"evt_002","ts":"2025-12-09T08:16:45Z","provider":"anthropic","model":"claude-3-5-sonnet",...}

  See: peakinfer --help for event schema details
`);
      process.exit(0);
    }

    progress.succeed(`Loaded ${events.length} inference events`);

    // Phase 2: Aggregate and analyze
    progress.start('Analyzing inference patterns...');

    // Aggregate events by provider, model, intent
    const aggregation = aggregateEvents(events);

    progress.succeed(`Analyzed ${aggregation.uniqueProviders} providers, ${aggregation.uniqueModels} models`);

    // JSON output mode
    if (options.output === 'json') {
      const jsonOutput = {
        success: true,
        type: 'runtime',
        eventsFile: resolvedPath,
        eventCount: events.length,
        aggregation,
      };
      console.log(JSON.stringify(jsonOutput, null, 2));
      return;
    }

    // Render results
    console.log(`
  RUNTIME TELEMETRY ANALYSIS
  ═══════════════════════════════════════════════════════════════

  Source: ${path.basename(resolvedPath)}
  Events: ${events.length.toLocaleString()}
  Time Range: ${aggregation.timeRange.start} → ${aggregation.timeRange.end}
`);

    // Provider breakdown
    console.log('  PROVIDERS');
    console.log('  ─────────────────────────────────────────────────────────────────');
    for (const [provider, stats] of Object.entries(aggregation.byProvider) as [string, { count: number; avgLatency: number }][]) {
      const pct = ((stats.count / events.length) * 100).toFixed(1);
      console.log(`  ${provider.padEnd(16)} ${stats.count.toString().padStart(6)} events (${pct}%)  avg ${stats.avgLatency.toFixed(0)}ms`);
    }

    // Model breakdown
    console.log('\n  MODELS');
    console.log('  ─────────────────────────────────────────────────────────────────');
    const topModels = Object.entries(aggregation.byModel)
      .sort((a, b) => (b[1] as { count: number }).count - (a[1] as { count: number }).count)
      .slice(0, 8) as [string, { count: number; avgLatency: number }][];
    for (const [model, stats] of topModels) {
      const pct = ((stats.count / events.length) * 100).toFixed(1);
      console.log(`  ${model.padEnd(28)} ${stats.count.toString().padStart(6)} (${pct}%)  ${stats.avgLatency.toFixed(0)}ms`);
    }

    // Intent breakdown (if available)
    if (Object.keys(aggregation.byIntent).length > 0) {
      console.log('\n  INTENTS');
      console.log('  ─────────────────────────────────────────────────────────────────');
      const topIntents = Object.entries(aggregation.byIntent)
        .sort((a, b) => (b[1] as { count: number }).count - (a[1] as { count: number }).count)
        .slice(0, 5) as [string, { count: number }][];
      for (const [intent, stats] of topIntents) {
        const pct = ((stats.count / events.length) * 100).toFixed(1);
        console.log(`  ${intent.padEnd(24)} ${stats.count.toString().padStart(6)} (${pct}%)`);
      }
    }

    console.log('');

  } catch (error) {
    progress.fail('Analysis failed');
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    renderErrorState({
      code: 'ANALYSIS_ERROR',
      message: errorMessage,
      suggestion: 'Check the events file format matches the expected schema',
    });
    process.exit(1);
  }
}

// =============================================================================
// COMBINED ANALYSIS - Static + Runtime with Intelligent Matching
// =============================================================================

/**
 * Analyze codebase with runtime telemetry correlation.
 *
 * Design: SLC + Julie Zhou principles
 * - Intelligent: Detects mismatches between codebase and events
 * - Helpful: Clear guidance when data doesn't correlate
 * - Complete: Shows both static findings and runtime insights
 */
async function analyzeCombined(
  codebasePath: string,
  eventsPath: string,
  options: AnalyzeOptions = {}
): Promise<void> {
  const resolvedCodebase = path.resolve(codebasePath);
  const resolvedEvents = path.resolve(eventsPath);

  // Validate paths
  if (!fs.existsSync(resolvedCodebase)) {
    renderErrorState({
      code: 'INVALID_PATH',
      message: `Codebase path not found: ${resolvedCodebase}`,
      suggestion: 'Check the path and try again',
    });
    process.exit(1);
  }

  if (!fs.existsSync(resolvedEvents)) {
    renderErrorState({
      code: 'INVALID_PATH',
      message: `Events file not found: ${resolvedEvents}`,
      suggestion: 'Check the events file path and try again',
    });
    process.exit(1);
  }

  // Import progress utilities
  const { ProgressManager } = await import('./progress.js');
  const progress = new ProgressManager({ showTime: true, color: true });

  try {
    // Phase 1: Load events first (fast, no API key needed)
    progress.start('Loading runtime events...');

    const { ManualCollector } = await import('../collectors/manual-collector.js');
    const ext = path.extname(resolvedEvents).toLowerCase();
    const collector = new ManualCollector({
      input: { files: [resolvedEvents], format: ext.slice(1) as 'jsonl' | 'json' | 'csv' },
      trustBoundaries: { noNetworkEgress: true, leastPrivilege: true, auditableCode: true, noPIIExfiltration: true },
      outputFormat: 'events.jsonl',
      normalization: 'canonical_schema',
    });

    const events = await collector.collect();
    const eventsAggregation = aggregateEvents(events);

    progress.succeed(`Loaded ${events.length} runtime events`);

    // Phase 2: Check for cached static analysis or API key
    const { readCacheSync } = await import('./cache.js');
    const cached = readCacheSync(resolvedCodebase);

    let codebaseCallsites: any[] = [];
    let hasCachedAnalysis = false;

    if (cached && cached.callsites) {
      progress.succeed('Using cached codebase analysis');
      codebaseCallsites = cached.callsites;
      hasCachedAnalysis = true;
    } else if (process.env.ANTHROPIC_API_KEY) {
      progress.start('Scanning codebase...');
      // We'll run full analysis after correlation check
    } else {
      progress.warn('No cached analysis - skipping codebase correlation');
      console.log(`
  Note: Set ANTHROPIC_API_KEY or run 'peakinfer analyze ${codebasePath}' first
  to enable codebase correlation.
`);
    }

    // Phase 3: Correlation analysis
    progress.start('Analyzing correlation...');

    // Build a pseudo-scan result for correlation
    const scanForCorrelation = { callsites: codebaseCallsites };
    const correlation = correlateCodebaseWithEvents(scanForCorrelation, eventsAggregation);

    progress.succeed('Correlation analysis complete');

    // Render combined results header
    console.log(`
  COMBINED ANALYSIS: Static + Runtime
  ═══════════════════════════════════════════════════════════════

  Codebase: ${codebasePath}
  Events:   ${path.basename(resolvedEvents)} (${events.length} events)
`);

    // Show correlation status
    renderCorrelationStatus(correlation, scanForCorrelation, eventsAggregation);

    // Run full static analysis if we have API key and no cache
    if (process.env.ANTHROPIC_API_KEY && !hasCachedAnalysis) {
      console.log('  Running static codebase analysis...\n');
      await analyze(codebasePath, options);
    } else if (hasCachedAnalysis && codebaseCallsites.length > 0) {
      // Show summary from cache
      console.log(`  CODEBASE (from cache): ${codebaseCallsites.length} callsites detected`);
      const providers = [...new Set(codebaseCallsites.map((c: any) => c.provider).filter(Boolean))];
      const models = [...new Set(codebaseCallsites.map((c: any) => c.model).filter(Boolean))];
      console.log(`    Providers: ${providers.join(', ') || '(not detected)'}`);
      console.log(`    Models: ${models.slice(0, 5).join(', ') || '(not detected)'}${models.length > 5 ? ` (+${models.length - 5} more)` : ''}`);
    }

    // Show runtime insights
    if (events.length > 0) {
      console.log(`
  RUNTIME INSIGHTS (from ${events.length} production events)
  ─────────────────────────────────────────────────────────────────`);

      // Provider breakdown
      console.log('\n  Provider Distribution:');
      for (const [provider, stats] of Object.entries(eventsAggregation.byProvider) as [string, { count: number; avgLatency: number }][]) {
        const pct = ((stats.count / events.length) * 100).toFixed(1);
        console.log(`    ${provider.padEnd(16)} ${stats.count.toString().padStart(5)} calls (${pct}%)  avg ${stats.avgLatency.toFixed(0)}ms`);
      }

      // Model latency from production
      console.log('\n  Actual Latency (production):');
      const topModels = Object.entries(eventsAggregation.byModel)
        .sort((a, b) => (b[1] as any).count - (a[1] as any).count)
        .slice(0, 5) as [string, { count: number; avgLatency: number }][];
      for (const [model, stats] of topModels) {
        console.log(`    ${model.padEnd(30)} ${stats.avgLatency.toFixed(0)}ms avg (${stats.count} calls)`);
      }
    }

  } catch (error) {
    progress.fail('Combined analysis failed');
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    renderErrorState({
      code: 'ANALYSIS_ERROR',
      message: errorMessage,
      suggestion: 'Check both the codebase path and events file',
    });
    process.exit(1);
  }
}

/**
 * Correlate static codebase findings with runtime events.
 * Returns match quality and insights.
 */
function correlateCodebaseWithEvents(
  scan: any,
  eventsAggregation: any
): { matchQuality: 'high' | 'partial' | 'low' | 'none'; insights: string[]; warnings: string[] } {
  const insights: string[] = [];
  const warnings: string[] = [];

  // Extract providers and models from codebase
  const codebaseProviders = new Set<string>();
  const codebaseModels = new Set<string>();

  for (const callsite of scan.callsites || []) {
    if (callsite.provider) codebaseProviders.add(callsite.provider.toLowerCase());
    if (callsite.model) codebaseModels.add(callsite.model.toLowerCase());
  }

  // Extract from events
  const eventProviders = new Set(Object.keys(eventsAggregation.byProvider || {}).map(p => p.toLowerCase()));
  const eventModels = new Set(Object.keys(eventsAggregation.byModel || {}).map(m => m.toLowerCase()));

  // Calculate overlap
  const providerOverlap = [...codebaseProviders].filter(p => eventProviders.has(p));
  const modelOverlap = [...codebaseModels].filter(m =>
    [...eventModels].some(em => em.includes(m) || m.includes(em))
  );

  // Determine match quality
  let matchQuality: 'high' | 'partial' | 'low' | 'none';

  if (codebaseProviders.size === 0) {
    matchQuality = 'none';
    warnings.push('No providers detected in codebase - unable to correlate');
  } else if (providerOverlap.length === 0) {
    matchQuality = 'none';
    warnings.push(`Provider mismatch: Codebase uses [${[...codebaseProviders].join(', ')}] but events are from [${[...eventProviders].join(', ')}]`);
    warnings.push('The events file may be from a different application or environment');
  } else if (providerOverlap.length === codebaseProviders.size) {
    if (modelOverlap.length > 0) {
      matchQuality = 'high';
      insights.push(`Strong correlation: ${providerOverlap.length} providers and ${modelOverlap.length} models match`);
    } else {
      matchQuality = 'partial';
      insights.push(`Providers match but models differ - events may be from different deployment`);
    }
  } else {
    matchQuality = 'partial';
    insights.push(`Partial match: ${providerOverlap.length}/${codebaseProviders.size} providers overlap`);
    const missingInEvents = [...codebaseProviders].filter(p => !eventProviders.has(p));
    if (missingInEvents.length > 0) {
      warnings.push(`Codebase uses [${missingInEvents.join(', ')}] but no events found for these providers`);
    }
  }

  // Check for events from providers not in codebase
  const extraEventProviders = [...eventProviders].filter(p => !codebaseProviders.has(p));
  if (extraEventProviders.length > 0 && codebaseProviders.size > 0) {
    insights.push(`Events include [${extraEventProviders.join(', ')}] not detected in codebase (may be from dependencies)`);
  }

  return { matchQuality, insights, warnings };
}

/**
 * Render correlation status with appropriate visual feedback.
 */
function renderCorrelationStatus(
  correlation: { matchQuality: string; insights: string[]; warnings: string[] },
  scan: any,
  eventsAggregation: any
): void {
  const statusIcons: Record<string, string> = {
    high: '✓',
    partial: '⚠',
    low: '⚠',
    none: '✗',
  };

  const statusMessages: Record<string, string> = {
    high: 'Strong correlation between codebase and runtime events',
    partial: 'Partial correlation - some providers/models match',
    low: 'Weak correlation - limited overlap detected',
    none: 'No correlation - events may be from different application',
  };

  const icon = statusIcons[correlation.matchQuality] || '?';
  const message = statusMessages[correlation.matchQuality] || 'Unknown correlation';

  console.log(`  CORRELATION: [${icon}] ${message}`);
  console.log('  ─────────────────────────────────────────────────────────────────');

  // Show what was found in each
  const codebaseProviders = [...new Set((scan.callsites || []).map((c: any) => c.provider).filter(Boolean))];
  const eventProviders = Object.keys(eventsAggregation.byProvider || {});

  console.log(`  Codebase: ${codebaseProviders.length > 0 ? codebaseProviders.join(', ') : '(no providers detected)'}`);
  console.log(`  Events:   ${eventProviders.length > 0 ? eventProviders.join(', ') : '(no events)'}`);

  // Show warnings prominently
  if (correlation.warnings.length > 0) {
    console.log('');
    for (const warning of correlation.warnings) {
      console.log(`  ⚠  ${warning}`);
    }
  }

  // Show insights
  if (correlation.insights.length > 0) {
    console.log('');
    for (const insight of correlation.insights) {
      console.log(`  ℹ  ${insight}`);
    }
  }

  console.log('');
}

/**
 * Aggregate events for analysis.
 */
function aggregateEvents(events: any[]): any {
  const byProvider: Record<string, { count: number; totalLatency: number; avgLatency: number }> = {};
  const byModel: Record<string, { count: number; totalLatency: number; avgLatency: number; totalTokens: number }> = {};
  const byIntent: Record<string, { count: number }> = {};

  let minTs = events[0]?.ts || '';
  let maxTs = events[0]?.ts || '';

  for (const event of events) {
    // By provider
    const provider = event.provider || 'unknown';
    if (!byProvider[provider]) {
      byProvider[provider] = { count: 0, totalLatency: 0, avgLatency: 0 };
    }
    byProvider[provider].count++;
    byProvider[provider].totalLatency += event.latency_ms || 0;

    // By model
    const model = event.model || 'unknown';
    if (!byModel[model]) {
      byModel[model] = { count: 0, totalLatency: 0, avgLatency: 0, totalTokens: 0 };
    }
    byModel[model].count++;
    byModel[model].totalLatency += event.latency_ms || 0;
    byModel[model].totalTokens += (event.input_tokens || 0) + (event.output_tokens || 0);

    // By intent
    if (event.intent) {
      if (!byIntent[event.intent]) {
        byIntent[event.intent] = { count: 0 };
      }
      byIntent[event.intent].count++;
    }

    // Time range
    if (event.ts < minTs) minTs = event.ts;
    if (event.ts > maxTs) maxTs = event.ts;
  }

  // Calculate averages
  for (const stats of Object.values(byProvider)) {
    stats.avgLatency = stats.count > 0 ? stats.totalLatency / stats.count : 0;
  }
  for (const stats of Object.values(byModel)) {
    stats.avgLatency = stats.count > 0 ? stats.totalLatency / stats.count : 0;
  }

  return {
    totalEvents: events.length,
    uniqueProviders: Object.keys(byProvider).length,
    uniqueModels: Object.keys(byModel).length,
    byProvider,
    byModel,
    byIntent,
    timeRange: { start: minTs, end: maxTs },
  };
}

// =============================================================================
// PRICES COMMAND - Show Pricing Data Source and List
// =============================================================================

/**
 * Show pricing data source and model prices.
 * Julie Zhuo aligned: transparency about data being used.
 */
async function prices(filterTier?: string, refresh?: boolean): Promise<void> {
  try {
    // Import performance benchmarks (PRIMARY) and pricing (secondary context)
    const {
      initializePerformanceData,
      getPerformanceTiers,
      getPerformanceEnvelopes,
      findAlternatives,
      getBenchmarkInfo,
    } = await import('./inferencemax.js');
    const {
      getPricingInfo,
      refreshPricingCache,
    } = await import('./pricing-fetcher.js');
    const { initPricingEngine } = await import('./pricing.js');
    const fs = await import('fs');
    const path = await import('path');

    // Initialize data sources
    await initializePerformanceData();
    await initPricingEngine();

    // Optionally refresh pricing cache
    if (refresh) {
      console.log('Refreshing pricing data...');
      const success = await refreshPricingCache();
      if (success) {
        console.log('Done.\n');
      } else {
        console.log('Failed to refresh. Using cached data.\n');
      }
    }

    // Get benchmark info
    const benchmarkInfo = getBenchmarkInfo();

    // Get pricing data for secondary context
    const pricingInfo = await getPricingInfo();
    const pricingMap = new Map<string, { input: number; output: number }>();
    for (const m of pricingInfo.models) {
      const key = m.model.toLowerCase();
      pricingMap.set(key, { input: m.inputPer1M, output: m.outputPer1M });
    }

    // Helper: format throughput
    const formatThroughput = (tps: number): string => {
      return `${tps.toLocaleString()} tok/s`.padEnd(12);
    };

    // Helper: format latency
    const formatLatency = (ms: number): string => {
      return `${ms}ms TTFT`.padEnd(10);
    };

    // Helper: format price
    const formatPrice = (model: string): string => {
      const normalizedModel = model.toLowerCase();
      const pricing = pricingMap.get(normalizedModel);
      if (pricing) {
        return `$${pricing.input.toFixed(2)}/$${pricing.output.toFixed(2)}`;
      }
      return '';
    };

    // Helper: render a model line
    const renderModelLine = (envelope: { model: string; throughputTokensPerSec: number; latencyTTFT: number; framework: string; source: string; note?: string }, prefix: string = '    ') => {
      const modelName = envelope.model.padEnd(22);
      const throughput = formatThroughput(envelope.throughputTokensPerSec);
      const latency = formatLatency(envelope.latencyTTFT);
      const price = formatPrice(envelope.model);
      const context = envelope.framework !== envelope.source ? envelope.framework : envelope.note || '';
      if (price) {
        console.log(`${prefix}${modelName} ${throughput} ${latency} ${price}`);
      } else {
        console.log(`${prefix}${modelName} ${throughput} ${latency} ${context}`);
      }
    };

    // =========================================================================
    // CHECK FOR CACHED ANALYSIS - Show contextual comparison
    // =========================================================================
    const stackmapPath = path.default.join(process.cwd(), 'peakinfer-stackmap.json');
    let detectedModels: string[] = [];

    if (fs.default.existsSync(stackmapPath)) {
      try {
        const stackmap = JSON.parse(fs.default.readFileSync(stackmapPath, 'utf-8'));
        if (stackmap.summary?.models) {
          detectedModels = stackmap.summary.models;
        }
      } catch {
        // Ignore parse errors
      }
    }

    console.log('PeakInfer v1.0');
    console.log('');

    // =========================================================================
    // CONTEXTUAL VIEW: Show YOUR models with alternatives
    // (Skip if --all flag is passed or a specific tier is requested)
    // =========================================================================
    const showAllTiers = filterTier === '--all';
    if (detectedModels.length > 0 && !filterTier && !showAllTiers) {
      console.log('Your models vs. performance benchmarks');
      console.log('');

      // Normalize model names for matching
      const normalizeModelName = (name: string): string => {
        // Strip version suffixes and provider prefixes
        return name
          .replace(/anthropic\./gi, '')
          .replace(/meta\./gi, '')
          .replace(/-\d{8}(-v\d+:\d+)?$/i, '')  // Remove date versions like -20241022-v2:0
          .replace(/-\d{8}$/i, '')              // Remove date versions like -20241022
          .toLowerCase();
      };

      const processedModels = new Set<string>();

      for (const detectedModel of detectedModels) {
        const normalized = normalizeModelName(detectedModel);

        // Skip embeddings and duplicates
        if (normalized.includes('embedding') || processedModels.has(normalized)) {
          continue;
        }
        processedModels.add(normalized);

        // Find performance data
        const alternatives = findAlternatives(detectedModel);

        if (alternatives.current) {
          // We have benchmark data for this model
          console.log(`${detectedModel}`);
          renderModelLine(alternatives.current, '  ');

          if (alternatives.faster.length > 0) {
            console.log('  Faster alternatives:');
            for (const alt of alternatives.faster.slice(0, 2)) {
              renderModelLine(alt, '    → ');
            }
          }
          console.log('');
        } else {
          // No benchmark data - show the model name and suggest analysis
          console.log(`${detectedModel}`);
          console.log('  No benchmark data available');
          console.log('');
        }
      }

      // Benchmark source note
      console.log(`${benchmarkInfo.disclaimer}`);
      console.log(`Source: ${benchmarkInfo.source}`);
      console.log('');

      // Usage hints
      console.log('What to do next');
      console.log('  peakinfer models --all            show all benchmark tiers');
      console.log('  peakinfer models fast             show fast tier only');
      console.log('');

    } else {
      // =========================================================================
      // GENERIC VIEW: Show all tiers (no cached analysis or tier filter)
      // =========================================================================
      if (detectedModels.length === 0) {
        console.log('Models by inference performance');
        console.log('');
        console.log('  Run `peakinfer analyze .` first to see YOUR models compared.');
        console.log('');
      } else {
        console.log('Models by inference performance');
        console.log('');
      }

      const tiers = getPerformanceTiers();

      // Render each tier
      for (const tier of tiers) {
        // Filter by tier if specified
        if (filterTier && filterTier !== '--all' && tier.name.toLowerCase() !== filterTier.toLowerCase()) {
          continue;
        }

        console.log(`${tier.name}`);
        console.log(`  ${tier.description}`);
        console.log('');

        // Group models by unique model name (avoid duplicates)
        const uniqueModels = new Map<string, typeof tier.models[0]>();
        for (const model of tier.models) {
          if (!uniqueModels.has(model.model)) {
            uniqueModels.set(model.model, model);
          }
        }

        for (const [, envelope] of uniqueModels) {
          renderModelLine(envelope);
        }
        console.log('');
      }

      // Benchmark source note
      console.log(`${benchmarkInfo.disclaimer}`);
      console.log(`Source: ${benchmarkInfo.source}`);
      console.log('');

      // Usage hints
      console.log('What to do next');
      console.log('  peakinfer models frontier         show frontier tier only');
      console.log('  peakinfer models fast             show fast tier only');
      console.log('  peakinfer models --refresh        refresh pricing data');
      console.log('');
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error loading performance data: ${errorMessage}`);
    process.exit(1);
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

// Export functions for use in other modules
export { analyze, prices };

// =============================================================================
// CLI ENTRY POINT
// =============================================================================

/**
 * Detect analysis mode from path.
 * - Directory → static analysis
 * - File with .jsonl/.json/.csv/.ndjson → runtime telemetry
 * - Other files → static analysis (single file)
 */
function detectAnalysisMode(targetPath: string): 'static' | 'runtime' | 'ambiguous' {
  const resolvedPath = path.resolve(targetPath);

  if (!fs.existsSync(resolvedPath)) {
    return 'ambiguous';  // Let the analyze function handle the error
  }

  const stat = fs.statSync(resolvedPath);

  if (stat.isDirectory()) {
    return 'static';
  }

  // Check file extension for telemetry files
  const ext = path.extname(resolvedPath).toLowerCase();
  const telemetryExtensions = ['.jsonl', '.ndjson', '.csv'];
  const maybeTelemtry = ['.json'];  // JSON could be either

  if (telemetryExtensions.includes(ext)) {
    return 'runtime';
  }

  if (maybeTelemtry.includes(ext)) {
    // Peek at the file to determine type
    try {
      const content = fs.readFileSync(resolvedPath, 'utf-8').slice(0, 1000);
      // If it has inference event fields, treat as runtime
      if (content.includes('"provider"') && content.includes('"model"') &&
          (content.includes('"latency_ms"') || content.includes('"input_tokens"'))) {
        return 'runtime';
      }
    } catch {
      // Fall through to static
    }
    return 'static';
  }

  // Default: treat other files as static analysis targets
  return 'static';
}

/** Parse command line arguments and run */
function main(): void {
  const args = process.argv.slice(2);

  // Show help
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
peakinfer — llm inference performance optimization

usage:
  peakinfer analyze <path>       analyze codebase or runtime events
  peakinfer models [tier]        show models by inference performance
  peakinfer --help               show this help

analyze modes:
  peakinfer analyze ./src              # static: scan codebase for LLM calls
  peakinfer analyze events.jsonl       # runtime: analyze inference telemetry
  peakinfer analyze ./src --events events.jsonl  # combined analysis

analyze options:
  --events <file>       add runtime telemetry to static analysis
  --mode <static|runtime>  force analysis mode (auto-detected by default)
  --html                generate html report
  --open                open html report in browser
  --output <format>     output format: text (default) or json
  --cached              view previous analysis (offline, no API key needed)
  --verbose             show detailed task progress

models options:
  peakinfer models                 # show all performance tiers
  peakinfer models frontier        # show frontier tier (best reasoning)
  peakinfer models fast            # show fast tier (optimized throughput)
  peakinfer models --refresh       # refresh pricing data

event schema (JSONL):
  {"id":"evt_001","ts":"2025-12-09T08:15:23Z","provider":"openai","model":"gpt-4o",
   "input_tokens":4250,"output_tokens":380,"latency_ms":2340,"intent":"summarize"}

examples:
  peakinfer analyze .                    # static analysis of current directory
  peakinfer analyze events.jsonl         # analyze runtime telemetry
  peakinfer analyze . --events prod.jsonl  # combined static + runtime
  peakinfer analyze . --cached           # view last analysis (offline)
  peakinfer models fast                  # show fast inference models

environment:
  ANTHROPIC_API_KEY     required for static analysis (not runtime or --cached)
`);
    process.exit(0);
  }

  // Show version
  if (args.includes('--version') || args.includes('-v')) {
    console.log('1.0.0');
    process.exit(0);
  }

  // Parse options
  const outputArg = getArgValue(args, '--output');
  const eventsArg = getArgValue(args, '--events');
  const modeArg = getArgValue(args, '--mode') as 'static' | 'runtime' | undefined;

  const options: AnalyzeOptions = {
    html: args.includes('--html') || args.includes('--open'),
    open: args.includes('--open'),
    output: outputArg === 'json' ? 'json' : 'text',
    cached: args.includes('--cached'),
    events: eventsArg,
    mode: modeArg,
    verbose: args.includes('--verbose'),
  };

  // Filter out options and their values to get positional args
  const optionsWithValues = ['--output', '--events', '--mode'];
  const positionalArgs: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      // Skip this arg and its value if it takes one
      if (optionsWithValues.includes(arg)) {
        i++;  // Skip the value
      }
      continue;
    }
    positionalArgs.push(arg);
  }

  // Parse command
  const command = positionalArgs[0];

  // Simplified commands (removed stubs for SLC compliance)
  const simplifiedCommands = ['discover', 'profile', 'plan', 'report', 'templates', 'benchmark', 'recommend'];

  if (command === 'analyze') {
    const targetPath = positionalArgs[1] || '.';

    // Determine analysis mode
    let mode: 'static' | 'runtime' | undefined = options.mode;
    if (!mode) {
      const detected = detectAnalysisMode(targetPath);
      mode = detected === 'ambiguous' ? 'static' : detected;
    }

    // Handle combined analysis (static + events)
    if (options.events) {
      // Combined: run static analysis with runtime events correlation
      analyzeCombined(targetPath, options.events, options);
    } else if (mode === 'runtime') {
      // Runtime telemetry analysis (no API key needed)
      analyzeEvents(targetPath, options);
    } else {
      // Static codebase analysis (default)
      analyze(targetPath, options);
    }
  } else if (simplifiedCommands.includes(command)) {
    // Friendly message for removed commands
    console.log(`
  '${command}' has been simplified.

  Use instead:
    peakinfer analyze .               # static codebase analysis
    peakinfer analyze events.jsonl    # runtime telemetry analysis
    peakinfer analyze . --events events.jsonl  # combined analysis

  For model performance info:
    peakinfer models           # models by inference performance
`);
    process.exit(0);
  } else if (command === 'prices' || command === 'models') {
    // Both "prices" and "models" work - "models" shows performance-first view
    const showAll = args.includes('--all');
    const filterTier = showAll ? '--all' : positionalArgs[1];
    const refresh = args.includes('--refresh');
    prices(filterTier, refresh);
  } else if (!command) {
    // Default: analyze current directory
    analyze('.', options);
  } else {
    console.error(`unknown command: ${command}`);
    console.error('run peakinfer --help for usage');
    process.exit(1);
  }
}

/** Get value for a CLI argument like --arg value */
function getArgValue(args: string[], argName: string): string | undefined {
  const idx = args.indexOf(argName);
  if (idx !== -1 && idx + 1 < args.length) {
    return args[idx + 1];
  }
  return undefined;
}

// Run if executed directly
main();
