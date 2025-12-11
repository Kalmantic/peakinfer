#!/usr/bin/env node
/**
 * PeakInfer CLI — Main Entry Point
 *
 * Per PRD v0.95 Section 9: SLC v1 Commands
 * - peakinfer analyze .
 * - peakinfer stackmap
 * - peakinfer pricing
 * - peakinfer diff old.json new.json
 * - peakinfer profile --events events.jsonl (Phase 2: Runtime Telemetry)
 *
 * Design: SLC (Simple, Lovable, Complete)
 * First-use experience: Welcoming, clear, actionable.
 */

import * as path from 'path';
import * as fs from 'fs';
import { analyzeWithAgent } from './agent-analyzer.js';
import { scan } from './scanner.js';
import {
  renderErrorState,
} from './renderer.js';
import {
  renderPRDZeroState,
  renderPRDSuccessState,
  renderPRDErrorState,
  type SDKCheckResult,
} from './prd-renderer.js';
import { generateHTMLReport } from './html-renderer.js';
import type { ScanResult, StackMap, PricingSummary, TechStack } from './types.js';
import { profileEvents, type ProfileResult } from './profiler.js';

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
  estimates costs, and suggests optimizations.

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
// ANALYZE COMMAND (PRD Section 9)
// =============================================================================

/** Options for analyze command */
interface AnalyzeOptions {
  html?: boolean;
  open?: boolean;
  detailed?: boolean;
  events?: string; // Optional path to events.jsonl for combined analysis
}

/** Common telemetry file patterns to search for */
const TELEMETRY_FILE_PATTERNS = [
  'events.jsonl',
  'inference-events.jsonl',
  'llm-events.jsonl',
  'telemetry.jsonl',
  'logs/events.jsonl',
  'data/events.jsonl',
  '.peakinfer/events.jsonl',
];

/**
 * Find telemetry file in codebase
 */
function findTelemetryFile(root: string): string | null {
  for (const pattern of TELEMETRY_FILE_PATTERNS) {
    const fullPath = path.join(root, pattern);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }
  return null;
}

/**
 * Count runtime-configured (dynamic) models in analysis results
 * These are models where the name is determined at runtime via env vars, config, etc.
 */
function countDynamicModels(callsites: any[]): { total: number; dynamic: number } {
  const total = callsites.length;
  const dynamic = callsites.filter(cs =>
    !cs.model || cs.model === 'unknown' || cs.model === 'dynamic' || cs.model === '(runtime-configured)'
  ).length;
  return { total, dynamic };
}

/**
 * Run the complete analysis pipeline using AI agents.
 * Now combines static analysis with runtime telemetry when available.
 * PRD: `peakinfer analyze .`
 */
async function analyze(targetPath: string, options: AnalyzeOptions = {}): Promise<void> {
  // Check API key first (friendly first-use experience)
  if (!checkApiKey()) {
    process.exit(1);
  }

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

  // Import progress utilities
  const { ProgressManager, createAnimatedMessage } = await import('./progress.js');

  // Initialize progress manager (outside try block so it can be accessed in catch)
  const progress = new ProgressManager({
    showTime: true,
    color: true,
  });

  try {

    // Phase 1: Scanning codebase
    progress.start('Scanning codebase...');

    // Import ProgressBar for visual progress
    const { ProgressBar } = await import('./progress.js');

    // Create progress bar for file scanning (we'll update it as we scan)
    let progressBar: InstanceType<typeof ProgressBar> | null = null;

    const scanResult = await scan(root, {
      onProgress: (current, total, currentFile) => {
        // Initialize progress bar on first update
        if (!progressBar && total > 0) {
          progress.stop(); // Stop the spinner
          progressBar = new ProgressBar(total, {
            width: 40,
            label: 'Scanning codebase'
          });
        }

        // Update progress bar with current file info
        if (progressBar) {
          const fileName = currentFile ? currentFile.split('/').pop() || currentFile : '';
          progressBar.update(current, fileName);
        }
      }
    });

    if (scanResult.totalFiles === 0) {
      progress.stop();
      renderErrorState({
        code: 'NO_FILES',
        message: 'No supported source files found',
        suggestion: 'Check directory contains .py, .ts, .js, .go, or .java files',
      });
      process.exit(1);
    }

    // Resume with regular progress indicator
    if (!progressBar) {
      // If we didn't use progress bar (small codebase), just update the spinner
      progress.update(`Found ${scanResult.totalFiles} files to analyze`);
    } else {
      // Restart progress after progress bar
      progress.start(`Found ${scanResult.totalFiles} files to analyze`);
    }

    // Phase 2: Pattern Detection
    progress.startStep('detect-patterns', 'Detecting LLM usage patterns');

    // Animated messages during analysis
    const analysisMessages = [
      'Scanning for OpenAI API calls...',
      'Detecting Anthropic SDK usage...',
      'Identifying LangChain patterns...',
      'Mapping inference callsites...',
      'Analyzing cost distribution...',
    ];
    const animatedMsg = createAnimatedMessage(analysisMessages);
    animatedMsg.start(2000);

    // Scale maxTurns based on file count (more files = more exploration needed)
    const baseTurns = 30;
    const extraTurns = Math.ceil(scanResult.totalFiles / 25) * 5;
    const maxTurns = Math.min(baseTurns + extraTurns, 100); // Cap at 100 turns

    const result = await analyzeWithAgent(root, {
      maxTurns,
      onProgress: (msg) => {
        // Update progress with agent messages
        if (msg.includes('Searching')) {
          progress.update(msg, ['semantic analysis']);
        } else if (msg.includes('Found')) {
          progress.update(msg, ['validation']);
        } else {
          progress.update(msg);
        }
      },
    });

    // Stop animated messages
    animatedMsg.stop();

    // Complete pattern detection step
    progress.completeStep('detect-patterns', 'success', `Found ${result.callsites.length} callsites`);

    const { callsites, stackMap, pricing, techStack, patterns, totalCostUsd, durationMs } = result;

    // Phase 3: Risk Assessment
    if (callsites.length > 0 && patterns) {
      progress.startStep('risk-assessment', 'Assessing optimization risks');

      // Import risk detection
      const { detectRisks } = await import('./recommender.js');
      const riskAssessment = detectRisks(patterns, callsites);

      const riskLevel = (riskAssessment as any).overallRisk ||
        (riskAssessment.summary && typeof riskAssessment.summary === 'object' &&
         'overallRisk' in riskAssessment.summary ?
         (riskAssessment.summary as any).overallRisk : 'low');
      const riskCount = riskAssessment.risks?.length || 0;
      progress.completeStep('risk-assessment', riskCount > 0 ? 'warning' : 'success',
        `${riskCount} potential risks identified (${riskLevel} overall risk)`);
    }

    // Phase 4: Generating Reports
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

      // =========================================================================
      // PHASE 5: Runtime Telemetry Integration
      // =========================================================================

      // Check for unknown models
      const modelStats = countDynamicModels(callsites);
      const dynamicPercent = modelStats.total > 0 ? (modelStats.dynamic / modelStats.total) * 100 : 0;

      // Look for telemetry file (explicit or auto-detect)
      const telemetryPath = options.events ? path.resolve(options.events) : findTelemetryFile(root);

      if (telemetryPath && fs.existsSync(telemetryPath)) {
        // Telemetry file found - run profile analysis
        console.log('');
        console.log('┌─────────────────────────────────────────────────────────────────────┐');
        console.log('│                    RUNTIME TELEMETRY DETECTED                       │');
        console.log('├─────────────────────────────────────────────────────────────────────┤');
        console.log(`│   Found: ${path.basename(telemetryPath).padEnd(55)} │`);
        console.log('│   Analyzing actual runtime costs and model usage...                 │');
        console.log('└─────────────────────────────────────────────────────────────────────┘');
        console.log('');

        try {
          const profileResult = await profileEvents(telemetryPath, {});
          renderRuntimeTelemetrySummary(profileResult, modelStats);
        } catch (telemetryError) {
          console.log(`  (telemetry analysis failed: ${telemetryError instanceof Error ? telemetryError.message : 'unknown error'})`);
        }
      } else if (dynamicPercent > 30) {
        // High unknown rate - suggest telemetry
        renderTelemetrySuggestion(modelStats, root);
      }

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

    // Use PRD-aligned error state
    renderPRDErrorState({
      type: errorType,
      message: errorMessage,
    });
    process.exit(1);
  }
}

// =============================================================================
// STACKMAP COMMAND (PRD Section 9)
// =============================================================================

/**
 * Display or export the StackMap from a previous analysis.
 * PRD: `peakinfer stackmap`
 */
async function stackmap(options: { cached?: boolean; json?: boolean } = {}): Promise<void> {
  const stackMapPath = path.join(process.cwd(), OUTPUT_STACKMAP);

  if (!fs.existsSync(stackMapPath)) {
    console.log(`
  no stackmap found

  Run \`peakinfer analyze .\` first to generate a stackmap.

  The stackmap shows your LLM inference architecture:
  - Callsites (where API calls happen)
  - Models used
  - Providers configured
  - Cost distribution
`);
    process.exit(1);
  }

  try {
    const stackMapData = JSON.parse(fs.readFileSync(stackMapPath, 'utf-8')) as StackMap;

    if (options.json) {
      // Raw JSON output
      console.log(JSON.stringify(stackMapData, null, 2));
    } else {
      // Human-readable summary
      console.log(`
peakinfer stackmap
─────────────────────────────────────────────────────────────────
`);

      // Extract callsites from the tree structure
      const callsites: any[] = [];
      const collectCallsites = (nodes: any[]) => {
        for (const node of nodes) {
          if (node.callsites) callsites.push(...node.callsites);
          if (node.children) collectCallsites(node.children);
        }
      };
      if (stackMapData.tree) collectCallsites(stackMapData.tree);

      const models = stackMapData.summary?.models || [];
      const providers = stackMapData.summary?.providers || [];

      console.log(`  callsites: ${callsites.length}`);
      console.log(`  models: ${models.length}`);
      console.log(`  providers: ${providers.length}`);
      console.log('');

      if (callsites.length > 0) {
        console.log('  top callsites:');
        for (const cs of callsites.slice(0, 5)) {
          const loc = `${cs.file}:${cs.line}`;
          console.log(`    ${loc.padEnd(45)} ${cs.model || 'unknown'}`);
        }
        if (callsites.length > 5) {
          console.log(`    ... and ${callsites.length - 5} more`);
        }
        console.log('');
      }

      if (models.length > 0) {
        console.log('  models:');
        for (const model of models.slice(0, 5)) {
          const name = typeof model === 'string' ? model : (model as any).name || 'unknown';
          console.log(`    ${name}`);
        }
        console.log('');
      }

      console.log(`  file: ${stackMapPath}`);
      console.log('');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`  error reading stackmap: ${errorMessage}`);
    process.exit(1);
  }
}

// =============================================================================
// PRICING COMMAND (PRD Section 9)
// =============================================================================

/**
 * Display pricing information and cost breakdown.
 * PRD: `peakinfer pricing`
 */
async function pricing(options: { detailed?: boolean; provider?: string } = {}): Promise<void> {
  const pricingPath = path.join(process.cwd(), OUTPUT_PRICING);

  // If we have a previous analysis, show that pricing
  if (fs.existsSync(pricingPath)) {
    try {
      const pricingData = JSON.parse(fs.readFileSync(pricingPath, 'utf-8')) as PricingSummary;

      console.log(`
peakinfer pricing
─────────────────────────────────────────────────────────────────
`);

      // Use estimatedRange from pricing data (uses low/high per types.ts)
      const range = pricingData.estimatedRange || { low: 0, high: 0 };
      console.log(`  estimated monthly cost: $${range.low.toFixed(0)} - $${range.high.toFixed(0)}`);
      console.log('');

      // Model breakdown (byModel is Array<{ model: string; cost: number }>)
      if (pricingData.byModel && pricingData.byModel.length > 0) {
        console.log('  by model:');
        for (const item of pricingData.byModel) {
          const model = item.model || 'unknown';
          const cost = item.cost || 0;
          console.log(`    ${model.padEnd(30)} $${cost.toFixed(2)}/mo`);
        }
        console.log('');
      }

      // Provider breakdown (byProvider is Array<{ provider: string; cost: number; percentage: number }>)
      if (pricingData.byProvider && pricingData.byProvider.length > 0) {
        console.log('  by provider:');
        for (const item of pricingData.byProvider) {
          const provider = item.provider || 'unknown';
          const cost = item.cost || 0;
          console.log(`    ${provider.padEnd(20)} $${cost.toFixed(2)}/mo`);
        }
        console.log('');
      }

      console.log(`  file: ${pricingPath}`);
      console.log('');

      // Detailed pricing from LiteLLM if requested
      if (options.detailed) {
        await showLivePricing(options.provider);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`  error reading pricing: ${errorMessage}`);
      process.exit(1);
    }
  } else {
    // No previous analysis, show live pricing
    console.log(`
peakinfer pricing
─────────────────────────────────────────────────────────────────

  no analysis found - showing live model pricing

  Run \`peakinfer analyze .\` to get cost estimates for your codebase.
`);
    await showLivePricing(options.provider);
  }
}

/**
 * Show live pricing data from LiteLLM.
 */
async function showLivePricing(filterProvider?: string): Promise<void> {
  try {
    const { getPricingInfo, initializeGPUPricing, getGPUPricing } = await import('./pricing-fetcher.js');
    const { initPricingEngine } = await import('./pricing.js');

    // Initialize pricing engines
    await initPricingEngine();
    await initializeGPUPricing();

    const info = await getPricingInfo(filterProvider);

    console.log(`  source: ${info.source}`);
    console.log(`  last updated: ${info.lastUpdated}`);
    console.log(`  total models: ${info.totalModels}`);
    console.log('');

    if (filterProvider) {
      console.log(`  filtered by: ${filterProvider}`);
      console.log('');
    }

    // Group by provider
    const byProvider = new Map<string, typeof info.models>();
    for (const m of info.models) {
      if (!byProvider.has(m.provider)) {
        byProvider.set(m.provider, []);
      }
      byProvider.get(m.provider)!.push(m);
    }

    console.log('  model prices ($ per 1M tokens):');
    console.log('  ─────────────────────────────────────────────────────────────');
    console.log('  provider          model                    input    output');
    console.log('  ─────────────────────────────────────────────────────────────');

    const maxPerProvider = filterProvider ? 50 : 5;

    for (const [provider, models] of byProvider) {
      // Sort by cost (most expensive first)
      models.sort((a, b) => (b.inputPer1M + b.outputPer1M) - (a.inputPer1M + a.outputPer1M));

      for (const m of models.slice(0, maxPerProvider)) {
        const providerPad = provider.padEnd(16);
        const modelPad = m.model.padEnd(24);
        const inputPrice = m.inputPer1M.toFixed(2).padStart(7);
        const outputPrice = m.outputPer1M.toFixed(2).padStart(8);
        console.log(`  ${providerPad}  ${modelPad} ${inputPrice}  ${outputPrice}`);
      }

      if (models.length > maxPerProvider) {
        console.log(`  ${provider.padEnd(16)}  ... and ${models.length - maxPerProvider} more`);
      }
    }

    console.log('');

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`  error loading pricing: ${errorMessage}`);
  }
}

// =============================================================================
// DIFF COMMAND (PRD Section 9)
// =============================================================================

/**
 * Compare two stackmap/pricing files to show changes.
 * PRD: `peakinfer diff old.json new.json`
 */
async function diff(oldFile: string, newFile: string): Promise<void> {
  const oldPath = path.resolve(oldFile);
  const newPath = path.resolve(newFile);

  // Validate files exist
  if (!fs.existsSync(oldPath)) {
    console.error(`  error: file not found: ${oldPath}`);
    process.exit(1);
  }
  if (!fs.existsSync(newPath)) {
    console.error(`  error: file not found: ${newPath}`);
    process.exit(1);
  }

  try {
    const oldData = JSON.parse(fs.readFileSync(oldPath, 'utf-8'));
    const newData = JSON.parse(fs.readFileSync(newPath, 'utf-8'));

    console.log(`
peakinfer diff
─────────────────────────────────────────────────────────────────

  comparing:
    old: ${oldFile}
    new: ${newFile}
`);

    // Determine if these are stackmaps or pricing files
    const isStackMap = oldData.tree || oldData.callsites || newData.tree || newData.callsites;
    const isPricing = oldData.estimatedRange || oldData.byModel || newData.estimatedRange || newData.byModel;

    if (isStackMap) {
      diffStackMaps(oldData, newData);
    } else if (isPricing) {
      diffPricing(oldData, newData);
    } else {
      // Generic JSON diff
      console.log('  generic comparison (unrecognized format):');
      console.log(`    old keys: ${Object.keys(oldData).length}`);
      console.log(`    new keys: ${Object.keys(newData).length}`);
    }

    console.log('');

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`  error comparing files: ${errorMessage}`);
    process.exit(1);
  }
}

/**
 * Compare two StackMap files.
 */
function diffStackMaps(oldData: any, newData: any): void {
  const oldTree = oldData.tree || oldData;
  const newTree = newData.tree || newData;

  const oldCallsites = oldTree.callsites || [];
  const newCallsites = newTree.callsites || [];
  const oldModels = oldTree.models || [];
  const newModels = newTree.models || [];

  console.log('  stackmap changes:');
  console.log('');

  // Callsite changes
  const callsiteDiff = newCallsites.length - oldCallsites.length;
  const callsiteSign = callsiteDiff >= 0 ? '+' : '';
  console.log(`    callsites: ${oldCallsites.length} → ${newCallsites.length} (${callsiteSign}${callsiteDiff})`);

  // Model changes
  const modelDiff = newModels.length - oldModels.length;
  const modelSign = modelDiff >= 0 ? '+' : '';
  console.log(`    models: ${oldModels.length} → ${newModels.length} (${modelSign}${modelDiff})`);

  // Find new/removed callsites
  const oldLocations = new Set(oldCallsites.map((cs: any) => `${cs.file}:${cs.line}`));
  const newLocations = new Set(newCallsites.map((cs: any) => `${cs.file}:${cs.line}`));

  const added = [...newLocations].filter(loc => !oldLocations.has(loc));
  const removed = [...oldLocations].filter(loc => !newLocations.has(loc as string));

  if (added.length > 0) {
    console.log('');
    console.log('    added callsites:');
    for (const loc of added.slice(0, 5)) {
      console.log(`      + ${loc}`);
    }
    if (added.length > 5) {
      console.log(`      ... and ${added.length - 5} more`);
    }
  }

  if (removed.length > 0) {
    console.log('');
    console.log('    removed callsites:');
    for (const loc of removed.slice(0, 5)) {
      console.log(`      - ${loc}`);
    }
    if (removed.length > 5) {
      console.log(`      ... and ${removed.length - 5} more`);
    }
  }
}

/**
 * Compare two pricing files.
 */
function diffPricing(oldData: any, newData: any): void {
  const oldRange = oldData.estimatedRange || { low: 0, high: 0 };
  const newRange = newData.estimatedRange || { low: 0, high: 0 };

  console.log('  pricing changes:');
  console.log('');

  // Cost range changes (uses low/high per types.ts)
  const lowDiff = newRange.low - oldRange.low;
  const highDiff = newRange.high - oldRange.high;
  const lowSign = lowDiff >= 0 ? '+' : '';
  const highSign = highDiff >= 0 ? '+' : '';

  console.log(`    estimated monthly (low): $${oldRange.low.toFixed(0)} → $${newRange.low.toFixed(0)} (${lowSign}$${lowDiff.toFixed(0)})`);
  console.log(`    estimated monthly (high): $${oldRange.high.toFixed(0)} → $${newRange.high.toFixed(0)} (${highSign}$${highDiff.toFixed(0)})`);

  // Model-level changes (byModel is an array)
  if (oldData.byModel && newData.byModel) {
    const oldModels = oldData.byModel.map((m: any) => m.model);
    const newModels = newData.byModel.map((m: any) => m.model);

    const addedModels = newModels.filter((m: string) => !oldModels.includes(m));
    const removedModels = oldModels.filter((m: string) => !newModels.includes(m));

    if (addedModels.length > 0 || removedModels.length > 0) {
      console.log('');
      if (addedModels.length > 0) {
        console.log(`    new models: ${addedModels.join(', ')}`);
      }
      if (removedModels.length > 0) {
        console.log(`    removed models: ${removedModels.join(', ')}`);
      }
    }
  }
}

// =============================================================================
// PROFILE COMMAND (Runtime Telemetry - PRD Phase 2)
// =============================================================================

/**
 * Analyze runtime telemetry from events.jsonl file.
 * PRD Phase 2: `peakinfer profile --events events.jsonl`
 */
async function profile(
  eventsFile: string,
  options: { clusterMethod?: 'semantic' | 'cost' | 'latency'; outputFile?: string } = {}
): Promise<void> {
  const eventsPath = path.resolve(eventsFile);

  if (!fs.existsSync(eventsPath)) {
    console.error(`error: events file not found: ${eventsPath}`);
    process.exit(1);
  }

  try {
    console.log(`
peakinfer profile
─────────────────────────────────────────────────────────────────

  analyzing runtime telemetry from: ${eventsFile}
`);

    const result = await profileEvents(eventsPath, {
      clusterMethod: options.clusterMethod,
    });

    // Render summary
    renderProfileSummary(result);

    // Save output if requested
    if (options.outputFile) {
      const outputPath = path.resolve(options.outputFile);
      fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');
      console.log(`\n  output saved: ${outputPath}`);
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`  error analyzing events: ${errorMessage}`);
    process.exit(1);
  }
}

/**
 * Render profile results to console
 */
function renderProfileSummary(result: ProfileResult): void {
  const { summary, hotspots, optimizations, workloadClusters, monthlyProjection } = result;

  // Summary box
  console.log('┌─────────────────────────────────────────────────────────────────────┐');
  console.log('│                        RUNTIME TELEMETRY                            │');
  console.log('├─────────────────────────────────────────────────────────────────────┤');
  console.log(`│   Total Events: ${String(summary.total_events).padEnd(10)} Total Cost: $${summary.total_cost.toFixed(4).padEnd(12)}     │`);
  console.log(`│   Time Range: ${summary.time_range.start.slice(0, 10)} → ${summary.time_range.end.slice(0, 10)}              │`);
  console.log(`│   Avg Latency: ${summary.avg_latency_ms.toFixed(0)}ms                                          │`);
  console.log('└─────────────────────────────────────────────────────────────────────┘');
  console.log('');

  // Cost by Provider
  console.log('┌─────────────────────────────────────────────────────────────────────┐');
  console.log('│                          COST BY PROVIDER                           │');
  console.log('├─────────────────────────────────────────────────────────────────────┤');
  for (const [provider, stats] of Object.entries(summary.by_provider)) {
    const pct = summary.total_cost > 0 ? ((stats.cost / summary.total_cost) * 100).toFixed(0) : '0';
    console.log(`│   ${provider.padEnd(20)} ${String(stats.count).padEnd(6)} calls  $${stats.cost.toFixed(4).padStart(10)}  (${pct.padStart(3)}%)  │`);
  }
  console.log('└─────────────────────────────────────────────────────────────────────┘');
  console.log('');

  // Cost by Model
  console.log('┌─────────────────────────────────────────────────────────────────────┐');
  console.log('│                           COST BY MODEL                             │');
  console.log('├─────────────────────────────────────────────────────────────────────┤');
  const sortedModels = Object.entries(summary.by_model)
    .sort((a, b) => b[1].cost - a[1].cost)
    .slice(0, 10);
  for (const [model, stats] of sortedModels) {
    const shortModel = model.length > 30 ? model.slice(0, 27) + '...' : model;
    console.log(`│   ${shortModel.padEnd(30)} ${String(stats.count).padEnd(5)} calls  $${stats.cost.toFixed(4).padStart(10)}   │`);
  }
  if (Object.keys(summary.by_model).length > 10) {
    console.log(`│   ... and ${Object.keys(summary.by_model).length - 10} more models                                     │`);
  }
  console.log('└─────────────────────────────────────────────────────────────────────┘');
  console.log('');

  // Cost by Intent
  console.log('┌─────────────────────────────────────────────────────────────────────┐');
  console.log('│                          COST BY INTENT                             │');
  console.log('├─────────────────────────────────────────────────────────────────────┤');
  const sortedIntents = Object.entries(summary.by_intent)
    .sort((a, b) => b[1].cost - a[1].cost)
    .slice(0, 8);
  for (const [intent, stats] of sortedIntents) {
    const shortIntent = intent.length > 25 ? intent.slice(0, 22) + '...' : intent;
    console.log(`│   ${shortIntent.padEnd(25)} ${String(stats.count).padEnd(5)} calls  $${stats.cost.toFixed(4).padStart(10)}        │`);
  }
  console.log('└─────────────────────────────────────────────────────────────────────┘');
  console.log('');

  // Hotspots
  if (hotspots.length > 0) {
    console.log('┌─────────────────────────────────────────────────────────────────────┐');
    console.log('│                             HOTSPOTS                                │');
    console.log('├─────────────────────────────────────────────────────────────────────┤');
    for (const hotspot of hotspots.slice(0, 5)) {
      const shortModel = hotspot.model.length > 25 ? hotspot.model.slice(0, 22) + '...' : hotspot.model;
      console.log(`│   ${shortModel.padEnd(25)} ${hotspot.costPercentage.toFixed(1).padStart(5)}% of cost               │`);
      console.log(`│     └─ ${hotspot.intent.padEnd(20)} ${hotspot.callCount} calls, $${hotspot.totalCost.toFixed(4)}       │`);
    }
    console.log('└─────────────────────────────────────────────────────────────────────┘');
    console.log('');
  }

  // Optimization Suggestions
  if (optimizations.length > 0) {
    console.log('┌─────────────────────────────────────────────────────────────────────┐');
    console.log('│                      OPTIMIZATION SUGGESTIONS                       │');
    console.log('├─────────────────────────────────────────────────────────────────────┤');
    for (const opt of optimizations.slice(0, 5)) {
      const icon = opt.type === 'model_swap' ? '↔' : opt.type === 'caching' ? '⚡' : opt.type === 'batching' ? '📦' : '🔀';
      console.log(`│   ${icon} ${opt.description.slice(0, 60).padEnd(60)}   │`);
      console.log(`│      Est. savings: $${opt.estimatedSavings.toFixed(2)} (${opt.estimatedSavingsPercent.toFixed(0)}%) | Effort: ${opt.effort.padEnd(6)}     │`);
    }
    console.log('└─────────────────────────────────────────────────────────────────────┘');
    console.log('');
  }

  // Monthly Projection
  console.log('┌─────────────────────────────────────────────────────────────────────┐');
  console.log('│                       MONTHLY PROJECTION                            │');
  console.log('├─────────────────────────────────────────────────────────────────────┤');
  console.log(`│   Current projected:       $${monthlyProjection.currentMonthly.toFixed(2).padStart(10)}/month                  │`);
  console.log(`│   With optimizations:      $${monthlyProjection.withOptimizations.toFixed(2).padStart(10)}/month                  │`);
  console.log(`│   Potential savings:       ${monthlyProjection.savingsPercent.toFixed(0).padStart(3)}%                                     │`);
  console.log('└─────────────────────────────────────────────────────────────────────┘');
  console.log('');
}

// =============================================================================
// RUNTIME TELEMETRY INTEGRATION RENDERERS
// =============================================================================

/**
 * Render runtime telemetry summary within analyze output
 * Shows actual costs and model usage from events.jsonl
 */
function renderRuntimeTelemetrySummary(
  result: ProfileResult,
  modelStats: { total: number; dynamic: number }
): void {
  const { summary, optimizations, monthlyProjection } = result;

  // Runtime vs Static comparison header
  console.log('┌─────────────────────────────────────────────────────────────────────┐');
  console.log('│                    ACTUAL RUNTIME COSTS                             │');
  console.log('├─────────────────────────────────────────────────────────────────────┤');
  console.log(`│   Events analyzed:    ${String(summary.total_events).padEnd(10)}                             │`);
  console.log(`│   Total runtime cost: $${summary.total_cost.toFixed(4).padEnd(12)}                           │`);
  console.log(`│   Avg latency:        ${summary.avg_latency_ms.toFixed(0)}ms                                   │`);
  console.log('└─────────────────────────────────────────────────────────────────────┘');
  console.log('');

  // Model resolution comparison
  if (modelStats.dynamic > 0) {
    const resolved = Object.keys(summary.by_model).length;
    console.log('┌─────────────────────────────────────────────────────────────────────┐');
    console.log('│                    MODEL RESOLUTION                                 │');
    console.log('├─────────────────────────────────────────────────────────────────────┤');
    console.log(`│   Static analysis:  ${modelStats.dynamic}/${modelStats.total} runtime-configured (${((modelStats.dynamic / modelStats.total) * 100).toFixed(0)}%)      │`);
    console.log(`│   Runtime data:     ${resolved} distinct models identified                 │`);
    console.log('└─────────────────────────────────────────────────────────────────────┘');
    console.log('');
  }

  // Top models by actual cost
  console.log('┌─────────────────────────────────────────────────────────────────────┐');
  console.log('│                    TOP MODELS (BY ACTUAL COST)                      │');
  console.log('├─────────────────────────────────────────────────────────────────────┤');
  const sortedModels = Object.entries(summary.by_model)
    .sort((a, b) => b[1].cost - a[1].cost)
    .slice(0, 5);
  for (const [model, stats] of sortedModels) {
    const shortModel = model.length > 35 ? model.slice(0, 32) + '...' : model;
    const pct = summary.total_cost > 0 ? ((stats.cost / summary.total_cost) * 100).toFixed(0) : '0';
    console.log(`│   ${shortModel.padEnd(35)} $${stats.cost.toFixed(4).padStart(8)} (${pct.padStart(2)}%)  │`);
  }
  console.log('└─────────────────────────────────────────────────────────────────────┘');
  console.log('');

  // Top optimization suggestions from runtime data
  if (optimizations.length > 0) {
    console.log('┌─────────────────────────────────────────────────────────────────────┐');
    console.log('│                    RUNTIME-INFORMED OPTIMIZATIONS                   │');
    console.log('├─────────────────────────────────────────────────────────────────────┤');
    for (const opt of optimizations.slice(0, 3)) {
      const icon = opt.type === 'model_swap' ? '↔' : opt.type === 'caching' ? '⚡' : opt.type === 'batching' ? '📦' : '🔀';
      const desc = opt.description.length > 58 ? opt.description.slice(0, 55) + '...' : opt.description;
      console.log(`│   ${icon} ${desc.padEnd(60)}   │`);
      console.log(`│      Savings: $${opt.estimatedSavings.toFixed(2)}/mo (${opt.estimatedSavingsPercent.toFixed(0)}%)                                   │`);
    }
    console.log('└─────────────────────────────────────────────────────────────────────┘');
    console.log('');
  }

  // Monthly projection summary
  console.log('┌─────────────────────────────────────────────────────────────────────┐');
  console.log('│                    MONTHLY PROJECTION                               │');
  console.log('├─────────────────────────────────────────────────────────────────────┤');
  console.log(`│   Current:          $${monthlyProjection.currentMonthly.toFixed(2).padStart(10)}/month                         │`);
  console.log(`│   With optimizations: $${monthlyProjection.withOptimizations.toFixed(2).padStart(8)}/month (save ${monthlyProjection.savingsPercent.toFixed(0)}%)            │`);
  console.log('└─────────────────────────────────────────────────────────────────────┘');
  console.log('');
}

/**
 * Render suggestion to add telemetry when many models are runtime-configured
 */
function renderTelemetrySuggestion(
  modelStats: { total: number; dynamic: number },
  root: string
): void {
  const dynamicPercent = ((modelStats.dynamic / modelStats.total) * 100).toFixed(0);

  console.log('');
  console.log('┌─────────────────────────────────────────────────────────────────────┐');
  console.log('│                    TELEMETRY RECOMMENDATION                         │');
  console.log('├─────────────────────────────────────────────────────────────────────┤');
  console.log(`│   ${modelStats.dynamic}/${modelStats.total} callsites (${dynamicPercent}%) use runtime-configured models        │`);
  console.log('│                                                                     │');
  console.log('│   These models are loaded from env vars, config files, or           │');
  console.log('│   variables - static analysis can\'t determine the actual model.     │');
  console.log('│                                                                     │');
  console.log('│   For accurate cost analysis, add runtime telemetry:                │');
  console.log('│                                                                     │');
  console.log('│   1. Log inference events to events.jsonl:                          │');
  console.log('│      { "id": "...", "ts": "...", "model": "gpt-4o", ... }           │');
  console.log('│                                                                     │');
  console.log('│   2. Re-run: peakinfer analyze .                                    │');
  console.log('│      (auto-detects events.jsonl in your codebase)                   │');
  console.log('│                                                                     │');
  console.log('│   Or: peakinfer analyze . --events path/to/events.jsonl             │');
  console.log('│                                                                     │');
  console.log('│   Event schema: id, ts, intent, provider, model, input_tokens,      │');
  console.log('│                 output_tokens, latency_ms, cost_usd                 │');
  console.log('└─────────────────────────────────────────────────────────────────────┘');
  console.log('');

  // Write sample events.jsonl template
  const samplePath = path.join(root, 'events.jsonl.sample');
  if (!fs.existsSync(samplePath)) {
    const sampleContent = [
      '{"id": "evt_001", "ts": "2024-12-11T10:00:00Z", "intent": "chat_completion", "provider": "openai", "model": "gpt-4o", "input_tokens": 500, "output_tokens": 400, "latency_ms": 1200, "cost_usd": 0.0175, "endpoint": "api.openai.com", "region": "us-east-1", "tenant": "dev"}',
      '{"id": "evt_002", "ts": "2024-12-11T10:01:00Z", "intent": "embedding", "provider": "openai", "model": "text-embedding-3-small", "input_tokens": 1000, "output_tokens": 0, "latency_ms": 150, "cost_usd": 0.00002, "endpoint": "api.openai.com", "region": "us-east-1", "tenant": "dev"}',
    ].join('\n') + '\n';
    try {
      fs.writeFileSync(samplePath, sampleContent, 'utf-8');
      console.log(`  Created sample template: ${path.basename(samplePath)}`);
      console.log('  Rename to events.jsonl and populate with your runtime data.');
      console.log('');
    } catch {
      // Silently fail if we can't write the sample
    }
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
// EXPORTS
// =============================================================================

// Export functions for use in other modules (interactive mode, etc.)
export { analyze, stackmap, pricing, diff, profile };

// =============================================================================
// CLI ENTRY POINT
// =============================================================================

/** Parse command line arguments and run */
function main(): void {
  const args = process.argv.slice(2);

  // Show help (PRD Section 9 commands only)
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
peakinfer — llm inference intelligence

usage:
  peakinfer analyze <path>              analyze codebase for LLM usage (static)
  peakinfer profile --events <file>     analyze runtime telemetry (events.jsonl)
  peakinfer stackmap                    show stackmap from previous analysis
  peakinfer pricing                     show pricing breakdown
  peakinfer diff <old.json> <new.json>  compare two analyses

analyze options:
  --html                      generate an html report
  --open                      open html report in browser

profile options:
  --events <file>             path to events.jsonl file (required)
  --cluster <method>          clustering method: semantic, cost, latency
  --output <file>             save profile report to file

pricing options:
  --detailed                  show detailed live pricing from LiteLLM
  --provider <name>           filter by provider (openai, anthropic, etc.)

stackmap options:
  --json                      output raw JSON
  --cached                    show cached stackmap even if stale

examples:
  peakinfer analyze .                      # static codebase analysis
  peakinfer profile --events events.jsonl  # runtime telemetry analysis
  peakinfer stackmap                       # view your inference map
  peakinfer pricing --detailed             # detailed cost breakdown
  peakinfer diff old.json new.json         # compare changes over time

environment:
  ANTHROPIC_API_KEY           required for analyze command
`);
    process.exit(0);
  }

  // Show version
  if (args.includes('--version') || args.includes('-v')) {
    console.log('peakinfer v0.95');
    process.exit(0);
  }

  // Parse options
  const options: AnalyzeOptions = {
    html: args.includes('--html') || args.includes('--open'),
    open: args.includes('--open'),
    detailed: args.includes('--detailed'),
  };

  // Filter out options to get positional args
  const positionalArgs = args.filter(arg => !arg.startsWith('--'));

  // Parse command
  const command = positionalArgs[0];

  if (command === 'analyze') {
    const targetPath = positionalArgs[1] || '.';
    analyze(targetPath, options);
  } else if (command === 'stackmap') {
    const stackmapOptions = {
      cached: args.includes('--cached'),
      json: args.includes('--json'),
    };
    stackmap(stackmapOptions);
  } else if (command === 'pricing') {
    const pricingOptions = {
      detailed: args.includes('--detailed'),
      provider: getArgValue(args, '--provider'),
    };
    pricing(pricingOptions);
  } else if (command === 'diff') {
    const oldFile = positionalArgs[1];
    const newFile = positionalArgs[2];
    if (!oldFile || !newFile) {
      console.error('error: diff requires two files');
      console.error('usage: peakinfer diff <old.json> <new.json>');
      process.exit(1);
    }
    diff(oldFile, newFile);
  } else if (command === 'profile') {
    const eventsFile = getArgValue(args, '--events');
    if (!eventsFile) {
      console.error('error: profile requires --events <file>');
      console.error('usage: peakinfer profile --events events.jsonl');
      process.exit(1);
    }
    const profileOptions = {
      clusterMethod: getArgValue(args, '--cluster') as 'semantic' | 'cost' | 'latency' | undefined,
      outputFile: getArgValue(args, '--output'),
    };
    profile(eventsFile, profileOptions);
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
