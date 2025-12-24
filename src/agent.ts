import { existsSync, statSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import type { ExecutionPlan, PlannedTask, TaskResult, ScanResult, Callsite, InferenceEvent, JoinedOutput, Insight, RuntimeSummary, InferenceMap, ImpactEstimate, EnrichedCallsite } from './types.js';
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
import { saveRun, getLatestRun, loadRun, type AnalysisData } from './history.js';
import { compareSnapshots, formatComparisonSummary, type AnalysisSnapshot } from './comparison.js';
import { generatePredictions } from './prediction.js';
import { generateCounterfactuals } from './counterfactuals.js';
import type { ComparisonResult, PredictionResult, CounterfactualResult } from './types.js';
// Agent SDK pattern (DESIGN.md v2.0 Section 2.1, Patterns v0.2)
import {
  DiscoveryAgent,
  AnalyzerAgent,
  JoinerAgent,
  InsightAgent,
  RuntimeAnalyzerAgent,
  CorrelationAnalyzerAgent,
  StaticAnalysisOrchestrator,
  type StaticAnalysisOutput,
  type PerformanceProfile,
} from './agents/index.js';
import { getPricingContext } from './costs.js';

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Create synthetic enriched inference points from runtime events for insight evaluation.
 * Groups events by provider:model and computes usage statistics.
 * This enables runtime-only analysis to benefit from template-based insights.
 */
function createSyntheticCallsitesFromEvents(events: InferenceEvent[]): EnrichedCallsite[] {
  // Group events by provider:model
  const groups = new Map<string, InferenceEvent[]>();

  for (const event of events) {
    const key = `${event.provider}:${event.model}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(event);
  }

  // Convert each group to a synthetic enriched inference point
  const callsites: EnrichedCallsite[] = [];
  let id = 1;

  for (const [key, groupEvents] of groups) {
    const [provider, model] = key.split(':');

    // Compute usage stats
    const calls = groupEvents.length;
    const tokens_in = groupEvents.reduce((sum, e) => sum + e.input_tokens, 0);
    const tokens_out = groupEvents.reduce((sum, e) => sum + e.output_tokens, 0);
    const latencies = groupEvents.map(e => e.latency_ms).sort((a, b) => a - b);

    const p50Index = Math.floor(latencies.length * 0.5);
    const p95Index = Math.floor(latencies.length * 0.95);
    const p99Index = Math.floor(latencies.length * 0.99);

    callsites.push({
      id: `runtime-${id++}`,
      file: 'runtime',  // Synthetic location
      line: 0,
      provider: provider as EnrichedCallsite['provider'],
      model,
      framework: null,
      runtime: null,
      patterns: {
        streaming: groupEvents.some(e => e.streaming === true),
        batching: groupEvents.some(e => e.batch_id !== undefined),
        caching: groupEvents.some(e => e.cached === true),
        retries: groupEvents.some(e => (e.retry_count || 0) > 0),
        fallback: groupEvents.some(e => e.fallback_used === true),
      },
      confidence: 1.0,
      usage: {
        calls,
        tokens_in,
        tokens_out,
        latency_p50: latencies[p50Index] || 0,
        latency_p95: latencies[p95Index] || latencies[p50Index] || 0,
        latency_p99: latencies[p99Index] || latencies[p95Index] || latencies[p50Index] || 0,
      },
    });
  }

  return callsites;
}

/**
 * Convert StaticAnalysisOutput to LLM insights for display.
 * Maps optimizations from all dimensions (cost, latency, throughput, reliability) to insights.
 */
function convertPerformanceToInsights(analysis: StaticAnalysisOutput): Array<{
  severity: 'critical' | 'warning' | 'info';
  category: string;
  headline: string;
  evidence: string;
  location?: string;
  recommendation: string;
  impact?: {
    layer: string;
    impactType: string;
    estimatedImpactPercent: number;
    effort: string;
  };
}> {
  const insights: Array<{
    severity: 'critical' | 'warning' | 'info';
    category: string;
    headline: string;
    evidence: string;
    location?: string;
    recommendation: string;
    impact?: {
      layer: string;
      impactType: string;
      estimatedImpactPercent: number;
      effort: string;
    };
  }> = [];

  // Convert all optimizations to insights
  for (const opt of analysis.all_optimizations) {
    const severity = opt.priority === 'critical' || opt.priority === 'high' ? 'critical' :
                     opt.priority === 'medium' ? 'warning' : 'info';

    const categoryMap: Record<string, string> = {
      cost: 'Cost Optimization',
      latency: 'Latency Optimization',
      throughput: 'Throughput Optimization',
      reliability: 'Reliability Improvement',
    };

    const impactTypeMap: Record<string, string> = {
      cost: 'cost',
      latency: 'latency',
      throughput: 'throughput',
      reliability: 'improvement',
    };

    // Parse impact percentage from the impact string (e.g., "90% savings" or "50% improvement")
    const impactMatch = opt.impact.match(/(\d+)%/);
    const impactPercent = impactMatch ? parseInt(impactMatch[1]) : 20;

    insights.push({
      severity,
      category: categoryMap[opt.dimension] || opt.dimension,
      headline: opt.description,
      evidence: `${opt.type}: ${opt.impact}`,
      location: `${opt.file}:${opt.line}`,
      recommendation: opt.description,
      impact: {
        layer: opt.dimension,
        impactType: impactTypeMap[opt.dimension] || 'improvement',
        estimatedImpactPercent: impactPercent,
        effort: opt.effort,
      },
    });
  }

  // Add reliability anti-pattern insights
  for (const profile of analysis.performance_profiles) {
    if (profile.reliability?.anti_patterns) {
      for (const antiPattern of profile.reliability.anti_patterns) {
        const severity = antiPattern.severity === 'high' ? 'critical' :
                        antiPattern.severity === 'medium' ? 'warning' : 'info';

        insights.push({
          severity,
          category: 'Reliability Issue',
          headline: antiPattern.pattern,
          evidence: antiPattern.description,
          location: antiPattern.location,
          recommendation: `Fix: ${antiPattern.pattern}`,
          impact: {
            layer: 'reliability',
            impactType: 'improvement',
            estimatedImpactPercent: antiPattern.severity === 'high' ? 40 : 20,
            effort: 'low',
          },
        });
      }
    }
  }

  return insights;
}

// =============================================================================
// TYPES
// =============================================================================

export interface AgentOptions {
  path: string;
  events?: string;
  eventsUrl?: string;             // URL to fetch runtime events
  html?: boolean;
  pdf?: boolean;
  open?: boolean;
  out?: string;                   // Write output to file
  offline?: boolean;
  verbose?: boolean;
  noCache?: boolean; // Force fresh analysis, ignore cached runs
  // Format detection options (PRD §6.4)
  formatHint?: string;            // User-specified format type
  fieldHints?: Record<string, string>; // User-specified field mappings
  lenient?: boolean;              // Accept low-confidence mappings
  strict?: boolean;               // Fail on missing fields
  redact?: boolean;               // Redact code snippets from artifacts
  // History options (v1.5)
  noHistory?: boolean;            // Skip saving run to history
  compare?: boolean;              // Compare with previous run
  compareRunId?: string;          // Specific run ID to compare with
  predict?: boolean;              // Generate deploy-time predictions
  targetP95?: number;             // Target p95 latency for budget calculation
}

// Progress phases - Julie Zhou aligned (DD Section 6.4)
export type ProgressPhase = 'scanning' | 'analyzing' | 'profiling' | 'parsing' | 'correlating' | 'generating';

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
  staticAnalysis?: StaticAnalysisOutput; // 6-agent performance profiling
  comparison?: ComparisonResult; // v1.5: Historical comparison
  prediction?: PredictionResult; // v1.5: Deploy-time predictions
  counterfactuals?: CounterfactualResult; // v1.5: What-if optimization scenarios
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
  staticAnalysis?: StaticAnalysisOutput; // 6-agent performance profiling
  comparison?: ComparisonResult; // v1.5: Historical comparison result
  prediction?: PredictionResult; // v1.5: Deploy-time predictions
  counterfactuals?: CounterfactualResult; // v1.5: What-if scenarios
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

/**
 * Fetch runtime events from a URL
 */
async function fetchEventsFromUrl(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch events from ${url}: ${response.status} ${response.statusText}`);
  }
  return response.text();
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
      // Unified analysis: discovery + profiling in single LLM call
      tasks.push({
        id: id++,
        type: 'analyze',
        description: 'Analyze and profile inference points',
        depends_on: [id - 1],
      });
    }

    if (mode === 'runtime' || mode === 'combined') {
      tasks.push({
        id: id++,
        type: 'parse_events',
        description: 'Parse runtime events',
      });

      // NEW: LLM-based runtime analysis for ALL modes with runtime data (Patterns v0.2)
      tasks.push({
        id: id++,
        type: 'analyze', // Reuse 'analyze' type for runtime LLM analysis
        description: 'Analyze runtime patterns',
        depends_on: [id - 1],
      });
    }

    if (mode === 'combined') {
      tasks.push({
        id: id++,
        type: 'join',
        description: 'Correlate static + runtime',
      });

      // NEW: LLM-based correlation analysis (Patterns v0.2)
      tasks.push({
        id: id++,
        type: 'join', // Reuse 'join' type for correlation analysis
        description: 'Analyze code-runtime drift',
        depends_on: [id - 1],
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

    // v1.5: Compare with previous run if requested
    if (opts.compare) {
      tasks.push({
        id: id++,
        type: 'compare',
        description: 'Compare with previous run',
      });
    }

    // v1.5: Generate deploy-time predictions if requested
    if (opts.predict) {
      tasks.push({
        id: id++,
        type: 'predict',
        description: 'Generate latency predictions',
      });
    }

    // v1.5: Always generate counterfactual insights (show optimization opportunities)
    tasks.push({
      id: id++,
      type: 'counterfactuals',
      description: 'Identify optimization opportunities',
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

    // v1.5: Save to history for comparison/prediction (unless --no-history)
    if (!opts.noHistory) {
      tasks.push({
        id: id++,
        type: 'save_history',
        description: 'Save to history',
      });
    }
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
      // Handle static code analysis, runtime pattern analysis, AND performance profiling
      if (task.description === 'Analyze runtime patterns') {
        // NEW: LLM-based runtime analysis (Patterns v0.2)
        if (!ctx.events || !ctx.runtimeSummary) {
          ctx.warnings.push('Runtime analysis skipped: no events parsed');
          break;
        }
        try {
          // Get pricing context for models in the data
          const models = Object.keys(ctx.runtimeSummary.byModel);
          const pricingContext = getPricingContext(models);

          // Emit progress: starting runtime pattern analysis
          onProgress?.({ phase: 'analyzing', detail: `analyzing ${ctx.events.length} runtime events...` });

          const runtimeResult = await RuntimeAnalyzerAgent.execute({
            events: ctx.events,
            runtimeSummary: ctx.runtimeSummary,
            pricingContext,
          });

          // Store runtime insights for later merging
          const runtimeInsights = runtimeResult.result.insights.map(i => ({
            ...i,
            source: 'llm' as const,
          }));
          ctx.llmInsights = [...(ctx.llmInsights || []), ...runtimeInsights as LLMInsight[]];

          onProgress?.({ phase: 'analyzing', detail: `${runtimeResult.result.insights.length} runtime insights` });
        } catch (error) {
          ctx.warnings.push(`Runtime analysis warning: ${error instanceof Error ? error.message : String(error)}`);
        }
      } else if (task.description === 'Analyze and profile inference points') {
        // UNIFIED: Discovery + Profiling in single LLM call
        if (!ctx.scanResult) throw new Error('Scan result required');
        try {
          const scanRoot = ctx.scanResult.root;

          // Read all source files (no artificial limit - process all candidates)
          const filesToAnalyze = ctx.scanResult.files
            .map(f => {
              const fullPath = resolve(scanRoot, f.path);
              try {
                return {
                  path: fullPath,
                  content: readFileSync(fullPath, 'utf-8'),
                  language: f.language,
                };
              } catch {
                return null;
              }
            })
            .filter((f): f is { path: string; content: string; language: string } => f !== null);

          if (filesToAnalyze.length === 0) {
            ctx.warnings.push('Analysis skipped: no source files available');
            ctx.callsites = [];
            ctx.llmInsights = [];
            break;
          }

          // Emit progress: starting LLM analysis (visible feedback during long-running call)
          onProgress?.({ phase: 'analyzing', detail: `analyzing ${filesToAnalyze.length} files with LLM...` });

          // Run unified analysis (discovery + profiling in one LLM call)
          const orchestrator = new StaticAnalysisOrchestrator();
          ctx.staticAnalysis = await orchestrator.analyze({ files: filesToAnalyze });

          // Extract callsites from unified analysis for rest of pipeline
          const callsitesFromAnalysis: Callsite[] = [];
          for (const profile of ctx.staticAnalysis.performance_profiles) {
            callsitesFromAnalysis.push({
              id: profile.inference_point_id,
              file: profile.file.replace(scanRoot + '/', '').replace(scanRoot, ''),
              line: profile.line,
              provider: profile.provider as Callsite['provider'],
              model: profile.model ?? null,
              framework: null,
              runtime: null,
              patterns: {},
              confidence: 0.9,
            });
          }
          ctx.callsites = callsitesFromAnalysis;

          // Convert performance profiles to insights
          const performanceInsights = convertPerformanceToInsights(ctx.staticAnalysis);
          ctx.llmInsights = performanceInsights as LLMInsight[];

          // Build inference map
          let promptMeta: MapMetadata = { llmUsed: true };
          try {
            const prompt = getDefaultPrompt();
            promptMeta.promptId = prompt.id;
            promptMeta.promptVersion = prompt.version;
          } catch {
            // Prompt not found, use defaults
          }
          ctx.inferenceMap = buildInferenceMap(ctx.opts.path, ctx.callsites, promptMeta);

          onProgress?.({
            phase: 'profiling',
            detail: `${ctx.staticAnalysis.summary.total_optimizations} optimizations found`,
          });
        } catch (error) {
          ctx.warnings.push(`Analysis warning: ${error instanceof Error ? error.message : String(error)}`);
          ctx.callsites = [];
          ctx.llmInsights = [];
          ctx.inferenceMap = buildInferenceMap(ctx.opts.path, [], { llmUsed: false });
        }
      } else if (task.description === 'Profile performance') {
        // Legacy: Skip - now handled by unified analysis above
        break;
      } else {
        // Original static code analysis
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
      }
      break;

    case 'parse_events': {
      try {
        // Build normalization options from CLI flags (PRD §6.4)
        const normalizationOptions = {
          format_hint: ctx.opts.formatHint as import('./types.js').FormatType | undefined,
          field_hints: ctx.opts.fieldHints,
          lenient: ctx.opts.lenient,
          strict: ctx.opts.strict,
          codebase_context: ctx.scanResult, // Pass codebase context for smarter normalization
        };

        // Handle --events-url: fetch from URL first
        if (ctx.opts.eventsUrl) {
          const eventsContent = await fetchEventsFromUrl(ctx.opts.eventsUrl);
          // Write to temp file for parsing
          const tempPath = '.peakinfer/.tmp_events.jsonl';
          writeFileSync(tempPath, eventsContent);
          ctx.events = await parseEvents(tempPath, normalizationOptions);
        } else {
          const eventsPath = ctx.opts.events || ctx.opts.path;
          ctx.events = await parseEvents(eventsPath, normalizationOptions);
        }

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
      // Handle both basic join AND LLM-based correlation analysis
      if (task.description === 'Analyze code-runtime drift') {
        // NEW: LLM-based correlation analysis (Patterns v0.2)
        if (!ctx.callsites || !ctx.events || !ctx.runtimeSummary) {
          ctx.warnings.push('Correlation analysis skipped: missing callsites or events');
          break;
        }
        try {
          // Emit progress: starting drift detection analysis
          onProgress?.({ phase: 'correlating', detail: 'detecting code-runtime drift...' });

          const correlationResult = await CorrelationAnalyzerAgent.execute({
            callsites: ctx.callsites,
            events: ctx.events,
            runtimeSummary: ctx.runtimeSummary,
          });

          // Merge correlation insights
          const correlationInsights = correlationResult.result.insights.map(i => ({
            ...i,
            source: 'llm' as const,
          }));
          ctx.llmInsights = [...(ctx.llmInsights || []), ...correlationInsights as LLMInsight[]];

          // Update drift signals in joined output
          if (ctx.joined) {
            ctx.joined.drift = [
              ...ctx.joined.drift,
              ...correlationResult.result.driftSignals,
            ];
          }

          onProgress?.({
            phase: 'correlating',
            detail: `alignment: ${Math.round(correlationResult.result.alignmentScore * 100)}%`,
          });
        } catch (error) {
          ctx.warnings.push(`Correlation analysis warning: ${error instanceof Error ? error.message : String(error)}`);
        }
      } else {
        // Original basic join
        if (!ctx.callsites || !ctx.events) throw new Error('Callsites and events required');
        // Agent SDK pattern: JoinerAgent correlates static + runtime
        const joinerResult = await JoinerAgent.execute({ callsites: ctx.callsites, events: ctx.events });
        ctx.joined = joinerResult.result.joined;
        onProgress?.({
          phase: 'correlating',
          detail: `${ctx.joined.callsites.filter(c => 'usage' in c && c.usage).length} matched`,
        });
      }
      break;

    case 'load_templates':
      // Templates already loaded, just verify
      break;

    case 'generate_insights': {
      // Agent SDK pattern: InsightAgent evaluates templates
      // For runtime-only mode, create synthetic inference points from events for template evaluation
      let data: { callsites: Callsite[] } | JoinedOutput;

      if (ctx.joined) {
        data = ctx.joined;
      } else if (ctx.callsites && ctx.callsites.length > 0) {
        data = { callsites: ctx.callsites };
      } else if (ctx.events && ctx.events.length > 0) {
        // Runtime-only mode: create synthetic enriched inference points from events
        data = { callsites: createSyntheticCallsitesFromEvents(ctx.events) };
      } else {
        data = { callsites: [] };
      }

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

    case 'save_history': {
      // v1.5: Save run to history for comparison/prediction features
      const mode = ctx.joined ? 'combined' : (ctx.events?.length ? 'runtime' : 'static');

      // Prepare analysis data for history storage
      const historyData: AnalysisData = {
        inferenceMap: ctx.inferenceMap,
        insights: ctx.insights,
        joined: ctx.joined,
        runtime: ctx.runtimeSummary,
      };

      // Generate human-friendly HTML path if generated
      const absolutePath = ctx.inferenceMap?.metadata?.absolutePath || ctx.opts.path;
      const projectName = absolutePath.split('/').filter(Boolean).pop() || 'project';
      const projectSlug = projectName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').substring(0, 50);

      saveRun({
        path: ctx.opts.path,
        analysisType: mode,
        data: historyData,
        htmlPath: ctx.htmlContent ? `.peakinfer/${projectSlug}_peakinfer_report.html` : undefined,
        pdfPath: ctx.pdfPath,
      });
      break;
    }

    case 'compare': {
      // v1.5: Compare with previous run
      // Build current snapshot
      const currentSnapshot: AnalysisSnapshot = {
        runId: ctx.runId,
        timestamp: new Date().toISOString(),
        callsites: ctx.callsites || [],
        insights: ctx.insights,
      };

      // Get baseline (specific run or latest)
      let baselineRun;
      if (ctx.opts.compareRunId) {
        baselineRun = loadRun(ctx.opts.compareRunId);
        if (!baselineRun) {
          ctx.warnings.push(`Comparison skipped: run ${ctx.opts.compareRunId} not found`);
          break;
        }
      } else {
        baselineRun = getLatestRun(ctx.opts.path);
        if (!baselineRun) {
          ctx.warnings.push('Comparison skipped: no previous runs found');
          break;
        }
      }

      // Build baseline snapshot
      const baselineSnapshot: AnalysisSnapshot = {
        runId: baselineRun.manifest.runId,
        timestamp: baselineRun.manifest.timestamp,
        callsites: baselineRun.data.inferenceMap?.callsites || [],
        insights: baselineRun.data.insights,
      };

      // Perform comparison
      ctx.comparison = compareSnapshots(baselineSnapshot, currentSnapshot);

      // Log summary for progress
      const summary = formatComparisonSummary(ctx.comparison);
      onProgress?.({ phase: 'generating', detail: `compared with ${baselineRun.manifest.runId.slice(0, 8)}` });
      break;
    }

    case 'predict': {
      // v1.5: Generate deploy-time latency predictions
      if (!ctx.inferenceMap) {
        ctx.warnings.push('Prediction skipped: no inference map available');
        break;
      }

      // Generate predictions based on inference points
      const predictionResult = generatePredictions(
        ctx.inferenceMap,
        0, // Historical run count (can be enhanced later with actual history)
        { targetP95: ctx.opts.targetP95 }
      );

      ctx.prediction = predictionResult;

      // Log summary for progress
      const riskCount = predictionResult.summary.highRiskCount + predictionResult.summary.mediumRiskCount;
      onProgress?.({
        phase: 'generating',
        detail: `${predictionResult.predictions.length} predictions, ${riskCount} at risk`,
      });
      break;
    }

    case 'counterfactuals': {
      // v1.5: Generate what-if optimization scenarios
      if (!ctx.inferenceMap) {
        ctx.warnings.push('Counterfactuals skipped: no inference map available');
        break;
      }

      // Generate counterfactual insights
      const counterfactualResult = generateCounterfactuals(ctx.inferenceMap);
      ctx.counterfactuals = counterfactualResult;

      // Log summary for progress
      onProgress?.({
        phase: 'generating',
        detail: `${counterfactualResult.summary.totalOpportunities} optimization opportunities`,
      });
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
    version: '0.1',  // InferenceMap schema version (not CLI version)
    root,
    generatedAt: new Date().toISOString(),
    metadata: {
      absolutePath: resolve(root),
      promptId: metadata.promptId || 'peak-performance',
      promptVersion: metadata.promptVersion,
      templatesVersion: VERSION,  // CLI version for audit trail
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
      staticAnalysis: ctx.staticAnalysis,
      comparison: ctx.comparison, // v1.5: Historical comparison
      prediction: ctx.prediction, // v1.5: Deploy-time predictions
      counterfactuals: ctx.counterfactuals, // v1.5: What-if scenarios
      htmlPath: reportFileName,
      pdfPath: ctx.pdfPath,
      warnings: ctx.warnings.length > 0 ? ctx.warnings : undefined,
    };

    // Handle --out: write output to file
    if (opts.out) {
      const outputData = {
        schema: 'peakinfer-analysis',
        version: '1.0',  // Analysis export format version
        cliVersion: VERSION,
        mode: agentResults.mode,
        runId: agentResults.runId,
        timestamp: new Date().toISOString(),
        inferenceMap: agentResults.inferenceMap,
        insights: agentResults.insights,
        impactSummary: agentResults.impactSummary,
        comparison: agentResults.comparison,
        prediction: agentResults.prediction,
        counterfactuals: agentResults.counterfactuals,
        runtimeSummary: agentResults.runtimeSummary,
      };
      writeFileSync(opts.out, JSON.stringify(outputData, null, 2));
    }

    this.callbacks.onComplete?.(agentResults);
    return agentResults;
  }
}
