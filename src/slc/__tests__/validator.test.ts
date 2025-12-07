/**
 * Validator Module Tests (TDD)
 *
 * Per Tech Design v1.1: "Claude outputs are validated, not trusted."
 *
 * Tests:
 * - JSON schema validation
 * - Confidence filtering
 * - Provider/model normalization
 * - Invalid data rejection
 */

import { describe, it, expect } from 'vitest';
import { validateP1Response, validateP2Response, normalizeProvider } from '../validator';
import type { RawCallsite, ClassifiedCallsite } from '../types';

describe('Validator', () => {
  describe('validateP1Response()', () => {
    it('should accept valid P1 response', () => {
      const raw = {
        task: 'detect_callsites',
        version: '1.0',
        callsites: [
          {
            id: 'cs-001',
            file: 'app.py',
            startLine: 10,
            endLine: 12,
            code: 'openai.chat.completions.create()',
            coarseKind: 'chat',
            confidence: 0.9,
          },
        ],
      };

      const result = validateP1Response(raw);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('cs-001');
      expect(result[0].confidence).toBe(0.9);
    });

    it('should filter out low confidence callsites (< 0.4)', () => {
      const raw = {
        task: 'detect_callsites',
        version: '1.0',
        callsites: [
          { id: 'cs-001', file: 'a.py', startLine: 1, endLine: 1, code: 'x', coarseKind: 'chat', confidence: 0.9 },
          { id: 'cs-002', file: 'b.py', startLine: 1, endLine: 1, code: 'y', coarseKind: 'chat', confidence: 0.3 },
          { id: 'cs-003', file: 'c.py', startLine: 1, endLine: 1, code: 'z', coarseKind: 'chat', confidence: 0.5 },
        ],
      };

      const result = validateP1Response(raw);

      expect(result).toHaveLength(2);
      expect(result.map(c => c.id)).toEqual(['cs-001', 'cs-003']);
    });

    it('should reject response without callsites array', () => {
      const raw = { task: 'detect_callsites', version: '1.0' };

      const result = validateP1Response(raw);

      expect(result).toHaveLength(0);
    });

    it('should reject malformed callsite entries', () => {
      const raw = {
        task: 'detect_callsites',
        version: '1.0',
        callsites: [
          { id: 'cs-001' }, // Missing required fields
          { id: 'cs-002', file: 'a.py', startLine: 1, endLine: 1, code: 'x', coarseKind: 'chat', confidence: 0.8 },
        ],
      };

      const result = validateP1Response(raw);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('cs-002');
    });

    it('should handle null/undefined input', () => {
      expect(validateP1Response(null)).toEqual([]);
      expect(validateP1Response(undefined)).toEqual([]);
    });
  });

  describe('validateP2Response()', () => {
    it('should accept valid P2 response', () => {
      const raw = {
        task: 'classify_callsite',
        version: '1.0',
        callsiteId: 'cs-001',
        provider: 'openai',
        model: 'gpt-4o',
        framework: null,
        runtime: null,
        taskKind: 'chat',
        isStreaming: false,
        confidence: 0.85,
        reasoning: {
          whyProvider: 'OpenAI SDK import detected',
          whyModel: 'gpt-4o specified in model parameter',
        },
      };

      const result = validateP2Response(raw, 'app.py', 10);

      expect(result).not.toBeNull();
      expect(result!.provider).toBe('openai');
      expect(result!.model).toBe('gpt-4o');
    });

    it('should filter out low confidence responses (< 0.4)', () => {
      const raw = {
        task: 'classify_callsite',
        version: '1.0',
        callsiteId: 'cs-001',
        provider: 'openai',
        model: 'gpt-4',
        confidence: 0.3,
        reasoning: { whyProvider: 'x', whyModel: 'y' },
      };

      const result = validateP2Response(raw, 'app.py', 10);

      expect(result).toBeNull();
    });

    it('should normalize provider names', () => {
      const raw = {
        task: 'classify_callsite',
        version: '1.0',
        callsiteId: 'cs-001',
        provider: 'OpenAI',  // Uppercase
        model: 'gpt-4o',
        confidence: 0.8,
        reasoning: { whyProvider: 'x', whyModel: 'y' },
      };

      const result = validateP2Response(raw, 'app.py', 10);

      expect(result!.provider).toBe('openai');
    });

    it('should handle missing optional fields', () => {
      const raw = {
        task: 'classify_callsite',
        version: '1.0',
        callsiteId: 'cs-001',
        provider: 'anthropic',
        model: 'claude-3-sonnet',
        confidence: 0.9,
        reasoning: { whyProvider: 'x', whyModel: 'y' },
        // Missing: framework, runtime, taskKind, isStreaming
      };

      const result = validateP2Response(raw, 'app.py', 10);

      expect(result).not.toBeNull();
      expect(result!.framework).toBeNull();
      expect(result!.runtime).toBeNull();
    });
  });

  describe('normalizeProvider()', () => {
    it('should lowercase provider names', () => {
      expect(normalizeProvider('OpenAI')).toBe('openai');
      expect(normalizeProvider('ANTHROPIC')).toBe('anthropic');
      expect(normalizeProvider('Google')).toBe('google');
    });

    it('should normalize common variations', () => {
      expect(normalizeProvider('open_ai')).toBe('openai');
      expect(normalizeProvider('open-ai')).toBe('openai');
      expect(normalizeProvider('gpt')).toBe('openai');
      expect(normalizeProvider('claude')).toBe('anthropic');
      expect(normalizeProvider('gemini')).toBe('google');
    });

    it('should handle null/undefined', () => {
      expect(normalizeProvider(null)).toBeNull();
      expect(normalizeProvider(undefined)).toBeNull();
    });

    it('should pass through unknown providers', () => {
      expect(normalizeProvider('together')).toBe('together');
      expect(normalizeProvider('fireworks')).toBe('fireworks');
    });
  });
});
