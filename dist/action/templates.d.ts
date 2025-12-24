import { InsightTemplate, OptimizationTemplate } from './types.js';
/**
 * Analysis prompt configuration loaded from YAML
 * Used for LLM-based code analysis with configurable focus areas
 */
export interface AnalysisPrompt {
    id: string;
    name: string;
    version: string;
    description: string;
    prompt: string;
    categories: string[];
    defaults?: {
        expensive_models?: string[];
        cheap_models?: string[];
        latency_critical_threshold_ms?: number;
        batch_opportunity_threshold?: number;
    };
}
export interface LoadOptions {
    offline?: boolean;
}
export declare function loadTemplates(opts?: LoadOptions): Promise<InsightTemplate[]>;
/**
 * Get a single template by ID
 */
export declare function getTemplate(id: string, opts?: LoadOptions): Promise<InsightTemplate | null>;
/**
 * Clear template cache
 */
export declare function clearCache(): void;
/**
 * Load bundled optimization templates from templates/optimizations/
 * These are community optimization runbooks with implementation steps
 */
export declare function loadOptimizationTemplates(): OptimizationTemplate[];
/**
 * Get a single optimization template by ID
 */
export declare function getOptimizationTemplate(id: string): OptimizationTemplate | null;
/**
 * Load an analysis prompt by ID from the prompts directory
 * @param id - Prompt ID (e.g., 'peak-performance')
 * @returns AnalysisPrompt or null if not found
 */
export declare function loadPrompt(id: string): AnalysisPrompt | null;
/**
 * List all available analysis prompts
 * @returns Array of prompt IDs
 */
export declare function listPrompts(): string[];
/**
 * Get the default analysis prompt (peak-performance)
 * @returns AnalysisPrompt
 * @throws Error if default prompt not found
 */
export declare function getDefaultPrompt(): AnalysisPrompt;
/**
 * PeakInfer configuration schema
 */
export interface PeakInferConfig {
    id: string;
    version: string;
    description: string;
    analysis: {
        mode: 'agent' | 'llm' | 'regex';
        cascade: boolean;
    };
    models: {
        agent: {
            primary: string;
            fallback: string;
        };
        llm: {
            primary: string;
            fallback: string;
        };
    };
    agent: {
        max_iterations: number;
        verbose: boolean;
    };
    scanner: {
        extensions: string[];
        max_file_size: number;
        ignore: string[];
    };
    output: {
        format: 'json' | 'yaml' | 'markdown';
        include_confidence: boolean;
        min_confidence: number;
    };
}
/**
 * Load PeakInfer configuration from config/peakinfer.yaml
 * Environment variables override file settings:
 *   - PEAKINFER_MODE: analysis mode (agent, llm, regex)
 *   - PEAKINFER_MODEL: primary model override
 *   - PEAKINFER_VERBOSE: enable verbose output
 * @returns PeakInferConfig
 */
export declare function loadConfig(): PeakInferConfig;
/**
 * Get the configured model for a given analysis type
 * @param type - 'agent' or 'llm'
 * @param fallback - whether to return fallback model
 * @returns model name
 */
export declare function getConfiguredModel(type: 'agent' | 'llm', fallback?: boolean): string;
/**
 * Get the configured analysis mode
 * @returns analysis mode
 */
export declare function getConfiguredMode(): 'agent' | 'llm' | 'regex';
/**
 * Check if cascade fallback is enabled
 * @returns true if cascade is enabled
 */
export declare function isCascadeEnabled(): boolean;
