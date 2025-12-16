/**
 * Agent Types - PeakInfer TDD v1.3 Section 3
 * 
 * Core type definitions for the two-pass execution model.
 */

// =============================================================================
// EXECUTION PLAN TYPES
// =============================================================================

/**
 * A planned task in the execution plan.
 * Per TDD: "No tools named in the plan" - descriptions are tool-agnostic.
 */
export interface PlannedTask {
  /** Unique task identifier */
  id: string;
  
  /** Human-readable task description */
  description: string;
  
  /** Task dependencies (IDs of tasks that must complete first) */
  dependsOn: string[];
  
  /** Estimated complexity (affects timeout/retries) */
  complexity: 'simple' | 'medium' | 'complex';
  
  /** Sub-tasks within this task */
  subTasks: PlannedSubTask[];
}

/**
 * A sub-task within a planned task.
 */
export interface PlannedSubTask {
  /** Sub-task identifier (scoped to parent task) */
  id: number;
  
  /** Description of what needs to be done */
  description: string;
  
  /** Whether this can run in parallel with other sub-tasks */
  parallelizable: boolean;
}

/**
 * The full execution plan generated in Pass 1.
 */
export interface ExecutionPlan {
  /** Unique plan identifier */
  planId: string;
  
  /** Query/command that triggered this plan */
  query: string;
  
  /** Analysis mode */
  mode: 'static' | 'runtime' | 'combined';
  
  /** Target path or file */
  target: string;
  
  /** Tasks to execute */
  tasks: PlannedTask[];
  
  /** Plan metadata */
  metadata: {
    createdAt: string;
    estimatedDurationMs: number;
    estimatedTurns: number;
  };
}

// =============================================================================
// RESOLVED TASK TYPES (Pass 2)
// =============================================================================

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

/**
 * A resolved sub-task with tool information (Pass 2).
 */
export interface ResolvedSubTask extends PlannedSubTask {
  /** Resolved tool name */
  toolName: string;
  
  /** Tool arguments */
  toolArgs: Record<string, unknown>;
  
  /** Current status */
  status: TaskStatus;
  
  /** Path to result file (if completed) */
  resultPath?: string;
  
  /** Error message (if failed) */
  error?: string;
  
  /** Execution duration in ms */
  durationMs?: number;
}

/**
 * A resolved task with execution state.
 */
export interface ResolvedTask extends Omit<PlannedTask, 'subTasks'> {
  /** Resolved sub-tasks */
  subTasks: ResolvedSubTask[];
  
  /** Overall task status */
  status: TaskStatus;
  
  /** Task-level result (aggregated from sub-tasks) */
  result?: unknown;
  
  /** Total execution duration */
  durationMs?: number;
}

/**
 * Execution state tracking the progress of a plan.
 */
export interface ExecutionState {
  /** The plan being executed */
  plan: ExecutionPlan;
  
  /** Resolved tasks with execution state */
  tasks: ResolvedTask[];
  
  /** Current phase */
  phase: 'planning' | 'executing' | 'completed' | 'failed';
  
  /** Current task index */
  currentTaskIndex: number;
  
  /** Overall progress (0-1) */
  progress: number;
  
  /** Accumulated cost in USD */
  totalCostUsd: number;
  
  /** Start time */
  startedAt: string;
  
  /** End time (if completed) */
  completedAt?: string;
}

// =============================================================================
// CALLBACK TYPES (TDD Section 4)
// =============================================================================

/**
 * Callbacks for UI integration.
 * Per TDD: "Zero coupling" - agent core doesn't know about UI.
 */
export interface AgentCallbacks {
  /** Called when analysis starts */
  onQueryStart?: (query: string, queryId: string) => void;
  
  /** Called when analysis completes */
  onQueryComplete?: (queryId: string, success: boolean, durationMs: number) => void;
  
  /** Called when planning phase starts */
  onPlanningStart?: () => void;
  
  /** Called when plan is generated */
  onPlanGenerated?: (plan: ExecutionPlan) => void;
  
  /** Called when a task starts */
  onTaskStart?: (taskId: string, description: string) => void;
  
  /** Called when a sub-task starts */
  onSubTaskStart?: (taskId: string, subTaskId: number, toolName: string) => void;
  
  /** Called when a sub-task completes */
  onSubTaskComplete?: (taskId: string, subTaskId: number, success: boolean) => void;
  
  /** Called when a task completes */
  onTaskComplete?: (taskId: string, success: boolean) => void;
  
  /** Called for streaming answer output */
  onAnswerStream?: (chunk: string) => void;
  
  /** Called on error */
  onError?: (error: Error, phase: 'planning' | 'execution' | 'analysis') => void;
  
  /** Called with progress updates */
  onProgress?: (progress: number, message: string) => void;
}

// =============================================================================
// AGENT CONFIGURATION
// =============================================================================

export interface AgentConfig {
  /** LLM provider */
  provider: 'anthropic' | 'openai' | 'google';
  
  /** Model to use */
  model: string;
  
  /** Temperature (0 for deterministic) */
  temperature: number;
  
  /** Maximum turns per task */
  maxTurnsPerTask: number;
  
  /** Maximum total turns */
  maxTotalTurns: number;
  
  /** Retry attempts on failure */
  retryAttempts: number;
  
  /** Tool timeout in ms */
  toolTimeoutMs: number;
  
  /** Whether to enable caching */
  cacheEnabled: boolean;
  
  /** Context directory for persistence */
  contextDir: string;
}

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  provider: 'anthropic',
  model: 'claude-sonnet-4-5-20250929',
  temperature: 0,
  maxTurnsPerTask: 10,
  maxTotalTurns: 50,
  retryAttempts: 3,
  toolTimeoutMs: 30000,
  cacheEnabled: true,
  contextDir: '.peakinfer',
};

