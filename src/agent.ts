import { existsSync, statSync } from 'fs';
import { resolve } from 'path';
import type { ExecutionPlan, PlannedTask, TaskResult, ScanResult, Callsite, InferenceEvent, JoinedOutput, Insight, RuntimeSummary, InferenceMap, ImpactEstimate } from './types.js';
import { scan } from './scanner.js';
import { analyze, type LLMInsight } from './analyzer.js';
import { parseEvents, aggregate } from './runtime.js';
import { join } from './joiner.js';
import { loadTemplates, getDefaultPrompt, type AnalysisPrompt } from './templates.js';
import { evaluate } from './insights.js';
import { ENVELOPES } from './envelopes.js';
import { loadPricing } from './costs.js';
import { saveArtifacts, checkResumable, loadArtifacts, generateRunId, type ArtifactData } from './artifacts.js';
import { generateHTML } from './html.js';
import { generatePDF } from './pdf.js';
import { VERSION } from './version.js';
import { enrichInsightsWithImpact, generateImpactSummary, type ImpactSummary } from './impact.js';
// Agent SDK pattern (DESIGN.md v2.0 Section 2.1)
import { DiscoveryAgent, AnalyzerAgent, JoinerAgent, InsightAgent } from './agents/index.js';

// =============================================================================
// TYPES
// =============================================================================

export interface AgentOptions {
  path: string;
  events?: string;
  html?: boolean;
  pdf?: boolean;
  open?: boolean;
  offline?: boolean;
  verbose?: boolean;
  noCache?: boolean; // Force fresh analysis, ignore cached runs
  // Format detection options (PRD §6.4)
  formatHint?: string;            // User-specified format type
  fieldHints?: Record<string, string>; // User-specified field mappings
  lenient?: boolean;              // Accept low-confidence mappings
  strict?: boolean;               // Fail on missing fields
  redact?: boolean;               // Redact code snippets from artifacts
}

// Progress phases - Julie Zhou aligned (DD Section 6.4)
export type ProgressPhase = 'scanning' | 'analyzing' | 'parsing' | 'correlating' | 'generating';

export interface ProgressData {
  phase: ProgressPhase;
  detail?: string; // e.g., "847 files" or "23 inference points"
  percent?: number; // 0-100 for progress bar
  currentFile?: string; // current file being analyzed
}

export interface AgentCallbacks {
  onPlanReady?: (plan: ExecutionPlan) => void;
  onTaskStart?: (task: PlannedTask) => void;
  onTaskComplete?: (task: PlannedTask, result: TaskResult) => void;
  onProgress?: (data: ProgressData) => void; // User-meaningful progress
  onComplete?: (results: AgentResults) => void;
  onError?: (error: Error) => void;
  onResumed?: (runId: string) => void; // Called when resuming from cache
  onPartial?: (warnings: string[]) => void; // Called for partial results
}

export interface AgentResults {
  mode: 'static' | 'runtime' | 'combined';
  runId: string;
  resumed: boolean;
  scanResult?: ScanResult;
  callsites?: Callsite[];
  events?: InferenceEvent[];
  runtimeSummary?: RuntimeSummary;
  joined?: JoinedOutput;
  insights: Insight[];
  impactSummary?: ImpactSummary; // Stack-ranked impact analysis
  inferenceMap?: InferenceMap;
  htmlPath?: string;
  pdfPath?: string;
  warnings?: string[]; // Partial state warnings
}

// =============================================================================
// AGENT CONTEXT
// =============================================================================

interface AgentContext {
  opts: AgentOptions;
  runId: string;
  resumed: boolean;
  scanResult?: ScanResult;
  callsites?: Callsite[];
  events?: InferenceEvent[];
  runtimeSummary?: RuntimeSummary;
  joined?: JoinedOutput;
  insights?: Insight[];
  llmInsights?: LLMInsight[]; // Phase 1: LLM-generated semantic insights
  impactSummary?: ImpactSummary; // Stack-ranked impact analysis
  inferenceMap?: InferenceMap;
  htmlContent?: string;
  pdfPath?: string;
  warnings: string[]; // Track partial state warnings
}

// =============================================================================
// PASS 1: PLAN
// =============================================================================

function detectMode(opts: AgentOptions): 'static' | 'runtime' | 'combined' {
  // Check if the main path is an events file (case-insensitive for robustness)
  const pathLower = opts.path.toLowerCase();
  const isEventsFile = pathLower.endsWith('.jsonl') ||
                       pathLower.endsWith('.ndjson') ||
                       pathLower.endsWith('.json') ||
                       pathLower.endsWith('.csv');

  // Also check if it's a file (not directory) - file paths with these extensions are events
  const pathIsFile = !isDirectory(opts.path);

  // Runtime mode: events file path without separate --events option
  if (isEventsFile && pathIsFile && !opts.events) {
    return 'runtime';
  }
  // Combined mode: directory path with --events option
  if (!isEventsFile && opts.events) {
    return 'combined';
  }
  // Combined mode: events file path with separate --events option (rare but valid)
  if (isEventsFile && opts.events) {
    return 'combined';
  }
  // Static mode: directory path without --events option
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

export interface PlanResult {
  plan: ExecutionPlan;
  runId: string;
  canResume: boolean;
  runDir: string;
}

export function plan(opts: AgentOptions): PlanResult {
  const tasks: PlannedTask[] = [];
  let id = 1;
  const mode = detectMode(opts);
  const pathIsDirectory = isDirectory(opts.path);

  // Generate run ID and check resumability
  const inputs = {
    repoRoot: isDirectory(opts.path) ? opts.path : undefined,
    eventsPath: opts.events || (isDirectory(opts.path) ? undefined : opts.path),
    offline: opts.offline,
  };

  const runId = generateRunId(inputs);
  const resumeCheck = checkResumable(inputs);
  const shouldResume = !opts.noCache && resumeCheck.canResume;

  // If we can resume, skip analysis tasks
  if (!shouldResume) {
    // Always load pricing first
    tasks.push({
      id: id++,
      type: 'scan', // Reusing for pricing load
      description: 'Load pricing data',
    });

    // Only add static analysis tasks if path is a directory AND mode requires it
    if ((mode === 'static' || mode === 'combined') && pathIsDirectory) {
      tasks.push({
        id: id++,
        type: 'scan',
        description: 'Scan repository',
      });
      tasks.push({
        id: id++,
        type: 'analyze',
        description: 'Analyze inference points',
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

    if (opts.pdf) {
      tasks.push({
        id: id++,
        type: 'generate_pdf',
        description: 'Generate PDF report',
      });
    }

    tasks.push({
      id: id++,
      type: 'save_artifacts',
      description: 'Save artifacts',
    });
  } else {
    // Resuming - just need to load cached artifacts
    tasks.push({
      id: id++,
      type: 'scan', // Reusing for load cached
      description: 'Load cached results',
    });

    // Always generate HTML if requested, even when resuming
    if (opts.html) {
      tasks.push({
        id: id++,
        type: 'generate_html',
        description: 'Generate HTML report',
      });
    }

    if (opts.pdf) {
      tasks.push({
        id: id++,
        type: 'generate_pdf',
        description: 'Generate PDF report',
      });
    }

    if (opts.html || opts.pdf) {
      tasks.push({
        id: id++,
        type: 'save_artifacts',
        description: 'Save artifacts',
      });
    }
  }

  return {
    plan: { mode, tasks },
    runId,
    canResume: shouldResume,
    runDir: resumeCheck.runDir,
  };
}

// =============================================================================
// PASS 2: EXECUTE
// =============================================================================

async function executeTask(
  task: PlannedTask,
  ctx: AgentContext,
  templates: Awaited<ReturnType<typeof loadTemplates>>,
  runDir?: string,
  onProgress?: (data: ProgressData) => void
): Promise<void> {
  switch (task.type) {
    case 'scan':
      if (task.description === 'Load pricing data') {
        await loadPricing();
      } else if (task.description === 'Load cached results') {
        // Resume from cache
        if (runDir) {
          const cached = loadArtifacts(runDir);
          ctx.inferenceMap = cached.inferenceMap;
          ctx.insights = cached.insights;
          ctx.joined = cached.joined;
          ctx.runtimeSummary = cached.runtime;
          if (cached.inferenceMap) {
            ctx.callsites = cached.inferenceMap.callsites;
          }
          if (cached.insights && cached.insights.length > 0) {
            ctx.impactSummary = generateImpactSummary(cached.insights);
          }
        }
      } else {
        // Validate that path is a directory before attempting to scan
        if (!isDirectory(ctx.opts.path)) {
          const ext = ctx.opts.path.toLowerCase();
          if (ext.endsWith('.jsonl') || ext.endsWith('.ndjson') || ext.endsWith('.json') || ext.endsWith('.csv')) {
            throw new Error(`Cannot scan file "${ctx.opts.path}" as a codebase. This looks like an events file - try 'peakinfer analyze ${ctx.opts.path}' for runtime analysis.`);
          }
          throw new Error(`Expected directory for static analysis, got file: ${ctx.opts.path}`);
        }
        // Agent SDK pattern: DiscoveryAgent with constrained tools (Glob/Grep/Read)
        const discoveryResult = await DiscoveryAgent.execute({ root: ctx.opts.path });
        ctx.scanResult = discoveryResult.result.scanResult;
        const fileCount = ctx.scanResult?.files.length ?? 0;
        onProgress?.({ phase: 'scanning', detail: `${fileCount} files` });
      }
      break;

    case 'analyze':
      if (!ctx.scanResult) throw new Error('Scan result required');
      try {
        // Agent SDK pattern: AnalyzerAgent with tool-limited semantic analysis
        // Pass progress callback for visual progress bar during LLM analysis
        const analyzerResult = await AnalyzerAgent.execute({
          scanResult: ctx.scanResult,
          onProgress: onProgress ? (data) => {
            onProgress({ phase: 'analyzing', percent: data.percent, currentFile: data.currentFile });
          } : undefined,
        });
        ctx.callsites = analyzerResult.result.callsites;
        ctx.llmInsights = analyzerResult.result.llmInsights as LLMInsight[];

        // Get prompt metadata for report
        let promptMeta: MapMetadata = { llmUsed: ctx.llmInsights.length > 0 };
        try {
          const prompt = getDefaultPrompt();
          promptMeta.promptId = prompt.id;
          promptMeta.promptVersion = prompt.version;
        } catch {
          // Prompt not found, use defaults
        }

        ctx.inferenceMap = buildInferenceMap(ctx.opts.path, ctx.callsites, promptMeta);
        onProgress?.({ phase: 'analyzing', detail: `${ctx.callsites.length} inference points` });
      } catch (error) {
        // Partial state: analysis failed but we can continue
        ctx.warnings.push(`Analysis warning: ${error instanceof Error ? error.message : String(error)}`);
        ctx.callsites = [];
        ctx.llmInsights = [];
        ctx.inferenceMap = buildInferenceMap(ctx.opts.path, [], { llmUsed: false });
      }
      break;

    case 'parse_events': {
      const eventsPath = ctx.opts.events || ctx.opts.path;
      try {
        // Build normalization options from CLI flags (PRD §6.4)
        const normalizationOptions = {
          format_hint: ctx.opts.formatHint as import('./types.js').FormatType | undefined,
          field_hints: ctx.opts.fieldHints,
          lenient: ctx.opts.lenient,
          strict: ctx.opts.strict,
          codebase_context: ctx.scanResult, // Pass codebase context for smarter normalization
        };

        ctx.events = await parseEvents(eventsPath, normalizationOptions);
        ctx.runtimeSummary = aggregate(ctx.events);
        // Emit progress with event count
        onProgress?.({ phase: 'parsing', detail: `${ctx.events.length} events` });
      } catch (error) {
        // Partial state: event parsing failed
        ctx.warnings.push(`Events parsing warning: ${error instanceof Error ? error.message : String(error)}`);
        ctx.events = [];
      }
      break;
    }

    case 'join':
      if (!ctx.callsites || !ctx.events) throw new Error('Callsites and events required');
      // Agent SDK pattern: JoinerAgent correlates static + runtime
      const joinerResult = await JoinerAgent.execute({ callsites: ctx.callsites, events: ctx.events });
      ctx.joined = joinerResult.result.joined;
      onProgress?.({
        phase: 'correlating',
        detail: `${ctx.joined.callsites.filter(c => 'usage' in c && c.usage).length} matched`,
      });
      break;

    case 'load_templates':
      // Templates already loaded, just verify
      break;

    case 'generate_insights': {
      // Agent SDK pattern: InsightAgent evaluates templates
      const data = ctx.joined || { callsites: ctx.callsites || [] };
      const insightResult = await InsightAgent.execute({ data, templates });
      const templateInsights = insightResult.result.insights;

      // Convert LLM insights to Insight format, preserving any LLM-provided impact estimates
      const llmFormattedInsights: Insight[] = (ctx.llmInsights || []).map(llmInsight => ({
        id: `llm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        severity: llmInsight.severity,
        category: llmInsight.category,
        headline: llmInsight.headline,
        evidence: llmInsight.evidence,
        location: llmInsight.location,
        recommendation: llmInsight.recommendation,
        source: 'llm' as const, // Mark as LLM-generated
        // Preserve LLM-provided impact estimates if present
        impact: llmInsight.impact ? {
          layer: llmInsight.impact.layer,
          impactType: llmInsight.impact.impactType,
          estimatedImpactPercent: llmInsight.impact.estimatedImpactPercent,
          effort: llmInsight.impact.effort,
          confidence: 0.8, // LLM estimates have higher confidence
        } : undefined,
      }));

      // Combine: LLM semantic insights first (phase 1), then template pattern insights (phase 2)
      const combinedInsights = [...llmFormattedInsights, ...templateInsights];

      // Enrich all insights with impact estimates (fills in missing ones)
      ctx.insights = enrichInsightsWithImpact(combinedInsights);

      // Generate stack-ranked impact summary
      ctx.impactSummary = generateImpactSummary(ctx.insights);

      // Emit progress with insight count
      onProgress?.({ phase: 'generating', detail: `${ctx.insights.length} findings` });
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

    case 'generate_pdf': {
      if (!ctx.htmlContent) throw new Error('HTML content required for PDF');

      // Generate human-friendly PDF filename
      const pdfAbsolutePath = ctx.inferenceMap?.metadata?.absolutePath || ctx.opts.path;
      const pdfProjectName = pdfAbsolutePath.split('/').filter(Boolean).pop() || 'project';
      const pdfProjectSlug = pdfProjectName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').substring(0, 50);
      const pdfFileName = `${pdfProjectSlug}_peakinfer_report.pdf`;
      const pdfPath = `.peakinfer/${pdfFileName}`;

      await generatePDF(ctx.htmlContent, pdfPath);
      ctx.pdfPath = pdfPath;
      break;
    }

    case 'save_artifacts': {
      const inputs = {
        repoRoot: isDirectory(ctx.opts.path) ? ctx.opts.path : undefined,
        eventsPath: ctx.opts.events || (isDirectory(ctx.opts.path) ? undefined : ctx.opts.path),
        offline: ctx.opts.offline,
      };

      // Extract project name for human-friendly report naming
      const absolutePath = ctx.inferenceMap?.metadata?.absolutePath || ctx.opts.path;
      const projectName = absolutePath.split('/').filter(Boolean).pop() || 'project';

      saveArtifacts(
        {
          inferenceMap: ctx.inferenceMap,
          insights: ctx.insights,
          joined: ctx.joined,
          runtime: ctx.runtimeSummary,
          html: ctx.htmlContent,
        },
        '.peakinfer',
        {
          runId: ctx.runId,
          inputs,
          projectName,
        }
      );
      break;
    }
  }
}

interface MapMetadata {
  promptId?: string;
  promptVersion?: string;
  llmUsed?: boolean;
}

function buildInferenceMap(
  root: string,
  callsites: Callsite[],
  metadata: MapMetadata = {}
): InferenceMap {
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
    version: VERSION,
    root,
    generatedAt: new Date().toISOString(),
    metadata: {
      absolutePath: resolve(root),
      promptId: metadata.promptId || 'peak-performance',
      promptVersion: metadata.promptVersion,
      llmProvider: metadata.llmUsed ? 'anthropic' : 'none',
      llmModel: metadata.llmUsed ? 'claude-sonnet-4-20250514' : undefined,
    },
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
    const planResult = plan(opts);
    const { plan: executionPlan, runId, canResume, runDir } = planResult;

    // Notify if resuming from cache
    if (canResume) {
      this.callbacks.onResumed?.(runId);
    }

    this.callbacks.onPlanReady?.(executionPlan);

    const ctx: AgentContext = {
      opts,
      runId,
      resumed: canResume,
      warnings: [],
    };
    const results: TaskResult[] = [];

    // Load templates once (not needed if resuming)
    const templates = canResume ? [] : await loadTemplates({ offline: opts.offline });

    for (const task of executionPlan.tasks) {
      this.callbacks.onTaskStart?.(task);
      const startTime = Date.now();

      try {
        await executeTask(task, ctx, templates, runDir, this.callbacks.onProgress);

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

        // Critical tasks abort execution only if not partial-safe
        if (['scan'].includes(task.type) && task.description !== 'Load cached results') {
          throw error;
        }
        // analyze and parse_events can fail gracefully (partial state)
      }
    }

    // Notify if there were warnings (partial state)
    if (ctx.warnings.length > 0) {
      this.callbacks.onPartial?.(ctx.warnings);
    }

    // Generate human-friendly report filename
    const absolutePath = ctx.inferenceMap?.metadata?.absolutePath || opts.path;
    const projectName = absolutePath.split('/').filter(Boolean).pop() || 'project';
    const projectSlug = projectName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').substring(0, 50);
    const reportFileName = ctx.htmlContent
      ? `.peakinfer/${projectSlug}_peakinfer_report.html`
      : undefined;

    const agentResults: AgentResults = {
      mode: executionPlan.mode,
      runId,
      resumed: canResume,
      scanResult: ctx.scanResult,
      callsites: ctx.callsites,
      events: ctx.events,
      runtimeSummary: ctx.runtimeSummary,
      joined: ctx.joined,
      insights: ctx.insights || [],
      impactSummary: ctx.impactSummary,
      inferenceMap: ctx.inferenceMap,
      htmlPath: reportFileName,
      pdfPath: ctx.pdfPath,
      warnings: ctx.warnings.length > 0 ? ctx.warnings : undefined,
    };

    this.callbacks.onComplete?.(agentResults);
    return agentResults;
  }
}
