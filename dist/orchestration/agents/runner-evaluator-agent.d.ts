/**
 * Runner Evaluator Agent
 * Executes optimization candidates with bandit-style early stopping
 */
import { EnvironmentProfile, TemplateExecutionResult } from '../../types/template.js';
import { WorkloadProfile, OptimizationPlan } from '../multi-agent-orchestrator.js';
export declare class RunnerEvaluatorAgent {
    private executionAgent;
    private templateEngine;
    private economicsCalculator;
    constructor();
    /**
     * Execute templates with early stopping
     */
    executeWithEarlyStopping(plan: OptimizationPlan, environment: EnvironmentProfile, workloadProfile: WorkloadProfile, dryRun: boolean): Promise<TemplateExecutionResult[]>;
    /**
     * Check if early stopping criteria are met
     */
    private shouldStopEarly;
    /**
     * Evaluate candidate using multi-arm bandit approach
     */
    private evaluateCandidate;
}
