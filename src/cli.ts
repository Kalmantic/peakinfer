#!/usr/bin/env node

/**
 * PeakInfer CLI - Template-driven LLM optimization
 * Main entry point for the SLC (Simple, Lovable, Complete) implementation
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { TemplateEngine } from './core/template-engine.js';
import { TemplateExecutionAgent } from './agents/template-execution-agent.js';
import { EnvironmentDiscoveryAgent } from './agents/environment-discovery-agent.js';
import { EconomicsCalculator } from './core/economics-calculator.js';

const program = new Command();

// Global instances
const templateEngine = new TemplateEngine();
const executionAgent = new TemplateExecutionAgent();
const discoveryAgent = new EnvironmentDiscoveryAgent();
const economicsCalculator = new EconomicsCalculator();

/**
 * Main discover command - The One Perfect Command
 */
program
  .command('discover')
  .description('🔍 Discover optimization opportunities across your full LLM stack')
  .option('--dry-run', 'Simulate optimizations without making changes')
  .option('--templates-dir <dir>', 'Custom templates directory')
  .option('--output <file>', 'Save results to file')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n🚀 PeakInfer: Full-Stack LLM Optimization Discovery\n'));
    console.log(chalk.gray('Using template-driven Claude Code SDK agents\n'));

    const spinner = ora('Starting discovery...').start();

    try {
      // Stage 1: Load Templates ⏳
      spinner.text = 'Loading optimization templates...';
      await templateEngine.loadTemplates();
      const allTemplates = templateEngine.listTemplates();
      spinner.succeed(`Loaded ${allTemplates.length} optimization templates`);

      // Stage 2: Environment Discovery ⏳
      spinner.start('Discovering your LLM infrastructure...');
      const environment = await discoveryAgent.discoverEnvironment();
      spinner.succeed('Environment discovery complete');

      console.log(chalk.cyan('\n📊 Environment Summary:'));
      console.log(`  Application: ${environment.application.runtime_detected.join(', ') || 'None detected'}`);
      console.log(`  Serving: ${environment.serving.frameworks_detected.join(', ') || 'None detected'}`);
      console.log(`  Infrastructure: ${environment.infrastructure.gpu_inventory.length} GPU(s) detected`);

      // Stage 3: Template Matching ⏳
      spinner.start('Finding applicable optimization templates...');
      const matchingTemplates = await templateEngine.findMatchingTemplates(environment);
      spinner.succeed(`Found ${matchingTemplates.length} applicable templates`);

      if (matchingTemplates.length === 0) {
        console.log(chalk.yellow('\n⚠️  No optimization templates match your current environment.'));
        console.log(chalk.gray('This might indicate:\n'));
        console.log(chalk.gray('  • Your infrastructure is already optimized'));
        console.log(chalk.gray('  • You need custom templates for your setup'));
        console.log(chalk.gray('  • Environment detection needs refinement\n'));
        return;
      }

      // Stage 4: Economic Analysis ⏳
      spinner.start('Calculating optimization economics...');
      const optimizationPlans = await analyzeOptimizationEconomics(matchingTemplates, environment);
      spinner.succeed('Economic analysis complete');

      // Stage 5: Present Results 📊
      console.log(chalk.green.bold('\n💡 Optimization Opportunities Found:\n'));

      let totalGain = 0;
      let totalImplementationCost = 0;

      for (let i = 0; i < Math.min(5, optimizationPlans.length); i++) {
        const plan = optimizationPlans[i];
        console.log(chalk.blue(`${i + 1}. ${plan.template.name}`));
        console.log(`   ${chalk.gray(plan.template.description)}`);
        console.log(`   🚀 Monthly Gain: ${chalk.green(plan.projectedGain.toLocaleString() + ' tps')}`);
        console.log(`   🔧 Implementation: ${plan.template.optimization.effort_estimate} (${plan.template.optimization.risk_level} risk)`);
        console.log(`   📈 ROI: ${chalk.cyan(plan.roi.toFixed(1) + '%')} annually`);
        console.log(`   🎯 Confidence: ${chalk.yellow((plan.template.confidence * 100).toFixed(1) + '%')}`);
        console.log('');

        totalGain += plan.projectedGain;
        totalImplementationCost += plan.template.economics.implementation_cost.total_cost;
      }

      // Summary
      console.log(chalk.green.bold('📈 Total Economic Impact:'));
      console.log(`   🚀 Total Monthly Gain: ${chalk.green.bold(totalGain.toLocaleString() + ' tps')}`);
      console.log(`   💸 Total Implementation Cost: ${chalk.red('$' + totalImplementationCost.toLocaleString())}`);
      console.log(`   📊 Combined ROI: ${chalk.cyan.bold(((totalGain * 12 - totalImplementationCost) / totalImplementationCost * 100).toFixed(1) + '%')}`);
      console.log(`   ⏱️  Payback Period: ${chalk.blue((totalImplementationCost / (totalGain || 1)).toFixed(1) + ' months')}\n`);

      // Next Steps
      console.log(chalk.blue.bold('🚀 Next Steps:'));
      if (options.dryRun) {
        console.log(`   ${chalk.gray('└')} Run without --dry-run to execute optimizations`);
      } else {
        console.log(`   ${chalk.gray('└')} peakinfer execute <template-id> - Execute specific optimization`);
      }
      console.log(`   ${chalk.gray('└')} peakinfer plan - Generate detailed implementation plan`);
      console.log(`   ${chalk.gray('└')} peakinfer templates - Browse all available templates\n`);

      // Save results if requested
      if (options.output) {
        const results = {
          discovery_time: new Date().toISOString(),
          environment,
          matching_templates: matchingTemplates.map(t => t.id),
          optimization_plans: optimizationPlans,
          total_gain: totalGain,
          total_implementation_cost: totalImplementationCost
        };

        await require('fs-extra').writeJson(options.output, results, { spaces: 2 });
        console.log(chalk.gray(`Results saved to ${options.output}\n`));
      }

    } catch (error) {
      spinner.fail('Discovery failed');
      console.error(chalk.red('\n❌ Error:'), error instanceof Error ? error.message : String(error));
      console.error(chalk.gray('\nFor debugging: peakinfer --verbose discover\n'));
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
            console.log(`    Expected Throughput Gain: ${template.optimization.expected_throughput_improvement || 'Variable'}`);
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
 * Analyze optimization economics for matched templates
 */
async function analyzeOptimizationEconomics(templates: any[], environment: any) {
  const plans = [];

  for (const template of templates) {
    try {
      const baseline = await economicsCalculator.calculateBaseline(template, environment);
      const projected = await economicsCalculator.calculateProjectedGain(template, baseline);
      const roi = economicsCalculator.calculateROI(baseline, projected, template.economics);

      plans.push({
        template,
        baseline,
        projected,
        projectedGain: projected.monthly_gain || 0,
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

// Program configuration
program
  .name('peakinfer')
  .description('peak performance of inference through template-driven AI agents')
  .version('0.2.0');

// Parse and execute
program.parse();