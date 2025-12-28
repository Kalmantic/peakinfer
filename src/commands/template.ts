/**
 * Template Commands (v1.6)
 *
 * CLI commands for managing insight templates:
 * - list: List available templates with optional category filter
 * - info: Show detailed template information
 * - roi: Calculate ROI for a template
 */

import { Command } from 'commander';
import { loadTemplates, getTemplate, loadOptimizationTemplates, getOptimizationTemplate } from '../templates.js';
import type { InsightTemplate, OptimizationTemplate } from '../types.js';

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Format category with color indicator
 */
function formatCategory(category: string): string {
  return `[${category}]`;
}

/**
 * Format severity with indicator
 */
function formatSeverity(severity: string): string {
  const indicators: Record<string, string> = {
    critical: '[!]',
    warning: '[*]',
    info: '[-]',
  };
  return `${indicators[severity] || '[ ]'} ${severity}`;
}

/**
 * Display templates in a formatted list
 */
function displayTemplateList(templates: InsightTemplate[]): void {
  if (templates.length === 0) {
    console.log('No templates found.');
    return;
  }

  console.log(`\n${templates.length} template${templates.length !== 1 ? 's' : ''} available:\n`);

  // Group by category
  const byCategory = new Map<string, InsightTemplate[]>();
  for (const t of templates) {
    if (!byCategory.has(t.category)) {
      byCategory.set(t.category, []);
    }
    byCategory.get(t.category)!.push(t);
  }

  for (const [category, categoryTemplates] of byCategory) {
    console.log(`${formatCategory(category)}`);
    for (const t of categoryTemplates) {
      console.log(`  ${formatSeverity(t.severity)} ${t.id}`);
      console.log(`     ${t.name}`);
    }
    console.log('');
  }
}

/**
 * Display detailed template information
 */
function displayTemplateInfo(template: InsightTemplate): void {
  console.log(`\n${template.name} (${template.id})`);
  console.log('═'.repeat(60));
  console.log(`Version:  ${template.version}`);
  console.log(`Category: ${formatCategory(template.category)}`);
  if (template.layer) {
    console.log(`Layer:    [${template.layer}]`);
  }
  console.log(`Severity: ${formatSeverity(template.severity)}`);
  console.log('');
  console.log('Match Scope:', template.match.scope);
  console.log('Conditions:');
  for (const cond of template.match.conditions) {
    console.log(`  - ${cond.field} ${cond.op} ${cond.value ?? cond.pattern ?? ''}`);
  }
  console.log('');
  console.log('Output:');
  console.log(`  Headline: ${template.output.headline}`);
  console.log(`  Evidence: ${template.output.evidence}`);

  if (template.defaults && Object.keys(template.defaults).length > 0) {
    console.log('');
    console.log('Defaults:');
    for (const [key, value] of Object.entries(template.defaults)) {
      console.log(`  ${key}: ${value}`);
    }
  }
}

// =============================================================================
// OPTIMIZATION TEMPLATE DISPLAY HELPERS (v1.8 - Inference Squeeze Guide)
// =============================================================================

/**
 * Display optimization templates in a formatted list
 */
function displayOptimizationList(templates: OptimizationTemplate[]): void {
  if (templates.length === 0) {
    console.log('No optimization templates found.');
    return;
  }

  console.log(`\n${templates.length} optimization template${templates.length !== 1 ? 's' : ''} available:\n`);

  // Group by category
  const byCategory = new Map<string, OptimizationTemplate[]>();
  for (const t of templates) {
    if (!byCategory.has(t.category)) {
      byCategory.set(t.category, []);
    }
    byCategory.get(t.category)!.push(t);
  }

  for (const [category, categoryTemplates] of byCategory) {
    console.log(`[${category}]`);
    for (const t of categoryTemplates) {
      const risk = t.optimization.risk_level === 'high' ? '[!]' : t.optimization.risk_level === 'medium' ? '[*]' : '[-]';
      console.log(`  ${risk} ${t.id}`);
      console.log(`     ${t.name}`);
      if (t.optimization.expected_cost_reduction) {
        console.log(`     Cost: ${t.optimization.expected_cost_reduction} | Effort: ${t.optimization.effort_estimate}`);
      }
    }
    console.log('');
  }
}

/**
 * Display detailed optimization template information
 */
function displayOptimizationInfo(template: OptimizationTemplate): void {
  console.log(`\n${template.name} (${template.id})`);
  console.log('═'.repeat(70));
  console.log(`Category:    [${template.category}]`);
  console.log(`Confidence:  ${(template.confidence * 100).toFixed(0)}%`);
  if (template.success_count) {
    console.log(`Success:     ${template.success_count} implementations`);
  }
  console.log('');

  console.log('Optimization:');
  console.log(`  Technique: ${template.optimization.technique}`);
  if (template.optimization.expected_cost_reduction) {
    console.log(`  Cost Reduction: ${template.optimization.expected_cost_reduction}`);
  }
  if (template.optimization.expected_latency_improvement) {
    console.log(`  Latency Improvement: ${template.optimization.expected_latency_improvement}`);
  }
  if (template.optimization.expected_throughput_improvement) {
    console.log(`  Throughput Improvement: ${template.optimization.expected_throughput_improvement}`);
  }
  console.log(`  Effort: ${template.optimization.effort_estimate}`);
  console.log(`  Risk: ${template.optimization.risk_level}`);
  console.log('');

  if (template.implementation?.prerequisites) {
    console.log('Prerequisites:');
    for (const prereq of template.implementation.prerequisites) {
      console.log(`  - ${prereq.requirement}`);
    }
    console.log('');
  }

  if (template.implementation?.automated_steps) {
    console.log('Implementation Steps:');
    for (const step of template.implementation.automated_steps) {
      console.log(`  ${step.step_id}: ${step.name}`);
    }
    console.log('');
  }

  if (template.monitoring?.key_metrics) {
    console.log('Key Metrics:');
    for (const metric of template.monitoring.key_metrics) {
      console.log(`  - ${metric.metric}: target ${metric.target}`);
    }
    console.log('');
  }

  if (template.economics?.implementation_cost) {
    console.log('Implementation Cost:');
    if (template.economics.implementation_cost.engineering_hours) {
      console.log(`  Engineering Hours: ${template.economics.implementation_cost.engineering_hours}`);
    }
    console.log(`  Total Cost: $${template.economics.implementation_cost.total_cost.toLocaleString()}`);
    console.log('');
  }

  console.log('Note: ROI estimates are indicative. Actual results depend on your environment.');
}

/**
 * Calculate and display ROI for a template
 */
function displayTemplateROI(template: InsightTemplate, monthlyCost?: number): void {
  console.log(`\nROI Analysis: ${template.name}`);
  console.log('═'.repeat(60));

  // Use defaults or provided values
  const defaults = template.defaults || {};
  const baseCost = monthlyCost || defaults.monthly_cost || 10000;

  // Estimate savings based on category
  let savingsPercent = 0;
  let savingsDescription = '';

  switch (template.category) {
    case 'cost':
      savingsPercent = defaults.estimated_savings_percent || 20;
      savingsDescription = 'Direct cost reduction';
      break;
    case 'latency':
      savingsPercent = defaults.latency_improvement_percent || 30;
      savingsDescription = 'User time saved (latency reduction)';
      break;
    case 'reliability':
      savingsPercent = defaults.failure_reduction_percent || 15;
      savingsDescription = 'Avoided failures and retries';
      break;
    case 'throughput':
      savingsPercent = defaults.throughput_improvement_percent || 25;
      savingsDescription = 'Capacity improvement';
      break;
    default:
      savingsPercent = 10;
      savingsDescription = 'General optimization';
  }

  const monthlySavings = Math.round(baseCost * (savingsPercent / 100));
  const annualSavings = monthlySavings * 12;

  console.log(`Base Monthly Cost: $${baseCost.toLocaleString()}`);
  console.log(`Category: ${template.category}`);
  console.log('');
  console.log(`Estimated Impact: ${savingsPercent}% ${savingsDescription}`);
  console.log(`Monthly Savings:  $${monthlySavings.toLocaleString()}`);
  console.log(`Annual Savings:   $${annualSavings.toLocaleString()}`);
  console.log('');
  console.log('Note: Estimates based on typical scenarios. Actual results may vary.');
}

// =============================================================================
// COMMANDS
// =============================================================================

/**
 * Register template commands
 */
export function registerTemplateCommands(program: Command): void {
  const templateCmd = program
    .command('template')
    .description('manage insight templates');

  // List templates
  templateCmd
    .command('list')
    .description('list available templates')
    .option('--category <cat>', 'filter by category (cost, latency, reliability, throughput, drift)')
    .option('--layer <layer>', 'filter by stack layer (application, api, gateway, runtime, model, hardware)')
    .option('--offline', 'use cached templates only')
    .action(async (options: { category?: string; layer?: string; offline?: boolean }) => {
      try {
        const templates = await loadTemplates({ offline: options.offline });

        let filtered = templates;

        // Filter by category if specified
        if (options.category) {
          filtered = filtered.filter(t => t.category === options.category);
        }

        // v1.8: Filter by layer if specified
        if (options.layer) {
          filtered = filtered.filter(t => t.layer === options.layer);
        }

        displayTemplateList(filtered);
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : 'Failed to load templates');
        process.exit(1);
      }
    });

  // Template info
  templateCmd
    .command('info')
    .description('show template details')
    .argument('<id>', 'template ID')
    .option('--offline', 'use cached templates only')
    .action(async (id: string, options: { offline?: boolean }) => {
      try {
        const template = await getTemplate(id, { offline: options.offline });

        if (!template) {
          console.error(`Template not found: ${id}`);
          console.log('\nRun "peakinfer template list" to see available templates.');
          process.exit(1);
        }

        displayTemplateInfo(template);
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : 'Failed to load template');
        process.exit(1);
      }
    });

  // Template ROI
  templateCmd
    .command('roi')
    .description('calculate ROI for a template')
    .argument('<id>', 'template ID')
    .option('--monthly-cost <amount>', 'your monthly inference cost in USD', parseFloat)
    .option('--offline', 'use cached templates only')
    .action(async (id: string, options: { monthlyCost?: number; offline?: boolean }) => {
      try {
        const template = await getTemplate(id, { offline: options.offline });

        if (!template) {
          console.error(`Template not found: ${id}`);
          process.exit(1);
        }

        displayTemplateROI(template, options.monthlyCost);
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : 'Failed to calculate ROI');
        process.exit(1);
      }
    });

  // ==========================================================================
  // OPTIMIZATION TEMPLATES (v1.8 - Inference Squeeze Guide)
  // ==========================================================================

  // List optimization templates
  templateCmd
    .command('optimizations')
    .description('list community optimization templates (Inference Squeeze Guide)')
    .option('--category <cat>', 'filter by category (runtime_optimization, batching_optimization, memory_optimization, application_optimization, cost_optimization, monitoring, scaling)')
    .action((options: { category?: string }) => {
      try {
        let templates = loadOptimizationTemplates();

        // Filter by category if specified
        if (options.category) {
          templates = templates.filter(t => t.category === options.category);
        }

        displayOptimizationList(templates);
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : 'Failed to load optimization templates');
        process.exit(1);
      }
    });

  // Optimization template info
  templateCmd
    .command('optimization')
    .description('show optimization template details')
    .argument('<id>', 'optimization template ID')
    .action((id: string) => {
      try {
        const template = getOptimizationTemplate(id);

        if (!template) {
          console.error(`Optimization template not found: ${id}`);
          console.log('\nRun "peakinfer template optimizations" to see available templates.');
          process.exit(1);
        }

        displayOptimizationInfo(template);
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : 'Failed to load optimization template');
        process.exit(1);
      }
    });
}
