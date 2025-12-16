/**
 * Planner - PeakInfer TDD v1.3 Section 3
 * 
 * Pass 1 of the two-pass execution model.
 * Generates an execution plan (WHAT to do) without naming specific tools.
 * 
 * The planner:
 * - Analyzes the query/command
 * - Determines required tasks and their dependencies
 * - Orders tasks for optimal execution
 * - Does NOT decide HOW to execute (that's Pass 2)
 */

import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import type {
  ExecutionPlan,
  PlannedTask,
  PlannedSubTask,
  AgentConfig,
  AgentCallbacks,
} from './types.js';

// =============================================================================
// PLANNING PROMPTS
// =============================================================================

const PLANNING_SYSTEM_PROMPT = `You are a planning agent for PeakInfer, an LLM inference analysis tool.

Your job is to create an execution plan for analyzing a codebase or runtime events.
You do NOT execute anything - you only create plans.

Analysis modes:
1. STATIC: Analyze codebase for LLM inference callsites
2. RUNTIME: Analyze runtime events file for usage patterns
3. COMBINED: Both static + runtime with drift detection

For each mode, create a plan with these task types:

STATIC MODE TASKS:
1. scan_files - Discover source files in the codebase
2. detect_callsites - Find LLM API callsites
3. classify_callsites - Determine provider, model, patterns
4. build_stackmap - Create inference topology map
5. generate_insights - Produce findings and recommendations

RUNTIME MODE TASKS:
1. detect_format - Identify runtime events file format
2. normalize_events - Parse and normalize to InferenceEvent schema
3. aggregate_metrics - Compute statistics and distributions
4. generate_insights - Produce findings

COMBINED MODE TASKS:
1. All static tasks
2. All runtime tasks
3. join_analysis - Correlate static and runtime data
4. detect_drift - Find code vs runtime mismatches

Output a JSON execution plan with this structure:
{
  "mode": "static|runtime|combined",
  "tasks": [
    {
      "id": "task-001",
      "description": "Human-readable description of what needs to be done",
      "dependsOn": ["task-ids-that-must-complete-first"],
      "complexity": "simple|medium|complex",
      "subTasks": [
        {
          "id": 1,
          "description": "Specific sub-task description",
          "parallelizable": true|false
        }
      ]
    }
  ],
  "estimatedDurationMs": 30000,
  "estimatedTurns": 15
}

IMPORTANT:
- Task descriptions should be WHAT to do, not HOW
- Do not mention specific tools (Glob, Grep, Read)
- Order tasks by dependencies
- Mark independent tasks as parallelizable`;

function getPlanningUserPrompt(
  target: string,
  mode: 'static' | 'runtime' | 'combined',
  options: { eventsFile?: string; fileCount?: number }
): string {
  const { eventsFile, fileCount } = options;
  
  let prompt = `Create an execution plan for: ${mode.toUpperCase()} analysis\n\n`;
  prompt += `Target: ${target}\n`;
  
  if (mode === 'static' || mode === 'combined') {
    prompt += `Analysis type: Codebase scan for LLM inference points\n`;
    if (fileCount) {
      prompt += `Estimated files: ${fileCount}\n`;
    }
  }
  
  if (mode === 'runtime' || mode === 'combined') {
    prompt += `Events file: ${eventsFile || 'auto-detect'}\n`;
    prompt += `Analysis type: Runtime events analysis\n`;
  }
  
  if (mode === 'combined') {
    prompt += `Combined: Correlate static code with runtime events, detect drift\n`;
  }
  
  prompt += `\nGenerate the execution plan as JSON.`;
  
  return prompt;
}

// =============================================================================
// PLANNER CLASS
// =============================================================================

export class Planner {
  private client: Anthropic;
  private config: AgentConfig;
  private callbacks: AgentCallbacks;
  
  constructor(config: Partial<AgentConfig> = {}, callbacks: AgentCallbacks = {}) {
    this.client = new Anthropic();
    this.config = {
      provider: 'anthropic',
      model: config.model || 'claude-sonnet-4-5-20250929',
      temperature: 0,
      maxTurnsPerTask: 10,
      maxTotalTurns: 50,
      retryAttempts: 3,
      toolTimeoutMs: 30000,
      cacheEnabled: true,
      contextDir: '.peakinfer',
      ...config,
    };
    this.callbacks = callbacks;
  }
  
  /**
   * Generate an execution plan (Pass 1).
   */
  async generatePlan(
    target: string,
    mode: 'static' | 'runtime' | 'combined',
    options: { eventsFile?: string; fileCount?: number } = {}
  ): Promise<ExecutionPlan> {
    this.callbacks.onPlanningStart?.();
    
    const planId = `plan-${uuidv4().slice(0, 8)}`;
    const startTime = Date.now();
    
    try {
      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: 2000,
        temperature: this.config.temperature,
        system: PLANNING_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: getPlanningUserPrompt(target, mode, options),
          },
        ],
      });
      
      // Extract JSON from response
      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from planner');
      }
      
      const planData = this.parseplanResponse(content.text);
      
      const plan: ExecutionPlan = {
        planId,
        query: `${mode} analysis of ${target}`,
        mode,
        target,
        tasks: planData.tasks,
        metadata: {
          createdAt: new Date().toISOString(),
          estimatedDurationMs: planData.estimatedDurationMs || 30000,
          estimatedTurns: planData.estimatedTurns || 15,
        },
      };
      
      this.callbacks.onPlanGenerated?.(plan);
      
      return plan;
      
    } catch (error) {
      this.callbacks.onError?.(
        error instanceof Error ? error : new Error(String(error)),
        'planning'
      );
      
      // Return a default plan on error
      return this.getDefaultPlan(planId, target, mode);
    }
  }
  
  /**
   * Parse the LLM response to extract the plan.
   */
  private parseplanResponse(text: string): {
    tasks: PlannedTask[];
    estimatedDurationMs?: number;
    estimatedTurns?: number;
  } {
    // Try to extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in planner response');
    }
    
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate and normalize tasks
      const tasks: PlannedTask[] = (parsed.tasks || []).map((t: any, idx: number) => ({
        id: t.id || `task-${idx + 1}`,
        description: t.description || 'Unknown task',
        dependsOn: Array.isArray(t.dependsOn) ? t.dependsOn : [],
        complexity: ['simple', 'medium', 'complex'].includes(t.complexity) ? t.complexity : 'medium',
        subTasks: (t.subTasks || []).map((st: any, stIdx: number) => ({
          id: st.id || stIdx + 1,
          description: st.description || 'Unknown sub-task',
          parallelizable: st.parallelizable === true,
        })),
      }));
      
      return {
        tasks,
        estimatedDurationMs: parsed.estimatedDurationMs,
        estimatedTurns: parsed.estimatedTurns,
      };
    } catch (e) {
      throw new Error(`Failed to parse plan JSON: ${e}`);
    }
  }
  
  /**
   * Get a default execution plan when LLM planning fails.
   */
  private getDefaultPlan(
    planId: string,
    target: string,
    mode: 'static' | 'runtime' | 'combined'
  ): ExecutionPlan {
    const staticTasks: PlannedTask[] = [
      {
        id: 'scan',
        description: 'Scan the codebase to discover source files',
        dependsOn: [],
        complexity: 'simple',
        subTasks: [
          { id: 1, description: 'Walk directory tree', parallelizable: false },
          { id: 2, description: 'Filter by language', parallelizable: false },
          { id: 3, description: 'Apply ignore patterns', parallelizable: false },
        ],
      },
      {
        id: 'analyze',
        description: 'Analyze source files for LLM inference callsites',
        dependsOn: ['scan'],
        complexity: 'complex',
        subTasks: [
          { id: 1, description: 'Search for LLM SDK imports', parallelizable: true },
          { id: 2, description: 'Find API call patterns', parallelizable: true },
          { id: 3, description: 'Extract provider and model info', parallelizable: false },
          { id: 4, description: 'Detect inference patterns', parallelizable: false },
        ],
      },
      {
        id: 'build-stackmap',
        description: 'Build inference topology map',
        dependsOn: ['analyze'],
        complexity: 'simple',
        subTasks: [
          { id: 1, description: 'Organize callsites by file', parallelizable: false },
          { id: 2, description: 'Compute statistics', parallelizable: false },
        ],
      },
      {
        id: 'insights',
        description: 'Generate findings and recommendations',
        dependsOn: ['build-stackmap'],
        complexity: 'medium',
        subTasks: [
          { id: 1, description: 'Evaluate cost opportunities', parallelizable: true },
          { id: 2, description: 'Detect pattern issues', parallelizable: true },
          { id: 3, description: 'Generate recommendations', parallelizable: false },
        ],
      },
    ];
    
    const runtimeTasks: PlannedTask[] = [
      {
        id: 'detect-format',
        description: 'Detect the format of the runtime events file',
        dependsOn: [],
        complexity: 'simple',
        subTasks: [
          { id: 1, description: 'Sample file content', parallelizable: false },
          { id: 2, description: 'Match against known formats', parallelizable: false },
        ],
      },
      {
        id: 'normalize',
        description: 'Normalize events to InferenceEvent schema',
        dependsOn: ['detect-format'],
        complexity: 'medium',
        subTasks: [
          { id: 1, description: 'Parse events', parallelizable: false },
          { id: 2, description: 'Map fields', parallelizable: false },
          { id: 3, description: 'Validate schema', parallelizable: false },
        ],
      },
      {
        id: 'aggregate',
        description: 'Aggregate metrics and compute statistics',
        dependsOn: ['normalize'],
        complexity: 'simple',
        subTasks: [
          { id: 1, description: 'Compute by provider', parallelizable: true },
          { id: 2, description: 'Compute by model', parallelizable: true },
          { id: 3, description: 'Compute latency percentiles', parallelizable: true },
        ],
      },
    ];
    
    const joinTasks: PlannedTask[] = [
      {
        id: 'join',
        description: 'Join static analysis with runtime events',
        dependsOn: ['build-stackmap', 'aggregate'],
        complexity: 'medium',
        subTasks: [
          { id: 1, description: 'Match callsites to events', parallelizable: false },
          { id: 2, description: 'Detect code-only callsites', parallelizable: false },
          { id: 3, description: 'Detect runtime-only events', parallelizable: false },
        ],
      },
      {
        id: 'drift',
        description: 'Detect drift between code and runtime',
        dependsOn: ['join'],
        complexity: 'medium',
        subTasks: [
          { id: 1, description: 'Check model mismatches', parallelizable: true },
          { id: 2, description: 'Check provider mismatches', parallelizable: true },
          { id: 3, description: 'Check pattern mismatches', parallelizable: true },
        ],
      },
    ];
    
    let tasks: PlannedTask[];
    switch (mode) {
      case 'static':
        tasks = staticTasks;
        break;
      case 'runtime':
        tasks = runtimeTasks;
        break;
      case 'combined':
        tasks = [...staticTasks, ...runtimeTasks, ...joinTasks];
        break;
    }
    
    return {
      planId,
      query: `${mode} analysis of ${target}`,
      mode,
      target,
      tasks,
      metadata: {
        createdAt: new Date().toISOString(),
        estimatedDurationMs: mode === 'combined' ? 60000 : 30000,
        estimatedTurns: mode === 'combined' ? 30 : 15,
      },
    };
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export { getPlanningUserPrompt, PLANNING_SYSTEM_PROMPT };

