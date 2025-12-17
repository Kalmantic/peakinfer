/**
 * Pricing Engine Module Tests (TDD)
 *
 * Per Tech Design v1.1:
 * - Deterministic pricing (no LLM)
 * - Static pricing.json lookup
 * - Cost estimation per callsite
 * - Hotspot identification
 */

import { describe, it, expect } from 'vitest';
import { calculatePricing, getModelPrice, PRICING_DATA } from '../pricing';
import type { ClassifiedCallsite, PricingSummary } from '../types';

describe('Pricing Engine', () => {
  describe('PRICING_DATA', () => {
    it('should contain OpenAI models', () => {
      expect(PRICING_DATA.openai).toBeDefined();
      expect(PRICING_DATA.openai['gpt-4o']).toBeDefined();
      expect(PRICING_DATA.openai['gpt-4o-mini']).toBeDefined();
    });

    it('should contain Anthropic models', () => {
      expect(PRICING_DATA.anthropic).toBeDefined();
      expect(PRICING_DATA.anthropic['claude-3-5-sonnet']).toBeDefined();
      expect(PRICING_DATA.anthropic['claude-3-5-haiku']).toBeDefined();
    });

    it('should have input and output prices per 1M tokens', () => {
      const gpt4o = PRICING_DATA.openai['gpt-4o'];
      expect(gpt4o.inputPer1M).toBeGreaterThan(0);
      expect(gpt4o.outputPer1M).toBeGreaterThan(0);
    });
  });

  describe('getModelPrice()', () => {
    it('should return pricing for known model', () => {
      const price = getModelPrice('openai', 'gpt-4o');

      expect(price).not.toBeNull();
      expect(price!.inputPer1M).toBeGreaterThan(0);
    });

    it('should return null for unknown provider', () => {
      const price = getModelPrice('unknownprovider', 'gpt-4o');

      expect(price).toBeNull();
    });

    it('should return null for unknown model', () => {
      const price = getModelPrice('openai', 'unknown-model-xyz');

      expect(price).toBeNull();
    });

    it('should handle null provider/model', () => {
      expect(getModelPrice(null, 'gpt-4o')).toBeNull();
      expect(getModelPrice('openai', null)).toBeNull();
    });
  });

  describe('calculatePricing()', () => {
    it('should return empty summary for empty callsites', () => {
      const result = calculatePricing([]);

      expect(result.estimatedRange.low).toBe(0);
      expect(result.estimatedRange.high).toBe(0);
      expect(result.byProvider).toHaveLength(0);
      expect(result.byModel).toHaveLength(0);
      expect(result.hotspots).toHaveLength(0);
    });

    it('should calculate costs for single callsite', () => {
      const callsites: ClassifiedCallsite[] = [
        {
          id: 'cs-001',
          file: 'app.py',
          line: 10,
          provider: 'openai',
          model: 'gpt-4o',
          framework: null,
          runtime: null,
          taskKind: 'chat',
          isStreaming: false,
          confidence: 0.9,
          reasoning: { whyProvider: 'x', whyModel: 'y' },
        },
      ];

      const result = calculatePricing(callsites);

      expect(result.estimatedRange.low).toBeGreaterThan(0);
      expect(result.estimatedRange.high).toBeGreaterThan(result.estimatedRange.low);
      expect(result.byProvider).toHaveLength(1);
      expect(result.byProvider[0].provider).toBe('openai');
    });

    it('should aggregate costs by provider', () => {
      const callsites: ClassifiedCallsite[] = [
        {
          id: 'cs-001',
          file: 'a.py',
          line: 1,
          provider: 'openai',
          model: 'gpt-4o',
          framework: null,
          runtime: null,
          taskKind: 'chat',
          isStreaming: false,
          confidence: 0.9,
          reasoning: { whyProvider: 'x', whyModel: 'y' },
        },
        {
          id: 'cs-002',
          file: 'b.py',
          line: 1,
          provider: 'openai',
          model: 'gpt-4o-mini',
          framework: null,
          runtime: null,
          taskKind: 'chat',
          isStreaming: false,
          confidence: 0.9,
          reasoning: { whyProvider: 'x', whyModel: 'y' },
        },
        {
          id: 'cs-003',
          file: 'c.py',
          line: 1,
          provider: 'anthropic',
          model: 'claude-3-5-sonnet',
          framework: null,
          runtime: null,
          taskKind: 'chat',
          isStreaming: false,
          confidence: 0.9,
          reasoning: { whyProvider: 'x', whyModel: 'y' },
        },
      ];

      const result = calculatePricing(callsites);

      expect(result.byProvider).toHaveLength(2);
      const providers = result.byProvider.map((p) => p.provider);
      expect(providers).toContain('openai');
      expect(providers).toContain('anthropic');
    });

    it('should calculate percentages by provider', () => {
      const callsites: ClassifiedCallsite[] = [
        {
          id: 'cs-001',
          file: 'a.py',
          line: 1,
          provider: 'openai',
          model: 'gpt-4o',
          framework: null,
          runtime: null,
          taskKind: 'chat',
          isStreaming: false,
          confidence: 0.9,
          reasoning: { whyProvider: 'x', whyModel: 'y' },
        },
      ];

      const result = calculatePricing(callsites);

      expect(result.byProvider[0].percentage).toBe(100);
    });

    it('should identify most expensive model', () => {
      const callsites: ClassifiedCallsite[] = [
        {
          id: 'cs-001',
          file: 'a.py',
          line: 1,
          provider: 'openai',
          model: 'gpt-4o',
          framework: null,
          runtime: null,
          taskKind: 'chat',
          isStreaming: false,
          confidence: 0.9,
          reasoning: { whyProvider: 'x', whyModel: 'y' },
        },
        {
          id: 'cs-002',
          file: 'b.py',
          line: 1,
          provider: 'openai',
          model: 'gpt-4o-mini',  // Cheaper
          framework: null,
          runtime: null,
          taskKind: 'chat',
          isStreaming: false,
          confidence: 0.9,
          reasoning: { whyProvider: 'x', whyModel: 'y' },
        },
      ];

      const result = calculatePricing(callsites);

      expect(result.mostExpensiveModel).toBe('gpt-4o');
    });

    it('should generate hotspots sorted by cost', () => {
      const callsites: ClassifiedCallsite[] = [
        {
          id: 'cs-001',
          file: 'cheap.py',
          line: 1,
          provider: 'openai',
          model: 'gpt-4o-mini',
          framework: null,
          runtime: null,
          taskKind: 'chat',
          isStreaming: false,
          confidence: 0.9,
          reasoning: { whyProvider: 'x', whyModel: 'y' },
        },
        {
          id: 'cs-002',
          file: 'expensive.py',
          line: 1,
          provider: 'openai',
          model: 'gpt-4o',
          framework: null,
          runtime: null,
          taskKind: 'chat',
          isStreaming: false,
          confidence: 0.9,
          reasoning: { whyProvider: 'x', whyModel: 'y' },
        },
      ];

      const result = calculatePricing(callsites);

      expect(result.hotspots).toHaveLength(2);
      // Hotspots sorted by cost descending
      expect(result.hotspots[0].file).toBe('expensive.py');
    });

    it('should handle unknown models gracefully', () => {
      const callsites: ClassifiedCallsite[] = [
        {
          id: 'cs-001',
          file: 'app.py',
          line: 1,
          provider: 'openai',
          model: 'unknown-model',
          framework: null,
          runtime: null,
          taskKind: 'chat',
          isStreaming: false,
          confidence: 0.9,
          reasoning: { whyProvider: 'x', whyModel: 'y' },
        },
      ];

      const result = calculatePricing(callsites);

      // Should not crash, use default/zero pricing
      expect(result.estimatedRange.low).toBe(0);
    });
  });
});
