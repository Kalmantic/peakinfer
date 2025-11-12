/**
 * Auditor Agent
 * Summarizes optimization results and generates patches
 */
import { EnvironmentProfile, TemplateExecutionResult } from '../../types/template.js';
import { WorkloadProfile, OptimizationPolicy, AuditReport } from '../multi-agent-orchestrator.js';
export declare class AuditorAgent {
    /**
     * Audit optimization results and generate report
     */
    auditResults(results: TemplateExecutionResult[], environment: EnvironmentProfile, workloadProfile: WorkloadProfile, policy: OptimizationPolicy): Promise<AuditReport>;
    /**
     * Calculate overall quality impact
     */
    private calculateQualityImpact;
    /**
     * Generate implementation patches using Claude
     */
    private generatePatches;
    /**
     * Generate recommendations using Claude
     */
    private generateRecommendations;
    /**
     * Save patches to disk
     */
    private savePatches;
    /**
     * Parse Claude's JSON response
     */
    private parseClaudeResponse;
}
