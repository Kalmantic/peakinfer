/**
 * Claude Helper Utilities
 * Manages Claude API key and formats responses beautifully
 */
export declare class ClaudeHelper {
    /**
     * Check if Claude API key is available
     */
    static checkApiKey(): boolean;
    /**
     * Get API key from environment
     */
    static getApiKey(): string | undefined;
    /**
     * Prompt user for API key if not found
     */
    static promptForApiKey(): Promise<string>;
    /**
     * Validate API key format
     */
    static validateApiKey(key: string): boolean;
    /**
     * Ensure API key is available (check env or prompt)
     */
    static ensureApiKey(): Promise<void>;
    /**
     * Format Claude's analysis response beautifully
     */
    static formatAnalysis(title: string, analysis: any): void;
    /**
     * Format problem/solution pair
     */
    static formatProblemSolution(problem: string, solution: string, details?: any): void;
    /**
     * Show Claude thinking process
     */
    static showThinking(message: string): void;
    /**
     * Show Claude's final recommendation
     */
    static showRecommendation(title: string, description: string, priority?: 'high' | 'medium' | 'low'): void;
    /**
     * Format optimization opportunity
     */
    static formatOptimization(optimization: {
        name: string;
        description: string;
        current_state: string;
        proposed_state: string;
        savings_monthly: number;
        implementation_effort: string;
        confidence: number;
    }): void;
}
