import type { ExecutionPlan, PlannedTask, TaskResult } from './types.js';
import type { AgentResults } from './agent.js';
/**
 * ZERO STATE: No inference usage detected
 * Julie Zhou: calm, helpful, not alarming
 */
declare function renderZeroState(): void;
/**
 * PARTIAL STATE: Some results with warnings
 * Julie Zhou: calm, informative
 */
declare function renderPartialState(warnings: string[]): void;
export interface RendererOptions {
    verbose?: boolean;
    showFixes?: boolean;
}
export interface ProgressData {
    phase: 'scanning' | 'analyzing' | 'profiling' | 'parsing' | 'correlating' | 'generating';
    detail?: string;
    percent?: number;
    currentFile?: string;
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
export declare function createRenderer(opts?: RendererOptions): {
    renderHeader(): void;
    renderResumed(runId: string): void;
    renderPlan(plan: ExecutionPlan): void;
    renderTaskStart(task: PlannedTask): void;
    renderTaskComplete(task: PlannedTask, result: TaskResult): void;
    renderProgress(data: ProgressData): void;
    renderPartial(warnings: string[]): void;
    renderResults(results: AgentResults): void;
    renderError(error: Error, context?: {
        file?: string;
        line?: number;
        field?: string;
    }): void;
    renderZeroState: typeof renderZeroState;
    renderPartialState: typeof renderPartialState;
};
export type Renderer = ReturnType<typeof createRenderer>;
export {};
