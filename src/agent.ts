import { existsSync, statSync } from 'fs';
import type { ExecutionPlan, PlannedTask, TaskResult, ScanResult, Callsite, InferenceEvent, JoinedOutput, Insight, RuntimeSummary, InferenceMap } from './types.js';
import { scan } from './scanner.js';
import { analyze } from './analyzer.js';
import { parseEvents, aggregate } from './runtime.js';
import { join } from './joiner.js';
import { loadTemplates } from './templates.js';
import { evaluate } from './insights.js';
import { ENVELOPES } from './envelopes.js';
import { loadPricing } from './costs.js';
import { saveArtifacts } from './artifacts.js';
import { generateHTML } from './html.js';

// =============================================================================
// TYPES
// =============================================================================

export interface AgentOptions {
  path: string;
  events?: string;
  html?: boolean;
  open?: boolean;
  offline?: boolean;
  verbose?: boolean;
}

export interface AgentCallbacks {
  onPlanReady?: (plan: ExecutionPlan) => void;
  onTaskStart?: (task: PlannedTask) => void;
  onTaskComplete?: (task: PlannedTask, result: TaskResult) => void;
  onComplete?: (results: AgentResults) => void;
  onError?: (error: Error) => void;
}

export interface AgentResults {
  mode: 'static' | 'runtime' | 'combined';
  scanResult?: ScanResult;
  callsites?: Callsite[];
  events?: InferenceEvent[];
  runtimeSummary?: RuntimeSummary;
  joined?: JoinedOutput;
  insights: Insight[];
  inferenceMap?: InferenceMap;
  htmlPath?: string;
}

// =============================================================================
// AGENT CONTEXT
// =============================================================================

interface AgentContext {
  opts: AgentOptions;
  scanResult?: ScanResult;
  callsites?: Callsite[];
  events?: InferenceEvent[];
  runtimeSummary?: RuntimeSummary;
  joined?: JoinedOutput;
  insights?: Insight[];
  inferenceMap?: InferenceMap;
  htmlContent?: string;
}

// =============================================================================
// PASS 1: PLAN
// =============================================================================

function detectMode(opts: AgentOptions): 'static' | 'runtime' | 'combined' {
  const isEventsFile = opts.path.endsWith('.jsonl') ||
                       opts.path.endsWith('.json') ||
                       opts.path.endsWith('.csv');

  if (isEventsFile && !opts.events) {
    return 'runtime';
  }
  if (!isEventsFile && opts.events) {
    return 'combined';
  }
  if (!isEventsFile && !opts.events) {
    return 'static';
  }
  return 'combined';
}

function isDirectory(path: string): boolean {
  try {
    return existsSync(path) && statSync(path).isDirectory();
  } catch {
    return false;
  }
}

export function plan(opts: AgentOptions): ExecutionPlan {
  const tasks: PlannedTask[] = [];
  let id = 1;
  const mode = detectMode(opts);

  // Always load pricing first
  tasks.push({
    id: id++,
    type: 'scan', // Reusing for pricing load
    description: 'Load pricing data',
  });

  if (mode === 'static' || mode === 'combined') {
    tasks.push({
      id: id++,
      type: 'scan',
      description: 'Scan repository',
    });
    tasks.push({
      id: id++,
      type: 'analyze',
      description: 'Analyze callsites',
      depends_on: [id - 1],
    });
  }

  if (mode === 'runtime' || mode === 'combined') {
    tasks.push({
      id: id++,
      type: 'parse_events',
      description: 'Parse runtime events',
    });
  }

  if (mode === 'combined') {
    tasks.push({
      id: id++,
      type: 'join',
      description: 'Correlate static + runtime',
    });
  }

  tasks.push({
    id: id++,
    type: 'load_templates',
    description: 'Load insight templates',
  });

  tasks.push({
    id: id++,
    type: 'generate_insights',
    description: 'Generate findings',
  });

  if (opts.html) {
    tasks.push({
      id: id++,
      type: 'generate_html',
      description: 'Generate HTML report',
    });
  }

  tasks.push({
    id: id++,
    type: 'save_artifacts',
    description: 'Save artifacts',
  });

  return { mode, tasks };
}

// =============================================================================
// PASS 2: EXECUTE
// =============================================================================

async function executeTask(
  task: PlannedTask,
  ctx: AgentContext,
  templates: Awaited<ReturnType<typeof loadTemplates>>
): Promise<void> {
  switch (task.type) {
    case 'scan':
      if (task.description === 'Load pricing data') {
        await loadPricing();
      } else {
        ctx.scanResult = await scan(ctx.opts.path);
      }
      break;

    case 'analyze':
      if (!ctx.scanResult) throw new Error('Scan result required');
      ctx.callsites = await analyze(ctx.scanResult);
      ctx.inferenceMap = buildInferenceMap(ctx.opts.path, ctx.callsites);
      break;

    case 'parse_events': {
      const eventsPath = ctx.opts.events || ctx.opts.path;
      ctx.events = await parseEvents(eventsPath);
      ctx.runtimeSummary = aggregate(ctx.events);
      break;
    }

    case 'join':
      if (!ctx.callsites || !ctx.events) throw new Error('Callsites and events required');
      ctx.joined = join(ctx.callsites, ctx.events);
      break;

    case 'load_templates':
      // Templates already loaded, just verify
      break;

    case 'generate_insights': {
      const data = ctx.joined || { callsites: ctx.callsites || [] };
      ctx.insights = evaluate(data, templates, ENVELOPES);
      break;
    }

    case 'generate_html':
      if (!ctx.inferenceMap) throw new Error('InferenceMap required for HTML');
      ctx.htmlContent = generateHTML({
        inferenceMap: ctx.inferenceMap,
        insights: ctx.insights || [],
        joined: ctx.joined,
        runtime: ctx.runtimeSummary,
      });
      break;

    case 'save_artifacts':
      saveArtifacts({
        inferenceMap: ctx.inferenceMap,
        insights: ctx.insights,
        joined: ctx.joined,
        runtime: ctx.runtimeSummary,
        html: ctx.htmlContent,
      });
      break;
  }
}

function buildInferenceMap(root: string, callsites: Callsite[]): InferenceMap {
  const providers = [...new Set(callsites.map(c => c.provider).filter(Boolean))] as string[];
  const models = [...new Set(callsites.map(c => c.model).filter(Boolean))] as string[];

  const patternCounts: Record<string, number> = {};
  for (const cs of callsites) {
    for (const [pattern, enabled] of Object.entries(cs.patterns)) {
      if (enabled) {
        patternCounts[pattern] = (patternCounts[pattern] || 0) + 1;
      }
    }
  }

  return {
    version: '1.0.0',
    root,
    generatedAt: new Date().toISOString(),
    summary: {
      totalCallsites: callsites.length,
      providers,
      models,
      patterns: patternCounts,
    },
    callsites,
  };
}

// =============================================================================
// PUBLIC API
// =============================================================================

export class Agent {
  private callbacks: AgentCallbacks;

  constructor(callbacks: AgentCallbacks = {}) {
    this.callbacks = callbacks;
  }

  async run(opts: AgentOptions): Promise<AgentResults> {
    const executionPlan = plan(opts);
    this.callbacks.onPlanReady?.(executionPlan);

    const ctx: AgentContext = { opts };
    const results: TaskResult[] = [];

    // Load templates once
    const templates = await loadTemplates({ offline: opts.offline });

    for (const task of executionPlan.tasks) {
      this.callbacks.onTaskStart?.(task);
      const startTime = Date.now();

      try {
        await executeTask(task, ctx, templates);

        const result: TaskResult = {
          taskId: task.id,
          status: 'success',
          durationMs: Date.now() - startTime,
        };
        results.push(result);
        this.callbacks.onTaskComplete?.(task, result);
      } catch (error) {
        const result: TaskResult = {
          taskId: task.id,
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
          durationMs: Date.now() - startTime,
        };
        results.push(result);
        this.callbacks.onTaskComplete?.(task, result);

        // Critical tasks abort execution
        if (['scan', 'analyze', 'parse_events'].includes(task.type)) {
          throw error;
        }
      }
    }

    const agentResults: AgentResults = {
      mode: executionPlan.mode,
      scanResult: ctx.scanResult,
      callsites: ctx.callsites,
      events: ctx.events,
      runtimeSummary: ctx.runtimeSummary,
      joined: ctx.joined,
      insights: ctx.insights || [],
      inferenceMap: ctx.inferenceMap,
      htmlPath: ctx.htmlContent ? '.peakinfer/report.html' : undefined,
    };

    this.callbacks.onComplete?.(agentResults);
    return agentResults;
  }
}
