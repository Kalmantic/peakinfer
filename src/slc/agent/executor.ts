/**
 * Executor - PeakInfer TDD v1.3 Section 3
 * 
 * Pass 2 of the two-pass execution model.
 * Executes the plan by resolving tasks to tool calls.
 * 
 * The executor:
 * - Takes a plan from Pass 1
 * - Resolves each task to specific tool calls
 * - Executes tools and saves results
 * - Handles errors, retries, and resumability
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import * as fs from 'fs';
import * as path from 'path';
import type {
  ExecutionPlan,
  ExecutionState,
  PlannedTask,
  ResolvedTask,
  ResolvedSubTask,
  TaskStatus,
  AgentConfig,
  AgentCallbacks,
} from './types.js';

// =============================================================================
// TASK EXECUTION PROMPTS
// =============================================================================

function getTaskExecutionPrompt(task: PlannedTask, context: string): string {
  return `Execute this analysis task:

TASK: ${task.description}

CONTEXT:
${context}

SUB-TASKS:
${task.subTasks.map((st, i) => `${i + 1}. ${st.description}`).join('\n')}

Instructions:
1. Use the available tools (Glob, Grep, Read) to complete the task
2. Be thorough but efficient - use grep to narrow down before reading files
3. Return structured results as JSON

Your response should include:
- What you found
- Relevant file locations
- Any issues or warnings
- Confidence level (0-1)

Return results as JSON.`;
}

// =============================================================================
// EXECUTOR CLASS
// =============================================================================

export class Executor {
  private config: AgentConfig;
  private callbacks: AgentCallbacks;
  private state: ExecutionState | null = null;
  
  constructor(config: Partial<AgentConfig> = {}, callbacks: AgentCallbacks = {}) {
    this.config = {
      provider: 'anthropic',
      model: config.model || 'claude-sonnet-4-5-20250929',
      temperature: 0,
      maxTurnsPerTask: config.maxTurnsPerTask || 10,
      maxTotalTurns: config.maxTotalTurns || 50,
      retryAttempts: config.retryAttempts || 3,
      toolTimeoutMs: config.toolTimeoutMs || 30000,
      cacheEnabled: config.cacheEnabled ?? true,
      contextDir: config.contextDir || '.peakinfer',
      ...config,
    };
    this.callbacks = callbacks;
  }
  
  /**
   * Execute a plan (Pass 2).
   */
  async execute(plan: ExecutionPlan, cwd: string): Promise<ExecutionState> {
    const startTime = Date.now();
    
    // Initialize execution state
    this.state = {
      plan,
      tasks: plan.tasks.map(t => this.initializeResolvedTask(t)),
      phase: 'executing',
      currentTaskIndex: 0,
      progress: 0,
      totalCostUsd: 0,
      startedAt: new Date().toISOString(),
    };
    
    // Ensure context directory exists
    const contextDir = path.join(cwd, this.config.contextDir, 'runs', plan.planId);
    await fs.promises.mkdir(contextDir, { recursive: true });
    
    // Save initial state
    await this.saveState(contextDir);
    
    try {
      // Execute tasks in order (respecting dependencies)
      for (let i = 0; i < this.state.tasks.length; i++) {
        const task = this.state.tasks[i];
        
        // Check dependencies
        const dependenciesMet = await this.checkDependencies(task, this.state.tasks);
        if (!dependenciesMet) {
          task.status = 'skipped';
          continue;
        }
        
        this.state.currentTaskIndex = i;
        this.state.progress = i / this.state.tasks.length;
        
        this.callbacks.onTaskStart?.(task.id, task.description);
        this.callbacks.onProgress?.(this.state.progress, `Executing: ${task.description}`);
        
        // Execute the task
        const taskStartTime = Date.now();
        task.status = 'running';
        
        try {
          const result = await this.executeTask(task, plan, cwd, contextDir);
          task.result = result;
          task.status = 'completed';
          task.durationMs = Date.now() - taskStartTime;
          
          this.callbacks.onTaskComplete?.(task.id, true);
          
        } catch (error) {
          task.status = 'failed';
          task.durationMs = Date.now() - taskStartTime;
          
          // Try to continue with other tasks if possible
          this.callbacks.onError?.(
            error instanceof Error ? error : new Error(String(error)),
            'execution'
          );
          this.callbacks.onTaskComplete?.(task.id, false);
        }
        
        // Save state after each task
        await this.saveState(contextDir);
      }
      
      this.state.phase = 'completed';
      this.state.progress = 1;
      this.state.completedAt = new Date().toISOString();
      
      await this.saveState(contextDir);
      
      return this.state;
      
    } catch (error) {
      this.state.phase = 'failed';
      await this.saveState(contextDir);
      throw error;
    }
  }
  
  /**
   * Resume execution from a saved state.
   */
  async resume(statePath: string, cwd: string): Promise<ExecutionState> {
    const stateData = await fs.promises.readFile(statePath, 'utf-8');
    this.state = JSON.parse(stateData);
    
    // Find first incomplete task
    const incompleteIndex = this.state!.tasks.findIndex(
      t => t.status === 'pending' || t.status === 'running'
    );
    
    if (incompleteIndex === -1) {
      // All tasks complete
      return this.state!;
    }
    
    this.state!.currentTaskIndex = incompleteIndex;
    this.state!.phase = 'executing';
    
    // Continue execution
    return this.execute(this.state!.plan, cwd);
  }
  
  /**
   * Execute a single task using the Claude Agent SDK.
   */
  private async executeTask(
    task: ResolvedTask,
    plan: ExecutionPlan,
    cwd: string,
    contextDir: string
  ): Promise<unknown> {
    const taskResultPath = path.join(contextDir, `${task.id}.json`);
    
    // Build context from completed tasks
    const context = this.buildTaskContext(task, this.state!.tasks, contextDir);
    
    let resultText = '';
    let taskCost = 0;
    let currentSubTaskIdx = 0;
    
    // Execute using agent SDK
    for await (const message of query({
      prompt: getTaskExecutionPrompt(task, context),
      options: {
        cwd,
        allowedTools: ['Read', 'Grep', 'Glob'],
        permissionMode: 'bypassPermissions',
        maxTurns: this.config.maxTurnsPerTask,
        model: this.config.model,
        env: {
          ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
          HOME: process.env.HOME,
          PATH: process.env.PATH,
        },
      },
    })) {
      if (message.type === 'assistant') {
        // Track tool usage for sub-task progress
        const content = message.message?.content;
        const toolUses = (Array.isArray(content) ? content : [])
          .filter((c): c is { type: 'tool_use'; name: string; input: unknown } =>
            c.type === 'tool_use' && typeof c.name === 'string'
          );
        
        for (const tool of toolUses) {
          if (currentSubTaskIdx < task.subTasks.length) {
            const subTask = task.subTasks[currentSubTaskIdx];
            subTask.toolName = tool.name;
            subTask.toolArgs = tool.input as Record<string, unknown>;
            subTask.status = 'running';
            
            this.callbacks.onSubTaskStart?.(task.id, subTask.id, tool.name);
          }
        }
        
      } else if (message.type === 'result') {
        if (message.subtype === 'success') {
          resultText = message.result ?? '';
          taskCost = message.total_cost_usd ?? 0;
          
          // Mark all sub-tasks as completed
          for (const subTask of task.subTasks) {
            if (subTask.status === 'running' || subTask.status === 'pending') {
              subTask.status = 'completed';
              this.callbacks.onSubTaskComplete?.(task.id, subTask.id, true);
            }
          }
          
        } else {
          // Handle partial results
          if (message.result) {
            resultText = message.result;
          }
          taskCost = (message as any).total_cost_usd ?? 0;
        }
        
        this.state!.totalCostUsd += taskCost;
      }
    }
    
    // Parse and save result
    let result: unknown;
    try {
      const jsonMatch = resultText.match(/\{[\s\S]*\}/);
      result = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: resultText };
    } catch {
      result = { raw: resultText };
    }
    
    // Save task result to file
    await fs.promises.writeFile(
      taskResultPath,
      JSON.stringify(result, null, 2),
      'utf-8'
    );
    
    return result;
  }
  
  /**
   * Check if a task's dependencies are met.
   */
  private async checkDependencies(
    task: ResolvedTask,
    allTasks: ResolvedTask[]
  ): Promise<boolean> {
    for (const depId of task.dependsOn) {
      const depTask = allTasks.find(t => t.id === depId);
      if (!depTask || depTask.status !== 'completed') {
        return false;
      }
    }
    return true;
  }
  
  /**
   * Build context string from completed tasks.
   */
  private buildTaskContext(
    currentTask: ResolvedTask,
    allTasks: ResolvedTask[],
    contextDir: string
  ): string {
    const contextParts: string[] = [];
    
    for (const depId of currentTask.dependsOn) {
      const depTask = allTasks.find(t => t.id === depId);
      if (depTask?.status === 'completed' && depTask.result) {
        contextParts.push(`[${depTask.id}] ${depTask.description}:`);
        contextParts.push(JSON.stringify(depTask.result, null, 2).slice(0, 2000));
        contextParts.push('');
      }
    }
    
    return contextParts.join('\n') || 'No prior context.';
  }
  
  /**
   * Initialize a resolved task from a planned task.
   */
  private initializeResolvedTask(task: PlannedTask): ResolvedTask {
    return {
      ...task,
      subTasks: task.subTasks.map(st => ({
        ...st,
        toolName: '',
        toolArgs: {},
        status: 'pending' as TaskStatus,
      })),
      status: 'pending',
    };
  }
  
  /**
   * Save execution state to disk for resumability.
   */
  private async saveState(contextDir: string): Promise<void> {
    if (!this.state) return;
    
    const statePath = path.join(contextDir, 'state.json');
    await fs.promises.writeFile(
      statePath,
      JSON.stringify(this.state, null, 2),
      'utf-8'
    );
  }
  
  /**
   * Get current execution state.
   */
  getState(): ExecutionState | null {
    return this.state;
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export { getTaskExecutionPrompt };

