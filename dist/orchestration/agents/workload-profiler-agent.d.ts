/**
 * Workload Profiler Agent
 * Clusters prompts semantically and creates representative samples
 */
import { EnvironmentProfile } from '../../types/template.js';
import { WorkloadProfile } from '../multi-agent-orchestrator.js';
export declare class WorkloadProfilerAgent {
    /**
     * Profile workload by clustering prompts and identifying patterns
     */
    profileWorkload(workloadDataPath?: string, environment?: EnvironmentProfile): Promise<WorkloadProfile>;
    /**
     * Load workload data from JSONL file
     */
    private loadWorkloadData;
    /**
     * Cluster prompts using Claude's semantic understanding
     */
    private clusterPrompts;
    /**
     * Fallback: cluster by intent field
     */
    private clusterByIntent;
    /**
     * Generate representative samples for testing
     */
    private generateRepresentativeSamples;
    /**
     * Calculate cost breakdown by intent
     */
    private calculateCostBreakdown;
    /**
     * Create synthetic profile when no workload data available
     */
    private createSyntheticProfile;
    /**
     * Sample events uniformly
     */
    private sampleEvents;
    /**
     * Calculate average tokens
     */
    private calculateAvgTokens;
    /**
     * Parse Claude's JSON response
     */
    private parseClaudeResponse;
}
