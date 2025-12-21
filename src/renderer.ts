import type { ExecutionPlan, PlannedTask, TaskResult, Insight, JoinedOutput, RuntimeSummary, InferenceMap, StackLayer, ComparisonResult, PredictionResult, CounterfactualResult } from './types.js';
import type { AgentResults } from './agent.js';
import { VERSION_DISPLAY } from './version.js';
import { formatImpactSummary, type ImpactSummary } from './impact.js';
import ora, { type Ora } from 'ora';
import chalk from 'chalk';

// =============================================================================
// CONSTANTS
// =============================================================================

const VERSION = VERSION_DISPLAY;

// Severity markers (no emojis)
const SEVERITY_MARKER = {
  critical: '[!]',
  warning: '[*]',
  info: '[-]',
};

// Julie Zhou State Labels
const STATE = {
  ZERO: 'zero',
  LOADING: 'loading',
  PARTIAL: 'partial',
  ERROR: 'error',
  SUCCESS: 'success',
  RESUMED: 'resumed',
} as const;

// Progress phases - Julie Zhou aligned (DD Section 6.4)
// "Progress should be phase-based (not noisy per-file spam)"
// "Use stable phase names across runs"
// Lowercase, calm copy per peakinfer design
const PHASE = {
  SCANNING: 'scanning files',
  ANALYZING: 'analyzing codebase',
  PROFILING: 'profiling performance',
  PARSING: 'parsing events',
  CORRELATING: 'correlating code + runtime',
  GENERATING: 'generating insights',
} as const;

// Progress bar characters (intuitive visual feedback)
const BAR_FILLED = '█';
const BAR_EMPTY = '░';
const BAR_WIDTH = 10;

type PhaseKey = keyof typeof PHASE;

// =============================================================================
// HELPERS
// =============================================================================

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function dim(text: string): string {
  return `\x1b[2m${text}\x1b[0m`;
}

function bold(text: string): string {
  return `\x1b[1m${text}\x1b[0m`;
}

function green(text: string): string {
  return `\x1b[32m${text}\x1b[0m`;
}

function red(text: string): string {
  return `\x1b[31m${text}\x1b[0m`;
}

function yellow(text: string): string {
  return `\x1b[33m${text}\x1b[0m`;
}

// =============================================================================
// COMPARISON RENDERER (v1.5)
// =============================================================================

/**
 * Render historical comparison results.
 * Shows what changed prominently at the top.
 */
function renderComparison(comparison: ComparisonResult): void {
  const { metrics, insightDeltas } = comparison;

  // Header with date context
  const baseDate = new Date(comparison.baseTimestamp).toLocaleDateString();
  console.log(bold('Changes since last run') + dim(` (${baseDate})`));
  console.log('');

  // Summary line
  const delta = metrics.netChange;
  const deltaStr = delta > 0 ? green(`+${delta}`) : delta < 0 ? red(`${delta}`) : dim('0');
  console.log(`  Inference points: ${metrics.totalBefore} → ${metrics.totalAfter} (${deltaStr})`);
  console.log('');

  // Show changes if any
  const hasChanges = metrics.addedCount > 0 || metrics.removedCount > 0 || metrics.changedCount > 0;

  if (hasChanges) {
    if (metrics.addedCount > 0) {
      console.log(`  ${green('+')} ${metrics.addedCount} new inference point${metrics.addedCount !== 1 ? 's' : ''}`);
      // Show first few added locations
      for (const added of comparison.added.slice(0, 3)) {
        console.log(`      ${dim(added.file + ':' + added.line)}`);
      }
      if (comparison.added.length > 3) {
        console.log(`      ${dim(`... and ${comparison.added.length - 3} more`)}`);
      }
    }

    if (metrics.removedCount > 0) {
      console.log(`  ${red('-')} ${metrics.removedCount} removed inference point${metrics.removedCount !== 1 ? 's' : ''}`);
      for (const removed of comparison.removed.slice(0, 3)) {
        console.log(`      ${dim(removed.file + ':' + removed.line)}`);
      }
      if (comparison.removed.length > 3) {
        console.log(`      ${dim(`... and ${comparison.removed.length - 3} more`)}`);
      }
    }

    if (metrics.changedCount > 0) {
      console.log(`  ${yellow('~')} ${metrics.changedCount} modified inference point${metrics.changedCount !== 1 ? 's' : ''}`);
      for (const changed of comparison.changed.slice(0, 3)) {
        const changeDesc = changed.changes.map(c => c.field).join(', ');
        console.log(`      ${dim(changed.point.file + ':' + changed.point.line)} ${dim('(' + changeDesc + ')')}`);
      }
      if (comparison.changed.length > 3) {
        console.log(`      ${dim(`... and ${comparison.changed.length - 3} more`)}`);
      }
    }
    console.log('');
  } else {
    console.log(`  ${dim('No changes detected')}`);
    console.log('');
  }

  // Insight deltas (if available)
  if (insightDeltas) {
    const hasInsightChanges = insightDeltas.newCritical > 0 ||
                              insightDeltas.resolvedCritical > 0 ||
                              insightDeltas.newWarnings > 0 ||
                              insightDeltas.resolvedWarnings > 0;

    if (hasInsightChanges) {
      console.log(dim('Issue changes'));
      if (insightDeltas.newCritical > 0) {
        console.log(`  ${red('[!]')} ${insightDeltas.newCritical} new critical issue${insightDeltas.newCritical !== 1 ? 's' : ''}`);
      }
      if (insightDeltas.resolvedCritical > 0) {
        console.log(`  ${green('[✓]')} ${insightDeltas.resolvedCritical} critical issue${insightDeltas.resolvedCritical !== 1 ? 's' : ''} resolved`);
      }
      if (insightDeltas.newWarnings > 0) {
        console.log(`  ${yellow('[*]')} ${insightDeltas.newWarnings} new warning${insightDeltas.newWarnings !== 1 ? 's' : ''}`);
      }
      if (insightDeltas.resolvedWarnings > 0) {
        console.log(`  ${green('[✓]')} ${insightDeltas.resolvedWarnings} warning${insightDeltas.resolvedWarnings !== 1 ? 's' : ''} resolved`);
      }
      console.log('');
    }
  }
}

// =============================================================================
// PREDICTION RENDERER (v1.5)
// =============================================================================

/**
 * Render deploy-time latency predictions.
 * Surfaces potential performance risks before deployment.
 */
function renderPrediction(prediction: PredictionResult): void {
  const { predictions, summary, targetP95 } = prediction;

  // Header with deploy-time anxiety framing
  console.log(bold('Deploy-time Prediction'));
  console.log('');

  // Summary line with risk counts
  if (summary.highRiskCount > 0) {
    console.log(`  ${red('[!]')} ${summary.highRiskCount} high-risk inference point${summary.highRiskCount !== 1 ? 's' : ''} (p95 > 5000ms)`);
  }
  if (summary.mediumRiskCount > 0) {
    console.log(`  ${yellow('[*]')} ${summary.mediumRiskCount} medium-risk inference point${summary.mediumRiskCount !== 1 ? 's' : ''} (p95 > 2000ms)`);
  }
  if (summary.lowRiskCount > 0) {
    console.log(`  ${dim('[-]')} ${summary.lowRiskCount} low-risk inference point${summary.lowRiskCount !== 1 ? 's' : ''}`);
  }

  const neutralCount = summary.totalPoints - summary.highRiskCount - summary.mediumRiskCount - summary.lowRiskCount;
  if (neutralCount > 0) {
    console.log(`  ${dim('[✓]')} ${neutralCount} within acceptable latency`);
  }
  console.log('');

  // Show worst predictions
  const sortedByRisk = [...predictions].sort((a, b) => b.riskScore - a.riskScore);
  const riskyPredictions = sortedByRisk.filter(p => p.risk === 'high' || p.risk === 'medium').slice(0, 5);

  if (riskyPredictions.length > 0) {
    console.log(dim('Top latency risks'));
    for (const pred of riskyPredictions) {
      const riskMarker = pred.risk === 'high' ? red('[!]') : yellow('[*]');
      const modelInfo = pred.model ? dim(` (${pred.model})`) : '';
      console.log(`  ${riskMarker} ${pred.location}${modelInfo}`);
      console.log(`      p95: ${pred.predictedLatency.p95}ms | p99: ${pred.predictedLatency.p99}ms`);
    }
    console.log('');
  }

  // Latency budget check
  if (targetP95 !== undefined) {
    if (summary.budgetExceeded) {
      console.log(`  ${red('[!]')} Budget exceeded: worst p95 ${summary.worstP95}ms > target ${targetP95}ms`);
    } else {
      console.log(`  ${green('[✓]')} Within budget: worst p95 ${summary.worstP95}ms ≤ target ${targetP95}ms`);
    }
    console.log('');
  }

  // Overall stats
  console.log(dim('Latency estimates'));
  console.log(`  Average p95: ${summary.averageP95}ms`);
  console.log(`  Worst p95: ${summary.worstP95}ms`);
  console.log('');
}

// =============================================================================
// COUNTERFACTUAL RENDERER (v1.5)
// =============================================================================

/**
 * Render counterfactual "what if" optimization scenarios.
 * Shows the road not taken and its potential impact.
 */
function renderCounterfactuals(counterfactuals: CounterfactualResult): void {
  const { counterfactuals: items, summary } = counterfactuals;

  if (summary.totalOpportunities === 0) return;

  console.log(bold('Optimization Opportunities'));
  console.log('');

  // Summary line
  const savingsInfo: string[] = [];
  if (summary.maxLatencySavingsPercent > 0) {
    savingsInfo.push(`up to ${summary.maxLatencySavingsPercent}% latency reduction`);
  }
  if (summary.maxCostSavingsPercent > 0) {
    savingsInfo.push(`up to ${summary.maxCostSavingsPercent}% cost savings`);
  }

  console.log(`  ${summary.totalOpportunities} opportunities: ${savingsInfo.join(', ')}`);
  console.log('');

  // Show top opportunities (up to 5)
  const topItems = items.slice(0, 5);

  for (const cf of topItems) {
    // Format impact
    const impactParts: string[] = [];
    if (cf.impact.latencyDeltaPercent < 0) {
      impactParts.push(green(`${cf.impact.latencyDeltaPercent}% latency`));
    }
    if (cf.impact.costDeltaPercent < 0) {
      impactParts.push(green(`${cf.impact.costDeltaPercent}% cost`));
    }
    const impactStr = impactParts.length > 0 ? impactParts.join(', ') : dim('neutral');

    // Effort indicator
    const effortMarker = cf.effort === 'low' ? dim('[easy]') :
                         cf.effort === 'medium' ? dim('[moderate]') :
                         dim('[complex]');

    console.log(`  ${bold(cf.headline)} ${effortMarker}`);
    console.log(`      Impact: ${impactStr}`);

    // Show tradeoffs for first few
    if (cf.impact.tradeoffs.length > 0 && topItems.indexOf(cf) < 3) {
      console.log(`      ${dim('Tradeoff: ' + cf.impact.tradeoffs[0])}`);
    }

    console.log('');
  }

  if (items.length > 5) {
    console.log(dim(`  ... and ${items.length - 5} more opportunities`));
    console.log('');
  }
}

// =============================================================================
// STATE RENDERERS
// =============================================================================

/**
 * ZERO STATE: No inference usage detected
 * Julie Zhou: calm, helpful, not alarming
 */
function renderZeroState(): void {
  console.log('');
  console.log('no inference usage detected.');
  console.log('');
  console.log(dim('checked for:'));
  console.log('  common providers (openai, anthropic, google, together, fireworks...)');
  console.log('  frameworks (langchain, llamaindex, dspy...)');
  console.log('  self-hosted runtimes (vllm, sglang, ollama, tgi...)');
  console.log('');
  console.log(dim('if you expected results:'));
  console.log('  check wrapper modules or custom client abstractions');
  console.log('  check dynamic imports or runtime configuration');
  console.log('');
}

/**
 * LOADING STATE: Show plan
 * Julie Zhou: visible only in verbose mode, calm formatting
 */
function renderPlan(plan: ExecutionPlan): void {
  console.log('');
  console.log(dim('planning'));
  for (const task of plan.tasks) {
    console.log(`  [${task.id}/${plan.tasks.length}] ${task.description.toLowerCase()}`);
  }
  console.log('');
}

/**
 * PROGRESS STATE: Task started
 */
function renderTaskStart(task: PlannedTask, totalTasks: number): void {
  process.stdout.write(`  [${task.id}/${totalTasks}] ${task.description}...`);
}

/**
 * PROGRESS STATE: Task completed
 */
function renderTaskComplete(result: TaskResult): void {
  if (result.status === 'success') {
    console.log(` ${dim(`(${result.durationMs}ms)`)}`);
  } else {
    console.log(` ${dim('failed')}`);
  }
}

/**
 * PARTIAL STATE: Some results with warnings
 * Julie Zhou: calm, informative
 */
function renderPartialState(warnings: string[]): void {
  console.log(dim('partial results'));
  console.log('');
  for (const warning of warnings) {
    console.log(`  ${warning.toLowerCase()}`);
  }
  console.log('');
  console.log('results are valid for analyzed files.');
  console.log('');
}

/**
 * RESUMED STATE: Using cached results from previous run
 * Julie Zhou: calm, informative
 */
function renderResumed(runId: string): void {
  console.log(dim(`loading cached analysis... (run: ${runId})`));
  console.log('');
}

/**
 * ERROR STATE: Actionable error message
 * Julie Zhou: clear, helpful, not alarming
 */
function renderError(error: Error, context?: { file?: string; line?: number; field?: string }): void {
  console.log('');
  console.log(`error: ${error.message.toLowerCase()}`);
  console.log('');
  if (context) {
    if (context.file) console.log(`  file: ${context.file}`);
    if (context.line) console.log(`  line: ${context.line}`);
    if (context.field) console.log(`  missing: ${context.field}`);
  }
  console.log('');
}

/**
 * SUCCESS STATE: Full results
 * v1.5 Output Order (decision-relevant first):
 * 1. Historical Comparison (if --compare) - what changed since last run
 * 2. Deploy-Time Prediction (if --predict) - latency risk before deploy
 * 3. Counterfactual Insights - what-if optimization scenarios
 * 4. Code-Runtime Drift (if combined) - code/runtime mismatch
 * 5. BLUF Summary (headroom totals) - the bottom line
 * 6. Headroom by layer + Quick Wins + Strategic
 * 7. Scope (what was analyzed)
 * 8. Performance Profile (if static)
 * 9. Runtime (if events)
 * 10. Run info
 * 11. Findings (detailed evidence)
 * 12. Saved artifacts + Next steps
 */
function renderSuccess(results: AgentResults, opts: { showFixes?: boolean } = {}): void {
  // Show warnings if partial state
  if (results.warnings && results.warnings.length > 0) {
    renderPartialState(results.warnings);
  }

  // v1.5: Show comparison first (what changed since last time?)
  if (results.comparison) {
    renderComparison(results.comparison);
  }

  // v1.5: Show prediction (deploy-time risk assessment)
  if (results.prediction) {
    renderPrediction(results.prediction);
  }

  // v1.5: Show counterfactuals (optimization opportunities)
  if (results.counterfactuals) {
    renderCounterfactuals(results.counterfactuals);
  }

  // v1.5: Drift detection early (code-runtime mismatch detection)
  if (results.joined && results.joined.drift.length > 0) {
    console.log(bold('Code-Runtime Drift'));
    console.log('');
    const codeOnly = results.joined.codeOnly.length;
    const runtimeOnly = results.joined.runtimeOnly.length;
    if (codeOnly > 0) {
      console.log(`  ${yellow('[*]')} ${codeOnly} inference point${codeOnly !== 1 ? 's' : ''} in code but not in runtime`);
      console.log(dim('      (dead code? not yet deployed?)'));
    }
    if (runtimeOnly > 0) {
      console.log(`  ${red('[!]')} ${runtimeOnly} runtime event${runtimeOnly !== 1 ? 's' : ''} not mapped to code`);
      console.log(dim('      (dynamic calls? wrapper functions?)'));
    }
    console.log('');
  }

  // 1. BLUF: One-liner with potential improvement
  const callsiteCount = results.inferenceMap?.summary.totalCallsites || 0;
  const findingCount = results.insights.length;

  if (results.impactSummary) {
    const { costReductionPercent, latencyReductionPercent, throughputGainPercent } = results.impactSummary.totalPotentialImpact;
    const hasHeadroom = costReductionPercent > 0 || latencyReductionPercent > 0 || throughputGainPercent > 0;

    if (hasHeadroom) {
      const parts: string[] = [];
      if (costReductionPercent > 0) parts.push(`${bold(`-${costReductionPercent}%`)} cost`);
      if (latencyReductionPercent > 0) parts.push(`${bold(`-${latencyReductionPercent}%`)} latency`);
      if (throughputGainPercent > 0) parts.push(`${bold(`+${throughputGainPercent}%`)} throughput`);
      console.log(`${bold('Potential Performance Improvement')} across ${callsiteCount} inference points`);
      console.log(`  ${parts.join('  |  ')}`);
      console.log('');
    }
  } else {
    console.log(`${bold(`${findingCount} findings`)} across ${callsiteCount} inference points`);
    console.log('');
  }

  // 2. Headroom by layer + Quick Wins + Strategic
  if (results.impactSummary) {
    console.log(formatImpactSummary(results.impactSummary));
    console.log('');
  }

  // 3. Scope (what was analyzed)
  console.log(dim('Scope'));
  if (results.inferenceMap) {
    const map = results.inferenceMap;
    console.log(`  Inference Points: ${map.summary.totalCallsites}`);
    // Filter out 'unknown' and empty values for cleaner output
    const providers = map.summary.providers.filter(p => p && p !== 'unknown');
    const models = map.summary.models.filter(m => m && m !== 'unknown' && !m.includes('DEFAULT'));
    if (providers.length > 0) {
      console.log(`  Providers: ${providers.join(', ')}`);
    }
    if (models.length > 0) {
      console.log(`  Models: ${models.slice(0, 5).join(', ')}${models.length > 5 ? '...' : ''}`);
    }
  }
  if (results.joined) {
    const matchedCount = results.joined.callsites.filter(c => 'usage' in c && c.usage).length;
    console.log(`  Matched: ${matchedCount} of ${results.joined.callsites.length} inference points`);
  }
  console.log('');

  // 4. Performance Profile (if static analysis ran)
  if (results.staticAnalysis) {
    const sa = results.staticAnalysis;
    console.log(dim('Performance Profile'));
    console.log(`  Cost: $${sa.summary.estimated_cost_per_1k_calls.toFixed(2)}/1K calls`);
    if (sa.summary.cost_risk_high > 0) {
      console.log(`    ${sa.summary.cost_risk_high} high-risk inference points`);
    }
    console.log(`  Latency: p95=${sa.summary.estimated_p95_ms}ms`);
    if (sa.summary.blocking_calls > 0) {
      console.log(`    ${sa.summary.blocking_calls} blocking calls`);
    }
    console.log(`  Throughput: ${sa.summary.has_rate_limiting} with rate limiting`);
    if (sa.summary.scaling_bottlenecks > 0) {
      console.log(`    ${sa.summary.scaling_bottlenecks} scaling bottlenecks`);
    }
    console.log(`  Reliability: ${sa.summary.overall_reliability}`);
    if (sa.summary.anti_patterns_found > 0) {
      console.log(`    ${sa.summary.anti_patterns_found} anti-patterns found`);
    }
    console.log(`  Optimizations: ${sa.summary.total_optimizations} (${sa.summary.critical_optimizations} critical)`);
    console.log('');
  }

  // 5. Runtime summary (if events)
  if (results.runtimeSummary) {
    const rt = results.runtimeSummary;
    console.log(dim('Runtime'));
    console.log(`  Events: ${formatNumber(rt.totalEvents)}`);
    console.log(`  Latency: p50=${rt.global.p50}ms  p95=${rt.global.p95}ms  p99=${rt.global.p99}ms`);
    console.log('');
  }

  // 5. Run info
  if (results.runId) {
    console.log(dim('Run'));
    console.log(`  ID: ${results.runId}${results.resumed ? ' (cached)' : ''}`);
    console.log('');
  }

  // 6. Findings (sorted by impact - highest first)
  if (results.insights.length > 0) {
    // Sort by impact percentage descending
    const sortedInsights = [...results.insights].sort((a, b) => {
      const impactA = a.impact?.estimatedImpactPercent || 0;
      const impactB = b.impact?.estimatedImpactPercent || 0;
      return impactB - impactA;
    });

    // Group findings by recommendation to avoid noisy repetition
    // Julie Zhou: "Progress should be phase-based (not noisy per-file spam)"
    const grouped = new Map<string, {
      recommendation: string;
      severity: string;
      layer: string;
      impactType: string;
      impactPercent: number;
      locations: string[];
      fixes: string[];  // v1.8: Track suggested fixes
    }>();

    for (const insight of sortedInsights) {
      const recommendation = insight.impact?.assumptions || insight.headline;
      if (!grouped.has(recommendation)) {
        grouped.set(recommendation, {
          recommendation,
          severity: insight.severity,
          layer: insight.impact?.layer || '',
          impactType: insight.impact?.impactType || 'improvement',
          impactPercent: insight.impact?.estimatedImpactPercent || 0,
          locations: [],
          fixes: [],
        });
      }
      if (insight.location) {
        grouped.get(recommendation)!.locations.push(insight.location);
      }
      // v1.8: Collect suggested fixes (access via type assertion since field is optional)
      const suggestedFix = (insight as unknown as { suggestedFix?: string }).suggestedFix;
      if (suggestedFix && !grouped.get(recommendation)!.fixes.includes(suggestedFix)) {
        grouped.get(recommendation)!.fixes.push(suggestedFix);
      }
    }

    // Sort by impact
    const sortedGroups = Array.from(grouped.values()).sort((a, b) => b.impactPercent - a.impactPercent);

    console.log(dim('Findings'));
    for (const group of sortedGroups) {
      const marker = SEVERITY_MARKER[group.severity as keyof typeof SEVERITY_MARKER] || '[-]';
      const typeLabel = group.impactType === 'cost' ? 'cost reduction'
        : group.impactType === 'latency' ? 'latency reduction'
        : group.impactType;
      const impactTag = group.layer
        ? ` ${dim(`[${group.layer}] ${group.impactPercent}% ${typeLabel}`)}`
        : '';
      const count = group.locations.length;
      console.log(`  ${marker} ${group.recommendation}${impactTag}`);
      console.log(`      ${dim(`${count} inference point${count !== 1 ? 's' : ''}`)}`);
      // v1.8: Show fix suggestions when --fixes flag is used
      if (opts.showFixes && group.fixes.length > 0) {
        const fix = group.fixes[0];  // Show first unique fix
        console.log(`      ${dim('Fix:')} ${fix}`);
      }
    }
    console.log('');
  } else {
    console.log(dim('Findings'));
    console.log('  No issues detected. Your inference setup looks good.');
    console.log('');
  }

  // 7. Saved artifacts + Next steps
  console.log(dim('Saved'));
  console.log('  .peakinfer/inferencemap.json');
  console.log('  .peakinfer/insights.json');
  if (results.joined) {
    console.log('  .peakinfer/joined.json');
  }
  if (results.runtimeSummary) {
    console.log('  .peakinfer/runtime.json');
  }
  if (results.htmlPath) {
    console.log(`  ${results.htmlPath}`);
  }
  if (results.pdfPath) {
    console.log(`  ${results.pdfPath}`);
  }
  console.log('');

  // Next steps
  console.log(dim('Next'));
  // Prefer PDF in "open" suggestion if available
  if (results.pdfPath) {
    console.log(`  open ${results.pdfPath}`);
  } else if (results.htmlPath) {
    console.log(`  open ${results.htmlPath}`);
  }
  if (!results.runtimeSummary && results.inferenceMap) {
    console.log(`  peakinfer . --events <logs.jsonl>   (compare code vs runtime)`);
  }
  console.log('');
}

// =============================================================================
// PUBLIC API
// =============================================================================

export interface RendererOptions {
  verbose?: boolean;
  showFixes?: boolean;  // v1.8: Show code fix suggestions
}

// Progress data for user-meaningful updates
export interface ProgressData {
  phase: 'scanning' | 'analyzing' | 'profiling' | 'parsing' | 'correlating' | 'generating';
  detail?: string; // e.g., "847 files" or "23 inference points"
  percent?: number; // 0-100 for progress bar
  currentFile?: string; // current file being analyzed
}

// Render visual progress bar
function renderProgressBar(percent: number): string {
  const filled = Math.floor((percent / 100) * BAR_WIDTH);
  const empty = BAR_WIDTH - filled;
  return BAR_FILLED.repeat(filled) + BAR_EMPTY.repeat(empty);
}

/**
 * Julie Zhou TUI Design Implementation
 *
 * Key principles from DD Section 6.4:
 * - Progress should be phase-based (not noisy per-file spam)
 * - Use stable phase names across runs
 * - If a phase is slow, show a calm "still working" heartbeat, not a flood
 *
 * From DD Section 8.1:
 * - "Planning…" appears briefly only in --verbose
 * - Default mode shows stable phase progress
 */
export function createRenderer(opts: RendererOptions = {}) {
  let currentPlan: ExecutionPlan | null = null;
  let isResumed = false;
  let phaseNumber = 0;
  let totalPhases = 0;
  let currentPhase: string | null = null;
  let spinner: Ora | null = null;

  // Calculate user-visible phases (excludes internal tasks)
  function countUserPhases(plan: ExecutionPlan): number {
    const userPhases = new Set<string>();
    for (const task of plan.tasks) {
      const phase = getPhaseForTask(task);
      if (phase) userPhases.add(phase);
    }
    return userPhases.size;
  }

  // Map internal task types to user-meaningful phases
  function getPhaseForTask(task: PlannedTask): PhaseKey | null {
    if (task.description === 'Load pricing data') return null;
    if (task.description === 'Load cached results') return null;
    if (task.description === 'Profile performance') return 'PROFILING';
    if (task.type === 'scan') return 'SCANNING';
    if (task.type === 'analyze') return 'ANALYZING';
    if (task.type === 'parse_events') return 'PARSING';
    if (task.type === 'join') return 'CORRELATING';
    if (task.type === 'load_templates') return null;
    if (task.type === 'generate_insights') return 'GENERATING';
    if (task.type === 'generate_html') return null; // Part of save
    if (task.type === 'save_artifacts') return null; // Silent
    return null;
  }

  // Check if we're in a TTY (interactive terminal)
  const isTTY = process.stdout.isTTY;

  // Start ora spinner for smooth animation during slow phases
  // Shows progress bar at 0% immediately so users know progress tracking is active
  function startSpinner(phaseName: string): void {
    if (!isTTY) return;

    stopSpinner();

    // Build initial progress bar at 0%
    const bar = chalk.cyan('') + chalk.gray(BAR_EMPTY.repeat(BAR_WIDTH));
    const initialText = `${phaseName}... ${bar}   0%`;

    spinner = ora({
      text: initialText,
      spinner: 'dots',
      color: 'cyan',
    }).start();
  }

  function stopSpinner(): void {
    if (spinner) {
      spinner.stop();
      spinner = null;
    }
  }

  // Update spinner text with progress bar
  function updateSpinnerProgress(phaseName: string, percent: number, currentFile?: string): void {
    if (!spinner || !isTTY) return;

    const filled = Math.floor((percent / 100) * BAR_WIDTH);
    const empty = BAR_WIDTH - filled;
    const bar = chalk.cyan(BAR_FILLED.repeat(filled)) + chalk.gray(BAR_EMPTY.repeat(empty));
    const percentStr = `${percent}%`.padStart(4);

    let text = `${phaseName}... ${bar} ${percentStr}`;
    if (currentFile) {
      const fileDisplay = currentFile.length > 30
        ? '...' + currentFile.slice(-27)
        : currentFile;
      text += chalk.dim(` ${fileDisplay}`);
    }

    spinner.text = text;
  }

  return {
    renderHeader(): void {
      console.log(bold(VERSION));
      console.log('');
    },

    renderResumed(runId: string): void {
      isResumed = true;
      renderResumed(runId);
    },

    renderPlan(plan: ExecutionPlan): void {
      currentPlan = plan;
      totalPhases = countUserPhases(plan);

      if (isResumed) return;

      if (opts.verbose) {
        renderPlan(plan);
      }
      // Non-verbose: No planning output (DD Section 8.1)
      // "Planning…" appears briefly only in --verbose
    },

    renderTaskStart(task: PlannedTask): void {
      if (isResumed) return;

      const phaseKey = getPhaseForTask(task);
      if (!phaseKey) return; // Skip internal tasks

      const phaseName = PHASE[phaseKey];

      // Only show if new phase
      if (phaseName !== currentPhase) {
        stopSpinner();

        phaseNumber++;
        currentPhase = phaseName;

        if (opts.verbose && currentPlan) {
          // Verbose: numbered phases like DD Section 6.4
          process.stdout.write(`  ${phaseNumber}/${totalPhases} ${phaseName}...`);
        } else if (isTTY) {
          // Start ora spinner for smooth animation
          startSpinner(phaseName);
        }
        // Non-TTY: don't show start, only completion
      }
    },

    renderTaskComplete(task: PlannedTask, result: TaskResult): void {
      if (isResumed) return;

      const phaseKey = getPhaseForTask(task);
      if (!phaseKey) return;

      // Don't stop spinner here - let renderProgress handle completion

      if (opts.verbose) {
        renderTaskComplete(result);
      }
      // Non-verbose: phase completion shown via renderProgress
    },

    // Julie Zhou: Progress with meaningful completion data
    // Enhanced with ora spinner and progress bar from peakinfer patterns
    renderProgress(data: ProgressData): void {
      if (isResumed) return;

      const phaseLabel = {
        scanning: PHASE.SCANNING,
        analyzing: PHASE.ANALYZING,
        profiling: PHASE.PROFILING,
        parsing: PHASE.PARSING,
        correlating: PHASE.CORRELATING,
        generating: PHASE.GENERATING,
      }[data.phase];

      // If percent provided, this is a progress update (not completion)
      // Update spinner if available, otherwise just skip (can't show progress bar in non-TTY)
      if (data.percent !== undefined) {
        if (isTTY && spinner) {
          updateSpinnerProgress(phaseLabel, data.percent, data.currentFile);
        }
        return; // Don't fall through to completion logic for progress updates
      }

      // Completion display (no percent = phase complete)
      if (spinner) {
        // Use ora's succeed for nice checkmark
        spinner.succeed(`${phaseLabel}... ${chalk.dim(data.detail || 'done')}`);
        spinner = null;
      } else if (opts.verbose) {
        // Verbose: show with duration-style detail
        console.log(`  ${phaseNumber}/${totalPhases} ${phaseLabel} ${dim(`(${data.detail || 'done'})`)}`);
      } else {
        // Non-verbose non-TTY: clean completion with checkmark
        console.log(`${phaseLabel}... ${dim(data.detail || 'done')} ✓`);
      }
    },

    renderPartial(warnings: string[]): void {
      stopSpinner();
      renderPartialState(warnings);
    },

    renderResults(results: AgentResults): void {
      stopSpinner();

      // Clear any remaining progress line
      if (currentPhase) {
        process.stdout.write('\r' + ' '.repeat(60) + '\r');
      }
      console.log('');

      // Check for zero state
      if (results.mode !== 'runtime' && (!results.callsites || results.callsites.length === 0)) {
        if (!results.insights || results.insights.length === 0) {
          renderZeroState();
          return;
        }
      }

      renderSuccess(results, { showFixes: opts.showFixes });
    },

    renderError(error: Error, context?: { file?: string; line?: number; field?: string }): void {
      if (spinner) {
        spinner.fail('Error');
        spinner = null;
      }
      renderError(error, context);
    },

    // Direct access for testing
    renderZeroState,
    renderPartialState,
  };
}

export type Renderer = ReturnType<typeof createRenderer>;
