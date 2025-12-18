/**
 * Template Commands (v1.6)
 *
 * CLI commands for managing insight templates:
 * - list: List available templates with optional category filter
 * - info: Show detailed template information
 * - roi: Calculate ROI for a template
 */

import { Command } from 'commander';
import { loadTemplates, getTemplate } from '../templates.js';
import type { InsightTemplate } from '../types.js';

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
    .option('--offline', 'use cached templates only')
    .action(async (options: { category?: string; offline?: boolean }) => {
      try {
        const templates = await loadTemplates({ offline: options.offline });

        const filtered = options.category
          ? templates.filter(t => t.category === options.category)
          : templates;

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
}
