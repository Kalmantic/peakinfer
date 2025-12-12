import type { ExecutionPlan, PlannedTask, TaskResult, Insight, JoinedOutput, RuntimeSummary, InferenceMap } from './types.js';
import type { AgentResults } from './agent.js';

// =============================================================================
// CONSTANTS
// =============================================================================

const VERSION = 'PeakInfer v1.0';

// Severity markers (no emojis)
const SEVERITY_MARKER = {
  critical: '[!]',
  warning: '[*]',
  info: '[-]',
};

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

// =============================================================================
// STATE RENDERERS
// =============================================================================

/**
 * ZERO STATE: No inference usage detected
 */
function renderZeroState(): void {
  console.log(bold(VERSION));
  console.log('');
  console.log('No inference usage detected.');
  console.log('');
  console.log(dim('Checked for:'));
  console.log('  Common providers (openai, anthropic, google, together, fireworks...)');
  console.log('  Frameworks (langchain, llamaindex, dspy...)');
  console.log('  Self-hosted runtimes (vllm, sglang, ollama, tgi...)');
  console.log('');
  console.log(dim('If you expected results:'));
  console.log('  Check wrapper modules or custom client abstractions');
  console.log('  Check dynamic imports or runtime configuration');
  console.log('');
}

/**
 * LOADING STATE: Show plan
 */
function renderPlan(plan: ExecutionPlan): void {
  console.log(bold(VERSION));
  console.log('');
  console.log(dim('Planning'));
  for (const task of plan.tasks) {
    console.log(`  [${task.id}/${plan.tasks.length}] ${task.description}`);
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
 */
function renderPartialState(warnings: string[]): void {
  console.log(dim('Partial results'));
  console.log('');
  for (const warning of warnings) {
    console.log(`  ${warning}`);
  }
  console.log('');
  console.log('Results are valid for analyzed files.');
  console.log('');
}

/**
 * ERROR STATE: Actionable error message
 */
function renderError(error: Error, context?: { file?: string; line?: number; field?: string }): void {
  console.log(bold(VERSION));
  console.log('');
  console.log(`Error: ${error.message}`);
  console.log('');
  if (context) {
    if (context.file) console.log(`  File: ${context.file}`);
    if (context.line) console.log(`  Line: ${context.line}`);
    if (context.field) console.log(`  Missing: ${context.field}`);
  }
  console.log('');
}

/**
 * SUCCESS STATE: Full results
 */
function renderSuccess(results: AgentResults): void {
  // 1. Findings (the value)
  if (results.insights.length > 0) {
    console.log(dim('Findings'));
    console.log('');
    for (const insight of results.insights) {
      const marker = SEVERITY_MARKER[insight.severity];
      console.log(`  ${marker} ${insight.headline}`);
      console.log(`      ${insight.evidence}`);
      if (insight.location) {
        console.log(`      ${dim(insight.location)}`);
      }
      console.log('');
    }
  } else {
    console.log(dim('Findings'));
    console.log('');
    console.log('  No issues detected. Your inference setup looks good.');
    console.log('');
  }

  // 2. Scope
  console.log(dim('Scope'));
  if (results.inferenceMap) {
    const map = results.inferenceMap;
    console.log(`  Callsites: ${map.summary.totalCallsites}`);
    if (map.summary.providers.length > 0) {
      console.log(`  Providers: ${map.summary.providers.join(', ')}`);
    }
    if (map.summary.models.length > 0) {
      console.log(`  Models: ${map.summary.models.slice(0, 5).join(', ')}${map.summary.models.length > 5 ? '...' : ''}`);
    }
  }
  if (results.joined) {
    console.log(`  Matched: ${results.joined.callsites.filter(c => 'usage' in c && c.usage).length}`);
    console.log(`  Drift signals: ${results.joined.drift.length}`);
  }
  console.log('');

  // 3. Runtime summary (if events)
  if (results.runtimeSummary) {
    const rt = results.runtimeSummary;
    console.log(dim('Runtime'));
    console.log(`  Events: ${formatNumber(rt.totalEvents)}`);
    console.log(`  Latency: p50=${rt.global.p50}ms  p95=${rt.global.p95}ms  p99=${rt.global.p99}ms`);
    console.log('');
  }

  // 4. Drift summary (if combined)
  if (results.joined && results.joined.drift.length > 0) {
    console.log(dim('Drift'));
    const codeOnly = results.joined.codeOnly.length;
    const runtimeOnly = results.joined.runtimeOnly.length;
    if (codeOnly > 0) console.log(`  Code-only: ${codeOnly} callsites`);
    if (runtimeOnly > 0) console.log(`  Runtime-only: ${runtimeOnly} events`);
    console.log('');
  }

  // 5. Saved artifacts
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
    console.log('');
    console.log(`View report: open ${results.htmlPath}`);
  }
  console.log('');
}

// =============================================================================
// PUBLIC API
// =============================================================================

export interface RendererOptions {
  verbose?: boolean;
}

export function createRenderer(opts: RendererOptions = {}) {
  let currentPlan: ExecutionPlan | null = null;

  return {
    renderHeader(): void {
      console.log(bold(VERSION));
      console.log('');
    },

    renderPlan(plan: ExecutionPlan): void {
      currentPlan = plan;
      if (opts.verbose) {
        renderPlan(plan);
      } else {
        console.log(dim('Planning'));
        console.log(`  ${plan.tasks.length} tasks`);
        console.log('');
        console.log(dim('Executing'));
      }
    },

    renderTaskStart(task: PlannedTask): void {
      if (opts.verbose && currentPlan) {
        renderTaskStart(task, currentPlan.tasks.length);
      }
    },

    renderTaskComplete(task: PlannedTask, result: TaskResult): void {
      if (opts.verbose) {
        renderTaskComplete(result);
      }
    },

    renderResults(results: AgentResults): void {
      if (!opts.verbose) {
        console.log('');
      }

      // Check for zero state
      if (results.mode !== 'runtime' && (!results.callsites || results.callsites.length === 0)) {
        renderZeroState();
        return;
      }

      renderSuccess(results);
    },

    renderError(error: Error, context?: { file?: string; line?: number; field?: string }): void {
      renderError(error, context);
    },

    renderZeroState,
    renderPartialState,
  };
}

export type Renderer = ReturnType<typeof createRenderer>;
