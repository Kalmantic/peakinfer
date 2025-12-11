#!/usr/bin/env node

/**
 * PeakInfer CLI - Complete Implementation
 * Multi-agent orchestration for LLM inference optimization
 * Based on PRD v0.7
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs-extra';
import * as path from 'path';
import * as yaml from 'yaml';
import { fileURLToPath } from 'url';
import { MultiAgentOrchestrator } from './core/multi-agent-orchestrator.js';
import { TemplateManager } from './core/template-manager.js';
import { SnowflakeCollector, DatabricksCollector, TerraformCollector, ManualCollector } from './collectors/index.js';
import { APIKeyManager } from './utils/api-key-manager.js';
import { OptimizationSuggester } from './core/optimization-suggester.js';
import { ReportGenerator } from './core/report-generator.js';
import { InferenceEvent } from './types/events.js';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();
const apiKeyManager = new APIKeyManager();

type GlobalCLIOptions = {
  verbose?: boolean;
};

const resolveGlobalOptions = (command?: Command): GlobalCLIOptions => {
  if (typeof command?.optsWithGlobals === 'function') {
    return command.optsWithGlobals() as GlobalCLIOptions;
  }
  return program.opts() as GlobalCLIOptions;
};

const isVerboseEnabled = (command?: Command): boolean => {
  return Boolean(resolveGlobalOptions(command).verbose);
};

const startSpinner = (text: string, verbose: boolean) => {
  return ora({ text, isEnabled: !verbose }).start();
};

const createVerboseLogger = (verbose: boolean) => {
  return (...args: unknown[]) => {
    if (verbose) {
      console.log(chalk.gray('[verbose]'), ...args);
    }
  };
};

const commandsSkippingAPIKeyPrompt = new Set(['config']);

program.hook('preAction', async (thisCommand) => {
  if (commandsSkippingAPIKeyPrompt.has(thisCommand.name())) {
    return;
  }

  try {
    await ensureAPIKey();
  } catch (error) {
    console.error(chalk.red('❌ Anthropic API key required:'), error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
});

/**
 * Ensure API key is configured before running commands
 */
async function ensureAPIKey(): Promise<string> {
  try {
    return await apiKeyManager.ensureAPIKey();
  } catch (error) {
    console.error(chalk.red('❌ Failed to get API key:'), error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

/**
 * Main discover command - Multi-agent orchestration entry point
 */
program
  .command('discover')
  .description('🔍 Discover optimization opportunities across your full LLM stack')
  .option('--input-dir <dir>', 'Directory with manual input files')
  .option('--codebase <path>', 'Path to codebase root for static code analysis (analyzes current directory if not specified)')
  .option('--collectors <collectors>', 'Comma-separated collector list', 'manual')
  .option('--output <file>', 'Save results to file')
.action(async (options, command: Command) => {
    const isVerbose = isVerboseEnabled(command);
    const verboseLog = createVerboseLogger(isVerbose);

    console.log(chalk.blue.bold('\n  peakinfer: multi-agent LLM optimization discovery\n'));
    console.log(chalk.gray('  using AI-powered multi-agent orchestration\n'));
    
    if (options.codebase) {
      console.log(chalk.cyan(`📂 Codebase scanning enabled: ${options.codebase}\n`));
    }

    const spinner = startSpinner('Starting discovery...', isVerbose);
    if (isVerbose) {
      verboseLog('Verbose logging enabled. Streaming detailed collector and agent output.');
    }

    try {
      // Ensure API key
      const apiKey = await ensureAPIKey();
      verboseLog('Anthropic API key initialized');

      // Initialize orchestrator
      const orchestrator = new MultiAgentOrchestrator(apiKey, { verbose: isVerbose });
      const inputFiles: string[] = [];

      // Run collectors
      const collectors = options.collectors.split(',').map((c: string) => c.trim());
      verboseLog('Collectors requested:', collectors);

      if (collectors.includes('snowflake')) {
        spinner.text = 'Collecting Snowflake inference data...';
        verboseLog('Collecting Snowflake inference data via SnowflakeCollector');
        const collector = new SnowflakeCollector();
        const events = await collector.collect();
        const eventsFile = 'snowflake-events.jsonl';
        await fs.writeFile(eventsFile, events.map(e => JSON.stringify(e)).join('\n'));
        inputFiles.push(eventsFile);
        verboseLog(`Snowflake collector produced ${events.length} events -> ${eventsFile}`);
      }

      if (collectors.includes('databricks')) {
        spinner.text = 'Collecting Databricks inference data...';
        verboseLog('Collecting Databricks inference data via DatabricksCollector');
        const collector = new DatabricksCollector();
        const events = await collector.collect();
        const eventsFile = 'databricks-events.jsonl';
        await fs.writeFile(eventsFile, events.map(e => JSON.stringify(e)).join('\n'));
        inputFiles.push(eventsFile);
        verboseLog(`Databricks collector produced ${events.length} events -> ${eventsFile}`);
      }

      if (collectors.includes('terraform')) {
        spinner.text = 'Collecting Terraform infrastructure config...';
        verboseLog('Collecting Terraform infrastructure via TerraformCollector');
        const collector = new TerraformCollector();
        const config = await collector.getInfrastructureConfig();
        const configFile = 'terraform-config.yaml';
        await fs.writeFile(configFile, yaml.stringify(config));
        inputFiles.push(configFile);
        verboseLog(`Terraform collector saved infrastructure config -> ${configFile}`);
      }

      if (collectors.includes('manual') && options.inputDir) {
        verboseLog(`Scanning manual input directory: ${options.inputDir}`);
        const manualFiles = await fs.readdir(options.inputDir);
        for (const file of manualFiles) {
          if (file.endsWith('.jsonl') || file.endsWith('.json') || file.endsWith('.yaml')) {
            inputFiles.push(path.join(options.inputDir, file));
            verboseLog(`Added manual input file: ${path.join(options.inputDir, file)}`);
          }
        }
      }

      // Add sample data if no inputs
      if (inputFiles.length === 0) {
        const sampleData = path.join(__dirname, '..', 'sample-data', 'sample-events.jsonl');
        if (await fs.pathExists(sampleData)) {
          inputFiles.push(sampleData);
          console.log(chalk.yellow('\n⚠️  No input data found, using sample data for demo\n'));
          verboseLog(`Using bundled sample data: ${sampleData}`);
        }
      }

      verboseLog('Final discovery input files:', inputFiles);

      // Run Discovery Agent (with optional codebase analysis)
      spinner.text = 'Running Discovery Agent...';
      const discoveryResult = await orchestrator.runDiscoveryAgent(inputFiles, options.codebase);
      spinner.succeed('Discovery complete');
      verboseLog('Discovery agent metadata:', discoveryResult.metadata);

      console.log(chalk.cyan('\n📊 Discovery Summary:'));
      console.log(`  Total Events Analyzed: ${discoveryResult.metadata.total_events_analyzed}`);
      console.log(`  Optimization Opportunities: ${discoveryResult.optimizationOpportunities.length}`);
      console.log(`  Application Throughput: ${discoveryResult.configSummary.application.total_monthly_throughput.toLocaleString()} tps/month`);
      console.log(`  Infrastructure Capacity: ${discoveryResult.configSummary.infrastructure.total_monthly_throughput.toLocaleString()} tps/month`);
      
      if (discoveryResult.codebaseInsights) {
        console.log(chalk.green('\n📝 Codebase Analysis:'));
        const metrics = discoveryResult.codebaseInsights.codeMetrics;
        console.log(`  Files Scanned: ${metrics?.totalFiles ?? 'n/a'}`);
        console.log(`  LLM API Calls Found: ${metrics?.totalLLMCalls ?? 'n/a'}`);
        console.log(`  Files with LLM Calls: ${metrics?.filesWithLLMCalls ?? 'n/a'}`);
        console.log(`  Caching Opportunities: ${discoveryResult.codebaseInsights.cachingOpportunities?.length ?? 0}`);
        console.log(`  Code Optimizations: ${discoveryResult.codebaseInsights.optimizationOpportunities?.length ?? 0}`);
      }

      if (options.output) {
        await fs.writeJson(options.output, discoveryResult, { spaces: 2 });
        console.log(chalk.gray(`\n✅ Results saved to ${options.output}`));
        verboseLog('Detailed discovery output persisted to file');
      }

      console.log(chalk.blue.bold('\n🚀 Next Steps:'));
      console.log(`  ${chalk.gray('└')} peakinfer plan - Generate optimization plan`);
      console.log(`  ${chalk.gray('└')} peakinfer templates - Browse available templates\n`);

    } catch (error) {
      spinner.fail('Discovery failed');
      console.error(chalk.red('\n❌ Error:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

/**
 * Profile command - Workload clustering
 */
program
  .command('profile')
  .description('📈 Profile inference workloads and cluster prompts')
  .option('--events <file>', 'Inference events file (jsonl/json)', 'events.jsonl')
  .option('--cluster-method <method>', 'Clustering method (semantic,intent,token)', 'semantic')
  .option('--output <file>', 'Save profile report to file', 'profile-report.yaml')
.action(async (options, command: Command) => {
    console.log(chalk.blue.bold('\n📈 PeakInfer: Workload Profiler\n'));

    const isVerbose = isVerboseEnabled(command);
    const verboseLog = createVerboseLogger(isVerbose);
    const spinner = startSpinner('Loading inference events...', isVerbose);
    verboseLog('Profiling command options:', options);

    let events: InferenceEvent[] = [];
    let eventsFileUsed = options.events;

    try {
      events = await loadEventsFromFile(options.events);
      spinner.succeed(`Loaded ${events.length} events from ${options.events}`);
      verboseLog(`Loaded ${events.length} events from ${options.events}`);
    } catch (error) {
      spinner.warn(`Failed to load ${options.events}: ${error instanceof Error ? error.message : String(error)}`);
      const sampleData = path.join(__dirname, '..', 'sample-data', 'sample-events.jsonl');
      if (await fs.pathExists(sampleData)) {
        spinner.start('Loading sample events...');
        events = await loadEventsFromFile(sampleData);
        eventsFileUsed = sampleData;
        spinner.succeed(`Loaded ${events.length} sample events`);
        verboseLog(`Fallback to sample events: ${sampleData} (${events.length} events)`);
      } else {
        spinner.fail('No inference events available to profile');
        process.exit(1);
      }
    }

    const apiKey = await ensureAPIKey();
    verboseLog('Anthropic API key initialized for profile command');
    const orchestrator = new MultiAgentOrchestrator(apiKey, { verbose: isVerbose });

    spinner.start('Profiling workloads...');
    try {
      const profile = await orchestrator.runProfileAgent(events, {
        clusterMethod: options.clusterMethod,
      });
      spinner.succeed('Profiling complete');
      verboseLog('Profile metadata:', profile.metadata);

      await fs.writeFile(options.output, yaml.stringify(profile), 'utf-8');
      console.log(chalk.gray(`\n🗂️  Profile saved to ${options.output}`));

      console.log(chalk.cyan('\n📊 Workload Profile Summary:'));
      console.log(`  Events Analyzed: ${profile.metadata.events_analyzed}`);
      console.log(`  Clusters: ${profile.metadata.total_clusters}`);
      console.log(`  Cluster Method: ${profile.metadata.cluster_method}`);
      if (profile.metadata.top_intents?.length) {
        console.log(`  Top Intents: ${profile.metadata.top_intents.join(', ')}`);
      }
      console.log(`  File Source: ${eventsFileUsed}`);

      if (profile.clusters?.length) {
        console.log(chalk.green('\n🏷️  Top Clusters:'));
        profile.clusters.slice(0, 3).forEach((cluster, index) => {
          console.log(`  ${index + 1}. ${chalk.bold(cluster.intent)} (${cluster.size} events)`);
          console.log(`     Throughput / request: ${cluster.throughput_per_request.toFixed(2)} tps | Model: ${cluster.dominant_model}`);
          console.log(`     Action: ${cluster.recommended_action}`);
        });
      }

      if (profile.samplePrompts?.length) {
        console.log(chalk.green('\n📝 Representative Prompts:'));
        profile.samplePrompts.slice(0, 3).forEach((sample) => {
          console.log(`  - ${sample.prompt.substring(0, 80)}${sample.prompt.length > 80 ? '…' : ''}`);
        });
      }

      if (profile.recommendations?.length) {
        console.log(chalk.green('\n💡 Recommendations:'));
        profile.recommendations.slice(0, 3).forEach((rec, index) => {
          console.log(`  ${index + 1}. (${rec.impact}) ${rec.description} — est. gain ${rec.estimated_gain.toLocaleString()} tps/month`);
        });
      }

      console.log(chalk.blue.bold('\n🚀 Next Steps:'));
      console.log(`  1. Review ${chalk.cyan(options.output)} for full profile details`);
      console.log('  2. Use clusters to select representative prompts');
      console.log(`  3. Run ${chalk.cyan('peakinfer suggest')} or ${chalk.cyan('peakinfer plan')} to continue optimization\n`);
    } catch (error) {
      spinner.fail('Profiling failed');
      console.error(chalk.red('\n❌ Error:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

/**
 * Plan command - Generate optimization plan
 */
program
  .command('plan')
  .description('📋 Generate comprehensive optimization plan')
  .option('--discovery <file>', 'Discovery results file', 'discovered.yaml')
  .option('--constraints <file>', 'Policy constraints file', 'policy.yaml')
  .option('--output <file>', 'Save plan to file')
.action(async (options, command: Command) => {
    console.log(chalk.blue.bold('\n📋 Generating Optimization Plan\n'));

    const isVerbose = isVerboseEnabled(command);
    const verboseLog = createVerboseLogger(isVerbose);
    const spinner = startSpinner('Loading discovery results...', isVerbose);
    verboseLog('Plan command options:', options);

    try {
      const apiKey = await ensureAPIKey();
      verboseLog('Anthropic API key initialized for planner');

      // Load discovery results
      let discoveryResult;
      if (await fs.pathExists(options.discovery)) {
        const content = await fs.readFile(options.discovery, 'utf-8');
        discoveryResult = yaml.parse(content);
        spinner.succeed('Discovery results loaded');
        verboseLog(`Discovery file loaded: ${options.discovery}`);
      } else {
        spinner.fail('Discovery results not found');
        console.log(chalk.yellow('\n⚠️  Run "peakinfer discover" first to generate discovery results\n'));
        return;
      }

      // Load templates
      spinner.start('Loading community templates...');
      const templateManager = new TemplateManager();
      await templateManager.loadTemplates();
      const templates = templateManager.listTemplates();
      spinner.succeed(`Loaded ${templates.length} templates`);
      verboseLog(`Templates available: ${templates.length}`);

      // Run Planner Agent
      spinner.start('Running Planner Agent...');
      const orchestrator = new MultiAgentOrchestrator(apiKey, { verbose: isVerbose });
      const plan = await orchestrator.runPlannerAgent(discoveryResult, templates);
      spinner.succeed('Optimization plan generated');
      verboseLog('Planner output metadata:', {
        applicationLayer: plan.applicationLayer.length,
        servingLayer: plan.servingLayer.length,
        infrastructureLayer: plan.infrastructureLayer.length,
        crossLayer: plan.crossLayerStrategies.length,
      });

      console.log(chalk.green.bold('\n💡 Optimization Plan Summary:\n'));
      console.log(`  ⚡ Estimated Monthly Performance Gain: ${chalk.green.bold(plan.estimatedGain.toLocaleString() + ' tps')}`);
      console.log(`  📊 Implementation Complexity: ${chalk.yellow(plan.implementationComplexity)}`);
      console.log(`  📈 ROI: ${chalk.cyan(plan.economicProjections.roi_percentage.toFixed(0) + '%')}`);
      console.log(`  ⏱️  Payback Period: ${chalk.blue(plan.economicProjections.payback_period_months.toFixed(1) + ' months')}`);
      console.log(`\n  Optimizations by Layer:`);
      console.log(`    Application: ${plan.applicationLayer.length}`);
      console.log(`    Serving: ${plan.servingLayer.length}`);
      console.log(`    Infrastructure: ${plan.infrastructureLayer.length}`);
      console.log(`    Cross-Layer: ${plan.crossLayerStrategies.length}`);

      if (options.output) {
        await fs.writeJson(options.output, plan, { spaces: 2 });
        console.log(chalk.gray(`\n✅ Plan saved to ${options.output}`));
        verboseLog(`Plan saved to ${options.output}`);
      }

      console.log(chalk.blue.bold('\n🚀 Next Steps:'));
      console.log(`  ${chalk.gray('└')} peakinfer run - Execute the optimization plan\n`);

    } catch (error) {
      spinner.fail('Planning failed');
      console.error(chalk.red('\n❌ Error:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

/**
 * Run command - Execute optimization plan
 */
program
  .command('run')
  .description('🏃 Execute optimization plan with evaluation')
  .option('--plan <file>', 'Optimization plan file', 'optimization-plan.yaml')
  .option('--sample-size <number>', 'Number of sample prompts for testing', '100')
  .option('--dry-run', 'Simulate execution without making changes')
.action(async (options, command: Command) => {
    console.log(chalk.blue.bold('\n🏃 Executing Optimization Plan\n'));

    const isVerbose = isVerboseEnabled(command);
    const verboseLog = createVerboseLogger(isVerbose);
    const spinner = startSpinner('Loading optimization plan...', isVerbose);
    verboseLog('Run command options:', options);

    try {
      const apiKey = await ensureAPIKey();
      verboseLog('Anthropic API key initialized for runner');

      // Load plan
      let plan;
      if (await fs.pathExists(options.plan)) {
        const content = await fs.readFile(options.plan, 'utf-8');
        plan = yaml.parse(content);
        spinner.succeed('Plan loaded');
        verboseLog(`Optimization plan loaded: ${options.plan}`);
      } else {
        spinner.fail('Plan not found');
        console.log(chalk.yellow('\n⚠️  Run "peakinfer plan" first to generate an optimization plan\n'));
        return;
      }

      if (options.dryRun) {
        console.log(chalk.yellow('\n🔬 DRY RUN MODE - No changes will be made\n'));
        verboseLog('Dry run enabled — execution will be simulated');
      }

      // Generate sample prompts (mock for now)
      const samplePrompts = Array.from({ length: parseInt(options.sampleSize) }, (_, i) => ({
        id: `sample-${i}`,
        prompt: `Sample prompt ${i}`,
      }));
      verboseLog(`Generated ${samplePrompts.length} sample prompts for evaluation`);

      // Run Runner/Evaluator Agent
      spinner.start('Running Runner/Evaluator Agent...');
      const orchestrator = new MultiAgentOrchestrator(apiKey, { verbose: isVerbose });
      const evaluation = await orchestrator.runRunnerEvaluator(plan, samplePrompts);
      spinner.succeed('Evaluation complete');
      verboseLog('Evaluation summary:', {
        baselineThroughput: evaluation.baseline.total_throughput,
        optimizedThroughput: evaluation.optimized.total_throughput,
        qualityPreserved: evaluation.qualityEvaluation.overall_quality_preserved,
      });

      console.log(chalk.green.bold('\n✅ Execution Results:\n'));
      console.log(`  🚀 Throughput Gain: ${(evaluation.optimized.total_throughput - evaluation.baseline.total_throughput).toLocaleString()} tps/month`);
      console.log(`  📊 Improvement: ${((evaluation.optimized.total_throughput / evaluation.baseline.total_throughput - 1) * 100).toFixed(1)}%`);
      console.log(`  ⚡ Latency P95: ${evaluation.optimized.latency_p95}ms (baseline: ${evaluation.baseline.latency_p95}ms)`);
      console.log(`  🎯 Quality Score: ${(evaluation.optimized.quality_score * 100).toFixed(1)}% (baseline: ${(evaluation.baseline.quality_score * 100).toFixed(1)}%)`);
      console.log(`  ✅ Quality Preserved: ${evaluation.qualityEvaluation.overall_quality_preserved ? 'Yes' : 'No'}`);

      console.log(chalk.blue.bold('\n🚀 Next Steps:'));
      console.log(`  ${chalk.gray('└')} peakinfer report - Generate final audit report\n`);

    } catch (error) {
      spinner.fail('Execution failed');
      console.error(chalk.red('\n❌ Error:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

/**
 * Report command - Generate final audit report
 */
program
  .command('report')
  .description('📊 Generate final audit report and implementation artifacts')
  .option('--evaluation <file>', 'Evaluation results file', 'evaluation-report.yaml')
  .option('--output-dir <dir>', 'Output directory for reports', 'reports')
  .option('--format <formats>', 'Output formats (html,csv,yaml)', 'html,yaml')
.action(async (options, command: Command) => {
    console.log(chalk.blue.bold('\n📊 Generating Audit Report\n'));

    const isVerbose = isVerboseEnabled(command);
    const verboseLog = createVerboseLogger(isVerbose);
    const spinner = startSpinner('Loading evaluation results...', isVerbose);
    verboseLog('Report command options:', options);

    try {
      const apiKey = await ensureAPIKey();
      verboseLog('Anthropic API key initialized for auditor');

      // Load evaluation results
      let evaluation;
      if (await fs.pathExists(options.evaluation)) {
        const content = await fs.readFile(options.evaluation, 'utf-8');
        evaluation = yaml.parse(content);
        spinner.succeed('Evaluation results loaded');
        verboseLog(`Evaluation file loaded: ${options.evaluation}`);
      } else {
        spinner.fail('Evaluation results not found');
        console.log(chalk.yellow('\n⚠️  Run "peakinfer run" first to execute the plan\n'));
        return;
      }

      // Run Auditor Agent
      spinner.start('Running Auditor Agent...');
      const orchestrator = new MultiAgentOrchestrator(apiKey, { verbose: isVerbose });
      const report = await orchestrator.runAuditorAgent(evaluation);
      spinner.succeed('Audit report generated');
      verboseLog('Audit report generated with executive summary:', report.executiveSummary);

      // Create output directory
      await fs.ensureDir(options.outputDir);
      verboseLog(`Ensured output directory: ${options.outputDir}`);

      // Generate reports in different formats
      const formats = options.format.split(',');
      
      if (formats.includes('yaml')) {
        await fs.writeFile(path.join(options.outputDir, 'audit-report.yaml'), yaml.stringify(report));
      }
      
      if (formats.includes('html')) {
        const html = await generateHTMLReport(report);
        await fs.writeFile(path.join(options.outputDir, 'audit-report.html'), html);
      }

      console.log(chalk.green.bold('\n✅ Audit Report Summary:\n'));
      console.log(`  🚀 Total Performance Gain: ${chalk.green.bold(report.executiveSummary.total_performance_gain.toLocaleString())} tps/month`);
      console.log(`  📊 Throughput Improvement: ${chalk.cyan(report.executiveSummary.throughput_improvement_percentage.toFixed(1) + '%')}`);
      console.log(`  📈 ROI: ${chalk.yellow(report.executiveSummary.roi_percentage.toFixed(0) + '%')}`);
      console.log(`  ⏱️  Payback Period: ${chalk.blue(report.executiveSummary.payback_period_months.toFixed(1) + ' months')}`);
      console.log(`  ✅ Quality Preserved: ${report.executiveSummary.quality_preserved ? 'Yes' : 'No'}`);
      console.log(`  🎯 Optimizations Applied: ${report.executiveSummary.optimizations_successful}/${report.executiveSummary.optimizations_applied}`);

      console.log(chalk.gray(`\n📁 Reports saved to ${options.outputDir}/`));
      console.log(chalk.gray(`📁 Implementation artifacts saved to implementation-artifacts/\n`));

    } catch (error) {
      spinner.fail('Report generation failed');
      console.error(chalk.red('\n❌ Error:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

/**
 * Templates command - Browse and search templates
 */
program
  .command('templates')
  .description('📋 Browse available optimization templates')
  .option('--category <category>', 'Filter by category')
  .option('--layer <layer>', 'Filter by layer (application, serving, infrastructure, cross-layer)')
  .option('--detailed', 'Show detailed information')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n📋 PeakInfer Optimization Templates\n'));

    try {
      const templateManager = new TemplateManager();
      await templateManager.loadTemplates();
      let templates = templateManager.listTemplates();

      if (options.category) {
        templates = templates.filter(t => t.category === options.category);
      }

      if (options.layer) {
        templates = templateManager.getTemplatesByLayer(options.layer);
      }

      // Group by category
      const byCategory: Record<string, typeof templates> = {};
      for (const template of templates) {
        if (!byCategory[template.category]) {
          byCategory[template.category] = [];
        }
        byCategory[template.category].push(template);
      }

      for (const [category, categoryTemplates] of Object.entries(byCategory)) {
        console.log(chalk.cyan.bold(`\n${category.toUpperCase().replace(/_/g, ' ')}:`));

        for (const template of categoryTemplates) {
          console.log(`\n  ${chalk.blue(template.id)}`);
          console.log(`    ${chalk.white(template.name)}`);
          console.log(`    ${chalk.gray(template.description)}`);
          console.log(`    Confidence: ${chalk.yellow((template.confidence * 100).toFixed(0) + '%')} | ` +
                     `Verified: ${template.success_count} | ` +
                     `Throughput Gain: ${template.optimization.expected_throughput_improvement || 'Variable'}`);

          if (options.detailed) {
            console.log(`    Effort: ${template.optimization.effort_estimate} | ` +
                       `Risk: ${template.optimization.risk_level}`);
          }
        }
      }

      console.log(chalk.blue(`\n📊 Total: ${templates.length} templates available\n`));

    } catch (error) {
      console.error(chalk.red('❌ Error loading templates:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

/**
 * Sync templates command
 */
program
  .command('sync-templates')
  .description('🔄 Sync templates from repository')
  .action(async () => {
    console.log(chalk.blue.bold('\n🔄 Syncing Templates\n'));

    try {
      const templateManager = new TemplateManager();
      await templateManager.syncTemplates();
      console.log(chalk.green('✅ Templates synced successfully\n'));
    } catch (error) {
      console.error(chalk.red('❌ Sync failed:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

/**
 * Validate command
 */
program
  .command('validate')
  .description('✅ Validate input data format')
  .option('--input <file>', 'Input file to validate')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n✅ Validating Input Data\n'));

    if (!options.input) {
      console.error(chalk.red('❌ --input flag required'));
      process.exit(1);
    }

    try {
      if (!await fs.pathExists(options.input)) {
        console.error(chalk.red(`❌ File not found: ${options.input}`));
        process.exit(1);
      }

      const content = await fs.readFile(options.input, 'utf-8');
      const ext = path.extname(options.input);

      if (ext === '.jsonl') {
        const lines = content.trim().split('\n');
        let valid = 0;
        let invalid = 0;

        for (const line of lines) {
          try {
            JSON.parse(line);
            valid++;
          } catch {
            invalid++;
          }
        }

        console.log(chalk.green(`✅ Valid JSONL events: ${valid}`));
        if (invalid > 0) {
          console.log(chalk.yellow(`⚠️  Invalid lines: ${invalid}`));
        }
      } else if (ext === '.json') {
        JSON.parse(content);
        console.log(chalk.green('✅ Valid JSON file'));
      } else if (ext === '.yaml' || ext === '.yml') {
        yaml.parse(content);
        console.log(chalk.green('✅ Valid YAML file'));
      }

      console.log(chalk.green('\n✅ Validation complete\n'));

    } catch (error) {
      console.error(chalk.red('❌ Validation failed:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

/**
 * Suggest command - Generate optimization suggestions
 */
program
  .command('suggest')
  .description('💡 Generate actionable optimization suggestions')
  .option('--discovery <file>', 'Discovery results file', 'discovered.yaml')
  .option('--format <formats>', 'Output formats (html,markdown,json)', 'html,markdown,json')
  .option('--output-dir <dir>', 'Output directory for reports', 'optimization-reports')
.action(async (options, command: Command) => {
    console.log(chalk.blue.bold('\n💡 PeakInfer: Optimization Suggestions\n'));

    const isVerbose = isVerboseEnabled(command);
    const verboseLog = createVerboseLogger(isVerbose);
    const spinner = startSpinner('Loading discovery results...', isVerbose);
    verboseLog('Suggest command options:', options);

    try {
      const apiKey = await ensureAPIKey();
      verboseLog('Anthropic API key initialized for suggestions');

      // Load discovery results
      if (!await fs.pathExists(options.discovery)) {
        spinner.fail('Discovery file not found');
        console.log(chalk.yellow('\n⚠️  Run "peakinfer discover" first\n'));
        return;
      }

      const content = await fs.readFile(options.discovery, 'utf-8');
      const discoveryResult = yaml.parse(content);
      spinner.succeed('Discovery results loaded');
      verboseLog(`Discovery file loaded: ${options.discovery}`);

      // Load templates
      spinner.start('Loading community templates...');
      const templateManager = new TemplateManager();
      await templateManager.loadTemplates();
      const templates = templateManager.listTemplates();
      spinner.succeed(`Loaded ${templates.length} templates`);
      verboseLog(`Templates available: ${templates.length}`);

      // Generate suggestions
      spinner.start('Generating optimization suggestions...');
      const suggester = new OptimizationSuggester(apiKey);
      const suggestionReport = await suggester.generateSuggestions({
        discoveryResult,
        codebaseAnalysis: discoveryResult.codebaseInsights,
        templates
      });
      spinner.succeed('Suggestions generated');
      verboseLog('Suggestion report summary:', suggestionReport.summary);

      // Generate reports
      spinner.start('Creating reports...');
      const reportGenerator = new ReportGenerator();
      const formats = options.format.split(',').map((f: string) => f.trim());
      const { files } = await reportGenerator.generateReports(
        suggestionReport,
        discoveryResult,
        {
          outputDir: options.outputDir,
          formats: formats as any,
          includeCodeSnippets: true
        }
      );
      spinner.succeed('Reports generated');
      verboseLog('Report files generated:', files);

      // Print summary
      console.log(chalk.green.bold('\n✨ Optimization Suggestions Summary:\n'));
      console.log(`  🚀 Total Performance Gain: ${chalk.green.bold(suggestionReport.summary.totalMonthlyGain.toLocaleString())} tps/month`);
      console.log(`  📊 Total Opportunities: ${suggestionReport.summary.totalOpportunities}`);
      console.log(`  🏆 Quick Wins: ${suggestionReport.summary.quickWins.length}`);
      console.log(`  📈 Average ROI: ${chalk.cyan(suggestionReport.metadata.averageROI.toFixed(0) + '%')}`);

      console.log(chalk.cyan('\n📑 Reports generated:'));
      for (const file of files) {
        console.log(`  ${chalk.gray('└')} ${file}`);
      }

      console.log(chalk.blue.bold('\n🚀 Next Steps:'));
      console.log(`  1. Review reports in ${chalk.cyan(options.outputDir)}/`);
      console.log(`  2. Start with quick wins (high ROI, low effort)`);
      console.log(`  3. Run ${chalk.cyan('peakinfer plan')} to create detailed implementation plan\n`);

    } catch (error) {
      spinner.fail('Suggestion generation failed');
      console.error(chalk.red('\n❌ Error:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

/**
 * Analyze command - All-in-one discovery + suggestions
 */
program
  .command('analyze')
  .description('🔬 Complete analysis: scan codebase + generate suggestions')
  .option('--codebase <path>', 'Path to codebase (default: current directory)', '.')
  .option('--events <file>', 'Runtime events file (optional)')
  .option('--output-dir <dir>', 'Output directory', 'peakinfer-analysis')
.action(async (options, command: Command) => {
    console.log(chalk.blue.bold('\n🔬 PeakInfer: Complete Analysis\n'));
    console.log(chalk.gray('Scanning codebase + generating optimization suggestions\n'));

    const isVerbose = isVerboseEnabled(command);
    const verboseLog = createVerboseLogger(isVerbose);
    const spinner = startSpinner('Starting analysis...', isVerbose);
    verboseLog('Analyze command options:', options);

    try {
      const apiKey = await ensureAPIKey();
      verboseLog('Anthropic API key initialized for analyze command');
      const orchestrator = new MultiAgentOrchestrator(apiKey, { verbose: isVerbose });

      // Prepare input files
      const inputFiles: string[] = [];
      if (options.events && await fs.pathExists(options.events)) {
        inputFiles.push(options.events);
        verboseLog(`Added runtime events file: ${options.events}`);
      } else {
        // Use sample data if available
        const sampleData = path.join(__dirname, '..', 'sample-data', 'sample-events.jsonl');
        if (await fs.pathExists(sampleData)) {
          inputFiles.push(sampleData);
          verboseLog(`Using bundled sample events: ${sampleData}`);
        }
      }

      verboseLog('Analysis input files:', inputFiles);

      // Run discovery with codebase
      spinner.text = 'Running discovery with codebase analysis...';
      const discoveryResult = await orchestrator.runDiscoveryAgent(inputFiles, options.codebase);
      spinner.succeed('Discovery complete');
      verboseLog('Discovery result metadata:', discoveryResult.metadata);

      // Load templates
      spinner.start('Loading community templates...');
      const templateManager = new TemplateManager();
      await templateManager.loadTemplates();
      const templates = templateManager.listTemplates();
      spinner.succeed(`Loaded ${templates.length} templates`);
      verboseLog(`Templates available: ${templates.length}`);

      // Generate suggestions
      spinner.start('Generating optimization suggestions...');
      const suggester = new OptimizationSuggester(apiKey);
      const suggestionReport = await suggester.generateSuggestions({
        discoveryResult,
        codebaseAnalysis: discoveryResult.codebaseInsights,
        templates
      });
      spinner.succeed('Suggestions generated');
      verboseLog('Suggestion summary:', suggestionReport.summary);

      // Generate reports
      spinner.start('Creating comprehensive reports...');
      await fs.ensureDir(options.outputDir);
      verboseLog(`Ensured output directory: ${options.outputDir}`);
      const reportGenerator = new ReportGenerator();
      const { files } = await reportGenerator.generateReports(
        suggestionReport,
        discoveryResult,
        {
          outputDir: options.outputDir,
          formats: ['html', 'markdown', 'json'],
          includeCodeSnippets: true,
          includeCharts: true
        }
      );
      spinner.succeed('Reports generated');
      verboseLog('Generated report files:', files);

      // Print comprehensive summary
      console.log(chalk.green.bold('\n✨ Analysis Complete!\n'));
      
      if (discoveryResult.codebaseInsights) {
        console.log(chalk.cyan('📝 Codebase Analysis:'));
        const metrics = discoveryResult.codebaseInsights.codeMetrics;
        console.log(`  Files Scanned: ${metrics?.totalFiles ?? 'n/a'}`);
        console.log(`  LLM API Calls: ${metrics?.totalLLMCalls ?? 'n/a'}`);
        console.log(`  Caching Opportunities: ${discoveryResult.codebaseInsights.cachingOpportunities?.length ?? 0}`);
        console.log(`  Code Optimizations: ${discoveryResult.codebaseInsights.optimizationOpportunities?.length ?? 0}`);
      }

      console.log(chalk.green('\n🚀 Performance Gain Opportunity:'));
      console.log(`  Monthly Gain: ${chalk.green.bold(suggestionReport.summary.totalMonthlyGain.toLocaleString())} tps`);
      console.log(`  Annual Gain: ${chalk.green.bold(suggestionReport.summary.totalAnnualGain.toLocaleString())} tps`);
      console.log(`  Total Opportunities: ${suggestionReport.summary.totalOpportunities}`);
      console.log(`  Quick Wins: ${suggestionReport.summary.quickWins.length}`);
      console.log(`  Average ROI: ${chalk.cyan(suggestionReport.metadata.averageROI.toFixed(0) + '%')}`);

      console.log(chalk.cyan('\n📑 Generated Reports:'));
      for (const file of files) {
        console.log(`  ${chalk.gray('└')} ${file}`);
      }

      console.log(chalk.blue.bold('\n🚀 Next Steps:'));
      console.log(`  1. Open ${chalk.cyan(path.join(options.outputDir, 'optimization-report.html'))} in your browser`);
      console.log(`  2. Review ${chalk.cyan(path.join(options.outputDir, 'OPTIMIZATION_GUIDE.md'))} for detailed guide`);
      console.log(`  3. Start with quick wins for immediate impact`);
      console.log(`  4. Run ${chalk.cyan('peakinfer plan')} to create implementation plan\n`);

    } catch (error) {
      spinner.fail('Analysis failed');
      console.error(chalk.red('\n❌ Error:'), error instanceof Error ? error.message : String(error));
      if (error instanceof Error && error.stack) {
        console.error(chalk.gray(error.stack));
      }
      process.exit(1);
    }
  });

/**
 * Config command - Manage configuration
 */
program
  .command('config')
  .description('⚙️  Manage PeakInfer configuration')
  .option('--show', 'Show current configuration')
  .option('--set-key', 'Set new API key')
  .option('--clear-key', 'Clear saved API key')
  .action(async (options) => {
    if (options.show) {
      console.log(chalk.blue.bold('\n⚙️  PeakInfer Configuration\n'));
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
      console.log(chalk.yellow('Use --show, --set-key, or --clear-key'));
    }
  });

/**
 * Load inference events from file
 */
async function loadEventsFromFile(filePath: string): Promise<InferenceEvent[]> {
  if (!await fs.pathExists(filePath)) {
    throw new Error(`Events file not found: ${filePath}`);
  }

  const ext = path.extname(filePath).toLowerCase();
  const events: InferenceEvent[] = [];

  if (ext === '.jsonl') {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n').map(line => line.trim()).filter(Boolean);
    for (const line of lines) {
      events.push(JSON.parse(line));
    }
    return events;
  }

  if (ext === '.json') {
    const content = await fs.readJson(filePath);
    if (Array.isArray(content)) {
      return content as InferenceEvent[];
    }
    if (content.events && Array.isArray(content.events)) {
      return content.events as InferenceEvent[];
    }
    return [content as InferenceEvent];
  }

  if (ext === '.yaml' || ext === '.yml') {
    const content = await fs.readFile(filePath, 'utf-8');
    const data = yaml.parse(content);
    if (Array.isArray(data)) {
      return data as InferenceEvent[];
    }
    if (data.events && Array.isArray(data.events)) {
      return data.events as InferenceEvent[];
    }
  }

  throw new Error(`Unsupported events file format: ${ext}`);
}

/**
 * Generate HTML report
 */
async function generateHTMLReport(report: any): Promise<string> {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PeakInfer Audit Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; line-height: 1.6; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; }
    .metric { background: #f7fafc; padding: 20px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #667eea; }
    .metric h3 { margin: 0 0 10px 0; color: #2d3748; }
    .metric .value { font-size: 2em; font-weight: bold; color: #667eea; }
    .section { margin: 30px 0; }
    .achievement { background: #c6f6d5; padding: 10px 15px; margin: 5px 0; border-radius: 5px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🚀 PeakInfer Audit Report</h1>
    <p>LLM Inference Optimization Results</p>
    <p style="opacity: 0.9; font-size: 0.9em;">${new Date().toLocaleString()}</p>
  </div>

  <div class="section">
    <h2>Executive Summary</h2>
    <div class="metric">
      <h3>💰 Total Cost Savings</h3>
      <div class="value">$${report.executiveSummary.total_cost_savings.toLocaleString()}/month</div>
    </div>
    <div class="metric">
      <h3>📊 Cost Reduction</h3>
      <div class="value">${report.executiveSummary.cost_reduction_percentage.toFixed(1)}%</div>
    </div>
    <div class="metric">
      <h3>📈 ROI</h3>
      <div class="value">${report.executiveSummary.roi_percentage.toFixed(0)}%</div>
    </div>
    <div class="metric">
      <h3>⏱️ Payback Period</h3>
      <div class="value">${report.executiveSummary.payback_period_months.toFixed(1)} months</div>
    </div>
  </div>

  <div class="section">
    <h2>Key Achievements</h2>
    ${report.executiveSummary.key_achievements.map((achievement: string) => 
      `<div class="achievement">✅ ${achievement}</div>`
    ).join('')}
  </div>

  <div class="section">
    <h2>Savings by Layer</h2>
    <div class="metric">
      <h3>Application Layer</h3>
      <p>$${report.detailedResults.by_layer.application.cost_savings.toLocaleString()}/month (${report.detailedResults.by_layer.application.savings_percentage}%)</p>
    </div>
    <div class="metric">
      <h3>Serving Layer</h3>
      <p>$${report.detailedResults.by_layer.serving.cost_savings.toLocaleString()}/month (${report.detailedResults.by_layer.serving.savings_percentage}%)</p>
    </div>
    <div class="metric">
      <h3>Infrastructure Layer</h3>
      <p>$${report.detailedResults.by_layer.infrastructure.cost_savings.toLocaleString()}/month (${report.detailedResults.by_layer.infrastructure.savings_percentage}%)</p>
    </div>
  </div>

  <div class="section">
    <p style="text-align: center; color: #718096; margin-top: 50px;">
      Generated by <strong>PeakInfer</strong> - LLM Inference Optimization Platform
    </p>
  </div>
</body>
</html>`;
}

// Program configuration
program
  .name('peakinfer')
  .description('peak performance of inference')
  .version('0.2.0')
  .option('-v, --verbose', 'Enable verbose logging for detailed agent output');

// Parse and execute
program.parse();

