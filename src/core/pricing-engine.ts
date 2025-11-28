/**
 * Pricing Delta Engine
 * Based on PRD v0.95 Section 13: Pricing Intelligence Engine
 * 
 * Tracks model pricing, calculates costs, and provides alternatives
 */

import { StackMap, PricingResult, Callsite } from '../types/stackmap.js';

/**
 * Pricing data for models (updated Nov 2025)
 * Format: input price per 1M tokens, output price per 1M tokens
 */
const PRICING_DATA: Record<string, Record<string, { input: number; output: number; updated: string }>> = {
  openai: {
    'gpt-4o': { input: 2.50, output: 10.00, updated: '2025-11' },
    'gpt-4o-mini': { input: 0.15, output: 0.60, updated: '2025-11' },
    'gpt-4-turbo': { input: 10.00, output: 30.00, updated: '2025-11' },
    'gpt-4': { input: 30.00, output: 60.00, updated: '2025-11' },
    'gpt-3.5-turbo': { input: 0.50, output: 1.50, updated: '2025-11' },
    'o1': { input: 15.00, output: 60.00, updated: '2025-11' },
    'o1-mini': { input: 3.00, output: 12.00, updated: '2025-11' },
    'o3-mini': { input: 1.10, output: 4.40, updated: '2025-11' },
    'text-embedding-3-large': { input: 0.13, output: 0, updated: '2025-11' },
    'text-embedding-3-small': { input: 0.02, output: 0, updated: '2025-11' },
  },
  anthropic: {
    'claude-sonnet-4-20250514': { input: 3.00, output: 15.00, updated: '2025-11' },
    'claude-opus-4-20250514': { input: 15.00, output: 75.00, updated: '2025-11' },
    'claude-3.5-sonnet': { input: 3.00, output: 15.00, updated: '2025-11' },
    'claude-3.5-haiku': { input: 0.80, output: 4.00, updated: '2025-11' },
    'claude-3-opus': { input: 15.00, output: 75.00, updated: '2025-11' },
    'claude-3-sonnet': { input: 3.00, output: 15.00, updated: '2025-11' },
    'claude-3-haiku': { input: 0.25, output: 1.25, updated: '2025-11' },
  },
  google: {
    'gemini-2.0-flash': { input: 0.075, output: 0.30, updated: '2025-11' },
    'gemini-2.5-pro': { input: 1.25, output: 5.00, updated: '2025-11' },
    'gemini-1.5-pro': { input: 1.25, output: 5.00, updated: '2025-11' },
    'gemini-1.5-flash': { input: 0.075, output: 0.30, updated: '2025-11' },
  },
  together: {
    'llama-3-70b': { input: 0.90, output: 0.90, updated: '2025-11' },
    'llama-3-8b': { input: 0.20, output: 0.20, updated: '2025-11' },
    'mixtral-8x7b': { input: 0.60, output: 0.60, updated: '2025-11' },
    'mixtral-8x22b': { input: 1.20, output: 1.20, updated: '2025-11' },
  },
  fireworks: {
    'llama-3-70b': { input: 0.70, output: 0.70, updated: '2025-11' },
    'mixtral-8x7b': { input: 0.50, output: 0.50, updated: '2025-11' },
  },
  groq: {
    'llama-3-70b': { input: 0.59, output: 0.79, updated: '2025-11' },
    'llama-3-8b': { input: 0.05, output: 0.08, updated: '2025-11' },
    'mixtral-8x7b': { input: 0.24, output: 0.24, updated: '2025-11' },
  },
  cohere: {
    'command-r-plus': { input: 2.50, output: 10.00, updated: '2025-11' },
    'command-r': { input: 0.50, output: 1.50, updated: '2025-11' },
    'embed-v3': { input: 0.10, output: 0, updated: '2025-11' },
  },
  deepseek: {
    'deepseek-v3': { input: 0.27, output: 1.10, updated: '2025-11' },
    'deepseek-r1': { input: 0.55, output: 2.19, updated: '2025-11' },
  },
  mistral: {
    'mistral-large-2': { input: 2.00, output: 6.00, updated: '2025-11' },
    'mistral-small': { input: 0.20, output: 0.60, updated: '2025-11' },
    'codestral': { input: 0.20, output: 0.60, updated: '2025-11' },
  }
};

/**
 * Price changes tracking (for deltas)
 */
const PRICE_CHANGES: { vendor: string; model: string; change: number; date: string }[] = [
  { vendor: 'OpenAI', model: 'gpt-4o', change: -12, date: 'Oct 2025' },
  { vendor: 'OpenAI', model: 'gpt-4o-mini', change: -20, date: 'Sep 2025' },
  { vendor: 'Together', model: 'llama-3-70b', change: -8, date: 'Nov 2025' },
  { vendor: 'Anthropic', model: 'claude-3.5-sonnet', change: 0, date: 'Nov 2025' },
];

/**
 * Alternative providers for same/similar models
 */
const ALTERNATIVES: Record<string, { provider: string; model: string; savingsPercent: number }[]> = {
  'llama-3-70b': [
    { provider: 'Fireworks', model: 'llama-3-70b', savingsPercent: 24 },
    { provider: 'Groq', model: 'llama-3-70b', savingsPercent: 34 },
    { provider: 'Self-hosted (H100)', model: 'llama-3-70b', savingsPercent: 50 },
  ],
  'mixtral-8x7b': [
    { provider: 'Fireworks', model: 'mixtral-8x7b', savingsPercent: 17 },
    { provider: 'Groq', model: 'mixtral-8x7b', savingsPercent: 60 },
  ],
  'claude-3.5-sonnet': [
    { provider: 'AWS Bedrock', model: 'claude-3.5-sonnet', savingsPercent: 7 },
  ],
  'claude-sonnet-4-20250514': [
    { provider: 'AWS Bedrock', model: 'claude-sonnet-4-20250514', savingsPercent: 5 },
  ],
};

// Default token estimates when not provided
const DEFAULT_MONTHLY_TOKENS = {
  input: 2000000,  // 2M tokens/month
  output: 500000,  // 500K tokens/month
};

export class PricingEngine {
  private pricingData: typeof PRICING_DATA;
  private priceChanges: typeof PRICE_CHANGES;

  constructor() {
    this.pricingData = PRICING_DATA;
    this.priceChanges = PRICE_CHANGES;
  }

  /**
   * Calculate pricing from StackMap
   */
  async calculatePricing(stackmap: StackMap): Promise<PricingResult> {
    const vendorCosts: Record<string, number> = {};
    const modelCosts: Record<string, { provider: string; cost: number }> = {};
    let totalCostLow = 0;
    let totalCostHigh = 0;

    // Calculate costs per callsite
    for (const callsite of stackmap.callsites) {
      const provider = (callsite.provider || 'unknown').toLowerCase();
      const model = this.normalizeModelName(callsite.model || 'unknown');

      // Get pricing
      const pricing = this.getPricing(provider, model);
      if (!pricing) continue;

      // Get token estimates
      const tokens = this.estimateTokens(callsite);
      
      // Calculate cost
      const inputCost = (tokens.input / 1000000) * pricing.input;
      const outputCost = (tokens.output / 1000000) * pricing.output;
      const callsiteCost = inputCost + outputCost;

      // Aggregate by vendor
      vendorCosts[provider] = (vendorCosts[provider] || 0) + callsiteCost;

      // Aggregate by model
      const modelKey = `${provider}:${model}`;
      if (!modelCosts[modelKey]) {
        modelCosts[modelKey] = { provider, cost: 0 };
      }
      modelCosts[modelKey].cost += callsiteCost;

      // Total with variance
      totalCostLow += callsiteCost * 0.7; // 30% lower bound
      totalCostHigh += callsiteCost * 1.5; // 50% upper bound
    }

    // Calculate vendor percentages
    const totalVendorCost = Object.values(vendorCosts).reduce((a, b) => a + b, 0);
    const byVendor = Object.entries(vendorCosts)
      .map(([name, cost]) => ({
        name: this.capitalizeProvider(name),
        cost: Math.round(cost),
        percentage: Math.round((cost / totalVendorCost) * 100) || 0
      }))
      .sort((a, b) => b.cost - a.cost);

    // Calculate model breakdown
    const byModel = Object.entries(modelCosts)
      .map(([key, { provider, cost }]) => ({
        name: key.split(':')[1],
        provider: this.capitalizeProvider(provider),
        cost: Math.round(cost),
        percentage: Math.round((cost / totalVendorCost) * 100) || 0
      }))
      .sort((a, b) => b.cost - a.cost);

    // Get alternatives
    const alternatives = this.calculateAlternatives(stackmap, modelCosts);

    // Get relevant price deltas
    const deltas = this.priceChanges.filter(d => 
      Object.keys(vendorCosts).some(v => 
        v.toLowerCase() === d.vendor.toLowerCase()
      )
    );

    return {
      estimatedMonthlyCost: Math.round((totalCostLow + totalCostHigh) / 2),
      estimatedMonthlyCostHigh: Math.round(totalCostHigh),
      byVendor,
      byModel,
      deltas: deltas.length > 0 ? deltas : undefined,
      alternatives: alternatives.length > 0 ? alternatives : undefined,
      pricingDataDate: '2025-11'
    };
  }

  /**
   * Get pricing for a provider/model
   */
  private getPricing(provider: string, model: string): { input: number; output: number } | null {
    const providerData = this.pricingData[provider.toLowerCase()];
    if (!providerData) {
      // Try to find by model name across providers
      for (const [p, models] of Object.entries(this.pricingData)) {
        if (models[model]) {
          return models[model];
        }
      }
      // Return default pricing
      return { input: 2.0, output: 8.0 };
    }

    // Exact match
    if (providerData[model]) {
      return providerData[model];
    }

    // Fuzzy match
    const normalizedModel = model.toLowerCase();
    for (const [m, pricing] of Object.entries(providerData)) {
      if (normalizedModel.includes(m.toLowerCase()) || m.toLowerCase().includes(normalizedModel)) {
        return pricing;
      }
    }

    // Default for provider
    const defaultModels = Object.values(providerData);
    if (defaultModels.length > 0) {
      return defaultModels[0];
    }

    return { input: 2.0, output: 8.0 };
  }

  /**
   * Estimate tokens for a callsite
   */
  private estimateTokens(callsite: Callsite): { input: number; output: number } {
    if (callsite.estimatedTokens) {
      return {
        input: callsite.estimatedTokens.estimatedInputTokens || DEFAULT_MONTHLY_TOKENS.input,
        output: callsite.estimatedTokens.estimatedOutputTokens || DEFAULT_MONTHLY_TOKENS.output
      };
    }

    // Default estimates based on task kind
    switch (callsite.taskKind) {
      case 'embedding':
        return { input: 5000000, output: 0 }; // Embeddings have no output tokens
      case 'chat':
        return { input: 2000000, output: 1000000 };
      case 'completion':
        return { input: 1000000, output: 2000000 };
      case 'function_call':
        return { input: 500000, output: 500000 };
      default:
        return DEFAULT_MONTHLY_TOKENS;
    }
  }

  /**
   * Calculate alternative pricing options
   */
  private calculateAlternatives(
    _stackmap: StackMap,
    modelCosts: Record<string, { provider: string; cost: number }>
  ): NonNullable<PricingResult['alternatives']> {
    const alternatives: NonNullable<PricingResult['alternatives']> = [];

    for (const [modelKey, { provider, cost }] of Object.entries(modelCosts)) {
      const model = modelKey.split(':')[1];
      const modelAlts = ALTERNATIVES[model];

      if (modelAlts) {
        for (const alt of modelAlts) {
          const altCost = cost * (1 - alt.savingsPercent / 100);
          alternatives.push({
            model,
            currentProvider: this.capitalizeProvider(provider),
            provider: alt.provider,
            cost: `$${Math.round(altCost).toLocaleString()}`,
            savings: `↓${alt.savingsPercent}%`
          });
        }
      }
    }

    return alternatives;
  }

  /**
   * Normalize model name
   */
  private normalizeModelName(model: string): string {
    // Remove version suffixes
    return model
      .replace(/-\d{8}$/, '') // Remove date suffixes like -20250514
      .replace(/-preview$/, '')
      .replace(/-latest$/, '')
      .toLowerCase();
  }

  /**
   * Capitalize provider name
   */
  private capitalizeProvider(provider: string): string {
    const names: Record<string, string> = {
      openai: 'OpenAI',
      anthropic: 'Anthropic',
      google: 'Google',
      together: 'Together',
      fireworks: 'Fireworks',
      groq: 'Groq',
      cohere: 'Cohere',
      deepseek: 'DeepSeek',
      mistral: 'Mistral',
      aws: 'AWS',
      bedrock: 'AWS Bedrock'
    };
    return names[provider.toLowerCase()] || provider;
  }

  /**
   * Get pricing data date
   */
  getPricingDataDate(): string {
    return '2025-11';
  }

  /**
   * Update pricing data (for future use with live feeds)
   */
  async refreshPricing(): Promise<void> {
    // In the future, this could fetch from a pricing API
    // For now, we use static data
    console.log('Pricing data is current as of', this.getPricingDataDate());
  }
}

