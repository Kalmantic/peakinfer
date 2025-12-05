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

// Multi-agent imports (lazy loaded for performance)
let MultiAgentOrchestrator: any;
let TemplateEngine: any;
let ReportGenerator: any;
let CodebaseCollector: any;

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
// MAIN ANALYZE FUNCTION
// =============================================================================

/** Options for analyze command */
interface AnalyzeOptions {
  html?: boolean;
  open?: boolean;
}

/**
 * Run the complete analysis pipeline using AI agents.
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
// DISCOVER COMMAND - Full Discovery with Collectors
// =============================================================================

/**
 * Run full discovery using collectors (codebase, snowflake, databricks, terraform)
 */
async function discover(targetPath: string, collectors: string[]): Promise<void> {
  if (!checkApiKey()) {
    process.exit(1);
  }

  const root = path.resolve(targetPath);
  if (!fs.existsSync(root)) {
    renderErrorState({
      code: 'INVALID_PATH',
      message: `Path does not exist: ${root}`,
      suggestion: 'Check the path and try again',
    });
    process.exit(1);
  }

  console.log(`
┌─────────────────────────────────────────────────────────────┐
│  peakinfer discover — full infrastructure analysis          │
└─────────────────────────────────────────────────────────────┘
`);

  try {
    // Lazy load multi-agent modules
    const core = await import('../core/multi-agent-orchestrator.js');
    MultiAgentOrchestrator = core.MultiAgentOrchestrator;

    const orchestrator = new MultiAgentOrchestrator();

    console.log(`  📁 Target: ${root}`);
    console.log(`  🔌 Collectors: ${collectors.join(', ')}`);
    console.log('');

    // Run discovery
    const result = await orchestrator.runDiscovery({
      codebasePath: root,
      collectors,
      outputPath: root,
    });

    // Print summary
    console.log('\n  ✅ Discovery complete\n');
    console.log(`  📊 Events collected: ${result.totalEvents || 0}`);
    console.log(`  💾 Output: ${path.join(root, 'events.jsonl')}`);
    console.log(`  💰 Estimated monthly cost: $${(result.estimatedMonthlyCost || 0).toLocaleString()}`);
    console.log('');
    console.log('  next steps:');
    console.log('    peakinfer profile events.jsonl    # cluster workloads');
    console.log('    peakinfer plan                    # create optimization plan');
    console.log('');

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    renderErrorState({
      code: 'API_ERROR',
      message: errorMessage,
      suggestion: 'Check your API key and network connection',
    });
    process.exit(1);
  }
}

// =============================================================================
// PROFILE COMMAND - Workload Profiling
// =============================================================================

/**
 * Profile inference workloads from events file
 */
async function profile(eventsFile: string): Promise<void> {
  if (!checkApiKey()) {
    process.exit(1);
  }

  const eventsPath = path.resolve(eventsFile);
  if (!fs.existsSync(eventsPath)) {
    renderErrorState({
      code: 'INVALID_PATH',
      message: `Events file not found: ${eventsPath}`,
      suggestion: 'Run "peakinfer discover" first to generate events.jsonl',
    });
    process.exit(1);
  }

  console.log(`
┌─────────────────────────────────────────────────────────────┐
│  peakinfer profile — workload clustering                    │
└─────────────────────────────────────────────────────────────┘
`);

  try {
    const core = await import('../core/multi-agent-orchestrator.js');
    MultiAgentOrchestrator = core.MultiAgentOrchestrator;

    const orchestrator = new MultiAgentOrchestrator();

    console.log(`  📄 Events file: ${eventsPath}`);
    console.log('  🔍 Clustering workloads...');
    console.log('');

    const result = await orchestrator.runProfiling({
      eventsPath,
      clusterMethod: 'semantic',
    });

    console.log('\n  ✅ Profiling complete\n');
    console.log(`  📊 Workload clusters: ${result.clusters?.length || 0}`);
    console.log(`  🎯 Unique intents: ${result.uniqueIntents || 0}`);
    console.log('');

    if (result.clusters && result.clusters.length > 0) {
      console.log('  top workload clusters:');
      for (const cluster of result.clusters.slice(0, 5)) {
        console.log(`    • ${cluster.name}: ${cluster.eventCount} events, $${cluster.monthlyCost?.toFixed(0) || 0}/mo`);
      }
      console.log('');
    }

    console.log('  next step:');
    console.log('    peakinfer plan    # create optimization plan');
    console.log('');

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    renderErrorState({
      code: 'API_ERROR',
      message: errorMessage,
      suggestion: 'Check your events file format',
    });
    process.exit(1);
  }
}

// =============================================================================
// PLAN COMMAND - Optimization Planning
// =============================================================================

/**
 * Create optimization plan using templates
 */
async function plan(constraintsFile?: string): Promise<void> {
  if (!checkApiKey()) {
    process.exit(1);
  }

  console.log(`
┌─────────────────────────────────────────────────────────────┐
│  peakinfer plan — optimization planning                     │
└─────────────────────────────────────────────────────────────┘
`);

  try {
    const core = await import('../core/multi-agent-orchestrator.js');
    const templateMod = await import('../core/template-engine.js');
    MultiAgentOrchestrator = core.MultiAgentOrchestrator;
    TemplateEngine = templateMod.TemplateEngine;

    const orchestrator = new MultiAgentOrchestrator();
    const templateEngine = new TemplateEngine();

    console.log('  📋 Loading optimization templates...');
    await templateEngine.loadTemplates();

    const templates = templateEngine.listTemplates();
    console.log(`  ✅ Loaded ${templates.length} templates`);
    console.log('');

    if (constraintsFile) {
      console.log(`  📄 Constraints: ${constraintsFile}`);
    }

    console.log('  🧠 Creating optimization plan...');
    console.log('');

    const result = await orchestrator.runPlanning({
      templates,
      constraintsFile,
    });

    console.log('\n  ✅ Planning complete\n');
    console.log(`  📊 Optimization opportunities: ${result.opportunities?.length || 0}`);
    console.log(`  💰 Potential monthly savings: $${(result.totalPotentialSavings || 0).toLocaleString()}`);
    console.log('');

    if (result.opportunities && result.opportunities.length > 0) {
      console.log('  top opportunities:');
      for (const opp of result.opportunities.slice(0, 5)) {
        console.log(`    • ${opp.title}: $${opp.monthlySavings?.toFixed(0) || 0}/mo savings`);
      }
      console.log('');
    }

    console.log('  next step:');
    console.log('    peakinfer report --format html    # generate detailed report');
    console.log('');

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    renderErrorState({
      code: 'API_ERROR',
      message: errorMessage,
      suggestion: 'Check your API key and try again',
    });
    process.exit(1);
  }
}

// =============================================================================
// REPORT COMMAND - Multi-format Reports
// =============================================================================

/**
 * Generate reports in multiple formats
 */
async function report(format: string, outputDir: string): Promise<void> {
  console.log(`
┌─────────────────────────────────────────────────────────────┐
│  peakinfer report — generate optimization reports           │
└─────────────────────────────────────────────────────────────┘
`);

  try {
    const reportMod = await import('../core/report-generator.js');
    ReportGenerator = reportMod.ReportGenerator;

    const generator = new ReportGenerator();
    const resolvedOutput = path.resolve(outputDir);

    // Determine formats
    const formats: ('html' | 'markdown' | 'json')[] = format === 'all'
      ? ['html', 'markdown', 'json']
      : [format as 'html' | 'markdown' | 'json'];

    console.log(`  📁 Output directory: ${resolvedOutput}`);
    console.log(`  📄 Formats: ${formats.join(', ')}`);
    console.log('');

    // Check if we have discovery data
    const eventsPath = path.join(resolvedOutput, 'events.jsonl');
    const hasDiscoveryData = fs.existsSync(eventsPath);

    if (!hasDiscoveryData) {
      console.log('  ⚠️  No discovery data found');
      console.log('  Run "peakinfer discover ." first to generate data');
      console.log('');
      process.exit(1);
    }

    console.log('  📊 Generating reports...');

    // Generate placeholder report (would use actual data in full implementation)
    const result = await generator.generateReports(
      {
        summary: {
          totalOpportunities: 0,
          byLayer: {},
          byPriority: {},
          totalMonthlySavings: 0,
          totalAnnualSavings: 0,
          averageImplementationTime: 0,
          quickWins: [],
          strategicInitiatives: [],
        },
        suggestions: [],
        metadata: {
          generatedAt: new Date().toISOString(),
          totalSuggestions: 0,
          totalEstimatedSavings: 0,
          averageROI: 0,
          codebaseScanned: 'Yes',
        },
      },
      {
        metadata: { source: 'cli', timestamp: new Date().toISOString() },
        configSummary: {
          application: { runtimes: [], total_monthly_cost: 0 },
          serving: {},
          infrastructure: {},
        },
      } as any,
      {
        outputDir: resolvedOutput,
        formats,
        includeCodeSnippets: true,
        includeCharts: true,
      }
    );

    console.log('\n  ✅ Reports generated\n');
    for (const file of result.files) {
      console.log(`  📄 ${file}`);
    }
    console.log('');

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    renderErrorState({
      code: 'API_ERROR',
      message: errorMessage,
      suggestion: 'Check file permissions and try again',
    });
    process.exit(1);
  }
}

// =============================================================================
// TEMPLATES COMMAND - Browse Optimization Templates
// =============================================================================

/**
 * Browse and view optimization templates
 */
async function templates(subCommand: string, templateId?: string): Promise<void> {
  try {
    const templateMod = await import('../core/template-engine.js');
    TemplateEngine = templateMod.TemplateEngine;

    const engine = new TemplateEngine();
    await engine.loadTemplates();

    if (subCommand === 'list') {
      const allTemplates = engine.listTemplates();

      console.log(`
┌─────────────────────────────────────────────────────────────┐
│  peakinfer templates — optimization library                 │
└─────────────────────────────────────────────────────────────┘

  ${allTemplates.length} templates available
`);

      // Group by category
      const byCategory = new Map<string, any[]>();
      for (const t of allTemplates) {
        const cat = t.category || 'other';
        if (!byCategory.has(cat)) byCategory.set(cat, []);
        byCategory.get(cat)!.push(t);
      }

      for (const [category, temps] of byCategory) {
        console.log(`  ${category}:`);
        for (const t of temps.slice(0, 5)) {
          const savings = t.optimization?.expected_cost_reduction || 'varies';
          console.log(`    • ${t.id}: ${t.name} (${savings})`);
        }
        if (temps.length > 5) {
          console.log(`    ... and ${temps.length - 5} more`);
        }
        console.log('');
      }

      console.log('  usage:');
      console.log('    peakinfer templates info <template-id>    # view template details');
      console.log('');

    } else if (subCommand === 'info' && templateId) {
      const template = engine.getTemplate(templateId);

      if (!template) {
        console.log(`\n  ❌ Template not found: ${templateId}\n`);
        console.log('  Run "peakinfer templates list" to see available templates\n');
        process.exit(1);
      }

      console.log(`
┌─────────────────────────────────────────────────────────────┐
│  ${template.name}
└─────────────────────────────────────────────────────────────┘

  ID: ${template.id}
  Category: ${template.category}
  Confidence: ${((template.confidence || 0) * 100).toFixed(0)}%

  Description:
    ${template.description || 'No description'}

  Expected Impact:
    • Cost Reduction: ${template.optimization?.expected_cost_reduction || 'varies'}
    • Throughput: ${template.optimization?.expected_throughput_improvement || 'varies'}
    • Risk Level: ${template.optimization?.risk_level || 'medium'}
    • Effort: ${template.optimization?.effort_estimate || 'varies'}

  Implementation:
    Prerequisites: ${template.implementation?.prerequisites?.length || 0} items
    Automated Steps: ${template.implementation?.automated_steps?.length || 0} steps

  Economics:
    Implementation Cost: $${template.economics?.implementation_cost?.total_cost?.toLocaleString() || 0}
`);

    } else {
      console.log('\n  usage:');
      console.log('    peakinfer templates list              # list all templates');
      console.log('    peakinfer templates info <id>         # view template details\n');
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`\n  ❌ Error loading templates: ${errorMessage}\n`);
    process.exit(1);
  }
}

// =============================================================================
// RECOMMEND COMMAND - Codebase Analysis + Cost Optimization Recommendations
// =============================================================================

/**
 * Analyze codebase and generate optimization recommendations.
 *
 * Uses agent-based analysis (same as `analyze` command)
 * Flow: Agent Analysis → Recommender → Report
 */
async function recommend(targetPath: string, prioritize: 'cost' | 'latency' | 'balanced' = 'cost'): Promise<void> {
  if (!checkApiKey()) {
    process.exit(1);
  }

  const root = path.resolve(targetPath);
  if (!fs.existsSync(root)) {
    renderErrorState({
      code: 'INVALID_PATH',
      message: `Path does not exist: ${root}`,
      suggestion: 'Check the path and try again',
    });
    process.exit(1);
  }

  // Import progress utilities
  const { ProgressManager, createAnimatedMessage, theme } = await import('./progress.js');

  // Initialize progress manager
  const progress = new ProgressManager({
    showTime: true,
    color: true,
  });

  console.log(`
  ${theme.bold('peakinfer recommend')}
  ═══════════════════════════════════════════════════════════════
`);

  try {
    // Import modules
    const { analyzeWithAgent } = await import('./agent-analyzer.js');
    const { generateRecommendations, generateReport, detectRisks, generatePatternsReport, generateRiskReport } = await import('./recommender.js');

    // Start progress
    progress.start('Initializing recommendation engine...');
    progress.update(`Target: ${root}`, [`Priority: ${prioritize}`]);

    // Phase 1: Codebase Analysis
    progress.startStep('analyze', 'Analyzing codebase for LLM usage');

    // Scale maxTurns based on codebase size
    const { scan } = await import('./scanner.js');
    const { ProgressBar } = await import('./progress.js');

    // Scan with progress bar
    let progressBar: InstanceType<typeof ProgressBar> | null = null;

    const scanResult = await scan(root, {
      onProgress: (current, total, currentFile) => {
        // Initialize progress bar on first update
        if (!progressBar && total > 0) {
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

    const baseTurns = 30;
    const extraTurns = Math.ceil(scanResult.totalFiles / 25) * 5;
    const maxTurns = Math.min(baseTurns + extraTurns, 100);

    // Animated messages during analysis
    const messages = [
      'Scanning for API integrations...',
      'Detecting inference patterns...',
      'Analyzing cost distribution...',
      'Identifying optimization opportunities...',
    ];
    const animatedMsg = createAnimatedMessage(messages);
    animatedMsg.start(2500);

    const result = await analyzeWithAgent(root, {
      maxTurns,
      onProgress: (msg) => {
        progress.update(msg);
      },
    });

    animatedMsg.stop();

    const { callsites, techStack, patterns, totalCostUsd, durationMs } = result;

    progress.completeStep('analyze', 'success', `Found ${callsites.length} callsites`);

    if (callsites.length === 0) {
      progress.fail('No LLM callsites detected');
      console.log(`
  no OpenAI, Anthropic, or other LLM API calls found.

  check:
  - code uses LLM SDKs (openai, anthropic, langchain, etc.)
  - files are not in .gitignore
  - source files have supported extensions (.py, .ts, .js, .go, .java)
`);
      process.exit(0);
    }

    // Phase 2: Pattern Detection
    progress.startStep('patterns', 'Detecting inference patterns');

    // Show detected tech stack inline
    if (techStack) {
      const techDetails = [];
      if (techStack.application?.sdks?.length) {
        techDetails.push(`SDKs: ${techStack.application.sdks.join(', ')}`);
      }
      if (techStack.application?.frameworks?.length) {
        techDetails.push(`Frameworks: ${techStack.application.frameworks.join(', ')}`);
      }
      progress.update('Tech stack identified', techDetails);
    }

    progress.completeStep('patterns', 'success', 'Patterns analyzed');

    // Phase 3: Risk Assessment
    progress.startStep('risks', 'Assessing optimization risks');
    const riskAssessment = detectRisks(patterns, callsites);
    const riskLevel = (riskAssessment as any).overallRisk || 'low';
    const riskCount = riskAssessment.risks?.length || 0;
    progress.completeStep('risks', riskCount > 0 ? 'warning' : 'success',
      `${riskCount} risks identified (${riskLevel} overall)`);

    // Phase 4: Generate recommendations
    progress.startStep('recommendations', 'Generating optimization recommendations');
    const summary = generateRecommendations(callsites, prioritize);
    const recCount = summary.recommendations?.length || 0;
    const savings = (summary as any).totalSavings || (summary as any).totalPotentialSavings || 0;
    progress.completeStep('recommendations', 'success',
      `${recCount} recommendations, $${savings.toFixed(0)}/mo potential savings`);

    // Complete progress
    progress.succeed(`Analysis complete in ${(durationMs / 1000).toFixed(1)}s`);

    // Phase 5: Display results
    console.log('');
    console.log(generatePatternsReport(patterns));
    console.log(generateRiskReport(riskAssessment));
    console.log(generateReport(summary));

    // Write JSON output (include patterns and risks)
    const outputPath = path.join(root, 'peakinfer-recommendations.json');
    const fullReport = {
      ...summary,
      patterns,
      riskAssessment,
      techStack,
    };
    fs.writeFileSync(outputPath, JSON.stringify(fullReport, null, 2), 'utf-8');
    console.log(`\n  output: ${outputPath}\n`);

  } catch (error) {
    // Stop progress on error
    progress.fail('Recommendation analysis failed');

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Provide context-specific suggestions
    let suggestion = 'Check your ANTHROPIC_API_KEY and network connection';
    if (errorMessage.includes('error_max_turns')) {
      suggestion = 'The codebase is large. Try analyzing a subdirectory.';
    } else if (errorMessage.includes('rate_limit')) {
      suggestion = 'API rate limit reached. Wait a moment and try again.';
    }

    renderErrorState({
      code: 'API_ERROR',
      message: errorMessage,
      suggestion,
    });
    process.exit(1);
  }
}

// =============================================================================
// PRICES COMMAND - Show Pricing Data Source and List
// =============================================================================

/**
 * Show pricing data source and model prices.
 * Julie Zhuo aligned: transparency about data being used.
 */
async function prices(filterProvider?: string, refresh?: boolean): Promise<void> {
  try {
    // Import pricing fetcher
    const {
      getPricingInfo,
      refreshPricingCache,
      getGPUPricing,
      initializeGPUPricing,
      getGPUPricingInfo,
      refreshGPUPricingCache,
    } = await import('./pricing-fetcher.js');
    const { initPricingEngine } = await import('./pricing.js');

    // Optionally refresh cache
    if (refresh) {
      console.log('  refreshing pricing caches...');
      const [apiSuccess, gpuSuccess] = await Promise.all([
        refreshPricingCache(),
        refreshGPUPricingCache(),
      ]);
      if (apiSuccess) {
        console.log('  ✓ api pricing refreshed from LiteLLM');
      } else {
        console.log('  ✗ api pricing refresh failed, using cached');
      }
      if (gpuSuccess) {
        console.log('  ✓ gpu pricing refreshed from remote');
      } else {
        console.log('  ✗ gpu pricing refresh failed, using cached/static');
      }
      console.log('');
    }

    // Initialize pricing (both API and GPU)
    await initPricingEngine();
    await initializeGPUPricing();

    // Get pricing info
    const info = await getPricingInfo(filterProvider);

    console.log(`
peakinfer prices
─────────────────────────────────────────────────────────────────

  source: ${info.source}
  data:   ${info.sourceUrl}
  cache:  ${info.cacheFile}
  last updated: ${info.lastUpdated}
  total models: ${info.totalModels}
  providers: ${info.providers.join(', ')}
`);

    if (filterProvider) {
      console.log(`  filtered by: ${filterProvider}\n`);
    }

    // Show top models by provider (grouped)
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

    // Show limited models per provider (to keep output manageable)
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

    // GPU-Hour pricing section (neoclouds)
    const gpuInfo = getGPUPricingInfo();
    console.log('');
    console.log('  ─────────────────────────────────────────────────────────────');
    console.log('  gpu-hour pricing (converted to per-token equivalent):');
    console.log('  ─────────────────────────────────────────────────────────────');
    console.log(`  source: ${gpuInfo.source}`);
    console.log(`  data:   ${gpuInfo.sourceUrl}`);
    console.log(`  cache:  ${gpuInfo.cacheFile}`);
    console.log(`  last updated: ${gpuInfo.lastUpdated}`);
    console.log('');
    console.log('  provider          gpu               $/hr    input/1M  output/1M  model');
    console.log('  ─────────────────────────────────────────────────────────────');

    const gpuPricing = getGPUPricing(filterProvider);
    for (const gpu of gpuPricing) {
      const providerPad = gpu.provider.padEnd(16);
      const gpuPad = gpu.gpu.padEnd(16);
      const hourlyPad = gpu.hourlyRate > 0 ? `$${gpu.hourlyRate.toFixed(2)}`.padStart(6) : '   n/a';
      const inputPad = `$${gpu.inputPer1M.toFixed(2)}`.padStart(8);
      const outputPad = `$${gpu.outputPer1M.toFixed(2)}`.padStart(9);
      console.log(`  ${providerPad}  ${gpuPad} ${hourlyPad}  ${inputPad} ${outputPad}  ${gpu.model}`);
    }

    console.log('');
    console.log('  note: gpu-hour → token conversions assume ~50% utilization');

    // Staleness warning
    if (gpuInfo.staleProviders && gpuInfo.staleProviders.length > 0) {
      console.log('');
      console.log('  ⚠️  STALE PRICING WARNING');
      console.log(`  The following providers have not been verified in >4 weeks:`);
      console.log(`  ${gpuInfo.staleProviders.join(', ')}`);
      console.log('  Prices may be outdated. Please verify at provider websites.');
    }

    console.log('');
    console.log('  usage:');
    console.log('    peakinfer prices                      # show all providers (top 5 each)');
    console.log('    peakinfer prices openai               # filter by provider');
    console.log('    peakinfer prices modal                # show modal gpu pricing');
    console.log('    peakinfer prices --refresh            # refresh API pricing from LiteLLM');
    console.log('');

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`  error loading pricing data: ${errorMessage}`);
    process.exit(1);
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

// Export functions for use in other modules
export { analyze, recommend, discover, profile, plan, report, templates, prices };

// =============================================================================
// CLI ENTRY POINT
// =============================================================================

/** Parse command line arguments and run */
function main(): void {
  const args = process.argv.slice(2);

  // Show help
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
peakinfer — llm inference intelligence

usage:
  peakinfer analyze <path>         quick codebase analysis (recommended start)
  peakinfer recommend <path>       analyze + recommend cost optimizations
  peakinfer prices [provider]      show pricing data source and model prices
  peakinfer discover <path>        full discovery with collectors
  peakinfer profile <events.jsonl> profile inference workloads
  peakinfer plan [--constraints]   create optimization plan
  peakinfer report [--format html] generate reports
  peakinfer templates [list|info]  browse optimization templates
  peakinfer --help                 show this help

recommend options:
  --prioritize <mode>           cost (default), latency, or balanced

analyze options:
  --html                      generate an html report
  --open                      open html report in browser

prices options:
  --refresh                   refresh cache from LiteLLM

discover options:
  --collectors <list>         collectors to use (snowflake,databricks,terraform,codebase)
  --output <dir>              output directory for events.jsonl

report options:
  --format <fmt>              output format: html, markdown, json (default: all)
  --output <dir>              output directory

examples:
  peakinfer analyze .                        # quick start - analyze current directory
  peakinfer analyze ./my-project --html      # with html report
  peakinfer recommend ./my-project           # find cost optimization opportunities
  peakinfer recommend . --prioritize latency # prioritize latency over cost
  peakinfer prices openai                    # show openai model prices
  peakinfer prices --refresh                 # refresh pricing from LiteLLM
  peakinfer discover . --collectors codebase # full codebase discovery
  peakinfer templates list                   # list available templates
  peakinfer report --format html             # generate html report

environment:
  ANTHROPIC_API_KEY           required for analysis
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
  };

  // Filter out options to get positional args
  const positionalArgs = args.filter(arg => !arg.startsWith('--'));

  // Parse command
  const command = positionalArgs[0];

  if (command === 'analyze') {
    const targetPath = positionalArgs[1] || '.';
    analyze(targetPath, options);
  } else if (command === 'recommend') {
    const targetPath = positionalArgs[1] || '.';
    const prioritizeArg = getArgValue(args, '--prioritize') as 'cost' | 'latency' | 'balanced' | undefined;
    const prioritize = prioritizeArg || 'cost';
    recommend(targetPath, prioritize);
  } else if (command === 'discover') {
    const targetPath = positionalArgs[1] || '.';
    const collectors = getArgValue(args, '--collectors') || 'codebase';
    discover(targetPath, collectors.split(','));
  } else if (command === 'profile') {
    const eventsFile = positionalArgs[1];
    if (!eventsFile) {
      console.error('error: profile requires events file path');
      console.error('usage: peakinfer profile <events.jsonl>');
      process.exit(1);
    }
    profile(eventsFile);
  } else if (command === 'plan') {
    const constraintsFile = getArgValue(args, '--constraints');
    plan(constraintsFile);
  } else if (command === 'report') {
    const format = getArgValue(args, '--format') || 'all';
    const outputDir = getArgValue(args, '--output') || '.';
    report(format, outputDir);
  } else if (command === 'templates') {
    const subCommand = positionalArgs[1] || 'list';
    const templateId = positionalArgs[2];
    templates(subCommand, templateId);
  } else if (command === 'prices') {
    const filterProvider = positionalArgs[1];
    const refresh = args.includes('--refresh');
    prices(filterProvider, refresh);
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
