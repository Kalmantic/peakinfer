/**
 * Planner Agent
 * Creates optimization search plans with candidate templates
 */
import { EnvironmentProfile } from '../../types/template.js';
import { WorkloadProfile, OptimizationPolicy, OptimizationPlan } from '../multi-agent-orchestrator.js';
export declare class PlannerAgent {
    private templateEngine;
    constructor();
    /**
     * Create optimization plan using Claude's reasoning
     */
    createPlan(environment: EnvironmentProfile, workloadProfile: WorkloadProfile, policy: OptimizationPolicy, templatesDir?: string): Promise<OptimizationPlan>;
    /**
     * Determine search strategy using Claude
     */
    private determineSearchStrategy;
    /**
     * Prioritize templates by expected impact
     */
    private prioritizeTemplates;
    /**
     * Estimate execution duration
     */
    private estimateDuration;
}
