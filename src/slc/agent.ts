/**
 * Agent Architecture — Minimal Implementation
 *
 * Based on design/Autonomous Agent Architecture Patterns.md:
 * - Callback-driven architecture (UI decoupling)
 * - Filesystem-based context (persistence, resumability)
 * - Two-pass execution (plan then execute)
 *
 * This wraps existing functionality with proper patterns.
 */

import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import type {
  ClassifiedCallsite,
  StackMap,
  PricingSummary,
  TechStack,
  InferencePatterns,
  ScanResult
} from './types.js';

// =============================================================================
// SCHEMAS (Zod validation for type safety)
// =============================================================================

export const TaskStatusSchema = z.enum(['pending', 'running', 'completed', 'failed']);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const TaskSchema = z.object({
  id: z.string(),
  description: z.string(),
  status: TaskStatusSchema,
  result: z.unknown().optional(),
  error: z.string().optional(),
  durationMs: z.number().optional(),
});
export type Task = z.infer<typeof TaskSchema>;

export const ExecutionPlanSchema = z.object({
  queryId: z.string(),
  targetPath: z.string(),
  createdAt: z.string(),
  tasks: z.array(TaskSchema),
});
export type ExecutionPlan = z.infer<typeof ExecutionPlanSchema>;

// =============================================================================
// CALLBACKS (UI decoupling)
// =============================================================================

export interface AgentCallbacks {
  // Lifecycle
  onStart?: (queryId: string, targetPath: string) => void;
  onComplete?: (queryId: string, success: boolean, durationMs: number) => void;

  // Planning
  onPlanCreated?: (plan: ExecutionPlan) => void;

  // Execution
  onTaskStart?: (task: Task) => void;
  onTaskProgress?: (task: Task, message: string) => void;
  onTaskComplete?: (task: Task) => void;

  // Errors
  onError?: (error: Error, phase: string) => void;
}

// =============================================================================
// CONTEXT MANAGER (Filesystem-based persistence)
// =============================================================================

export class ContextManager {
  private contextDir: string;

  constructor(rootPath: string) {
    this.contextDir = path.join(rootPath, '.peakinfer');
  }

  /** Ensure context directory exists */
  init(): void {
    if (!fs.existsSync(this.contextDir)) {
      fs.mkdirSync(this.contextDir, { recursive: true });
    }
  }

  /** Save execution plan */
  savePlan(plan: ExecutionPlan): void {
    this.init();
    const planPath = path.join(this.contextDir, `plan-${plan.queryId}.json`);
    fs.writeFileSync(planPath, JSON.stringify(plan, null, 2));
  }

  /** Load execution plan */
  loadPlan(queryId: string): ExecutionPlan | null {
    const planPath = path.join(this.contextDir, `plan-${queryId}.json`);
    if (!fs.existsSync(planPath)) return null;
    return ExecutionPlanSchema.parse(JSON.parse(fs.readFileSync(planPath, 'utf-8')));
  }

  /** Save task result to disk */
  saveTaskResult(queryId: string, taskId: string, result: unknown): string {
    this.init();
    const resultPath = path.join(this.contextDir, `result-${queryId}-${taskId}.json`);
    fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));
    return resultPath;
  }

  /** Load task result from disk */
  loadTaskResult<T>(queryId: string, taskId: string): T | null {
    const resultPath = path.join(this.contextDir, `result-${queryId}-${taskId}.json`);
    if (!fs.existsSync(resultPath)) return null;
    return JSON.parse(fs.readFileSync(resultPath, 'utf-8')) as T;
  }

  /** Check if a cached analysis exists */
  hasCachedAnalysis(): boolean {
    const cachePath = path.join(this.contextDir, 'cache.json');
    return fs.existsSync(cachePath);
  }
}

// =============================================================================
// ANALYSIS RESULT
// =============================================================================

export interface AnalysisOutput {
  queryId: string;
  scan: ScanResult;
  callsites: ClassifiedCallsite[];
  stackMap: StackMap;
  pricing: PricingSummary;
  techStack: TechStack;
  patterns: InferencePatterns;
  durationMs: number;
}

// =============================================================================
// AGENT CLASS
// =============================================================================

export class Agent {
  private callbacks: AgentCallbacks;
  private context: ContextManager;
  private targetPath: string;

  constructor(targetPath: string, callbacks: AgentCallbacks = {}) {
    this.targetPath = path.resolve(targetPath);
    this.callbacks = callbacks;
    this.context = new ContextManager(this.targetPath);
  }

  /** Generate unique query ID */
  private generateQueryId(): string {
    return `q-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  }

  /** Create execution plan (Pass 1) */
  createPlan(): ExecutionPlan {
    const queryId = this.generateQueryId();

    const plan: ExecutionPlan = {
      queryId,
      targetPath: this.targetPath,
      createdAt: new Date().toISOString(),
      tasks: [
        { id: 'scan', description: 'Scan codebase for source files', status: 'pending' },
        { id: 'analyze', description: 'Analyze code with AI agent', status: 'pending' },
        { id: 'stackmap', description: 'Build StackMap from callsites', status: 'pending' },
        { id: 'pricing', description: 'Calculate pricing estimates', status: 'pending' },
        { id: 'render', description: 'Generate output', status: 'pending' },
      ],
    };

    this.context.savePlan(plan);
    this.callbacks.onPlanCreated?.(plan);
    return plan;
  }

  /** Update task status in plan */
  private updateTask(plan: ExecutionPlan, taskId: string, updates: Partial<Task>): Task {
    const task = plan.tasks.find(t => t.id === taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    Object.assign(task, updates);
    this.context.savePlan(plan);
    return task;
  }

  /** Execute a single task */
  private async executeTask(
    plan: ExecutionPlan,
    taskId: string,
    executor: () => Promise<unknown>
  ): Promise<unknown> {
    const task = this.updateTask(plan, taskId, { status: 'running' });
    this.callbacks.onTaskStart?.(task);

    const startTime = Date.now();
    try {
      const result = await executor();
      const durationMs = Date.now() - startTime;

      // Save result to disk
      this.context.saveTaskResult(plan.queryId, taskId, result);

      this.updateTask(plan, taskId, {
        status: 'completed',
        result: `saved to disk`,
        durationMs
      });
      this.callbacks.onTaskComplete?.(task);

      return result;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);

      this.updateTask(plan, taskId, {
        status: 'failed',
        error: errorMsg,
        durationMs
      });
      this.callbacks.onError?.(error as Error, taskId);
      throw error;
    }
  }

  /** Run analysis (Pass 2: Execute plan) */
  async run(): Promise<AnalysisOutput> {
    const startTime = Date.now();
    const plan = this.createPlan();

    this.callbacks.onStart?.(plan.queryId, this.targetPath);

    try {
      // Import dependencies dynamically to avoid circular imports
      const { scan } = await import('./scanner.js');
      const { analyzeWithAgent } = await import('./agent-analyzer.js');
      const { buildStackMap } = await import('./stackmap.js');
      const { calculatePricing, initPricingEngine } = await import('./pricing.js');

      // Task 1: Scan
      const scanResult = await this.executeTask(plan, 'scan', async () => {
        return scan(this.targetPath);
      }) as ScanResult;

      // Task 2: Analyze with AI
      const agentResult = await this.executeTask(plan, 'analyze', async () => {
        return analyzeWithAgent(this.targetPath, {
          maxTurns: Math.min(20, Math.max(10, Math.ceil(scanResult.totalFiles / 100))),
          onProgress: (msg) => {
            const task = plan.tasks.find(t => t.id === 'analyze');
            if (task) this.callbacks.onTaskProgress?.(task, msg);
          },
        });
      }) as Awaited<ReturnType<typeof analyzeWithAgent>>;

      // Task 3: Build StackMap (pure transform, fast)
      const stackMap = await this.executeTask(plan, 'stackmap', async () => {
        return buildStackMap(agentResult.callsites, this.targetPath);
      }) as StackMap;

      // Task 4: Calculate Pricing
      await initPricingEngine();
      const pricing = await this.executeTask(plan, 'pricing', async () => {
        return calculatePricing(agentResult.callsites);
      }) as PricingSummary;

      // Task 5: Render (mark complete, actual rendering done by caller)
      await this.executeTask(plan, 'render', async () => {
        return { status: 'ready' };
      });

      const durationMs = Date.now() - startTime;
      this.callbacks.onComplete?.(plan.queryId, true, durationMs);

      return {
        queryId: plan.queryId,
        scan: scanResult,
        callsites: agentResult.callsites,
        stackMap,
        pricing,
        techStack: agentResult.techStack,
        patterns: agentResult.patterns,
        durationMs,
      };

    } catch (error) {
      const durationMs = Date.now() - startTime;
      this.callbacks.onComplete?.(plan.queryId, false, durationMs);
      throw error;
    }
  }
}

// =============================================================================
// CONVENIENCE FUNCTION
// =============================================================================

/**
 * Run analysis with agent architecture.
 *
 * Example:
 * ```typescript
 * const result = await runAgent('./my-project', {
 *   onTaskStart: (task) => console.log(`Starting: ${task.description}`),
 *   onTaskComplete: (task) => console.log(`Done: ${task.description}`),
 * });
 * ```
 */
export async function runAgent(
  targetPath: string,
  callbacks: AgentCallbacks = {}
): Promise<AnalysisOutput> {
  const agent = new Agent(targetPath, callbacks);
  return agent.run();
}
