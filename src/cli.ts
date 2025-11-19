#!/usr/bin/env node

/**
 * PeakInfer CLI - Template-driven LLM optimization using Claude Code SDK
 * Main entry point for the SLC (Simple, Lovable, Complete) implementation
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { TemplateEngine } from './core/template-engine.js';
import { TemplateExecutionAgent } from './agents/template-execution-agent.js';
import { EnvironmentDiscoveryAgent } from './agents/environment-discovery-agent.js';
import { EconomicsCalculator } from './core/economics-calculator.js';
import { MultiAgentOrchestrator } from './orchestration/multi-agent-orchestrator.js';
import { ClaudeHelper } from './utils/claude-helper.js';
import { writeFile } from 'fs/promises';

const program = new Command();

// Global instances
const templateEngine = new TemplateEngine();
const executionAgent = new TemplateExecutionAgent();
const discoveryAgent = new EnvironmentDiscoveryAgent();
const economicsCalculator = new EconomicsCalculator();
const orchestrator = new MultiAgentOrchestrator();

/**
 * Multi-Agent Orchestration Command - The Ultimate Optimization Flow
 */
program
  .command('orchestrate')
  .description('🤖 Full multi-agent orchestration with Claude Code SDK')
  .option('--workload <file>', 'Path to workload data (events.jsonl)')
  .option('--policy <file>', 'Path to policy file (policy.yaml)')
  .option('--dry-run', 'Simulate without making changes')
  .option('--templates-dir <dir>', 'Custom templates directory')
  .option('--output <file>', 'Save full report to file')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n🤖 PeakInfer: Multi-Agent Orchestration\n'));
    console.log(chalk.gray('Powered by Claude Code SDK\n'));

    // Check for Claude API key first
    await ClaudeHelper.ensureApiKey();

    const spinner = ora('Initializing multi-agent system...').start();

    try {
      spinner.text = 'Running multi-agent orchestration...';

      const result = await orchestrator.orchestrateOptimization({
        workloadDataPath: options.workload,
        policyPath: options.policy,
        dryRun: options.dryRun,
        templatesDir: options.templatesDir
      });

      spinner.succeed('Multi-agent orchestration complete!\n');

      // Display summary
      console.log(orchestrator.getOrchestrationSummary(result));

      // Show patches
      if (result.audit.patches_generated.length > 0) {
        console.log(chalk.blue.bold('🔧 Generated Patches:\n'));
        result.audit.patches_generated.forEach((patch, i) => {
          console.log(`  ${i + 1}. ${chalk.cyan(patch.file_path)}`);
          console.log(`     ${chalk.gray(patch.description)}`);
          console.log(`     Type: ${patch.patch_type} | Auto-apply: ${patch.auto_applicable ? '✅' : '❌'}`);
          console.log('');
        });
      }

      // Show recommendations
      if (result.audit.recommendations.length > 0) {
        console.log(chalk.blue.bold('💡 Recommendations:\n'));
        result.audit.recommendations.forEach(rec => {
          console.log(`  • ${rec}`);
        });
        console.log('');
      }

      // Save full report if requested
      if (options.output) {
        await writeFile(options.output, JSON.stringify(result, null, 2), 'utf-8');
        console.log(chalk.gray(`📄 Full report saved to ${options.output}\n`));
      }

      // Show next steps
      console.log(chalk.blue.bold('🚀 Next Steps:\n'));
      console.log('  1. Review generated patches in ./peakinfer-patches/');
      console.log('  2. Apply patches manually or use auto-applicable ones');
      console.log('  3. Monitor quality metrics after implementation');
      console.log('  4. Run `peakinfer orchestrate` again to find more opportunities\n');

    } catch (error) {
      spinner.fail('Multi-agent orchestration failed');
      console.error(chalk.red('\n❌ Error:'), error instanceof Error ? error.message : String(error));
      if (error instanceof Error && error.stack) {
        console.error(chalk.gray('\nStack trace:'));
        console.error(chalk.gray(error.stack));
      }
      process.exit(1);
    }
  });

/**
 * PRD Command: peakinfer discover
 * Multi-agent discovery across infrastructure layers
 */
program
  .command('discover')
  .description('🔍 Multi-agent discovery across infrastructure layers')
  .option('--input-dir <dir>', 'Directory with manual input files')
  .option('--collectors <collectors>', 'Comma-separated collector list (snowflake,databricks,terraform)', '')
  .option('--output <file>', 'Save discovered environment to file (discovered.yaml)', 'discovered.yaml')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n🔍 PeakInfer: Environment Discovery\n'));
    console.log(chalk.gray('Stage 1: Multi-agent infrastructure discovery\n'));

    // Check for Claude API key first
    await ClaudeHelper.ensureApiKey();

    const spinner = ora('Starting discovery...').start();

    try {
      // Run Discovery Agent from multi-agent orchestrator
      spinner.text = 'Running Claude Discovery Agent...';
      const environment = await orchestrator.discoveryAgent.discover();

      spinner.succeed('Environment discovery complete');

      console.log(chalk.cyan('\n📊 Environment Summary:'));
      console.log(`  Application: ${environment.application.runtime_detected.join(', ') || 'None detected'}`);
      console.log(`  Serving: ${environment.serving.frameworks_detected.join(', ') || 'None detected'}`);
      console.log(`  Infrastructure: ${environment.infrastructure.gpu_inventory.length} GPU(s) detected`);
      console.log(`  Monthly Cost: $${environment.infrastructure.cost_breakdown.total_monthly.toLocaleString()}`);

      // Save to discovered.yaml
      await writeFile(options.output, JSON.stringify(environment, null, 2), 'utf-8');
      spinner.succeed(`Discovery results saved to ${options.output}`);

      // Next Steps
      console.log(chalk.blue.bold('\n🚀 Next Steps:'));
      console.log(`   ${chalk.gray('└')} peakinfer profile --events events.jsonl`);
      console.log(`   ${chalk.gray('└')} peakinfer plan --constraints policy.yaml`);
      console.log(`   ${chalk.gray('└')} peakinfer run --plan optimization-plan.yaml\n`);

    } catch (error) {
      spinner.fail('Discovery failed');
      console.error(chalk.red('\n❌ Error:'), error instanceof Error ? error.message : String(error));
      console.error(chalk.gray('\nFor debugging: peakinfer --verbose discover\n'));
      process.exit(1);
    }
  });

/**
 * PRD Command: peakinfer profile
 * Workload profiling with semantic clustering
 */
program
  .command('profile')
  .description('📊 Profile workload and cluster prompts into representative samples')
  .option('--events <file>', 'Path to events.jsonl file', 'events.jsonl')
  .option('--cluster-method <method>', 'Clustering method (semantic|keyword)', 'semantic')
  .option('--output <file>', 'Save workload profile to file', 'workload-profile.json')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n📊 PeakInfer: Workload Profiling\n'));
    console.log(chalk.gray('Stage 2: Semantic workload clustering\n'));

    // Check for Claude API key first
    await ClaudeHelper.ensureApiKey();

    const spinner = ora('Loading workload data...').start();

    try {
      // Run Workload Profiler Agent
      spinner.text = 'Running Claude Workload Profiler Agent...';
      const profile = await orchestrator.profilerAgent.profileWorkload(options.events, {} as any);

      spinner.succeed('Workload profiling complete');

      console.log(chalk.cyan('\n📊 Workload Profile Summary:'));
      console.log(`  Total Requests: ${profile.total_requests.toLocaleString()}`);
      console.log(`  Intent Clusters: ${profile.clustered_intents.length}`);
      console.log(`  Representative Samples: ${profile.representative_samples.length}`);

      console.log(chalk.cyan('\n💰 Cost Breakdown by Intent:'));
      profile.clustered_intents.forEach((intent: any, i: number) => {
        console.log(`  ${i + 1}. ${intent.intent_name} (${intent.sample_count} requests)`);
        console.log(`     Avg Tokens: ${intent.avg_tokens.toLocaleString()}`);
        console.log(`     Cost Contribution: ${(intent.cost_contribution * 100).toFixed(1)}%`);
      });

      // Save to file
      await writeFile(options.output, JSON.stringify(profile, null, 2), 'utf-8');
      console.log(chalk.gray(`\n✅ Workload profile saved to ${options.output}`));

      // Next Steps
      console.log(chalk.blue.bold('\n🚀 Next Steps:'));
      console.log(`   ${chalk.gray('└')} peakinfer plan --constraints policy.yaml`);
      console.log(`   ${chalk.gray('└')} peakinfer run --plan optimization-plan.yaml\n`);

    } catch (error) {
      spinner.fail('Profiling failed');
      console.error(chalk.red('\n❌ Error:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

/**
 * PRD Command: peakinfer plan
 * Generate optimization plan using community templates
 */
program
  .command('plan')
  .description('🎯 Generate optimization plan using community templates')
  .option('--constraints <file>', 'Policy constraints file (policy.yaml)', 'policy.yaml')
  .option('--templates-dir <dir>', 'Community templates directory', 'design/templates')
  .option('--output <file>', 'Save optimization plan to file', 'optimization-plan.yaml')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n🎯 PeakInfer: Optimization Planning\n'));
    console.log(chalk.gray('Stage 4: Creating optimization strategy\n'));

    // Check for Claude API key first
    await ClaudeHelper.ensureApiKey();

    const spinner = ora('Loading policy and templates...').start();

    try {
      // Load policy
      spinner.text = 'Loading policy constraints...';
      const policy = await orchestrator.policyAgent.loadPolicy(options.constraints);

      // Need environment from discover step
      spinner.text = 'Loading environment...';
      const environment = await orchestrator.discoveryAgent.discover();

      spinner.text = 'Planning optimization strategy...';
      const plan = await orchestrator.plannerAgent.createPlan(
        environment,
        {} as any, // workload profile
        policy,
        options.templatesDir
      );

      spinner.succeed('Optimization plan generated');

      console.log(chalk.cyan('\n📋 Optimization Plan Summary:'));
      console.log(`  Search Strategy: ${plan.search_strategy}`);
      console.log(`  Candidate Templates: ${plan.candidate_templates.length}`);
      console.log(`  Execution Order: ${plan.execution_order.length} templates`);
      console.log(`  Estimated Duration: ${plan.estimated_duration_minutes} minutes`);

      // Save to file
      await writeFile(options.output, JSON.stringify(plan, null, 2), 'utf-8');
      console.log(chalk.gray(`\n✅ Optimization plan saved to ${options.output}`));

      // Next Steps
      console.log(chalk.blue.bold('\n🚀 Next Steps:'));
      console.log(`   ${chalk.gray('└')} peakinfer run --plan ${options.output}`);
      console.log(`   ${chalk.gray('└')} Review plan before execution\n`);

    } catch (error) {
      spinner.fail('Planning failed');
      console.error(chalk.red('\n❌ Error:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

/**
 * PRD Command: peakinfer run
 * Execute optimization plan with evaluation
 */
program
  .command('run')
  .description('🚀 Execute optimization plan with baseline comparison')
  .option('--plan <file>', 'Optimization plan file', 'optimization-plan.yaml')
  .option('--sample-size <number>', 'Number of sample prompts for testing', '100')
  .option('--early-stopping', 'Enable early stopping for failed optimizations', true)
  .option('--output <file>', 'Save execution results to file', 'execution-results.json')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n🚀 PeakInfer: Executing Optimization Plan\n'));
    console.log(chalk.gray('Stage 5: Running optimizations with evaluation\n'));

    // Check for Claude API key first
    await ClaudeHelper.ensureApiKey();

    const spinner = ora('Loading optimization plan...').start();

    try {
      // Execute optimizations
      spinner.text = 'Running Runner/Evaluator Agent...';
      const results = await orchestrator.runnerAgent.executeWithEarlyStopping(
        {} as any, // plan
        {} as any, // environment
        {} as any, // workload profile
        false      // dry run
      );

      spinner.succeed('Optimization execution complete');

      console.log(chalk.cyan('\n📊 Execution Results:'));
      console.log(`  Templates Tested: ${results.length}`);
      const successful = results.filter((r: any) => r.success);
      console.log(`  Successful: ${successful.length}`);
      console.log(`  Failed: ${results.length - successful.length}`);

      // Save to file
      await writeFile(options.output, JSON.stringify(results, null, 2), 'utf-8');
      console.log(chalk.gray(`\n✅ Execution results saved to ${options.output}`));

      // Next Steps
      console.log(chalk.blue.bold('\n🚀 Next Steps:'));
      console.log(`   ${chalk.gray('└')} peakinfer report --output-dir reports/`);
      console.log(`   ${chalk.gray('└')} Review generated patches in ./peakinfer-patches/\n`);

    } catch (error) {
      spinner.fail('Execution failed');
      console.error(chalk.red('\n❌ Error:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

/**
 * PRD Command: peakinfer report
 * Generate comprehensive reports and audits
 */
program
  .command('report')
  .description('📝 Generate comprehensive optimization report with ROI analysis')
  .option('--output-dir <dir>', 'Output directory for reports', 'reports/')
  .option('--format <formats>', 'Report formats (html,csv,json)', 'html,json')
  .option('--dashboard', 'Generate interactive dashboard', false)
  .action(async (options) => {
    console.log(chalk.blue.bold('\n📝 PeakInfer: Generating Reports\n'));
    console.log(chalk.gray('Stage 6: Auditing and reporting\n'));

    const spinner = ora('Generating audit report...').start();

    try {
      // Run Auditor Agent
      spinner.text = 'Running Auditor Agent...';
      const audit = await orchestrator.auditorAgent.auditResults(
        [],       // execution results
        {} as any, // environment
        {} as any, // workload profile
        {} as any  // policy
      );

      spinner.succeed('Audit report generated');

      console.log(chalk.cyan('\n💰 Economic Impact:'));
      console.log(`  Monthly Savings: $${audit.total_cost_savings_monthly.toLocaleString()}`);
      console.log(`  Annual Savings: $${audit.total_cost_savings_annual.toLocaleString()}`);
      console.log(`  Implementation Cost: $${audit.total_implementation_cost.toLocaleString()}`);
      console.log(`  ROI: ${audit.roi_annual.toFixed(1)}%`);
      console.log(`  Payback Period: ${audit.payback_period_months.toFixed(1)} months`);

      console.log(chalk.cyan('\n🔧 Generated Artifacts:'));
      console.log(`  Patches: ${audit.patches_generated.length}`);
      console.log(`  Templates Applied: ${audit.templates_applied.length}`);

      // Save reports
      const fs = await import('fs/promises');
      await fs.mkdir(options.outputDir, { recursive: true });

      const reportPath = `${options.outputDir}/audit-report.json`;
      await writeFile(reportPath, JSON.stringify(audit, null, 2), 'utf-8');

      console.log(chalk.gray(`\n✅ Reports saved to ${options.outputDir}`));
      console.log(chalk.gray(`   • ${reportPath}`));

      // Next Steps
      console.log(chalk.blue.bold('\n🎉 Optimization Complete!'));
      console.log(`   ${chalk.gray('└')} Review patches in ./peakinfer-patches/`);
      console.log(`   ${chalk.gray('└')} Apply optimizations to production`);
      console.log(`   ${chalk.gray('└')} Monitor quality metrics\n`);

    } catch (error) {
      spinner.fail('Report generation failed');
      console.error(chalk.red('\n❌ Error:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

/**
 * Execute specific template command
 */
program
  .command('execute <template-id>')
  .description('🚀 Execute a specific optimization template')
  .option('--dry-run', 'Simulate execution without making changes')
  .option('--skip-prerequisites', 'Skip prerequisite validation (dangerous)')
  .action(async (templateId, options) => {
    console.log(chalk.blue.bold(`\n🚀 Executing Template: ${templateId}\n`));

    const spinner = ora('Preparing execution...').start();

    try {
      // Load template
      await templateEngine.loadTemplates();
      const template = templateEngine.getTemplate(templateId);

      if (!template) {
        spinner.fail('Template not found');
        console.error(chalk.red(`❌ Template '${templateId}' not found`));
        console.log(chalk.gray('\nAvailable templates:'));
        const allTemplates = templateEngine.listTemplates();
        allTemplates.forEach(t => console.log(`  • ${t.id} - ${t.name}`));
        return;
      }

      // Discover environment
      spinner.text = 'Discovering environment...';
      const environment = await discoveryAgent.discoverEnvironment();

      // Execute template
      spinner.text = `Executing ${template.name}...`;
      const result = await executionAgent.executeTemplate(template, environment, {
        dryRun: options.dryRun,
        skipPrerequisites: options.skipPrerequisites
      });

      spinner.succeed('Template execution complete');

      // Show results
      console.log(chalk.green.bold('\n✅ Execution Results:\n'));
      console.log(`Status: ${result.status}`);
      console.log(`Duration: ${((result.end_time?.getTime() || Date.now()) - result.start_time.getTime()) / 1000}s`);

      if (result.cost_savings) {
        console.log(`💰 Cost Savings: $${result.cost_savings.toLocaleString()}/month`);
      }

      if (result.roi_achieved) {
        console.log(`📈 ROI: ${result.roi_achieved.toFixed(1)}%`);
      }

      console.log(`Quality Preserved: ${result.quality_preserved ? '✅' : '❌'}`);

      if (result.steps_completed.length > 0) {
        console.log('\n📋 Steps Completed:');
        result.steps_completed.forEach(step => console.log(`  ✅ ${step}`));
      }

      if (result.steps_failed.length > 0) {
        console.log('\n❌ Failed Steps:');
        result.steps_failed.forEach(step => console.log(`  ❌ ${step}`));
      }

    } catch (error) {
      spinner.fail('Execution failed');
      console.error(chalk.red('\n❌ Error:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

/**
 * List templates command
 */
program
  .command('templates')
  .description('📋 List all available optimization templates')
  .option('--category <category>', 'Filter by category')
  .option('--detailed', 'Show detailed information')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n📋 Available Optimization Templates\n'));

    try {
      await templateEngine.loadTemplates();
      let templates = templateEngine.listTemplates();

      if (options.category) {
        templates = templates.filter(t => t.category === options.category);
      }

      // Group by category
      const byCategory = templates.reduce((acc, template) => {
        if (!acc[template.category]) acc[template.category] = [];
        acc[template.category].push(template);
        return acc;
      }, {} as Record<string, typeof templates>);

      for (const [category, categoryTemplates] of Object.entries(byCategory)) {
        console.log(chalk.cyan.bold(`\n${category.toUpperCase()}:`));

        categoryTemplates.forEach(template => {
          console.log(`\n  ${chalk.blue(template.id)} - ${template.name}`);
          console.log(`    ${chalk.gray(template.description)}`);
          console.log(`    Confidence: ${chalk.yellow((template.confidence * 100).toFixed(1) + '%')} | ` +
                     `Success Count: ${template.success_count} | ` +
                     `Risk: ${template.optimization.risk_level}`);

          if (options.detailed) {
            console.log(`    Expected Savings: ${template.optimization.expected_cost_reduction || 'Variable'}`);
            console.log(`    Implementation: ${template.optimization.effort_estimate}`);
          }
        });
      }

      console.log(chalk.blue(`\n📊 Total: ${templates.length} templates available\n`));

    } catch (error) {
      console.error(chalk.red('❌ Error loading templates:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

/**
 * PRD Command: peakinfer template-apply
 * Apply a specific template with interactive mode
 */
program
  .command('template-apply <template-id>')
  .description('🔧 Apply a specific optimization template')
  .option('--dry-run', 'Simulate application without making changes')
  .option('--interactive', 'Interactive mode with confirmations')
  .action(async (templateId, options) => {
    console.log(chalk.blue.bold(`\n🔧 PeakInfer: Applying Template\n`));
    console.log(chalk.gray(`Template: ${templateId}\n`));

    const spinner = ora('Loading template...').start();

    try {
      await templateEngine.loadTemplates();
      const template = templateEngine.getTemplate(templateId);

      if (!template) {
        spinner.fail('Template not found');
        console.error(chalk.red(`❌ Template '${templateId}' not found`));
        return;
      }

      spinner.text = 'Applying template...';
      const environment = await discoveryAgent.discoverEnvironment();
      const result = await executionAgent.executeTemplate(template, environment, {
        dryRun: options.dryRun,
        skipPrerequisites: false
      });

      spinner.succeed('Template applied successfully');

      console.log(chalk.green.bold('\n✅ Application Results:'));
      console.log(`  Status: ${result.status}`);
      if (result.cost_savings) {
        console.log(`  💰 Savings: $${result.cost_savings.toLocaleString()}/month`);
      }
      console.log('');

    } catch (error) {
      spinner.fail('Template application failed');
      console.error(chalk.red('\n❌ Error:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

/**
 * PRD Command: peakinfer submit-implementation
 * Submit implementation results to community
 */
program
  .command('submit-implementation <template-id>')
  .description('📤 Submit implementation results to community')
  .option('--baseline-cost <cost>', 'Monthly cost before optimization', '0')
  .option('--optimized-cost <cost>', 'Monthly cost after optimization', '0')
  .option('--implementation-time <days>', 'Days to complete implementation', '0')
  .action(async (templateId, options) => {
    console.log(chalk.blue.bold(`\n📤 PeakInfer: Submit Implementation\n`));
    console.log(chalk.gray(`Template: ${templateId}\n`));

    const baselineCost = parseFloat(options.baselineCost);
    const optimizedCost = parseFloat(options.optimizedCost);
    const savings = baselineCost - optimizedCost;
    const reduction = (savings / baselineCost) * 100;

    console.log(chalk.cyan('📊 Implementation Summary:'));
    console.log(`  Baseline Cost: $${baselineCost.toLocaleString()}/month`);
    console.log(`  Optimized Cost: $${optimizedCost.toLocaleString()}/month`);
    console.log(`  Savings: $${savings.toLocaleString()}/month (${reduction.toFixed(1)}%)`);
    console.log(`  Implementation Time: ${options.implementationTime} days`);

    console.log(chalk.yellow('\n⚠️  Community submission feature coming in Phase 2'));
    console.log(chalk.gray('Your data will be anonymized and shared with the community\n'));
  });

/**
 * PRD Command: peakinfer review-template
 * Review a community template
 */
program
  .command('review-template <template-id>')
  .description('👀 Review a community optimization template')
  .action(async (templateId) => {
    console.log(chalk.blue.bold(`\n👀 PeakInfer: Template Review\n`));
    console.log(chalk.gray(`Template: ${templateId}\n`));

    try {
      await templateEngine.loadTemplates();
      const template = templateEngine.getTemplate(templateId);

      if (!template) {
        console.error(chalk.red(`❌ Template '${templateId}' not found`));
        return;
      }

      console.log(chalk.cyan('📋 Template Details:'));
      console.log(`  Name: ${template.name}`);
      console.log(`  Description: ${template.description}`);
      console.log(`  Category: ${template.category}`);
      console.log(`  Risk Level: ${template.optimization.risk_level}`);
      console.log(`  Confidence: ${(template.confidence * 100).toFixed(1)}%`);
      console.log(`  Success Count: ${template.success_count}`);

      console.log(chalk.yellow('\n⚠️  Community review feature coming in Phase 2'));
      console.log(chalk.gray('Peer review workflow will be available soon\n'));

    } catch (error) {
      console.error(chalk.red('❌ Error:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

/**
 * PRD Command: peakinfer contribute
 * Contribute template or results to community
 */
program
  .command('contribute')
  .description('🤝 Contribute template or results to community')
  .option('--template <template-id>', 'Template to contribute')
  .option('--results <file>', 'Results file to contribute')
  .action(async (options) => {
    console.log(chalk.blue.bold(`\n🤝 PeakInfer: Community Contribution\n`));

    console.log(chalk.cyan('📋 Contribution Options:'));
    console.log('  1. Submit new optimization template');
    console.log('  2. Share implementation results');
    console.log('  3. Report template issues');
    console.log('  4. Suggest improvements');

    console.log(chalk.yellow('\n⚠️  Community contribution feature coming in Phase 2'));
    console.log(chalk.gray('GitHub-based workflow will be available soon'));
    console.log(chalk.gray('Community templates: github.com/kalmantic/peakinfer-templates\n'));
  });

/**
 * Analyze optimization economics for matched templates
 */
async function analyzeOptimizationEconomics(templates: any[], environment: any) {
  const plans: Array<{
    template: any;
    baseline: Record<string, number>;
    projected: Record<string, number>;
    projectedSavings: number;
    roi: number;
    implementationCost: any;
  }> = [];

  for (const template of templates) {
    try {
      const baseline = await economicsCalculator.calculateBaseline(template, environment);
      const projected = await economicsCalculator.calculateProjectedSavings(template, baseline);
      const roi = economicsCalculator.calculateROI(baseline, projected, template.economics);

      plans.push({
        template,
        baseline,
        projected,
        projectedSavings: projected.monthly_savings || 0,
        roi,
        implementationCost: template.economics.implementation_cost.total_cost
      });

    } catch (error) {
      console.warn(`⚠️  Could not calculate economics for ${template.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Sort by ROI descending
  return plans.sort((a, b) => b.roi - a.roi);
}

/**
 * Custom help display function
 */
function displayWelcome() {
  console.log(chalk.blue.bold('\n╔════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.blue.bold('║                                                                ║'));
  console.log(chalk.blue.bold('║   ') + chalk.white.bold('PeakInfer') + chalk.gray(' - LLM Cost Optimization Platform') + chalk.blue.bold('           ║'));
  console.log(chalk.blue.bold('║                                                                ║'));
  console.log(chalk.blue.bold('╚════════════════════════════════════════════════════════════════╝\n'));

  console.log(chalk.cyan.bold('🚀 Quick Start Commands:\n'));
  console.log('  ' + chalk.yellow('peakinfer orchestrate') + chalk.gray('          # Full multi-agent optimization workflow'));
  console.log('  ' + chalk.yellow('peakinfer discover') + chalk.gray('             # Discover your infrastructure environment'));
  console.log('  ' + chalk.yellow('peakinfer templates') + chalk.gray('            # Browse available optimization templates'));
  console.log('  ' + chalk.yellow('peakinfer execute <template-id>') + chalk.gray(' # Execute a specific template\n'));

  console.log(chalk.cyan.bold('📊 Multi-Step Workflow:\n'));
  console.log('  ' + chalk.white('1.') + ' ' + chalk.yellow('peakinfer discover') + chalk.gray('   → Scan infrastructure layers'));
  console.log('  ' + chalk.white('2.') + ' ' + chalk.yellow('peakinfer profile') + chalk.gray('    → Analyze workload patterns'));
  console.log('  ' + chalk.white('3.') + ' ' + chalk.yellow('peakinfer plan') + chalk.gray('       → Generate optimization plan'));
  console.log('  ' + chalk.white('4.') + ' ' + chalk.yellow('peakinfer run') + chalk.gray('        → Execute optimizations'));
  console.log('  ' + chalk.white('5.') + ' ' + chalk.yellow('peakinfer report') + chalk.gray('     → Generate ROI report\n'));

  console.log(chalk.cyan.bold('💡 Need Help?\n'));
  console.log('  ' + chalk.yellow('peakinfer --help') + chalk.gray('              # Show all commands'));
  console.log('  ' + chalk.yellow('peakinfer <command> --help') + chalk.gray('     # Show command-specific help\n'));

  console.log(chalk.gray('Powered by Claude Code SDK • Made with ❤️  by Kalmantic AI Labs\n'));
}

// Program configuration
program
  .name('peakinfer')
  .description('🔧 LLM inference cost optimization through template-driven Claude Code SDK agents')
  .version('0.1.0')
  .configureHelp({
    helpWidth: 100
  })
  .hook('preAction', () => {
    // This ensures our custom welcome is not overridden
  });

// Show interactive welcome if no command provided
if (!process.argv.slice(2).length) {
  displayWelcome();
  process.exit(0);
}

// Parse and execute
program.parse();