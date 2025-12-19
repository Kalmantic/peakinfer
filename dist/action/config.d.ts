/**
 * Config Module (v1.6)
 *
 * Central configuration resolution for PeakInfer.
 * Resolution chain: CLI flags → env vars → global config → local config → defaults
 */
export interface PeakInferConfig {
    apiKey?: string;
    provider: 'anthropic';
    model: string;
    analysisMode: 'agent' | 'llm' | 'regex';
    maxFileSize: number;
    historyRetentionDays: number;
    verbose: boolean;
}
export interface ConfigOverrides {
    apiKey?: string;
    model?: string;
    analysisMode?: string;
    verbose?: boolean;
}
/**
 * Resolve configuration from all sources.
 * Priority: CLI overrides → env vars → global config → local config → defaults
 */
export declare function resolveConfig(overrides?: ConfigOverrides): PeakInferConfig;
/**
 * Get the resolved API key (convenience function)
 */
export declare function getApiKey(): string | undefined;
/**
 * Check if API key is configured
 */
export declare function hasApiKey(): boolean;
/**
 * Get config file paths for reference
 */
export declare function getConfigPaths(): {
    global: string;
    local: string;
};
