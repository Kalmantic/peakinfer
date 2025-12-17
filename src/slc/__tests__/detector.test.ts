/**
 * Claude Detector Module Tests (TDD)
 *
 * Per Tech Design v1.1: Claude does semantic detection via 3 prompts:
 * - P1: DETECT_CALLSITES (chunk-level scanning)
 * - P2: CLASSIFY_CALLSITE (deep classification)
 * - P3: ESTIMATE_USAGE (optional)
 *
 * Tests mock the Claude SDK to verify:
 * - Prompt construction
 * - Response handling
 * - Error recovery
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CodeChunk, RawCallsite } from '../types';

// Mock the Anthropic SDK before importing detector
const mockCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: mockCreate,
    },
  })),
}));

// Import after mock is set up
import { createDetector, type ClaudeDetector } from '../detector';

describe('ClaudeDetector', () => {
  let detector: ClaudeDetector;

  beforeEach(() => {
    vi.clearAllMocks();
    detector = createDetector('test-api-key');
  });

  describe('detectCallsites() - P1 Prompt', () => {
    const testChunk: CodeChunk = {
      file: 'app.py',
      language: 'python',
      content: `import openai
client = openai.OpenAI()
response = client.chat.completions.create(model="gpt-4o", messages=[])`,
      startLine: 1,
      endLine: 3,
    };

    it('should send correctly structured P1 prompt', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify({
          task: 'detect_callsites',
          version: '1.0',
          callsites: [],
        })}],
      });

      await detector.detectCallsites(testChunk);

      expect(mockCreate).toHaveBeenCalledTimes(1);
      const call = mockCreate.mock.calls[0][0];
      expect(call.model).toBe('claude-sonnet-4-20250514');
      expect(call.max_tokens).toBeLessThanOrEqual(4096);
    });

    it('should return validated callsites from P1 response', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify({
          task: 'detect_callsites',
          version: '1.0',
          callsites: [
            {
              id: 'cs-001',
              file: 'app.py',
              startLine: 3,
              endLine: 3,
              code: 'client.chat.completions.create()',
              coarseKind: 'chat',
              confidence: 0.9,
            },
          ],
        })}],
      });

      const result = await detector.detectCallsites(testChunk);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('cs-001');
      expect(result[0].coarseKind).toBe('chat');
    });

    it('should filter low-confidence callsites', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify({
          task: 'detect_callsites',
          version: '1.0',
          callsites: [
            { id: 'cs-001', file: 'a.py', startLine: 1, endLine: 1, code: 'x', coarseKind: 'chat', confidence: 0.9 },
            { id: 'cs-002', file: 'b.py', startLine: 1, endLine: 1, code: 'y', coarseKind: 'chat', confidence: 0.2 },
          ],
        })}],
      });

      const result = await detector.detectCallsites(testChunk);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('cs-001');
    });

    it('should return empty array on API error', async () => {
      mockCreate.mockRejectedValueOnce(new Error('API Error'));

      const result = await detector.detectCallsites(testChunk);

      expect(result).toEqual([]);
    });

    it('should return empty array on malformed response', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'not json' }],
      });

      const result = await detector.detectCallsites(testChunk);

      expect(result).toEqual([]);
    });
  });

  describe('classifyCallsite() - P2 Prompt', () => {
    const testCallsite: RawCallsite = {
      id: 'cs-001',
      file: 'app.py',
      startLine: 10,
      endLine: 12,
      code: 'client.chat.completions.create(model="gpt-4o")',
      coarseKind: 'chat',
      confidence: 0.9,
    };

    const testContext = `import openai
client = openai.OpenAI()
response = client.chat.completions.create(model="gpt-4o", messages=[])`;

    it('should send correctly structured P2 prompt', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify({
          task: 'classify_callsite',
          version: '1.0',
          callsiteId: 'cs-001',
          provider: 'openai',
          model: 'gpt-4o',
          confidence: 0.85,
          reasoning: { whyProvider: 'x', whyModel: 'y' },
        })}],
      });

      await detector.classifyCallsite(testCallsite, testContext);

      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should return classified callsite with normalized provider', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify({
          task: 'classify_callsite',
          version: '1.0',
          callsiteId: 'cs-001',
          provider: 'OpenAI',  // Uppercase - should normalize
          model: 'gpt-4o',
          framework: null,
          runtime: null,
          taskKind: 'chat',
          isStreaming: false,
          confidence: 0.85,
          reasoning: { whyProvider: 'SDK import', whyModel: 'model param' },
        })}],
      });

      const result = await detector.classifyCallsite(testCallsite, testContext);

      expect(result).not.toBeNull();
      expect(result!.provider).toBe('openai');  // Normalized
      expect(result!.model).toBe('gpt-4o');
    });

    it('should return null for low-confidence classification', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify({
          task: 'classify_callsite',
          version: '1.0',
          callsiteId: 'cs-001',
          provider: 'openai',
          model: 'gpt-4',
          confidence: 0.2,  // Below threshold
          reasoning: { whyProvider: 'x', whyModel: 'y' },
        })}],
      });

      const result = await detector.classifyCallsite(testCallsite, testContext);

      expect(result).toBeNull();
    });

    it('should return null on API error', async () => {
      mockCreate.mockRejectedValueOnce(new Error('API Error'));

      const result = await detector.classifyCallsite(testCallsite, testContext);

      expect(result).toBeNull();
    });
  });

  describe('createDetector()', () => {
    it('should throw error if API key is missing', () => {
      expect(() => createDetector('')).toThrow('ANTHROPIC_API_KEY');
    });

    it('should create detector with valid API key', () => {
      const det = createDetector('valid-key');
      expect(det).toBeDefined();
      expect(typeof det.detectCallsites).toBe('function');
      expect(typeof det.classifyCallsite).toBe('function');
    });
  });
});
