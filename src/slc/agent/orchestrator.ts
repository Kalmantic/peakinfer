/**
 * Agent Orchestrator - PeakInfer TDD v1.3 Section 3
 * 
 * Main orchestrator implementing the two-pass execution model.
 * 
 * Pass 1 (PLAN): Generate execution plan - WHAT to do
 * Pass 2 (EXECUTE): Resolve and run tasks - HOW to do it
 * 
 * Benefits (per TDD):
 * - Predictable progress phases
 * - Clear failure isolation
 * - Resumability and caching
 * - Debuggable (know exactly where failure occurred)
 */

import * as path from 'path';
import * as fs from 'fs';
import { Planner } from './planner.js';
import { Executor } from './executor.js';
import type {
  ExecutionPlan,
  ExecutionState,
  AgentConfig,
  AgentCallbacks,
  DEFAULT_AGENT_CONFIG,
} from './types.js';
import { scan } from '../scanner.js';
import { buildStackMap } from '../stackmap.js';
import { calculatePricing, initPricingEngine } from '../pricing.js';
import { normalizeEventsFile } from '../format/index.js';
import { joinStaticAndRuntime } from '../join/index.js';
import { generateInsights } from '../insights/engine.js';
import type { ClassifiedCallsite, StackMap, PricingSummary, TechStack, InferencePatterns } from '../types.js';

// =============================================================================
// TYPES
// =============================================================================

export interface OrchestratorOptions {
  /** Events file for runtime/combined analysis */
  eventsFile?: string;
  
  /** Whether to use cached results */
  useCache?: boolean;
  
  /** Maximum turns (passed to executor) */
  maxTurns?: number;
  
  /** Agent configuration */
  config?: Partial<AgentConfig>;
  
  /** Callbacks for UI integration */
  callbacks?: AgentCallbacks;
}

export interface AnalysisResult {
  /** Detected callsites */
  callsites: ClassifiedCallsite[];
  
  /** Inference topology map */
  stackMap: StackMap;
  
  /** Pricing breakdown */
  pricing: PricingSummary;
  
  /** Tech stack detection */
  techStack: TechStack;
  
  /** Detected patterns */
  patterns: InferencePatterns;
  
  /** Insights and recommendations */
  insights: ReturnType<typeof generateInsights>;
  
  /** Analysis mode */
  mode: 'static' | 'runtime' | 'combined';
  
  /** Execution plan (for debugging) */
  plan: ExecutionPlan;
  
  /** Final execution state */
  state: ExecutionState;
  
  /** Total API cost */
  totalCostUsd: number;
  
  /** Total duration */
  durationMs: number;
}

// =============================================================================
// ORCHESTRATOR CLASS
// =============================================================================

export class AgentOrchestrator {
  private planner: Planner;
  private executor: Executor;
  private config: AgentConfig;
  private callbacks: AgentCallbacks;
  
  constructor(options: OrchestratorOptions = {}) {
    this.config = {
      provider: 'anthropic',
      model: 'claude-sonnet-4-5-20250929',
      temperature: 0,
      maxTurnsPerTask: 10,
      maxTotalTurns: options.maxTurns || 50,
      retryAttempts: 3,
      toolTimeoutMs: 30000,
      cacheEnabled: options.useCache ?? true,
      contextDir: '.peakinfer',
      ...options.config,
    };
    
    this.callbacks = options.callbacks || {};
    this.planner = new Planner(this.config, this.callbacks);
    this.executor = new Executor(this.config, this.callbacks);
  }
  
  /**
   * Run complete analysis using two-pass execution model.
   */
  async analyze(targetPath: string, options: OrchestratorOptions = {}): Promise<AnalysisResult> {
    const startTime = Date.now();
    const root = path.resolve(targetPath);
    
    // Determine analysis mode
    const mode = this.determineMode(root, options.eventsFile);
    
    // Emit start callback
    this.callbacks.onQueryStart?.(`${mode} analysis`, `analysis-${Date.now()}`);
    
    try {
      // =======================================================================
      // PASS 1: PLANNING
      // =======================================================================
      
      this.callbacks.onProgress?.(0, 'Planning analysis...');
      
      // Quick scan to get file count for planning
      const scanResult = await scan(root);
      
      const plan = await this.planner.generatePlan(root, mode, {
        eventsFile: options.eventsFile,
        fileCount: scanResult.totalFiles,
      });
      
      // =======================================================================
      // PASS 2: EXECUTION
      // =======================================================================
      
      this.callbacks.onProgress?.(0.1, 'Executing plan...');
      
      const state = await this.executor.execute(plan, root);
      
      // =======================================================================
      // POST-PROCESSING: Build final results
      // =======================================================================
      
      this.callbacks.onProgress?.(0.9, 'Building results...');
      
      // Extract results from execution state
      const analysisResult = await this.buildResults(state, root, mode, options);
      
      const durationMs = Date.now() - startTime;
      
      this.callbacks.onQueryComplete?.(`analysis-${Date.now()}`, true, durationMs);
      this.callbacks.onProgress?.(1, 'Analysis complete');
      
      return {
        ...analysisResult,
        plan,
        state,
        mode,
        totalCostUsd: state.totalCostUsd,
        durationMs,
      };
      
    } catch (error) {
      this.callbacks.onError?.(
        error instanceof Error ? error : new Error(String(error)),
        'analysis'
      );
      throw error;
    }
  }
  
  /**
   * Resume a previous analysis from saved state.
   */
  async resume(statePath: string): Promise<AnalysisResult> {
    const stateData = JSON.parse(await fs.promises.readFile(statePath, 'utf-8'));
    const root = stateData.plan.target;
    
    const state = await this.executor.resume(statePath, root);
    
    const mode = stateData.plan.mode as 'static' | 'runtime' | 'combined';
    const result = await this.buildResults(state, root, mode, {});
    
    return {
      ...result,
      plan: state.plan,
      state,
      mode,
      totalCostUsd: state.totalCostUsd,
      durationMs: Date.now() - new Date(state.startedAt).getTime(),
    };
  }
  
  /**
   * Determine analysis mode based on inputs.
   */
  private determineMode(
    targetPath: string,
    eventsFile?: string
  ): 'static' | 'runtime' | 'combined' {
    const stat = fs.statSync(targetPath);
    
    if (eventsFile) {
      return 'combined';
    }
    
    if (stat.isFile()) {
      // Check if it looks like an events file
      const ext = path.extname(targetPath).toLowerCase();
      if (['.jsonl', '.json', '.csv', '.tsv'].includes(ext)) {
        return 'runtime';
      }
    }
    
    return 'static';
  }
  
  /**
   * Build final analysis results from execution state.
   */
  private async buildResults(
    state: ExecutionState,
    root: string,
    mode: 'static' | 'runtime' | 'combined',
    options: OrchestratorOptions
  ): Promise<Omit<AnalysisResult, 'plan' | 'state' | 'mode' | 'totalCostUsd' | 'durationMs'>> {
    // Initialize pricing engine
    await initPricingEngine();
    
    // Extract results from completed tasks
    let callsites: ClassifiedCallsite[] = [];
    let techStack: TechStack = {
      application: { frameworks: [], sdks: [], patterns: [] },
      serving: { runtimes: [], gateways: [], platforms: [] },
      infrastructure: { cloud: [], compute: [], orchestration: [] },
      hardware: { gpus: [], accelerators: [], estimated: true },
    };
    let patterns: InferencePatterns = {
      retry: { detected: false, instances: [] },
      batching: { detected: false, instances: [] },
      streaming: { detected: false, instances: [] },
      caching: { detected: false, instances: [] },
      routing: { detected: false, instances: [] },
      fallback: { detected: false, instances: [] },
      guardrails: { detected: false, instances: [] },
    };
    
    // Find analysis task result
    const analyzeTask = state.tasks.find(t => t.id === 'analyze');
    if (analyzeTask?.result) {
      const result = analyzeTask.result as {
        callsites?: ClassifiedCallsite[];
        techStack?: TechStack;
        patterns?: InferencePatterns;
      };
      callsites = result.callsites || [];
      if (result.techStack) techStack = result.techStack;
      if (result.patterns) patterns = result.patterns;
    }
    
    // Build stack map
    const stackMap = buildStackMap(callsites, root);
    
    // Calculate pricing
    const pricing = calculatePricing(callsites);
    
    // Handle runtime/combined mode
    let runtimeEvents: any[] = [];
    let joinedResult: any = null;
    
    if (mode === 'runtime' || mode === 'combined') {
      const eventsPath = options.eventsFile || this.findEventsFile(root);
      if (eventsPath && fs.existsSync(eventsPath)) {
        const normalized = await normalizeEventsFile(eventsPath);
        runtimeEvents = normalized.events;
        
        if (mode === 'combined' && callsites.length > 0) {
          joinedResult = joinStaticAndRuntime(callsites, runtimeEvents, {
            patterns,
            detectPatternDrift: true,
          });
        }
      }
    }
    
    // Generate insights
    const insights = generateInsights({
      callsites,
      events: runtimeEvents,
      joined: joinedResult,
      patterns,
      pricing,
      techStack,
    });
    
    return {
      callsites,
      stackMap,
      pricing,
      techStack,
      patterns,
      insights,
    };
  }
  
  /**
   * Find events file in common locations.
   */
  private findEventsFile(root: string): string | null {
    const candidates = [
      'events.jsonl',
      'inference-events.jsonl',
      'llm-events.jsonl',
      '.peakinfer/events.jsonl',
    ];
    
    for (const candidate of candidates) {
      const fullPath = path.join(root, candidate);
      if (fs.existsSync(fullPath)) {
        return fullPath;
      }
    }
    
    return null;
  }
  
  /**
   * Get the current execution plan.
   */
  getPlan(): ExecutionPlan | null {
    return this.executor.getState()?.plan || null;
  }
  
  /**
   * Get the current execution state.
   */
  getState(): ExecutionState | null {
    return this.executor.getState();
  }
}

// =============================================================================
// CONVENIENCE FUNCTION
// =============================================================================

/**
 * Run analysis using the two-pass execution model.
 * This is the main entry point for the new architecture.
 */
export async function analyzeWithTwoPass(
  targetPath: string,
  options: OrchestratorOptions = {}
): Promise<AnalysisResult> {
  const orchestrator = new AgentOrchestrator(options);
  return orchestrator.analyze(targetPath, options);
}

