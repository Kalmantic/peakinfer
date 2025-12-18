export interface ModelCost {
    input: number;
    output: number;
}
export interface PricingProvider {
    name: string;
    fetch(): Promise<Record<string, ModelCost>>;
}
/**
 * Set a custom pricing provider.
 * Call this before loadPricing() to use a different data source.
 *
 * Example:
 *   setPricingProvider({ name: 'local', fetch: async () => ({ ... }) });
 */
export declare function setPricingProvider(provider: PricingProvider): void;
/**
 * Get the current pricing provider name.
 */
export declare function getPricingProviderName(): string;
/**
 * Reset to default LiteLLM provider.
 */
export declare function resetToDefaultProvider(): void;
export declare function isCacheValid(): boolean;
export declare function loadPricing(): Promise<void>;
export declare function getModelCost(model: string): ModelCost;
export declare function calculateCost(model: string, inputTokens: number, outputTokens: number): number;
export declare function clearCache(): void;
export declare function setTestPricing(data: Record<string, {
    input: number;
    output: number;
}>): void;
/**
 * Pricing tier classification based on cost per 1M tokens
 */
export type PricingTier = 'expensive' | 'moderate' | 'cheap' | 'unknown';
/**
 * Classify a model into pricing tiers
 */
export declare function classifyModelCost(model: string): PricingTier;
/**
 * Get pricing context for LLM analysis
 * Returns a condensed pricing map for models used in the data
 */
export interface PricingContext {
    models: Record<string, {
        input: number;
        output: number;
        tier: PricingTier;
    }>;
    thresholds: {
        expensive: number;
        moderate: number;
    };
}
export declare function getPricingContext(models: string[]): PricingContext;
/**
 * Calculate total cost for a set of events
 */
export declare function calculateTotalCost(events: Array<{
    model: string;
    input_tokens: number;
    output_tokens: number;
}>): number;
