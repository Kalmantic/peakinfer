/**
 * Claude-Powered Discovery Agent
 * Uses Claude Code SDK for intelligent environment discovery
 */
import { EnvironmentProfile } from '../../types/template.js';
export declare class ClaudeDiscoveryAgent {
    /**
     * Discover environment using Claude's intelligence
     */
    discover(): Promise<EnvironmentProfile>;
    /**
     * Parse Claude's JSON response
     */
    private parseClaudeResponse;
    /**
     * Identify problems in the environment
     */
    private identifyProblems;
    /**
     * Suggest solutions for identified problems
     */
    private suggestSolutions;
    /**
     * Fallback to basic file-based discovery
     */
    private fallbackDiscovery;
    /**
     * Check if file exists
     */
    private fileExists;
}
