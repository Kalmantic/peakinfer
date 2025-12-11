/**
 * Enhanced Renderer — Beautiful Terminal UI Components
 *
 * Clean, visual output for patterns, risks, and opportunities.
 * Following Julie Zhuo's design principles for clarity and delight.
 */

import chalk from 'chalk';
import { theme, format } from './progress.js';
import type { InferencePatterns, RiskAssessment } from './types.js';
import type { RecommendationSummary } from './recommender.js';

// =============================================================================
// VISUAL INDICATORS
// =============================================================================

const indicators = {
  // Pattern indicators
  highUsage: '🔥',
  mediumUsage: '⚡',
  lowUsage: '📊',

  // Risk indicators
  critical: '🚨',
  high: '⚠️',
  medium: '⚡',
  low: '✓',

  // Opportunity indicators
  quickWin: '🎯',
  strategic: '🚀',
  experimental: '🔬',

  // Status indicators
  success: '✅',
  warning: '⚠️',
  error: '❌',
  info: 'ℹ️',

  // Cost indicators
  expensive: '💸',
  moderate: '💰',
  cheap: '💵',
};

// =============================================================================
// PATTERN RENDERING
// =============================================================================

/**
 * Render patterns summary with visual indicators.
 */
export function renderPatternsSummary(patterns: InferencePatterns | any): void {
  console.log(chalk.bold('\n  🔍 Detected Patterns\n'));

  // Check for detected optimization patterns
  const patternTypes = ['retry', 'batching', 'streaming', 'caching', 'routing', 'fallback', 'guardrails'];
  const detectedPatterns: string[] = [];

  for (const patternType of patternTypes) {
    if (patterns[patternType]?.detected) {
      detectedPatterns.push(patternType);
    }
  }

  if (detectedPatterns.length > 0) {
    console.log(`  ${indicators.success} Optimization Patterns Detected:`);
    for (const pattern of detectedPatterns) {
      const patternData = patterns[pattern];
      const count = patternData.instances?.length || 0;
      const type = patternData.type || 'unknown';
      console.log(`     • ${pattern}: ${count} instances (${type})`);
    }
    console.log('');
  }

  // Inefficient patterns (if available from extended analysis)
  if (patterns.inefficientPatterns && patterns.inefficientPatterns.length > 0) {
    console.log(chalk.yellow(`  ${indicators.warning} Inefficient Patterns Found:`));
    for (const pattern of patterns.inefficientPatterns.slice(0, 5)) {
      const icon = getPatternIcon(pattern.severity);
      console.log(`     ${icon} ${pattern.description}`);
      if (pattern.location) {
        console.log(chalk.dim(`        → ${pattern.location}`));
      }
      if (pattern.impact) {
        console.log(chalk.dim(`        Impact: ${pattern.impact}`));
      }
    }
    if (patterns.inefficientPatterns.length > 5) {
      console.log(chalk.dim(`     ... and ${patterns.inefficientPatterns.length - 5} more`));
    }
    console.log('');
  }

  // Optimization opportunities (if available from extended analysis)
  if (patterns.optimizationOpportunities && patterns.optimizationOpportunities.length > 0) {
    console.log(chalk.green(`  ${indicators.quickWin} Quick Optimization Wins:`));
    for (const opp of patterns.optimizationOpportunities.slice(0, 3)) {
      console.log(`     • ${opp.description}`);
      if (opp.estimatedGain) {
        console.log(chalk.green(`        Potential gain: ${opp.estimatedGain}`));
      }
    }
    console.log('');
  }

  // Missing optimizations
  const missingPatterns = patternTypes.filter(p => !patterns[p]?.detected);
  if (missingPatterns.length > 0) {
    console.log(`  ${indicators.info} Potential Optimizations Not Detected:`);
    const recommendations = {
      'retry': 'Add retry logic with exponential backoff',
      'batching': 'Batch requests to reduce API calls',
      'streaming': 'Use streaming for real-time responses',
      'caching': 'Implement response caching',
      'routing': 'Add intelligent model routing',
      'fallback': 'Implement provider fallback chains',
      'guardrails': 'Add input/output validation'
    };

    for (const pattern of missingPatterns.slice(0, 3)) {
      console.log(`     • ${recommendations[pattern as keyof typeof recommendations]}`);
    }
    console.log('');
  }

  // Usage distribution (if available from extended analysis)
  if (patterns.usageDistribution) {
    console.log(`  📊 Usage Distribution:`);

    // Model usage
    if (patterns.usageDistribution.byModel) {
      const models = Object.entries(patterns.usageDistribution.byModel)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 5);

      if (models.length > 0) {
        console.log(`     Models:`);
        for (const [model, count] of models) {
          const bar = createBar(count as number, Math.max(...models.map(m => m[1] as number)), 20);
          console.log(`       ${model.padEnd(20)} ${bar} ${count}`);
        }
      }
    }

    // Provider usage
    if (patterns.usageDistribution.byProvider) {
      const providers = Object.entries(patterns.usageDistribution.byProvider)
        .sort(([, a], [, b]) => (b as number) - (a as number));

      if (providers.length > 0) {
        console.log(`     Providers:`);
        for (const [provider, count] of providers) {
          console.log(`       • ${theme.provider(provider)}: ${count} calls`);
        }
      }
    }
    console.log('');
  }

  // Common prompts (if available from extended analysis)
  if (patterns.commonPrompts && patterns.commonPrompts.length > 0) {
    console.log(`  💬 Common Prompt Types:`);
    for (const prompt of patterns.commonPrompts.slice(0, 3)) {
      console.log(`     • ${prompt.type || prompt.category || 'General'}: ${prompt.count} occurrences`);
      if (prompt.example) {
        const truncated = prompt.example.length > 50
          ? prompt.example.substring(0, 50) + '...'
          : prompt.example;
        console.log(chalk.dim(`        "${truncated}"`));
      }
    }
    console.log('');
  }
}

// =============================================================================
// RISK RENDERING
// =============================================================================

/**
 * Render risk assessment with severity levels.
 */
export function renderRiskSummary(assessment: RiskAssessment): void {
  if (!assessment.risks || assessment.risks.length === 0) {
    console.log(chalk.green(`\n  ${indicators.success} No significant risks detected\n`));
    return;
  }

  const overallRisk = (assessment as any).overallRisk ||
    (assessment.summary && typeof assessment.summary === 'object' &&
     'overallRisk' in assessment.summary ?
     (assessment.summary as any).overallRisk : 'low');
  const riskIcon = getRiskIcon(overallRisk);
  const riskColor = getRiskColor(overallRisk);

  console.log(chalk.bold(`\n  ${riskIcon} Risk Assessment: ${riskColor(overallRisk.toUpperCase())}\n`));

  // Group risks by severity
  const risksBySeverity = new Map<string, any[]>();
  for (const risk of assessment.risks) {
    const severity = risk.severity || 'medium';
    if (!risksBySeverity.has(severity)) {
      risksBySeverity.set(severity, []);
    }
    risksBySeverity.get(severity)!.push(risk);
  }

  // Show risks by severity
  const severityOrder = ['critical', 'high', 'medium', 'low'];
  for (const severity of severityOrder) {
    const risks = risksBySeverity.get(severity);
    if (!risks || risks.length === 0) continue;

    const icon = getRiskIcon(severity);
    const color = getRiskColor(severity);

    console.log(color(`  ${icon} ${severity.charAt(0).toUpperCase() + severity.slice(1)} Risk Issues:`));

    for (const risk of risks.slice(0, 3)) {
      console.log(`     • ${risk.description || risk.issue || risk.name}`);
      if (risk.impact) {
        console.log(chalk.dim(`        Impact: ${risk.impact}`));
      }
      if (risk.recommendation) {
        console.log(chalk.cyan(`        → ${risk.recommendation}`));
      }
    }

    if (risks.length > 3) {
      console.log(chalk.dim(`     ... and ${risks.length - 3} more ${severity} risks`));
    }
    console.log('');
  }

  // Mitigation summary
  const mitigations = (assessment as any).mitigationStrategies;
  if (mitigations && mitigations.length > 0) {
    console.log(chalk.cyan(`  💡 Recommended Mitigations:`));
    for (const strategy of mitigations.slice(0, 3)) {
      console.log(`     → ${strategy}`);
    }
    console.log('');
  }
}

// =============================================================================
// OPTIMIZATION OPPORTUNITIES
// =============================================================================

/**
 * Render optimization opportunities with actionable items.
 */
export function renderOptimizationOpportunities(summary: RecommendationSummary): void {
  if (!summary.recommendations || summary.recommendations.length === 0) {
    return;
  }

  console.log(chalk.bold(`\n  ${indicators.strategic} Optimization Opportunities\n`));

  // Summary metrics
  const totalSavings = (summary as any).totalSavings || (summary as any).totalPotentialSavings || 0;
  if (totalSavings > 0) {
    console.log(chalk.green(`  💰 Total Potential Savings: ${format.cost(totalSavings)}/month\n`));
  }

  // Quick wins
  const quickWins = summary.recommendations.filter((r: any) =>
    r.effort === 'low' || r.priority === 'high' || r.category === 'quick-win'
  );

  if (quickWins.length > 0) {
    console.log(chalk.cyan(`  ${indicators.quickWin} Quick Wins (Low effort, High impact):`));
    for (const rec of quickWins.slice(0, 3)) {
      renderRecommendation(rec);
    }
    console.log('');
  }

  // Strategic initiatives
  const strategic = summary.recommendations.filter((r: any) =>
    r.effort === 'high' || r.category === 'strategic' || r.impact === 'high'
  );

  if (strategic.length > 0) {
    console.log(chalk.magenta(`  ${indicators.strategic} Strategic Initiatives:`));
    for (const rec of strategic.slice(0, 3)) {
      renderRecommendation(rec);
    }
    console.log('');
  }

  // Action items
  console.log(chalk.bold(`  📋 Next Steps:`));
  console.log(`     1. Review the detailed report: ${chalk.cyan('peakinfer-recommendations.json')}`);
  console.log(`     2. Prioritize quick wins for immediate savings`);
  console.log(`     3. Plan strategic initiatives for long-term optimization`);
  console.log(`     4. Run ${chalk.cyan('peakinfer templates list')} to explore optimization templates`);
  console.log('');
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Render a single recommendation.
 */
function renderRecommendation(rec: any): void {
  const gain = rec.estimatedGain || rec.monthlyGain || 0;
  const gainStr = gain > 0 ? chalk.green(`${gain.toFixed(0)} tps/mo`) : '';

  console.log(`     • ${rec.title || rec.name || rec.description}`);

  if (gainStr) {
    console.log(`        Performance Gain: ${gainStr}`);
  }

  if (rec.implementation) {
    const impl = Array.isArray(rec.implementation)
      ? rec.implementation[0]
      : rec.implementation;
    console.log(chalk.dim(`        How: ${impl}`));
  }

  if (rec.effort) {
    const effortIcon = rec.effort === 'low' ? '⚡' : rec.effort === 'high' ? '🔨' : '⚙️';
    console.log(chalk.dim(`        Effort: ${effortIcon} ${rec.effort}`));
  }
}

/**
 * Get pattern severity icon.
 */
function getPatternIcon(severity?: string): string {
  switch (severity) {
    case 'high':
    case 'critical':
      return indicators.highUsage;
    case 'medium':
      return indicators.mediumUsage;
    default:
      return indicators.lowUsage;
  }
}

/**
 * Get risk severity icon.
 */
function getRiskIcon(severity: string): string {
  switch (severity) {
    case 'critical':
      return indicators.critical;
    case 'high':
      return indicators.high;
    case 'medium':
      return indicators.medium;
    case 'low':
      return indicators.low;
    default:
      return indicators.info;
  }
}

/**
 * Get risk color based on severity.
 */
function getRiskColor(severity: string): typeof chalk {
  switch (severity) {
    case 'critical':
      return chalk.red.bold;
    case 'high':
      return chalk.red;
    case 'medium':
      return chalk.yellow;
    case 'low':
      return chalk.green;
    default:
      return chalk.gray;
  }
}

/**
 * Create a simple bar chart.
 */
function createBar(value: number, max: number, width: number): string {
  const percentage = value / max;
  const filled = Math.floor(percentage * width);
  const empty = width - filled;

  return chalk.cyan('█').repeat(filled) + chalk.gray('░').repeat(empty);
}

/**
 * Format a percentage with color.
 */
export function formatPercentage(value: number): string {
  if (value >= 80) {
    return chalk.red(`${value.toFixed(1)}%`);
  } else if (value >= 50) {
    return chalk.yellow(`${value.toFixed(1)}%`);
  } else {
    return chalk.green(`${value.toFixed(1)}%`);
  }
}

/**
 * Format cost with indicators.
 */
export function formatCostWithIndicator(cost: number): string {
  let icon = '';
  if (cost >= 10000) {
    icon = indicators.expensive + ' ';
  } else if (cost >= 1000) {
    icon = indicators.moderate + ' ';
  } else if (cost >= 100) {
    icon = indicators.cheap + ' ';
  }

  return icon + format.cost(cost);
}