/**
 * Policy Agent
 * Loads and enforces organizational constraints and policies
 */
import { OptimizationPolicy } from '../multi-agent-orchestrator.js';
export declare class PolicyAgent {
    /**
     * Load optimization policy from file or use defaults
     */
    loadPolicy(policyPath?: string): Promise<OptimizationPolicy>;
    /**
     * Load policy from YAML file
     */
    private loadPolicyFromFile;
    /**
     * Get default policy
     */
    private getDefaultPolicy;
    /**
     * Log policy details
     */
    private logPolicy;
    /**
     * Validate if template meets policy constraints
     */
    validateTemplate(template: any, policy: OptimizationPolicy): {
        allowed: boolean;
        reason?: string;
        requires_approval: boolean;
    };
}
