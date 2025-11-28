#!/usr/bin/env node

/**
 * PeakInfer CLI - SLC v1 Implementation
 * Single command: peakinfer analyze
 * Based on PRD v0.95 + Technical Design Document v1.1
 * 
 * Claude-First Semantic Detection + Template-Based Suggestions
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora, { Ora } from 'ora';
import fs from 'fs-extra';
import * as path from 'path';
import * as yaml from 'yaml';
import { fileURLToPath } from 'url';
import readline from 'node:readline';
import { APIKeyManager } from './utils/api-key-manager.js';
import { StackMapAnalyzer } from './core/stackmap-analyzer.js';
import { PricingEngine } from './core/pricing-engine.js';
import { TemplateManager } from './core/template-manager.js';
import { ReportGenerator } from './core/report-generator.js';
import { StackMap, AnalysisResult, CLIState } from './types/stackmap.js';
import type { OptimizationTemplate } from './types/template.js';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();
const apiKeyManager = new APIKeyManager();

// Version from package.json
const VERSION = '0.95.0';

/**
 * CLI Output Renderer - Implements Julie Zhuo Design Principles
 * States: Empty, Loading, Success, Error, Partial
 */
class CLIRenderer {
  private spinner: Ora | null = null;
  private verbose: boolean;

  constructor(verbose: boolean = false) {
    this.verbose = verbose;
  }

  log(...args: unknown[]) {
    if (this.verbose) {
      console.log(chalk.gray('[verbose]'), ...args);
    }
  }

  startSpinner(text: string): Ora {
    this.spinner = ora({ text, isEnabled: !this.verbose }).start();
    return this.spinner;
  }

  updateSpinner(text: string) {
    if (this.spinner) {
      this.spinner.text = text;
    }
  }

  succeedSpinner(text?: string) {
    if (this.spinner) {
      this.spinner.succeed(text);
    }
  }

  failSpinner(text?: string) {
    if (this.spinner) {
      this.spinner.fail(text);
    }
  }

  warnSpinner(text?: string) {
    if (this.spinner) {
      this.spinner.warn(text);
    }
  }

  /**
   * Render Empty State - No LLM calls detected
   */
  renderEmptyState(filesScanned: number, linesOfCode: number, languages: string[]) {
    console.log(chalk.blue.bold(`\nPeakInfer v${VERSION}\n`));
    console.log(`Scanned: ${chalk.cyan(filesScanned.toLocaleString())} files (${chalk.cyan(linesOfCode.toLocaleString())} LOC)`);
    console.log(`Languages: ${chalk.cyan(languages.join(', ') || 'None detected')}\n`);
    console.log(chalk.yellow('No LLM inference calls detected.\n'));
    console.log('Checked for:');
    console.log(`  ${chalk.gray('•')} OpenAI SDK         ${chalk.red('not found')}`);
    console.log(`  ${chalk.gray('•')} Anthropic SDK      ${chalk.red('not found')}`);
    console.log(`  ${chalk.gray('•')} LangChain          ${chalk.red('not found')}`);
    console.log(`  ${chalk.gray('•')} LlamaIndex         ${chalk.red('not found')}`);
    console.log(`  ${chalk.gray('•')} vLLM               ${chalk.red('not found')}`);
    console.log(`  ${chalk.gray('•')} Direct HTTP to inference APIs   ${chalk.red('not found')}`);
    console.log(chalk.gray('\nIf you expected LLM usage, check:'));
    console.log(chalk.gray('  → Dynamic imports or runtime-loaded modules'));
    console.log(chalk.gray('  → Environment-gated code paths'));
    console.log(chalk.gray('  → Vendored or renamed SDKs\n'));
    console.log('Nothing to map. Exiting.\n');
  }

  /**
   * Render Error State - API failure or other errors
   */
  renderErrorState(error: Error, apiKeySet: boolean) {
    console.log(chalk.blue.bold(`\nPeakInfer v${VERSION}\n`));
    console.log(`Connecting to Claude Code SDK...    ${chalk.red('✗')}\n`);
    console.log(chalk.red('Error:'), error.message, '\n');
    console.log('Possible causes:');
    console.log(chalk.gray('  → No internet connection'));
    if (!apiKeySet) {
      console.log(chalk.yellow('  → ANTHROPIC_API_KEY not set or invalid'));
    }
    console.log(chalk.gray('  → API rate limit exceeded'));
    console.log(chalk.gray('\nSet your API key:'));
    console.log(chalk.cyan('  export ANTHROPIC_API_KEY=sk-ant-...\n'));
    console.log('Cached StackMaps remain available:');
    console.log(chalk.gray('  → peakinfer analyze --cached\n'));
  }

  /**
   * Render Partial State - Some files unparseable
   */
  renderPartialState(skippedFiles: { file: string; reason: string }[]) {
    if (skippedFiles.length > 0) {
      console.log(chalk.yellow(`\nSkipped: ${skippedFiles.length} files (parse errors)`));
      for (const { file, reason } of skippedFiles.slice(0, 5)) {
        console.log(chalk.gray(`  └─ ${file}        ${reason}`));
      }
      if (skippedFiles.length > 5) {
        console.log(chalk.gray(`  └─ ... and ${skippedFiles.length - 5} more`));
      }
      console.log(chalk.yellow('\nWarning: Skipped files may contain undetected LLM calls.'));
    }
  }

  /**
   * Render Success State - Full StackMap with pricing
   */
  renderSuccessState(result: AnalysisResult) {
    const { stackmap, pricing, suggestions, metadata } = result;

    console.log(chalk.blue.bold(`\nPeakInfer v${VERSION}\n`));
    console.log(`Scanned: ${chalk.cyan(metadata.filesScanned.toLocaleString())} files (${chalk.cyan(metadata.linesOfCode.toLocaleString())} LOC)`);
    console.log(`Languages: ${chalk.cyan(metadata.languages.join(', '))}\n`);
    console.log(chalk.green(`Found ${chalk.bold(stackmap.callsites.length)} inference callsites across ${chalk.bold(metadata.filesWithCalls)} files.\n`));

    // StackMap Box
    this.renderStackMapBox(stackmap);

    // Pricing Summary
    if (pricing) {
      this.renderPricingSummary(pricing);
    }

    // Hotspots
    if (suggestions && suggestions.length > 0) {
      this.renderHotspots(suggestions);
    }

    // Output files
    console.log(chalk.gray('\nOutput saved:'));
    console.log(chalk.gray('  → stackmap.json'));
    console.log(chalk.gray('  → pricing.json'));
    console.log(chalk.gray('  → peakinfer-report.html\n'));
  }

  private renderStackMapBox(stackmap: StackMap) {
    const boxWidth = 65;
    const border = '─'.repeat(boxWidth);
    
    console.log(chalk.cyan(`┌${border}┐`));
    console.log(chalk.cyan(`│${this.centerText('STACKMAP', boxWidth)}│`));
    console.log(chalk.cyan(`├${border}┤`));
    
    // Callsites
    console.log(chalk.cyan(`│${this.padText('', boxWidth)}│`));
    console.log(chalk.cyan(`│${this.padText(`  CALLSITES (${stackmap.callsites.length})`, boxWidth)}│`));
    for (const callsite of stackmap.callsites.slice(0, 5)) {
      const info = `     ├──► ${path.basename(callsite.file)}:${callsite.line}  ${callsite.model || 'unknown'}, ${callsite.patterns.join(', ') || 'default'}`;
      console.log(chalk.cyan(`│${this.padText(info.substring(0, boxWidth - 2), boxWidth)}│`));
    }
    if (stackmap.callsites.length > 5) {
      console.log(chalk.cyan(`│${this.padText(`     └──► ... ${stackmap.callsites.length - 5} more (see stackmap.json)`, boxWidth)}│`));
    }

    // Models
    console.log(chalk.cyan(`│${this.padText('', boxWidth)}│`));
    console.log(chalk.cyan(`├${border}┤`));
    console.log(chalk.cyan(`│${this.padText(`  MODELS (${stackmap.models.length})`, boxWidth)}│`));
    for (const model of stackmap.models.slice(0, 4)) {
      const info = `     ├──► ${model.name.padEnd(25)} ${model.callCount} calls   ~${this.formatTokens(model.estimatedTokensPerMonth)} tok/mo`;
      console.log(chalk.cyan(`│${this.padText(info.substring(0, boxWidth - 2), boxWidth)}│`));
    }

    // Vendors
    console.log(chalk.cyan(`│${this.padText('', boxWidth)}│`));
    console.log(chalk.cyan(`├${border}┤`));
    console.log(chalk.cyan(`│${this.padText(`  VENDORS / PROVIDERS (${stackmap.vendors.length})`, boxWidth)}│`));
    for (const vendor of stackmap.vendors.slice(0, 3)) {
      const info = `     ├──► ${vendor.name.padEnd(20)} ${vendor.callCount} calls   ${vendor.sdkType}`;
      console.log(chalk.cyan(`│${this.padText(info.substring(0, boxWidth - 2), boxWidth)}│`));
    }

    // Runtimes
    if (stackmap.runtimes.length > 0) {
      console.log(chalk.cyan(`│${this.padText('', boxWidth)}│`));
      console.log(chalk.cyan(`├${border}┤`));
      console.log(chalk.cyan(`│${this.padText(`  RUNTIMES (${stackmap.runtimes.length})`, boxWidth)}│`));
      for (const runtime of stackmap.runtimes.slice(0, 3)) {
        const info = `     ├──► ${runtime.name.padEnd(20)} ${runtime.vendor || 'unknown'}`;
        console.log(chalk.cyan(`│${this.padText(info.substring(0, boxWidth - 2), boxWidth)}│`));
      }
    }

    // Patterns Detected
    console.log(chalk.cyan(`│${this.padText('', boxWidth)}│`));
    console.log(chalk.cyan(`├${border}┤`));
    console.log(chalk.cyan(`│${this.padText('  PATTERNS DETECTED', boxWidth)}│`));
    const patterns = [
      { name: 'Retry logic', detected: stackmap.patterns.hasRetry },
      { name: 'Batching', detected: stackmap.patterns.hasBatching },
      { name: 'Streaming', detected: stackmap.patterns.hasStreaming },
      { name: 'Caching', detected: stackmap.patterns.hasCaching },
      { name: 'Router / model switching', detected: stackmap.patterns.hasRouting },
      { name: 'Fallback chain', detected: stackmap.patterns.hasFallback },
    ];
    for (const pattern of patterns) {
      const status = pattern.detected ? chalk.green('✓') : chalk.red('✗  not detected');
      const info = `     ├──► ${pattern.name.padEnd(25)} ${status}`;
      console.log(chalk.cyan(`│${this.padText(info.substring(0, boxWidth - 2), boxWidth)}│`));
    }

    console.log(chalk.cyan(`│${this.padText('', boxWidth)}│`));
    console.log(chalk.cyan(`└${border}┘`));
  }

  private renderPricingSummary(pricing: any) {
    const boxWidth = 65;
    const border = '─'.repeat(boxWidth);

    console.log(chalk.green(`\n┌${border}┐`));
    console.log(chalk.green(`│${this.centerText('PRICING SUMMARY', boxWidth)}│`));
    console.log(chalk.green(`├${border}┤`));
    console.log(chalk.green(`│${this.padText('', boxWidth)}│`));
    console.log(chalk.green(`│${this.padText(`  Estimated monthly cost: ${chalk.bold('$' + pricing.estimatedMonthlyCost.toLocaleString())} - $${pricing.estimatedMonthlyCostHigh.toLocaleString()}`, boxWidth)}│`));
    console.log(chalk.green(`│${this.padText('', boxWidth)}│`));
    
    // By vendor
    console.log(chalk.green(`│${this.padText('  By vendor:', boxWidth)}│`));
    for (const vendor of pricing.byVendor.slice(0, 3)) {
      const info = `     ├──► ${vendor.name.padEnd(15)} $${vendor.cost.toLocaleString().padEnd(12)} (${vendor.percentage}%)`;
      console.log(chalk.green(`│${this.padText(info, boxWidth)}│`));
    }
    console.log(chalk.green(`│${this.padText('', boxWidth)}│`));

    // Pricing deltas
    if (pricing.deltas && pricing.deltas.length > 0) {
      console.log(chalk.green(`│${this.padText('  Pricing deltas (since last sync):', boxWidth)}│`));
      for (const delta of pricing.deltas.slice(0, 2)) {
        const arrow = delta.change < 0 ? '↓' : '↑';
        const info = `     └──► ${delta.vendor} ${delta.model}  ${arrow}${Math.abs(delta.change)}%  (${delta.date})`;
        console.log(chalk.green(`│${this.padText(info, boxWidth)}│`));
      }
    }

    // Alternatives
    if (pricing.alternatives && pricing.alternatives.length > 0) {
      console.log(chalk.green(`│${this.padText('', boxWidth)}│`));
      console.log(chalk.green(`├${border}┤`));
      console.log(chalk.green(`│${this.padText('  ALTERNATIVE PRICING (same models, different providers)', boxWidth)}│`));
      for (const alt of pricing.alternatives.slice(0, 3)) {
        const info = `     ├──► ${alt.model} via ${alt.provider.padEnd(12)} $${alt.cost}/mo   (${alt.savings})`;
        console.log(chalk.green(`│${this.padText(info, boxWidth)}│`));
      }
    }

    console.log(chalk.green(`│${this.padText('', boxWidth)}│`));
    console.log(chalk.green(`└${border}┘`));
  }

  private renderHotspots(suggestions: any[]) {
    const boxWidth = 65;
    const border = '─'.repeat(boxWidth);

    console.log(chalk.yellow(`\n┌${border}┐`));
    console.log(chalk.yellow(`│${this.centerText('HOTSPOTS & SUGGESTIONS', boxWidth)}│`));
    console.log(chalk.yellow(`├${border}┤`));
    console.log(chalk.yellow(`│${this.padText('', boxWidth)}│`));

    for (const suggestion of suggestions.slice(0, 5)) {
      console.log(chalk.yellow(`│${this.padText(`  ⚠  ${suggestion.location}`, boxWidth)}│`));
      console.log(chalk.yellow(`│${this.padText(`     └─ ${suggestion.issue}`, boxWidth)}│`));
      console.log(chalk.yellow(`│${this.padText(`     └─ Suggestion: ${suggestion.recommendation}`, boxWidth)}│`));
      if (suggestion.templateId) {
        console.log(chalk.yellow(`│${this.padText(`     └─ Template: ${suggestion.templateId}`, boxWidth)}│`));
      }
      console.log(chalk.yellow(`│${this.padText('', boxWidth)}│`));
    }

    console.log(chalk.yellow(`└${border}┘`));
  }

  private centerText(text: string, width: number): string {
    const padding = Math.max(0, Math.floor((width - text.length) / 2));
    return ' '.repeat(padding) + text + ' '.repeat(width - padding - text.length);
  }

  private padText(text: string, width: number): string {
    const stripped = text.replace(/\x1b\[[0-9;]*m/g, ''); // Remove ANSI codes for length calc
    const padding = Math.max(0, width - stripped.length);
    return text + ' '.repeat(padding);
  }

  private formatTokens(tokens: number): string {
    if (tokens >= 1000000) return (tokens / 1000000).toFixed(1) + 'M';
    if (tokens >= 1000) return (tokens / 1000).toFixed(0) + 'K';
    return tokens.toString();
  }
}

class LineProgressBar {
  private hasRendered = false;
  private isActive = false;
  private lastFile = '';

  constructor(
    private label: string,
    private width = 10,
    private stream: NodeJS.WriteStream = process.stdout
  ) {}

  start() {
    if (this.isActive) return;
    this.isActive = true;
    this.render(0);
  }

  update(percentage: number, currentFile?: string) {
    if (!this.isActive) {
      this.start();
    }
    const numeric = typeof percentage === 'number' ? percentage : Number(percentage);
    const normalized = Number.isFinite(numeric) ? numeric : 0;
    this.render(Math.max(0, Math.min(100, Math.round(normalized))), currentFile);
  }

  complete(message?: string) {
    if (!this.isActive) return;
    this.replaceWithSummary(message || 'Scan complete');
  }

  fail(message?: string) {
    if (!this.isActive) return;
    this.replaceWithSummary(message || 'Scan interrupted');
  }

  private render(percentage: number, currentFile?: string) {
    if (currentFile) {
      this.lastFile = currentFile;
    }

    const filled = Math.floor((percentage / 100) * this.width);
    const empty = Math.max(0, this.width - filled);
    const bar = `${'█'.repeat(filled)}${'░'.repeat(empty)}`;
    const pctText = percentage.toString().padStart(3, ' ');
    const line1 = `${this.label.padEnd(30)} ${bar}  ${pctText}%`;
    const detail = this.lastFile
      ? `  └─ ${this.formatFile(this.lastFile)}`
      : '  └─ analyzing files...';
    this.writeLines(line1, detail);
  }

  private formatFile(filePath: string): string {
    const trimmed = filePath.length > 40 ? `…${filePath.slice(-39)}` : filePath;
    return `${trimmed.padEnd(40)} analyzing`;
  }

  private writeLines(line1: string, line2: string) {
    if (this.hasRendered) {
      readline.moveCursor(this.stream, 0, -2);
      readline.clearLine(this.stream, 0);
      readline.cursorTo(this.stream, 0);
    } else {
      this.hasRendered = true;
    }

    this.stream.write(line1 + '\n');
    readline.clearLine(this.stream, 0);
    readline.cursorTo(this.stream, 0);
    this.stream.write(line2 + '\n');
  }

  private replaceWithSummary(message: string) {
    if (this.hasRendered) {
      this.writeLines(`${this.label.padEnd(30)} ${message}`, '');
    } else {
      this.stream.write(`${this.label.padEnd(30)} ${message}\n\n`);
    }
    this.isActive = false;
    this.hasRendered = false;
  }
}

// =============================================================================
// MAIN ANALYZE COMMAND
// =============================================================================

program
  .name('peakinfer')
  .description(chalk.cyan('🔬 PeakInfer - Inference Intelligence Layer for AI Engineering Teams'))
  .version(VERSION)
  .option('-v, --verbose', 'Enable verbose logging for detailed output');

/**
 * Main analyze command - The only command you need
 * peakinfer analyze .
 */
program
  .command('analyze [path]')
  .description('🔬 Analyze codebase for LLM inference: detect callsites, map vendors, calculate costs')
  .option('--output <dir>', 'Output directory for reports', '.')
  .option('--format <formats>', 'Output formats: html,json,yaml', 'html,json')
  .option('--cached', 'Use cached StackMap if available')
  .option('--no-pricing', 'Skip pricing calculations')
  .option('--estimate-usage', 'Include token usage estimates (slower)')
  .action(async (targetPath: string = '.', options, command: Command) => {
    const verbose = command.optsWithGlobals().verbose || false;
    const renderer = new CLIRenderer(verbose);
    const scanProgress = new LineProgressBar('Scanning codebase...');
    
    console.log(chalk.blue.bold(`\n🔬 PeakInfer v${VERSION}`));
    console.log(chalk.gray('Inference Intelligence Layer\n'));

    let apiKey: string;
    
    try {
      // Check for API key
      renderer.startSpinner('Connecting to Claude Code SDK...');
      apiKey = await apiKeyManager.ensureAPIKey();
      renderer.succeedSpinner('Connected to Claude Code SDK');
      renderer.log('API key validated');
    } catch (error) {
      renderer.failSpinner('Failed to connect');
      const hasKey = await apiKeyManager.hasAPIKey();
      renderer.renderErrorState(error instanceof Error ? error : new Error(String(error)), hasKey);
      process.exit(1);
    }

    try {
      // Resolve path
      const codebasePath = path.resolve(targetPath);
      renderer.log('Analyzing codebase at:', codebasePath);

      if (!await fs.pathExists(codebasePath)) {
        console.error(chalk.red(`\n❌ Path not found: ${codebasePath}\n`));
        process.exit(1);
      }

      // Initialize components
      const analyzer = new StackMapAnalyzer(apiKey, { verbose });
      const pricingEngine = new PricingEngine();
      const templateManager = new TemplateManager(undefined, { quiet: !verbose });
      const reportGenerator = new ReportGenerator();

      const templatesPromise = (async () => {
        await templateManager.loadTemplates();
        return templateManager.listTemplates();
      })();
      console.log(chalk.gray('Templates: loading in background...'));

      // Run Claude-First Detection
      scanProgress.start();
      const stackmap = await analyzer.analyze(codebasePath, {
        estimateUsage: options.estimateUsage,
        onProgress: (progress) => {
          const percentageValue = typeof progress.percentage === 'number'
            ? progress.percentage
            : Number.parseFloat(progress.percentage ?? '0');
          const relativePath = progress.currentFile
            ? path.relative(codebasePath, progress.currentFile)
            : undefined;
          const displayPath = relativePath && !relativePath.startsWith('..')
            ? relativePath
            : progress.currentFile;
          scanProgress.update(percentageValue, displayPath);
          renderer.log(`Progress: ${progress.filesProcessed}/${progress.totalFiles} files`);
        }
      });
      scanProgress.complete(`Found ${stackmap.callsites.length} inference callsites`);

      let templates: OptimizationTemplate[];
      try {
        templates = await templatesPromise;
      } catch (templateError) {
        throw new Error(`Failed to load optimization templates: ${templateError instanceof Error ? templateError.message : String(templateError)}`);
      }
      renderer.log('Templates loaded:', templates.map(t => t.id).join(', '));
      console.log(chalk.gray(`Templates ready (${templates.length})`));

      // Check for empty state
      if (stackmap.callsites.length === 0) {
        renderer.renderEmptyState(
          stackmap.metadata.filesScanned,
          stackmap.metadata.linesOfCode,
          stackmap.metadata.languages
        );
        process.exit(0);
      }

      // Render partial state if needed
      if (stackmap.metadata.skippedFiles && stackmap.metadata.skippedFiles.length > 0) {
        renderer.renderPartialState(stackmap.metadata.skippedFiles);
      }

      // Calculate pricing
      let pricing = null;
      if (options.pricing !== false) {
        renderer.startSpinner('Calculating pricing...');
        pricing = await pricingEngine.calculatePricing(stackmap);
        renderer.succeedSpinner('Pricing calculated');
        renderer.log('Estimated monthly cost:', pricing.estimatedMonthlyCost);
      }

      // Match templates and generate suggestions
      renderer.startSpinner('Matching optimization templates...');
      const suggestions = await analyzer.generateSuggestions(stackmap, templates);
      renderer.succeedSpinner(`Generated ${suggestions.length} optimization suggestions`);
      renderer.log('Suggestions by template:', suggestions.map(s => s.templateId).filter(Boolean).join(', '));

      // Create analysis result
      const analysisResult: AnalysisResult = {
        stackmap,
        pricing,
        suggestions,
        metadata: {
          analyzedAt: new Date().toISOString(),
          codebasePath,
          filesScanned: stackmap.metadata.filesScanned,
          linesOfCode: stackmap.metadata.linesOfCode,
          languages: stackmap.metadata.languages,
          filesWithCalls: new Set(stackmap.callsites.map(c => c.file)).size,
          templatesMatched: suggestions.filter(s => s.templateId).length
        }
      };

      // Generate reports
      renderer.startSpinner('Generating reports...');
      const outputDir = path.resolve(options.output);
      await fs.ensureDir(outputDir);

      // Save stackmap.json
      await fs.writeJson(path.join(outputDir, 'stackmap.json'), stackmap, { spaces: 2 });
      
      // Save pricing.json
      if (pricing) {
        await fs.writeJson(path.join(outputDir, 'pricing.json'), pricing, { spaces: 2 });
      }

      // Generate HTML report
      const formats = options.format.split(',').map((f: string) => f.trim());
      if (formats.includes('html')) {
        const html = await reportGenerator.generateHTMLReport(analysisResult, templates);
        await fs.writeFile(path.join(outputDir, 'peakinfer-report.html'), html);
      }

      renderer.succeedSpinner('Reports generated');

      // Render success state
      renderer.renderSuccessState(analysisResult);

      // Open HTML report hint
      console.log(chalk.blue.bold('🚀 Next Steps:'));
      console.log(`  ${chalk.gray('└')} Open ${chalk.cyan('peakinfer-report.html')} in your browser for detailed analysis`);
      console.log(`  ${chalk.gray('└')} Review suggestions and implement quick wins first\n`);

    } catch (error) {
      scanProgress.fail('Scan interrupted');
      renderer.failSpinner('Analysis failed');
      console.error(chalk.red('\n❌ Error:'), error instanceof Error ? error.message : String(error));
      if (verbose && error instanceof Error && error.stack) {
        console.error(chalk.gray(error.stack));
      }
      process.exit(1);
    }
  });

/**
 * Config command - Manage API key
 */
program
  .command('config')
  .description('⚙️  Manage PeakInfer configuration')
  .option('--show', 'Show current configuration')
  .option('--set-key', 'Set Anthropic API key')
  .option('--clear-key', 'Clear saved API key')
  .action(async (options) => {
    if (options.show) {
      console.log(chalk.blue.bold(`\n⚙️  PeakInfer v${VERSION} Configuration\n`));
      const hasKey = await apiKeyManager.hasAPIKey();
      console.log(`  API Key: ${hasKey ? chalk.green('✓ Configured') : chalk.yellow('✗ Not configured')}`);
      console.log(`  Config File: ${chalk.gray(apiKeyManager.getConfigPath())}`);
      
      const templateManager = new TemplateManager();
      const stats = await templateManager.getCacheStats();
      console.log(`  Template Cache: ${stats.exists ? chalk.green(`✓ ${stats.template_count} templates`) : chalk.yellow('✗ Empty')}`);
      console.log();
    } else if (options.setKey) {
      await apiKeyManager.promptAndSaveAPIKey();
    } else if (options.clearKey) {
      await apiKeyManager.clearAPIKey();
    } else {
      console.log(chalk.yellow('\nUsage: peakinfer config [--show | --set-key | --clear-key]\n'));
    }
  });

// Default command is analyze
program
  .arguments('[path]')
  .action((targetPath) => {
    if (targetPath && !targetPath.startsWith('-')) {
      // If just a path is provided, run analyze
      program.parse(['node', 'peakinfer', 'analyze', targetPath, ...process.argv.slice(3)]);
    }
  });

// Parse and execute
program.parse();
