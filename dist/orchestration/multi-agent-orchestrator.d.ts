/**
 * Multi-Agent Orchestrator - Coordinates all optimization agents
 *
 * This is the core orchestration system that coordinates:
 * - DiscoveryAgent: Environment discovery
 * - WorkloadProfiler: Prompt clustering and sampling
 * - PolicyAgent: Organizational constraints
 * - PlannerAgent: Optimization search planning
 * - RunnerEvaluator: Execution with early stopping
 * - AuditorAgent: Savings summary and patches
 */
import { EnvironmentProfile, OptimizationTemplate, TemplateExecutionResult } from '../types/template.js';
import { ClaudeDiscoveryAgent } from './agents/claude-discovery-agent.js';
import { WorkloadProfilerAgent } from './agents/workload-profiler-agent.js';
import { PolicyAgent } from './agents/policy-agent.js';
import { PlannerAgent } from './agents/planner-agent.js';
import { RunnerEvaluatorAgent } from './agents/runner-evaluator-agent.js';
import { AuditorAgent } from './agents/auditor-agent.js';
export interface OrchestrationResult {
    environment: EnvironmentProfile;
    workload_profile: WorkloadProfile;
    policy: OptimizationPolicy;
    plan: OptimizationPlan;
    execution_results: TemplateExecutionResult[];
    audit: AuditReport;
    total_savings: number;
    roi: number;
}
export interface WorkloadProfile {
    total_requests: number;
    clustered_intents: ClusteredIntent[];
    representative_samples: RepresentativeSample[];
    cost_breakdown: Record<string, number>;
}
export interface ClusteredIntent {
    intent_name: string;
    sample_count: number;
    avg_tokens: number;
    cost_contribution: number;
    representative_prompts: string[];
}
export interface RepresentativeSample {
    intent: string;
    prompt: string;
    expected_output_length: number;
    frequency: number;
}
export interface OptimizationPolicy {
    quality_threshold: number;
    latency_sla_ms: number;
    budget_monthly: number;
    allowed_risk_levels: string[];
    required_approvals: string[];
    excluded_techniques: string[];
}
export interface OptimizationPlan {
    search_strategy: 'greedy' | 'bandit' | 'exhaustive';
    candidate_templates: OptimizationTemplate[];
    execution_order: string[];
    early_stopping_criteria: StoppingCriteria;
    estimated_duration_minutes: number;
}
export interface StoppingCriteria {
    min_improvement_threshold: number;
    max_candidates_to_test: number;
    quality_degradation_threshold: number;
    max_execution_time_minutes: number;
}
export interface AuditReport {
    total_cost_savings_monthly: number;
    total_cost_savings_annual: number;
    total_implementation_cost: number;
    roi_annual: number;
    payback_period_months: number;
    templates_applied: string[];
    quality_impact: number;
    patches_generated: Patch[];
    recommendations: string[];
}
export interface Patch {
    file_path: string;
    patch_type: 'config' | 'code' | 'infrastructure';
    description: string;
    content: string;
    auto_applicable: boolean;
}
export declare class MultiAgentOrchestrator {
    discoveryAgent: ClaudeDiscoveryAgent;
    profilerAgent: WorkloadProfilerAgent;
    policyAgent: PolicyAgent;
    plannerAgent: PlannerAgent;
    runnerAgent: RunnerEvaluatorAgent;
    auditorAgent: AuditorAgent;
    constructor();
    /**
     * Main orchestration flow - coordinates all agents
     */
    orchestrateOptimization(options: {
        workloadDataPath?: string;
        policyPath?: string;
        dryRun?: boolean;
        templatesDir?: string;
    }): Promise<OrchestrationResult>;
    /**
     * Run a single agent query with Claude
     */
    runAgentQuery(prompt: string, context?: Record<string, any>): Promise<string>;
    /**
     * Get orchestration summary
     */
    getOrchestrationSummary(result: OrchestrationResult): string;
}
